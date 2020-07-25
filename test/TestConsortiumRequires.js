const ConsortiumAlliance = artifacts.require("ConsortiumAlliance");
const assert = require("chai").assert;
const truffleAssert = require("truffle-assertions");

contract("ConsortiumAlliance", function (accounts) {
  const OnlyAdmin = "Caller is not Admin";
  const OnlyApprovedAffiliate = "Caller is not an approved affiliate";
  const OnlyConsortiumAffiliate = "Caller is not a consortium Affiliate";
  const OnlyOperational = "Contract is currently not operational";

  const MEMBERSHIP_FEE = web3.utils.toWei("10", "ether");
  const INSURANCE_FEE = web3.utils.toWei("1", "ether");
  const FUNDING_VALUE = web3.utils.toWei("15", "ether");
  const INSURANCE_KEY = web3.utils.fromAscii("key");

  before("setup contract", async () => {
    admin = accounts[0];

    firstAffiliate = accounts[1];
    secondAffiliate = accounts[2];
    newAffiliate = accounts[3];

    nonAdmin = accounts[8];
    nonAffiliate = accounts[9];

    instance = await ConsortiumAlliance.deployed();

    await instance.createAffiliate(firstAffiliate, "firstAffiliate");
    await instance.createAffiliate(secondAffiliate, "secondAffiliate");

    await instance.depositMebership({
      from: firstAffiliate,
      value: MEMBERSHIP_FEE,
    });

    approvedAffiliate = accounts[1];
    consortiumAffiliate = accounts[1];
  });

  describe("Roles & Permissions", function () {
    describe("Admin Rights", function () {
      it(`lets revert create affiliate if non-admin`, async () => {
        await truffleAssert.reverts(
          instance.createAffiliate(firstAffiliate, "affiliate", {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin
        );
      });

      it(`lets revert deposit insurance if non-admin`, async () => {
        await truffleAssert.reverts(
          instance.depositInsurance({
            from: nonAdmin,
            value: INSURANCE_FEE,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin
        );
      });

      it(`lets revert credit insurance if non-admin`, async () => {
        await truffleAssert.reverts(
          instance.creditInsurance(INSURANCE_KEY, {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin
        );
      });

      it(`lets revert withdraw insurance if non-admin`, async () => {
        await truffleAssert.reverts(
          instance.withdrawInsurance(INSURANCE_KEY, {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin
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
          instance.depositInsurance({
            from: nonAdmin,
            value: INSURANCE_FEE,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin
        );
      });

      it(`lets be not Operational - Credit Insurance`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.creditInsurance(INSURANCE_KEY, {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin
        );
      });

      it(`lets be not Operational - Withdraw Insurance`, async function () {
        assert.isFalse(await instance.isOperational());

        await truffleAssert.reverts(
          instance.withdrawInsurance(INSURANCE_KEY, {
            from: nonAdmin,
            nonce: await web3.eth.getTransactionCount(nonAdmin),
          }),
          OnlyAdmin
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
