// SPDX-License-Identifier: MIT

pragma solidity 0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/payment/PullPayment.sol";

import "./ConsortiumSettings.sol";

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
 *      - Voting rights apply to membership approvals and operational status.
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
 *      - DelegateCalls have been avoided by using ACL policies. The contract owner
 *        (Admin) defines a delegate or proxy (contract address) in charge of
 *        handling insurance capital and premiums.
 *
 * Security:
 *      - Stop Loss.
 *      - Reentrancy checks in credit and withdraw insurance functions.
 *      - PullPayment: the paying contract does not interact directly with the receiver
 *        account, which must withdraw its payments itself. Payees can query their due
 *        payments with payments, and retrieve them with withdrawPayments functions.
 *        https://docs.openzeppelin.com/contracts/3.x/api/payment#PullPayment
 *        https://consensys.github.io/smart-contract-best-practices/recommendations/#favor-pull-over-push-for-external-calls
 */
contract ConsortiumAlliance is Ownable, AccessControl, PullPayment {
    using SafeMath for uint256;

    ConsortiumSettings public settings;
    uint8 private nonce = 0;

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

    // ----------------- EVENTS -----------------
    event LogDelegateRegistered(address admin);

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

    event LogKeyBurnt(bytes32 key);

    // ----------------- MODIFIERS -----------------

    /**
     * @dev StopLoss if the contract balance is unexpected.
     *
     * WARNING: not a strict equality of the balance because the contract can be
     * forcibly sent ether without going through the deposit() function:
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
        require(
            hasRole(settings.ADMIN_ROLE(), msg.sender),
            "Caller is not Admin"
        );
        _;
    }

    modifier onlyDelegate() {
        require(
            hasRole(settings.DELEGATE_ROLE(), msg.sender),
            "Caller is not Delegate"
        );
        _;
    }

    modifier onlyApprovedAffiliate() {
        require(
            affiliates[msg.sender].status == MembershipStatus.APPROVED,
            "Caller is not in approved status"
        );
        _;
    }

    modifier onlyConsortiumAffiliate() {
        require(
            hasRole(settings.CONSORTIUM_ROLE(), msg.sender),
            "Caller is not a consortium Affiliate"
        );
        _;
    }

    modifier onlyConsortiumFee() {
        require(
            msg.value == settings.CONSORTIUM_MEMBERSHIP_FEE(),
            "Unexpected consortium fee"
        );
        _;
    }

    modifier onlyInsuranceFee() {
        require(
            (msg.value > 0) && (msg.value <= settings.INSURANCE_MAX_FEE()),
            "Unexpected insurance deposit"
        );
        _;
    }

    modifier onlyGuarantee() {
        require(
            address(this).balance >=
                consortium.escrow.mul(settings.INSURANCE_PREMIUM_FACTOR()).div(
                    100
                ),
            "Contract balance does not guarantee insurance premium"
        );
        _;
    }

    modifier onlyValidKey(bytes32 _key) {
        require(insuranceDeposit[_key] != 0, "Invalid insurance key");
        _;
    }

    /**
     * @dev Constructor
     */
    constructor(address _settings) public {
        settings = ConsortiumSettings(_settings);
        _setupRole(settings.ADMIN_ROLE(), msg.sender);
        consortium.operational.status = true;
    }

    function addDelegateRole(address _address)
        external
        onlyAdmin
        onlyOperational
    {
        require(_address != address(0), "Delegate cannot be the zero address");

        _setupRole(settings.DELEGATE_ROLE(), _address);
        emit LogDelegateRegistered(_address);
    }

    // ----------------- OPERATIONAL CONSENSUS -----------------

    /**
     * @dev Returns True if the contract functions are operational
     */
    function isOperational() public view returns (bool) {
        return consortium.operational.status;
    }

    /**
     * @dev Vote to pause contract operations
     */
    function suspendService() external onlyConsortiumAffiliate {
        _registerVoteOperational(msg.sender, false);
    }

    /**
     * @dev Vote to resume contract operations
     */
    function resumeService() external onlyConsortiumAffiliate {
        _registerVoteOperational(msg.sender, true);
    }

    function _registerVoteOperational(address voter, bool vote) private {
        require(
            consortium.operational.votes[voter] != vote,
            "This vote has already been registered."
        );

        consortium.operational.votes[voter] = vote;

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

        _updateOperationalStatus();
    }

    function _updateOperationalStatus() private {
        if (
            consortium.operational.totalON.mul(100).div(consortium.members) >=
            settings.CONSORTIUM_CONSENSUS()
        ) {
            consortium.operational.status = true;
        }

        if (
            consortium.operational.totalOFF.mul(100).div(consortium.members) >
            settings.CONSORTIUM_CONSENSUS()
        ) {
            consortium.operational.status = false;
        }
    }

    function _setTotalON(uint256 _value) internal {
        consortium.operational.totalON = _value;
    }

    function _setTotalOFF(uint256 _value) internal {
        consortium.operational.totalOFF = _value;
    }

    // ----------------- AFFILIATE WORKFLOW -----------------

    /**
     * @dev Let Admin add an Affiliate to the registration queue
     */
    function createAffiliate(address _affiliate, string calldata _title)
        external
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

        emit LogAffiliateRegistered(_affiliate, _title);
        _updateMembershipStatus(_affiliate);
    }

    /**
     * @dev Let a Consortium Affiliate vote for a registered candidate.
     */
    function approveAffiliate(address _affiliate)
        external
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

    function isConsortiumAffiliate(address _address)
        external
        view
        onlyOperational
        returns (bool)
    {
        return hasRole(settings.CONSORTIUM_ROLE(), _address);
    }

    function isDelegate(address _address)
        external
        view
        onlyOperational
        returns (bool)
    {
        return hasRole(settings.DELEGATE_ROLE(), _address);
    }

    function _updateMembershipStatus(address _affiliate) private {
        if (_hasReachedConsortiumConsensus(_affiliate)) {
            affiliates[_affiliate].status = MembershipStatus.APPROVED;
            affiliates[_affiliate].updatedTimestamp = block.timestamp;

            emit LogAffiliateApproved(_affiliate, affiliates[_affiliate].title);
        }
    }

    function _hasReachedConsortiumConsensus(address _affiliate)
        private
        view
        returns (bool)
    {
        uint256 approvalVotes = affiliates[_affiliate].approvals;
        if (consortium.members < 4) {
            return true;
        }

        return (approvalVotes.mul(100).div(consortium.members) >=
            settings.CONSORTIUM_CONSENSUS());
    }

    // ----------------- INSURANCE CAPITAL AND PREMIUMS -----------------
    function depositMebership()
        external
        payable
        onlyApprovedAffiliate
        onlyConsortiumFee
        onlyOperational
    {
        _creditAffiliate(msg.sender, msg.value);
        _creditConsortium(msg.value);
        affiliates[msg.sender].status = MembershipStatus.SEED_FUNDED;

        _setupRole(settings.CONSORTIUM_ROLE(), msg.sender);
        consortium.members = consortium.members.add(1);
        _registerVoteOperational(msg.sender, true);

        emit LogAffiliateFunded(
            msg.sender,
            affiliates[msg.sender].title,
            msg.value
        );
    }

    function fundConsortium()
        external
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

    function depositInsurance()
        external
        payable
        onlyInsuranceFee
        onlyGuarantee
        onlyDelegate
        onlyOperational
        returns (bytes32)
    {
        bytes32 key = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, _getPseudoRandom())
        );
        insuranceDeposit[key] = msg.value;

        _creditEscrow(msg.value);

        emit LogInsuranceDepositRegistered(key, insuranceDeposit[key]);
        return key;
    }

    /**
     * @dev Lets Delegate (contract) credit consortium
     *      a non-reedemable insurance deposit.
     */
    function creditConsortium(bytes32 _key)
        external
        onlyDelegate
        onlyOperational
        onlyValidKey(_key)
    {
        uint256 credit = insuranceDeposit[_key];

        _burnKey(_key);
        _debitEscrow(credit);
        _creditConsortium(credit);
    }

    /**
     * @dev Lets Delegate (contract) credit insuree escrow the insurance premium.
     *
     *      StopLoss: contract balance >= consortium + escrow balance
     */
    function creditInsuree(bytes32 _key, address _insuree)
        external
        stopLoss
        onlyDelegate
        onlyOperational
        onlyValidKey(_key)
    {
        uint256 deposit = insuranceDeposit[_key];
        uint256 premium = deposit.mul(settings.INSURANCE_PREMIUM_FACTOR()).div(
            100
        );

        require(consortium.balance.add(consortium.escrow) >= premium);

        _burnKey(_key);
        _debitEscrow(deposit);
        _debitConsortium(premium.sub(deposit));

        _asyncTransfer(_insuree, premium);
    }

    /**
     * @dev Credits Admin with the registered insurance premium,
     *      only if
     *      contract balance >= consortium + escrow balance (StopLoss).
     */
    /*
    function withdrawInsurance(bytes32 _key)
        external
        stopLoss
        onlyAdmin
        onlyValidKey(_key)
        onlyOperational
    {
        _pullPremiumToEscrow(_key, msg.sender);
    }*/

    /*
    function _pullPremiumToEscrow(bytes32 _key, address _insuree)
        internal
        stopLoss
        onlyValidKey(_key)
        onlyOperational
    {
        uint256 deposit = insuranceDeposit[_key];
        uint256 premium = deposit.mul(settings.INSURANCE_PREMIUM_FACTOR()).div(
            100
        );

        require(consortium.balance.add(consortium.escrow) >= premium);

        _burnKey(_key);
        _debitEscrow(deposit);
        _debitConsortium(premium.sub(deposit));

        _asyncTransfer(_insuree, premium);
    }*/

    /**
     * @dev Invalidates key to prevent reentrancy in credit and withdraw insurance
     */
    function _burnKey(bytes32 _key) internal {
        insuranceDeposit[_key] = 0;
        emit LogKeyBurnt(_key);
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

    function _getPseudoRandom() internal returns (uint8) {
        uint8 maxValue = 100;

        uint8 random = uint8(
            uint256(
                keccak256(abi.encodePacked(blockhash(block.number - nonce++)))
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks
        }

        return random;
    }

    /**
     * @dev Fallback function - does not accept unexpected funding.
     *
     */
    fallback() external {
        require(msg.data.length == 0);
    }
}
