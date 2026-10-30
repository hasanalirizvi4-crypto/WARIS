# WARIS

WARIS is a blockchain based estate planning prototype. The frontend discovers installed browser wallets and lets the user choose which one to connect; the Hardhat project contains the `WarisEstate` contract and an Ignition deployment module.

## What the contract does

`contracts/WarisEstate.sol` is written for Ethereum Sepolia:

- **One estate per wallet.** `createEstate(inactivityPeriod)` saves the caller as the owner, records the creation time as the first check-in, and stores the inactivity period in seconds (1 day to 3650 days). `estateIdOf(wallet)` finds a wallet's estate.
- **Beneficiaries.** The owner can add up to 20 beneficiary wallets with whole-number percentage shares (total at most 100%) and remove them again.
- **Check-ins.** `checkIn` updates the last check-in time. `checkInDeadline` and `isInactive` show when the owner has missed the deadline. `updateInactivityPeriod` changes the period.
- **ETH balance.** The owner can deposit ETH into the estate and withdraw it again, so test ETH is never locked in the contract.

The contract records the plan only. It does **not** pay out inheritances to beneficiaries.

## Run everything locally (Hardhat chain + website)

Use three terminals, all opened in the repository root.

1. **Start the local blockchain** and leave it running. It prints 20 funded test accounts with their private keys (chain ID `31337`, RPC `http://127.0.0.1:8545`).

   ```sh
   npx hardhat node
   ```

2. **Deploy the contract to it.** This also writes `frontend/.env.local` with `VITE_WARIS_NETWORK=localhost` and the contract address.

   ```sh
   npx hardhat run scripts/deploy-local.ts --network localhost
   ```

3. **Start the website**, then open the address Vite prints (usually http://localhost:5173):

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

4. **Set up MetaMask for the local chain:** add a network named *Hardhat Local* with RPC URL `http://127.0.0.1:8545`, chain ID `31337` and currency symbol `ETH`. Then import *Account #0* from the `npx hardhat node` output with "Import account" → private key. These keys are public test keys, so never send real funds to them.

Every time you restart `npx hardhat node`, the chain starts empty again. Re-run step 2, restart the website, and in MetaMask use *Settings → Advanced → Clear activity tab data* so it forgets the old nonces.

Shortcuts: `npm run chain`, `npm run deploy:local`, `npm test` and `npm run deploy:sepolia` run the same commands.

## Tests

```sh
npx hardhat test
```

The suite covers the full creation flow (wallet → days converted to seconds → estate record → confirmed transaction and gas paid), plus beneficiaries, check-ins, period updates, deposits and withdrawals.

## Deploy to Sepolia

Sepolia is Ethereum's application development test network. Its chain ID is `11155111`; test ETH is for testing and has no real-world value.

1. Configure `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` in the local Hardhat keystore. The RPC URL may contain a provider API token, and the private key controls the deployer wallet. Never put these values in frontend files, commit them, or send them in chat. The first time, Hardhat asks you to create a keystore password.

   ```sh
   npx hardhat keystore set SEPOLIA_RPC_URL
   npx hardhat keystore set SEPOLIA_PRIVATE_KEY
   ```

2. Fund the deployer with Sepolia test ETH, then deploy the WARIS contract from the repository root:

   ```sh
   npx hardhat ignition deploy ignition/modules/WarisEstate.ts --network sepolia
   ```

3. Copy the `WarisEstateModule#WarisEstate` address from the deployment output (it is also saved in `ignition/deployments/chain-11155111/deployed_addresses.json`) into `frontend/.env.local`:

   ```dotenv
   VITE_WARIS_NETWORK=sepolia
   VITE_WARIS_CONTRACT_ADDRESS=0xYourDeployedContractAddress
   ```

4. Restart the frontend, select a detected wallet from the Connect wallet list, then use Ethereum Sepolia. The app requests account access and any network switch from the wallet the user selected.

Only the deployed contract address belongs in `VITE_WARIS_CONTRACT_ADDRESS`; all `VITE_` values are public in the built frontend. Local Hardhat state does not migrate to Sepolia; deployment starts with a fresh contract.
