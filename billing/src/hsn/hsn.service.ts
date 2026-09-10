import { ConflictException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FilterQuery, Model } from "mongoose";
import { CreateHsnDto } from "./dto/create-hsn.dto";
import { HsnCode, HsnCodeDocument } from "./schemas/hsn-code.schema";

export type HsnHit = {
  code: string;
  type: "goods" | "service";
  description: string;
  gstRate: number;
};

type CatalogFile = {
  version: string;
  source?: string;
  items: Array<{ c: string; d: string; t: "g" | "s"; r: number }>;
};

const CATALOG_FILE = "hsn-catalog.json.gz";

@Injectable()
export class HsnService implements OnModuleInit {
  private readonly log = new Logger(HsnService.name);

  constructor(@InjectModel(HsnCode.name) private readonly codes: Model<HsnCodeDocument>) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    await this.ensureCatalog();
  }

  async ensureCatalog(): Promise<{ count: number; version: string; imported: boolean }> {
    const catalog = await this.readCatalog();
    await this.codes.syncIndexes();
    const official = await this.codes.countDocuments({ source: { $ne: "user" } });
    const current = await this.codes.exists({ catalogVersion: catalog.version });
    if (current && official === catalog.items.length) {
      const count = await this.codes.countDocuments();
      this.log.log(`HSN/SAC catalog already loaded (${count} codes)`);
      return { count, version: catalog.version, imported: false };
    }
    this.log.log(`Importing HSN/SAC catalog ${catalog.version} (${catalog.items.length} rows)`);
    const docs = catalog.items.map((row) => ({
      code: row.c,
      type: row.t === "s" ? "service" : "goods",
      description: row.d,
      searchKey: `${row.c} ${row.d}`.replace(/\s+/g, "").toLowerCase(),
      gstRate: row.r,
      chapter: row.c.slice(0, 2),
      catalogVersion: catalog.version,
      source: "catalog" as const,
    }));
    await this.codes.deleteMany({ source: { $ne: "user" } });
    const batch = 1500;
    for (let i = 0; i < docs.length; i += batch) {
      try {
        await this.codes.insertMany(docs.slice(i, i + batch), { ordered: false });
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? Number(err.code) : 0;
        if (code !== 11000) throw err;
      }
    }
    const count = await this.codes.countDocuments();
    this.log.log(`HSN/SAC catalog ready (${count} codes)`);
    return { count, version: catalog.version, imported: true };
  }

  async search(
    q: string,
    type?: "goods" | "service",
    limit = 25,
  ): Promise<{ items: HsnHit[] }> {
    const query = q.trim();
    if (query.length < 2) return { items: [] };
    if ((await this.codes.countDocuments()) === 0) {
      await this.ensureCatalog();
    }
    const take = Math.min(Math.max(limit || 25, 1), 25);
    const filter: FilterQuery<HsnCodeDocument> = {};
    if (type) filter.type = type;
    const compact = query.replace(/\s+/g, "").toUpperCase();
    const looksLikeCode = /^[A-Z0-9]{2,12}$/.test(compact) && /\d/.test(compact);
    if (looksLikeCode) {
      filter.code = new RegExp(`^${escapeRegex(compact)}`);
    } else {
      filter.searchKey = new RegExp(escapeRegex(compact.toLowerCase()), "i");
    }
    const rows = await this.codes
      .find(filter)
      .select({ code: 1, type: 1, description: 1, gstRate: 1, _id: 0 })
      .sort({ code: 1 })
      .limit(looksLikeCode ? take : 80)
      .lean()
      .exec();
    const items: HsnHit[] = rows.map((row) => ({
      code: String(row.code),
      type: row.type === "service" ? "service" : "goods",
      description: String(row.description ?? ""),
      gstRate: Number(row.gstRate ?? 18),
    }));
    const ranked = looksLikeCode ? items : rankHits(items, query);
    return { items: ranked.slice(0, take) };
  }

  async create(dto: CreateHsnDto): Promise<HsnHit> {
    const code = dto.code.trim().toUpperCase();
    const taken = await this.codes.exists({ code });
    if (taken) {
      throw new ConflictException({
        error: "hsn_taken",
        message: "This HSN/SAC code already exists",
      });
    }
    const description = dto.description.trim();
    await this.codes.create({
      code,
      type: dto.type,
      description,
      searchKey: `${code} ${description}`.replace(/\s+/g, "").toLowerCase(),
      gstRate: dto.gstRate,
      chapter: code.slice(0, 2),
      catalogVersion: "user",
      source: "user",
    });
    return { code, type: dto.type, description, gstRate: dto.gstRate };
  }

  async status() {
    const count = await this.codes.countDocuments();
    const sample = await this.codes.findOne().select({ catalogVersion: 1, _id: 0 }).lean();
    return {
      count,
      version: sample && "catalogVersion" in sample ? String(sample.catalogVersion) : null,
    };
  }

  private async readCatalog(): Promise<CatalogFile> {
    const file = path.join(process.cwd(), "data", CATALOG_FILE);
    const raw = await readFile(file);
    const text = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    const parsed = JSON.parse(text) as CatalogFile;
    if (!parsed?.version || !Array.isArray(parsed.items)) {
      throw new Error("HSN catalog file is invalid");
    }
    return parsed;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function rankHits(items: HsnHit[], query: string): HsnHit[] {
  const needle = query.replace(/\s+/g, "").toLowerCase();
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 2);
  return items
    .map((item) => ({ item, score: scoreHit(item, needle, words) }))
    .sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code))
    .map((row) => row.item);
}

function scoreHit(item: HsnHit, needle: string, words: string[]): number {
  const desc = item.description || "";
  const compact = desc.replace(/\s+/g, "").toLowerCase();
  let score = 0;
  if (compact.includes(needle)) score += 50;
  if (compact.startsWith(needle)) score += 20;
  for (const word of words) {
    if (new RegExp(`\\b${escapeRegex(word)}s?\\b`, "i").test(desc)) score += 25;
  }
  if (item.code.length >= 4 && item.code.length <= 8) score += 12;
  if (item.code.length === 6 || item.code.length === 8) score += 6;
  if (item.code.length <= 2) score -= 15;
  if (desc.length < 80 && compact.includes(needle)) score += 8;
  return score;
}
