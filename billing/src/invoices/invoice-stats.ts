import { PAY_MODES, isPayMode, type PayMode } from "./invoice-payment";
import { roundMoney } from "./invoice-tax";

export const STATS_VERSION = 2;

export const STAT_FIELDS = [
  "sales",
  "taxable",
  "gst",
  "cess",
  "paid",
  "due",
  "count",
  "paidCount",
  "partialCount",
  "unpaidCount",
  "cash",
  "upi",
  "card",
  "bank",
  "cheque",
  "other",
] as const;

export type StatField = (typeof STAT_FIELDS)[number];
export type StatBucket = Record<StatField, number> & { day: string };

export type StatInvoice = {
  invoiceDate?: Date | string | null;
  status?: string | null;
  grandTotal?: number | null;
  taxableTotal?: number | null;
  cgstTotal?: number | null;
  sgstTotal?: number | null;
  igstTotal?: number | null;
  cessTotal?: number | null;
  amountPaid?: number | null;
  payMode?: string | null;
  deletedAt?: Date | null;
};

export type DailyPoint = { day: string; sales: number; paid: number; gst: number; count: number };
export type MonthPoint = { month: string; sales: number; paid: number; gst: number; count: number };
export type ModePoint = { mode: PayMode; amount: number };

export type ChartPayload = {
  today: { day: string; sales: number; count: number };
  month: { month: string; sales: number; paid: number; gst: number; count: number };
  totals: {
    sales: number;
    taxable: number;
    gst: number;
    cess: number;
    paid: number;
    due: number;
    count: number;
    paidCount: number;
    partialCount: number;
    unpaidCount: number;
    collectionRate: number;
  };
  daily: DailyPoint[];
  monthly: MonthPoint[];
  payModes: ModePoint[];
};

const EMPTY: Record<StatField, number> = {
  sales: 0,
  taxable: 0,
  gst: 0,
  cess: 0,
  paid: 0,
  due: 0,
  count: 0,
  paidCount: 0,
  partialCount: 0,
  unpaidCount: 0,
  cash: 0,
  upi: 0,
  card: 0,
  bank: 0,
  cheque: 0,
  other: 0,
};

export function emptyBucket(day = ""): StatBucket {
  return { day, ...EMPTY };
}

export function calendarDay(date = new Date(), timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function invoiceDay(value?: Date | string | null): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return "";
}

export function addDays(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function monthStart(iso: string, delta = 0): string {
  const [year, month] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 10);
}

export function collectedAndDue(
  status: string | null | undefined,
  grandTotal: number | null | undefined,
  amountPaid: number | null | undefined,
): { paid: number; due: number } {
  const sales = roundMoney(Math.max(0, Number(grandTotal) || 0));
  const recorded = roundMoney(Math.max(0, Number(amountPaid) || 0));
  const paid = status === "paid" ? sales : roundMoney(Math.min(sales, recorded));
  return { paid, due: roundMoney(Math.max(0, sales - paid)) };
}

export function contribution(row?: StatInvoice | null): StatBucket | null {
  if (!row || row.deletedAt) return null;
  const day = invoiceDay(row.invoiceDate);
  if (!day) return null;
  const sales = roundMoney(Math.max(0, Number(row.grandTotal) || 0));
  const status = row.status === "paid" || row.status === "partial" ? row.status : "issued";
  const { paid, due } = collectedAndDue(status, sales, row.amountPaid);
  const bucket = emptyBucket(day);
  bucket.sales = sales;
  bucket.taxable = roundMoney(Math.max(0, Number(row.taxableTotal) || 0));
  bucket.gst = roundMoney(
    Math.max(0, Number(row.cgstTotal) || 0) +
      Math.max(0, Number(row.sgstTotal) || 0) +
      Math.max(0, Number(row.igstTotal) || 0),
  );
  bucket.cess = roundMoney(Math.max(0, Number(row.cessTotal) || 0));
  bucket.paid = paid;
  bucket.due = due;
  bucket.count = 1;
  bucket.paidCount = status === "paid" ? 1 : 0;
  bucket.partialCount = status === "partial" ? 1 : 0;
  bucket.unpaidCount = status === "issued" ? 1 : 0;
  if (isPayMode(row.payMode) && paid > 0) bucket[row.payMode] = paid;
  return bucket;
}

export function addBuckets(target: StatBucket, source: StatBucket, sign = 1): void {
  for (const field of STAT_FIELDS) {
    target[field] = roundMoney(target[field] + sign * source[field]);
  }
}

export function statDeltas(
  before?: StatInvoice | null,
  after?: StatInvoice | null,
): StatBucket[] {
  const prev = contribution(before);
  const next = contribution(after);
  if (!prev && !next) return [];
  if (prev && next && prev.day === next.day) {
    const net = emptyBucket(prev.day);
    addBuckets(net, next, 1);
    addBuckets(net, prev, -1);
    return isZero(net) ? [] : [net];
  }
  const out: StatBucket[] = [];
  if (prev) {
    const drop = emptyBucket(prev.day);
    addBuckets(drop, prev, -1);
    out.push(drop);
  }
  if (next) out.push(next);
  return out;
}

export function isZero(bucket: StatBucket): boolean {
  return STAT_FIELDS.every((field) => bucket[field] === 0);
}

export function sumBuckets(rows: StatBucket[]): StatBucket {
  const total = emptyBucket();
  for (const row of rows) addBuckets(total, row, 1);
  return total;
}

export function buildCharts(
  life: Partial<Record<StatField, number>> | null | undefined,
  days: StatBucket[],
  now = new Date(),
): ChartPayload {
  const today = calendarDay(now);
  const byDay = new Map(days.map((row) => [row.day, row]));
  const daily: DailyPoint[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const row = byDay.get(day);
    daily.push({
      day,
      sales: roundMoney(row?.sales || 0),
      paid: roundMoney(row?.paid || 0),
      gst: roundMoney(row?.gst || 0),
      count: row?.count || 0,
    });
  }
  const monthly: MonthPoint[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = monthStart(today, -i);
    const month = start.slice(0, 7);
    const point: MonthPoint = { month, sales: 0, paid: 0, gst: 0, count: 0 };
    for (const row of days) {
      if (!row.day.startsWith(month)) continue;
      point.sales = roundMoney(point.sales + row.sales);
      point.paid = roundMoney(point.paid + row.paid);
      point.gst = roundMoney(point.gst + row.gst);
      point.count += row.count;
    }
    monthly.push(point);
  }
  const totals = emptyBucket();
  for (const field of STAT_FIELDS) totals[field] = roundMoney(Number(life?.[field]) || 0);
  const month = monthly[monthly.length - 1] || {
    month: today.slice(0, 7),
    sales: 0,
    paid: 0,
    gst: 0,
    count: 0,
  };
  const todayPoint = daily[daily.length - 1] || { day: today, sales: 0, paid: 0, gst: 0, count: 0 };
  const sales = totals.sales;
  return {
    today: { day: todayPoint.day, sales: todayPoint.sales, count: todayPoint.count },
    month,
    totals: {
      sales,
      taxable: totals.taxable,
      gst: totals.gst,
      cess: totals.cess,
      paid: totals.paid,
      due: totals.due,
      count: totals.count,
      paidCount: totals.paidCount,
      partialCount: totals.partialCount,
      unpaidCount: totals.unpaidCount,
      collectionRate: sales > 0 ? roundMoney((totals.paid / sales) * 100) : 0,
    },
    daily,
    monthly,
    payModes: PAY_MODES.map((mode) => ({ mode, amount: roundMoney(totals[mode]) })),
  };
}
