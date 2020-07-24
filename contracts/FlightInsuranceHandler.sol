// SPDX-License-Identifier: MIT

pragma solidity 0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/payment/PullPayment.sol";

import "./ConsortiumAlliance.sol";

contract FlightInsuranceHandler is Ownable, AccessControl, PullPayment {
    using SafeMath for uint256;
    ConsortiumAlliance consortium;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /*
    constructor(address _consortiumAlliance) public {
        consortium = ConsortiumAlliance(_consortiumAlliance);
    }*/
    constructor() public {
        _setupRole(ADMIN_ROLE, msg.sender);
    }
}