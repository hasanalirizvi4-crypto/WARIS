import { useState } from "react";
import type { Waris } from "../hooks/useWaris";
import {
  MAX_BENEFICIARIES,
  MAX_INACTIVITY_DAYS,
  MIN_INACTIVITY_DAYS,
  WARIS_CONTRACT_ADDRESS,
  WARIS_CONTRACT_ADDRESS_INVALID,
  WARIS_CONTRACT_CONFIGURED,
  WARIS_EXPLORER_URL,
  WARIS_IS_LOCAL,
  WARIS_NETWORK_NAME,
  WARIS_NETWORK_SETTING_INVALID,
} from "../warisConfig";
import { formatDateTime, formatDays, formatNumber, formatTimeLeft, shortAddress } from "../lib/format";
import { ExplorerLink } from "./ExplorerLink";
import { SetupSteps } from "./SetupSteps";

type Tab = "setup" | "heirs" | "checkin";
const PERIOD_PRESETS = [30, 60, 90, 180];

function contractHelpFor(w: Waris) {
  if (!w.isConnected) return "Connect your wallet to continue.";
  if (!w.isOnWarisNetwork) return `Switch ${w.walletName} to ${WARIS_NETWORK_NAME} to continue.`;
  if (!WARIS_CONTRACT_CONFIGURED) {
    return WARIS_CONTRACT_ADDRESS_INVALID
      ? "Correct the contract address in frontend/.env.local before continuing."
      : "Available once the WARIS contract is deployed.";
  }
  if (w.accountError) return w.accountError;
  if (w.isLoadingAccount) return "Loading your estate from the blockchain…";
  return "";
}

