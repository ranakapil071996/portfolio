import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import type { AuthUser } from "../auth/auth.types";
import { Business, BusinessDocument } from "../businesses/schemas/business.schema";
import { normalizeGstin } from "../common/gstin";
import { stateFromGstin, stateName } from "../common/indian-states";
import { normalizeMobile } from "../common/mobile";
import { escapeRegex, mongoSort } from "../common/list-query";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { Customer, CustomerDocument } from "./schemas/customer.schema";

const CUSTOMER_SORT: Record<string, string> = {
  name: "name",
  mobile: "mobile",
  gstin: "gstin",
  place: "city",
};

export type CustomerPayload = {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  stateCode: string | null;
  state: string | null;
  pincode: string | null;
  notes: string | null;
  gstRegistered: boolean;
  isActive: boolean;
  createdAt: string | null;
};

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
    @InjectModel(Business.name) private readonly businesses: Model<BusinessDocument>,
  ) {}

  async list(
    user: AuthUser,
    page = 1,
    limit = 10,
    q?: string,
    sort?: string,
    dir?: string,
  ): Promise<{
    items: CustomerPayload[];
    page: number;
    limit: number;
    total: number;
    pages: number;
  }> {
    const business = await this.requireBusiness(user);
    const take = Math.min(50, Math.max(1, limit || 10));
    const filter: Record<string, unknown> = { businessId: business._id };
    const query = (q || "").trim();
    if (query) {
      const rx = new RegExp(escapeRegex(query), "i");
      filter.$or = [{ name: rx }, { mobile: rx }, { gstin: rx }, { city: rx }, { state: rx }];
    }
    const total = await this.customers.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / take) || 1);
    const current = Math.min(Math.max(1, page || 1), pages);
    const rows = await this.customers
      .find(filter)
      .sort(mongoSort(CUSTOMER_SORT, sort, dir))
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

  async findOne(user: AuthUser, id: string): Promise<CustomerPayload> {
    const business = await this.requireBusiness(user);
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        error: "customer_not_found",
        message: "Customer not found",
      });
    }
    const row = await this.customers.findOne({
      _id: new Types.ObjectId(id),
      businessId: business._id,
    });
    if (!row) {
      throw new NotFoundException({
        error: "customer_not_found",
        message: "Customer not found",
      });
    }
    return this.toPayload(row.toObject() as unknown as Record<string, unknown>);
  }

  async create(user: AuthUser, dto: CreateCustomerDto): Promise<CustomerPayload> {
    const business = await this.requireBusiness(user);
    const gstin = normalizeGstin(dto.gstin);
    const mobile = dto.mobile ? normalizeMobile(dto.mobile) : undefined;
    if (gstin) {
      const taken = await this.customers.exists({ businessId: business._id, gstin });
      if (taken) {
        throw new ConflictException({
          error: "gstin_taken",
          message: "A customer with this GSTIN already exists",
        });
      }
    }
    if (mobile) {
      const taken = await this.customers.exists({ businessId: business._id, mobile });
      if (taken) {
        throw new ConflictException({
          error: "mobile_taken",
          message: "A customer with this mobile number already exists",
        });
      }
    }

    let stateCode = dto.stateCode;
    let state = stateName(stateCode);
    if (!stateCode && gstin) {
      const derived = stateFromGstin(gstin);
      if (derived) {
        stateCode = derived.code;
        state = derived.name;
      }
    }

    const created = await this.customers.create({
      businessId: business._id,
      userId: new Types.ObjectId(user.id),
      name: dto.name.trim(),
      mobile,
      email: dto.email?.trim().toLowerCase() || undefined,
      gstin,
      address: dto.address?.trim() || undefined,
      city: dto.city?.trim() || undefined,
      stateCode,
      state,
      pincode: dto.pincode,
      notes: dto.notes?.trim() || undefined,
      isActive: true,
    });
    return this.toPayload(created.toObject() as unknown as Record<string, unknown>);
  }

  private async requireBusiness(user: AuthUser) {
    const business = await this.businesses.findOne({ userId: new Types.ObjectId(user.id) });
    if (!business) {
      throw new ForbiddenException({
        error: "onboarding_required",
        message: "Finish business setup before adding customers",
      });
    }
    return business;
  }

  private toPayload(row: Record<string, unknown>): CustomerPayload {
    const created = row.createdAt instanceof Date ? row.createdAt.toISOString() : null;
    const gstin = row.gstin ? String(row.gstin) : null;
    return {
      id: String(row._id),
      name: String(row.name ?? ""),
      mobile: row.mobile ? String(row.mobile) : null,
      email: row.email ? String(row.email) : null,
      gstin,
      address: row.address ? String(row.address) : null,
      city: row.city ? String(row.city) : null,
      stateCode: row.stateCode ? String(row.stateCode) : null,
      state: row.state ? String(row.state) : null,
      pincode: row.pincode ? String(row.pincode) : null,
      notes: row.notes ? String(row.notes) : null,
      gstRegistered: Boolean(gstin),
      isActive: row.isActive !== false,
      createdAt: created,
    };
  }
}
