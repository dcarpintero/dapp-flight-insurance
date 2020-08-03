import ConsortiumAlliance from "../../build/contracts/ConsortiumAlliance.json";
import FlightInsuranceHandler from "../../build/contracts/flightInsuranceHandler.json";

import Config from "./config.json";
import Web3 from "web3";
import express from "express";
import regeneratorRuntime from "regenerator-runtime";

let config = Config["localhost"];
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
);
web3.eth.defaultAccount = web3.eth.accounts[0];

let consortium = new web3.eth.Contract(
  ConsortiumAlliance.abi,
  config.dataAddress
);

let insuranceHandler = new web3.eth.Contract(
  FlightInsuranceHandler.abi,
  config.appAddress
);

const Backend = {
  airlines: [],
  flights: [],
  oracles: [],

  initAirlines: async function () {
    let accounts = await web3.eth.getAccounts();
    let admin = accounts[0];
    let wrightBrothers = accounts[1];
    let kittyHawk = accounts[2];
    const fee = web3.utils.toWei("10", "ether");

    console.log("Registering Airlines...");

    await consortium.methods
      .createAffiliate(wrightBrothers, "Wright Brothers")
      .send({ from: admin, gas: 500000 });

    await consortium.methods
      .createAffiliate(kittyHawk, "Kitty Hawk")
      .send({ from: admin, gas: 500000 });

    await consortium.methods.depositMebership().send({
      from: wrightBrothers,
      value: fee,
      gas: 500000,
    });
    this.airlines.push({ title: "Wright Brothers", address: wrightBrothers });

    await consortium.methods.depositMebership().send({
      from: kittyHawk,
      value: fee,
      gas: 500000,
    });
    this.airlines.push({ title: "Kitty Hawk", address: kittyHawk });
  },
};

/*
flightSuretyApp.events.OracleRequest(
  {
    fromBlock: 0,
  },
  function (error, event) {
    if (error) console.log(error);
    console.log(event);
  }
);*/

Backend.initAirlines();

const app = express();

app.get("/api", (req, res) => {
  res.send({
    message: "v0.1.0",
  });
});

app.get("/airlines", (req, res) => {
  res.send(Backend.airlines);
});

app.get("/airline/:address", async (req, res) => {
  var address = req.params.address;

  consortium.methods.affiliates(address).call(function (err, result) {
    if (err) {
      console.log(err.message);
    } else {
      console.log("call executed successfully.");
      console.log(result);
      res.send(result);
    }
  });
});

export default app;
