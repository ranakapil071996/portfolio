import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { InvoiceStatsService } from "./invoice-stats.service";
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
    expect(out.paid).toBe(false);
    expect(out.payMode).toBeNull();
    expect(invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: "INV-0001",
        taxSplit: "igst",
        igstTotal: 36,
        grandTotal: 236,
        status: "issued",
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

  it("saves pay mode and paid status on create", async () => {
    const businessId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const invoices = {
      create: jest.fn().mockResolvedValue({
        toObject: () => ({
          _id: new Types.ObjectId(),
          invoiceNumber: "INV-0003",
          invoiceDate: new Date("2026-09-12T00:00:00.000Z"),
          status: "paid",
          payMode: "upi",
          paidAt: new Date("2026-09-12T10:00:00.000Z"),
          customerId,
          customer: { name: "Cash" },
          seller: { name: "hawkey" },
          taxSplit: "cgst_sgst",
          lines: [],
          taxableTotal: 100,
          cgstTotal: 0,
          sgstTotal: 0,
          igstTotal: 0,
          cessTotal: 0,
          grandTotal: 100,
        }),
      }),
    };
    const service = new InvoicesService(
      invoices as never,
      { findOne: jest.fn().mockResolvedValue({ _id: customerId, name: "Cash" }) } as never,
      { find: jest.fn().mockResolvedValue([]), updateOne: jest.fn() } as never,
      {
        findOne: jest.fn().mockResolvedValue({ _id: businessId, name: "hawkey", mobile: "9717360112" }),
        findOneAndUpdate: jest.fn().mockResolvedValue({ invoiceSeq: 3 }),
      } as never,
    );
    const out = await service.create(user(), {
      customerId: String(customerId),
      paid: true,
      payMode: "upi",
      lines: [{ name: "Loose sugar", kind: "goods", qty: 1, rate: 100, gstRate: 0 }],
    });
    expect(out.paid).toBe(true);
    expect(out.payMode).toBe("upi");
    expect(invoices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        payMode: "upi",
      }),
    );
  });

  it("marks an unpaid invoice as paid", async () => {
    const row = {
      status: "issued",
      payMode: undefined,
      payModeOther: undefined,
      paidAt: undefined,
      grandTotal: 10,
      amountPaid: 0,
      set: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject: () => ({
        _id: new Types.ObjectId(),
        invoiceNumber: "INV-0004",
        invoiceDate: new Date("2026-09-12T00:00:00.000Z"),
        status: "paid",
        payMode: "cash",
        paidAt: new Date("2026-09-12T11:00:00.000Z"),
        customerId: new Types.ObjectId(),
        customer: { name: "Cash" },
        seller: { name: "hawkey" },
        taxSplit: "cgst_sgst",
        lines: [],
        taxableTotal: 10,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        cessTotal: 0,
        grandTotal: 10,
      }),
    };
    const service = new InvoicesService(
      { findOne: jest.fn().mockResolvedValue(row) } as never,
      { findOne: jest.fn() } as never,
      { find: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) } as never,
    );
    const out = await service.markPaid(user(), new Types.ObjectId().toHexString(), { payMode: "cash" });
    expect(row.status).toBe("paid");
    expect(row.payMode).toBe("cash");
    expect(row.save).toHaveBeenCalled();
    expect(out.paid).toBe(true);
    expect(out.payMode).toBe("cash");
  });

  it("restores stock when an invoice is deleted", async () => {
    const businessId = new Types.ObjectId();
    const itemId = new Types.ObjectId();
    const row = {
      lines: [{ source: "catalog", type: "goods", itemId, qty: 2 }],
      deletedAt: undefined,
      save: jest.fn().mockResolvedValue(undefined),
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
    expect(row.save).toHaveBeenCalled();
    expect(row.deletedAt).toBeInstanceOf(Date);
  });

  it("rebuilds chart totals when the rollup write fails after the invoice is saved", async () => {
    const businessId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const rollup = { sales: 0, count: 0, paid: 0, due: 0, rebuilt: true, statsVersion: 2 };
    const saved = {
      _id: new Types.ObjectId(),
      invoiceNumber: "INV-0009",
      invoiceDate: new Date("2026-09-24T00:00:00.000Z"),
      status: "issued",
      customerId,
      customer: { name: "Walk In" },
      seller: { name: "hawkey" },
      taxSplit: "cgst_sgst",
      lines: [],
      taxableTotal: 200,
      cgstTotal: 18,
      sgstTotal: 18,
      igstTotal: 0,
      cessTotal: 0,
      grandTotal: 236,
      amountPaid: 0,
    };
    const invoices = {
      create: jest.fn().mockResolvedValue({ toObject: () => saved }),
      find: jest.fn().mockReturnValue({
        select: () => ({
          lean: () => ({
            cursor: () => ({
              async *[Symbol.asyncIterator]() {
                yield saved;
              },
            }),
          }),
        }),
      }),
    };
    const businessStats = {
      updateOne: jest.fn(async (_filter: unknown, update: { $inc?: unknown; $set?: Record<string, unknown> }) => {
        if (update.$inc) throw new Error("precompute write failed");
        if (update.$set) Object.assign(rollup, update.$set);
        return {};
      }),
      findOne: jest.fn(async () => rollup),
    };
    const stats = new InvoiceStatsService(
      invoices as never,
      {
        updateOne: jest.fn().mockRejectedValue(new Error("precompute write failed")),
        deleteMany: jest.fn().mockResolvedValue({}),
        insertMany: jest.fn().mockResolvedValue([]),
      } as never,
      businessStats as never,
    );
    const service = new InvoicesService(
      invoices as never,
      { findOne: jest.fn().mockResolvedValue({ _id: customerId, name: "Walk In" }) } as never,
      { find: jest.fn().mockResolvedValue([]), updateOne: jest.fn() } as never,
      {
        findOne: jest.fn().mockResolvedValue({ _id: businessId, name: "hawkey", mobile: "9717360112" }),
        findOneAndUpdate: jest.fn().mockResolvedValue({ invoiceSeq: 9 }),
      } as never,
      stats,
    );

    const out = await service.create(user(), {
      customerName: "Walk In",
      invoiceDate: "2026-09-24",
      lines: [{ name: "Notebook", qty: 2, rate: 100, gstRate: 18 }],
    });
    const deadline = Date.now() + 1000;
    while (rollup.sales !== out.grandTotal && Date.now() < deadline) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(out.invoiceNumber).toBe("INV-0009");
    expect(out.grandTotal).toBe(236);
    expect(invoices.create).toHaveBeenCalled();
    expect(rollup.sales).toBe(236);
    expect(rollup.count).toBe(1);
    expect(rollup.due).toBe(236);
    expect(rollup.rebuilt).toBe(true);
  });
});
