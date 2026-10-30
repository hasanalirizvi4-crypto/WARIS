# WARIS frontend

The frontend uses ethers and discovers installed EIP-6963 browser wallets, with a legacy injected-wallet fallback. Users choose the wallet they want WARIS to use. Contract actions require a deployed `WarisEstate` address on Sepolia.

## The four creation steps

The **Setup steps** section tracks the estate creation flow live and fills each step with real on-chain data:

1. **Connect your wallet**: WARIS reads only the public address (and its Sepolia balance) from the selected wallet. The private key stays in the wallet.
2. **Choose an inactivity period**: the days entered are converted to seconds (`days × 86,400`), because the contract works with timestamps.
3. **The smart contract creates the estate record**: after confirmation, WARIS reads the owner, creation time (the first check-in) and stored period back from the contract.
4. **The wallet submits and confirms the transaction**: WARIS shows the transaction hash, block number, gas used and gas fee paid in Sepolia test ETH.

When the page is reloaded, the estate is found with `estateIdOf(wallet)`, and the creation transaction is found from the block number stored in the contract.

## Choose the network

`frontend/.env.local` decides which chain the frontend uses:

```dotenv
# "localhost" = local Hardhat node (chain ID 31337); "sepolia" = Ethereum Sepolia (default)
VITE_WARIS_NETWORK=localhost
VITE_WARIS_CONTRACT_ADDRESS=0xYourDeployedContractAddress
```

For local testing, `npx hardhat run scripts/deploy-local.ts --network localhost` (run from the repository root while `npx hardhat node` is running) writes this file for you. See the root README for the full local setup, including MetaMask.

## Run locally

```sh
npm install
npm run dev
```

## Connect to a Sepolia deployment

1. In the repository root, configure `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` with Hardhat's local keystore. These values belong on the deployer's machine; never put them in the frontend or share them in chat.

   ```sh
   npx hardhat keystore set SEPOLIA_RPC_URL
   npx hardhat keystore set SEPOLIA_PRIVATE_KEY
   ```

2. Fund the deployer wallet with Sepolia test ETH, then deploy from the repository root:

   ```sh
   npx hardhat ignition deploy ignition/modules/WarisEstate.ts --network sepolia
   ```

3. Copy the deployed `WarisEstateModule#WarisEstate` address from the output into `frontend/.env.local`:

   ```dotenv
   VITE_WARIS_NETWORK=sepolia
   VITE_WARIS_CONTRACT_ADDRESS=0xYourDeployedContractAddress
   ```

4. Restart the frontend, choose a wallet from the Connect wallet list, and use Ethereum Sepolia (chain ID `11155111`). The app requests account access from the selected wallet and asks that same wallet to switch networks when needed.

Only the contract address is public frontend configuration. The RPC URL and deployer private key must stay in the root Hardhat keystore or a local environment; never add either to a `VITE_` variable. The contract records estates, beneficiaries, check-ins and an owner-controlled ETH balance. It does not pay out inheritances, and local Hardhat data is separate from Sepolia.

If you change `contracts/WarisEstate.sol`, rebuild it and copy the new ABI into `src/contracts/WarisEstateABI.json`.
