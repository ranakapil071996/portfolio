import { normalizeGstin } from "./gstin";

describe("normalizeGstin", () => {
  it("returns undefined for empty values", () => {
    expect(normalizeGstin(undefined)).toBeUndefined();
    expect(normalizeGstin("")).toBeUndefined();
    expect(normalizeGstin("   ")).toBeUndefined();
  });

  it("uppercases a valid GSTIN", () => {
    expect(normalizeGstin("22aaaaa0000a1z5")).toBe("22AAAAA0000A1Z5");
  });

  it("rejects a short value", () => {
    expect(() => normalizeGstin("22AAAAA")).toThrow(/valid 15-character GSTIN/);
  });
});
