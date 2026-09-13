import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { InvoicesService } from "./invoices.service";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";

function user() {
  return { id: new Types.ObjectId().toHexString(), mobile: "9876543210", status: "active" as const };
}

describe("InvoicesService", () => {
  it("refuses to create invoices before onboarding", async () => {
    const service = new InvoicesService(
      { create: jest.fn() } as never,
      { findOne: jest.fn() } as never,
      { find: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );
    await expect(
      service.create(user(), { customerId: new Types.ObjectId().toHexString(), lines: [] } as CreateInvoiceDto),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates a GST invoice and snapshots party plus lines", async () => {
    const businessId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const invoiceId = new Types.ObjectId();
    const customer = {
      _id: customerId,
      name: "Sharma Stores",
      mobile: "9123456789",
      gstin: "27AAAAA0000A1Z5",
      address: "12 MG Road",
      city: "Mumbai",
      stateCode: "27",
      state: "Maharashtra",
      pincode: "400001",
    };
    const item = {
      _id: itemId,
      name: "Notebook",
      sku: "NB-1",
      hsnSac: "482010",
      type: "goods",
      unit: "pcs",
      salePrice: 100,
      gstRate: 18,
      cessRate: 0,
      taxInclusive: false,
    };
    const created = {
      toObject: () => ({
        _id: invoiceId,
        invoiceNumber: "INV-0001",
        invoiceDate: new Date("2026-09-12T00:00:00.000Z"),
        status: "issued",
        customerId,
        customer: { name: "Sharma Stores", gstin: "27AAAAA0000A1Z5", state: "Maharashtra", stateCode: "27" },
        seller: { name: "hawkey", gstin: "07AAAAA0000A1Z5", stateCode: "07", state: "Delhi" },
        placeOfSupply: "Maharashtra",
        placeOfSupplyCode: "27",
        taxSplit: "igst",
        lines: [
          {
            itemId,
            name: "Notebook",
            qty: 2,
            rate: 100,
            gstRate: 18,
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
        createdAt: new Date("2026-09-12"),
      }),
    };
    const invoices = { create: jest.fn().mockResolvedValue(created) };
    const items = {
      find: jest.fn().mockResolvedValue([item]),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    const businesses = {
      findOne: jest.fn().mockResolvedValue({
        _id: businessId,
        name: "hawkey",
        mobile: "9717360112",
        gstin: "07AAAAA0000A1Z5",
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ invoiceSeq: 1 }),
    };
    const service = new InvoicesService(
      invoices as never,
      { findOne: jest.fn().mockResolvedValue(customer) } as never,
      items as never,
      businesses as never,
    );
    const out = await service.create(user(), {
      customerId: String(customerId),
      invoiceDate: "2026-09-12",
      lines: [{ itemId: String(itemId), qty: 2 }],
    });
    expect(out.invoiceNumber).toBe("INV-0001");
    expect(out.taxSplit).toBe("igst");
    expect(out.grandTotal).toBe(236);
    expect(out.customer.name).toBe("Sharma Stores");
    expect(invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: "INV-0001",
        taxSplit: "igst",
        igstTotal: 36,
        grandTotal: 236,
      }),
    );
    expect(items.updateOne).toHaveBeenCalledWith(
      { _id: itemId, businessId },
      { $inc: { stockQty: -2 } },
    );
  });

  it("saves a one-off item and a delivery charge without touching stock", async () => {
    const businessId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const invoices = {
      create: jest.fn().mockResolvedValue({
        toObject: () => ({
          _id: new Types.ObjectId(),
          invoiceNumber: "INV-0002",
          invoiceDate: new Date("2026-09-12T00:00:00.000Z"),
          customerId,
          customer: { name: "Cash" },
          seller: { name: "hawkey" },
          taxSplit: "cgst_sgst",
          lines: [],
          taxableTotal: 140,
          cgstTotal: 6.1,
          sgstTotal: 6.1,
          igstTotal: 0,
          cessTotal: 0,
          grandTotal: 152.2,
        }),
      }),
    };
    const items = { find: jest.fn().mockResolvedValue([]), updateOne: jest.fn() };
    const service = new InvoicesService(
      invoices as never,
      { findOne: jest.fn().mockResolvedValue({ _id: customerId, name: "Cash" }) } as never,
      items as never,
      {
        findOne: jest.fn().mockResolvedValue({ _id: businessId, name: "hawkey", mobile: "9717360112" }),
        findOneAndUpdate: jest.fn().mockResolvedValue({ invoiceSeq: 2 }),
      } as never,
    );
    await service.create(user(), {
      customerId: String(customerId),
      lines: [
        { name: "Loose sugar", kind: "goods", qty: 2, rate: 50, gstRate: 5 },
        { name: "Delivery", kind: "charge", qty: 1, rate: 40, gstRate: 18 },
      ],
    });
    expect(items.updateOne).not.toHaveBeenCalled();
    expect(invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        grandTotal: 152.2,
        lines: [
          expect.objectContaining({ source: "custom", name: "Loose sugar", taxable: 100, gst: 5 }),
          expect.objectContaining({ source: "charge", name: "Delivery", taxable: 40, gst: 7.2 }),
        ],
      }),
    );
  });

  it("pages the invoice list", async () => {
    const find = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          invoiceNumber: "INV-0002",
          invoiceDate: new Date("2026-09-12T00:00:00.000Z"),
          customer: { name: "Sharma Stores" },
          grandTotal: 236,
          lines: [{}],
          taxSplit: "igst",
          status: "issued",
        },
      ]),
    };
    const service = new InvoicesService(
      { countDocuments: jest.fn().mockResolvedValue(12), find: jest.fn().mockReturnValue(find) } as never,
      { findOne: jest.fn() } as never,
      { find: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) } as never,
    );
    const out = await service.list(user(), 2, 10);
    expect(out.page).toBe(2);
    expect(out.total).toBe(12);
    expect(out.pages).toBe(2);
    expect(out.items[0].invoiceNumber).toBe("INV-0002");
    expect(find.skip).toHaveBeenCalledWith(10);
  });

  it("returns not found for a missing invoice", async () => {
    const service = new InvoicesService(
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { findOne: jest.fn() } as never,
      { find: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) } as never,
    );
    await expect(service.findOne(user(), new Types.ObjectId().toHexString())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("restores stock when an invoice is deleted", async () => {
    const businessId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const row = {
      lines: [{ source: "catalog", type: "goods", itemId, qty: 2 }],
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    const items = { updateOne: jest.fn().mockResolvedValue({}) };
    const service = new InvoicesService(
      { findOne: jest.fn().mockResolvedValue(row) } as never,
      { findOne: jest.fn() } as never,
      items as never,
      { findOne: jest.fn().mockResolvedValue({ _id: businessId }) } as never,
    );
    await expect(service.remove(user(), new Types.ObjectId().toHexString())).resolves.toEqual({ ok: true });
    expect(items.updateOne).toHaveBeenCalledWith(
      { _id: itemId, businessId },
      { $inc: { stockQty: 2 } },
    );
    expect(row.deleteOne).toHaveBeenCalled();
  });
});
