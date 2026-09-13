import { profileStatus } from "./profile-completion";

describe("profileStatus", () => {
  it("starts incomplete after onboarding", () => {
    const out = profileStatus({ name: "Hawkey" });
    expect(out.complete).toBe(false);
    expect(out.percent).toBe(20);
    expect(out.missing).toEqual(["Email", "Business address", "Business logo", "Signature"]);
  });

  it("is complete when core invoice fields are present", () => {
    const out = profileStatus({
      name: "Hawkey",
      email: "shop@example.com",
      address: "12 MG Road",
      city: "Delhi",
      stateCode: "07",
      pincode: "110001",
      logoFile: "logo.png",
      signatureFile: "sign.png",
    });
    expect(out.complete).toBe(true);
    expect(out.percent).toBe(100);
    expect(out.missing).toEqual([]);
  });
});
