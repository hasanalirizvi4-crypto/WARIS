export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isPhantom?: boolean;
  isOKXWallet?: boolean;
  isBinance?: boolean;
}

export interface DiscoveredWallet {
  id: string;
  name: string;
  rdns?: string;
  provider: EthereumProvider;
}

interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface Eip6963ProviderDetail {
  info: Eip6963ProviderInfo;
  provider: EthereumProvider;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const ANNOUNCE_EVENT = "eip6963:announceProvider";
const REQUEST_EVENT = "eip6963:requestProvider";

function getLegacyName(provider: EthereumProvider, index: number): string {
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isRabby) return "Rabby";
  if (provider.isBraveWallet) return "Brave Wallet";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isTrust) return "Trust Wallet";
  if (provider.isPhantom) return "Phantom";
  if (provider.isOKXWallet) return "OKX Wallet";
  if (provider.isBinance) return "Binance Wallet";
  return index === 0 ? "Injected EVM wallet" : `Injected EVM wallet ${index + 1}`;
}

function isProvider(value: unknown): value is EthereumProvider {
  return typeof value === "object" && value !== null &&
    "request" in value && typeof value.request === "function";
}

export async function discoverWallets(timeoutMs = 350): Promise<DiscoveredWallet[]> {
  const discovered: DiscoveredWallet[] = [];
  const seenProviders = new Set<EthereumProvider>();

  const addWallet = (wallet: DiscoveredWallet) => {
    if (seenProviders.has(wallet.provider)) return;

    const isEip6963 = wallet.id.startsWith("eip6963:");
    const duplicateFromOtherDiscoveryPath = discovered.findIndex((existing) =>
      existing.name.toLocaleLowerCase() === wallet.name.toLocaleLowerCase() &&
      existing.id.startsWith("eip6963:") !== isEip6963
    );
    if (duplicateFromOtherDiscoveryPath !== -1) {
      seenProviders.add(wallet.provider);
      if (isEip6963) discovered[duplicateFromOtherDiscoveryPath] = wallet;
      return;
    }

    seenProviders.add(wallet.provider);
    discovered.push(wallet);
  };

  const handleAnnouncement = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (!detail || !isProvider(detail.provider) || !detail.info) return;
    const { uuid, name, rdns } = detail.info;
    if (typeof uuid !== "string" || typeof name !== "string" || !name.trim()) return;

    addWallet({
      id: `eip6963:${uuid}`,
      name: name.trim(),
      rdns: typeof rdns === "string" ? rdns : undefined,
      provider: detail.provider,
    });
  };

  window.addEventListener(ANNOUNCE_EVENT, handleAnnouncement);
  window.dispatchEvent(new Event(REQUEST_EVENT));

  // Give extensions time to answer the EIP-6963 discovery event.
  await new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
  window.removeEventListener(ANNOUNCE_EVENT, handleAnnouncement);

  const injectedProviders = window.ethereum?.providers ?? [];
  const legacyProviders = injectedProviders.length > 0
    ? [...injectedProviders]
    : window.ethereum ? [window.ethereum] : [];

  legacyProviders.forEach((provider, index) => {
    if (!isProvider(provider)) return;
    addWallet({
      id: `injected:${index}`,
      name: getLegacyName(provider, index),
      provider,
    });
  });

  return discovered.sort((a, b) => a.name.localeCompare(b.name));
}
