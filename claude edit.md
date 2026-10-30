# Claude edit log — WARIS repo

This file records every change Claude makes in this repository: **what** changed, **why**, and **when**.
Times are Pakistan Standard Time (PKT, UTC+05:00). Nothing in this log has been committed or pushed unless an entry says so.

---

## 2026-10-27 13:40 PKT — Repo scan (no changes)
- **What:** Read the whole repo (contract, tests, Hardhat config, Ignition module, frontend) and compared it with Hasan's `Initial commit` (`2c62162`).
- **Why:** To understand the project before changing anything.
- **Result:** No files changed. GitHub `main` is still at `2c62162`, so the local copy is up to date with the remote.

## 2026-10-27 13:50 PKT — Goal for this round
Replace the smart contract with one designed for Ethereum Sepolia and make these 4 steps work end to end:
1. Connect a wallet (public address only; the private key stays in the wallet)
2. Choose an inactivity period in days (converted to seconds for the contract)
3. The contract creates the estate record (owner, creation time as the last check-in, inactivity period)
4. The wallet submits the transaction, gas is paid in Sepolia test ETH, and a block confirms it

## 2026-10-27 13:56 PKT — Created this log file
- **What:** Added `claude edit.md` to the repo root.
- **Why:** Aliyan asked for a running log of every change, the reason for it, and a timestamp.

## 2026-10-27 14:00 PKT — `contracts/WarisEstate.sol` (rewritten)
- **What changed:**
  - **One estate per wallet**, with a new public lookup `estateIdOf(wallet)`.
  - The estate now stores `createdAt` and `createdAtBlock` as well as owner, `lastCheckIn` and `inactivityPeriod`. `lastCheckIn` starts at the creation time.
  - The inactivity period must be from **1 day to 3650 days** (it was minimum only).
  - Beneficiaries: duplicate checks use a mapping instead of a loop, there is a **limit of 20**, and the total share is tracked in `allocatedShares`. New `removeBeneficiary`. The contract's own address is rejected as a beneficiary.
  - New `updateInactivityPeriod`, `checkInDeadline` and `getBeneficiaries` (all beneficiaries in one call).
  - New **`withdrawFromEstate`** for the owner, using the checks-effects-interactions order.
  - `getEstate` returns 8 values (owner, createdAt, createdAtBlock, lastCheckIn, inactivityPeriod, beneficiaryCount, allocatedShares, balance).
  - New events: `BeneficiaryRemoved`, `InactivityPeriodUpdated` and `WithdrawalMade`. `EstateCreated` now includes `createdAt`, and `CheckIn` includes the next deadline.
- **Why:**
  - The old frontend found your estate by guessing "the latest estate id". On a shared Sepolia contract, anyone creating an estate after you broke that. `estateIdOf` fixes it.
  - In the old contract, deposited ETH could never come out (there was no withdraw).
  - `createdAtBlock` lets the frontend find the creation transaction later (hash, gas, fee) by searching a single block, which every RPC supports.
  - The upper limits keep gas costs predictable.
- **Not included (on purpose):** inheritance payouts or claims by beneficiaries. The contract records the plan only.

## 2026-10-27 14:02 PKT — `test/WarisEstate.ts` (rewritten)
- **What:** 31 TypeScript tests, including one test that walks the full 4-step flow (address → 30 days = 2,592,000 s → estate record read back → receipt confirmed and the gas fee taken from the balance). Also covers every rule in the contract (periods, one estate per wallet, beneficiaries add/remove/limits, check-ins and inactivity, period updates, deposits and withdrawals, plain ETH rejected).
- **Why:** The old tests matched the old contract; the new contract needs full coverage before a public deployment.
- **Result:** All 34 tests pass (3 Solidity + 31 TypeScript). Line and statement coverage of `WarisEstate.sol` is 100%.

## 2026-10-27 14:02 PKT — `hardhat.config.ts`
- **What:** Pinned `evmVersion: "prague"` in both build profiles.
- **Why:** Solidity 0.8.34 targets the newest EVM ("osaka") by default. Prague is live on Sepolia and mainnet, so pinning it makes the bytecode behave the same locally and on Sepolia.

