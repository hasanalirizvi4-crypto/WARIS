export interface StageCoin {
  id: string;
  symbol: string;
  amountLabel: string;
  /** Value in ETH, used for sorting and stack height. */
  valueEth: number;
  caption: string;
  color: string;
}

export interface StageHeir {
  id: string;
  label: string;
  share: number;
}

export interface StageState {
  /** The door swings open (wallet connected, no estate yet). */
  doorOpen: boolean;
  /** A coral wax seal is on the door (estate exists). */
  sealed: boolean;
  /** Check-in period shown on the dial. */
  dialDays: number;
  /** The dial can be turned with the mouse. */
  dialInteractive: boolean;
  onDialChange?: (days: number) => void;
  /** Waiting on the wallet or the network: the dial spins. */
  spinning: boolean;
  coins: StageCoin[];
  heirs: StageHeir[];
  heartbeat: { visible: boolean; fraction: number; overdue: boolean };
  /** Increase to send one pulse wave (a confirmed check-in). */
  pulseKey: number;
  /** Increase to stamp the wax seal (a confirmed new estate). */
  sealKey: number;
  /** Something needs attention (wrong network, missing contract). */
  warning: boolean;
  /** Send a pulse every few seconds (landing story). */
  autoPulse: boolean;
  compact: boolean;
  reducedMotion: boolean;
}

/** Dial presets in days, placed clockwise from the top of the dial face. */
export const DIAL_PRESETS = [30, 60, 90, 180] as const;
