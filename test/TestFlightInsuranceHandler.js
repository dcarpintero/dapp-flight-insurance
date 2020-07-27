const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const FlightInsuranceHandler = artifacts.require("FlightInsuranceHandler");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("FlightInsuranceHandler", async (accounts) => {
  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");

  var flight_key_1;
  var flight_key_2;
  var flight_key_3;
  var flight_key_4;

  var insurance_F1_P1; // LATE_AIRLINE
  var insurance_F2_P2; // LATE_AIRLINE
  var insurance_F2_P3; // LATE_AIRLINE
  var insurance_F3_P4; // ONTIME
  var insurance_F4_P5; // LATE_OTHER

  var request_key_F1;

  const FlightStatus = {
    UNKNOWN: 0,
    ON_TIME: 1,
    LATE_AIRLINE: 2,
    LATE_WEATHER: 3,
    LATE_TECHNICAL: 4,
    LATE_OTHER: 5,
  };

  before("setup contract", async () => {
    admin = accounts[0];
    wrightBrothers = accounts[1];
    KittyHawk = accounts[2];

    passenger_1 = accounts[3];
    passenger_2 = accounts[4];
    passenger_3 = accounts[5];
    passenger_4 = accounts[6];
    passenger_5 = accounts[7];

    flight_1 = web3.utils.utf8ToHex("WB1111"); // LATE_AIRLINE
    flight_2 = web3.utils.utf8ToHex("WB2222"); // LATE_AIRLINE
    flight_3 = web3.utils.utf8ToHex("KH1111"); // ONTIME
    flight_4 = web3.utils.utf8ToHex("KH2222"); // LATE_OTHER

    consortium = await ConsortiumAlliance.deployed();
    insuranceHandler = await FlightInsuranceHandler.deployed();
  });

  describe("Flight Insurance Workflow", function () {
    it(`lets Admin be Admin`, async () => {
      console.log("Consortium Admin: " + admin);
      console.log("FlightInsuranceHandler Admin: " + admin);

      assert.isTrue(await consortium.isAdmin(admin));
      assert.isTrue(await insuranceHandler.isAdmin(admin));
    });

    it(`lets add Delegate`, async () => {
      console.log(
        "FlightInsuranceHandler Address: " + FlightInsuranceHandler.address
      );

      await consortium.addAdminRole(FlightInsuranceHandler.address, {
        from: admin,
      });

      assert.isTrue(await consortium.isAdmin(FlightInsuranceHandler.address));
    });

    it(`lets be operational after deployment`, async () => {
      assert.isTrue(await consortium.isOperational());
      assert.isTrue(await insuranceHandler.isOperational());
    });

    it(`lets register first airline`, async () => {
      tx = await consortium.createAffiliate(wrightBrothers, "Wright Brothers");
      truffleAssert.eventEmitted(tx, "LogAffiliateRegistered");
    });

    it(`lets register second airline`, async () => {
      tx = await consortium.createAffiliate(KittyHawk, "Kitty Hawk");
      truffleAssert.eventEmitted(tx, "LogAffiliateRegistered");
    });

    it(`lets deposit consortium memberships`, async () => {
      let fee = MEMBERSHIP_FEE;

      let tx_1 = await consortium.depositMebership({
        from: wrightBrothers,
        value: fee,
      });
      truffleAssert.eventEmitted(tx_1, "LogAffiliateFunded");

      let tx_2 = await consortium.depositMebership({
        from: KittyHawk,
        value: fee,
      });
      truffleAssert.eventEmitted(tx_2, "LogAffiliateFunded");
    });

    it(`lets register Wright Brothers' flights`, async () => {
      let flight_tx_1 = await insuranceHandler.registerFlight(flight_1, 1111, {
        from: wrightBrothers,
      });
      truffleAssert.eventEmitted(flight_tx_1, "LogFlightRegistered");
      flight_key_1 = flight_tx_1.logs[0].args["key"];

      let flight_tx_2 = await insuranceHandler.registerFlight(flight_2, 2222, {
        from: wrightBrothers,
      });
      truffleAssert.eventEmitted(flight_tx_2, "LogFlightRegistered");
      flight_key_2 = flight_tx_2.logs[0].args["key"];
    });

    it(`lets register Kitty Hawk' flights`, async () => {
      let flight_tx_3 = await insuranceHandler.registerFlight(flight_3, 1111, {
        from: KittyHawk,
      });
      truffleAssert.eventEmitted(flight_tx_3, "LogFlightRegistered");
      flight_key_3 = flight_tx_3.logs[0].args["key"];

      let flight_tx_4 = await insuranceHandler.registerFlight(flight_4, 2222, {
        from: wrightBrothers,
      });
      truffleAssert.eventEmitted(flight_tx_4, "LogFlightRegistered");
      flight_key_4 = flight_tx_4.logs[0].args["key"];
    });

    it(`lets create flight insurances`, async () => {
      let tx_1 = await insuranceHandler.registerFlightInsurance(flight_key_1, {
        from: passenger_1,
        value: INSURANCE_FEE,
      });

      let tx_2 = await insuranceHandler.registerFlightInsurance(flight_key_2, {
        from: passenger_2,
        value: INSURANCE_FEE,
      });

      let tx_3 = await insuranceHandler.registerFlightInsurance(flight_key_2, {
        from: passenger_3,
        value: INSURANCE_FEE,
      });

      let tx_4 = await insuranceHandler.registerFlightInsurance(flight_key_3, {
        from: passenger_4,
        value: INSURANCE_FEE,
      });

      let tx_5 = await insuranceHandler.registerFlightInsurance(flight_key_4, {
        from: passenger_5,
        value: INSURANCE_FEE,
      });

      insurance_F1_P1 = tx_1.logs[0].args["key"];
      insurance_F2_P2 = tx_2.logs[0].args["key"];
      insurance_F2_P3 = tx_3.logs[0].args["key"];
      insurance_F3_P4 = tx_4.logs[0].args["key"];
      insurance_F4_P5 = tx_5.logs[0].args["key"];

      truffleAssert.eventEmitted(tx_1, "LogFlightInsuranceRegistered");
      truffleAssert.eventEmitted(tx_2, "LogFlightInsuranceRegistered");
      truffleAssert.eventEmitted(tx_3, "LogFlightInsuranceRegistered");
      truffleAssert.eventEmitted(tx_4, "LogFlightInsuranceRegistered");
      truffleAssert.eventEmitted(tx_5, "LogFlightInsuranceRegistered");
    });

    it(`lets request flight status`, async () => {
      let tx = await insuranceHandler.requestFlightStatus(
        wrightBrothers,
        flight_1,
        1111
      );
      truffleAssert.eventEmitted(tx, "LogFlightStatusRequested");
      request_key_F1 = tx.logs[0].args["key"];
    });

    it(`lets process flight status`, async () => {
      let status_F1 = FlightStatus.LATE_AIRLINE;

      let tx = await insuranceHandler.processFlightStatus(
        request_key_F1,
        wrightBrothers,
        flight_1,
        1111,
        status_F1,
        {
          from: admin,
        }
      );
      truffleAssert.eventEmitted(tx, "LogFlightStatusProcessed");
      truffleAssert.eventEmitted(tx, "LogInsureeCredited"); // insuree: , check balance:
    });
  });
});
