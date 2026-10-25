
import { useState } from "react";
import { BrowserProvider, Contract, formatEther } from "ethers";
import { WARIS_ABI, WARIS_CONTRACT_ADDRESS } from "./warisConfig";
import "./App.css";

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    };
  }
}

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [estateId, setEstateId] = useState("");
  const [inactivityDays, setInactivityDays] = useState("30");
  const [beneficiaryAddress, setBeneficiaryAddress] = useState("");
  const [share, setShare] = useState("50");
  const [beneficiaries, setBeneficiaries] = useState<
    { address: string; share: number }[]
  >([]);
  const [balance, setBalance] = useState("0.0000");
  const [contractStatus, setContractStatus] = useState(
    "Connect your wallet to get started."
  );
  const [isLoading, setIsLoading] = useState(false);

  async function getWarisContract() {
    if (!window.ethereum) {
      throw new Error(
        "MetaMask is not installed. Please install the MetaMask extension."
      );
    }

    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();

    if (network.chainId !== 31337n) {
      throw new Error(
        "Please switch MetaMask to Hardhat Local (Chain ID 31337)."
      );
    }

    const signer = await provider.getSigner();

    return new Contract(
      WARIS_CONTRACT_ADDRESS,
      WARIS_ABI,
      signer
    );
  }

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install the extension.");
      return;
    }

    setIsLoading(true);

    try {
      await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      if (network.chainId !== 31337n) {
        throw new Error(
          "MetaMask is connected, but not to Hardhat Local. Select Chain ID 31337."
        );
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setWalletAddress(address);
      setContractStatus("Wallet connected to Hardhat Local.");

      // Check whether this deployment has an estate to load.
      const contract = new Contract(
        WARIS_CONTRACT_ADDRESS,
        WARIS_ABI,
        provider
      );

      const nextId = await contract.nextEstateId();

      if (nextId > 1n) {
        const latestEstateId = (nextId - 1n).toString();
        const estate = await contract.getEstate(latestEstateId);

        if (
          String(estate[0]).toLowerCase() === address.toLowerCase()
        ) {
          setEstateId(latestEstateId);
          await loadEstate(latestEstateId, contract);
        }
      }
    } catch (error) {
      alert(getErrorMessage(error));
      setContractStatus("Wallet connection needs attention.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadEstate(
    id: string,
    suppliedContract?: Contract
  ) {
    try {
      const contract = suppliedContract ?? await getWarisContract();
      const estate = await contract.getEstate(id);
      const owner = String(estate[0]);

      if (
        walletAddress &&
        owner.toLowerCase() !== walletAddress.toLowerCase()
      ) {
        setContractStatus(
          `Estate #${id} belongs to another wallet.`
        );
        return;
      }

      const count = Number(estate[3]);
      const loadedBeneficiaries: {
        address: string;
        share: number;
      }[] = [];

      for (let i = 0; i < count; i++) {
        const beneficiary = await contract.getBeneficiary(id, i);

        loadedBeneficiaries.push({
          address: String(beneficiary[0]),
          share: Number(beneficiary[1]),
        });
      }

      const estateBalance = await contract.getEstateBalance(id);

      setEstateId(id);
      setBeneficiaries(loadedBeneficiaries);
      setBalance(Number(formatEther(estateBalance)).toFixed(4));
      setContractStatus(`Estate #${id} loaded from the blockchain.`);
    } catch (error) {
      setContractStatus(getErrorMessage(error));
    }
  }

  async function createEstate() {
    if (!walletAddress) {
      alert("Please connect your MetaMask wallet first.");
      return;
    }

    const days = Number(inactivityDays);

    if (!Number.isInteger(days) || days < 1) {
      alert("Enter a whole number of at least 1 day.");
      return;
    }

    setIsLoading(true);

    try {
      const contract = await getWarisContract();
      const nextId = await contract.nextEstateId();

      const tx = await contract.createEstate(
        BigInt(days) * 24n * 60n * 60n
      );

      setContractStatus("Waiting for estate creation confirmation...");
      await tx.wait();

      const id = nextId.toString();
      setEstateId(id);
      await loadEstate(id, contract);

      alert(`Estate #${id} created successfully on Hardhat Local!`);
    } catch (error) {
      alert(getErrorMessage(error));
      setContractStatus("Estate creation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function addBeneficiary() {
    if (!walletAddress) {
      alert("Connect your wallet first.");
      return;
    }

    if (!estateId) {
      alert("Create or load an estate first.");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(beneficiaryAddress)) {
      alert("Enter a valid Ethereum wallet address.");
      return;
    }

    const shareNumber = Number(share);

    if (
      !Number.isInteger(shareNumber) ||
      shareNumber < 1 ||
      shareNumber > 100
    ) {
      alert("Share must be a whole number between 1 and 100.");
      return;
    }

    if (beneficiaryAddress.toLowerCase() === walletAddress.toLowerCase()) {
      alert("The estate owner cannot be their own beneficiary.");
      return;
    }

    if (
      beneficiaries.some(
        (b) => b.address.toLowerCase() === beneficiaryAddress.toLowerCase()
      )
    ) {
      alert("This beneficiary has already been added.");
      return;
    }

    const allocated = beneficiaries.reduce((sum, b) => sum + b.share, 0);

    if (allocated + shareNumber > 100) {
      alert("Total beneficiary shares cannot exceed 100%.");
      return;
    }

    setIsLoading(true);

    try {
      const contract = await getWarisContract();
      const tx = await contract.addBeneficiary(
        estateId,
        beneficiaryAddress,
        shareNumber
      );

      setContractStatus("Waiting for beneficiary transaction...");
      await tx.wait();

      setBeneficiaryAddress("");
      await loadEstate(estateId, contract);
      alert("Beneficiary saved on the blockchain.");
    } catch (error) {
      alert(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function checkIn() {
    if (!walletAddress || !estateId) {
      alert("Connect your wallet and create or load an estate first.");
      return;
    }

    setIsLoading(true);

    try {
      const contract = await getWarisContract();
      const tx = await contract.checkIn(estateId);

      setContractStatus("Confirming proof-of-life check-in...");
      await tx.wait();

      setContractStatus("Proof-of-life check-in confirmed on-chain.");
      alert("Check-in recorded successfully!");
    } catch (error) {
      alert(getErrorMessage(error));
      setContractStatus("Check-in failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return "An unexpected error occurred.";
  }

  const allocatedShares = beneficiaries.reduce(
    (sum, beneficiary) => sum + beneficiary.share,
    0
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <h2>WARIS</h2>
            <span>Digital Inheritance</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          <a className="nav-link active" href="#overview">
            ◈ <span>Overview</span>
          </a>
          <a className="nav-link" href="#estate">
            ◫ <span>My Estate</span>
          </a>
          <a className="nav-link" href="#beneficiaries">
            ♙ <span>Beneficiaries</span>
          </a>
          <a className="nav-link" href="#checkin">
            ◷ <span>Proof of Life</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="security-note">
            <span className="security-icon">♢</span>
            <strong>Your assets. Your control.</strong>
            <p>Connect your own wallet to interact with WARIS.</p>
          </div>
          <span className="sidebar-footer">WARIS · FYP Prototype</span>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div>
            <span className="eyebrow">BLOCKCHAIN ESTATE PLANNING</span>
            <h1>Overview</h1>
          </div>
          <button
            className="connect-button"
            onClick={connectWallet}
            disabled={isLoading}
          >
            {isLoading
              ? "Please wait..."
              : walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : "↗ Connect Wallet"}
          </button>
        </header>

        <section className="welcome-banner">
          <div className="welcome-copy">
            <span className="banner-tag">YOUR LEGACY, PROTECTED</span>
            <h2>Plan today. Protect tomorrow.</h2>
            <p>
              Organize your digital estate and prepare your inheritance
              instructions with blockchain transparency.
            </p>
            <a className="banner-link" href="#estate">
              Manage your estate <span>→</span>
            </a>
          </div>
          <div className="banner-emblem" aria-hidden="true">
            <div className="emblem-ring">
              <span>W</span>
            </div>
          </div>
        </section>

        <section className="section-heading" id="estate">
          <div>
            <span className="eyebrow">YOUR DIGITAL LEGACY</span>
            <h2>Estate overview</h2>
          </div>
          <span className="demo-badge">LOCAL BLOCKCHAIN</span>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">
              <span>Estate balance</span>
              <span className="stat-icon">◇</span>
            </div>
            <div className="stat-value">{balance} ETH</div>
            <p>Balance recorded by the contract</p>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Beneficiaries</span>
              <span className="stat-icon">♙</span>
            </div>
            <div className="stat-value">{beneficiaries.length}</div>
            <p>Saved on-chain for this estate</p>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Allocated shares</span>
              <span className="stat-icon">◌</span>
            </div>
            <div className="stat-value">{allocatedShares}%</div>
            <p>{100 - allocatedShares}% unallocated</p>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ESTATE SETUP</span>
                <h3>Create your estate</h3>
              </div>
              <span className="panel-icon">◫</span>
            </div>

            <p className="panel-description">
              Create an on-chain estate record for the connected wallet.
              Choose how long the contract waits between check-ins.
            </p>

            <label className="field-label" htmlFor="inactivityDays">
              Inactivity period (days)
            </label>
            <input
              id="inactivityDays"
              className="form-input"
              type="number"
              min="1"
              step="1"
              value={inactivityDays}
              onChange={(event) => setInactivityDays(event.target.value)}
            />

            <button
              className="primary-button"
              onClick={createEstate}
              disabled={isLoading || !walletAddress}
            >
              {isLoading ? "Processing..." : "＋ Create Estate"}
            </button>

            <div className="estate-current">
              <span>Current estate ID</span>
              <strong>{estateId ? `#${estateId}` : "No estate loaded"}</strong>
            </div>

            {estateId && (
              <button
                className="secondary-button"
                onClick={() => loadEstate(estateId)}
                disabled={isLoading}
              >
                ↻ Refresh estate data
              </button>
            )}

            <div className="status-message" role="status">
              <span className="status-dot" />
              <span>{contractStatus}</span>
            </div>
          </article>

          <article className="panel" id="beneficiaries">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">SUCCESSION PLANNING</span>
                <h3>Beneficiaries</h3>
              </div>
              <span className="panel-icon">♙</span>
            </div>

            <p className="panel-description">
              Add a beneficiary wallet and assign its percentage of the
              estate. The total must not exceed 100%.
            </p>

            <label className="field-label" htmlFor="beneficiaryAddress">
              Beneficiary wallet address
            </label>
            <input
              id="beneficiaryAddress"
              className="form-input"
              type="text"
              placeholder="0x..."
              value={beneficiaryAddress}
              onChange={(event) => setBeneficiaryAddress(event.target.value)}
            />

            <label className="field-label" htmlFor="share">
              Share percentage
            </label>
            <input
              id="share"
              className="form-input"
              type="number"
              min="1"
              max="100"
              step="1"
              value={share}
              onChange={(event) => setShare(event.target.value)}
            />

            <button
              className="primary-button"
              onClick={addBeneficiary}
              disabled={isLoading || !walletAddress || !estateId}
            >
              {isLoading ? "Processing..." : "＋ Add Beneficiary"}
            </button>

            <div className="beneficiary-list">
              {beneficiaries.length === 0 ? (
                <div className="empty-state">
                  No beneficiaries added yet.
                </div>
              ) : (
                beneficiaries.map((beneficiary) => (
                  <div
                    className="beneficiary-row"
                    key={beneficiary.address.toLowerCase()}
                  >
                    <div className="beneficiary-avatar">♙</div>
                    <div className="beneficiary-details">
                      <strong>
                        {beneficiary.address.slice(0, 8)}...
                        {beneficiary.address.slice(-6)}
                      </strong>
                      <span>Wallet beneficiary</span>
                    </div>
                    <span className="share-pill">
                      {beneficiary.share}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          <div className="right-column">
            <article className="panel checkin-panel" id="checkin">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">ACCOUNT ACTIVITY</span>
                  <h3>Proof of life</h3>
                </div>
                <span className="panel-icon">◷</span>
              </div>

              <p className="panel-description">
                Confirm that you are active. Your check-in timestamp is
                updated on the blockchain.
              </p>

              <div className="checkin-status">
                <span className="checkin-status-icon">✓</span>
                <div>
                  <strong>Owner check-in</strong>
                  <span>Requires a wallet transaction</span>
                </div>
              </div>

              <button
                className="primary-button"
                onClick={checkIn}
                disabled={isLoading || !walletAddress || !estateId}
              >
                {isLoading ? "Processing..." : "✓ Confirm Check-in"}
              </button>

              <p className="small-note">
                This records a check-in only. It does not trigger automatic
                inheritance or transfer funds.
              </p>
            </article>

            <article className="note-card">
              <div className="note-icon">ⓘ</div>
              <div>
                <strong>Prototype notice</strong>
                <p>
                  WARIS is running on a local test blockchain. Do not send
                  real assets. This contract does not yet support withdrawals
                  or inheritance payouts.
                </p>
              </div>
            </article>
          </div>
        </section>

        <footer className="main-footer">
          <span>WARIS · Digital Inheritance Platform</span>
          <span>Connected to local development blockchain</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
