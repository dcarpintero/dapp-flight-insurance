import Config from './config.json'
import Web3 from 'web3'

export default class App {
  constructor(network, callback) {
    let config = Config[network]
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url))

    this.accounts = []
    this.airlines = []
    this.flights = []
    this.insurances = []
    this.consortium = []
    this.insuree = []
    this.initialize(callback)
  }

  initialize(callback) {
    this.BASE_REST_API = 'http://localhost:3000'
    this.fetchAccounts()
    this.fetchAirlines()
    this.fetchFlights()
    this.fetchInsurances()
    this.fetchConsortium()

    callback()
  }

  getFlights() {
    var URL = this.BASE_REST_API + '/flights'
    return fetch(URL)
  }

  getInsurances() {
    var URL = this.BASE_REST_API + '/insurances'
    return fetch(URL)
  }

  getAirlines() {
    var URL = this.BASE_REST_API + '/airlines'
    return fetch(URL)
  }

  getInsuree(address) {
    var URL = this.BASE_REST_API + '/insuree/' + address
    return fetch(URL)
  }

  getDefaultInsureeAddress() {
    return this.accounts[8]
  }

  getConsortium() {
    var URL = this.BASE_REST_API + '/consortium'
    return fetch(URL)
  }

  putPremium(address) {
    var URL = this.BASE_REST_API + '/insuree/' + address + '/premium'

    return fetch(URL, {
      method: 'PUT',
    })
  }

  fetchAccounts() {
    this.web3.eth.getAccounts((error, accounts) => {
      this.accounts = accounts
    })
  }

  fetchAirlines() {
    var URL = this.BASE_REST_API + '/airlines'

    fetch(URL)
      .then((response) => {
        return response.json()
      })
      .then((airlines) => {
        this.airlines = airlines
        console.log('airlines:')
        console.log(this.airlines)
      })
      .catch((error) => console.log(error))
  }

  fetchFlights() {
    var URL = this.BASE_REST_API + '/flights'

    fetch(URL)
      .then((response) => {
        return response.json()
      })
      .then((flights) => {
        this.flights = flights
        console.log('flights:')
        console.log(this.flights)
      })
      .catch((error) => console.log(error))
  }

  fetchInsurances() {
    var URL = this.BASE_REST_API + '/insurances'

    fetch(URL)
      .then((response) => {
        return response.json()
      })
      .then((insurances) => {
        this.insurances = insurances
        console.log('insurances:')
        console.log(this.insurances)
      })
      .catch((error) => console.log(error))
  }

  fetchConsortium() {
    var URL = this.BASE_REST_API + '/consortium'

    fetch(URL)
      .then((response) => {
        return response.json()
      })
      .then((consortium) => {
        this.consortium = consortium
        console.log('consortium:')
        console.log(this.consortium)
      })
      .catch((error) => console.log(error))
  }

  fetchInsuree(address) {
    var URL = this.BASE_REST_API + '/insuree/' + address

    fetch(URL)
      .then((response) => {
        return response.json()
      })
      .then((insuree) => {
        this.insuree = insuree
        console.log('insuree:')
        console.log(this.insuree)
      })
      .catch((error) => console.log(error))
  }

  requestFlightStatus(key) {
    var URL = this.BASE_REST_API + '/flight/' + key + '/status'

    fetch(URL)
      .then((response) => {
        console.log('Flight status has been resolved, check insuree premium')
      })
      .catch((error) => console.log(error))
  }
}
