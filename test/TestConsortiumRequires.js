const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", async (accounts) => {
  const OnlyAdmin = 'Caller is not Admin';
  const OnlyApprovedAffiliate = 'Caller is not an approved affiliate';
  const OnlyConsortiumAffiliate = 'Caller is not a consortium Affiliate';
  const OnlyOperational = 'Contract is currently not operational';

  before("setup contract", async () => {
    admin = accounts[0];
    firstAffiliate = accounts[1];
    secondAffiliate = accounts[2];
    nonAffiliate = accounts [9];
    instance = await ConsortiumAlliance.deployed();
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
      assert.isTrue(await instance.isOperational());
    });

    it(`lets register a first affiliate`, async function () {
      // when
      let tx = await instance.createAffiliate(
        firstAffiliate,
        "First Affiliate"
      );

      // then
      truffleAssert.eventEmitted(tx, "LogAffiliateRegistered", (ev) => {
        return ev;
      });
      assert.isTrue(await instance.isOperational());
    });

    it(`lets pay membership and approve a first affiliate to join consortium`, async function () {
      // given
      const contractBalanceBefore = await web3.eth.getBalance(config.address);
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();
      let fee = web3.utils.toWei("10", "ether");

      // when
      let tx = await instance.depositMebership({
        from: firstAffiliate,
        value: fee,
      });

      const contractBalanceAfter = await web3.eth.getBalance(config.address);
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

    it(`lets consortium suspendService()`, async function () {
      // when
      await instance.suspendService({
        from: firstAffiliate,
      });

      // then
      assert.isFalse(await instance.isOperational());
    });

    it(`lets consortium startService()`, async function () {
      // when
      await instance.resumeService({
        from: firstAffiliate,
      });

      // then
      assert.isTrue(await instance.isOperational());
    });

    it(`lets consortium member further fund the guarantee insurance deposit`, async function () {
      // given
      const contractBalanceBefore = await web3.eth.getBalance(config.address);
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();
      let credit = web3.utils.toWei("5", "ether");

      // when
      let tx = await instance.fundConsortium({
        from: firstAffiliate,
        value: credit,
      });

      const contractBalanceAfter = await web3.eth.getBalance(config.address);
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
    it(`lets Admin register insurance deposit`, async function () {
      // given
      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();
      const consortiumEscrowBefore = await instance.getConsortiumEscrow.call();

      const deposit = web3.utils.toWei("1", "ether");

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
      const contractBalance = await web3.eth.getBalance(config.address);
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

    it(`lets Admin deposit and credit insurance to consortium`, async function () {
      // given
      const deposit = web3.utils.toWei("1", "ether");

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
      let key = await instance.depositInsurance.call({
        from: admin,
        value: deposit,
      });

      const consortiumBalanceBefore = await instance.getConsortiumBalance.call();

      let deposit_tx = await instance.depositInsurance({
        from: admin,
        value: deposit,
      });

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
    // Admin Rights (Insurance Workflow)
    it(`lets block create affiliate to non-admin`, async function () {

      await truffleAssert.reverts(
        instance.createAffiliate({
          from: nonAdmin,
        }, newAffiliate, "affiliate"),
        OnlyAdmin
        );
    });

    it(`lets block deposit insurance to non-admin`, async function () {

      await truffleAssert.reverts(
        instance.depositInsurance({
          from: nonAdmin, value: 1
        }),
        OnlyAdmin
        );
    });

    it(`lets block credit insurance to non-admin`, async function () {

      await truffleAssert.reverts(
        instance.creditInsurance({
          from: nonAdmin
        }, key),
        OnlyAdmin
        );
    });

    it(`lets block withdraw insurance to non-admin`, async function () {

      await truffleAssert.reverts(
        instance.withdrawInsurance({
          from: nonAdmin
        }, key),
        OnlyAdmin
        );
    });


    // Consortium Rights (Voting on operational status)
    it(`lets block suspendService() to non-approved`, async function () {

      await truffleAssert.reverts(
        instance.suspendService({
          from: nonAffiliate,
        }),
        OnlyApprovedAffiliate
        );

      assert.isTrue(await instance.isOperational());
    });

    it(`lets block resumeService() to non-approved`, async function () {

      await truffleAssert.reverts(
        instance.resumeService({
          from: nonAffiliate,
        }),
        OnlyApprovedAffiliate
        );

      assert.isTrue(await instance.isOperational());
    });

    it(`lets block suspendService() to non-consortium`, async function () {

      await truffleAssert.reverts(
        instance.suspendService({
          from: nonAffiliate,
        }),
        OnlyConsortiumAffiliate
        );
        
      assert.isTrue(await instance.isOperational());
    });

    it(`lets block resumeService() to non-consortium`, async function () {

      await truffleAssert.reverts(
        instance.resumeService({
          from: nonAffiliate,
        }),
        OnlyConsortiumAffiliate
        );
        
      assert.isTrue(await instance.isOperational());
    });

    // Consortium (approval voting)
    

    // Operational
    it(`lets suspend and restart service`, async function () {
      // when
      await instance.suspendService({from: firstAffiliate});

      // then
      assert.isFalse(await instance.isOperational());
      await instance.resumeService({from: firstAffiliate});
      assert.isTrue(await instance.isOperational());
    });

    it(`lets be not Operational - Create Affiliate`, async function () {
      await instance.suspendService({from: firstAffiliate});

      await truffleAssert.reverts(
        instance.createAffiliate({
          from: nonAdmin,
        }, newAffiliate, "affiliate"),
        OnlyOperational
        );

      await instance.resumeService({from: firstAffiliate});
    });  

    it(`lets be not Operational - Approve Affiliate`, async function () {
      await instance.suspendService({from: firstAffiliate});

      await truffleAssert.reverts(
        instance.approveAffiliate({
          from: nonAdmin,
        }, newAffiliate),
        OnlyOperational
        );

      await instance.resumeService({from: firstAffiliate});
    }); 

    it(`lets be not Operational - Membership`, async function () {
      await instance.suspendService({from: firstAffiliate});

      await truffleAssert.reverts(
        instance.depositMebership({
          from: affiliate, value: 10
        }),
        OnlyOperational
        );

      await instance.resumeService({from: firstAffiliate});
    });  

    it(`lets be not Operational - Funding`, async function () {
      await instance.suspendService({from: firstAffiliate});

      await truffleAssert.reverts(
        instance.fundConsortium({
          from: affiliate, value: 10
        }),
        OnlyOperational
        );

      await instance.resumeService({from: firstAffiliate});
    }); 

    it(`lets be not Operational - Insurance`, async function () {
      await instance.suspendService({from: firstAffiliate});
    
      await truffleAssert.reverts(
        instance.depositInsurance({
          from: nonAdmin, value: 1
        }),
        OnlyAdmin
        );

        await truffleAssert.reverts(
          instance.creditInsurance({
            from: nonAdmin
          }, key),
          OnlyAdmin
          );

          await truffleAssert.reverts(
            instance.withdrawInsurance({
              from: nonAdmin
            }, key),
            OnlyAdmin
            );

      await instance.resumeService({from: firstAffiliate});
    });

    it(`lets block deposit insurance to non-admin`, async function () {

      await truffleAssert.reverts(
        instance.depositInsurance({
          from: nonAdmin, value: 1
        }),
        OnlyAdmin
        );
    });

    it(`lets block credit insurance to non-admin`, async function () {

      await truffleAssert.reverts(
        instance.creditInsurance({
          from: nonAdmin
        }, key),
        OnlyAdmin
        );
    });

    it(`lets block withdraw insurance to non-admin`, async function () {

      await truffleAssert.reverts(
        instance.withdrawInsurance({
          from: nonAdmin
        }, key),
        OnlyAdmin
        );
    });
  });
});
