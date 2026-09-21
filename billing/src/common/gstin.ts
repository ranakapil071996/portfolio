import { GSTIN_RE } from "./input";

export { GSTIN_RE };

export function normalizeGstin(input: string | undefined | null): string | undefined {
  if (input == null) return undefined;
  const value = String(input).trim().toUpperCase();
  if (!value) return undefined;
  if (!GSTIN_RE.test(value)) {
    throw new Error("Enter a valid 15-character GSTIN, or leave it blank");
  }
  return value;
}
