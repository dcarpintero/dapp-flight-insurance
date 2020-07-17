// SPDX-License-Identifier: MIT

pragma solidity ^0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/PullPayment.sol";

// Have the first airline automatically deployed
// Registration of the fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines. (OK)

// Passenger INSURANCE_MAX_FEE = 1 ether (ok)
// Flight numbers and timestamps are fixed in DAPP client
// If flight is delayed due to AIRLINE_FAULT (LATE_AIRLINE) the passengers get the insurance premium
// The passengers accumulate the funds in their balance (ok)

// ORACLES are implemented as a server app.
// Upon startup, 20+ oracles are registered and their indexes are assigned.

// OperationalStatusControl: every critical state change control - also on voting mechanism (OK)
// FailFast (OK)

contract FlightSuretyData is Ownable, AccessControl, PullPayment {
    using SafeMath for uint256;
    using SafeMath for uint16;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AIRLINE_ROLE = keccak256("AIRLINE_ROLE");
    bytes32 public constant INSUREE_ROLE = keccak256("INSUREE_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint8 public constant AIRLINE_REGISTRATION_FEE = 10 ether;
    uint8 public constant INSURANCE_MAX_FEE = 1 ether;
    uint8 public constant INSURANCE_PREMIUM = 1.5 ether;

    // CONSORTIUM & OPERATIONAL CONSENSUS
    struct Consortium {
        uint256 balance;
        uint256 insuranceAmount;
        bool isOperational;
        uint16 totalON;
        uint16 totalOFF;
        uint16 totalApprovedMembers;
        mapping(address => bool) votes;
    }
    Consortium private consortium;

    // AIRLINE
    enum AirlineStatus {REGISTERED, APPROVED, SEED_FUNDED, SUSPENDED}

    struct Airline {
        AirlineStatus status;
        uint256 balance;
        uint256 updatedTimestamp;
        string title;
        mapping(address => bool) votes;
    }
    mapping(address => Airline) private airlines;

    // INSURANCE
    enum InsuranceStatus {PENDING, NOT_REDEEMABLE, REDEEMABLE, REDEEMED}

    struct Insurance {
        InsuranceStatus status;
        bytes32 id;
        address passenger;
        uint256 fee;
    }
    mapping(bytes32 => Insurance) private insuranceMetadata;
    mapping(address => bytes32[]) private passengerInsurances;
    mapping(bytes32 => bytes32[]) private flightInsurances;

    // INSUREES
    mapping(address => uint256) private insureeBalance;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event AirlineRegistered(address airline, string title);
    event AirlineApproved(address airline, string title);
    event AirlineFunded(address airline, string title, uint256 fee);

    event InsuranceRegistered(bytes32 insurance, address insuree, uint256 fee);
    event InsuranceRedeemable(bytes32 insurance, address insuree, uint256 fee);
    event InsuranceRedeemed(bytes32 insurance, address insuree, uint256 fee);

    event ConsortiumFunded(address airline, uint256 fee);
    event ConsortiumCredited(bytes32 flight, uint256 fee);

    /********************************************************************************************/
    /*                                        MODIFIERS                                         */
    /********************************************************************************************/

    // STOP-LOSS
    modifier stopLoss() {
        require(
            address(this).balance >= consortium.balance,
            "Unexpected contract balance"
        );
        _;
    }

    modifier onlyGuaranteedCapital() {
        require(
            consortium.balance > consortium.insuranceAmount,
            "Unexpected consortium balance"
        );
        _;
    }

    // STATUS
    modifier onlyOperational() {
        require(isOperational(), "Contract is currently not operational");
        _;
    }

    modifier onlyInsuranceRedeemable(bytes32 insuranceKey) {
        require(
            insuranceMetadata[insuranceKey].status ==
                InsuranceStatus.REDEEMABLE,
            "Insurance is not redeemable"
        );
        _;
    }

    // ROLES
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not Admin");
        _;
    }

    modifier onlyConsortiumAirline() {
        require(
            hasRole(AIRLINE_ROLE, msg.sender),
            "Caller is not a consortium airline"
        );
        _;
    }

    modifier onlyInsuree(bytes32 insuranceKey) {
        require(
            msg.sender == insuranceMetadata[insuranceKey].passenger,
            "Caller is not the insurance owner"
        );
        _;
    }

    // FEES
    modifier onlyConsortiumFee() {
        require(
            msg.value == AIRLINE_CONSORTIUM_FEE,
            "Unexpected consortium fee"
        );
        _;
    }

    modifier onlyInsuranceFee() {
        require(msg.value <= INSURANCE_MAX_FEE, "Unexpected insurance fee");
        _;
    }

    /**
     * @dev Constructor
     */
    constructor() public {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // register first airline as consortium founder
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     */
    function isOperational() public view returns (bool) {
        return consortium.isOperational;
    }

    /**
     * @dev Vote to pause contract operations
     */
    function suspendService() external onlyConsortiumAirline {
        _setOperationalConsensus(msg.sender, false);
    }

    /**
     * @dev Vote to resume contract operations
     */
    function resumeService() external onlyConsortiumAirline {
        _setOperationalConsensus(msg.sender, true);
    }

    function _setOperationalConsensus(address voter, bool vote) private {
        require(consortium.votes[voter] != vote);

        if (vote == true) {
            consortium.totalON.add(1);
            consortium.totalOFF.sus(1);
        }
        if (vote == false) {
            consortium.totalON.sus(1);
            consortium.totalOFF.add(1);
        }

        if (consortium.totalON >= consortium.totalApprovedMembers.div(2)) {
            consortium.isOperational = true;
        }

        if (consortium.totalOFF >= consortium.totalApprovedMembers.div(2)) {
            consortium.isOperational = false;
        }

        consortium.votes[voter] = vote;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Lets Admin (FlightSuretyApp contract) add an airline to the registration queue
     */
    function registerAirline(address _airline, string memory _title)
        external
        onlyAdmin
        onlyOperational
    {
        require(_airline != address(0));

        airlines[_airline] = Airline({
            status: AirlineStatus.REGISTERED,
            votes: [],
            balance: 0,
            updatedTimestamp: block.timestamp,
            title: _title
        });

        _updateAirlineStatus(_airline);
        _setOperationalConsensus(_airline, true);

        emit AirlineRegistered(_airline, _title);
    }

    /**
     * @dev Lets a consortium Airline register one possitive vote for a candidate Airline.
     */
    function approveAirline(address _airline)
        external
        onlyConsortiumAirline
        onlyOperational
    {
        require(msg.sender != _airline);
        require(!airlines[_airline].votes[msg.sender]);
        require(airlines[_airline].status == AirlineStatus.REGISTERED);

        airlines[_airline].votes[msg.sender] = true;
        _updateAirlineStatus(_airline);
    }

    function _updateAirlineStatus(address _airline) private {
        if (_hasReachedConsortiumConsensus(_airline)) {
            airlines[_airline].status = AirlineStatus.APPROVED;
            airlines[_airline].updatedTimestamp = block.timestamp;

            _setupRole(AIRLINE_ROLE, _airline);
            consortium.totalApprovedMembers.add(1);

            emit AirlineApproved(_airline, airlines[_airline].title);
        }
    }

    function _hasReachedConsortiumConsensus(address _airline)
        private
        view
        returns (bool)
    {
        return
            (consortium.totalApprovedMembers <= 4) ||
            (airlines[_airline].votes.length >=
                consortium.totalApprovedMembers.div(2));
    }

    function payConsortiumFee()
        external
        payable
        onlyConsortiumAirline
        onlyConsortiumFee
        onlyOperational
    {
        airline[msg.sender].balance.add(msg.value);
        consortium.balance.add(msg.value);
        airline[msg.sender].status = AirlineStatus.SEED_FUNDED;

        emit AirlineFunded(msg.sender, airlines[msg.sender].title, msg.value);
    }

    function fundGuaranteedCapital()
        external
        payable
        onlyConsortiumAirline
        onlyOperational
    {
        airline[msg.sender].balance.add(msg.value);
        consortium.balance.add(msg.value);

        emit ConsortiumFunded(msg.sender, msg.value);
    }

    /**
     * @dev Buy insurance for a flight
     */
    function buyInsurance(bytes32 _flight)
        external
        payable
        onlyInsuranceFee
        onlyGuaranteedCapital
        onlyOperational
    {
        require(
            !_hasInsurance(msg.sender, _flight),
            "Caller has already an insurance for this flight"
        );

        bytes32 insuranceKey = keccak256(abi.encodePacked(_flight, msg.sender));

        insuranceMetadata[insuranceKey] = Insurance({
            id: insuranceKey,
            passenger: msg.sender,
            fee: msg.value,
            status: InsuranceStatus.PENDING
        });

        flightInsurances[flightKey].push(insuranceKey);
        passengerInsurances[msg.sender].push(insuranceKey);
        consortium.insuranceAmount.add(INSURANCE_PREMIUM.mul(msg.value));

        _setupRole(INSUREE_ROLE, msg.sender);
        emit InsuranceRegistered(insuranceKey, msg.sender, msg.value);
    }

    function _hasInsurance(address passenger, bytes32 _flight)
        private
        returns (bool)
    {
        bytes32 insuranceKey = keccak256(abi.encodePacked(_flight, msg.sender));

        for (uint256 i = 0; i < passengerInsurances[msg.sender].length; i++) {
            if (passengerInsurances[msg.sender][i] == insuranceKey) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Lets Admin credit consortium airlines.
     */
    function creditConsortium(_flight) external onlyAdmin onlyOperational {
        bytes32[] insurances = flightInsurances[_flight];

        for (uint256 i = 0; i < insurances.length; i++) {
            bytes32 key = insurances[i];
            uint256 value = insuranceMetadata[key].fee;

            if (InsuranceStatus.PENDING) {
                insuranceMetadata[key].status = InsuranceStatus.NOT_REDEEMABLE;
                consortium.balance.add(value);
                consortium.insuranceAmount.sus(value);
                emit ConsortiumCredited(_flight, value);
            }
        }
    }

    /**
     * @dev Lets Admin credit insurees.
     */
    function creditInsurees(_flight) external onlyAdmin onlyOperational {
        bytes32[] insurances = flightInsurances[_flight];

        for (uint256 i = 0; i < insurances.length; i++) {
            bytes32 key = insurances[i];
            bytes32 passenger = insuranceMetadata[key].passenger;
            uint256 value = INSURANCE_PREMIUM.mul(insuranceMetadata[key].fee);

            if (InsuranceStatus.PENDING) {
                insuranceMetadata[key].status = InsuranceStatus.REDEEMABLE;

                consortium.balance.sus(value);
                consortium.insuranceAmount.sus(value);
                insureeBalance[passenger].add(value);

                emit InsuranceRedeemable(key, passenger, value);
            }
        }
    }

    /**
     *  @dev Lets the Insurance owner check whether the insurance is redeemable and
     *       if so, transfer the funds to an intermediate Escrow contract from where
     *       the insuree can withdraw the funds.
     */
    function redeemInsurance(bytes32 insuranceKey)
        external
        onlyInsuree(insuranceKey)
        onlyInsuranceRedeemable(insuranceKey)
        onlyOperational
        stopLoss
    {
        uint256 premium = INSURANCE_PREMIUM.mul(
            insuranceMetadata[insuranceKey].fee
        );

        require(insureeBalance[msg.sender] >= premium);

        insuranceMetadata[insuranceKey].status == InsuranceStatus.REDEEMED;
        insureeBalance[msg.sender] = insureeBalance[msg.sender].sub(premium);

        _asyncTransfer(msg.sender, INSURANCE_PREMIUM);
        emit InsuranceRedeemed(insuranceKey, msg.sender);
    }

    function getFlightKey(
        address _airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_airline, flight, timestamp));
    }

    /**
     * @dev Fallback function, it does not allow funding.
     *
     */
    fallback() external {
        require(msg.data.length == 0);
    }
}
