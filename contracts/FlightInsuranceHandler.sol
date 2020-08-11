// SPDX-License-Identifier: MIT

pragma solidity 0.6.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/payment/PullPayment.sol";

import "./ConsortiumAlliance.sol";

/**
 * @title FlightInsuranceHandler
 * @dev Provides specific business logic for airlines', flights' and insurances registration.
 *
 *      - As a delegate of ConsortiumAlliance, airlines are registered
 *        as affiliates, passengers as insurees and flight insurances as
 *        insurance deposits.
 *
 *      - Trusted Oracles match the request index code, and agree on flight status
 *        to resolve insurances.
 *
 *      - Unreedemable insurances are credited to the shared consortium account,
 *        whereas insurances for flights resolved with LATE_AIRLINE status code
 *        result in a escrow account being credited with the premium.
 *
 *      - Insurees shall withdraw the funds from said escrow account.
 *
 *      - see also ConsortiumAlliance contract.
 */
contract FlightInsuranceHandler is Ownable, AccessControl, PullPayment {
    ConsortiumAlliance private consortium;
    uint8 private nonce = 0;

    // --------------- FLIGHT -------------------------------------------------
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
        address airline;
        uint256 updatedTimestamp;
        FlightStatus status;
    }
    mapping(bytes32 => Flight) public flights;
    bytes32[] private flightKeys;

    // --------------- FLIGHT INSURANCE ---------------------------------------
    mapping(bytes32 => bytes32[]) private flightInsurances;

    // --------------- ORACLES ------------------------------------------------
    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }
    mapping(address => Oracle) public oracles;

    struct ResponseInfo {
        address requester;
        bool isOpen;
        mapping(uint8 => address[]) responses; // status => oracles
    }
    mapping(bytes32 => ResponseInfo) private oracleResponses; // Key = hash(index, flightKey)

    // --------------- EVENTS -------------------------------------------------
    event LogAdminRegistered(address admin);
    event LogDelegateRegistered(address _address);

    event LogAirlineRegistered(address indexed airline, string title);
    event LogOracleRegistered(address oracle);

    event LogFlightRegistered(
        bytes32 key,
        address indexed airline,
        bytes32 hexcode,
        uint256 timestamp
    );
    event LogFlightInsuranceRegistered(
        bytes32 insurance,
        bytes32 flight,
        address indexed insuree
    );

    event LogFlightStatusRequested(
        bytes32 flight,
        bytes32 response,
        uint8 index
    );

    event LogFlightStatusResolved(bytes32 flight, FlightStatus status);
    event LogOracleReport(address oracle, bytes32 flight, FlightStatus status);
    event LogFlightStatusProcessed(bytes32 flight);

    event LogInsureeCredited(bytes32 flight, bytes32 key);
    event LogConsortiumCredited(bytes32 flight, bytes32 key);

    // --------------- MODIFIERS ----------------------------------------------
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

    modifier onlyValidFlight(bytes32 key) {
        require(flights[key].isRegistered, "Invalid flight");
        _;
    }

    modifier onlyOpenResponse(uint8 index, bytes32 flightKey) {
        bytes32 key = _getResponseKey(index, flightKey);
        require(
            oracleResponses[key].isOpen,
            "Flight or timestamp do not match oracle request"
        );
        _;
    }

    /**
     * @dev Constructor.
     */
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
    function registerFlight(bytes32 hexcode, uint256 timestamp)
        external
        onlyOperational
        onlyConsortiumAirline
        returns (bytes32)
    {
        address airline = msg.sender;
        bytes32 key = _getFlightKey(airline, hexcode, timestamp);

        flights[key] = Flight({
            isRegistered: true,
            airline: airline,
            status: FlightStatus.UNKNOWN,
            updatedTimestamp: timestamp
        });

        flightKeys.push(key);

        emit LogFlightRegistered(key, airline, hexcode, timestamp);
        return key;
    }

    /**
     * @dev Register a new flight insurance.
     */
    function registerFlightInsurance(bytes32 flightKey)
        external
        payable
        onlyValidFlightKey(flightKey)
        onlyOperational
        returns (bytes32)
    {
        bytes32 insuranceKey = consortium.depositInsurance.value(msg.value)(
            msg.sender
        );

        flightInsurances[flightKey].push(insuranceKey);

        emit LogFlightInsuranceRegistered(insuranceKey, flightKey, msg.sender);
        return insuranceKey;
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

    /**
     * @dev Requests flight information to Oracles.
     */
    function requestFlightStatus(bytes32 flightKey) external onlyOperational {
        uint8 index = _getRandomIndex(msg.sender);
        bytes32 responseKey = _getResponseKey(index, flightKey);

        oracleResponses[responseKey] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit LogFlightStatusRequested(flightKey, responseKey, index);
    }

    /**
     * @dev Called by Oracles when a response is available to an outstanding request
     *      For the response to be accepted, there must be a pending request that is open
     *      and matches one of the three Indexes randomly assigned to the oracle at the
     *      time of registration (i.e. only trusted oracles).
     */
    function submitOracleResponse(
        uint8 index,
        bytes32 flightKey,
        uint8 statusCode
    ) external onlyTrustedOracle(index) onlyOpenResponse(index, flightKey) {
        bytes32 responseKey = _getResponseKey(index, flightKey);

        oracleResponses[responseKey].responses[statusCode].push(msg.sender);

        emit LogOracleReport(msg.sender, flightKey, FlightStatus(statusCode));

        if (
            oracleResponses[responseKey].responses[statusCode].length >=
            consortium.settings().ORACLE_CONSENSUS_RESPONSES()
        ) {
            emit LogFlightStatusResolved(flightKey, FlightStatus(statusCode));

            _processFlightStatus(responseKey, flightKey, uint8(statusCode));
        }
    }

    /**
     * @dev Called after oracles have reached consensus on flight status.
     */
    function _processFlightStatus(
        bytes32 responseKey,
        bytes32 flightKey,
        uint8 statusCode
    ) internal onlyValidFlight(flightKey) {
        FlightStatus status = FlightStatus(statusCode);

        require(
            status != FlightStatus.UNKNOWN,
            "Unknown FlightStatus cannot be processed"
        );

        require(
            oracleResponses[responseKey].isOpen,
            "This flight status request has been resolved already"
        );

        flights[flightKey].status = status;
        oracleResponses[responseKey].isOpen = false;

        if (flights[flightKey].status == FlightStatus.LATE_AIRLINE) {
            _creditInsuree(flightKey);
        } else {
            _creditConsortium(flightKey);
        }

        emit LogFlightStatusProcessed(flightKey);
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

    // --------------- MATH ---------------------------------------------------
    function _getFlightKey(
        address airline,
        bytes32 flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function _getResponseKey(uint8 index, bytes32 flightKey)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(index, flightKey));
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

    function _getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for the last 256 blocks
        }

        return random;
    }
}
