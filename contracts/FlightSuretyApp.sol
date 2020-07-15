// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./FlightSuretyData.sol";

/**
 * FlightSurety Smart Contract
 */
contract FlightSuretyApp is Ownable {
    using SafeMath for uint256;
    FlightSuretyData flightSuretyData;

    uint8 public constant AIRLINE_REGISTRATION_FEE = 10 ether;
    uint8 public constant MAX_INSURANCE_FEE = 1 ether;

    enum FlightStatus {
        UNKNOWN,
        ON_TIME,
        LATE_AIRLINE,
        LATE_WEATHER,
        LATE_TECHNICAL,
        LATE_OTHER
    }

    enum AirlineStatus {
        REGISTERED,
        APPROVAL_PENDING,
        APPROVED,
        NOT_APPROVED,
        FUNDED
    }

    struct Flight {
        bool isRegistered;
        FlightStatus status;
        uint256 updatedTimestamp;
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    /**
     * @dev used on all state changing functions to pause the contract if needed
     */
    modifier onlyOperational() {
        require(isOperational(), "CONTRACT_IS_NOT_OPERATIONAL");
        _;
    }

    /**
     * @dev Contract constructor
     *
     */
    constructor(address _flightSuretyDataContract) public {
        contractOwner = msg.sender;
        // TO-DO: cannot be the ZERO_ADDRESS
        flightSuretyData = _flightSuretyDataContract;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns (bool) {
        return flightSuretyData.isOperational();
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *
     */

    function registerAirline()
        external
        onlyOperational
        returns (bool success, uint256 votes)
    {
        // requirements

        return (success, airlineVotes.length);
    }

    /**
     * @dev Register a future flight for insuring.
     *
     */

    function registerFlight() external pure {}

    /**
     * @dev Called after oracle has updated flight status
     *
     */

    function processFlightStatus(
        address airline,
        string memory flight,
        uint256 timestamp,
        uint8 statusCode
    ) internal pure {}

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(
        address airline,
        string calldata flight,
        uint256 timestamp
    ) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit OracleRequest(index, airline, flight, timestamp);
    }
}
