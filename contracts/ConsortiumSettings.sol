// SPDX-License-Identifier: MIT

pragma solidity 0.6.2;

contract ConsortiumSettings {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant CONSORTIUM_ROLE = keccak256("CONSORTIUM_ROLE");
    bytes32 public constant INSUREE_ROLE = keccak256("INSUREE_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint256 public constant CONSORTIUM_MEMBERSHIP_FEE = 10 ether;
    uint256 public constant CONSORTIUM_CONSENSUS = 50;
    uint256 public constant INSURANCE_MAX_FEE = 1 ether;
    uint256 public constant INSURANCE_PREMIUM_FACTOR = 150;

    uint256 public constant ORACLE_MEMBERSHIP_FEE = 1 ether;
    uint256 public constant ORACLE_CONSENSUS_RESPONSES = 3;

    constructor() public {}
}
