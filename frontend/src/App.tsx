import { useCallback, useMemo, useState } from "react";
import { formatEther } from "ethers";
import { useWaris } from "./hooks/useWaris";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { TopBar } from "./components/TopBar";
import { Landing, type LandingAct } from "./components/Landing";
import { Workspace } from "./components/Workspace";
import { WalletPicker } from "./components/WalletPicker";
import { Stage } from "./components/stage/Stage";
import type { StageState } from "./components/stage/stageTypes";
import { formatEth, shortAddress } from "./lib/format";
import { SECONDS_PER_DAY, WARIS_NETWORK_SHORT_NAME } from "./warisConfig";
import "./App.css";

// Example heirs for the landing story only.
const DEMO_HEIRS = [
  { id: "demo-a", label: "0x8f3a…21c0", share: 50 },
  { id: "demo-b", label: "0x41bd…9e07", share: 30 },
  { id: "demo-c", label: "0xc72e…5af4", share: 20 },
];

function App() {
  const waris = useWaris();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const compact = useMediaQuery("(max-width: 860px)");
  const [landingAct, setLandingAct] = useState<LandingAct>(0);
  const [landingDays, setLandingDays] = useState(90);
  const onActChange = useCallback((act: LandingAct) => setLandingAct(act), []);

  const mode = waris.isConnected ? "app" : "landing";

  const {
    step1Done,
    estate,
    isCreating,
    txPhase,
    isBusy,
    isLoadingAccount,
    validPeriod,
    periodDays,
    walletBalance,
    beneficiaries,
    heartbeatFraction,
    isOverdue,
    pulseKey,
    sealKey,
    isConnected,
    isOnWarisNetwork,
    accountError,
    setInactivityDays,
  } = waris;

  const stageState: StageState = useMemo(() => {
    if (mode === "landing") {
      return {
        doorOpen: false,
        sealed: landingAct >= 2,
        dialDays: landingDays,
        dialInteractive: true,
        onDialChange: setLandingDays,
        spinning: false,
        coins: [],
        heirs: landingAct >= 2 ? DEMO_HEIRS : [],
        heartbeat: { visible: landingAct === 3, fraction: 0.62, overdue: false },
        pulseKey: 0,
        sealKey: landingAct >= 2 ? 1 : 0,
        warning: false,
        autoPulse: landingAct === 3,
        compact,
        reducedMotion,
      };
    }

    const estateDays = estate ? Number(estate.inactivityPeriod) / SECONDS_PER_DAY : 30;
    return {
      // The door stays open while you set up, and closes once the transaction is submitted.
      doorOpen: step1Done && !estate && !(isCreating && txPhase !== "wallet"),
      sealed: Boolean(estate),
      dialDays: validPeriod ? periodDays : estateDays,
      dialInteractive: step1Done && !isBusy,
      onDialChange: (days: number) => setInactivityDays(String(days)),
      spinning: (isBusy && txPhase !== "idle") || isLoadingAccount,
      coins: walletBalance !== null
        ? [{
          id: "eth",
          symbol: "ETH",
          amountLabel: formatEth(walletBalance, 4),
          valueEth: Number(formatEther(walletBalance)),
          caption: "In your wallet",
          color: "#AFC3E6",
        }]
        : [],
      heirs: beneficiaries.map((beneficiary) => ({
        id: beneficiary.address,
        label: shortAddress(beneficiary.address),
        share: beneficiary.share,
      })),
      heartbeat: { visible: Boolean(estate), fraction: heartbeatFraction, overdue: isOverdue },
      pulseKey,
      sealKey,
      warning: (isConnected && !isOnWarisNetwork) || Boolean(accountError),
      autoPulse: false,
      compact,
      reducedMotion,
    };
  }, [
    mode, landingAct, landingDays, compact, reducedMotion, step1Done, estate, isCreating, txPhase,
    isBusy, isLoadingAccount, validPeriod, periodDays, walletBalance, beneficiaries, heartbeatFraction,
    isOverdue, pulseKey, sealKey, isConnected, isOnWarisNetwork, accountError, setInactivityDays,
  ]);

  let caption: string | undefined;
  if (mode === "landing") {
    caption = landingAct === 0 || landingAct === 1
      ? `Drag the dial: ${landingDays} days`
      : landingAct === 2
        ? "Example heirs and their shares"
        : "The heartbeat ring drains toward the deadline";
  } else if (isConnected && !isOnWarisNetwork) {
    caption = `Switch to ${WARIS_NETWORK_SHORT_NAME} to open the vault`;
  } else if (estate) {
    caption = isOverdue ? `Estate #${estate.id} is overdue` : `Estate #${estate.id} is sealed`;
  } else if (step1Done) {
    caption = "Turn the dial to choose your check-in period";
  }

  return (
    <div className={`app app--${mode}`}>
      <TopBar waris={waris} />
      <div className="stage-shell">
        <Stage state={stageState} caption={caption} />
      </div>
      {mode === "landing"
        ? <Landing onConnect={() => void waris.openWalletPicker()} onActChange={onActChange} busy={waris.isDiscoveringWallets} />
        : <Workspace waris={waris} />}
      <WalletPicker waris={waris} />
    </div>
  );
}

export default App;
