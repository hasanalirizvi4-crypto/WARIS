// Prints which account Hardhat will deploy from, and its balance, on the chosen network.
// It never prints the private key.
//
// Usage: npx hardhat run scripts/check-deployer.ts --network sepolia
import { network } from "hardhat";

const { ethers } = await network.create();
const [deployer] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();
const balance = await ethers.provider.getBalance(deployer.address);

console.log(`Chain ID: ${chainId}`);
console.log(`Deployer: ${deployer.address}`);
console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);

if (balance === 0n) {
  console.log("This account has 0 ETH on this network. Send it some test ETH before deploying.");
}
