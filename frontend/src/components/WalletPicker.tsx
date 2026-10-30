import type { Waris } from "../hooks/useWaris";

/** The wallet chooser. It can always be closed, even while a request waits in the wallet. */
export function WalletPicker({ waris }: { waris: Waris }) {
  const {
    isWalletPickerOpen,
    isDiscoveringWallets,
    walletOptions,
    connectingWalletId,
    walletPickerMessage,
    closeWalletPicker,
    connectWallet,
    openWalletPicker,
  } = waris;
  if (!isWalletPickerOpen) return null;
  const connectingName = walletOptions.find((wallet) => wallet.id === connectingWalletId)?.name ?? "your wallet";

  return (
    <div className="picker-backdrop" onClick={closeWalletPicker}>
      <section
        className="picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="picker-close"
          type="button"
          aria-label={connectingWalletId ? "Cancel and close wallet selection" : "Close wallet selection"}
          onClick={closeWalletPicker}
        >
          ×
        </button>
        <h2 id="picker-title">Choose a wallet</h2>
        <p className="picker-intro">
          Pick the browser wallet WARIS should use. It will ask you to approve the
          connection; WARIS only ever sees your public address.
        </p>

        {isDiscoveringWallets ? (
          <div className="picker-empty" role="status" aria-live="polite">Looking for wallet extensions…</div>
        ) : walletOptions.length > 0 ? (
          <div className="picker-list" aria-label="Detected browser wallets">
            {walletOptions.map((wallet) => (
              <button
                className="wallet-option"
                key={wallet.id}
                type="button"
                disabled={connectingWalletId !== ""}
                onClick={() => void connectWallet(wallet)}
              >
                <span className="wallet-option-mark" aria-hidden="true">{wallet.name.slice(0, 1).toUpperCase()}</span>
                <span className="wallet-option-copy">
                  <strong>{wallet.name}</strong>
                  <small>Detected in this browser</small>
                </span>
                <span className="wallet-option-action">
                  {connectingWalletId === wallet.id ? "Connecting…" : "Select"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="picker-empty" role="status" aria-live="polite">
            {walletPickerMessage || "No compatible browser wallets were detected."}
          </div>
        )}

        {!isDiscoveringWallets && walletOptions.length === 0 && (
          <button className="link-button picker-retry" type="button" onClick={() => void openWalletPicker()}>
            Scan again
          </button>
        )}

        {connectingWalletId && (
          <p className="picker-waiting" role="status" aria-live="polite">
            Waiting for {connectingName} to answer. If no window opened, click its icon in your browser
            toolbar: the request may be waiting there. Close this window to cancel.
          </p>
        )}

        {walletPickerMessage && walletOptions.length > 0 && (
          <p className="picker-error" role="status" aria-live="polite">{walletPickerMessage}</p>
        )}
        <p className="picker-footnote">
          WARIS never sees your recovery phrase or private key. Every transaction is
          reviewed and signed in the wallet you choose.
        </p>
      </section>
    </div>
  );
}
