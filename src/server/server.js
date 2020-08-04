import ConsortiumAlliance from '../../build/contracts/ConsortiumAlliance.json'
import FlightInsuranceHandler from '../../build/contracts/flightInsuranceHandler.json'

import Config from './config.json'
import Web3 from 'web3'
import express from 'express'
import regeneratorRuntime from 'regenerator-runtime'

let config = Config['localhost']
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')),
)
web3.eth.defaultAccount = web3.eth.accounts[0]

let consortium = new web3.eth.Contract(
  ConsortiumAlliance.abi,
  config.dataAddress,
)

let insuranceHandler = new web3.eth.Contract(
  FlightInsuranceHandler.abi,
  config.appAddress,
)

const Backend = {
  airlines: [],
  flights: [],
  oracles: [],

  initAirlines: async function () {
    let accounts = await web3.eth.getAccounts()
    let admin = accounts[0]
    let wrightBrothers = accounts[1]
    let kittyHawk = accounts[2]
    const fee = web3.utils.toWei('10', 'ether')

    console.log('Registering Airlines...')

    await consortium.methods
      .createAffiliate(wrightBrothers, 'Wright Brothers')
      .send({ from: admin, gas: 500000 })

    await consortium.methods
      .createAffiliate(kittyHawk, 'Kitty Hawk')
      .send({ from: admin, gas: 500000 })

    await consortium.methods.depositMebership().send({
      from: wrightBrothers,
      value: fee,
      gas: 500000,
    })
    this.airlines.push({ title: 'Wright Brothers', address: wrightBrothers })
    console.log('\tWright Brothers has been registered')

    await consortium.methods.depositMebership().send({
      from: kittyHawk,
      value: fee,
      gas: 500000,
    })
    this.airlines.push({ title: 'Kitty Hawk', address: kittyHawk })
    console.log('\tKitty Hawk has been registered')
  },

  initFlights: async function () {
    let accounts = await web3.eth.getAccounts()
    let admin = accounts[0]
    let wrightBrothers = accounts[1]
    let kittyHawk = accounts[2]

    var flight_1 = web3.utils.utf8ToHex('WB1111')
    var flight_2 = web3.utils.utf8ToHex('WB2222')
    var flight_3 = web3.utils.utf8ToHex('KH3333')
    var flight_4 = web3.utils.utf8ToHex('KH4444')
    var timestamp = 1111

    console.log('Registering Flights...')
    await insuranceHandler.methods.registerFlight(flight_1, timestamp).send({
      from: wrightBrothers,
    })
    this.flights.push({
      key: flight_1,
      code: 'WB1111',
      airline: wrightBrothers,
      timestamp: timestamp,
    })

    await insuranceHandler.methods.registerFlight(flight_2, timestamp).send({
      from: wrightBrothers,
    })
    this.flights.push({
      key: flight_2,
      code: 'WB2222',
      airline: wrightBrothers,
      timestamp: timestamp,
    })

    await insuranceHandler.methods.registerFlight(flight_3, timestamp).send({
      from: kittyHawk,
    })
    this.flights.push({
      key: flight_3,
      code: 'KH3333',
      airline: kittyHawk,
      timestamp: timestamp,
    })

    await insuranceHandler.methods.registerFlight(flight_4, timestamp).send({
      from: kittyHawk,
    })
    this.flights.push({
      key: flight_4,
      code: 'KH4444',
      airline: kittyHawk,
      timestamp: timestamp,
    })

    console.log('All flights have been registered')
  },

  initOracles: async function () {
    const ORACLE_FEE = web3.utils.toWei('1', 'ether')
    let accounts = await web3.eth.getAccounts()

    console.log('Registering Oracles...')

    await insuranceHandler.methods.registerOracle().send({
      from: accounts[10],
      value: ORACLE_FEE,
      gas: 500000,
    })

    const indexes = await insuranceHandler.methods
      .getMyIndexes()
      .call({ from: accounts[10] })

    this.oracles.push({ address: accounts[10], indexes: indexes })

    console.log('All Oracles have been registered')
  },
}

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

//Backend.initAirlines()
//Backend.initFlights()
Backend.initOracles()

const app = express()

app.get('/api', (req, res) => {
  res.send({
    version: '0.1.0',
  })
})

app.get('/airlines', (req, res) => {
  res.send(Backend.airlines)
})

app.get('/flights', (req, res) => {
  res.send(Backend.flights)
})

app.get('/oracles', (req, res) => {
  res.send(Backend.oracles)
})

app.get('/airline/:address', async (req, res) => {
  var address = req.params.address

  consortium.methods.affiliates(address).call(function (err, result) {
    if (err) {
      console.log(err.message)
    } else {
      res.send(result)
    }
  })
})

export default app
