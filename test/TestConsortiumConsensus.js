const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", function (accounts) {
  const OnlyAdmin = "Caller is not Admin";
  const OnlyApprovedAffiliate = "Caller is not in approved status";
  const OnlyConsortiumAffiliate = "Caller is not a consortium Affiliate";
  const OnlyOperational = "Contract is currently not operational";

  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");
  const FUNDING_VALUE = web3.utils.toWei("15", "ether");
  const INSURANCE_KEY = web3.utils.fromAscii("key");

  before("setup contract", async () => {
    admin = accounts[0];

    firstAffiliate = accounts[1];
    secondAffiliate = accounts[2];
    thirdAffiliate = accounts[3];
    fourthAffiliate = accounts[4];
    newAffiliate = accounts[5];

    instance = await ConsortiumAlliance.deployed();
  });

  describe("Multiparty Operational Consensus", function () {
    it(`lets be operational after affiliate registration`, async function () {
      assert.isTrue(await instance.isOperational());

      await instance.createAffiliate(firstAffiliate, "firstAffiliate");
      await instance.depositMebership({
        from: firstAffiliate,
        value: MEMBERSHIP_FEE,
      });
      assert.isTrue(await instance.isOperational());

      await instance.createAffiliate(secondAffiliate, "secondAffiliate");
      await instance.depositMebership({
        from: secondAffiliate,
        value: MEMBERSHIP_FEE,
      });
      assert.isTrue(await instance.isOperational());

      await instance.createAffiliate(thirdAffiliate, "thirdAffiliate");
      await instance.depositMebership({
        from: thirdAffiliate,
        value: MEMBERSHIP_FEE,
      });
      assert.isTrue(await instance.isOperational());

      await instance.createAffiliate(fourthAffiliate, "fourthAffiliate");
      await instance.depositMebership({
        from: fourthAffiliate,
        value: MEMBERSHIP_FEE,
      });
      assert.isTrue(await instance.isOperational());

      await instance.createAffiliate(newAffiliate, "newAffiliate");
      assert.isTrue(await instance.isOperational());
    });

    it(`lets suspend service on multi-party consensus (3/4)`, async function () {
      assert.isTrue(await instance.isOperational());

      await instance.suspendService({ from: firstAffiliate });
      assert.isTrue(await instance.isOperational());

      await instance.suspendService({ from: secondAffiliate });
      assert.isTrue(await instance.isOperational());

      await instance.suspendService({ from: thirdAffiliate });
      assert.isFalse(await instance.isOperational());

      // 1st: OFF; 2nd: OFF; 3rd: OFF; 4th: ON
    });

    it(`lets resume service on multi-party consensus (2/4)`, async function () {
      assert.isFalse(await instance.isOperational());

      await instance.resumeService({ from: firstAffiliate });
      assert.isTrue(await instance.isOperational());

      // 1st: ON; 2nd: OFF; 3rd: OFF; 4th: ON
    });

    it(`lets approve affiliate on multi-party consensus (2/4)`, async function () {
      await truffleAssert.reverts(
        instance.depositMebership({
          from: newAffiliate,
          value: MEMBERSHIP_FEE,
          nonce: await web3.eth.getTransactionCount(newAffiliate),
        }),
        OnlyApprovedAffiliate
      );

      // 25%
      let first_tx = await instance.approveAffiliate(newAffiliate, {
        from: firstAffiliate,
      });
      await truffleAssert.eventNotEmitted(first_tx, "LogAffiliateApproved");

      // 50%
      let second_tx = await instance.approveAffiliate(newAffiliate, {
        from: secondAffiliate,
      });
      await truffleAssert.eventEmitted(second_tx, "LogAffiliateApproved");
    });
  });
});
