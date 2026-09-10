import { formatMobile, maskMobile, normalizeMobile } from "./mobile";

describe("normalizeMobile", () => {
  it("accepts a 10-digit Indian number", () => {
    expect(normalizeMobile("9876543210")).toBe("9876543210");
  });

  it("strips +91 and spaces", () => {
    expect(normalizeMobile("+91 98765 43210")).toBe("9876543210");
  });

  it("strips a leading 0", () => {
    expect(normalizeMobile("09876543210")).toBe("9876543210");
  });

  it("rejects landline-like prefixes", () => {
    expect(() => normalizeMobile("5123456789")).toThrow(/valid 10-digit/);
  });

  it("formats and masks", () => {
    expect(formatMobile("9876543210")).toBe("+91 98765 43210");
    expect(maskMobile("9876543210")).toBe("+91 98***210");
  });
});
