const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", function (accounts) {
  const OnlyAdmin = "Caller is not Admin";
  const OnlyDelegate = "Caller is not Delegate";
  const OnlyApprovedAffiliate = "Caller is not an approved affiliate";
  const OnlyConsortiumAffiliate = "Caller is not a consortium Affiliate";
  const OnlyOperational = "Contract is currently not operational";

  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");
  const FUNDING_VALUE = web3.utils.toWei("5", "ether");
  const INSURANCE_KEY = web3.utils.fromAscii("key");

  before("setup contract", async () => {
    admin = accounts[0];
    delegate = accounts[1];

    firstAffiliate = accounts[2];
    approvedAffiliate = accounts[2];
    consortiumAffiliate = accounts[2];
    secondAffiliate = accounts[3];
    newAffiliate = accounts[4];
    insuree = accounts[5];

    nonDelegate = accounts[7];
    nonAdmin = accounts[8];
    nonAffiliate = accounts[9];

    instance = await ConsortiumAlliance.deployed();

    await instance.addDelegateRole(delegate, {
      from: admin,
    });

    await instance.createAffiliate(firstAffiliate, "firstAffiliate");
    await instance.createAffiliate(secondAffiliate, "secondAffiliate");

    await instance.depositMebership({
      from: firstAffiliate,
      value: MEMBERSHIP_FEE,
    });
  });

  describe("Roles & Permissions", function () {
    describe("Admin & Delegate Rights", function () {
      it(`lets revert create affiliate if non-admin`, async () => {
        await truffleAssert.reverts(
          instance.createAffiliate(firstAffiliate, "affiliate", {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin
        );
      });

      it(`lets revert deposit insurance if non-delegate`, async () => {
        await truffleAssert.reverts(
          instance.depositInsurance(insuree, {
            from: nonDelegate,
            value: INSURANCE_FEE,
            nonce: await web3.eth.getTransactionCount(nonDelegate),
          }),
          OnlyDelegate
        );
      });

      it(`lets revert credit insuree if non-delegate`, async () => {
        await truffleAssert.reverts(
          instance.creditInsuree(INSURANCE_KEY, {
            from: nonDelegate,
            nonce: await web3.eth.getTransactionCount(nonDelegate),
          }),
          OnlyDelegate
        );
      });

      it(`lets revert credit consortium if non-delegate`, async () => {
        await truffleAssert.reverts(
          instance.creditConsortium(INSURANCE_KEY, {
            from: nonDelegate,
            nonce: await web3.eth.getTransactionCount(nonDelegate),
          }),
          OnlyDelegate
        );
      });
    });

    describe("Consortium Rights", function () {
      it(`lets revert suspendService() if non-consortium`, async () => {
        let instance = await ConsortiumAlliance.deployed();

        await truffleAssert.reverts(
          instance.suspendService({
            from: nonAffiliate,
            nonce: await web3.eth.getTransactionCount(nonAffiliate),
          }),
          OnlyConsortiumAffiliate
        );
      });

      it(`lets revert resumeService() if non-consortium`, async () => {
        let instance = await ConsortiumAlliance.deployed();

        await truffleAssert.reverts(
          instance.resumeService({
            from: nonAffiliate,
            nonce: await web3.eth.getTransactionCount(nonAffiliate),
          }),
          OnlyConsortiumAffiliate
        );
      });
    });

    describe("Operational Status", function () {
      it(`lets suspend service`, async function () {
        await instance.suspendService({ from: firstAffiliate });
        assert.isFalse(await instance.isOperational());
      });

      it(`lets be not Operational - Create Affiliate`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.createAffiliate(newAffiliate, "newAffiliate", {
            from: admin,
            nonce: await web3.eth.getTransactionCount(admin),
          }),
          OnlyOperational
        );
      });

      it(`lets be not Operational - Approve Affiliate`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.approveAffiliate(newAffiliate, {
            from: firstAffiliate,
            nonce: await web3.eth.getTransactionCount(firstAffiliate),
          }),
          OnlyOperational
        );
      });

      it(`lets be not Operational - Membership Fee`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.depositMebership({
            from: secondAffiliate,
            value: MEMBERSHIP_FEE,
            nonce: await web3.eth.getTransactionCount(secondAffiliate),
          }),
          OnlyOperational
        );
      });

      it(`lets be not Operational - Funding`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.fundConsortium({
            from: consortiumAffiliate,
            value: INSURANCE_FEE,
            nonce: await web3.eth.getTransactionCount(consortiumAffiliate),
          }),
          OnlyOperational
        );
      });

      it(`lets be not Operational - Deposit Insurance`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.depositInsurance(insuree, {
            from: delegate,
            value: INSURANCE_FEE,
            nonce: await web3.eth.getTransactionCount(delegate),
          }),
          OnlyOperational
        );
      });

      it(`lets be not Operational - Credit Insuree`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.creditInsuree(INSURANCE_KEY, {
            from: delegate,
            nonce: await web3.eth.getTransactionCount(delegate),
          }),
          OnlyOperational
        );
      });

      it(`lets be not Operational - Credit Consortium`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.creditConsortium(INSURANCE_KEY, {
            from: delegate,
            nonce: await web3.eth.getTransactionCount(delegate),
          }),
          OnlyOperational
        );
      });

      it(`lets resume service`, async function () {
        assert.isFalse(await instance.isOperational());

        await instance.resumeService({
          from: firstAffiliate,
          nonce: await web3.eth.getTransactionCount(firstAffiliate),
        });
        assert.isTrue(await instance.isOperational());
      });
    });
  });
});
