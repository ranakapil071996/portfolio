import { stateFromGstin, stateName } from "./indian-states";

describe("indian states", () => {
  it("resolves a GST state code", () => {
    expect(stateName("07")).toBe("Delhi");
    expect(stateName("27")).toBe("Maharashtra");
    expect(stateName("99")).toBeUndefined();
  });

  it("reads the registered state from a GSTIN", () => {
    expect(stateFromGstin("27AAAAA0000A1Z5")).toEqual({
      code: "27",
      name: "Maharashtra",
    });
    expect(stateFromGstin("")).toBeUndefined();
  });
});
