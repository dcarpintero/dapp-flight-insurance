// SPDX-License-Identifier: MIT

pragma solidity 0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/payment/PullPayment.sol";

import "./ConsortiumAlliance.sol";

contract FlightInsuranceHandler is Ownable, AccessControl, PullPayment {
    using SafeMath for uint256;

    ConsortiumAlliance private consortium;
    uint8 private nonce = 0;

    // ----------------- FLIGHT -----------------
    enum FlightStatus {
        UNKNOWN,
        ON_TIME,
        LATE_AIRLINE,
        LATE_WEATHER,
        LATE_TECHNICAL,
        LATE_OTHER
    }

    struct Flight {
        bool isRegistered;
        FlightStatus status;
        uint256 updatedTimestamp;
        address airline;
    }
    mapping(bytes32 => Flight) private flights;
    bytes32[] private flightKeys;

    // ----------------- FLIGHT INSURANCE -----------------
    mapping(bytes32 => bytes32[]) private flightInsurances;

    // ----------------- ORACLE RESPONSES -----------------
    struct ResponseInfo {
        address requester;
        bool isOpen; // if open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // status => oracles
    }
    mapping(bytes32 => ResponseInfo) private oracleResponses; // Key = hash(index, flight, timestamp)

    // ----------------- EVENTS -----------------
    event LogAirlineRegistered(address indexed airline, string title);
    event LogFlightRegistered(
        address indexed airline,
        bytes32 key,
        bytes32 flight,
        uint256 timestamp
    );
    event LogFlightInsuranceRegistered(
        bytes32 key,
        bytes32 flight,
        address indexed insuree
    );

    event LogFlightStatusRequested(
        bytes32 key,
        uint8 index,
        address indexed airline,
        string flight,
        uint256 timestamp
    );

    event LogFlightStatusProcessed(
        bytes32 key,
        address indexed airline,
        bytes32 flight
    );

    event LogInsureeCredited(bytes32 flight, bytes32 key);
    event LogConsortiumCredited(bytes32 flight, bytes32 key);

    // ----------------- MODIFIERS -----------------
    event LogAdminRegistered(address admin);

    modifier onlyOperational() {
        require(isOperational(), "Contract is currently not operational");
        _;
    }

    modifier onlyAdmin() {
        require(
            hasRole(consortium.settings().ADMIN_ROLE(), msg.sender),
            "Caller is not Admin"
        );
        _;
    }

    modifier onlyConsortiumAirline() {
        require(
            consortium.isConsortiumAffiliate(msg.sender),
            "Caller is not a consortium Airline"
        );
        _;
    }

    modifier onlyValidFlight(bytes32 key) {
        require(flights[key].isRegistered, "Invalid flight key");
        _;
    }

    modifier onlyValidResponse(bytes32 requestKey) {
        require(
            oracleResponses[requestKey].isOpen,
            "This flight status request has been resolved already"
        );
        _;
    }

    // ----------------- CONSTRUCTOR -----------------

    constructor(address _consortiumAlliance) public {
        consortium = ConsortiumAlliance(_consortiumAlliance);
        _setupRole(consortium.settings().ADMIN_ROLE(), msg.sender);
        emit LogAdminRegistered(msg.sender);
    }

    function isOperational() public view returns (bool) {
        return consortium.isOperational();
    }

    function isAdmin(address _address)
        public
        view
        onlyOperational
        returns (bool)
    {
        return hasRole(consortium.settings().ADMIN_ROLE(), _address);
    }

    /**
     * @dev Register a future flight for insuring.
     */
    function registerFlight(bytes32 flight, uint256 timestamp)
        external
        onlyOperational
        onlyConsortiumAirline
        returns (bytes32)
    {
        bytes32 key = _getFlightKey(msg.sender, flight, timestamp);

        flights[key] = Flight({
            isRegistered: true,
            airline: msg.sender,
            status: FlightStatus.UNKNOWN,
            updatedTimestamp: timestamp
        });
        flightKeys.push(key);

        emit LogFlightRegistered(msg.sender, key, flight, timestamp);
        return key;
    }

    /**
     * @dev Register a new flight insurance.
     */
    function registerFlightInsurance(bytes32 _flightKey)
        external
        payable
        onlyValidFlight(_flightKey)
        onlyOperational
        returns (bytes32)
    {
        bytes32 insurance = consortium.depositInsurance.value(msg.value)(
            msg.sender
        );

        flightInsurances[_flightKey].push(insurance);

        emit LogFlightInsuranceRegistered(insurance, _flightKey, msg.sender);
        return insurance;
    }

    /**
     * @dev Generates a request for oracles to request flight information
     */
    function requestFlightStatus(
        address airline,
        string calldata flight,
        uint256 timestamp
    ) external onlyOperational {
        uint8 index = _getRandomIndex(msg.sender);
        bytes32 key = _getResponseKey(index, airline, flight, timestamp);

        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit LogFlightStatusRequested(key, index, airline, flight, timestamp);
    }

    /**
     * @dev Called after oracles have reached consensus on flight status
     */

    function processFlightStatus(
        bytes32 requestKey,
        address airline,
        bytes32 flight,
        uint256 timestamp,
        FlightStatus status
    )
        external
        // TO-DO:: onlyOracle, onlyAdmin
        onlyValidResponse(requestKey)
    {
        require(
            status != FlightStatus.UNKNOWN,
            "Unknown FlightStatus cannot be processed"
        );

        bytes32 key = _getFlightKey(airline, flight, timestamp);
        flights[key].status = status;
        oracleResponses[requestKey].isOpen = false;

        if (flights[key].status == FlightStatus.LATE_AIRLINE) {
            _creditInsuree(key);
        } else {
            _creditConsortium(key);
        }

        emit LogFlightStatusProcessed(key, airline, flight);
    }

    /**
     * @dev Credits insurance deposits and premiums to the insurees of
     *      a flight key by transfering the total amount to a escrow account.
     *
     */
    function _creditInsuree(bytes32 flight) internal {
        for (uint256 i = 0; i < flightInsurances[flight].length; i++) {
            bytes32 key = flightInsurances[flight][i];

            consortium.creditInsuree(key);
            emit LogInsureeCredited(flight, key);
        }
    }

    /**
     * @dev Credits the insurance deposits of a flight key to the Consortium.
     */
    function _creditConsortium(bytes32 flight) internal {
        for (uint256 i = 0; i < flightInsurances[flight].length; i++) {
            bytes32 key = flightInsurances[flight][i];

            consortium.creditConsortium(key);
            emit LogConsortiumCredited(flight, key);
        }
    }

    // ----------------- UTILITY -----------------
    function _getFlightKey(
        address airline,
        bytes32 flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function _getResponseKey(
        uint8 index,
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(index, airline, flight, timestamp));
    }

    function _getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }
}
