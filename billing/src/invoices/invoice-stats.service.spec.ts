import { Types } from "mongoose";
import { InvoiceStatsService } from "./invoice-stats.service";

const issued = {
  invoiceDate: "2026-09-24",
  status: "issued" as const,
  grandTotal: 10,
  taxableTotal: 10,
  cgstTotal: 0,
  sgstTotal: 0,
  igstTotal: 0,
  cessTotal: 0,
  amountPaid: 0,
};

describe("InvoiceStatsService.record", () => {
  it("returns before the rollup write finishes", async () => {
    let release: (value: unknown) => void = () => undefined;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const daily = {
      updateOne: jest.fn(() => gate),
      deleteMany: jest.fn().mockResolvedValue({}),
    };
    const businessStats = { updateOne: jest.fn(() => gate) };
    const service = new InvoiceStatsService({} as never, daily as never, businessStats as never);
    const started = Date.now();
    service.record(new Types.ObjectId(), null, issued);
    expect(Date.now() - started).toBeLessThan(20);
    await new Promise((resolve) => setImmediate(resolve));
    expect(daily.updateOne).toHaveBeenCalled();
    release({});
    await gate;
    await new Promise((resolve) => setImmediate(resolve));
  });

  it("retries a failed rollup rebuild at most 3 times", async () => {
    jest.useFakeTimers();
    const businessId = new Types.ObjectId();
    const daily = {
      updateOne: jest.fn().mockRejectedValue(new Error("precompute write failed")),
      deleteMany: jest.fn().mockRejectedValue(new Error("rebuild failed")),
      insertMany: jest.fn().mockResolvedValue([]),
    };
    const invoices = {
      find: jest.fn().mockReturnValue({
        select: () => ({
          lean: () => ({
            cursor: () => ({
              async *[Symbol.asyncIterator]() {
                yield { ...issued, invoiceDate: new Date("2026-09-24T00:00:00.000Z") };
              },
            }),
          }),
        }),
      }),
    };
    const service = new InvoiceStatsService(
      invoices as never,
      daily as never,
      { updateOne: jest.fn().mockRejectedValue(new Error("precompute write failed")) } as never,
    );
    service.record(businessId, null, issued);
    await jest.advanceTimersByTimeAsync(0);
    expect(daily.deleteMany).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(5000);
    expect(daily.deleteMany).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});
