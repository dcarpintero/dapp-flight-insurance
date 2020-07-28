const ConsortiumSettings = artifacts.require("ConsortiumSettings");
const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const FlightInsuranceHandler = artifacts.require("FlightInsuranceHandler");
const fs = require("fs");

module.exports = function (deployer) {
  deployer.then(async () => {
    await deployer.deploy(ConsortiumSettings);
    await deployer.deploy(ConsortiumAlliance, ConsortiumSettings.address);
    await deployer.deploy(FlightInsuranceHandler, ConsortiumAlliance.address);

    let config = {
      localhost: {
        url: "http://localhost:8545",
        dataAddress: ConsortiumAlliance.address,
        appAddress: FlightInsuranceHandler.address,
      },
    };
    fs.writeFileSync(
      __dirname + "/../src/dapp/config.json",
      JSON.stringify(config, null, "\t"),
      "utf-8"
    );
    fs.writeFileSync(
      __dirname + "/../src/server/config.json",
      JSON.stringify(config, null, "\t"),
      "utf-8"
    );
  });
};
