import { amountInWords, renderInvoicePdf } from "./render";
import type { InvoicePayload } from "../invoices.service";

function sample(): InvoicePayload {
  return {
    id: "1",
    invoiceNumber: "INV-0001",
    invoiceDate: "2026-09-16",
    status: "issued",
    customerId: "c1",
    customer: {
      name: "Sharma Stores",
      mobile: "9123456789",
      email: null,
      gstin: "27AAAAA0000A1Z5",
      address: "12 MG Road",
      city: "Mumbai",
      stateCode: "27",
      state: "Maharashtra",
      pincode: "400001",
    },
    seller: {
      name: "Hawkey",
      mobile: "9717360112",
      email: "shop@hawkey.in",
      gstin: "07AAAAA0000A1Z5",
      address: "1 Connaught Place",
      city: "New Delhi",
      stateCode: "07",
      state: "Delhi",
      pincode: "110001",
    },
    placeOfSupply: "Maharashtra",
    placeOfSupplyCode: "27",
    taxSplit: "igst",
    lines: [
      {
        itemId: "i1",
        source: "catalog",
        name: "Notebook",
        sku: "NB-1",
        hsnSac: "482010",
        type: "goods",
        unit: "pcs",
        qty: 2,
        rate: 100,
        gstRate: 18,
        cessRate: 0,
        taxInclusive: false,
        taxable: 200,
        gst: 36,
        cess: 0,
        cgst: 0,
        sgst: 0,
        igst: 36,
        lineTotal: 236,
      },
    ],
    taxableTotal: 200,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 36,
    cessTotal: 0,
    grandTotal: 236,
    notes: "Sample bill",
    createdAt: "2026-09-16T00:00:00.000Z",
  };
}

describe("invoice PDF templates", () => {
  it("spells Indian amounts", () => {
    expect(amountInWords(0)).toBe("Zero Rupees Only");
    expect(amountInWords(236)).toBe("Two Hundred Thirty Six Rupees Only");
    expect(amountInWords(1.5)).toBe("One Rupee and Fifty Paise Only");
  });

  it("renders every template and printer pair", async () => {
    const inv = sample();
    const pairs = [
      { template: "classic" as const, printer: "a4" as const },
      { template: "classic" as const, printer: "a5" as const },
      { template: "modern" as const, printer: "a4" as const },
      { template: "minimal" as const, printer: "thermal80" as const },
      { template: "thermal" as const, printer: "thermal80" as const },
      { template: "thermal" as const, printer: "thermal58" as const },
    ];
    for (const print of pairs) {
      const buf = await renderInvoicePdf(inv, { upiId: "shop@upi" }, print);
      expect(buf.slice(0, 4).toString()).toBe("%PDF");
      expect(buf.length).toBeGreaterThan(400);
    }
  });
});