## 2026-10-27 14:02 PKT — `tsconfig.json`
- **What:** Added `test/**/*.ts` and `types/**/*.ts` to `include`.
- **Why:** The tests were not being type-checked by `npx tsc --noEmit`. Now they are, as the project's Hardhat guide recommends.

## 2026-10-27 14:05 PKT — `frontend/src/contracts/WarisEstateABI.json`
- **What:** Regenerated from the new compiled contract.
- **Why:** The frontend must use the ABI of the contract that will be deployed.

## 2026-10-27 14:05 PKT — `frontend/src/walletErrors.ts` (new)
- **What:** Turns wallet and contract errors into short messages, for example "You rejected the request in MetaMask", "not enough Sepolia ETH for gas", and plain-English versions of every contract revert reason.
- **Why:** ethers' raw error messages are long and technical.

## 2026-10-27 14:05 PKT — `frontend/src/warisConfig.ts`
- **What:** Added the Sepolia currency symbol, "add network" parameters, and day and beneficiary limits that match the contract.
- **Why:** These are used by the switch-network fallback and by form validation.

## 2026-10-27 14:08 PKT — `frontend/src/App.tsx` (reworked)
- **What:**
  - New **"Setup steps"** section showing the 4 steps live: Next, In progress, Done. Each step is filled with real data: wallet name, address and balance; days and seconds; the stored owner, creation time and period; the transaction hash, block, gas used and gas fee.
  - The estate is loaded with `estateIdOf(address)`, and reloads when the account or network changes.
  - The new estate id is read from the transaction receipt. The record is read back from the chain after confirmation, retrying briefly if the wallet's node is a block behind.
  - After a page reload, step 4 still finds the creation transaction using `createdAtBlock`.
  - "Switch to Sepolia" falls back to "add network" if the wallet doesn't know Sepolia.
  - Warns when the wallet has 0 SepoliaETH.
  - Owner tools: update the check-in period, remove beneficiaries, live check-in deadline (Active or Overdue), and refresh from the blockchain.
  - All "MetaMask" text now uses the name of the wallet the user picked.
  - Over-allocation and invalid input are blocked before the wallet opens.
- **Why:** To make the 4 steps visible and reliable on Sepolia, and to match the new contract.

## 2026-10-27 14:08 PKT — `frontend/src/App.css`
- **What:** Styles for the step cards (status colours, facts list, spinner), success and error status tones, estate facts, the remove button and the overdue state. Responsive: 4 → 2 → 1 columns.
- **Why:** Needed for the new UI, in the existing cream, navy, coral and lime design.

## 2026-10-27 14:10 PKT — `README.md` and `frontend/README.md`
- **What:** Described the new contract features and the 4-step flow, plus where Ignition saves the Sepolia address (`ignition/deployments/chain-11155111/deployed_addresses.json`).
- **Why:** The old text described the previous contract.

## 2026-10-27 14:18 PKT — `frontend/src/App.css`: click bug fixed
- **What:** `.depth-surface` now uses `transform-style: flat`. Only `.vault-scene` (the decorative card) keeps `preserve-3d`.
- **Why:** The browser test found a **real bug from the earlier UI work**. Because the tilt effect used `preserve-3d` on panels that contain buttons, clicks after the first one landed on the wrong element. For example, clicking 60, then 90, then 180 left the period stuck on 60, and the "Create estate record" click could be lost. With `flat`, every click works and the tilt still looks the same.

## 2026-10-27 14:20 PKT — `frontend/src/App.tsx`: wording
- **What:** Step 4 now reads "paid a gas fee of X SepoliaETH (Sepolia test ETH)".
- **Why:** The old wording said "SepoliaETH in Sepolia test ETH", which repeated itself.

