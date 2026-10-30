import { useEffect, useRef, useState } from "react";
import {
  BrowserProvider,
  Contract,
  getAddress,
  isAddress,
  type ContractTransactionResponse,
  type TransactionReceipt,
} from "ethers";
import { discoverWallets, type DiscoveredWallet } from "../walletDiscovery";
import { describeWalletError } from "../walletErrors";
import {
  MAX_BENEFICIARIES,
  MAX_INACTIVITY_DAYS,
  MIN_INACTIVITY_DAYS,
  SECONDS_PER_DAY,
  WARIS_ABI,
  WARIS_ADD_CHAIN_PARAMS,
  WARIS_CHAIN_ID,
  WARIS_CHAIN_ID_HEX,
  WARIS_CONTRACT_ADDRESS,
  WARIS_CONTRACT_ADDRESS_INVALID,
  WARIS_CONTRACT_CONFIGURED,
  WARIS_NETWORK_NAME,
} from "../warisConfig";
import { readAccountData, toCreationTx } from "../lib/chain";
import {
  errorCode,
  firstAccount,
  formatDays,
  formatNumber,
  parseChainId,
  shortAddress,
  wait,
} from "../lib/format";
import type {
  AccountData,
  AccountSnapshot,
  ActionName,
  CreationTx,
  StatusMessage,
  TxPhase,
} from "../lib/types";

