// SPDX-License-Identifier: MIT

pragma solidity 0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ConsortiumSettings.sol";
import "./FlightInsuranceHandler.sol";

contract ConsortiumOracle is Ownable, AccessControl {
    using SafeMath for uint256;

    ConsortiumSettings private settings;
    FlightInsuranceHandler private handler;
    uint8 private nonce = 0;

    // ----------------- ORACLE -----------------
    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }
    mapping(address => Oracle) private oracles;

    // ----------------- FLIGHT -----------------
    enum FlightStatus {
        UNKNOWN,
        ON_TIME,
        LATE_AIRLINE,
        LATE_WEATHER,
        LATE_TECHNICAL,
        LATE_OTHER
    }

    // ----------------- RESPONSES -----------------
    struct ResponseInfo {
        address requester;
        bool isOpen; // if open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // statusCode => oracles
    }
    mapping(bytes32 => ResponseInfo) private oracleResponses; // Key = hash(index, flight, timestamp)

    // ----------------- EVENTS -----------------
    event LogOracleRegistered(address oracle);

    event LogFlightStatus(
        address airline,
        bytes32 flight,
        uint256 timestamp,
        FlightStatus status
    );

    event LogOracleReport(
        address airline,
        bytes32 flight,
        uint256 timestamp,
        FlightStatus status
    );

    // ----------------- MODIFIERS -----------------

    modifier onlyOracle() {
        require(
            hasRole(settings.ORACLE_ROLE(), msg.sender),
            "Caller is not a registered Oracle"
        );
        _;
    }

    modifier onlyOracleFee() {
        require(
            msg.value == settings.ORACLE_MEMBERSHIP_FEE(),
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
    constructor(address _flightInsuranceHandler, address _settings) public {
        settings = ConsortiumSettings(_settings);
        handler = FlightInsuranceHandler(_flightInsuranceHandler);

        _setupRole(settings.ADMIN_ROLE(), msg.sender);
    }

    function registerOracle() external payable onlyOracleFee {
        oracles[msg.sender] = Oracle({
            isRegistered: true,
            indexes: _generateIndexes(msg.sender)
        });
        _setupRole(settings.ORACLE_ROLE(), msg.sender);

        emit LogOracleRegistered(msg.sender);
    }

    function getMyIndexes() external view onlyOracle returns (uint8[3] memory) {
        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
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
            airline,
            flight,
            timestamp,
            FlightStatus(statusCode)
        );

        if (
            oracleResponses[key].responses[statusCode].length >=
            settings.ORACLE_CONSENSUS_RESPONSES()
        ) {
            emit LogFlightStatus(
                airline,
                flight,
                timestamp,
                FlightStatus(statusCode)
            );

            handler.processFlightStatus(
                key,
                airline,
                flight,
                timestamp,
                uint8(statusCode)
            );
        }
    }

    // ----------------- UTILITY -----------------
    function _getResponseKey(
        uint8 index,
        address airline,
        bytes32 flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(index, airline, flight, timestamp));
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
