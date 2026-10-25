
import { useState } from "react";
import "./App.css";

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [beneficiaryAddress, setBeneficiaryAddress] = useState("");
  const [share, setShare] = useState("50");
  const [beneficiaries, setBeneficiaries] = useState<
    { address: string; share: number }[]
  >([]);

  async function connectWallet() {
    const ethereum = (window as Window & {
      ethereum?: {
        request: (args: {
          method: string;
        }) => Promise<string[]>;
      };
    }).ethereum;

    if (!ethereum) {
      alert("MetaMask is not installed. Please install the MetaMask browser extension.");
      return;
    }

    try {
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
      }
    } catch {
      alert("Wallet connection was cancelled or failed.");
    }
  }

  function addBeneficiary() {
    const address = beneficiaryAddress.trim();
    const shareNumber = Number(share);

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      alert("Please enter a valid Ethereum wallet address.");
      return;
    }

    if (address.toLowerCase() === walletAddress.toLowerCase()) {
      alert("Your own wallet cannot be added as a beneficiary.");
      return;
    }

    if (
      !Number.isInteger(shareNumber) ||
      shareNumber < 1 ||
      shareNumber > 100
    ) {
      alert("Share must be between 1 and 100.");
      return;
    }

    if (
      beneficiaries.some(
        (beneficiary) =>
          beneficiary.address.toLowerCase() === address.toLowerCase(),
      )
    ) {
      alert("This beneficiary has already been added.");
      return;
    }

    const totalShare = beneficiaries.reduce(
      (total, beneficiary) => total + beneficiary.share,
      0,
    );

    if (totalShare + shareNumber > 100) {
      alert("Combined beneficiary shares cannot exceed 100%.");
      return;
    }

    setBeneficiaries([
      ...beneficiaries,
      { address, share: shareNumber },
    ]);
    setBeneficiaryAddress("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <h1>WARIS</h1>
            <span>Digital Legacy Protocol</span>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav>
          <a className="nav-item active" href="#overview">
            <span>◫</span> Overview
          </a>
          <a className="nav-item" href="#estate">
            <span>▤</span> My Estate
          </a>
          <a className="nav-item" href="#beneficiaries">
            <span>♧</span> Beneficiaries
          </a>
          <a className="nav-item" href="#checkin">
            <span>◷</span> Proof of Life
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="security-dot" />
          <div>
            <strong>Self-custody</strong>
            <span>Your keys, your control</span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">ESTATE MANAGEMENT</p>
            <h2>Your legacy, protected.</h2>
          </div>
          <button className="connect-button" onClick={connectWallet}>
            <span className="wallet-icon">◇</span>
            {walletAddress
              ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : "Connect Wallet"}
          </button>
        </header>

        <section className="welcome-banner">
          <div className="banner-copy">
            <span className="pill">
              <span className="live-dot" /> NON-CUSTODIAL PROTOCOL
            </span>
            <h3>What you build today<br />can protect tomorrow.</h3>
            <p>
              Plan your digital inheritance with transparent,
              blockchain-based estate management.
            </p>
            <a className="banner-link" href="#estate">
              Explore your estate <span>↗</span>
            </a>
          </div>
          <div className="banner-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="shield">W</div>
            <div className="art-star star-one">✦</div>
            <div className="art-star star-two">✧</div>
          </div>
        </section>

        <section className="section-heading" id="estate">
          <div>
            <p className="eyebrow">YOUR PORTFOLIO</p>
            <h3>Estate overview</h3>
          </div>
          <span className="demo-badge">UI DEMO</span>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">
              <span>Total estate balance</span>
              <span className="stat-icon gold">◇</span>
            </div>
            <h4>— ETH</h4>
            <p className="muted">Connect to a deployed contract</p>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Beneficiaries</span>
              <span className="stat-icon purple">♧</span>
            </div>
            <h4>{beneficiaries.length.toString().padStart(2, "0")}</h4>
            <p className="muted">Added in this demo session</p>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Allocated shares</span>
              <span className="stat-icon green">%</span>
            </div>
            <h4>
              {beneficiaries.reduce(
                (total, beneficiary) => total + beneficiary.share,
                0,
              )}
              %
            </h4>
            <p className="muted">Of planned inheritance</p>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel" id="beneficiaries">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">SUCCESSION PLAN</p>
                <h3>Beneficiaries</h3>
              </div>
              <span className="count-badge">{beneficiaries.length}</span>
            </div>

            <p className="panel-description">
              Add wallet addresses and assign a percentage of your planned
              inheritance. These entries are currently stored only in this
              browser session.
            </p>

            <label htmlFor="beneficiary-address">Wallet address</label>
            <input
              id="beneficiary-address"
              value={beneficiaryAddress}
              onChange={(event) => setBeneficiaryAddress(event.target.value)}
              placeholder="0x..."
            />

            <label htmlFor="share">Inheritance share (%)</label>
            <div className="share-row">
              <input
                id="share"
                type="number"
                min="1"
                max="100"
                value={share}
                onChange={(event) => setShare(event.target.value)}
              />
              <button className="primary-button" onClick={addBeneficiary}>
                + Add beneficiary
              </button>
            </div>

            <div className="beneficiary-list">
              {beneficiaries.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">♧</span>
                  <strong>No beneficiaries yet</strong>
                  <p>Add a wallet address to begin your plan.</p>
                </div>
              ) : (
                beneficiaries.map((beneficiary) => (
                  <div className="beneficiary-row" key={beneficiary.address}>
                    <div className="beneficiary-avatar">
                      {beneficiary.address.slice(2, 4).toUpperCase()}
                    </div>
                    <div className="beneficiary-details">
                      <strong>
                        {beneficiary.address.slice(0, 8)}...
                        {beneficiary.address.slice(-6)}
                      </strong>
                      <span>Ethereum wallet</span>
                    </div>
                    <strong className="share-value">
                      {beneficiary.share}%
                    </strong>
                  </div>
                ))
              )}
            </div>
          </article>

          <div className="right-column">
            <article className="panel checkin-panel" id="checkin">
              <div className="checkin-symbol">◷</div>
              <p className="eyebrow">PERIODIC CONFIRMATION</p>
              <h3>Proof of life</h3>
              <p className="panel-description">
                Check in periodically to confirm your estate is being actively
                managed.
              </p>
              <div className="checkin-status">
                <span>Status</span>
                <strong><span className="status-dot" /> Not connected</strong>
              </div>
              <button
                className="secondary-button"
                onClick={() =>
                  alert(
                    "The check-in action will be enabled after the smart contract is connected.",
                  )
                }
              >
                Check in <span>→</span>
              </button>
            </article>

            <article className="note-card">
              <span className="note-icon">✦</span>
              <div>
                <strong>Designed for digital legacy</strong>
                <p>
                  WARIS aims to give you control over your succession plan
                  without sharing your private keys.
                </p>
              </div>
            </article>
          </div>
        </section>

        <footer className="footer">
          <span>WARIS © 2026</span>
          <span>University Final Year Project · Prototype</span>
          <span><span className="footer-dot" /> Interface preview</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