function PeriodPicker({ w }: { w: Waris }) {
  return (
    <fieldset className="period">
      <legend>{w.estate ? "Change your check-in period" : "Choose your check-in period"}</legend>
      <p className="hint">Turn the dial on the vault, pick a common period, or type any number of days ({MIN_INACTIVITY_DAYS}–{formatNumber(MAX_INACTIVITY_DAYS)}).</p>
      <div className="period-options" role="group" aria-label="Common check-in periods">
        {PERIOD_PRESETS.map((period) => (
          <button
            className={w.inactivityDays === String(period) ? "period-option is-selected" : "period-option"}
            type="button"
            key={period}
            aria-pressed={w.inactivityDays === String(period)}
            onClick={() => w.setInactivityDays(String(period))}
          >
            <strong>{period}</strong>
            <span>days</span>
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor="inactivityDays">Custom period</label>
      <div className="input-unit">
        <input
          id="inactivityDays"
          className="input"
          type="number"
          min={MIN_INACTIVITY_DAYS}
          max={MAX_INACTIVITY_DAYS}
          step="1"
          inputMode="numeric"
          value={w.inactivityDays}
          onChange={(event) => w.setInactivityDays(event.target.value)}
          aria-describedby="period-summary"
        />
        <span>days</span>
      </div>
      <p className={w.validPeriod ? "period-summary" : "period-summary is-error"} id="period-summary" aria-live="polite">
        {w.validPeriod
          ? <><strong>{formatNumber(w.periodDays)} {w.periodDays === 1 ? "day" : "days"}</strong> = {formatNumber(w.periodSeconds)} seconds sent to the contract</>
          : w.periodError}
      </p>
    </fieldset>
  );
}

function SetupTab({ w, help }: { w: Waris; help: string }) {
  const focusPeriod = () => {
    const input = document.getElementById("inactivityDays");
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus({ preventScroll: true });
  };

  return (
    <div className="tab-body">
      <SetupSteps waris={w} onChoosePeriod={focusPeriod} />
      <PeriodPicker w={w} />
      {w.estate ? (
        <button
          className="btn btn--ink btn--block"
          type="button"
          onClick={w.updatePeriod}
          disabled={w.isBusy || !w.canUseContract || !w.validPeriod || w.periodUnchanged}
          data-action="update-period"
        >
          {w.activeAction === "period" ? "Updating period…" : "Update check-in period"}
        </button>
      ) : (
        <button
          className="btn btn--coral btn--block btn--large"
          type="button"
          onClick={w.createEstate}
          disabled={w.isBusy || !w.canUseContract || !w.validPeriod}
          data-action="create-estate"
        >
          {w.isCreating ? "Creating estate record…" : "Create estate record"}
        </button>
      )}
      <p className="button-help">
        {help ||
          (w.estate
            ? w.periodUnchanged
              ? "This is your current period. Choose a different one to update it."
              : `${w.walletName} will show the transaction before anything changes.`
            : `${w.walletName} will show the transaction and gas fee before anything is written.`)}
      </p>
    </div>
  );
}

function HeirsTab({ w, help }: { w: Waris; help: string }) {
  const { beneficiaries, allocatedShares } = w;
  return (
    <div className="tab-body">
      <div className="allocation">
        <div className="allocation-head">
          <span>Shares assigned</span>
          <strong>{allocatedShares}% <small>of 100%</small></strong>
        </div>
        <div
          className="meter"
          role="progressbar"
          aria-label="Heir shares assigned"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={allocatedShares}
        >
          <span style={{ width: `${Math.min(allocatedShares, 100)}%` }} />
        </div>
        <span className="allocation-free">{100 - allocatedShares}% still free</span>
      </div>

      <div className="heir-form">
        <label className="field-label" htmlFor="beneficiaryAddress">Heir’s wallet address</label>
        <input
          id="beneficiaryAddress"
          className="input input--mono"
          type="text"
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          value={w.beneficiaryAddress}
          onChange={(event) => w.setBeneficiaryAddress(event.target.value)}
        />
        <label className="field-label" htmlFor="share">Share</label>
        <div className="input-unit">
          <input
            id="share"
            className="input"
            type="number"
            min="1"
            max="100"
            step="1"
            inputMode="numeric"
            value={w.share}
            onChange={(event) => w.setShare(event.target.value)}
          />
          <span>%</span>
        </div>
        <button
          className="btn btn--coral btn--block"
          type="button"
          onClick={w.addBeneficiary}
          disabled={w.isBusy || !w.canUseContract || !w.estate}
          data-action="add-heir"
        >
          {w.activeAction === "beneficiary" ? "Adding heir…" : "Add heir"}
        </button>
        <p className="button-help">
          {help || (!w.estate
            ? "Create your estate first, then name your heirs."
            : `Up to ${MAX_BENEFICIARIES} heirs. Each change needs its own approval in ${w.walletName}.`)}
        </p>
      </div>

      <ul className="heir-list" aria-live="polite">
        {beneficiaries.length === 0 ? (
          <li className="heir-empty">
            <strong>No heirs yet</strong>
            <span>Heirs you add appear here and around the vault.</span>
          </li>
        ) : (
          beneficiaries.map((beneficiary) => (
            <li className="heir-row" key={beneficiary.address}>
              <span className="heir-mark" aria-hidden="true">{beneficiary.share}%</span>
              <span className="heir-address">
                <ExplorerLink path={`/address/${beneficiary.address}`} className="" arrow={false}>
                  {shortAddress(beneficiary.address, 8, 6)}
                </ExplorerLink>
                <small>{beneficiary.share}% of the estate</small>
              </span>
              <button
                className="heir-remove"
                type="button"
                onClick={() => w.removeBeneficiary(beneficiary.address)}
                disabled={w.isBusy || !w.canUseContract}
                aria-label={`Remove heir ${beneficiary.address}`}
              >
                {w.activeAction === "remove" ? "…" : "Remove"}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function CheckinTab({ w, help }: { w: Waris; help: string }) {
  const { estate, secondsLeft, isOverdue, checkInDeadline, heartbeatFraction } = w;
  const daysLeft = estate ? Math.max(0, Math.floor(secondsLeft / 86_400)) : null;

  return (
    <div className="tab-body">
      <div className={isOverdue ? "heartbeat is-overdue" : "heartbeat"}>
        <div className="heartbeat-count" aria-live="polite">
          <strong>{estate ? (isOverdue ? "0" : formatNumber(daysLeft ?? 0)) : "—"}</strong>
          <span>{estate ? (isOverdue ? "Deadline passed" : daysLeft === 1 ? "day left" : "days left") : "No estate yet"}</span>
        </div>
        <div className="heartbeat-bar" aria-hidden="true">
          <span style={{ width: `${Math.round(heartbeatFraction * 100)}%` }} />
        </div>
        <p className="heartbeat-detail">
          {estate && checkInDeadline
            ? <>{formatTimeLeft(secondsLeft)}. Last check-in {formatDateTime(estate.lastCheckIn)}, deadline {formatDateTime(checkInDeadline)}.</>
            : w.isConnected
              ? "Create your estate to start the check-in timer."
              : "Connect the owner wallet to continue."}
        </p>
      </div>

      <button
        className="btn btn--lime btn--block btn--large"
        type="button"
        onClick={w.checkIn}
        disabled={w.isBusy || !w.canUseContract || !estate}
        data-action="check-in"
      >
        {w.activeAction === "checkin" ? "Confirming check-in…" : "Check in now"}
      </button>
      <p className="button-help">
        {help || (estate
          ? `Your check-in period is ${formatDays(estate.inactivityPeriod)}. Each check-in resets the clock.`
          : "")}
      </p>
      <p className="fine-print">
        A missed check-in is not proof of death. This prototype records activity only;
        it does not transfer funds or pay out inheritances yet.
      </p>
    </div>
  );
}

/** The connected workspace: a paper panel next to the 3D vault. */
export function Workspace({ waris: w }: { waris: Waris }) {
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  // Returning owners open on Check-in. Right after creating an estate, stay on Setup to see all four steps done.
  const tab: Tab = chosenTab ?? (w.estate && w.sealKey === 0 ? "checkin" : "setup");
  const help = contractHelpFor(w);

  const tabs: { id: Tab; label: string; badge?: string }[] = [
    { id: "setup", label: "Setup" },
    { id: "heirs", label: "Heirs", badge: w.beneficiaries.length ? String(w.beneficiaries.length) : undefined },
    { id: "checkin", label: "Check-in" },
  ];

  return (
    <main className="workspace" id="top">
      <div className="panel">
        <header className="panel-head">
          {w.estate ? (
            <>
              <div className="panel-title-row">
                <h1>Estate #{w.estate.id.toString()}</h1>
                <span className={w.isOverdue ? "chip chip--alert" : "chip chip--alive"}>
                  {w.isOverdue ? "Overdue" : "Active"}
                </span>
              </div>
              <p>
                {w.beneficiaries.length} {w.beneficiaries.length === 1 ? "heir" : "heirs"}, {w.allocatedShares}% assigned, {formatTimeLeft(w.secondsLeft).toLowerCase()}.
              </p>
            </>
          ) : (
            <>
              <h1>Set up your vault</h1>
              <p>Four steps, each one recorded on Ethereum.</p>
            </>
          )}
        </header>

        {(WARIS_NETWORK_SETTING_INVALID || !WARIS_CONTRACT_CONFIGURED || (WARIS_CONTRACT_CONFIGURED && w.accountError)) && (
          <aside className="notice" role="alert">
            {WARIS_NETWORK_SETTING_INVALID && (
              <p><strong>Unknown VITE_WARIS_NETWORK value.</strong> Use <code>sepolia</code> or <code>localhost</code> in <code>frontend/.env.local</code>. WARIS is using {WARIS_NETWORK_NAME} for now.</p>
            )}
            {!WARIS_CONTRACT_CONFIGURED && (
              <p>
                <strong>{WARIS_CONTRACT_ADDRESS_INVALID ? "The configured contract address is invalid." : "The contract still needs deploying."}</strong>{" "}
                {WARIS_IS_LOCAL
                  ? <>Start <code>npx hardhat node</code>, run <code>npx hardhat run scripts/deploy-local.ts --network localhost</code>, then restart the frontend.</>
                  : <>Add its public address as <code>VITE_WARIS_CONTRACT_ADDRESS</code> in <code>frontend/.env.local</code>, then restart the frontend.</>}
              </p>
            )}
            {WARIS_CONTRACT_CONFIGURED && w.accountError && (
              <p><strong>WARIS could not read the contract.</strong> {w.accountError}</p>
            )}
          </aside>
        )}

        <div className="tabs" role="tablist" aria-label="Estate sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              className={tab === item.id ? "tab is-active" : "tab"}
              onClick={() => setChosenTab(item.id)}
            >
              {item.label}
              {item.badge && <span className="tab-badge">{item.badge}</span>}
            </button>
          ))}
        </div>

        <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} key={tab}>
          {tab === "setup" && <SetupTab w={w} help={help} />}
          {tab === "heirs" && <HeirsTab w={w} help={help} />}
          {tab === "checkin" && <CheckinTab w={w} help={help} />}
        </div>

        <div className="panel-foot">
          <div className={`status is-${w.status.tone}`} role="status" aria-live="polite" aria-atomic="true">
            <span className="status-dot" aria-hidden="true" />
            <span>
              {w.status.text}
              {w.pendingTxHash && (
                <> <ExplorerLink path={`/tx/${w.pendingTxHash}`}>{shortAddress(w.pendingTxHash, 10, 8)}</ExplorerLink></>
              )}
            </span>
          </div>
          <div className="panel-foot-row">
            {w.account && (
              <button className="link-button" type="button" onClick={w.refresh} disabled={w.isBusy}>
                {w.activeAction === "refresh" ? "Refreshing…" : "Refresh from blockchain"}
              </button>
            )}
            {WARIS_CONTRACT_CONFIGURED && (
              <span className="contract-ref">
                Contract{" "}
                {WARIS_EXPLORER_URL
                  ? <ExplorerLink path={`/address/${WARIS_CONTRACT_ADDRESS}`} arrow={false} className="">{shortAddress(WARIS_CONTRACT_ADDRESS)}</ExplorerLink>
                  : shortAddress(WARIS_CONTRACT_ADDRESS)}
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
