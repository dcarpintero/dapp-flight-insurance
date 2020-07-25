const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", async (accounts) => {
  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");
  const FUNDING_VALUE = web3.utils.toWei("5", "ether");

  before("setup contract", async () => {
    admin = accounts[0];
    firstAffiliate = accounts[1];
    secondAffiliate = accounts[2];
    nonAffiliate = accounts[9];

    instance = await ConsortiumAlliance.deployed();
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

    it(`lets consortium suspendService()`, async () => {
      // when
      await instance.suspendService({
        from: firstAffiliate,
      });

      // then
      assert.isFalse(await instance.isOperational());
    });

    it(`lets consortium startService()`, async () => {
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
    it(`lets Admin register insurance deposit`, async () => {
      // given
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();
      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      const deposit = INSURANCE_FEE;

      // when
      let deposit_tx = await instance.depositInsurance({
        from: admin,
        value: deposit,
      });

      // then
      // events
      truffleAssert.eventEmitted(
        deposit_tx,
        "LogInsuranceDepositRegistered",
        (ev) => {
          return ev;
        }
      );

      truffleAssert.eventEmitted(deposit_tx, "LogEscrowCredited", (ev) => {
        return ev;
      });

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

    it(`lets Admin deposit and credit insurance to consortium`, async () => {
      // given
      const deposit = INSURANCE_FEE;

      // when
      let key = await instance.depositInsurance.call({
        from: admin,
        value: deposit,
      });

      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance({
        from: admin,
        value: deposit,
      });
      truffleAssert.eventEmitted(deposit_tx, "LogInsuranceDepositRegistered");

      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      let credit_tx = await instance.creditInsurance(
        web3.utils.hexToBytes(key),
        {
          from: admin,
        }
      );

      const consortiumEscrowAfter = await instance.getConsortiumEscrow.call();
      const consortiumBalanceAfter = await instance.getConsortiumBalance.call();

      // then
      // events
      truffleAssert.eventEmitted(credit_tx, "LogConsortiumCredited");
      truffleAssert.eventEmitted(credit_tx, "LogEscrowDebited");

      // then
      // balances
      const contractBalance = await web3.eth.getBalance(instance.address);

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

    it(`lets Admin deposit and withdraw insurance premium for further distribution to insuree`, async () => {
      // given
      const deposit = INSURANCE_FEE;
      const premium_factor = 50;

      // when
      let key = await instance.depositInsurance.call({
        from: admin,
        value: deposit,
      });

      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance({
        from: admin,
        value: deposit,
      });
      truffleAssert.eventEmitted(deposit_tx, "LogInsuranceDepositRegistered");

      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      let debit_tx = await instance.withdrawInsurance(
        web3.utils.hexToBytes(key),
        {
          from: admin,
        }
      );

      const consortiumEscrowAfter = await instance.getConsortiumEscrow.call();
      const consortiumBalanceAfter = await instance.getConsortiumBalance.call();

      // then
      // events
      truffleAssert.eventEmitted(debit_tx, "LogConsortiumDebited");
      truffleAssert.eventEmitted(debit_tx, "LogEscrowDebited");

      // then
      // balances
      const contractBalance = await web3.eth.getBalance(instance.address);

      // debit deposit from escrow
      assert.equal(
        Number(consortiumEscrowBefore) - Number(consortiumEscrowAfter),
        deposit
      );

      // debit premium from consortium
      assert.equal(
        Number(consortiumBalanceBefore) - Number(consortiumBalanceAfter),
        deposit * (premium_factor / 100)
      );

      assert.equal(
        Number(contractBalance),
        Number(consortiumBalanceAfter) + Number(consortiumEscrowAfter)
      );
    });
  });
});
