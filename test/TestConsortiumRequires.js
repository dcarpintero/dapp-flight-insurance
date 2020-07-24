const ConsortiumAlliance = artifacts.require('ConsortiumAlliance')
const assert = require('chai').assert
const truffleAssert = require('truffle-assertions')

contract('ConsortiumAlliance', function (accounts) {
  const OnlyAdmin = 'Caller is not Admin'
  const OnlyApprovedAffiliate = 'Caller is not an approved affiliate'
  const OnlyConsortiumAffiliate = 'Caller is not a consortium Affiliate'
  const OnlyOperational = 'Contract is currently not operational'

  before('setup contract', async () => {
    admin = accounts[0]

    firstAffiliate = accounts[1]
    approvedAffiliate = accounts[1]
    consortiumAffiliate = accounts[1]
    newAffiliate = accounts[2]

    nonAdmin = accounts[8]
    nonAffiliate = accounts[9]

    instance = await ConsortiumAlliance.deployed()

    await instance.createAffiliate(firstAffiliate, 'firstAffiliate')

    await instance.depositMebership({
      from: firstAffiliate,
      value: web3.utils.toWei('10', 'ether'),
    })
  })

  console.log('ganache-cli accounts:')
  console.log('Contract Owner: accounts[0] ', accounts[0])
  console.log('First Affiliate: accounts[1] ', accounts[1])
  console.log('Second Affiliate: accounts[2] ', accounts[2])
  console.log('Third Affiliate: accounts[3] ', accounts[3])
  console.log('Fourth Affiliate: accounts[4] ', accounts[4])
  console.log('Fifth Affiliate: accounts[5] ', accounts[5])

  describe('Roles & Permissions', function () {
    // Admin Rights (Insurance Workflow)
    describe('Admin Rights', function () {
      it(`lets block functions if non-admin`, async () => {
        let instance = await ConsortiumAlliance.deployed()

        await truffleAssert.reverts(
          instance.createAffiliate(firstAffiliate, 'affiliate', {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin,
        )
      })

      it(`lets block deposit insurance if non-admin`, async () => {
        let instance = await ConsortiumAlliance.deployed()

        await truffleAssert.reverts(
          instance.depositInsurance({
            from: nonAdmin,
            value: 1,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin,
        )
      })

      it(`lets block credit insurance if non-admin`, async () => {
        let instance = await ConsortiumAlliance.deployed()
        let key = web3.utils.fromAscii('key')

        await truffleAssert.reverts(
          instance.creditInsurance(key, {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin,
        )
      })

      it(`lets block withdraw insurance if non-admin`, async () => {
        let instance = await ConsortiumAlliance.deployed()
        let key = web3.utils.fromAscii('key')

        await truffleAssert.reverts(
          instance.withdrawInsurance(key, {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin,
        )
      })
    })

    describe('Consortium Rights', function () {
      /*
      it('lets approved affiliate', async () => {
        instance.approveAffiliate(approvedAffiliate, { from: firstAffiliate })
        instance.approveAffiliate(approvedAffiliate, { from: secondAffiliate })
      })*/

      it(`lets block suspendService() if non-consortium`, async () => {
        let instance = await ConsortiumAlliance.deployed()

        await truffleAssert.reverts(
          instance.suspendService({
            from: nonAffiliate,
            nonce: await web3.eth.getTransactionCount(nonAffiliate),
          }),
          OnlyConsortiumAffiliate,
        )
      })

      it(`lets block resumeService() if non-consortium`, async () => {
        let instance = await ConsortiumAlliance.deployed()

        await truffleAssert.reverts(
          instance.resumeService({
            from: nonAffiliate,
            nonce: await web3.eth.getTransactionCount(nonAffiliate),
          }),
          OnlyConsortiumAffiliate,
        )
      })
    })

    describe('Operational', function () {
      it(`lets suspend and restart service`, async function () {
        await instance.suspendService({ from: firstAffiliate })
        assert.isFalse(await instance.isOperational())

        await instance.resumeService({ from: firstAffiliate })
        assert.isTrue(await instance.isOperational())
      })

      it(`lets be not Operational - Create Affiliate`, async function () {
        await instance.suspendService({ from: firstAffiliate })

        await truffleAssert.reverts(
          instance.createAffiliate(newAffiliate, 'newAffiliate', {
            from: admin,
            nonce: await web3.eth.getTransactionCount(admin),
          }),
          OnlyOperational,
        )

        await instance.resumeService({ from: firstAffiliate })
      })
    })
  })
})

/*
    // Operational




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
*/
