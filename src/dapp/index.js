import DOM from './dom'
import App from './app'

import './flightsurety.css'
;(async () => {
  let app = new App('localhost', () => {
    DOM.elid('submit-oracle').addEventListener('click', () => {
      let flight = DOM.elid('flight-number').value

      app.requestFlightStatus(flight, (error, result) => {})
    })

    DOM.elid('update-account').addEventListener('click', () => {
      updateAccount(app)
    })

    DOM.elid('withdraw-premium').addEventListener('click', () => {
      withdrawPremium(app)
    })
  })

  displayAirlines(app)
  displayFlights(app)
  displayInsurances(app)
  displayAccount(app)
  displayConsortium(app)
})()

function updateAccount(app) {
  let insuree = app.getDefaultInsureeAddress()

  app
    .getInsuree(insuree)
    .then((response) => {
      return response.json()
    })
    .then((insuree) => {
      let balance =
        app.web3.utils.fromWei(insuree.balance.toString(), 'ether') + ' ETH'
      let premium =
        app.web3.utils.fromWei(insuree.premium.toString(), 'ether') + ' ETH'

      console.log('\tbalance:' + balance)
      console.log('\tpremium:' + premium)

      DOM.elid('acc-balance').innerText = balance
      DOM.elid('acc-premium').innerText = premium
    })
    .catch((error) => console.log(error))
}

function withdrawPremium(app) {
  let insuree = app.getDefaultInsureeAddress()

  app
    .putPremium(insuree)
    .then((response) => {
      updateAccount(app)
    })
    .catch((error) => console.log(error))
}

function displayAirlines(app) {
  let insurancesDiv = DOM.elid('airlines-wrapper')
  let section = DOM.section()

  let row = section.appendChild(DOM.div({ className: 'row' }))
  row.appendChild(DOM.div({ className: 'col-sm-2 field-header' }, 'Title'))
  row.appendChild(DOM.div({ className: 'col-sm-6 field-header' }, 'Address'))
  section.appendChild(row)

  app
    .getAirlines()
    .then((response) => {
      return response.json()
    })
    .then((airlines) => {
      airlines.map((airline) => {
        let row = section.appendChild(DOM.div({ className: 'row' }))
        row.appendChild(DOM.div({ className: 'col-sm-2' }, airline.title))
        row.appendChild(DOM.div({ className: 'col-sm-6' }, airline.address))
        section.appendChild(row)
      })

      insurancesDiv.append(section)
    })
    .catch((error) => console.log(error))
}

function displayFlights(app) {
  let flightsDiv = DOM.elid('flights-wrapper')
  let section = DOM.section()

  let row = section.appendChild(DOM.div({ className: 'row' }))
  row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'Code'))
  row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'From'))
  row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'To'))
  row.appendChild(DOM.div({ className: 'col-sm-2 field-header' }, 'Time'))
  row.appendChild(DOM.div({ className: 'col-sm-4 field-header' }, 'Flight Key'))
  section.appendChild(row)

  app
    .getFlights()
    .then((response) => {
      return response.json()
    })
    .then((flights) => {
      flights.map((flight) => {
        let row = section.appendChild(DOM.div({ className: 'row' }))
        let key = flight.key

        row.appendChild(DOM.div({ className: 'col-sm-1' }, flight.code))
        row.appendChild(DOM.div({ className: 'col-sm-1' }, flight.from))
        row.appendChild(DOM.div({ className: 'col-sm-1' }, flight.to))
        row.appendChild(
          DOM.div(
            { className: 'col-sm-2' },
            new Date(flight.timestamp).toUTCString(),
          ),
        )
        row.appendChild(DOM.div({ className: 'col-sm-4' }, flight.key))
        section.appendChild(row)
      })

      flightsDiv.append(section)
    })
    .catch((error) => console.log(error))
}