## 2026-10-27 14:21 PKT — Verification (no file changes)
- **Contract:** 34/34 tests pass. `WarisEstate.sol` has 100% line coverage. Deployed bytecode is 5.9 KB (the limit is 24 KB).
- **Ignition:** `ignition/modules/WarisEstate.ts` deployed successfully to a local chain that uses Sepolia's chain ID (11155111). This is the same module that will be used for Sepolia.
- **Browser (Playwright, simulated MetaMask, local chain):** all 40 checks pass:
  - Connect, then a wrong network is detected, then the switch to Sepolia works.
  - 30 days shows as 2,592,000 s.
  - Rejecting in the wallet shows a clear message and writes nothing.
  - Create: step 4 "waiting for approval", then all 4 steps done. Owner, period and creation time are correct on-chain, and gas was paid.
  - Add and remove a beneficiary. Over-allocation is blocked. Check-in and the period update work.
  - After a reload, all data, including the creation transaction, is read back from the chain.
  - Switching accounts resets the view.
  - No horizontal overflow at 390 px. No console errors.
- **Frontend:** `tsc -b`, ESLint and `vite build` all pass.
- **Note:** these tests ran in Claude's cloud workspace using a container-only Hardhat config (`hardhat.ci.config.ts`, with the npm `solc` 0.8.34 compiler). That file was **not** copied into this repo, and the repo's own `hardhat.config.ts` is unchanged apart from the EVM version pin above.

## 2026-10-27 14:22 PKT — Files copied into this repo (not committed)
`contracts/WarisEstate.sol`, `test/WarisEstate.ts`, `hardhat.config.ts`, `tsconfig.json`, `README.md`, `frontend/README.md`, `frontend/src/App.tsx`, `frontend/src/App.css`, `frontend/src/walletErrors.ts` (new), `frontend/src/warisConfig.ts`, `frontend/src/contracts/WarisEstateABI.json`, and this log.

---

## 2026-10-27 14:27 PKT — Request: run it on localhost
Aliyan asked to run WARIS locally (a local Hardhat chain plus the website at localhost) before going to Sepolia.

## 2026-10-27 14:28 PKT — `frontend/src/warisConfig.ts`: network switch
- **What:** New setting `VITE_WARIS_NETWORK` in `frontend/.env.local`:
  - `sepolia` (default): chain ID 11155111, Etherscan links, SepoliaETH
  - `localhost`: chain ID 31337, RPC `http://127.0.0.1:8545`, no block explorer, ETH, "local test ETH"
  - The chain ID, names, currency, explorer and "add network" parameters all come from this one place.
- **Why:** The app only accepted Sepolia's chain ID, so it could not talk to a local Hardhat node (chain ID 31337).

## 2026-10-27 14:28 PKT — `frontend/src/App.tsx` and `frontend/src/walletErrors.ts`
- **What:**
  - Every "Sepolia" label, button ("Switch to …"), badge, note and gas message now follows the selected network.
  - Explorer links become plain text on the local chain, which has no explorer.
  - Local-only help: how to deploy if the contract is missing, a note that a restarted node resets the chain, and how to import a funded test account when the balance is 0.
  - Hardhat's "doesn't have enough funds" error is now recognised.
  - A notice appears if `VITE_WARIS_NETWORK` has an unknown value.
  - Renamed internals `isSepolia` → `isOnWarisNetwork` and `switchToSepolia` → `switchNetwork`.
- **Why:** So the same app works on both networks with correct wording, for example "paid a gas fee of … ETH (local test ETH)".

## 2026-10-27 14:29 PKT — `frontend/src/App.css`
- **What:** Plain-text style for explorer values on the local chain, and wrapping for `code` inside notes.
- **Why:** Local values have no link, so they shouldn't look like links.

## 2026-10-27 14:29 PKT — `scripts/deploy-local.ts` (new)
- **What:** `npx hardhat run scripts/deploy-local.ts --network localhost` deploys `WarisEstate` to the running local node and writes `frontend/.env.local` with `VITE_WARIS_NETWORK=localhost` and the new address. It refuses to run on any chain other than 31337. If you had a hand-written `.env.local`, it is saved first as `.env.local.backup` (which is git-ignored).
- **Why:** A local node starts empty every time, so Ignition's saved deployment record for chain 31337 goes stale and needs `--reset`. A plain deploy script avoids that, and it also fills in the frontend config for you. The existing `ignition/deployments/chain-31337` folder from the original repo is left untouched.

