import type { ReactNode } from "react";
import type { Waris } from "../hooks/useWaris";
import {
  SECONDS_PER_DAY,
  WARIS_CHAIN_ID,
  WARIS_CONTRACT_CONFIGURED,
  WARIS_CURRENCY_SYMBOL,
  WARIS_IS_LOCAL,
  WARIS_NETWORK_NAME,
  WARIS_NETWORK_SHORT_NAME,
  WARIS_TEST_ETH_LABEL,
} from "../warisConfig";
import { formatDateTime, formatDays, formatEth, formatNumber, shortAddress } from "../lib/format";
import { ExplorerLink } from "./ExplorerLink";

interface StepFact {
  label: string;
  value: ReactNode;
}

interface FlowStep {
  number: number;
  state: "done" | "current" | "upcoming";
  busy?: boolean;
  title: string;
  body: ReactNode;
  facts: StepFact[];
  note?: ReactNode;
  action?: ReactNode;
}

function buildSteps(w: Waris, onChoosePeriod: () => void): FlowStep[] {
  const {
    walletName,
    walletAddress,
    walletChainId,
    walletBalance,
    isConnected,
    step1Done,
    hasNoGas,
    estate,
    creationTx,
    isCreating,
    txPhase,
    pendingTxHash,
    validPeriod,
    periodDays,
    periodSeconds,
    periodError,
    canUseContract,
    accountError,
    isLoadingAccount,
    activeAction,
    isBusy,
  } = w;
  const walletLabel = walletName === "your wallet" ? "Your wallet" : walletName;

  const pendingTxLink = pendingTxHash
    ? <ExplorerLink path={`/tx/${pendingTxHash}`}>{shortAddress(pendingTxHash, 10, 8)}</ExplorerLink>
    : null;
  const gasWarning = step1Done && hasNoGas && !estate
    ? WARIS_IS_LOCAL
      ? <>This account has 0 {WARIS_CURRENCY_SYMBOL}. Import one of the funded test accounts printed by <code>npx hardhat node</code> into your wallet.</>
      : <>This wallet has 0 {WARIS_CURRENCY_SYMBOL}. Get free Sepolia test ETH from a faucet first, because the transaction needs a small gas fee.</>
    : undefined;

  const step1: FlowStep = step1Done
    ? {
      number: 1,
      state: "done",
      title: "You connected your wallet",
      body: <>WARIS identified your public Ethereum address through {walletName}. Your private key stays in {walletName}.</>,
      facts: [
        { label: "Wallet", value: walletName },
        { label: "Public address", value: <ExplorerLink path={`/address/${walletAddress}`}>{shortAddress(walletAddress)}</ExplorerLink> },
        { label: "Network", value: `${WARIS_NETWORK_NAME} · ${WARIS_CHAIN_ID}` },
        { label: "Balance", value: walletBalance === null ? "Loading…" : formatEth(walletBalance, 4) },
      ],
      note: gasWarning,
    }
    : isConnected
      ? {
        number: 1,
        state: "current",
        title: "Connect your wallet",
        body: <>{walletName} is connected, but it is on another network (chain ID {walletChainId?.toString() ?? "unknown"}). Switch it to {WARIS_NETWORK_NAME} to continue.</>,
        facts: [{ label: "Public address", value: shortAddress(walletAddress) }],
        action: (
          <button className="btn btn--small" type="button" onClick={w.switchNetwork} disabled={isBusy}>
            {activeAction === "switch" ? "Switching…" : `Switch to ${WARIS_NETWORK_SHORT_NAME}`}
          </button>
        ),
      }
      : {
        number: 1,
        state: "current",
        title: "Connect your wallet",
        body: "Choose the browser wallet WARIS should use. WARIS only reads your public Ethereum address; your private key never leaves the wallet.",
        facts: [],
      };

  const step2: FlowStep = estate
    ? {
      number: 2,
      state: "done",
      title: "You chose an inactivity period",
      body: <>You entered {formatDays(estate.inactivityPeriod)}. WARIS converted that into {formatNumber(estate.inactivityPeriod)} seconds because the smart contract works with timestamps and seconds.</>,
      facts: [
        { label: "Days", value: formatDays(estate.inactivityPeriod) },
        { label: "Seconds", value: formatNumber(estate.inactivityPeriod) },
        { label: "Formula", value: `days × ${formatNumber(SECONDS_PER_DAY)}` },
      ],
    }
    : validPeriod
      ? {
        number: 2,
        state: step1Done ? "done" : "upcoming",
        title: step1Done ? "You chose an inactivity period" : "Choose an inactivity period",
        body: <>You entered {formatNumber(periodDays)} {periodDays === 1 ? "day" : "days"}. WARIS converts that into {formatNumber(periodSeconds)} seconds because the smart contract works with timestamps and seconds.</>,
        facts: [
          { label: "Days", value: formatNumber(periodDays) },
          { label: "Seconds", value: formatNumber(periodSeconds) },
          { label: "Formula", value: `${formatNumber(periodDays)} × ${formatNumber(SECONDS_PER_DAY)}` },
        ],
        action: <button className="link-button" type="button" onClick={onChoosePeriod}>Change period</button>,
      }
      : {
        number: 2,
        state: step1Done ? "current" : "upcoming",
        title: "Choose an inactivity period",
        body: periodError,
        facts: [],
        action: <button className="link-button" type="button" onClick={onChoosePeriod}>Choose a period</button>,
      };

  let step3: FlowStep;
  if (estate) {
    step3 = {
      number: 3,
      state: "done",
      title: "The smart contract created your estate record",
      body: <>The contract saved your wallet address as the owner, recorded the creation time as your last check-in, and stored the {formatDays(estate.inactivityPeriod)} inactivity period.</>,
      facts: [
        { label: "Estate ID", value: `#${estate.id}` },
        { label: "Owner", value: <ExplorerLink path={`/address/${estate.owner}`}>{shortAddress(estate.owner)}</ExplorerLink> },
        { label: "Created", value: formatDateTime(estate.createdAt) },
        {
          label: "Last check-in",
          value: estate.lastCheckIn === estate.createdAt ? "Same as creation time" : formatDateTime(estate.lastCheckIn),
        },
        { label: "Period stored", value: `${formatNumber(estate.inactivityPeriod)} seconds` },
      ],
    };
  } else if (isCreating) {
    step3 = {
      number: 3,
      state: "current",
      busy: true,
      title: "The smart contract creates your estate record",
      body: txPhase === "syncing"
        ? "Confirmed. Reading the new record back from the contract…"
        : "Waiting for the transaction. Once it is in a block, the contract saves your address as the owner, records the creation time as your last check-in, and stores the period.",
      facts: [],
    };
  } else if (canUseContract && !estate && step1Done && validPeriod) {
    step3 = {
      number: 3,
      state: "current",
      title: "The smart contract creates your estate record",
      body: <>Ready. When you create the record, the contract will save your wallet address as the owner, record the creation time as your last check-in, and store the {formatNumber(periodDays)}-day inactivity period.</>,
      facts: [],
    };
  } else {
    step3 = {
      number: 3,
      state: "upcoming",
      title: "The smart contract creates your estate record",
      body: !WARIS_CONTRACT_CONFIGURED
        ? `Available after the WARIS contract is deployed to ${WARIS_NETWORK_NAME} and its address is added to frontend/.env.local.`
        : accountError
          ? accountError
          : isLoadingAccount
            ? "Checking whether this wallet already has an estate…"
            : "After steps 1 and 2, the contract saves your wallet address as the owner, records the creation time as your last check-in, and stores the inactivity period.",
      facts: [],
    };
  }

  let step4: FlowStep;
  if (estate) {
    step4 = creationTx
      ? {
        number: 4,
        state: "done",
        title: `${walletLabel} submitted and confirmed the transaction`,
        body: <>You approved the transaction, paid a gas fee of {formatEth(creationTx.fee)} ({WARIS_TEST_ETH_LABEL}), and the blockchain recorded the estate in block #{formatNumber(creationTx.blockNumber)}.</>,
        facts: [
          { label: "Transaction", value: <ExplorerLink path={`/tx/${creationTx.hash}`}>{shortAddress(creationTx.hash, 10, 8)}</ExplorerLink> },
          { label: "Block", value: <ExplorerLink path={`/block/${creationTx.blockNumber}`}>#{formatNumber(creationTx.blockNumber)}</ExplorerLink> },
          { label: "Gas used", value: `${formatNumber(creationTx.gasUsed)} units` },
          { label: "Gas fee", value: formatEth(creationTx.fee) },
        ],
      }
      : {
        number: 4,
        state: "done",
        title: `${walletLabel} submitted and confirmed the transaction`,
        body: `You approved the transaction, paid a small amount of ${WARIS_TEST_ETH_LABEL} for gas, and the blockchain recorded the estate. The record in step 3 is read directly from the contract.`,
        facts: [
          { label: "Block", value: <ExplorerLink path={`/block/${estate.createdAtBlock}`}>#{formatNumber(estate.createdAtBlock)}</ExplorerLink> },
        ],
      };
  } else if (isCreating) {
    step4 = {
      number: 4,
      state: "current",
      busy: true,
      title: `${walletName} submits and confirms the transaction`,
      body: txPhase === "wallet"
        ? <>Waiting for your approval in {walletName}. Check the wallet window: it shows the gas fee before anything is sent.</>
        : txPhase === "pending"
          ? <>Submitted. Waiting for {WARIS_NETWORK_NAME} to include it in a block (usually 10–30 seconds).</>
          : "Confirmed in a block. Reading the receipt…",
      facts: pendingTxLink ? [{ label: "Transaction", value: pendingTxLink }] : [],
    };
  } else {
    step4 = {
      number: 4,
      state: "upcoming",
      title: `${walletLabel} submits and confirms the transaction`,
      body: <>{walletLabel} will ask you to approve the transaction. You pay a small amount of {WARIS_TEST_ETH_LABEL} for gas, then the blockchain records the estate.</>,
      facts: [],
      note: gasWarning,
    };
  }

  return [step1, step2, step3, step4];
}

/** The four creation steps as a vertical rail. Done steps fold their details away. */
export function SetupSteps({ waris, onChoosePeriod }: { waris: Waris; onChoosePeriod: () => void }) {
  const steps = buildSteps(waris, onChoosePeriod);
  const completed = steps.filter((step) => step.state === "done").length;

  return (
    <section className="steps" aria-labelledby="steps-title" id="steps">
      <div className="steps-head">
        <h3 id="steps-title">How your estate is created</h3>
        <span className="steps-count" aria-label={`${completed} of 4 steps complete`}>{completed}/4</span>
      </div>
      <ol className="steps-rail">
        {steps.map((step) => (
          <li
            key={step.number}
            className={`flow-step is-${step.state}${step.busy ? " is-busy" : ""}`}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <span className="flow-step-number" aria-hidden="true">
              {step.state === "done" ? "✓" : step.number}
            </span>
            <div className="flow-step-content">
              <div className="flow-step-top">
                <h4>{step.title}</h4>
                <span className="flow-step-state">
                  {step.busy && <span className="spinner" aria-hidden="true" />}
                  {step.state === "done" ? "Done" : step.busy ? "In progress" : step.state === "current" ? "Next" : "Waiting"}
                </span>
              </div>
              <p className="flow-step-body">{step.body}</p>
              {step.facts.length > 0 && (
                <dl className="facts">
                  {step.facts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {step.note && <p className="flow-note">{step.note}</p>}
              {step.action && <div className="flow-step-action">{step.action}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
