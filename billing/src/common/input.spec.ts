import { cleanLine, cleanMultiline, isInvoiceDate, toFiniteNumber } from "./input";

describe("input sanitizers", () => {
  it("strips control characters and collapses spaces", () => {
    expect(cleanLine("  Acme\u0000 Traders \n ")).toBe("Acme Traders");
    expect(cleanMultiline("Line 1\r\n\r\n\r\nLine 2")).toBe("Line 1\n\nLine 2");
  });

  it("rejects non-finite numbers", () => {
    expect(toFiniteNumber("12.5")).toBe(12.5);
    expect(Number.isNaN(toFiniteNumber("abc") as number)).toBe(true);
    expect(toFiniteNumber("")).toBeUndefined();
    expect(Number.isNaN(toFiniteNumber(Infinity) as number)).toBe(true);
  });

  it("accepts GST-era invoice dates only", () => {
    expect(isInvoiceDate("2017-07-01")).toBe(true);
    expect(isInvoiceDate("2017-06-30")).toBe(false);
    expect(isInvoiceDate("2026-09-12")).toBe(true);
    expect(isInvoiceDate("2026-13-01")).toBe(false);
    expect(isInvoiceDate("not-a-date")).toBe(false);
  });
});
