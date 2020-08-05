import ConsortiumSettings from '../../build/contracts/ConsortiumSettings.json'
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

let settings = new web3.eth.Contract(
  ConsortiumSettings.abi,
  config.settingsAddress,
)

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

  init: async function () {
    //await this.registerAirlines()
    //await this.registerFlights()
    await this.registerOracles()
  },

  registerAirlines: async function () {
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

  registerFlights: async function () {
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

  registerOracles2: async function () {
    const ORACLE_FEE = web3.utils.toWei('1', 'ether')
    const ORACLES_COUNT = 10
    let accounts = await web3.eth.getAccounts()

    console.log('Registering Oracles...')

    for (let i = 10; i <= ORACLES_COUNT; i++) {
      await insuranceHandler.methods.registerOracle().send({
        from: accounts[i],
        value: ORACLE_FEE,
        gas: 4712388,
      })
      const indexes = await insuranceHandler.methods
        .getMyIndexes()
        .call({ from: accounts[i] })

      this.oracles.push({ address: accounts[i], indexes: indexes })
      console.log('\t oracle registered: ' + indexes)
    }
  },

  registerOracles: async function () {
    let accounts = await web3.eth.getAccounts()
    const ORACLES_COUNT = 25

    settings.methods
      .ORACLE_MEMBERSHIP_FEE()
      .call()
      .then((fee) => {
        for (let a = 1; a < ORACLES_COUNT; a++) {
          insuranceHandler.methods
            .registerOracle()
            .send({ from: accounts[a], value: fee, gas: 4000000 })
            .then((result) => {
              insuranceHandler.methods
                .getMyIndexes()
                .call({ from: accounts[a] })
                .then((indexes) => {
                  this.oracles.push({ address: accounts[a], indexes: indexes })
                  console.log(
                    'Oracle registered: ' + accounts[a] + ' indexes:' + indexes,
                  )
                })
            })
            .catch((error) => {
              console.log(
                'Error while registering oracles: ' +
                  accounts[a] +
                  ' Error: ' +
                  error,
              )
            })
        }
      })
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

Backend.init()

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

app.get('/insuree/:address', (req, res) => {
  res.send('insuree, balance, credit')
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
