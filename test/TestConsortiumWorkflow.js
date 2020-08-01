const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", async (accounts) => {
  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");
  const FUNDING_VALUE = web3.utils.toWei("5", "ether");

  before("setup contract", async () => {
    admin = accounts[0];
    delegate = accounts[1];

    firstAffiliate = accounts[2];
    secondAffiliate = accounts[3];
    insuree = accounts[4];
    nonAffiliate = accounts[9];

    instance = await ConsortiumAlliance.deployed();

    await instance.addDelegateRole(delegate, {
      from: admin,
    });
  });

  describe("Affiliate Workflow", function () {
    it(`lets be operational after deployment`, async () => {
      assert.isTrue(await instance.isOperational());
    });

    it(`lets register a first affiliate`, async () => {
      // when
      let tx = await instance.createAffiliate(
        firstAffiliate,
        "First firstAffiliate"
      );

      // then
      truffleAssert.eventEmitted(tx, "LogAffiliateRegistered", (ev) => {
        return ev;
      });
      assert.isTrue(await instance.isOperational());
    });

    it(`lets pay membership and approve a first affiliate to join consortium`, async () => {
      // given
      const contractBalanceBefore = await web3.eth.getBalance(instance.address);
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();
      let fee = MEMBERSHIP_FEE;

      // when
      let tx = await instance.depositMebership({
        from: firstAffiliate,
        value: fee,
      });

      const contractBalanceAfter = await web3.eth.getBalance(instance.address);
      const consortiumBalanceAfter = await instance.getConsortiumBalance.call();

      // then
      truffleAssert.eventEmitted(tx, "LogAffiliateFunded", (ev) => {
        return ev;
      });

      assert.equal(
        Number(contractBalanceAfter),
        Number(contractBalanceBefore) + Number(fee)
      );

      assert.equal(
        Number(consortiumBalanceAfter),
        Number(consortiumBalanceBefore) + Number(fee)
      );
    });

    it(`lets suspendService()`, async () => {
      // when
      await instance.suspendService({
        from: firstAffiliate,
      });

      // then
      assert.isFalse(await instance.isOperational());
    });

    it(`lets startService()`, async () => {
      // when
      await instance.resumeService({
        from: firstAffiliate,
      });

      // then
      assert.isTrue(await instance.isOperational());
    });

    it(`lets consortium member fund the guarantee insurance deposit`, async () => {
      // given
      const contractBalanceBefore = await web3.eth.getBalance(instance.address);
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();
      let credit = FUNDING_VALUE;

      // when
      let tx = await instance.fundConsortium({
        from: firstAffiliate,
        value: credit,
      });

      const contractBalanceAfter = await web3.eth.getBalance(instance.address);
      const consortiumBalanceAfter = await instance.getConsortiumBalance.call();

      // then
      truffleAssert.eventEmitted(tx, "LogConsortiumCredited", (ev) => {
        return ev;
      });

      assert.equal(
        Number(contractBalanceAfter),
        Number(contractBalanceBefore) + Number(credit)
      );

      assert.equal(
        Number(consortiumBalanceAfter),
        Number(consortiumBalanceBefore) + Number(credit)
      );
    });
  });

  describe("Insurance Workflow", function () {
    it(`lets Delegate register insurance deposit`, async () => {
      // given
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();
      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      const deposit = INSURANCE_FEE;

      // when
      let deposit_tx = await instance.depositInsurance(insuree, {
        from: delegate,
        value: deposit,
        nonce: await web3.eth.getTransactionCount(delegate),
      });

      // then
      // events
      truffleAssert.eventEmitted(deposit_tx, "LogInsuranceRegistered");
      truffleAssert.eventEmitted(deposit_tx, "LogEscrowCredited");

      // then
      // balances
      const contractBalance = await web3.eth.getBalance(instance.address);
      const consortiumBalanceAfter = await instance.getConsortiumBalance.call();
      const consortiumEscrowAfter = await instance.getConsortiumEscrow.call();

      // insurance deposit shall be kept only under custody in a escrow account
      assert.equal(
        Number(consortiumBalanceBefore),
        Number(consortiumBalanceAfter)
      );

      assert.equal(
        Number(consortiumEscrowAfter) - Number(consortiumEscrowBefore),
        deposit
      );

      assert.equal(
        Number(contractBalance),
        Number(consortiumBalanceAfter) + Number(consortiumEscrowAfter)
      );
    });

    it(`lets Delegate deposit insurance and credit it to consortium`, async () => {
      const deposit = INSURANCE_FEE;

      // --------------------- DEPOSIT INSURANCE ---------------------
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance(insuree, {
        from: delegate,
        value: deposit,
        nonce: await web3.eth.getTransactionCount(delegate),
      });

      truffleAssert.eventEmitted(deposit_tx, "LogInsuranceRegistered");
      let key = deposit_tx.logs[1].args["key"]; // workaround to get the return value of depositInsuranceTX

      // ------------ CREDIT INSURANCE TO CONSORTIUM ------------
      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      let credit_tx = await instance.creditConsortium(
        web3.utils.hexToBytes(key),
        {
          from: delegate,
          nonce: await web3.eth.getTransactionCount(delegate),
        }
      );

      const consortiumEscrowAfter = await instance.getConsortiumEscrow.call();
      const consortiumBalanceAfter = await instance.getConsortiumBalance.call();
      const contractBalance = await web3.eth.getBalance(instance.address);

      // ---------------------  ASSERT EVENTS ---------------------
      truffleAssert.eventEmitted(credit_tx, "LogConsortiumCredited");
      truffleAssert.eventEmitted(credit_tx, "LogEscrowDebited");

      // ---------------------  ASSERT BALANCES ---------------------
      assert.equal(
        Number(consortiumEscrowBefore) - Number(consortiumEscrowAfter),
        deposit
      );

      assert.equal(
        Number(consortiumBalanceAfter) - Number(consortiumBalanceBefore),
        deposit
      );

      assert.equal(
        Number(contractBalance),
        Number(consortiumBalanceAfter) + Number(consortiumEscrowAfter)
      );
    });

    it(`lets Delegate deposit insurance and credit premium to insuree`, async () => {
      const deposit = INSURANCE_FEE;
      const premium_factor = 50;
      const premium = web3.utils.toBN(deposit * (premium_factor / 100));

      // --------------------- DEPOSIT INSURANCE ---------------------
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance(insuree, {
        from: delegate,
        value: deposit,
        nonce: await web3.eth.getTransactionCount(delegate),
      });

      truffleAssert.eventEmitted(deposit_tx, "LogInsuranceRegistered");
      let key = deposit_tx.logs[1].args["key"]; // workaround to get the return value of depositInsuranceTX

      // ------------ CREDIT INSURANCE TO INSUREE ------------
      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      let debit_tx = await instance.creditInsuree(web3.utils.hexToBytes(key), {
        from: delegate,
        nonce: await web3.eth.getTransactionCount(delegate),
      });

      const consortiumEscrowAfter = await instance.getConsortiumEscrow.call();
      const consortiumBalanceAfter = await instance.getConsortiumBalance.call();
      const contractBalance = await web3.eth.getBalance(instance.address);

      // ---------------------  ASSERT EVENTS ---------------------
      truffleAssert.eventEmitted(debit_tx, "LogConsortiumDebited");
      truffleAssert.eventEmitted(debit_tx, "LogEscrowDebited");

      // ---------------------  ASSERT BALANCES ---------------------

      // debit deposit from escrow
      assert.equal(
        Number(consortiumEscrowBefore) - Number(consortiumEscrowAfter),
        deposit
      );

      // debit premium from consortium
      assert.equal(
        Number(consortiumBalanceBefore) - Number(consortiumBalanceAfter),
        premium
      );

      assert.equal(
        Number(contractBalance),
        Number(consortiumBalanceAfter) + Number(consortiumEscrowAfter)
      );
    });

    it(`lets Insuree withdraw insurance deposit and premium`, async () => {
      const deposit = INSURANCE_FEE;
      const premium_factor = 50;
      const premium = web3.utils.toBN(deposit * (premium_factor / 100));
      const withdraw_amount = web3.utils.toBN(deposit).add(premium);

      // ------  ASSERT PAYEE CAN WITHDRAW THE INSURANCE PREMIUM ------
      assert.equal(Number(await instance.payments(insuree)), withdraw_amount);

      const payeeBalanceBefore = await web3.eth.getBalance(insuree);
      let wdrw_tx = await instance.withdrawPayments(insuree, { from: insuree });
      const payeeBalanceAfter = await web3.eth.getBalance(insuree);

      assert.equal(Number(await instance.payments(insuree)), 0);

      const tx = await web3.eth.getTransaction(wdrw_tx.tx);

      let gasPrice = tx.gasPrice;
      let gasUsed = wdrw_tx.receipt.gasUsed;
      const gas = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(gasUsed));

      assert.equal(
        web3.utils
          .toBN(payeeBalanceAfter)
          .sub(web3.utils.toBN(payeeBalanceBefore)),
        Number(withdraw_amount) - Number(gas)
      );
    });
  });
});
