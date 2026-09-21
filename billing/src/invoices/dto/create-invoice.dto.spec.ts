import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateInvoiceDto } from "./create-invoice.dto";
import { RequestOtpDto } from "../../auth/dto/request-otp.dto";
import { CreateItemDto } from "../../items/dto/create-item.dto";

async function check(cls: new () => object, payload: object) {
  const dto = plainToInstance(cls, payload);
  return validate(dto);
}

describe("request validation", () => {
  it("rejects a junk mobile number", async () => {
    const errors = await check(RequestOtpDto, { mobile: "123" });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects an oversized sale price and script in the name", async () => {
    const errors = await check(CreateItemDto, {
      name: "<script>x</script>",
      type: "goods",
      unit: "pcs",
      salePrice: 1e15,
      gstRate: 18,
      taxInclusive: false,
    });
    expect(errors.some((err) => err.property === "salePrice")).toBe(true);
  });

  it("rejects an invoice with no lines or a fake date", async () => {
    const empty = await check(CreateInvoiceDto, {
      customerId: "64b0fa3c359c3e6f93bf8e14",
      lines: [],
    });
    expect(empty.length).toBeGreaterThan(0);
    const dated = await check(CreateInvoiceDto, {
      customerId: "64b0fa3c359c3e6f93bf8e14",
      invoiceDate: "2010-01-01",
      lines: [{ name: "Pen", kind: "goods", qty: 1, rate: 10, gstRate: 0 }],
    });
    expect(dated.some((err) => err.property === "invoiceDate")).toBe(true);
  });

  it("rejects a pay mode other value with markup", async () => {
    const errors = await check(CreateInvoiceDto, {
      customerId: "64b0fa3c359c3e6f93bf8e14",
      payMode: "other",
      payModeOther: "<img src=x>",
      lines: [{ name: "Pen", kind: "goods", qty: 1, rate: 10, gstRate: 0 }],
    });
    expect(errors.some((err) => err.property === "payModeOther")).toBe(true);
  });
});
