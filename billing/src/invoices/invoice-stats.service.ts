import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  STAT_FIELDS,
  addBuckets,
  buildCharts,
  contribution,
  emptyBucket,
  isZero,
  monthStart,
  statDeltas,
  calendarDay,
  STATS_VERSION,
  type ChartPayload,
  type StatBucket,
  type StatField,
  type StatInvoice,
} from "./invoice-stats";
import { Invoice, InvoiceDocument } from "./schemas/invoice.schema";
import {
  InvoiceBusinessStat,
  InvoiceBusinessStatDocument,
} from "./schemas/invoice-business-stat.schema";
import { InvoiceDailyStat, InvoiceDailyStatDocument } from "./schemas/invoice-daily-stat.schema";

const PROJECTION = {
  invoiceDate: 1,
  status: 1,
  grandTotal: 1,
  taxableTotal: 1,
  cgstTotal: 1,
  sgstTotal: 1,
  igstTotal: 1,
  cessTotal: 1,
  amountPaid: 1,
  payMode: 1,
} as const;

@Injectable()
export class InvoiceStatsService {
  private readonly logger = new Logger(InvoiceStatsService.name);
  private readonly pending = new Map<string, Promise<void>>();
  private readonly writes = new Map<string, Promise<void>>();
  private readonly repairs = new Set<string>();

  constructor(
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
    @InjectModel(InvoiceDailyStat.name) private readonly daily: Model<InvoiceDailyStatDocument>,
    @InjectModel(InvoiceBusinessStat.name) private readonly businessStats: Model<InvoiceBusinessStatDocument>,
  ) {}

  record(businessId: Types.ObjectId, before?: StatInvoice | null, after?: StatInvoice | null): void {
    const key = String(businessId);
    const prev = this.writes.get(key) ?? Promise.resolve();
    const run = prev
      .catch(() => undefined)
      .then(() => this.apply(businessId, before, after))
      .catch((err: unknown) => {
        this.logger.error(
          `Invoice stats update failed for ${key}`,
          err instanceof Error ? err.stack : String(err),
        );
        return this.repair(businessId);
      });
    this.writes.set(key, run);
    void run.finally(() => {
      if (this.writes.get(key) === run) this.writes.delete(key);
    });
  }

  async apply(
    businessId: Types.ObjectId,
    before?: StatInvoice | null,
    after?: StatInvoice | null,
  ): Promise<void> {
    const deltas = statDeltas(before, after);
    if (!deltas.length) return;
    const life = emptyBucket();
    await Promise.all(
      deltas.map((delta) => {
        addBuckets(life, delta, 1);
        const inc = incOf(delta);
        return this.daily.updateOne(
          { businessId, day: delta.day },
          {
            $inc: inc,
            $setOnInsert: { businessId, day: delta.day, month: delta.day.slice(0, 7) },
          },
          { upsert: true },
        );
      }),
    );
    await this.businessStats.updateOne(
      { businessId },
      { $inc: incOf(life), $setOnInsert: { businessId } },
      { upsert: true },
    );
    const staleDays = deltas.map((delta) => delta.day);
    await this.daily.deleteMany({ businessId, day: { $in: staleDays }, count: { $lte: 0 } });
  }

  async charts(businessId: Types.ObjectId, now = new Date()): Promise<ChartPayload> {
    await this.settle(businessId);
    await this.ensure(businessId);
    const today = calendarDay(now);
    const from = monthStart(today, -11);
    const [life, days] = await Promise.all([
      this.businessStats.findOne({ businessId }).lean().exec(),
      this.daily
        .find({ businessId, day: { $gte: from } })
        .select({ _id: 0, businessId: 0 })
        .lean()
        .exec(),
    ]);
    return buildCharts(life, days as StatBucket[], now);
  }

  private async settle(businessId: Types.ObjectId): Promise<void> {
    const key = String(businessId);
    let pending = this.writes.get(key);
    while (pending) {
      await pending;
      const next = this.writes.get(key);
      if (next === pending) return;
      pending = next;
    }
  }

  private async repair(businessId: Types.ObjectId, attempt = 1): Promise<void> {
    const key = String(businessId);
    await this.markDirty(businessId);
    try {
      await this.rebuild(businessId);
    } catch (err) {
      this.logger.error(
        `Invoice stats rebuild failed for ${key} (${attempt}/3)`,
        err instanceof Error ? err.stack : String(err),
      );
      if (attempt >= 3) return;
      this.scheduleRepair(businessId, attempt + 1);
    }
  }

  private scheduleRepair(businessId: Types.ObjectId, attempt: number): void {
    const key = String(businessId);
    if (this.repairs.has(key) || attempt > 3) return;
    const timer = setTimeout(() => {
      this.repairs.delete(key);
      const prev = this.writes.get(key) ?? Promise.resolve();
      const run = prev.catch(() => undefined).then(() => this.repair(businessId, attempt));
      this.writes.set(key, run);
      void run.finally(() => {
        if (this.writes.get(key) === run) this.writes.delete(key);
      });
    }, 1000);
    timer.unref?.();
    this.repairs.add(key);
  }

  private async markDirty(businessId: Types.ObjectId): Promise<void> {
    try {
      await this.businessStats.updateOne({ businessId }, { $set: { rebuilt: false } });
    } catch (err) {
      this.logger.error(
        `Could not mark invoice stats dirty for ${String(businessId)}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private ensure(businessId: Types.ObjectId): Promise<void> {
    const key = String(businessId);
    const current = this.pending.get(key);
    if (current) return current;
    const job = this.rebuildIfNeeded(businessId).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, job);
    return job;
  }

  private async rebuildIfNeeded(businessId: Types.ObjectId): Promise<void> {
    const existing = await this.businessStats.findOne({ businessId }).select("rebuilt statsVersion").lean().exec();
    if (existing?.rebuilt && existing.statsVersion === STATS_VERSION) return;
    await this.rebuild(businessId);
  }

  private async rebuild(businessId: Types.ObjectId): Promise<void> {
    const cursor = this.invoices
      .find({ businessId, deletedAt: null })
      .select(PROJECTION)
      .lean()
      .cursor();
    const byDay = new Map<string, StatBucket>();
    const life = emptyBucket();
    for await (const row of cursor) {
      const bucket = contribution(row as StatInvoice);
      if (!bucket) continue;
      const current = byDay.get(bucket.day) || emptyBucket(bucket.day);
      addBuckets(current, bucket, 1);
      byDay.set(bucket.day, current);
      addBuckets(life, bucket, 1);
    }
    await this.daily.deleteMany({ businessId });
    const docs = [...byDay.values()].filter((row) => !isZero(row));
    if (docs.length) {
      await this.daily.insertMany(
        docs.map((row) => ({
          businessId,
          day: row.day,
          month: row.day.slice(0, 7),
          ...numbersOf(row),
        })),
        { ordered: false },
      );
    }
    await this.businessStats.updateOne(
      { businessId },
      { $set: { businessId, rebuilt: true, statsVersion: STATS_VERSION, ...numbersOf(life) } },
      { upsert: true },
    );
  }
}

function incOf(bucket: StatBucket): Record<StatField, number> {
  return numbersOf(bucket);
}

function numbersOf(bucket: StatBucket): Record<StatField, number> {
  const out = {} as Record<StatField, number>;
  for (const field of STAT_FIELDS) out[field] = bucket[field];
  return out;
}