## 2026-10-27 14:30 PKT — `package.json` (root)
- **What:** Added shortcut scripts: `npm test`, `npm run chain`, `npm run deploy:local`, `npm run deploy:sepolia`.
- **Why:** Shorter commands to type. They run exactly the same Hardhat commands.

## 2026-10-27 14:30 PKT — `frontend/.env.example`
- **What:** Documents `VITE_WARIS_NETWORK` next to `VITE_WARIS_CONTRACT_ADDRESS`.
- **Why:** So anyone setting up the frontend knows about the new setting.

## 2026-10-27 14:31 PKT — `README.md` and `frontend/README.md`
- **What:** New "Run everything locally" guide: 3 terminals, plus MetaMask "Hardhat Local" network and test-account import, the restart and nonce tip, and the shortcuts. The Sepolia steps now include `VITE_WARIS_NETWORK=sepolia`.
- **Why:** Documents the new local workflow.

## 2026-10-27 14:32 PKT — Verification (no file changes)
- **Local chain (chain ID 31337):** `deploy-local.ts` deployed the contract and wrote `.env.local` correctly. The full browser test passed **40/40** in local mode (connect, network switch, 30 days = 2,592,000 s, reject, create, all 4 steps done, beneficiaries, check-in, period update, reload, account switch, mobile, no console errors).
- **Sepolia mode:** a build with `VITE_WARIS_NETWORK=sepolia` still shows Ethereum Sepolia · 11155111 everywhere.
- **Checks:** root `tsc` (which now includes `scripts/deploy-local.ts`), frontend `tsc -b`, ESLint and `vite build` all pass.

## 2026-10-27 15:42 PKT — `scripts/check-deployer.ts` (new)
- **What:** `npx hardhat run scripts/check-deployer.ts --network sepolia` prints the chain ID, the deployer address that the keystore key controls, and its balance. It never prints the key.
- **Why:** The first Sepolia deploy failed with "gas required exceeds allowance (0)", which means the deploying account had 0 ETH. The likely cause was that the stored key belongs to a different address than the one that was funded. `hardhat console` cannot read keystore secrets yet, so a `hardhat run` script is used for the check instead.

## 2026-10-27 15:49 PKT — Deployed to Ethereum Sepolia
- **What:** Aliyan ran `npx hardhat ignition deploy ignition/modules/WarisEstate.ts --network sepolia` from deployer `0x24d6f7409008cE45421A6D5843a4CE275583d261`.
- **Contract:** `0x1D284A5A26bFdC19603b3cCa31FC7E5c7d71ECA0` (creation transaction `0x92117734395991e4f2c53469d508e89c12a725c1ca7f9e47b1f3a8f78a1dac40`), confirmed on Sepolia Etherscan. The source is not verified on Etherscan yet.
- **Saved by Ignition:** `ignition/deployments/chain-11155111/` (new folder, not committed).
- **Note:** the first attempt failed with "gas required exceeds allowance (0)" because the keystore key belonged to `0x24d6…` while ETH had been sent to `0x232b…`. After `0x24d6…` was funded, the second attempt succeeded.

## 2026-10-27 15:50 PKT — `frontend/.env.local` switched to Sepolia (git-ignored, not committed)
- **What:** `VITE_WARIS_NETWORK=sepolia` and `VITE_WARIS_CONTRACT_ADDRESS=0x1D284A5A26bFdC19603b3cCa31FC7E5c7d71ECA0`. The previous local Hardhat settings were saved as `frontend/.env.local.localhost`.
- **Why:** So the website uses the new Sepolia contract with Phantom.

