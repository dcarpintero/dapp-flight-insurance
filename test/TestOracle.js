const FlightInsuranceHandler = artifacts.require("FlightInsuranceHandler");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", async (accounts) => {
  const OnlyValidKey = "Invalid insurance key";
  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");

  before("setup contract", async () => {
    instance = await FlightInsuranceHandler.deployed();
  });

  describe("Test_Group", function () {
    it(`lets register oracle`, async () => {});
    it(`lets submit oracle response`, async () => {});
    it(``, async () => {});
  });
});
