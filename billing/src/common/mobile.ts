import { MOBILE_RE } from "./input";

export { MOBILE_RE };

export function compactMobileDigits(input: unknown): string {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

export function normalizeMobile(input: string): string {
  const digits = compactMobileDigits(input);
  if (!MOBILE_RE.test(digits)) {
    throw new Error("Enter a valid 10-digit Indian mobile number");
  }
  return digits;
}

export function formatMobile(mobile: string): string {
  return `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`;
}

export function maskMobile(mobile: string): string {
  return `+91 ${mobile.slice(0, 2)}***${mobile.slice(-3)}`;
}
