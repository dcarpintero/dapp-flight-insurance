// SPDX-License-Identifier: MIT

pragma solidity 0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/payment/PullPayment.sol";

/**
 * @title ConsortiumInsurance
 * @dev Provides a generic Consortium data model and fine CRUD operations for
 *      managing the registration and custody of insurance deposits.
 *
 *      - Approval of new consortium affiliates is automatic up to the fourth
 *        entity and requires consortium consensus for the next ones.
 *
 *      - Approved affiliates shall satisfy a consortium fee to become fully
 *        members of the consortium and adquire voting rights.
 *
 *      - Voting rights apply to membership requests and operational status.
 *
 *      - Operational status allows the contract to be stop and resumed.
 *
 *      - Consortium issues keys representing insurance capital
 *        for a deposit credited to a custody fund (escrow).
 *
 *      - insurance capital == insurance deposit * premium factor.
 *
 *      - The insurance capital shall never exceed the consortium funds.
 *
 *      - consortium funds == affiliates deposit + unredeemable insurances + escrow.
 *
 *      - Unredeemable insurance_capital results in the insurance_deposit
 *        being credited to the consortium.
 *
 *      - Reedemable insurance capital results in the insurance premium being
 *        transferred to an admin contract
 *        from the consortium balance and escrow balance.
 *
 * Intended usage:
 *      - Consortium affiliates fund insurance capital and agree on new members
 *        and operational status.
 *
 *      - Admin (contract owner) handles insurance capital and premiums
 *        for distribution to insurees according to the business rules.
 *
 */
