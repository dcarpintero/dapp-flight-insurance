const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", async (accounts) => {
  const OnlyValidKey = "Invalid insurance key";
  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");

  before("setup contract", async () => {
    admin = accounts[0];
    firstAffiliate = accounts[1];

    instance = await ConsortiumAlliance.deployed();

    await instance.createAffiliate(firstAffiliate, "First firstAffiliate");

    await instance.depositMebership({
      from: firstAffiliate,
      value: MEMBERSHIP_FEE,
    });
  });

  describe("Shall not allow reentrancy", function () {
    it(`lets Credit Insurance ONLY_ONCE`, async () => {
      const deposit = INSURANCE_FEE;

      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance({
        from: admin,
        value: deposit,
      });
      let key = deposit_tx.logs[1].args["key"]; // workaround to get the return value of depositInsuranceTX

      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      // ACCEPT FIRST CREDIT ATTEMPT
      let credit_tx = await instance.creditInsurance(
        web3.utils.hexToBytes(key),
        {
          from: admin,
          nonce: await web3.eth.getTransactionCount(admin),
        }
      );

      // REJECT SECOND CREDIT ATTEMPT
      await truffleAssert.reverts(
        instance.creditInsurance(web3.utils.hexToBytes(key), {
          from: admin,
          nonce: await web3.eth.getTransactionCount(admin),
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

    it(`lets Withdraw Insurance ONLY_ONCE`, async () => {
      const deposit = INSURANCE_FEE;
      const premium_factor = 50;

      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance({
        from: admin,
        value: deposit,
        nonce: await web3.eth.getTransactionCount(admin),
      });
      let key = deposit_tx.logs[1].args["key"]; // workaround to get the return value of depositInsuranceTX

      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      // ACCEPT FIRST WITHDRAW ATTEMPT
      let debit_tx = await instance.withdrawInsurance(
        web3.utils.hexToBytes(key),
        {
          from: admin,
          nonce: await web3.eth.getTransactionCount(admin),
        }
      );

      // REJECT SECOND WITHDRAW ATTEMPT
      await truffleAssert.reverts(
        instance.withdrawInsurance(web3.utils.hexToBytes(key), {
          from: admin,
          nonce: await web3.eth.getTransactionCount(admin),
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