/** All wallet, estate and transaction state for WARIS. The UI only renders it. */
export function useWaris() {
  // Wallet
  const [selectedWallet, setSelectedWallet] = useState<DiscoveredWallet | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletChainId, setWalletChainId] = useState<bigint | null>(null);
  const [walletOptions, setWalletOptions] = useState<DiscoveredWallet[]>([]);
  const [isWalletPickerOpen, setIsWalletPickerOpen] = useState(false);
  const [isDiscoveringWallets, setIsDiscoveringWallets] = useState(false);
  const [connectingWalletId, setConnectingWalletId] = useState("");
  const [walletPickerMessage, setWalletPickerMessage] = useState("");
  // Increases whenever a pending connection request is cancelled, so a late answer is ignored.
  const connectAttemptRef = useRef(0);

  // Chain data for the connected account
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);

  // Forms
  const [inactivityDays, setInactivityDays] = useState("30");
  const [beneficiaryAddress, setBeneficiaryAddress] = useState("");
  const [share, setShare] = useState("50");

  // Transaction progress
  const [activeAction, setActiveAction] = useState<ActionName | null>(null);
  const [txPhase, setTxPhase] = useState<TxPhase>("idle");
  const [pendingTxHash, setPendingTxHash] = useState("");
  const [status, setStatus] = useState<StatusMessage>({
    text: "Connect your wallet to get started.",
    tone: "info",
  });

  // Signals for the 3D vault: they increase when a check-in or a new estate is confirmed.
  const [pulseKey, setPulseKey] = useState(0);
  const [sealKey, setSealKey] = useState(0);

  // A slow clock for the check-in countdown.
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000));

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const walletName = selectedWallet?.name ?? "your wallet";
  const isConnected = walletAddress.length > 0;
  const isOnWarisNetwork = walletChainId === WARIS_CHAIN_ID;
  const accountKey = isConnected && isOnWarisNetwork ? walletAddress.toLowerCase() : "";
  const account = snapshot && snapshot.key === accountKey ? snapshot : null;
  const estate = account?.estate ?? null;
  const beneficiaries = account?.beneficiaries ?? [];
  const creationTx = account?.creationTx ?? null;
  const walletBalance = account?.walletBalance ?? null;
  const accountError = account?.error ?? "";
  const isLoadingAccount = accountKey !== "" && account === null;
  const canUseContract = accountKey !== "" &&
    WARIS_CONTRACT_CONFIGURED &&
    account !== null &&
    !accountError;
  const isBusy = activeAction !== null;
  const isCreating = activeAction === "create";
  const hasNoGas = walletBalance === 0n;
  const step1Done = isConnected && isOnWarisNetwork;

  const periodDays = Number(inactivityDays);
  const validPeriod = inactivityDays.trim() !== "" &&
    Number.isInteger(periodDays) &&
    periodDays >= MIN_INACTIVITY_DAYS &&
    periodDays <= MAX_INACTIVITY_DAYS;
  const periodSeconds = validPeriod ? periodDays * SECONDS_PER_DAY : 0;
  const periodError = `Enter a whole number of days from ${MIN_INACTIVITY_DAYS} to ${formatNumber(MAX_INACTIVITY_DAYS)}.`;
  const periodUnchanged = Boolean(
    estate && validPeriod && BigInt(periodSeconds) === estate.inactivityPeriod
  );

  const allocatedShares = estate?.allocatedShares ?? 0;
  const checkInDeadline = estate ? estate.lastCheckIn + estate.inactivityPeriod : null;
  const secondsLeft = checkInDeadline ? Number(checkInDeadline) - nowSeconds : 0;
  const isOverdue = Boolean(estate) && secondsLeft <= 0;
  const heartbeatFraction = estate && estate.inactivityPeriod > 0n
    ? Math.max(0, Math.min(1, secondsLeft / Number(estate.inactivityPeriod)))
    : 1;

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Keep the wallet address and network in sync with the selected wallet.
  useEffect(() => {
    const wallet = selectedWallet;
    if (!wallet) return;
    const walletProvider = wallet.provider;
    let isCurrent = true;

    const syncWallet = async () => {
      try {
        const [accounts, chainId] = await Promise.all([
          walletProvider.request({ method: "eth_accounts" }),
          walletProvider.request({ method: "eth_chainId" }),
        ]);
        if (!isCurrent) return;
        const nextAddress = firstAccount(accounts);
        setWalletAddress(nextAddress);
        setWalletChainId(parseChainId(chainId));
        if (!nextAddress) {
          setStatus({ text: `${wallet.name} disconnected. Connect a wallet to continue.`, tone: "info" });
        }
      } catch {
        if (!isCurrent) return;
        setWalletAddress("");
        setWalletChainId(null);
      }
    };

    const handleWalletChange = () => {
      void syncWallet();
    };
    walletProvider.on?.("accountsChanged", handleWalletChange);
    walletProvider.on?.("chainChanged", handleWalletChange);

    return () => {
      isCurrent = false;
      walletProvider.removeListener?.("accountsChanged", handleWalletChange);
      walletProvider.removeListener?.("chainChanged", handleWalletChange);
    };
  }, [selectedWallet]);

  // Load the wallet balance and estate whenever the account or network changes.
  useEffect(() => {
    const wallet = selectedWallet;
    if (!wallet || !accountKey) return;
    let isCurrent = true;

    readAccountData(wallet.provider, accountKey)
      .then((data) => {
        if (isCurrent) setSnapshot({ key: accountKey, ...data });
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setSnapshot({
          key: accountKey,
          walletBalance: null,
          estate: null,
          beneficiaries: [],
          creationTx: null,
          error: describeWalletError(error, wallet.name),
        });
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedWallet, accountKey]);

  // Close the wallet picker with Escape (a pending request is then ignored).
  useEffect(() => {
    if (!isWalletPickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      connectAttemptRef.current++;
      setConnectingWalletId("");
      setIsWalletPickerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isWalletPickerOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // ---------------------------------------------------------------------------
  // Wallet connection
  // ---------------------------------------------------------------------------

  async function openWalletPicker() {
    setIsWalletPickerOpen(true);
    setIsDiscoveringWallets(true);
    setWalletPickerMessage("");
    setWalletOptions([]);
    try {
      const wallets = await discoverWallets();
      setWalletOptions(wallets);
      if (wallets.length === 0) {
        setWalletPickerMessage(
          "No compatible browser wallets were detected. Install or enable a wallet extension such as MetaMask, then scan again."
        );
      }
    } catch {
      setWalletPickerMessage(
        "Wallet discovery failed. Check that your wallet extension is enabled, then scan again."
      );
    } finally {
      setIsDiscoveringWallets(false);
    }
  }

  async function connectWallet(wallet: DiscoveredWallet) {
    const attempt = ++connectAttemptRef.current;
    setConnectingWalletId(wallet.id);
    setWalletPickerMessage("");

    try {
      const accounts = await wallet.provider.request({ method: "eth_requestAccounts" });
      if (attempt !== connectAttemptRef.current) return;
      const address = firstAccount(accounts);
      if (!address) {
        throw new Error(`${wallet.name} did not share an account. Unlock it and try again.`);
      }
      const chainId = parseChainId(await wallet.provider.request({ method: "eth_chainId" }));
      if (attempt !== connectAttemptRef.current) return;

      setSelectedWallet(wallet);
      setWalletAddress(address);
      setWalletChainId(chainId);
      setIsWalletPickerOpen(false);
      setStatus(chainId === WARIS_CHAIN_ID
        ? {
          text: `${wallet.name} connected. WARIS can see your public address ${shortAddress(address)}; your private key stays in ${wallet.name}.`,
          tone: "success",
        }
        : {
          text: `${wallet.name} connected, but it is on another network. Switch it to ${WARIS_NETWORK_NAME} to continue.`,
          tone: "info",
        });
    } catch (error) {
      if (attempt !== connectAttemptRef.current) return;
      const message = describeWalletError(error, wallet.name);
      setWalletPickerMessage(message);
      setStatus({ text: message, tone: "error" });
    } finally {
      if (attempt === connectAttemptRef.current) setConnectingWalletId("");
    }
  }

  /** Closes the wallet list. A request still waiting in the wallet is ignored from now on. */
  function closeWalletPicker() {
    if (connectingWalletId) {
      const pendingName = walletOptions.find((wallet) => wallet.id === connectingWalletId)?.name ?? "your wallet";
      setStatus({
        text: `Connection cancelled in WARIS. If ${pendingName} still shows a request, reject it there.`,
        tone: "info",
      });
    }
    connectAttemptRef.current++;
    setConnectingWalletId("");
    setIsWalletPickerOpen(false);
  }

  /** Forgets the connected wallet and asks it to drop WARIS's permission where supported. */
  async function disconnectWallet() {
    const wallet = selectedWallet;
    connectAttemptRef.current++;
    setSelectedWallet(null);
    setWalletAddress("");
    setWalletChainId(null);
    setSnapshot(null);
    setStatus({ text: `${wallet?.name ?? "Wallet"} disconnected. Connect a wallet to continue.`, tone: "info" });

    if (!wallet) return;
    try {
      await wallet.provider.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Not every wallet supports revoking; WARIS has already forgotten the connection.
    }
  }

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  async function runAction(action: ActionName, task: () => Promise<void>) {
    if (activeAction) return;
    setActiveAction(action);
    try {
      await task();
    } catch (error) {
      setStatus({ text: describeWalletError(error, walletName), tone: "error" });
    } finally {
      setActiveAction(null);
      setTxPhase("idle");
      setPendingTxHash("");
    }
  }

  async function getWriteContract() {
    const walletProvider = selectedWallet?.provider;
    if (!walletProvider || !walletAddress) {
      throw new Error("Connect a wallet before using the estate workspace.");
    }
    if (!WARIS_CONTRACT_CONFIGURED) {
      throw new Error(WARIS_CONTRACT_ADDRESS_INVALID
        ? "VITE_WARIS_CONTRACT_ADDRESS must be a valid Ethereum address."
        : `The WARIS contract has not been deployed to ${WARIS_NETWORK_NAME} yet. Add its public address to frontend/.env.local after deployment.`);
    }

    const provider = new BrowserProvider(walletProvider);
    const network = await provider.getNetwork();
    if (network.chainId !== WARIS_CHAIN_ID) {
      throw new Error(`Switch ${walletName} to ${WARIS_NETWORK_NAME} (chain ID ${WARIS_CHAIN_ID}) first.`);
    }

    const signer = await provider.getSigner(walletAddress);
    return new Contract(WARIS_CONTRACT_ADDRESS, WARIS_ABI, signer);
  }

  /** Sends a transaction through the selected wallet and waits for one confirmation. */
  async function submitAndConfirm(
    submit: (contract: Contract) => Promise<ContractTransactionResponse>
  ): Promise<TransactionReceipt> {
    setTxPhase("wallet");
    setStatus({ text: `Review the transaction in ${walletName} and approve it to continue.`, tone: "info" });

    const contract = await getWriteContract();
    const tx = await submit(contract);

    setPendingTxHash(tx.hash);
    setTxPhase("pending");
    setStatus({ text: `Transaction submitted. Waiting for ${WARIS_NETWORK_NAME} to confirm it…`, tone: "info" });

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error("The transaction was not confirmed on-chain.");
    }

    setTxPhase("syncing");
    return receipt;
  }

  /** Re-reads chain data. Retries briefly because wallet RPC nodes can lag a block. */
  async function refreshAccount(options: {
    creationTx?: CreationTx | null;
    until?: (data: AccountData) => boolean;
  } = {}) {
    const walletProvider = selectedWallet?.provider;
    const key = accountKey;
    if (!walletProvider || !key) return null;

    let data: AccountData | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      data = await readAccountData(walletProvider, key, options.creationTx ?? null);
      if (!options.until || options.until(data)) break;
      await wait(1500);
    }

    if (data) setSnapshot({ key, ...data });
    return data;
  }

  function switchNetwork() {
    const walletProvider = selectedWallet?.provider;
    if (!walletProvider) {
      setStatus({ text: "Choose a wallet before switching networks.", tone: "info" });
      return;
    }

    void runAction("switch", async () => {
      try {
        await walletProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: WARIS_CHAIN_ID_HEX }],
        });
      } catch (error) {
        if (errorCode(error) !== 4902) throw error;
        await walletProvider.request({ method: "wallet_addEthereumChain", params: [WARIS_ADD_CHAIN_PARAMS] });
      }

      const chainId = parseChainId(await walletProvider.request({ method: "eth_chainId" }));
      setWalletChainId(chainId);
      setStatus(chainId === WARIS_CHAIN_ID
        ? { text: `${walletName} is now on ${WARIS_NETWORK_NAME}.`, tone: "success" }
        : { text: `${walletName} is still on another network.`, tone: "info" });
    });
  }

  function createEstate() {
    if (!validPeriod) {
      setStatus({ text: periodError, tone: "error" });
      return;
    }
    if (estate) {
      setStatus({ text: `This wallet already owns estate #${estate.id}.`, tone: "info" });
      return;
    }

    void runAction("create", async () => {
      // Days → seconds, because the contract works with timestamps.
      const seconds = BigInt(periodDays) * BigInt(SECONDS_PER_DAY);
      const receipt = await submitAndConfirm((contract) => contract.createEstate(seconds));
      setStatus({ text: "Confirmed. Reading your estate record back from the blockchain…", tone: "info" });

      const data = await refreshAccount({
        creationTx: toCreationTx(receipt),
        until: (next) => next.estate !== null,
      });

      if (data?.estate) setSealKey((key) => key + 1);
      setStatus(data?.estate
        ? { text: `Estate #${data.estate.id} created and confirmed in block #${formatNumber(receipt.blockNumber)}.`, tone: "success" }
        : { text: "The transaction is confirmed, but your wallet's network node has not shown the record yet. Press Refresh in a few seconds.", tone: "info" });
    });
  }

  function updatePeriod() {
    if (!estate) return;
    if (!validPeriod) {
      setStatus({ text: periodError, tone: "error" });
      return;
    }
    const seconds = BigInt(periodDays) * BigInt(SECONDS_PER_DAY);
    if (seconds === estate.inactivityPeriod) {
      setStatus({ text: `The check-in period is already ${formatDays(seconds)}.`, tone: "info" });
      return;
    }

    const estateId = estate.id;
    void runAction("period", async () => {
      await submitAndConfirm((contract) => contract.updateInactivityPeriod(estateId, seconds));
      await refreshAccount({ creationTx, until: (next) => next.estate?.inactivityPeriod === seconds });
      setStatus({ text: `Check-in period updated to ${formatDays(seconds)}.`, tone: "success" });
    });
  }

  function addBeneficiary() {
    if (!estate) {
      setStatus({ text: "Create your estate before adding an heir.", tone: "info" });
      return;
    }

    const trimmed = beneficiaryAddress.trim();
    if (!isAddress(trimmed)) {
      setStatus({ text: "Enter a valid Ethereum wallet address (0x followed by 40 characters).", tone: "error" });
      return;
    }

    const wallet = getAddress(trimmed);
    const shareNumber = Number(share);

    if (!Number.isInteger(shareNumber) || shareNumber < 1 || shareNumber > 100) {
      setStatus({ text: "Share must be a whole number between 1 and 100.", tone: "error" });
      return;
    }
    if (wallet === estate.owner) {
      setStatus({ text: "The estate owner cannot be their own heir.", tone: "error" });
      return;
    }
    if (wallet === WARIS_CONTRACT_ADDRESS) {
      setStatus({ text: "The WARIS contract cannot be an heir.", tone: "error" });
      return;
    }
    if (beneficiaries.some((beneficiary) => beneficiary.address === wallet)) {
      setStatus({ text: "This wallet is already an heir.", tone: "error" });
      return;
    }
    if (beneficiaries.length >= MAX_BENEFICIARIES) {
      setStatus({ text: `An estate can have up to ${MAX_BENEFICIARIES} heirs.`, tone: "error" });
      return;
    }
    if (allocatedShares + shareNumber > 100) {
      setStatus({ text: `Only ${100 - allocatedShares}% is still unassigned. Lower the share and try again.`, tone: "error" });
      return;
    }

    const estateId = estate.id;
    void runAction("beneficiary", async () => {
      await submitAndConfirm((contract) => contract.addBeneficiary(estateId, wallet, shareNumber));
      setBeneficiaryAddress("");
      await refreshAccount({
        creationTx,
        until: (next) => next.beneficiaries.some((item) => item.address === wallet),
      });
      setStatus({ text: `${shortAddress(wallet)} added with a ${shareNumber}% share.`, tone: "success" });
    });
  }

  function removeBeneficiary(wallet: string) {
    if (!estate) return;
    const estateId = estate.id;

    void runAction("remove", async () => {
      await submitAndConfirm((contract) => contract.removeBeneficiary(estateId, wallet));
      await refreshAccount({
        creationTx,
        until: (next) => !next.beneficiaries.some((item) => item.address === wallet),
      });
      setStatus({ text: `${shortAddress(wallet)} was removed and their share is free again.`, tone: "success" });
    });
  }

  function checkIn() {
    if (!estate) {
      setStatus({ text: "Create your estate before checking in.", tone: "info" });
      return;
    }

    const estateId = estate.id;
    const previousCheckIn = estate.lastCheckIn;
    void runAction("checkin", async () => {
      const receipt = await submitAndConfirm((contract) => contract.checkIn(estateId));
      await refreshAccount({
        creationTx,
        until: (next) => (next.estate?.lastCheckIn ?? 0n) > previousCheckIn,
      });
      setNowSeconds(Math.floor(Date.now() / 1000));
      setPulseKey((key) => key + 1);
      setStatus({
        text: `Check-in confirmed in block #${formatNumber(receipt.blockNumber)}. Your next deadline has moved forward.`,
        tone: "success",
      });
    });
  }

  function refresh() {
    void runAction("refresh", async () => {
      const data = await refreshAccount({ creationTx });
      setStatus(data?.error
        ? { text: data.error, tone: "error" }
        : { text: "Estate data refreshed from the blockchain.", tone: "success" });
    });
  }

  return {
    // wallet
    selectedWallet,
    walletName,
    walletAddress,
    walletChainId,
    walletBalance,
    walletOptions,
    isWalletPickerOpen,
    isDiscoveringWallets,
    connectingWalletId,
    walletPickerMessage,
    isConnected,
    isOnWarisNetwork,
    step1Done,
    hasNoGas,
    // account + estate
    account,
    accountError,
    isLoadingAccount,
    canUseContract,
    estate,
    beneficiaries,
    creationTx,
    allocatedShares,
    checkInDeadline,
    secondsLeft,
    isOverdue,
    heartbeatFraction,
    // forms
    inactivityDays,
    setInactivityDays,
    periodDays,
    validPeriod,
    periodSeconds,
    periodError,
    periodUnchanged,
    beneficiaryAddress,
    setBeneficiaryAddress,
    share,
    setShare,
    // transactions
    activeAction,
    isBusy,
    isCreating,
    txPhase,
    pendingTxHash,
    status,
    pulseKey,
    sealKey,
    // actions
    openWalletPicker,
    connectWallet,
    closeWalletPicker,
    disconnectWallet,
    switchNetwork,
    createEstate,
    updatePeriod,
    addBeneficiary,
    removeBeneficiary,
    checkIn,
    refresh,
  };
}

export type Waris = ReturnType<typeof useWaris>;
