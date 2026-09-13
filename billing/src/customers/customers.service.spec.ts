import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { CustomersService } from "./customers.service";
import type { CreateCustomerDto } from "./dto/create-customer.dto";

function user() {
  return { id: new Types.ObjectId().toHexString(), mobile: "9876543210", status: "active" as const };
}

function dto(over: Partial<CreateCustomerDto> = {}): CreateCustomerDto {
  return {
    name: "Sharma Stores",
    ...over,
  };
}

describe("CustomersService", () => {
  it("refuses to create customers before onboarding", async () => {
    const service = new CustomersService(
      { create: jest.fn(), exists: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );
    await expect(service.create(user(), dto())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("creates an invoice-ready customer and fills state from GSTIN", async () => {
    const business = { _id: new Types.ObjectId() };
    const created = {
      toObject: () => ({
        _id: new Types.ObjectId(),
        name: "Sharma Stores",
        mobile: "9123456789",
        gstin: "27AAAAA0000A1Z5",
        address: "12 MG Road",
        city: "Mumbai",
        stateCode: "27",
        state: "Maharashtra",
        pincode: "400001",
        isActive: true,
        createdAt: new Date("2026-01-01"),
      }),
    };
    const customers = {
      exists: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };
    const service = new CustomersService(
      customers as never,
      { findOne: jest.fn().mockResolvedValue(business) } as never,
    );
    const out = await service.create(
      user(),
      dto({
        mobile: "9123456789",
        gstin: "27AAAAA0000A1Z5",
        address: "12 MG Road",
        city: "Mumbai",
        pincode: "400001",
      }),
    );
    expect(out.name).toBe("Sharma Stores");
    expect(out.gstin).toBe("27AAAAA0000A1Z5");
    expect(out.gstRegistered).toBe(true);
    expect(out.stateCode).toBe("27");
    expect(out.state).toBe("Maharashtra");
    expect(customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Sharma Stores",
        gstin: "27AAAAA0000A1Z5",
        stateCode: "27",
        state: "Maharashtra",
      }),
    );
  });

  it("pages the customer list", async () => {
    const find = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          name: "Sharma Stores",
          mobile: "9123456789",
        },
      ]),
    };
    const customers = {
      countDocuments: jest.fn().mockResolvedValue(31),
      find: jest.fn().mockReturnValue(find),
    };
    const service = new CustomersService(
      customers as never,
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

  it("rejects a duplicate GSTIN", async () => {
    const service = new CustomersService(
      { exists: jest.fn().mockResolvedValue({ _id: "x" }), create: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) } as never,
    );
    await expect(service.create(user(), dto({ gstin: "27AAAAA0000A1Z5" }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("rejects a duplicate mobile", async () => {
    const service = new CustomersService(
      { exists: jest.fn().mockResolvedValue({ _id: "x" }), create: jest.fn() } as never,
      { findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) } as never,
    );
    await expect(service.create(user(), dto({ mobile: "9123456789" }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("loads one customer for invoicing", async () => {
    const id = new Types.ObjectId();
    const business = { _id: new Types.ObjectId() };
    const row = {
      toObject: () => ({
        _id: id,
        name: "Sharma Stores",
        gstin: "27AAAAA0000A1Z5",
        stateCode: "27",
        state: "Maharashtra",
        isActive: true,
      }),
    };
    const service = new CustomersService(
      { findOne: jest.fn().mockResolvedValue(row) } as never,
      { findOne: jest.fn().mockResolvedValue(business) } as never,
    );
    const out = await service.findOne(user(), String(id));
    expect(out.id).toBe(String(id));
    expect(out.name).toBe("Sharma Stores");
  });

  it("returns not found for a missing customer", async () => {
    const service = new CustomersService(
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      { findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }) } as never,
    );
    await expect(service.findOne(user(), new Types.ObjectId().toHexString())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
