var Test = require("../config/testConfig2.js");
var BigNumber = require("bignumber.js");

//const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", async (accounts) => {
  var config;
  var firstAffiliate;

  before("setup contract", async () => {
    config = await Test.Config(accounts);
    admin = accounts[0];
    firstAffiliate = accounts[1];
    /*
    await config.consortiumAlliance.authorizeCaller(
      config.flightInsuranceHandler.address
    );*/
  });

  console.log("ganache-cli accounts:");
  console.log("Contract Owner: accounts[0] ", accounts[0]);
  console.log("First Affiliate: accounts[1] ", accounts[1]);
  console.log("Second Affiliate: accounts[2] ", accounts[2]);
  console.log("Third Affiliate: accounts[3] ", accounts[3]);
  console.log("Fourth Affiliate: accounts[4] ", accounts[4]);
  console.log("Fifth Affiliate: accounts[5] ", accounts[5]);

  describe("First Affiliate Workflow", function () {
    it(`lets be operational after deployment`, async function () {
      assert.isTrue(await config.consortiumAlliance.isOperational());
    });

    it(`lets register a first affiliate`, async function () {
      // when
      let tx = await config.consortiumAlliance.createAffiliate(
        firstAffiliate,
        "First Affiliate"
      );

      // then
      truffleAssert.eventEmitted(tx, "LogAffiliateRegistered", (ev) => {
        return ev;
      });
      assert.isTrue(await config.consortiumAlliance.isOperational());
    });

    it(`lets pay membership and approve a first affiliate to join consortium`, async function () {
      // given
      let fee = web3.utils.toWei("10", "ether");

      // when
      let tx = await config.consortiumAlliance.depositMebership({
        from: firstAffiliate,
        value: fee,
      });

      // then
      truffleAssert.eventEmitted(tx, "LogAffiliateFunded", (ev) => {
        return ev;
      });
    });

    it(`lets consortium suspendService()`, async function () {
      // when
      await config.consortiumAlliance.suspendService({
        from: firstAffiliate,
      });

      // then
      assert.isFalse(await config.consortiumAlliance.isOperational());
    });

    it(`lets consortium startService()`, async function () {
      // when
      await config.consortiumAlliance.resumeService({
        from: firstAffiliate,
      });

      // then
      assert.isTrue(await config.consortiumAlliance.isOperational());
    });

    it(`lets consortium member further fund the guarantee insurance deposit`, async function () {
      // given
      let credit = web3.utils.toWei("5", "ether");

      // when
      let tx = await config.consortiumAlliance.fundConsortium({
        from: firstAffiliate,
        value: credit,
      });

      // then
      truffleAssert.eventEmitted(tx, "LogConsortiumCredited", (ev) => {
        return ev;
      });
    });
  });

  describe("Insurance Workflow", function () {
    it(`lets Admin register insurance deposit`, async function () {
      // given
      const consortiumBalanceBefore = await config.consortiumAlliance.getConsortiumBalance.call();
      const consortiumEscrowBefore = await config.consortiumAlliance.getConsortiumEscrow.call();

      const deposit = web3.utils.toWei("1", "ether");

      // when
      let deposit_tx = await config.consortiumAlliance.depositInsurance({
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
      const contractBalance = await web3.eth.getBalance(config.address);
      const consortiumBalanceAfter = await config.consortiumAlliance.getConsortiumBalance.call();
      const consortiumEscrowAfter = await config.consortiumAlliance.getConsortiumEscrow.call();

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

    it(`lets Admin deposit and credit insurance to consortium`, async function () {
      // given
      const deposit = web3.utils.toWei("1", "ether");

      // when
      let key = await config.consortiumAlliance.depositInsurance.call({
        from: admin,
        value: deposit,
      });

      const consortiumBalanceBefore = await config.consortiumAlliance.getConsortiumBalance.call();

      let deposit_tx = await config.consortiumAlliance.depositInsurance({
        from: admin,
        value: deposit,
      });

      const consortiumEscrowBefore = await config.consortiumAlliance.getConsortiumEscrow.call();

      let credit_tx = await config.consortiumAlliance.creditInsurance(
        web3.utils.hexToBytes(key),
        {
          from: admin,
        }
      );

      const consortiumEscrowAfter = await config.consortiumAlliance.getConsortiumEscrow.call();
      const consortiumBalanceAfter = await config.consortiumAlliance.getConsortiumBalance.call();

      // then
      // events
      truffleAssert.eventEmitted(credit_tx, "LogConsortiumCredited", (ev) => {
        return ev;
      });

      truffleAssert.eventEmitted(credit_tx, "LogEscrowDebited", (ev) => {
        return ev;
      });

      // then
      // balances
      const contractBalance = await web3.eth.getBalance(config.address);

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

    it(`lets Admin deposit and withdraw insurance premium for further distribution to insuree`, async function () {
      // given
      const deposit = web3.utils.toWei("1", "ether");
      const premium_factor = 50;

      // when
      let key = await config.consortiumAlliance.depositInsurance.call({
        from: admin,
        value: deposit,
      });

      const consortiumBalanceBefore = await config.consortiumAlliance.getConsortiumBalance.call();

      let deposit_tx = await config.consortiumAlliance.depositInsurance({
        from: admin,
        value: deposit,
      });

      const consortiumEscrowBefore = await config.consortiumAlliance.getConsortiumEscrow.call();

      let debit_tx = await config.consortiumAlliance.withdrawInsurance(
        web3.utils.hexToBytes(key),
        {
          from: admin,
        }
      );

      const consortiumEscrowAfter = await config.consortiumAlliance.getConsortiumEscrow.call();
      const consortiumBalanceAfter = await config.consortiumAlliance.getConsortiumBalance.call();

      // then
      // events
      truffleAssert.eventEmitted(debit_tx, "LogConsortiumDebited", (ev) => {
        return ev;
      });

      truffleAssert.eventEmitted(debit_tx, "LogEscrowDebited", (ev) => {
        return ev;
      });

      // then
      // balances
      const contractBalance = await web3.eth.getBalance(config.address);

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

  describe("Roles & Permissions", function () {
    /*
    it(
      `lets block suspendService() call for non-consortium accounts`,
      async function () {
        let accessDenied = false;
        try {
          await config.consortiumAlliance.suspendService({
            from: config.nonConsortiumAddresses[1],
          });
        } catch (e) {
          accessDenied = true;
        }
        assert.equal(
          accessDenied,
          true,
          "Access not restricted to non-consortium Account"
        );
      }
    );

    it(
      `lets block startService() call for non-consortium accounts`,
      async function () {
        let accessDenied = false;
        try {
          await config.consortiumAlliance.startService({
            from: config.nonConsortiumAddresses[1],
          });
        } catch (e) {
          accessDenied = true;
        }
        assert.equal(
          accessDenied,
          true,
          "Access not restricted to non-consortium Account"
        );
      }
    );*/
    /*
    it(`lets block suspendService() call for *non* funded consortium accounts`, async function () {
      let accessDenied = false;
      try {
        await config.consortiumAlliance.suspendService({
          from: accounts[1],
        });
      } catch (e) {
        accessDenied = true;
      }
      assert.equal(
        accessDenied,
        true,
        "Access not restricted for *non* funded consortium account"
      );
    });

    it(`lets block resumeService() call for *non* funded consortium accounts`, async function () {
      let accessDenied = false;
      try {
        await config.consortiumAlliance.resumeService({
          from: accounts[1],
        });
      } catch (e) {
        accessDenied = true;
      }
      assert.equal(
        accessDenied,
        true,
        "Access not restricted for *non* funded consortium account"
      );
    });*/
    /*
    it(`let block access to onlyOperational functions - when operating status is false`, async function () {
      await config.consortiumAlliance.setOperatingStatus(false);

      let reverted = false;
      try {
        await config.consortiumAlliance.setTestingMode(true);
      } catch (e) {
        reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for onlyOperational");

      await config.flightSuretyData.setOperatingStatus(true);
    });*/
  });

  /*
  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let newAirline = accounts[2];

    // ACT
    try {
      await config.consortiumAlliance.registerAirline(newAirline, {
        from: config.firstAirline,
      });
    } catch (e) {}
    let result = await config.consortiumAlliance.isAirline.call(newAirline);

    // ASSERT
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
  });*/
});
