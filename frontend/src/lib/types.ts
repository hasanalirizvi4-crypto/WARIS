export interface EstateRecord {
  id: bigint;
  owner: string;
  createdAt: bigint;
  createdAtBlock: bigint;
  lastCheckIn: bigint;
  inactivityPeriod: bigint;
  beneficiaryCount: number;
  allocatedShares: number;
  balance: bigint;
}

export interface BeneficiaryRow {
  address: string;
  share: number;
}

export interface CreationTx {
  hash: string;
  blockNumber: number;
  gasUsed: bigint;
  fee: bigint;
}

export interface AccountData {
  walletBalance: bigint | null;
  estate: EstateRecord | null;
  beneficiaries: BeneficiaryRow[];
  creationTx: CreationTx | null;
  error: string;
}

export interface AccountSnapshot extends AccountData {
  key: string;
}

export type ActionName =
  | "create"
  | "period"
  | "beneficiary"
  | "remove"
  | "checkin"
  | "switch"
  | "refresh";

export type TxPhase = "idle" | "wallet" | "pending" | "syncing";
export type StatusTone = "info" | "success" | "error";

export interface StatusMessage {
  text: string;
  tone: StatusTone;
}
