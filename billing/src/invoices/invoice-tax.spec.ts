import { lineAmounts, splitGst, taxSplit } from "./invoice-tax";

describe("invoice tax", () => {
  it("adds GST on an exclusive price", () => {
    expect(lineAmounts(2, 100, 18)).toEqual({
      taxable: 200,
      gst: 36,
      cess: 0,
      lineTotal: 236,
    });
  });

  it("backs GST out of an inclusive price", () => {
    const out = lineAmounts(1, 118, 18, 0, true);
    expect(out.taxable).toBe(100);
    expect(out.gst).toBe(18);
    expect(out.lineTotal).toBe(118);
  });

  it("splits odd paise across CGST and SGST", () => {
    expect(splitGst(1.15, "cgst_sgst")).toEqual({ cgst: 0.57, sgst: 0.58, igst: 0 });
  });

  it("puts the full GST into IGST for inter-state", () => {
    expect(splitGst(36, "igst")).toEqual({ cgst: 0, sgst: 0, igst: 36 });
    expect(taxSplit("07", "27")).toBe("igst");
    expect(taxSplit("07", "07")).toBe("cgst_sgst");
    expect(taxSplit(undefined, "27")).toBe("cgst_sgst");
  });
});
