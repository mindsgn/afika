import { formatUnits, parseUnits } from "viem";

export function sanitizeDecimalInput(value: string) {
  return value.replace(/,/g, ".").trim();
}

// Below the keypad's smallest increment (0.01) so that when a balance is
// unusable every typed amount stays rejected and the keypad CTA never enables.
const KEYPAD_MAX_FALLBACK = 0.001;

/**
 * Max for AmountKeypad, whose schema rejects a non-positive, non-finite max.
 * A missing or unreadable balance falls back to a floor below 0.01 so the
 * keypad still renders but refuses every amount until funds arrive.
 */
export function keypadMaxFromBalance(balance: string) {
  const value = Number(balance);
  return Number.isFinite(value) && value > 0 ? value : KEYPAD_MAX_FALLBACK;
}

export function parseTokenAmount(value: string, decimals: number) {
  const normalized = sanitizeDecimalInput(value);
  if (!normalized) {
    throw new Error("Amount is required");
  }
  return parseUnits(normalized, decimals);
}

export function formatTokenAmount(value: string | bigint, decimals: number, precision = 6) {
  const raw = typeof value === "bigint" ? value : BigInt(value || "0");
  const formatted = formatUnits(raw, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  if (!fraction) return whole;
  const trimmed = fraction.slice(0, precision).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function amountExceedsBalance(amount: string, balance: string, decimals: number) {
  return parseTokenAmount(amount, decimals) > parseTokenAmount(balance || "0", decimals);
}
