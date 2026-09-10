const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(input: string | undefined | null): string | undefined {
  if (input == null) return undefined;
  const value = String(input).trim().toUpperCase();
  if (!value) return undefined;
  if (!GSTIN_RE.test(value)) {
    throw new Error("Enter a valid 15-character GSTIN, or leave it blank");
  }
  return value;
}
