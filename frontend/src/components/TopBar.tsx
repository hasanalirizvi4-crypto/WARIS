import type { Waris } from "../hooks/useWaris";
import { WARIS_CHAIN_ID, WARIS_NETWORK_NAME, WARIS_NETWORK_SHORT_NAME } from "../warisConfig";
import { shortAddress } from "../lib/format";

export function TopBar({ waris }: { waris: Waris }) {
  const {
    isConnected,
    isOnWarisNetwork,
    walletName,
    walletAddress,
    step1Done,
    isBusy,
    isDiscoveringWallets,
    connectingWalletId,
    activeAction,
  } = waris;

  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="WARIS home">
        <span className="brand-logo"><img src="/logo.png" alt="" /></span>
        <span className="brand-name">WARIS</span>
      </a>

      <div className="topbar-actions">
        <span className={isConnected && !isOnWarisNetwork ? "network-pill is-warning" : "network-pill"}>
          <span className="network-dot" aria-hidden="true" />
          {isConnected && !isOnWarisNetwork ? "Wrong network" : `${WARIS_NETWORK_NAME} · ${WARIS_CHAIN_ID}`}
        </span>
        {isConnected && !isOnWarisNetwork && (
          <button className="btn btn--ghost btn--small" type="button" onClick={waris.switchNetwork} disabled={isBusy}>
            {activeAction === "switch" ? "Switching…" : `Switch to ${WARIS_NETWORK_SHORT_NAME}`}
          </button>
        )}
        <button
          className={isConnected ? "connect-button is-connected" : "connect-button"}
          type="button"
          onClick={() => {
            if (isConnected) void waris.disconnectWallet();
            else void waris.openWalletPicker();
          }}
          disabled={isBusy || isDiscoveringWallets || connectingWalletId !== ""}
          title={isConnected ? `${walletName} · ${walletAddress}. Click to disconnect.` : undefined}
          aria-label={isConnected ? `Disconnect ${walletName} (${walletAddress})` : undefined}
        >
          {isDiscoveringWallets
            ? "Finding wallets…"
            : connectingWalletId
              ? "Connecting…"
              : isConnected
                ? (
                  <>
                    <span className={step1Done ? "connect-button-dot" : "connect-button-dot is-warning"} aria-hidden="true" />
                    <span className="connect-button-label">
                      <span className="connect-button-address">{shortAddress(walletAddress)}</span>
                      <span className="connect-button-hover" aria-hidden="true">Disconnect</span>
                    </span>
                  </>
                )
                : "Connect wallet"}
        </button>
      </div>
    </header>
  );
}
