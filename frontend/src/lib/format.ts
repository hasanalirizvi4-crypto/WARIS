import { formatEther, getAddress, isAddress } from "ethers";
import { SECONDS_PER_DAY, WARIS_CURRENCY_SYMBOL } from "../warisConfig";

export function shortAddress(address: string, start = 6, end = 4) {
  return address ? `${address.slice(0, start)}…${address.slice(-end)}` : "";
}

export function formatNumber(value: number | bigint) {
  return value.toLocaleString("en-US");
}

export function formatEth(wei: bigint, maxFractionDigits = 6, symbol = WARIS_CURRENCY_SYMBOL) {
  const value = Number(formatEther(wei));
  const text = value !== 0 && Math.abs(value) < 0.0001
    ? value.toLocaleString("en-US", { maximumSignificantDigits: 4 })
    : value.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits });
  return `${text} ${symbol}`;
}

export function formatDateTime(seconds: bigint) {
  return new Date(Number(seconds) * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDays(seconds: bigint) {
  const days = Number(seconds) / SECONDS_PER_DAY;
  const text = Number.isInteger(days) ? formatNumber(days) : days.toFixed(2);
  return `${text} ${days === 1 ? "day" : "days"}`;
}

export function formatTimeLeft(secondsLeft: number) {
  if (secondsLeft <= 0) return "Deadline passed";
  const days = Math.floor(secondsLeft / SECONDS_PER_DAY);
  if (days >= 1) return `${formatNumber(days)} ${days === 1 ? "day" : "days"} left`;
  const hours = Math.max(1, Math.floor(secondsLeft / 3600));
  return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
}

export function parseChainId(value: unknown): bigint | null {
  if (typeof value === "string" && value.trim()) return BigInt(value);
  if (typeof value === "number" || typeof value === "bigint") return BigInt(value);
  return null;
}

export function firstAccount(value: unknown): string {
  const list = Array.isArray(value) ? value : [];
  return typeof list[0] === "string" && isAddress(list[0]) ? getAddress(list[0]) : "";
}

export function errorCode(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { code?: unknown; data?: { originalError?: { code?: unknown } } };
  return value.data?.originalError?.code ?? value.code;
}

export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
