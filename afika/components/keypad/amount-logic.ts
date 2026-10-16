import type { KeyPress } from "./schema";

const MAX_DECIMALS = 2;

/**
 * Pure reducer: given the current raw string and a key press, returns the next raw string.
 * Rejects any input that would exceed `max`, exceed 2 decimals, or produce invalid numbers.
 */
export function applyKey(current: string, key: KeyPress, max: number): string {
  if (key === "backspace") {
    return current.length <= 1 ? "" : current.slice(0, -1);
  }

  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : current + ".";
  }

  // digit
  let next = current;

  if (current === "0") {
    next = key; // replace leading zero
  } else {
    next = current + key;
  }

  const [, decimals = ""] = next.split(".");
  if (decimals.length > MAX_DECIMALS) return current;

  const value = Number(next);
  if (!Number.isFinite(value) || value > max) return current;

  return next;
}

export function toNumber(raw: string): number {
  if (raw === "" || raw === ".") return 0;
  return Number(raw);
}

/** Display string: always shows the typed digits, padded to 2 decimals. */
export function formatDisplay(raw: string): string {
  if (raw === "") return "0.00";
  const [intPart, decPart] = raw.split(".");
  const intWithSeparators = (intPart === "" ? "0" : intPart).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ","
  );
  if (raw.includes(".")) {
    return `${intWithSeparators}.${(decPart ?? "").padEnd(MAX_DECIMALS, "0")}`;
  }
  return `${intWithSeparators}.00`;
}

export function isAccepted(raw: string, max: number): boolean {
  const value = toNumber(raw);
  return value > 0 && value <= max;
}