## 2026-10-27 15:58 PKT — `frontend/src/App.tsx` and `frontend/src/App.css`: address button and disconnect
- **What:**
  - Once a wallet is connected, the top-right button shows the short address (for example `0x9cb5…f6eC`) with a green dot, or a coral dot on the wrong network. On hover or keyboard focus it turns coral and reads **Disconnect**; both labels share one grid cell, so the button width doesn't jump.
  - Clicking it disconnects: WARIS forgets the wallet, address, network and loaded estate, and asks the wallet to drop its permission (`wallet_revokePermissions`). Wallets that don't support that just ignore the request.
  - The wallet list can now be closed (×, Escape or clicking outside) **while a connection request is still pending**. A late answer from a cancelled request is ignored. While waiting, it shows: "If no window opened, click its icon in your browser toolbar: the request may be waiting there."
  - The old "Change wallet" label is gone: disconnect, then connect again to switch wallets.
- **Why:** Aliyan asked for the address-and-disconnect button. Phantom often keeps the connection request inside the extension instead of opening a window, and the old wallet list then stayed on "Connecting…" with no way out.
- **Verified:** a new browser test passed 15/15 (stuck request → hint → cancel → reconnect; address label; hover shows "Disconnect" with no width change; click disconnects and revokes; reconnect). The full 4-step test still passes 40/40. `tsc -b` and ESLint pass.

## 2026-10-30 13:00 PKT: Full UI/UX redesign, a 3D vault (frontend only)
- **What changed overall:** the website was rebuilt around one idea: **your estate is a vault**. A real-time 3D vault (Three.js) is the centre of the page, and every action on the blockchain moves it.
  - Turning the dial picks the check-in period.
  - Creating the estate opens the door and stamps a coral wax seal.
  - Each heir appears as a medallion fed by a ribbon of light.
  - Checking in sends a heartbeat pulse around the ring.
- **Same logo, same colours** (night blue, paper, coral, lime), now used as a proper design system. The smart contract, the ABI, `warisConfig.ts`, `walletDiscovery.ts`, `walletErrors.ts` and `.env.local` were **not** changed.
- **Why:** Aliyan asked for a complete restructure with 3D effects and a real "wow" factor, keeping the logo and theme, and left the design decisions to Claude.

## 2026-10-30 13:00 PKT: `frontend/package.json` and `frontend/package-lock.json`
- **Added:** `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing` (3D, lighting, bloom glow) and `@types/three`.
- **Added fonts** (bundled locally, no Google Fonts request): `@fontsource-variable/bricolage-grotesque` (headings), `@fontsource-variable/geist` (interface text) and `@fontsource/noto-nastaliq-urdu` (the وارث engraving on the vault).
- **Why:** the 3D vault and the new typography need them. **Run `npm install` in `frontend` once** after pulling these files.

## 2026-10-30 13:00 PKT: `frontend/src/App.tsx` (rewritten) and `frontend/src/main.tsx`
- **What:** `App.tsx` is now small. Before a wallet connects it shows the **landing page**; after connecting it shows the **workspace** (a paper panel on the left, the vault on the right). It also turns the app state into what the vault shows: door open or shut, seal, dial position, heirs, coins and the heartbeat.
- `main.tsx` now loads the local fonts.
- **Why:** the old `App.tsx` was one 1,846-line file. The wallet and contract logic was moved out unchanged (next entry), so the screens are easier to read and change.

## 2026-10-30 13:00 PKT: `frontend/src/hooks/useWaris.ts` and `useMediaQuery.ts` (new)
- **What:** `useWaris.ts` holds all of the wallet, network, estate and transaction logic that used to be inside `App.tsx`, with the same behaviour and the same messages.
  - It adds 3 small values for the animations: `sealKey` (goes up when an estate is created), `pulseKey` (goes up when a check-in confirms) and `heartbeatFraction` (how much of the check-in period is left).
  - `useMediaQuery.ts` tells the page when it is on a phone-sized screen.
- **Why:** to keep logic and design separate, so the redesign could not break the 4 steps.

