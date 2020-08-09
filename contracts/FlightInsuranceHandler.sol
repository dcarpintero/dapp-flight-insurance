// SPDX-License-Identifier: MIT

pragma solidity 0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/payment/PullPayment.sol";

import "./ConsortiumAlliance.sol";

/**
 * @title FlightInsuranceHandler
 * @dev Provides specific business logic of airlines', flights' and insurances registration.
 *
 *      - As a delegate of ConsortiumAlliance, airlines are registered
 *        as affiliates, passengers as insurees and flight insurances as
 *        insurance deposits.
 *
 *      - Trusted Oracles match the request index code, and  agree on flight status
 *        to resolve insurances.
 *
 *      - Unreedemable insurances are credited to the shared  consortium account,
 *        whereas insurances for flights resolved with  LATE_AIRLINE status code
 *        result in a escrow account credited with the premium.
 *
 *      - Insurees shall withdraw the funds from said escrow account.
 *
 *      - see also ConsortiumAlliance contract.
 */
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
    mapping(bytes32 => Flight) public flights;
    bytes32[] private flightKeys;

    // ----------------- FLIGHT INSURANCE -----------------
    mapping(bytes32 => bytes32[]) private flightInsurances;

    // ----------------- ORACLES  -----------------
    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }
    mapping(address => Oracle) public oracles;

    struct ResponseInfo {
        address requester;
        bool isOpen; // if open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // status => oracles
    }
    mapping(bytes32 => ResponseInfo) private oracleResponses; // Key = hash(index, flight, timestamp)

    // ----------------- EVENTS -----------------
    event LogDelegateRegistered(address _address);

    event LogAirlineRegistered(address indexed airline, string title);
    event LogOracleRegistered(address oracle);
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
        bytes32 flight,
        uint256 timestamp
    );

    event LogFlightStatus(
        address airline,
        bytes32 flight,
        uint256 timestamp,
        FlightStatus status
    );

    event LogOracleReport(
        address oracle,
        address airline,
        bytes32 flight,
        uint256 timestamp,
        FlightStatus status
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

    modifier onlyDelegate() {
        require(
            hasRole(consortium.settings().DELEGATE_ROLE(), msg.sender),
            "Caller is not Delegate"
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

    modifier onlyOracle() {
        require(
            hasRole(consortium.settings().ORACLE_ROLE(), msg.sender),
            "Caller is not a registered Oracle"
        );
        _;
    }

    modifier onlyOracleFee() {
        require(
            msg.value == consortium.settings().ORACLE_MEMBERSHIP_FEE(),
            "Unexpected membership fee"
        );
        _;
    }

    modifier onlyTrustedOracle(uint8 index) {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );
        _;
    }

    modifier onlyValidFlightKey(bytes32 key) {
        require(flights[key].isRegistered, "Invalid flight key");
        _;
    }

    modifier onlyValidFlight(
        address airline,
        bytes32 flight,
        uint256 timestamp
    ) {
        bytes32 key = _getFlightKey(airline, flight, timestamp);
        require(flights[key].isRegistered, "Invalid flight");
        _;
    }

    modifier onlyOpenResponse(
        uint8 index,
        address airline,
        bytes32 flight,
        uint256 timestamp
    ) {
        bytes32 key = _getResponseKey(index, airline, flight, timestamp);
        require(
            oracleResponses[key].isOpen,
            "Flight or timestamp do not match oracle request"
        );
        _;
    }

    // ----------------- CONSTRUCTOR -----------------

    constructor(address _consortiumAlliance) public {
        consortium = ConsortiumAlliance(_consortiumAlliance);
        _setupRole(consortium.settings().ADMIN_ROLE(), msg.sender);
        emit LogAdminRegistered(msg.sender);
    }

    function addDelegateRole(address _address)
        external
        onlyAdmin
        onlyOperational
    {
        require(_address != address(0), "Delegate cannot be the zero address");

        _setupRole(consortium.settings().DELEGATE_ROLE(), _address);
        emit LogDelegateRegistered(_address);
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
        onlyValidFlightKey(_flightKey)
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
     * @dev Register a new Oracle.
     */
    function registerOracle() external payable onlyOracleFee {
        oracles[msg.sender] = Oracle({
            isRegistered: true,
            indexes: _generateIndexes(msg.sender)
        });
        _setupRole(consortium.settings().ORACLE_ROLE(), msg.sender);

        emit LogOracleRegistered(msg.sender);
    }

    function getMyIndexes() external view onlyOracle returns (uint8[3] memory) {
        return oracles[msg.sender].indexes;
    }

    function getText() external pure returns (string memory) {
        return "hello world";
    }

    /**
     * @dev Generates a request for oracles to request flight information
     */
    function requestFlightStatus(
        address airline,
        bytes32 flight,
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
     * @dev Called by oracles when a response is available to an outstanding request
     *      For the response to be accepted, there must be a pending request that is open
     *      and matches one of the three Indexes randomly assigned to the oracle at the
     *      time of registration (i.e. only trusted oracles).
     */
    function submitOracleResponse(
        uint8 index,
        address airline,
        bytes32 flight,
        uint256 timestamp,
        uint8 statusCode
    )
        external
        onlyTrustedOracle(index)
        onlyOpenResponse(index, airline, flight, timestamp)
    {
        bytes32 key = _getResponseKey(index, airline, flight, timestamp);

        oracleResponses[key].responses[statusCode].push(msg.sender);
        emit LogOracleReport(
            msg.sender,
            airline,
            flight,
            timestamp,
            FlightStatus(statusCode)
        );

        if (
            oracleResponses[key].responses[statusCode].length >=
            consortium.settings().ORACLE_CONSENSUS_RESPONSES()
        ) {
            emit LogFlightStatus(
                airline,
                flight,
                timestamp,
                FlightStatus(statusCode)
            );

            _processFlightStatus(
                key,
                airline,
                flight,
                timestamp,
                uint8(statusCode)
            );
        }
    }

    /**
     * @dev Called after oracles have reached consensus on flight status
     */

    function _processFlightStatus(
        bytes32 responseKey,
        address airline,
        bytes32 flight,
        uint256 timestamp,
        uint8 statusCode
    ) internal onlyValidFlight(airline, flight, timestamp) {
        FlightStatus status = FlightStatus(statusCode);

        require(
            status != FlightStatus.UNKNOWN,
            "Unknown FlightStatus cannot be processed"
        );

        require(
            oracleResponses[responseKey].isOpen,
            "This flight status request has been resolved already"
        );

        bytes32 flightKey = _getFlightKey(airline, flight, timestamp);

        flights[flightKey].status = status;
        oracleResponses[responseKey].isOpen = false;

        if (flights[flightKey].status == FlightStatus.LATE_AIRLINE) {
            _creditInsuree(flightKey);
        } else {
            _creditConsortium(flightKey);
        }

        emit LogFlightStatusProcessed(flightKey, airline, flight);
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

    function _generateIndexes(address account)
        internal
        returns (uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = _getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = _getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = _getRandomIndex(account);
        }

        return indexes;
    }

    function _getResponseKey(
        uint8 index,
        address airline,
        bytes32 flight,
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
