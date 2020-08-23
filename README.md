# Insurance Consortium

## Project Description

Decentralized application aimed at providing flight passengers' insurance. A consortium of airlines fund an insurance deposit and guarantee premiums. Insurance premiums are credited to insurees upon oracle consensus on flight status. Unreedemable insurance deposits are credited to the shared consortium account.

### Security

- Access Control to voting rights, agreement on flight status and management of funds is implemented via consensus and trusted roles (affiliate, oracle and delegate roles).
- Stop-Loss is automatic once a drain of funds is detected, or upon consensus in form of operational status.
- Reentrancy checks are implemented in credit insurance functions.
- Escrow accounts and pull payments: the paying contract does not interact directly with the insuree account, which must withdraw the premium payments itself. Insurees can query their due premiums with a payments function, and retrieve them with a withdrawPayments function (see https://docs.openzeppelin.com/contracts/3.x/api/payment#PullPayment and https://consensys.github.io/smart-contract-best-practices/recommendations/#favor-pull-over-push-for-external-calls).

### Design and Upgradability

- ConsortiumAlliance contract module aims at providing a generic insurance data model as well as fine operations for implementing affiliate registrations, voting rights, custody and management of insurance deposits.

- ConsortiumSettings defines the project roles, consensus criteria and administrative fees of the project.

- FlightInsuranceHandler is concerned with the specific business logic of airlines', flights' and insurances registration. As a trusted delegate of the ConsortiumAlliance, it triggers the credit of insurance deposits and premiums upon Oracle consensus on flight status.

- A Express.js server application provides a REST API to interact with the contracts. It allows withdraw of insurance premiums and registration of airlines, flights, oracles and insurances.

### Unit and system tests

- TestConsortiumWorkflow.js
- TestConsortiumConsensus.js
- TestConsortiumRequires.js
- TestconsortiumReentrancy.js

- TestFlightInsuranceHandler.js

### Dependencies

- Solidity v0.6.2 (solc-js)
- Node v12.17.0
- Web3.js v1.2.1

- Truffle v5.1.30 (core: 5.1.30) - Development framework
- @truffle/hdwallet-provider v1.0.36 - HD Wallet-enabled Web3 provider
- truffle-assertions v0.9.2 - Additional assertions for Truffle tests
- chai v4.2.0 - Assertion library

## Getting Started

Install dependencies

```
npm install
```

Define mnemonic in .secret file

```
.secret
truffle-config.js
```

Launch Ganache with the same mnemonic and define 50 accounts with 100 ETH each

```
ganache-cli -m <mnemonic> -a 50 -e 100
```

Compile, test and migrate

```
truffle compile
truffle test
truffle migrate --reset
```

Launch the Server (it registers founding airlines, flights and oracles)

```
npm run server

```

Launch the DApp

```
npm run dapp
http://localhost:8000

```

## Frontend

<p align="center"><img src="/doc/insurance_manager_frontend" /></p>
