import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import type { AuthUser } from "../auth/auth.types";
import { Business, BusinessDocument } from "../businesses/schemas/business.schema";
import { escapeRegex, mongoSort } from "../common/list-query";
import { CreateItemDto } from "./dto/create-item.dto";
import { Item, ItemDocument } from "./schemas/item.schema";

const ITEM_SORT: Record<string, string> = {
  name: "name",
  sku: "sku",
  type: "type",
  hsn: "hsnSac",
  price: "salePrice",
  gst: "gstRate",
  stock: "stockQty",
};

export type ItemPayload = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: string;
  hsnSac: string | null;
  unit: string;
  salePrice: number;
  purchasePrice: number | null;
  gstRate: number;
  taxInclusive: boolean;
  cessRate: number;
  stockQty: number;
  lowStockAt: number | null;
  isActive: boolean;
  createdAt: string | null;
};

@Injectable()
export class ItemsService {
  constructor(
    @InjectModel(Item.name) private readonly items: Model<ItemDocument>,
    @InjectModel(Business.name) private readonly businesses: Model<BusinessDocument>,
  ) {}

  async list(
    user: AuthUser,
    page = 1,
    limit = 10,
    q?: string,
    sort?: string,
    dir?: string,
  ): Promise<{ items: ItemPayload[]; page: number; limit: number; total: number; pages: number }> {
    const business = await this.requireBusiness(user);
    const take = Math.min(50, Math.max(1, limit || 10));
    const filter: Record<string, unknown> = { businessId: business._id };
    const query = (q || "").trim();
    if (query) {
      const rx = new RegExp(escapeRegex(query), "i");
      filter.$or = [{ name: rx }, { sku: rx }, { hsnSac: rx }];
    }
    const total = await this.items.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / take) || 1);
    const current = Math.min(Math.max(1, page || 1), pages);
    const rows = await this.items
      .find(filter)
      .sort(mongoSort(ITEM_SORT, sort, dir))
      .skip((current - 1) * take)
      .limit(take)
      .lean()
      .exec();
    return {
      items: rows.map((row) => this.toPayload(row as Record<string, unknown>)),
      page: current,
      limit: take,
      total,
      pages: total === 0 ? 0 : pages,
    };
  }

  async create(user: AuthUser, dto: CreateItemDto): Promise<ItemPayload> {
    const business = await this.requireBusiness(user);
    const sku = dto.sku?.trim() || undefined;
    if (sku) {
      const taken = await this.items.exists({ businessId: business._id, sku });
      if (taken) {
        throw new ConflictException({
          error: "sku_taken",
          message: "An item with this SKU already exists",
        });
      }
    }
    const created = await this.items.create({
      businessId: business._id,
      userId: new Types.ObjectId(user.id),
      name: dto.name.trim(),
      sku,
      description: dto.description?.trim() || undefined,
      type: dto.type,
      hsnSac: dto.hsnSac,
      unit: dto.unit,
      salePrice: dto.salePrice,
      purchasePrice: dto.purchasePrice,
      gstRate: dto.gstRate,
      taxInclusive: dto.taxInclusive,
      cessRate: dto.cessRate ?? 0,
      stockQty: dto.type === "service" ? 0 : (dto.stockQty ?? 0),
      lowStockAt: dto.type === "service" ? undefined : dto.lowStockAt,
      isActive: true,
    });
    return this.toPayload(created.toObject() as unknown as Record<string, unknown>);
  }

  private async requireBusiness(user: AuthUser) {
    const business = await this.businesses.findOne({ userId: new Types.ObjectId(user.id) });
    if (!business) {
      throw new ForbiddenException({
        error: "onboarding_required",
        message: "Finish business setup before adding items",
      });
    }
    return business;
  }

  private toPayload(row: Record<string, unknown>): ItemPayload {
    const created = row.createdAt instanceof Date ? row.createdAt.toISOString() : null;
    return {
      id: String(row._id),
      name: String(row.name ?? ""),
      sku: row.sku ? String(row.sku) : null,
      description: row.description ? String(row.description) : null,
      type: String(row.type ?? "goods"),
      hsnSac: row.hsnSac ? String(row.hsnSac) : null,
      unit: String(row.unit ?? "pcs"),
      salePrice: Number(row.salePrice ?? 0),
      purchasePrice: row.purchasePrice == null ? null : Number(row.purchasePrice),
      gstRate: Number(row.gstRate ?? 0),
      taxInclusive: Boolean(row.taxInclusive),
      cessRate: Number(row.cessRate ?? 0),
      stockQty: Number(row.stockQty ?? 0),
      lowStockAt: row.lowStockAt == null ? null : Number(row.lowStockAt),
      isActive: row.isActive !== false,
      createdAt: created,
    };
  }
}
