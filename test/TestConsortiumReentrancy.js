const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", async (accounts) => {
  const OnlyValidKey = "Invalid insurance key";
  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");

  before("setup contract", async () => {
    admin = accounts[0];
    delegate = accounts[1];
    firstAffiliate = accounts[2];
    insuree = accounts[3];

    instance = await ConsortiumAlliance.deployed();

    await instance.addDelegateRole(delegate, {
      from: admin,
    });

    await instance.createAffiliate(firstAffiliate, "First firstAffiliate");

    await instance.depositMebership({
      from: firstAffiliate,
      value: MEMBERSHIP_FEE,
    });
  });

  describe("Shall not allow reentrancy", function () {
    it(`lets Credit Consortium ONLY_ONCE`, async () => {
      const deposit = INSURANCE_FEE;

      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance(insuree, {
        from: delegate,
        value: deposit,
      });
      let key = deposit_tx.logs[1].args["key"]; // workaround to get the return value of depositInsuranceTX

      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      // ACCEPT FIRST CREDIT ATTEMPT
      let credit_tx = await instance.creditConsortium(
        web3.utils.hexToBytes(key),
        {
          from: delegate,
          nonce: await web3.eth.getTransactionCount(delegate),
        }
      );

      // REJECT SECOND CREDIT ATTEMPT
      await truffleAssert.reverts(
        instance.creditConsortium(web3.utils.hexToBytes(key), {
          from: delegate,
          nonce: await web3.eth.getTransactionCount(delegate),
        }),
        OnlyValidKey
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

    it(`lets Credit Insuree ONLY_ONCE`, async () => {
      const deposit = INSURANCE_FEE;
      const premium_factor = 50;

      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance(insuree, {
        from: delegate,
        value: deposit,
        nonce: await web3.eth.getTransactionCount(delegate),
      });
      let key = deposit_tx.logs[1].args["key"]; // workaround to get the return value of depositInsuranceTX

      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      // ACCEPT FIRST WITHDRAW ATTEMPT
      let debit_tx = await instance.creditInsuree(web3.utils.hexToBytes(key), {
        from: delegate,
        nonce: await web3.eth.getTransactionCount(delegate),
      });

      // REJECT SECOND WITHDRAW ATTEMPT
      await truffleAssert.reverts(
        instance.creditInsuree(web3.utils.hexToBytes(key), {
          from: delegate,
          nonce: await web3.eth.getTransactionCount(delegate),
        }),
        OnlyValidKey
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
