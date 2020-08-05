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
    let accounts = await web3.eth.getAccounts()
    let WB = accounts[1]
    let KH = accounts[2]

    let date_f1 = new Date('1 August 2022 11:11:00 GMT').getMilliseconds()
    let date_f2 = new Date('2 August 2022 12:22:00 GMT').getMilliseconds()
    let date_f3 = new Date('3 August 2022 13:33:00 GMT').getMilliseconds()
    let date_f4 = new Date('4 August 2022 14:44:00 GMT').getMilliseconds()

    console.log('Initializing server...')

    this.registerAirline(WB, 'Wright Brothers').then((result) => {
      this.registerFlight(WB, 'WB1111', date_f1)
      this.registerFlight(WB, 'WB2222', date_f2)
    })

    this.registerAirline(KH, 'Kitty Hawk').then((result) => {
      this.registerFlight(KH, 'KH3333', date_f3)
      this.registerFlight(KH, 'KH4444', date_f4)
    })

    await this.registerOracles()
  },

  registerAirline: async function (_address, _title) {
    let accounts = await web3.eth.getAccounts()
    let admin = accounts[0]
    let fee = await settings.methods.CONSORTIUM_MEMBERSHIP_FEE().call()

    return new Promise((resolve, reject) => {
      consortium.methods
        .createAffiliate(_address, _title)
        .send({ from: admin, gas: 4000000 })
        .then((result) => {
          consortium.methods
            .depositMebership()
            .send({
              from: _address,
              value: fee,
              gas: 4000000,
            })
            .then((result) => {
              this.airlines.push({ title: _title, address: _address })
              console.log('Airline has been registered: ' + _title)
              resolve()
            })
        })
        .catch((error) => {
          console.log('Error while registering airline: ' + error)
          reject()
        })
    })
  },

  registerFlight: async function (_airline, _code, _timestamp) {
    let code_id = web3.utils.utf8ToHex(_code)

    insuranceHandler.methods
      .registerFlight(code_id, _timestamp)
      .send({
        from: _airline,
        gas: 4000000,
      })
      .then((result) => {
        this.flights.push({
          code_id: code_id,
          code: _code,
          airline: _airline,
          timestamp: _timestamp,
        })
        console.log('Flight has been registered: ' + _code)
      })
      .catch((error) => {
        console.log('Error while registering flight: ' + error)
      })
  },

  registerOracles: async function () {
    let accounts = await web3.eth.getAccounts()
    const ORACLES_COUNT = 25

    settings.methods
      .ORACLE_MEMBERSHIP_FEE()
      .call()
      .then((fee) => {
        for (let a = 10; a < ORACLES_COUNT; a++) {
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
