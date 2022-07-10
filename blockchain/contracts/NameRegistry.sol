//Contract based on [https://i6mi6.medium.com/solidty-smart-contracts-design-patterns-ecfa3b1e9784](https://i6mi6.medium.com/solidty-smart-contracts-design-patterns-ecfa3b1e9784)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NameRegistry {   
  struct ContractDetails {
    address owner;
    address contractAddress;
  }
  mapping(string => ContractDetails) registry;   
  function registerName(string memory name, address addr) public returns (bool) {
    ContractDetails memory info = registry[name];
    //require(info.owner == msg.sender);
    // create info if it doesn't exist in the registry       
    if (info.contractAddress == address(0)) {
      info = ContractDetails({
        owner: msg.sender,
        contractAddress: addr
      });
    } else {
      info.contractAddress = addr;
    }       
    // update record in the registry
    registry[name] = info;
    return true;   
  }
  function getContractDetails(string memory name) public view returns(address) 
  {
    return (registry[name].contractAddress);
  }
}