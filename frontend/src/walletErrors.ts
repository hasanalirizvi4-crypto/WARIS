// Turns wallet, RPC and contract errors into short, human-readable messages.
import { WARIS_IS_LOCAL, WARIS_NETWORK_NAME, WARIS_TEST_ETH_LABEL } from "./warisConfig";

const CONTRACT_REASONS: Record<string, string> = {
  "Wallet already has an estate":
    "This wallet already has a WARIS estate. Each wallet can own one estate.",
  "Period must be at least one day":
    "The check-in period must be at least 1 day.",
  "Period cannot exceed 3650 days":
    "The check-in period cannot be longer than 3650 days (about 10 years).",
  "Only estate owner": "Only the wallet that owns this estate can do that.",
  "Estate does not exist": "That estate does not exist on this contract.",
  "Invalid wallet": "Enter a valid beneficiary wallet address.",
  "Owner cannot be beneficiary":
    "The estate owner cannot be their own beneficiary.",
  "Share must be greater than zero": "A share must be at least 1%.",
  "Share cannot exceed 100": "A share cannot be more than 100%.",
  "Beneficiary already exists": "This wallet is already a beneficiary.",
  "Too many beneficiaries": "An estate can have up to 20 beneficiaries.",
  "Total shares exceed 100": "Total beneficiary shares cannot exceed 100%.",
  "Beneficiary not found": "That wallet is not a beneficiary of this estate.",
  "Deposit must be greater than zero": "Enter an amount greater than zero.",
  "Amount must be greater than zero": "Enter an amount greater than zero.",
  "Insufficient estate balance": "The estate balance is too low for that withdrawal.",
};

type ErrorLike = {
  code?: unknown;
  reason?: unknown;
  shortMessage?: unknown;
  message?: unknown;
  info?: { error?: unknown };
  error?: unknown;
  data?: unknown;
  cause?: unknown;
};

function asErrorLike(value: unknown): ErrorLike | null {
  return typeof value === "object" && value !== null ? (value as ErrorLike) : null;
}

/** Walks the nested error objects that ethers and wallets wrap around each other. */
function collectErrors(error: unknown): ErrorLike[] {
  const found: ErrorLike[] = [];
  const queue: unknown[] = [error];

  while (queue.length > 0 && found.length < 12) {
    const current = asErrorLike(queue.shift());
    if (!current || found.includes(current)) continue;
    found.push(current);
    queue.push(current.info?.error, current.error, current.data, current.cause);
  }

  return found;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** True when the person rejected the request in their wallet. */
export function isUserRejection(error: unknown): boolean {
  return collectErrors(error).some((item) =>
    item.code === "ACTION_REJECTED" ||
    item.code === 4001 ||
    /user (rejected|denied|cancel)/i.test(textOf(item.message))
  );
}

function findRevertReason(errors: ErrorLike[]): string {
  for (const item of errors) {
    const reason = textOf(item.reason);
    if (reason) return reason;
  }

  for (const item of errors) {
    const message = textOf(item.message) || textOf(item.shortMessage);
    const match = message.match(/reverted(?: with reason string)?:?\s*["']?([^"'\n(]+?)["']?(?:\s*\(|$)/i);
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return "";
}

export function describeWalletError(error: unknown, walletName = "your wallet"): string {
  const errors = collectErrors(error);

  if (isUserRejection(error)) {
    return `You rejected the request in ${walletName}. Nothing was sent to the blockchain.`;
  }

  if (errors.some((item) => item.code === -32002)) {
    return `${walletName} already has a request waiting. Open the extension to approve or reject it.`;
  }

  if (errors.some((item) =>
    item.code === "INSUFFICIENT_FUNDS" ||
    /insufficient funds|doesn't have enough funds/i.test(textOf(item.message))
  )) {
    return WARIS_IS_LOCAL
      ? `This account doesn't have enough ${WARIS_TEST_ETH_LABEL} to pay the gas fee. Import one of the funded accounts printed by "npx hardhat node" into your wallet.`
      : `Your wallet doesn't have enough ${WARIS_TEST_ETH_LABEL} to pay the gas fee. Get free test ETH from a Sepolia faucet, then try again.`;
  }

  if (errors.some((item) =>
    item.code === "NETWORK_ERROR" && /network changed/i.test(textOf(item.message))
  )) {
    return `${walletName} changed networks during the request. Check that it is on ${WARIS_NETWORK_NAME}, then try again.`;
  }

  const reason = findRevertReason(errors);
  if (reason) {
    return CONTRACT_REASONS[reason] ?? `The contract rejected the transaction: ${reason}.`;
  }

  for (const item of errors) {
    const shortMessage = textOf(item.shortMessage);
    if (shortMessage) return shortMessage;
  }

  const message = errors.map((item) => textOf(item.message)).find(Boolean);
  if (message) {
    // ethers appends a long technical suffix in parentheses; keep the readable part.
    return message.split(" (")[0].slice(0, 220);
  }

  return "Something went wrong. Please try again.";
}
