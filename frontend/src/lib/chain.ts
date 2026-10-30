import { BrowserProvider, Contract, getAddress, type TransactionReceipt } from "ethers";
import type { EthereumProvider } from "../walletDiscovery";
import {
  WARIS_ABI,
  WARIS_CONTRACT_ADDRESS,
  WARIS_CONTRACT_CONFIGURED,
  WARIS_IS_LOCAL,
  WARIS_NETWORK_NAME,
} from "../warisConfig";
import { shortAddress } from "./format";
import type { AccountData, CreationTx, EstateRecord } from "./types";

export function toCreationTx(receipt: TransactionReceipt): CreationTx {
  return {
    hash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    fee: receipt.fee,
  };
}

/** Finds the transaction that created an estate, using the block stored in the contract. */
async function findCreationTx(
  contract: Contract,
  provider: BrowserProvider,
  estateId: bigint,
  createdAtBlock: bigint
): Promise<CreationTx | null> {
  try {
    const block = Number(createdAtBlock);
    const events = await contract.queryFilter(
      contract.filters.EstateCreated(estateId),
      block,
      block
    );
    const hash = events[0]?.transactionHash;
    if (!hash) return null;
    const receipt = await provider.getTransactionReceipt(hash);
    return receipt ? toCreationTx(receipt) : null;
  } catch {
    return null;
  }
}

/** Reads the wallet balance and the wallet's estate straight from the chain. */
export async function readAccountData(
  walletProvider: EthereumProvider,
  address: string,
  knownCreationTx: CreationTx | null = null
): Promise<AccountData> {
  const provider = new BrowserProvider(walletProvider);
  const walletBalance = await provider.getBalance(address);
  const empty: AccountData = {
    walletBalance,
    estate: null,
    beneficiaries: [],
    creationTx: null,
    error: "",
  };

  if (!WARIS_CONTRACT_CONFIGURED) return empty;

  const code = await provider.getCode(WARIS_CONTRACT_ADDRESS);
  if (code === "0x") {
    return {
      ...empty,
      error: WARIS_IS_LOCAL
        ? `No WARIS contract was found at ${shortAddress(WARIS_CONTRACT_ADDRESS)} on ${WARIS_NETWORK_NAME}. If you restarted "npx hardhat node", the local chain was reset: run "npx hardhat run scripts/deploy-local.ts --network localhost" again and restart the frontend.`
        : `No WARIS contract was found at ${shortAddress(WARIS_CONTRACT_ADDRESS)} on ${WARIS_NETWORK_NAME}. Check VITE_WARIS_CONTRACT_ADDRESS in frontend/.env.local.`,
    };
  }

  const contract = new Contract(WARIS_CONTRACT_ADDRESS, WARIS_ABI, provider);
  const estateId = BigInt(await contract.estateIdOf(address));
  if (estateId === 0n) return empty;

  const [record, beneficiaryList] = await Promise.all([
    contract.getEstate(estateId),
    contract.getBeneficiaries(estateId),
  ]);

  const estate: EstateRecord = {
    id: estateId,
    owner: getAddress(String(record.owner)),
    createdAt: BigInt(record.createdAt),
    createdAtBlock: BigInt(record.createdAtBlock),
    lastCheckIn: BigInt(record.lastCheckIn),
    inactivityPeriod: BigInt(record.inactivityPeriod),
    beneficiaryCount: Number(record.beneficiaryCount),
    allocatedShares: Number(record.allocatedShares),
    balance: BigInt(record.balance),
  };

  const wallets = Array.from(beneficiaryList[0] as string[]);
  const shares = Array.from(beneficiaryList[1] as bigint[]);
  const beneficiaries = wallets.map((wallet, index) => ({
    address: getAddress(wallet),
    share: Number(shares[index]),
  }));

  const creationTx = knownCreationTx ??
    await findCreationTx(contract, provider, estateId, estate.createdAtBlock);

  return { walletBalance, estate, beneficiaries, creationTx, error: "" };
}
