import DOM from "./dom";
import App from "./app";

import "./flightsurety.css";
(async () => {
  let app = new App("localhost", () => {
    Notification.requestPermission();

    DOM.elid("update-account").addEventListener("click", () => {
      updateAccount(app);
    });

    DOM.elid("withdraw-premium").addEventListener("click", () => {
      withdrawPremium(app);
    });

    DOM.elid("update-consortium").addEventListener("click", () => {
      updateConsortium(app);
    });
  });

  displayAirlines(app);
  displayFlights(app);
  displayAccount(app);
  displayConsortium(app);
})();

function buyInsurance(app, flight) {
  let insuree = app.getDefaultInsureeAddress();

  DOM.elid("buy-" + flight).classList.add("disabled-button");

  app
    .postInsurance(flight, insuree)
    .then((response) => response.json())
    .then((data) => {
      console.log("Insurance has been registered:", data);

      updateAccount(app);
      updateConsortium(app);

      DOM.elid("claim-" + flight).classList.add("enabled-button");
      DOM.elid("claim-" + flight).addEventListener("click", () => {
        claimInsurance(app, flight);
      });

      notify("Insurance has been registered", data.flight);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

function claimInsurance(app, flight) {
  DOM.elid("claim-" + flight).classList.remove("enabled-button");
  DOM.elid("claim-" + flight).classList.add("disabled-button");

  app
    .putClaimInsurance(flight)
    .then((response) => {})
    .then((data) => {
      console.log("Insurance has been claimed, update your accounts");
      notify("Insurance has been claimed", "You might update the accounts");
    })
    .catch((error) => console.log(error));
}

function withdrawPremium(app) {
  let insuree = app.getDefaultInsureeAddress();

  app
    .putPremium(insuree)
    .then((response) => {
      console.log("Withdraw Premium - Updating accounts:");
      updateAccount(app);
      updateConsortium(app);

      notify("The insurance premium has been transferred to your account");
    })
    .catch((error) => console.log(error));
}

function displayAirlines(app) {
  let insurancesDiv = DOM.elid("airlines-wrapper");
  let section = DOM.section();

  let row = section.appendChild(DOM.div({ className: "row" }));
  row.appendChild(DOM.div({ className: "col-sm-2 field-header" }, "Title"));
  row.appendChild(DOM.div({ className: "col-sm-6 field-header" }, "Address"));
  section.appendChild(row);

  app
    .getAirlines()
    .then((response) => {
      return response.json();
    })
    .then((airlines) => {
      airlines.map((airline) => {
        let row = section.appendChild(DOM.div({ className: "row" }));
        row.appendChild(DOM.div({ className: "col-sm-2" }, airline.title));
        row.appendChild(DOM.div({ className: "col-sm-6" }, airline.address));
        section.appendChild(row);
      });

      insurancesDiv.append(section);
    })
    .catch((error) => console.log(error));
}

function displayFlights(app) {
  let flightsDiv = DOM.elid("flights-wrapper");
  let section = DOM.section();

  let row = section.appendChild(DOM.div({ className: "row" }));
  row.appendChild(DOM.div({ className: "col-sm-1 field-header" }, "Code"));
  row.appendChild(DOM.div({ className: "col-sm-1 field-header" }, "From"));
  row.appendChild(DOM.div({ className: "col-sm-1 field-header" }, "To"));
  row.appendChild(DOM.div({ className: "col-sm-4 field-header" }, "Time"));
  //row.appendChild(DOM.div({ className: 'col-sm-2 field-header' }, 'Flight Key'))

  section.appendChild(row);

  app
    .getFlights()
    .then((response) => {
      return response.json();
    })
    .then((flights) => {
      flights.map((flight) => {
        let row = section.appendChild(DOM.div({ className: "row top-10" }));

        row.appendChild(DOM.div({ className: "col-sm-1" }, flight.code));
        row.appendChild(DOM.div({ className: "col-sm-1" }, flight.from));
        row.appendChild(DOM.div({ className: "col-sm-1" }, flight.to));
        row.appendChild(
          DOM.div(
            { className: "col-sm-4" },
            new Date(flight.timestamp).toUTCString()
          )
        );
        //row.appendChild(DOM.div({ className: 'col-sm-2, key' }, flight.key))
        row.appendChild(
          DOM.div(
            {
              className: "btn btn-primary padding-10 ",
              id: "buy-" + flight.key,
            },
            "Buy Insurance"
          )
        );
        row.appendChild(
          DOM.div(
            {
              className: "btn btn-warning disabled-button",
              id: "claim-" + flight.key,
            },
            "Claim Insurance"
          )
        );
        section.appendChild(row);
      });
      flightsDiv.append(section);

      flights.map((flight) => {
        DOM.elid("buy-" + flight.key).addEventListener("click", () => {
          buyInsurance(app, flight.key);
        });
      });
    })
    .catch((error) => console.log(error));
}

function displayAccount(app) {
  let accountDiv = DOM.elid("account-wrapper");
  let section = DOM.section();

  let row = section.appendChild(DOM.div({ className: "row" }));
  row.appendChild(DOM.div({ className: "col-sm-5 field-header" }, "Address"));
  row.appendChild(DOM.div({ className: "col-sm-2 field-header" }, "Balance"));
  row.appendChild(DOM.div({ className: "col-sm-2 field-header" }, "Premium"));
  section.appendChild(row);

  app.web3.eth.getAccounts((error, accounts) => {
    let insuree = accounts[8];

    app
      .getInsuree(insuree)
      .then((response) => {
        return response.json();
      })
      .then((insuree) => {
        let balance =
          app.web3.utils.fromWei(insuree.balance.toString(), "ether") + " ETH";
        let premium =
          app.web3.utils.fromWei(insuree.premium.toString(), "ether") + " ETH";

        let row = section.appendChild(DOM.div({ className: "row" }));
        row.appendChild(DOM.div({ className: "col-sm-5" }, insuree.address));
        row.appendChild(
          DOM.div({ className: "col-sm-2", id: "acc-balance" }, balance)
        );
        row.appendChild(
          DOM.div({ className: "col-sm-2", id: "acc-premium" }, premium)
        );

        section.appendChild(row);

        accountDiv.append(section);
      })
      .catch((error) => console.log(error));
  });
}

function displayConsortium(app) {
  let consortiumDiv = DOM.elid("consortium-wrapper");
  let section = DOM.section();

  let row = section.appendChild(DOM.div({ className: "row" }));
  row.appendChild(DOM.div({ className: "col-sm-5 field-header" }, "Address"));
  row.appendChild(DOM.div({ className: "col-sm-2 field-header" }, "Balance"));
  row.appendChild(DOM.div({ className: "col-sm-2 field-header" }, "Escrow"));
  row.appendChild(DOM.div({ className: "col-sm-1 field-header" }, "Status"));
  section.appendChild(row);

  app
    .getConsortium()
    .then((response) => {
      return response.json();
    })
    .then((consortium) => {
      let balance =
        app.web3.utils.fromWei(consortium.balance.toString(), "ether") + " ETH";
      let escrow =
        app.web3.utils.fromWei(consortium.escrow.toString(), "ether") + " ETH";

      let status = "Operational";
      if (!consortium.isOperational) status = "Stopped";

      let row = section.appendChild(DOM.div({ className: "row" }));
      row.appendChild(DOM.div({ className: "col-sm-5" }, consortium.address));

      row.appendChild(
        DOM.div({ className: "col-sm-2", id: "consortium-balance" }, balance)
      );
      row.appendChild(
        DOM.div({ className: "col-sm-2", id: "consortium-escrow" }, escrow)
      );
      row.appendChild(
        DOM.div({ className: "col-sm-1", id: "consortium-status" }, status)
      );

      section.appendChild(row);

      consortiumDiv.append(section);
    })
    .catch((error) => console.log(error));
}

function updateAccount(app) {
  let insuree = app.getDefaultInsureeAddress();

  app
    .getInsuree(insuree)
    .then((response) => {
      return response.json();
    })
    .then((insuree) => {
      let balance =
        app.web3.utils.fromWei(insuree.balance.toString(), "ether") + " ETH";
      let premium =
        app.web3.utils.fromWei(insuree.premium.toString(), "ether") + " ETH";

      console.log("Update Account:");
      console.log("\tbalance:" + balance);
      console.log("\tpremium:" + premium);

      DOM.elid("acc-balance").innerText = balance;
      DOM.elid("acc-premium").innerText = premium;
      //notify('Your account has been updated')
    })
    .catch((error) => console.log(error));
}

function updateConsortium(app) {
  app
    .getConsortium()
    .then((response) => {
      return response.json();
    })
    .then((consortium) => {
      let balance =
        app.web3.utils.fromWei(consortium.balance.toString(), "ether") + " ETH";
      let escrow =
        app.web3.utils.fromWei(consortium.escrow.toString(), "ether") + " ETH";

      let status = "Operational";
      if (!consortium.isOperational) status = "Stopped";

      console.log("Update Consortium:");
      console.log("\tbalance:" + balance);
      console.log("\tescrow:" + escrow);
      console.log("\tstatus:" + status);

      DOM.elid("consortium-status").innerText = status;
      DOM.elid("consortium-balance").innerText = balance;
      DOM.elid("consortium-escrow").innerText = escrow;

      //notify('Consortium Account has been updated')
    })
    .catch((error) => console.log(error));
}

function notify(msg, body) {
  var options = {
    body: body,
    tag: Date.now(),
  };

  if (Notification.permission === "granted") {
    var notification = new Notification(msg, options);
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        var notification = new Notification(msg, options);
      }
    });
  }
}
