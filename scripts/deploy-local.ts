// Deploys WarisEstate to the local Hardhat node and points the frontend at it.
//
// 1. In one terminal:  npx hardhat node
// 2. In another:       npx hardhat run scripts/deploy-local.ts --network localhost
//
// The script writes frontend/.env.local so the frontend uses the local chain.
import { network } from "hardhat";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL_CHAIN_ID = 31337n;
const ENV_MARKER = "# Written by scripts/deploy-local.ts";

const { ethers } = await network.create();
const { chainId } = await ethers.provider.getNetwork();

if (chainId !== LOCAL_CHAIN_ID) {
  throw new Error(
    `This script only deploys to the local Hardhat node (chain ID ${LOCAL_CHAIN_ID}), ` +
      `but the connected chain ID is ${chainId}. Run: npx hardhat run scripts/deploy-local.ts --network localhost`
  );
}

const [deployer] = await ethers.getSigners();
console.log(`Deploying WarisEstate from ${deployer.address} to Hardhat Local (chain ID ${chainId})…`);

const waris = await ethers.deployContract("WarisEstate");
await waris.waitForDeployment();
const address = await waris.getAddress();
const receipt = await waris.deploymentTransaction()?.wait();

console.log(`WarisEstate deployed at ${address}`);
if (receipt) {
  console.log(`  block #${receipt.blockNumber}, gas used ${receipt.gasUsed.toString()}`);
}

// Point the frontend at the local deployment.
const envPath = path.join(import.meta.dirname, "..", "frontend", ".env.local");
const backupPath = `${envPath}.backup`;

let existing = "";
try {
  existing = await readFile(envPath, "utf8");
} catch {
  // No .env.local yet.
}

if (existing && !existing.startsWith(ENV_MARKER)) {
  // Keep a copy of a hand-written file (for example a Sepolia address).
  await copyFile(envPath, backupPath);
  console.log(`Saved your previous frontend/.env.local as frontend/.env.local.backup`);
}

await writeFile(
  envPath,
  [
    `${ENV_MARKER} for the local Hardhat chain (chain ID 31337).`,
    "# For Sepolia, set VITE_WARIS_NETWORK=sepolia and use the Sepolia contract address.",
    "VITE_WARIS_NETWORK=localhost",
    `VITE_WARIS_CONTRACT_ADDRESS=${address}`,
    "",
  ].join("\n")
);

console.log("Updated frontend/.env.local:");
console.log("  VITE_WARIS_NETWORK=localhost");
console.log(`  VITE_WARIS_CONTRACT_ADDRESS=${address}`);
console.log("Restart the frontend (npm run dev in the frontend folder) to pick up the new address.");
