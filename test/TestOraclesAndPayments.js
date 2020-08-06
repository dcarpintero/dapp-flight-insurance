const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const FlightInsuranceHandler = artifacts.require("FlightInsuranceHandler");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("FlightInsuranceHandler", async (accounts) => {
  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");
  const ORACLE_FEE = web3.utils.toWei("1", "ether");
  const TEST_ORACLES_COUNT = 25;
  const ORACLE_CONSENSUS = 3;

  var flight_key_1;

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

    wrightBrothers = accounts[31];
    KittyHawk = accounts[32];

    passenger_1 = accounts[33];
    passenger_2 = accounts[34];

    flight_1 = web3.utils.utf8ToHex("WB1111");
    timestamp_flight_1 = Math.floor(Date.now() / 1000);

    consortium = await ConsortiumAlliance.deployed();
    insuranceHandler = await FlightInsuranceHandler.deployed();
  });

  describe("Oracle Registration and Responses", function () {
    it(`lets add Delegate`, async () => {
      await consortium.addDelegateRole(FlightInsuranceHandler.address, {
        from: admin,
      });

      assert.isTrue(
        await consortium.isDelegate(FlightInsuranceHandler.address)
      );
    });

    it(`lets register oracles`, async () => {
      let fee = ORACLE_FEE;

      let tx = await insuranceHandler.registerOracle({
        from: accounts[10],
        value: fee,
      });
      truffleAssert.eventEmitted(tx, "LogOracleRegistered");

      for (let i = 1; i <= TEST_ORACLES_COUNT; i++) {
        tx = await insuranceHandler.registerOracle({
          from: accounts[i],
          value: fee,
        });
        truffleAssert.eventEmitted(tx, "LogOracleRegistered");
        let oracleIndexes = await insuranceHandler.getMyIndexes.call({
          from: accounts[i],
        });
        console.log(
          `\t oracle Registered: ${oracleIndexes[0]}, ${oracleIndexes[1]}, ${oracleIndexes[2]}`
        );
      }
    });

    it(`lets register airline`, async () => {
      await consortium.createAffiliate(wrightBrothers, "Wright Brothers");

      await consortium.depositMebership({
        from: wrightBrothers,
        value: MEMBERSHIP_FEE,
      });
    });

    it(`lets register Wright Brothers' flight`, async () => {
      let flight_tx_1 = await insuranceHandler.registerFlight(
        flight_1,
        timestamp_flight_1,
        {
          from: wrightBrothers,
        }
      );

      flight_key_1 = flight_tx_1.logs[0].args["key"];
    });

    it(`lets create flight insurances`, async () => {
      let tx_1 = await insuranceHandler.registerFlightInsurance(flight_key_1, {
        from: passenger_1,
        value: INSURANCE_FEE,
      });

      let tx_2 = await insuranceHandler.registerFlightInsurance(flight_key_1, {
        from: passenger_2,
        value: INSURANCE_FEE,
      });

      insurance_F1_P1 = tx_1.logs[0].args["key"];
      insurance_F2_P2 = tx_2.logs[0].args["key"];

      truffleAssert.eventEmitted(tx_1, "LogFlightInsuranceRegistered");
      truffleAssert.eventEmitted(tx_2, "LogFlightInsuranceRegistered");
    });

    it(`lets submit oracle responses and trigger process flight`, async () => {
      let req_tx = await insuranceHandler.requestFlightStatus(
        wrightBrothers,
        flight_1,
        timestamp_flight_1,
        {
          from: admin,
          nonce: await web3.eth.getTransactionCount(admin),
        }
      );
      truffleAssert.eventEmitted(req_tx, "LogFlightStatusRequested");
      let index = req_tx.logs[0].args["index"];
      let totalResponses = 0;
      console.log("\t valid index: " + index);

      for (let i = 1; i <= TEST_ORACLES_COUNT; i++) {
        let oracleIndexes = await insuranceHandler.getMyIndexes.call({
          from: accounts[i],
        });

        for (let idx = 0; idx < 3; idx++) {
          if (index == oracleIndexes[idx].toNumber()) {
            console.log(
              "\t submitting oracle response: " + oracleIndexes[idx].toNumber()
            );
            let status_tx = await insuranceHandler.submitOracleResponse(
              oracleIndexes[idx],
              wrightBrothers,
              flight_1,
              timestamp_flight_1,
              FlightStatus.LATE_AIRLINE,
              {
                from: accounts[i],
                nonce: await web3.eth.getTransactionCount(accounts[i]),
              }
            );
            truffleAssert.eventEmitted(status_tx, "LogOracleReport");
            totalResponses = totalResponses + 1;

            if (totalResponses == ORACLE_CONSENSUS) {
              console.log("\t reached Oracle consensus");
              truffleAssert.eventEmitted(status_tx, "LogFlightStatus");
              truffleAssert.eventEmitted(status_tx, "LogFlightStatusProcessed");
              return;
            }
          }
        }
      }
    });

    it(`lets credit escrow account with insruance premium`, async () => {
      const deposit = INSURANCE_FEE;
      const premium_factor = 50;
      const premium = web3.utils.toBN(deposit * (premium_factor / 100));
      const withdraw_amount = web3.utils.toBN(deposit).add(premium);

      assert.equal(
        Number(await consortium.payments(passenger_1)),
        withdraw_amount
      );

      assert.equal(
        Number(await consortium.payments(passenger_2)),
        withdraw_amount
      );
    });

    it(`lets withdraw funds by insurees`, async () => {
      const deposit = INSURANCE_FEE;
      const premium_factor = 50;
      const premium = web3.utils.toBN(deposit * (premium_factor / 100));
      const withdraw_amount = web3.utils.toBN(deposit).add(premium);

      const payeeBalanceBefore = await web3.eth.getBalance(passenger_1);
      let wdrw_tx = await consortium.withdrawPayments(passenger_1, {
        from: passenger_1,
      });
      const payeeBalanceAfter = await web3.eth.getBalance(passenger_1);
      const tx = await web3.eth.getTransaction(wdrw_tx.tx);

      let gasPrice = tx.gasPrice;
      let gasUsed = wdrw_tx.receipt.gasUsed;
      const gas = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(gasUsed));

      assert.equal(
        web3.utils
          .toBN(payeeBalanceAfter)
          .sub(web3.utils.toBN(payeeBalanceBefore)),
        Number(withdraw_amount) - Number(gas)
      );
    });
  });
});