contract ConsortiumAlliance is Ownable, AccessControl, PullPayment {
    using SafeMath for uint256;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CONSORTIUM_ROLE = keccak256("CONSORTIUM_ROLE");

    uint256 public constant CONSORTIUM_MEMBERSHIP_FEE = 10 ether;
    uint256 public constant CONSORTIUM_CONSENSUS = 50;

    uint256 public constant INSURANCE_MAX_FEE = 1 ether;
    uint256 public constant INSURANCE_PREMIUM_FACTOR = 150;

    // ----------------- CONSORTIUM -----------------
    struct OperationalConsensus {
        bool status;
        uint256 totalON;
        uint256 totalOFF;
        mapping(address => bool) votes;
    }

    struct Consortium {
        uint256 balance;
        uint256 escrow;
        uint256 members;
        OperationalConsensus operational;
    }
    Consortium private consortium;

    // ----------------- AFFILIATE -----------------
    enum MembershipStatus {REGISTERED, APPROVED, SEED_FUNDED, SUSPENDED}

    struct Affiliate {
        MembershipStatus status;
        uint256 seed;
        uint256 updatedTimestamp;
        string title;
        uint256 approvals;
        mapping(address => bool) votes;
    }
    mapping(address => Affiliate) private affiliates;

    // ----------------- INSURANCE CAPITAL -----------------
    mapping(bytes32 => uint256) private insuranceDeposit;

    // ----------------- EVENTS ----------------- //
    event LogAffiliateRegistered(address indexed affiliate, string title);
    event LogAffiliateApproved(address indexed affiliate, string title);
    event LogAffiliateFunded(
        address indexed affiliate,
        string title,
        uint256 deposit
    );

    event LogConsortiumFunded(address indexed affiliate, uint256 deposit);
    event LogConsortiumCredited(uint256 credit);
    event LogConsortiumDebited(uint256 debit);

    event LogEscrowCredited(uint256 credit);
    event LogEscrowDebited(uint256 debit);

    event LogInsuranceDepositRegistered(bytes32 key, uint256 deposit);
    event LogInsuranceDepositCredited(bytes32 key, uint256 credit);
    event LogInsuranceDepositWithdrawn(bytes32 key, uint256 debit);

    // ----------------- MODIFIERS -----------------

    /**
     * @dev StopLoss if the contract balance is unexpected.
     *
     * WARNING: not a strict equality of the balance because the contract can be
     * forcibly sent ether without going through the deposit() function!
     *
     * https://consensys.github.io/smart-contract-best-practices/recommendations
     */
    modifier stopLoss() {
        require(
            address(this).balance >= (consortium.balance + consortium.escrow),
            "Unexpected contract balance"
        );
        _;
    }

    modifier onlyOperational() {
        require(isOperational(), "Contract is currently not operational");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not Admin");
        _;
    }

    modifier onlyApprovedAffiliate() {
        require(
            affiliates[msg.sender].status == MembershipStatus.APPROVED,
            "Caller is not an approved affiliate"
        );
        _;
    }

    modifier onlyConsortiumAffiliate() {
        require(
            hasRole(CONSORTIUM_ROLE, msg.sender),
            "Caller is not a consortium Affiliate"
        );
        _;
    }

    modifier onlyConsortiumFee() {
        require(
            msg.value == CONSORTIUM_MEMBERSHIP_FEE,
            "Unexpected consortium fee"
        );
        _;
    }

    modifier onlyMaxInsurance() {
        require(
            (msg.value > 0) && (msg.value <= INSURANCE_MAX_FEE),
            "Unexpected insurance deposit"
        );
        _;
    }

    modifier onlyMaxGuarantee() {
        require(
            address(this).balance >=
                consortium.escrow.mul(INSURANCE_PREMIUM_FACTOR.div(100)),
            "Contract balance does not guarantee insurance premium"
        );
        _;
    }

    /**
     * @dev Constructor
     */
    constructor() public {
        _setupRole(ADMIN_ROLE, msg.sender);
        consortium.operational.status = true;
    }

    // ----------------- OPERATIONAL CONSENSUS -----------------

    function isOperational() public view returns (bool) {
        return consortium.operational.status;
    }

    /**
     * @dev Vote to pause contract operations
     */
    function suspendService() public onlyConsortiumAffiliate {
        _setOperationalConsensus(msg.sender, false);
    }

    /**
     * @dev Vote to resume contract operations
     */
    function resumeService() public onlyConsortiumAffiliate {
        _setOperationalConsensus(msg.sender, true);
    }

    function _setTotalON(uint256 _value) internal {
        consortium.operational.totalON = _value;
    }

    function _setTotalOFF(uint256 _value) internal {
        consortium.operational.totalOFF = _value;
    }

    function _setOperationalConsensus(address voter, bool vote) private {
        require(consortium.operational.votes[voter] != vote);

        if (vote == true) {
            _setTotalON(consortium.operational.totalON.add(1));
            if (consortium.operational.totalOFF > 0)
                _setTotalOFF(consortium.operational.totalOFF.sub(1));
        }
        if (vote == false) {
            _setTotalOFF(consortium.operational.totalOFF.add(1));
            if (consortium.operational.totalON > 0)
                _setTotalON(consortium.operational.totalON.sub(1));
        }

        if (
            consortium.operational.totalON.div(consortium.members).mul(100) >=
            CONSORTIUM_CONSENSUS
        ) {
            consortium.operational.status = true;
        }

        if (
            consortium.operational.totalOFF.div(consortium.members).mul(100) >
            CONSORTIUM_CONSENSUS
        ) {
            consortium.operational.status = false;
        }

        consortium.operational.votes[voter] = vote;
    }

    // ----------------- AFFILIATES -----------------

    /**
     * @dev Let Admin add an Affiliate to the registration queue
     */
    function createAffiliate(address _affiliate, string memory _title)
        public
        onlyAdmin
        onlyOperational
    {
        require(_affiliate != address(0));

        affiliates[_affiliate] = Affiliate({
            status: MembershipStatus.REGISTERED,
            seed: 0,
            approvals: 0,
            updatedTimestamp: block.timestamp,
            title: _title
        });

        _updateMembershipStatus(_affiliate);
        _setOperationalConsensus(_affiliate, true);

        emit LogAffiliateRegistered(_affiliate, _title);
    }

    /**
     * @dev Let a Consortium Affiliate vote for a registered candidate.
     */
    function approveAffiliate(address _affiliate)
        public
        onlyConsortiumAffiliate
        onlyOperational
    {
        require(msg.sender != _affiliate, "Caller cannot vote for itself.");
        require(
            !affiliates[_affiliate].votes[msg.sender],
            "Caller cannot vote twice."
        );
        require(
            affiliates[_affiliate].status == MembershipStatus.REGISTERED,
            "Caller can only vote for registered affiliates."
        );

        affiliates[_affiliate].votes[msg.sender] = true;
        affiliates[_affiliate].approvals = affiliates[_affiliate].approvals.add(
            1
        );
        _updateMembershipStatus(_affiliate);
    }

    function _updateMembershipStatus(address _affiliate) private {
        if (_hasReachedConsortiumConsensus(_affiliate)) {
            affiliates[_affiliate].status = MembershipStatus.APPROVED;
            affiliates[_affiliate].updatedTimestamp = block.timestamp;

            consortium.members = consortium.members.add(1);

            emit LogAffiliateApproved(_affiliate, affiliates[_affiliate].title);
        }
    }

    function _hasReachedConsortiumConsensus(address _affiliate)
        private
        view
        returns (bool)
    {
        uint256 approvalVotes = affiliates[_affiliate].approvals;

        return
            (consortium.members <= 4) ||
            (approvalVotes.div(consortium.members).mul(100) >=
                CONSORTIUM_CONSENSUS);
    }

    // ----------------- INSURANCE CAPITAL AND PREMIUMS -----------------
    function depositMebership()
        public
        payable
        onlyApprovedAffiliate
        onlyConsortiumFee
        onlyOperational
    {
        _creditAffiliate(msg.sender, msg.value);
        _creditConsortium(msg.value);
        affiliates[msg.sender].status = MembershipStatus.SEED_FUNDED;
        _setupRole(CONSORTIUM_ROLE, msg.sender);

        emit LogAffiliateFunded(
            msg.sender,
            affiliates[msg.sender].title,
            msg.value
        );
    }

    function fundConsortium()
        public
        payable
        onlyConsortiumAffiliate
        onlyOperational
    {
        _creditAffiliate(msg.sender, msg.value);
        _creditConsortium(msg.value);
    }

    function getConsortiumBalance() public view returns (uint256) {
        return consortium.balance;
    }

    function getConsortiumEscrow() public view returns (uint256) {
        return consortium.escrow;
    }

    /**
     * @dev Lets Admin register insurance deposit in a escrow fund, only if the
     *      consortium balance would be enough to pay the premium.
     */
    function depositInsurance2() public pure returns (bytes32) {
        return keccak256(abi.encodePacked("test"));
    }

    function depositInsurance()
        public
        payable
        onlyMaxInsurance
        onlyMaxGuarantee
        onlyAdmin
        onlyOperational
        returns (bytes32)
    {
        bytes32 key = keccak256(abi.encodePacked(msg.sender, block.timestamp));
        insuranceDeposit[key] = msg.value;

        _creditEscrow(msg.value);

        emit LogInsuranceDepositRegistered(key, insuranceDeposit[key]);
        return key;
    }

    /**
     * @dev Lets Admin credit consortium a non-reedemable insurance deposit.
     */
    function creditInsurance(bytes32 _key) public onlyAdmin onlyOperational {
        require(insuranceDeposit[_key] != 0, "Invalid insurance key");
        uint256 credit = insuranceDeposit[_key];

        _debitEscrow(credit);
        _creditConsortium(credit);
    }

    /**
     * @dev Credits Admin with the registered insurance premium, only if the
     *      contract balance equals the consortium and escrow balance (StopLoss).
     */
    function withdrawInsurance(bytes32 key)
        public
        stopLoss
        onlyAdmin
        onlyOperational
    {
        uint256 deposit = insuranceDeposit[key];
        uint256 premium = deposit.mul(INSURANCE_PREMIUM_FACTOR.div(100));
        // should always be true
        require(consortium.balance.add(consortium.escrow) >= premium);

        _debitEscrow(deposit);
        _debitConsortium(premium.sub(deposit));

        _asyncTransfer(msg.sender, premium);
    }

    function _creditAffiliate(address _key, uint256 credit) internal {
        affiliates[_key].seed = affiliates[_key].seed.add(credit);
    }

    function _creditConsortium(uint256 credit) internal {
        consortium.balance = consortium.balance.add(credit);
        emit LogConsortiumCredited(credit);
    }

    function _debitConsortium(uint256 debit) internal {
        consortium.balance = consortium.balance.sub(debit);
        emit LogConsortiumDebited(debit);
    }

    function _creditEscrow(uint256 credit) internal {
        consortium.escrow = consortium.escrow.add(credit);
        emit LogEscrowCredited(credit);
    }

    function _debitEscrow(uint256 debit) internal {
        consortium.escrow = consortium.escrow.sub(debit);
        emit LogEscrowDebited(debit);
    }

    /**
     * @dev Fallback function - does not accept unexpected funding.
     *
     */
    fallback() external {
        require(msg.data.length == 0);
    }
}
