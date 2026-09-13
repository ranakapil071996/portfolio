import { stateFromGstin } from "../common/indian-states";

export type TaxSplit = "cgst_sgst" | "igst";

export type LineAmounts = {
  taxable: number;
  gst: number;
  cess: number;
  lineTotal: number;
};

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function lineAmounts(
  qty: number,
  rate: number,
  gstRate: number,
  cessRate = 0,
  taxInclusive = false,
): LineAmounts {
  const units = Number(qty) || 0;
  const price = Number(rate) || 0;
  const gstPct = Number(gstRate) || 0;
  const cessPct = Number(cessRate) || 0;
  const gross = units * price;
  if (taxInclusive) {
    const factor = 1 + gstPct / 100 + cessPct / 100;
    const taxable = factor > 0 ? roundMoney(gross / factor) : roundMoney(gross);
    const gst = roundMoney((taxable * gstPct) / 100);
    const cess = roundMoney((taxable * cessPct) / 100);
    return { taxable, gst, cess, lineTotal: roundMoney(taxable + gst + cess) };
  }
  const taxable = roundMoney(gross);
  const gst = roundMoney((taxable * gstPct) / 100);
  const cess = roundMoney((taxable * cessPct) / 100);
  return { taxable, gst, cess, lineTotal: roundMoney(taxable + gst + cess) };
}

export function splitGst(
  gst: number,
  mode: TaxSplit,
): { cgst: number; sgst: number; igst: number } {
  const amount = roundMoney(gst);
  if (mode === "igst") return { cgst: 0, sgst: 0, igst: amount };
  const paise = Math.round(amount * 100);
  const cgstPaise = Math.floor(paise / 2);
  return { cgst: cgstPaise / 100, sgst: (paise - cgstPaise) / 100, igst: 0 };
}

export function taxSplit(
  sellerStateCode?: string | null,
  buyerStateCode?: string | null,
): TaxSplit {
  if (sellerStateCode && buyerStateCode && sellerStateCode !== buyerStateCode) {
    return "igst";
  }
  return "cgst_sgst";
}

export function stateCodeFromParty(
  stateCode?: string | null,
  gstin?: string | null,
): string | undefined {
  if (stateCode && /^\d{2}$/.test(stateCode)) return stateCode;
  return stateFromGstin(gstin || undefined)?.code;
}
