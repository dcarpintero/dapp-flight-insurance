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
  insurances: [],

  init: async function () {
    let accounts = await web3.eth.getAccounts()
    let WB = accounts[1]
    let KH = accounts[2]

    let date_f1 = new Date('1 August 2022 11:11:00 GMT').getTime()
    let date_f2 = new Date('2 August 2022 12:22:00 GMT').getTime()
    let date_f3 = new Date('3 August 2022 13:33:00 GMT').getTime()
    let date_f4 = new Date('4 August 2022 14:44:00 GMT').getTime()

    console.log('Initializing airlines, flights and oracles...')

    /*
    this.registerAirline(WB, 'Wright Brothers').then((result) => {
      this.registerFlight(WB, 'WB1111', date_f1)
      this.registerFlight(WB, 'WB2222', date_f2)
    })

    this.registerAirline(KH, 'Kitty Hawk').then((result) => {
      this.registerFlight(KH, 'KH3333', date_f3)
      this.registerFlight(KH, 'KH4444', date_f4)
    })*/

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
    let hexcode = web3.utils.utf8ToHex(_code)
    let key = web3.utils.soliditySha3(
      _airline,
      hexcode.padEnd(2 + 64, '0'),
      _timestamp,
    )

    insuranceHandler.methods
      .registerFlight(hexcode, _timestamp)
      .send({
        from: _airline,
        gas: 4000000,
      })
      .then((result) => {
        this.flights.push({
          key: key,
          code: _code,
          hexcode: hexcode,
          airline: _airline,
          timestamp: _timestamp,
        })
        console.log('Flight has been registered: ' + _code)
      })
      .catch((error) => {
        console.log('Error while registering flight: ' + error)
      })
  },

  registerInsurance: async function (passenger, flight, fee) {
    if (web3.utils.isAddress(passenger)) {
      insuranceHandler.methods
        .registerFlightInsurance(flight)
        .send({ from: passenger, value: fee, gas: 4000000 })
        .then((result) => {
          this.insurances.push({
            passenger: passenger,
            flight: flight,
            fee: fee,
          })
          console.log('Flight Insurance has been registered')
        })
        .catch((error) => {
          console.log('Error while registering flight insurance: ' + error)
        })
    }
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

  requestFlightStatus: async function (airline, flight, timestamp) {
    let accounts = await web3.eth.getAccounts()

    insuranceHandler.methods
      .requestFlightStatus(airline, flight, timestamp)
      .send({ from: accounts[0] })
      .then((result) => {
        console.log('Flight status has been requested:' + flight)
      })
  },

  sendOracleResponse: async function (key, index, airline, flight, timestamp) {
    let totalResponses = 0
    const consensus = await settings.methods.ORACLE_CONSENSUS_RESPONSES().call()

    for (let i = 0; i < this.oracles.length; i++) {
      for (let idx = 0; idx < 3; idx++) {
        if (index == this.oracles[i].indexes[idx]) {
          console.log(
            '\t submitting oracle response: ' + this.oracles[i].indexes[idx],
          )

          // 4 is a LATE_AIRLINE status code
          await insuranceHandler.methods
            .submitOracleResponse(
              this.oracles[i].indexes[idx],
              airline,
              flight,
              timestamp,
              4,
            )
            .send({
              from: this.oracles[i].address,
            })

          totalResponses = totalResponses + 1

          if (totalResponses == consensus) {
            console.log('\t reached Oracle consensus')
            return
          }
        }
      }
    }
  },
}

insuranceHandler.events.LogInsureeCredited({ fromBlock: 0 }, (error, event) => {
  if (error) {
    console.log('error:' + error)
  } else {
    console.log(
      'Insurance %s has been credited to insuree',
      event.returnValues.key,
    )
  }
})

insuranceHandler.events.LogConsortiumCredited(
  { fromBlock: 0 },
  (error, event) => {
    if (error) {
      console.log('error:' + error)
    } else {
      console.log(
        'Insurance %s has been credited to consortium',
        event.returnValues.key,
      )
    }
  },
)

insuranceHandler.events.LogFlightStatusRequested(
  { fromBlock: 0 },
  (error, event) => {
    if (error) {
      console.log('error:' + error)
    } else {
      var key = event.returnValues.key
      var index = event.returnValues.index
      var airline = event.returnValues.airline
      var flight = event.returnValues.flight
      var timestamp = event.returnValues.timestamp

      Backend.sendOracleResponse(key, index, airline, flight, timestamp)
    }
  },
)

Backend.init()

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.json({
    version: '0.1.0',
  })
})

app.get('/airlines', (req, res) => {
  res.json(Backend.airlines)
})

app.get('/airline/:address', (req, res) => {
  var address = req.params.address

  consortium.methods.affiliates(address).call(function (err, result) {
    if (err) {
      console.log(err.message)
    } else {
      res.json(result)
    }
  })
})

app.get('/flights', (req, res) => {
  res.json(Backend.flights)
})

app.get('/flight/:key', (req, res) => {
  var key = req.params.key

  insuranceHandler.methods.flights(key).call(function (err, result) {
    if (err) {
      console.log(err.message)
    } else {
      res.json(result)
    }
  })
})

app.get('/flight/:key/status', (req, res) => {
  var airline = req.body.airline
  var flight = req.body.hexcode
  var timestamp = req.body.timestamp

  Backend.requestFlightStatus(airline, flight, timestamp)
  res.sendStatus(200)
})

app.get('/oracles', (req, res) => {
  res.json(Backend.oracles)
})

app.get('/insurances', async (req, res) => {
  res.json(Backend.insurances)
})

app.get('/insuree/:address', async (req, res) => {
  var insuree = req.params.address
  var balance = await web3.eth.getBalance(insuree)

  await consortium.methods.payments(insuree).call(function (err, payments) {
    if (err) {
      console.log(err.message)
    } else {
      res.json({ address: insuree, balance: balance, premium: payments })
    }
  })
})

app.post('/insurance', async (req, res) => {
  var passenger = req.body.passenger
  var flight = req.body.flight
  var fee = req.body.fee

  await Backend.registerInsurance(passenger, flight, fee)
  res.json(req.body)
})

app.get('/consortium', async (req, res) => {
  var address = config.dataAddress
  var balance = await consortium.methods.getConsortiumBalance().call()
  var escrow = await consortium.methods.getConsortiumEscrow().call()

  res.json({
    address: address,
    balance: balance,
    escrow: escrow,
  })
})

export default app
