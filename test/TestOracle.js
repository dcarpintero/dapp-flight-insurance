const ConsortiumAlliance = artifacts.require('ConsortiumAlliance')
const ConsortiumOracle = artifacts.require('ConsortiumOracle')
const FlightInsuranceHandler = artifacts.require('FlightInsuranceHandler')
const assert = require('chai').assert
const truffleAssert = require('truffle-assertions')

contract('Oracle', async (accounts) => {
  const OnlyValidKey = 'Invalid insurance key'
  const ORACLE_FEE = web3.utils.toWei('1', 'ether')

  before('setup contract', async () => {
    insuranceHandler = await FlightInsuranceHandler.deployed()
    oracle = await ConsortiumOracle.deployed()
  })

  describe('Registration and Responses', function () {
    it(`lets register 20+ oracles`, async () => {
      let fee = ORACLE_FEE

      let tx = await consortium.registerOracle({
        from: accounts[10],
        value: fee,
      })
      truffleAssert.eventEmitted(tx, 'LogOracleRegistered')

      for (let i = 11; i <= 35; i++) {
        await consortium.registerOracle({
          from: accounts[i],
          value: fee,
        })
      }
    })

    it(`lets submit oracle response`, async () => {})
    it(``, async () => {})
  })
})
