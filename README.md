# Insurance Consortium

## Project Description

Decentralized application aimed at providing passengers' insurance. A consortium of airlines fund an insurance deposit and guarantee premiums, which are credited to insurees upon oracle consensus on flight status. Unreedemable insurances are credited to the shared consortium account.

### Security

- Access Control to voting rights, agreement on flight status and management of funds is implemented via consensus and trusted roles (affiliate, oracle and delegate roles).
- Stop-Loss is automatic once a drain of funds is detected, or upon consensus in form of operational status.
- Reentrancy checks in credit insurance functions.
- Escrow accounts and pull payments: the paying contract does not interact directly with the insuree account, which must withdraw the premium payments itself. Insurees can query their due premiums with a payments function, and retrieve them with a withdrawPayments function (see https://docs.openzeppelin.com/contracts/3.x/api/payment#PullPayment and https://consensys.github.io/smart-contract-best-practices/recommendations/#favor-pull-over-push-for-external-calls).

### Design and Upgradability

- ConsortiumAlliance module aims at providing a generic insurance data model and fine operations for implementing affiliate registrations, voting rights, custody and management of insurance deposits.

- ConsortiumSettings defines the project roles, consensus criteria and administrative fees of the project.

- FlightInsuranceHandler is concerned with the specific business logic of airlines', flights' and insurances registration. As a trusted delegate of the ConsortiumAlliance, it triggers the credit of insurance deposits and premiums upon Oracle consensus on flight status.

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

Launch Ganache with the same mnemonic and create 50 accounts

```
ganache-cli
```

Compile, test and migrate

```
truffle compile
truffle test
truffle migrate
```

Launch the DApp

```
npm run dapp
http://localhost:8000

```
