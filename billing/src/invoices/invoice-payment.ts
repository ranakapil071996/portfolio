export const PAY_MODES = ["cash", "upi", "card", "bank", "cheque", "other"] as const;
export type PayMode = (typeof PAY_MODES)[number];

export const PAY_MODE_LABELS: Record<PayMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

export function isPayMode(value: unknown): value is PayMode {
  return typeof value === "string" && (PAY_MODES as readonly string[]).includes(value);
}

export function normalizePayModeOther(mode?: string | null, other?: string | null): string | undefined {
  if (mode !== "other") return undefined;
  const text = String(other || "").trim();
  return text ? text.slice(0, 40) : undefined;
}

export function payModeLabel(value?: string | null, other?: string | null): string {
  if (value === "other") {
    return normalizePayModeOther("other", other) || PAY_MODE_LABELS.other;
  }
  return isPayMode(value) ? PAY_MODE_LABELS[value] : "";
}

export function paymentLine(inv: {
  status?: string | null;
  paid?: boolean;
  payMode?: string | null;
  payModeOther?: string | null;
  amountPaid?: number | null;
  amountDue?: number | null;
  grandTotal?: number | null;
}): string {
  const paid = inv.paid === true || inv.status === "paid";
  const partial = !paid && (inv.status === "partial" || Number(inv.amountPaid) > 0);
  const mode = payModeLabel(inv.payMode, inv.payModeOther);
  if (paid) return mode ? `Paid · ${mode}` : "Paid";
  if (partial) {
    const due = Number(inv.amountDue);
    const dueText = Number.isFinite(due) && due > 0 ? ` · ₹${due.toFixed(2)} due` : "";
    return (mode ? `Partial · ${mode}` : "Partial") + dueText;
  }
  return mode ? `Unpaid · ${mode}` : "Unpaid";
}
