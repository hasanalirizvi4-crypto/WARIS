import WarisEstateABI from "./contracts/WarisEstateABI.json";
import { getAddress, isAddress } from "ethers";

// ---------------------------------------------------------------------------
// Network selection
//   VITE_WARIS_NETWORK=sepolia   → Ethereum Sepolia test network (default)
//   VITE_WARIS_NETWORK=localhost → local Hardhat node at http://127.0.0.1:8545
// ---------------------------------------------------------------------------

interface WarisNetwork {
  chainId: bigint;
  chainIdHex: string;
  name: string;
  shortName: string;
  explorerUrl: string; // empty when the network has no block explorer
  currencySymbol: string;
  testEthLabel: string;
  isLocal: boolean;
  addChainParams: Record<string, unknown>;
}

const NETWORKS: Record<"sepolia" | "localhost", WarisNetwork> = {
  sepolia: {
    chainId: 11155111n,
    chainIdHex: "0xaa36a7",
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    explorerUrl: "https://sepolia.etherscan.io",
    currencySymbol: "SepoliaETH",
    testEthLabel: "Sepolia test ETH",
    isLocal: false,
    addChainParams: {
      chainId: "0xaa36a7",
      chainName: "Sepolia",
      nativeCurrency: { name: "Sepolia Ether", symbol: "SepoliaETH", decimals: 18 },
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com", "https://rpc.sepolia.org"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
    },
  },
  localhost: {
    chainId: 31337n,
    chainIdHex: "0x7a69",
    name: "Hardhat Local",
    shortName: "Hardhat Local",
    explorerUrl: "",
    currencySymbol: "ETH",
    testEthLabel: "local test ETH",
    isLocal: true,
    addChainParams: {
      chainId: "0x7a69",
      chainName: "Hardhat Local",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["http://127.0.0.1:8545"],
    },
  },
};

const requestedNetwork = (import.meta.env.VITE_WARIS_NETWORK ?? "").trim().toLowerCase();
const activeNetwork = requestedNetwork === "localhost" ? NETWORKS.localhost : NETWORKS.sepolia;

/** True when VITE_WARIS_NETWORK is set to something other than sepolia or localhost. */
export const WARIS_NETWORK_SETTING_INVALID =
  requestedNetwork !== "" && requestedNetwork !== "sepolia" && requestedNetwork !== "localhost";

export const WARIS_CHAIN_ID = activeNetwork.chainId;
export const WARIS_CHAIN_ID_HEX = activeNetwork.chainIdHex;
export const WARIS_NETWORK_NAME = activeNetwork.name;
export const WARIS_NETWORK_SHORT_NAME = activeNetwork.shortName;
export const WARIS_EXPLORER_URL = activeNetwork.explorerUrl;
export const WARIS_CURRENCY_SYMBOL = activeNetwork.currencySymbol;
export const WARIS_TEST_ETH_LABEL = activeNetwork.testEthLabel;
export const WARIS_IS_LOCAL = activeNetwork.isLocal;

// Used only if the selected wallet does not know the network yet (error 4902).
export const WARIS_ADD_CHAIN_PARAMS = activeNetwork.addChainParams;

// ---------------------------------------------------------------------------
// Contract limits — must match WarisEstate.sol
// ---------------------------------------------------------------------------

export const SECONDS_PER_DAY = 86_400;
export const MIN_INACTIVITY_DAYS = 1;
export const MAX_INACTIVITY_DAYS = 3650;
export const MAX_BENEFICIARIES = 20;

// ---------------------------------------------------------------------------
// Contract address (public, from frontend/.env.local)
// ---------------------------------------------------------------------------

const configuredAddress = import.meta.env.VITE_WARIS_CONTRACT_ADDRESS?.trim() ?? "";

export const WARIS_CONTRACT_ADDRESS_INVALID = Boolean(
  configuredAddress && !isAddress(configuredAddress)
);
export const WARIS_CONTRACT_ADDRESS = isAddress(configuredAddress)
  ? getAddress(configuredAddress)
  : "";
export const WARIS_CONTRACT_CONFIGURED = WARIS_CONTRACT_ADDRESS.length > 0;

export const WARIS_ABI = WarisEstateABI;