function displayInsurances(app) {
  let insurancesDiv = DOM.elid('insurances-wrapper')
  let section = DOM.section()

  let row = section.appendChild(DOM.div({ className: 'row' }))
  row.appendChild(DOM.div({ className: 'col-sm-8 field-header' }, 'Flight Key'))
  row.appendChild(DOM.div({ className: 'col-sm-2 field-header' }, 'Deposit'))
  section.appendChild(row)

  app
    .getInsurances()
    .then((response) => {
      return response.json()
    })
    .then((insurances) => {
      insurances.map((insurance) => {
        let fee =
          app.web3.utils.fromWei(insurance.fee.toString(), 'ether') + ' ETH'

        let row = section.appendChild(DOM.div({ className: 'row' }))
        row.appendChild(DOM.div({ className: 'col-sm-8' }, insurance.flight))
        row.appendChild(DOM.div({ className: 'col-sm-2' }, fee))
        section.appendChild(row)
      })

      insurancesDiv.append(section)
    })
    .catch((error) => console.log(error))
}

function displayAccount(app) {
  let accountDiv = DOM.elid('account-wrapper')
  let section = DOM.section()

  let row = section.appendChild(DOM.div({ className: 'row' }))
  row.appendChild(DOM.div({ className: 'col-sm-5 field-header' }, 'Address'))
  row.appendChild(DOM.div({ className: 'col-sm-3 field-header' }, 'Balance'))
  row.appendChild(DOM.div({ className: 'col-sm-3 field-header' }, 'Premium'))
  section.appendChild(row)

  app.web3.eth.getAccounts((error, accounts) => {
    let insuree = accounts[8]

    app
      .getInsuree(insuree)
      .then((response) => {
        return response.json()
      })
      .then((insuree) => {
        let balance =
          app.web3.utils.fromWei(insuree.balance.toString(), 'ether') + ' ETH'
        let premium =
          app.web3.utils.fromWei(insuree.premium.toString(), 'ether') + ' ETH'

        let row = section.appendChild(DOM.div({ className: 'row' }))
        row.appendChild(DOM.div({ className: 'col-sm-5' }, insuree.address))
        row.appendChild(
          DOM.div({ className: 'col-sm-3', id: 'acc-balance' }, balance),
        )
        row.appendChild(
          DOM.div({ className: 'col-sm-3', id: 'acc-premium' }, premium),
        )

        section.appendChild(row)

        accountDiv.append(section)
      })
      .catch((error) => console.log(error))
  })
}

function displayConsortium(app) {
  let consortiumDiv = DOM.elid('consortium-wrapper')
  let section = DOM.section()

  let row = section.appendChild(DOM.div({ className: 'row' }))
  row.appendChild(DOM.div({ className: 'col-sm-5 field-header' }, 'Address'))
  row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'Status'))
  row.appendChild(DOM.div({ className: 'col-sm-2 field-header' }, 'Balance'))
  row.appendChild(DOM.div({ className: 'col-sm-2 field-header' }, 'Escrow'))
  section.appendChild(row)

  app
    .getConsortium()
    .then((response) => {
      return response.json()
    })
    .then((consortium) => {
      let balance =
        app.web3.utils.fromWei(consortium.balance.toString(), 'ether') + ' ETH'
      let escrow =
        app.web3.utils.fromWei(consortium.escrow.toString(), 'ether') + ' ETH'

      let status = 'Operational'
      if (!consortium.isOperational) status = 'Stopped'

      let row = section.appendChild(DOM.div({ className: 'row' }))
      row.appendChild(DOM.div({ className: 'col-sm-5' }, consortium.address))
      row.appendChild(DOM.div({ className: 'col-sm-1' }, status))
      row.appendChild(
        DOM.div({ className: 'col-sm-2', id: 'consortium-balance' }, balance),
      )
      row.appendChild(
        DOM.div({ className: 'col-sm-2', id: 'consortium-escrow' }, escrow),
      )

      section.appendChild(row)

      consortiumDiv.append(section)
    })
    .catch((error) => console.log(error))
}
