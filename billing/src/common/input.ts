import { registerDecorator, ValidationOptions } from "class-validator";

export const MONEY_MAX = 999_999_999.99;
export const QTY_MAX = 1_000_000;
export const STOCK_MAX = 10_000_000;
export const CESS_MAX = 100;
export const PAGE_MAX = 10_000;
export const QUERY_MAX = 80;
export const NOTES_MAX = 400;

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const PIN_RE = /^\d{6}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const UPI_RE = /^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/i;
export const HSN_RE = /^[A-Z0-9]{2,12}$/;
export const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,39}$/;
export const ACCOUNT_RE = /^\d{6,22}$/;
export const OTP_RE = /^\d{4}$/;
export const PAY_MODE_OTHER_RE = /^[\p{L}\p{N}][\p{L}\p{N} .,&/'()+-]{0,39}$/u;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;

export function emptyToUndef(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

export function cleanLine(value: unknown): string {
  return String(value ?? "")
    .replace(CONTROL, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanMultiline(value: unknown): string {
  return String(value ?? "")
    .replace(CONTROL, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toFiniteNumber(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function isInvoiceDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return false;
  }
  const min = Date.UTC(2017, 6, 1);
  const max = Date.now() + 366 * 24 * 60 * 60 * 1000;
  const time = date.getTime();
  return time >= min && time <= max;
}

export function invoiceDateBounds(): { min: string; max: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const max = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000);
  return { min: "2017-07-01", max: iso(max) };
}

export function IsInvoiceDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isInvoiceDate",
      target: object.constructor,
      propertyName,
      options: {
        message: "Use a valid invoice date",
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (value == null || value === "") return true;
          return typeof value === "string" && isInvoiceDate(value);
        },
      },
    });
  };
}
