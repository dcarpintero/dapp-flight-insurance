import DOM from './dom'
import App from './app'
import './flightsurety.css'
;(async () => {
  let result = null

  let app = new App('localhost', () => {
    /*
    app.fetchFlights((error, result) => {
      console.log('index.js: fetchFlights')
      console.log(error, result)

      display('Flights', 'These are the flights', [
        { label: 'Operational Status', error: error, value: result },
      ])
    }) */

    // Read transaction
    /*
    contract.isOperational((error, result) => {
      console.log(error, result)
      display('Operational Status', 'Check if contract is operational', [
        { label: 'Operational Status', error: error, value: result },
      ])
    })*/

    DOM.elid('load-flights').addEventListener('click', () => {
      let flightsDiv = DOM.elid('flights-wrapper')
      let section = DOM.section()

      let row = section.appendChild(DOM.div({ className: 'row' }))
      row.appendChild(DOM.div({ className: 'col-sm-2 field-header' }, 'Code'))
      row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'From'))
      row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'To'))
      row.appendChild(DOM.div({ className: 'col-sm-1 field-header' }, 'Time'))
      section.appendChild(row)

      app
        .getFlights()
        .then((response) => {
          return response.json()
        })
        .then((flights) => {
          flights.map((flight) => {
            let row = section.appendChild(DOM.div({ className: 'row' }))

            row.appendChild(DOM.div({ className: 'col-sm-2' }, flight.code))
            row.appendChild(DOM.div({ className: 'col-sm-1' }, flight.from))
            row.appendChild(DOM.div({ className: 'col-sm-1' }, flight.to))
            row.appendChild(
              DOM.div(
                { className: 'col-sm-4' },
                new Date(flight.timestamp).toUTCString(),
              ),
            )
            row.appendChild(
              DOM.div(
                { className: 'btn btn-primary', id: 'buy-insurance' },
                'Buy Insurance',
              ),
            )
            row.appendChild(row.appendChild(DOM.div({ className: 'col-sm-1' })))
            row.appendChild(
              DOM.div(
                { className: 'btn btn-primary', id: 'claim-insurance' },
                'Claim Insurance',
              ),
            )
            section.appendChild(row)
          })

          flightsDiv.append(section)
        })
        .catch((error) => console.log(error))
    })

    DOM.elid('submit-oracle').addEventListener('click', () => {
      let flight = DOM.elid('flight-number').value
      // Write transaction
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
})()

function flights() {
  console.log('index.js: flights')
}

function display(title, description, results) {
  console.log('index.js: display')

  let displayDiv = DOM.elid('display-wrapper')
  let section = DOM.section()
  section.appendChild(DOM.h2(title))
  section.appendChild(DOM.h5(description))
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: 'row' }))
    row.appendChild(DOM.div({ className: 'col-sm-4 field' }, result.label))
    row.appendChild(
      DOM.div(
        { className: 'col-sm-8 field-value' },
        result.error ? String(result.error) : String(result.value),
      ),
    )
    section.appendChild(row)
  })
  displayDiv.append(section)
}
