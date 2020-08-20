import DOM from './dom'
import App from './app'
import './flightsurety.css'
;(async () => {
  let result = null

  let app = new App('localhost', () => {
    DOM.elid('submit-oracle').addEventListener('click', () => {
      let flight = DOM.elid('flight-number').value

      app.requestFlightStatus(flight, (error, result) => {
        display('Oracles', 'Trigger oracles', [
          {
            label: 'Fetch Flight Status',
            error: error,
            value: result.flight + ' ' + result.timestamp,
          },
        ])
      })
    })
  })

  displayFlights(app)
  displayInsurances(app)
  displayAccount(app)
})()

function displayFlights(app) {
  let flightsDiv = DOM.elid('flights-wrapper')
  let section = DOM.section()

  let row = section.appendChild(DOM.div({ className: 'row' }))
  row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'Code'))
  row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'From'))
  row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'To'))
  row.appendChild(DOM.div({ className: 'col-sm-2 field-header' }, 'Time'))
  row.appendChild(DOM.div({ className: 'col-sm-4 field-header' }, 'Key'))
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
  row.appendChild(
    DOM.div({ className: 'col-sm-2 field-header' }, 'Deposit (wei)'),
  )
  section.appendChild(row)

  app
    .getInsurances()
    .then((response) => {
      return response.json()
    })
    .then((insurances) => {
      insurances.map((insurance) => {
        let row = section.appendChild(DOM.div({ className: 'row' }))

        row.appendChild(DOM.div({ className: 'col-sm-8' }, insurance.flight))
        row.appendChild(DOM.div({ className: 'col-sm-2' }, insurance.fee))

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

  app
    .getInsuree('0xB0D2681581b9d96A033af74A2f3d403fC0F3837a')
    .then((response) => {
      return response.json()
    })
    .then((insuree) => {
      let row = section.appendChild(DOM.div({ className: 'row' }))

      row.appendChild(DOM.div({ className: 'col-sm-5' }, insuree.address))
      row.appendChild(DOM.div({ className: 'col-sm-3' }, insuree.balance))
      row.appendChild(DOM.div({ className: 'col-sm-3' }, insuree.premium))

      section.appendChild(row)

      accountDiv.append(section)
    })
    .catch((error) => console.log(error))
}
