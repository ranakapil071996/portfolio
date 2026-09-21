import { isPayMode, normalizePayModeOther, paymentLine, payModeLabel } from "./invoice-payment";

describe("invoice payment", () => {
  it("accepts known pay modes", () => {
    expect(isPayMode("cash")).toBe(true);
    expect(isPayMode("upi")).toBe(true);
    expect(isPayMode("other")).toBe(true);
    expect(isPayMode("wallet")).toBe(false);
    expect(payModeLabel("bank")).toBe("Bank transfer");
    expect(payModeLabel("other")).toBe("Other");
    expect(payModeLabel("other", "Paytm")).toBe("Paytm");
    expect(payModeLabel("other", "  ")).toBe("Other");
    expect(normalizePayModeOther("cash", "Paytm")).toBeUndefined();
    expect(normalizePayModeOther("other", "")).toBeUndefined();
    expect(normalizePayModeOther("other", " Wallet ")).toBe("Wallet");
  });

  it("builds a payment line from status and mode", () => {
    expect(paymentLine({ status: "issued" })).toBe("Unpaid");
    expect(paymentLine({ status: "issued", payMode: "upi" })).toBe("Unpaid · UPI");
    expect(paymentLine({ status: "paid", payMode: "cash" })).toBe("Paid · Cash");
    expect(paymentLine({ paid: true, payMode: "other" })).toBe("Paid · Other");
    expect(paymentLine({ paid: true, payMode: "other", payModeOther: "Paytm" })).toBe("Paid · Paytm");
    expect(paymentLine({ paid: true })).toBe("Paid");
    expect(paymentLine({ status: "partial", payMode: "cash", amountDue: 50 })).toBe("Partial · Cash · ₹50.00 due");
  });
});
