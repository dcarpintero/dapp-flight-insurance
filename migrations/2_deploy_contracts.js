const ConsortiumSettings = artifacts.require('ConsortiumSettings')
const ConsortiumAlliance = artifacts.require('ConsortiumAlliance')
const FlightInsuranceHandler = artifacts.require('FlightInsuranceHandler')
const fs = require('fs')

module.exports = function (deployer) {
  deployer.then(async () => {
    await deployer.deploy(ConsortiumSettings)
    await deployer.deploy(ConsortiumAlliance, ConsortiumSettings.address)
    await deployer.deploy(FlightInsuranceHandler, ConsortiumAlliance.address)

    consortium = await ConsortiumAlliance.deployed()
    await consortium.addDelegateRole(FlightInsuranceHandler.address)

    let config = {
      localhost: {
        url: 'http://localhost:8545',
        settingsAddress: ConsortiumSettings.address,
        dataAddress: ConsortiumAlliance.address,
        appAddress: FlightInsuranceHandler.address,
      },
    }
    fs.writeFileSync(
      __dirname + '/../src/dapp/config.json',
      JSON.stringify(config, null, '\t'),
      'utf-8',
    )
    fs.writeFileSync(
      __dirname + '/../src/server/config.json',
      JSON.stringify(config, null, '\t'),
      'utf-8',
    )
  })
}