## 2026-10-30 13:00 PKT: `frontend/src/lib/` (new: `types.ts`, `format.ts`, `chain.ts`)
- **What:** shared types, the number/date/address formatters, and the helpers that find the estate's creation transaction, all moved out of the old `App.tsx` without changes.
- **Why:** several components now use them.

## 2026-10-30 13:00 PKT: `frontend/src/components/` (new)
- **`TopBar.tsx`:** logo, network pill, and the address/Disconnect button (same behaviour as before).
- **`WalletPicker.tsx`:** the wallet list, restyled with a drop-in animation. Behaviour is unchanged: it can be cancelled while waiting and shows the Phantom hint.
- **`Landing.tsx`:** hero line "Your crypto shouldn't die with your keys." followed by three scroll scenes. As you scroll, the vault demonstrates each one: set your heartbeat, name your heirs, check in.
- **`Workspace.tsx`:** the connected panel with three tabs.
  - **Setup:** the 4 steps plus the period picker.
  - **Heirs:** the share meter, the add-heir form and the heir list.
  - **Check-in:** a big days-left counter and the Check in button.
  - Returning owners open on Check-in; right after creating an estate it stays on Setup, so all 4 steps can be seen ticking to Done.
- **`SetupSteps.tsx`:** the 4 steps as a vertical rail, with the **exact same step texts** as before.
- **`ExplorerLink.tsx`:** Etherscan links.

## 2026-10-30 13:00 PKT: `frontend/src/components/stage/` (new, the 3D vault)
- **`Vault.tsx`:** the vault body.
  - A guilloché pattern on the door draws itself in.
  - The combination dial can be **dragged** to choose 30/60/90/180 days; the panel follows.
  - Bolts retract before the door swings open.
  - The coral wax seal is stamped on creation.
  - The ring glows lime as the heartbeat and pulses on every confirmed check-in.
- **`Coins.tsx`:** the wallet's ETH shown as a coin stack inside the open vault, with a label.
- **`Heirs.tsx`:** one medallion per heir showing its %, linked to the vault by a flowing coral ribbon (thicker for a bigger share).
- **`VaultScene.tsx`:** camera framing, studio lighting (no network downloads), a reflective floor on fast computers, bloom glow, and gentle mouse parallax. The vault can be turned by dragging it.
- **`Stage.tsx`:** loads the 3D scene lazily. If WebGL is unavailable it shows a still poster instead of breaking the page.
- **`Dust.tsx`, `textures.ts`, `stageTypes.ts`:** floating dust, the drawn textures (dial face, وارث plaque, coin faces, medallions, seal) and shared types.
- **Performance and accessibility:**
  - Quality drops automatically on slow devices.
  - "Reduce motion" in the operating system turns the animations off.
  - On phones the vault sits in a band above the panel and the floating labels are hidden.

## 2026-10-30 13:00 PKT: `frontend/src/index.css` and `frontend/src/App.css` (rewritten)
- **What:** new colour tokens and type scale.
  - Physical "pressed" buttons in coral, lime and ink.
  - The paper panel with a stacked edge.
  - A tab tray, the steps rail, the heartbeat card, heir rows with coral share badges, and the status bar.
  - A responsive layout down to 390px wide.
- **Why:** to match the 3D vault and fix the old look.

## 2026-10-30 13:00 PKT: Verification (no further file changes)
- `tsc -b`, ESLint (0 problems) and `vite build` all pass.
- A new end-to-end browser test of the redesigned site passed **52/52** on a local Hardhat chain. It covered:
  - the landing page and 3D canvas
  - the wallet picker
  - a wrong network, then switching
  - 30 days = 2,592,000 s, and rejecting 0 days
  - rejecting in the wallet, then creating the estate with all 4 steps Done
  - on-chain owner, period and creation time
  - adding a heir, blocking over-allocation, and removing a heir
  - a check-in, then a period update to 90 days
  - reloading the page, switching accounts and disconnecting
  - no horizontal scroll on a phone, and no console errors
- Screenshots were checked on desktop and mobile.
- **Not committed to git.**
