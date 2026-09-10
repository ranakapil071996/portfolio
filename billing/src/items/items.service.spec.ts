import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Types } from "mongoose";
import { ItemsService } from "./items.service";
import type { CreateItemDto } from "./dto/create-item.dto";

function user() {
  return { id: new Types.ObjectId().toHexString(), mobile: "9876543210", status: "active" as const };
}

function dto(over: Partial<CreateItemDto> = {}): CreateItemDto {
  return {
    name: "Notebook",
    type: "goods",
    unit: "pcs",
    salePrice: 50,
    gstRate: 18,
    taxInclusive: false,
    ...over,
  };
}

describe("ItemsService", () => {
  it("refuses to create items before onboarding", async () => {
    const service = new ItemsService(
      { create: jest.fn(), exists: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );
    await expect(service.create(user(), dto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates an invoice-ready item", async () => {
    const business = { _id: new Types.ObjectId() };
    const created = {
      toObject: () => ({
        _id: new Types.ObjectId(),
        name: "Notebook",
        type: "goods",
        unit: "pcs",
        salePrice: 50,
        gstRate: 18,
        taxInclusive: false,
        cessRate: 0,
        stockQty: 20,
        isActive: true,
        createdAt: new Date("2026-01-01"),
      }),
    };
    const items = {
      exists: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };
    const service = new ItemsService(
      items as never,
      { findOne: jest.fn().mockResolvedValue(business) } as never,
    );
    const out = await service.create(user(), dto({ stockQty: 20, hsnSac: "482010" }));
    expect(out.name).toBe("Notebook");
    expect(out.gstRate).toBe(18);
    expect(out.stockQty).toBe(20);
    expect(items.create).toHaveBeenCalled();
  });

  it("pages the item list", async () => {
    const find = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          name: "Notebook",
          type: "goods",
          unit: "pcs",
          salePrice: 50,
          gstRate: 18,
        },
      ]),
    };
    const items = {
      countDocuments: jest.fn().mockResolvedValue(31),
      find: jest.fn().mockReturnValue(find),
    };
    const service = new ItemsService(
      items as never,
      { findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) } as never,
    );
    const out = await service.list(user(), 2, 10);
    expect(out.page).toBe(2);
    expect(out.limit).toBe(10);
    expect(out.total).toBe(31);
    expect(out.pages).toBe(4);
    expect(out.items).toHaveLength(1);
    expect(find.skip).toHaveBeenCalledWith(10);
    expect(find.limit).toHaveBeenCalledWith(10);
  });

  it("rejects a duplicate SKU", async () => {
    const service = new ItemsService(
      { exists: jest.fn().mockResolvedValue({ _id: "x" }), create: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) } as never,
    );
    await expect(service.create(user(), dto({ sku: "NB-1" }))).rejects.toBeInstanceOf(ConflictException);
  });
});
