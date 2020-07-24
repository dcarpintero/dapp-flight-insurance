//const FlightSuretyApp = artifacts.require("FlightSuretyApp");
//const FlightSuretyData = artifacts.require("FlightSuretyData");
const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const FlightInsuranceHandler = artifacts.require("FlightInsuranceHandler");
const fs = require('fs');

module.exports = function(deployer) {

    let firstAirline = '0xf17f52151EbEF6C7334FAD080c5704D77216b732';

    deployer.deploy(ConsortiumAlliance)
    .then(() => {
        return deployer.deploy(FlightInsuranceHandler)
                .then(() => {
                    let config = {
                        localhost: {
                            url: 'http://localhost:8545',
                            dataAddress: ConsortiumAlliance.address,
                            appAddress: FlightInsuranceHandler.address
                        }
                    }
                    fs.writeFileSync(__dirname + '/../src/dapp/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                    fs.writeFileSync(__dirname + '/../src/server/config.json',JSON.stringify(config, null, '\t'), 'utf-8');
                });
    });
}