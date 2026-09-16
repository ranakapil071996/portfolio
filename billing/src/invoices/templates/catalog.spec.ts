import { resolvePrint } from "./catalog";

describe("invoice print catalog", () => {
  it("defaults to classic A4", () => {
    expect(resolvePrint()).toEqual({ template: "classic", printer: "a4" });
  });

  it("keeps a valid template and printer pair", () => {
    expect(resolvePrint("thermal", "thermal58")).toEqual({
      template: "thermal",
      printer: "thermal58",
    });
  });

  it("coerces an incompatible printer to the template default", () => {
    expect(resolvePrint("classic", "thermal80")).toEqual({ template: "classic", printer: "a4" });
    expect(resolvePrint("thermal", "a4")).toEqual({ template: "thermal", printer: "thermal80" });
  });

  it("ignores unknown ids", () => {
    expect(resolvePrint("poster", "tabloid")).toEqual({ template: "classic", printer: "a4" });
  });
});
