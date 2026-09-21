import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import type { AuthUser } from "../auth/auth.types";
import { Business, BusinessDocument } from "../businesses/schemas/business.schema";
import { Customer, CustomerDocument } from "../customers/schemas/customer.schema";
import { stateName } from "../common/indian-states";
import { Item, ItemDocument } from "../items/schemas/item.schema";
import { escapeRegex, mongoSort } from "../common/list-query";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { MarkPaidDto } from "./dto/mark-paid.dto";
import { isPayMode, normalizePayModeOther, type PayMode } from "./invoice-payment";
import { renderInvoicePdf } from "./invoice-pdf";
import {
  lineAmounts,
  roundMoney,
  splitGst,
  stateCodeFromParty,
  taxSplit,
} from "./invoice-tax";
import { Invoice, InvoiceDocument, InvoiceLine, InvoiceParty } from "./schemas/invoice.schema";
import { loadBrandAssets } from "./templates/brand";
import { catalogPayload, resolvePrint, type PrintChoice } from "./templates/catalog";

export type InvoiceLinePayload = {
  itemId: string | null;
  source: string;
  name: string;
  sku: string | null;
  hsnSac: string | null;
  type: string;
  unit: string;
  qty: number;
  rate: number;
  gstRate: number;
  cessRate: number;
  taxInclusive: boolean;
  taxable: number;
  gst: number;
  cess: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
};

export type InvoicePartyPayload = {
  name: string;
  mobile: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  city: string | null;
  stateCode: string | null;
  state: string | null;
  pincode: string | null;
};

export type InvoicePayload = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  customerId: string | null;
  customer: InvoicePartyPayload;
  seller: InvoicePartyPayload;
  placeOfSupply: string | null;
  placeOfSupplyCode: string | null;
  taxSplit: string;
  lines: InvoiceLinePayload[];
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  grandTotal: number;
  notes: string | null;
  paid: boolean;
  partial: boolean;
  amountPaid: number;
  amountDue: number;
  payMode: PayMode | null;
  payModeOther: string | null;
  paidAt: string | null;
  createdAt: string | null;
};

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerGstin: string | null;
  placeOfSupply: string | null;
  taxSplit: string;
  grandTotal: number;
  lineCount: number;
  status: string;
  paid: boolean;
  partial: boolean;
  amountPaid: number;
  amountDue: number;
  payMode: PayMode | null;
  payModeOther: string | null;
};

const INVOICE_SORT: Record<string, string> = {
  number: "invoiceNumber",
  date: "invoiceDate",
  customer: "customer.name",
  place: "placeOfSupply",
  total: "grandTotal",
  status: "status",
};

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoices: Model<InvoiceDocument>,
    @InjectModel(Customer.name) private readonly customers: Model<CustomerDocument>,
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
    from?: string,
    to?: string,
    pay?: string,
  ): Promise<{
    items: InvoiceListItem[];
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
      filter.$or = [
        { invoiceNumber: rx },
        { "customer.name": rx },
        { "customer.gstin": rx },
        { "customer.mobile": rx },
        { placeOfSupply: rx },
      ];
    }
    const dateRange = invoiceDateRange(from, to);
    if (dateRange) filter.invoiceDate = dateRange;
    if (pay === "paid") filter.status = "paid";
    else if (pay === "partial") filter.status = "partial";
    else if (pay === "unpaid") filter.status = "issued";
    const total = await this.invoices.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / take) || 1);
    const current = Math.min(Math.max(1, page || 1), pages);
    const rows = await this.invoices
      .find(filter)
      .sort(mongoSort(INVOICE_SORT, sort, dir))
      .skip((current - 1) * take)
      .limit(take)
      .lean()
      .exec();
    return {
      items: rows.map((row) => this.toListItem(row as Record<string, unknown>)),
      page: current,
      limit: take,
      total,
      pages: total === 0 ? 0 : pages,
    };
  }

  async findOne(user: AuthUser, id: string): Promise<InvoicePayload> {
    const business = await this.requireBusiness(user);
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        error: "invoice_not_found",
        message: "Invoice not found",
      });
    }
    const row = await this.invoices.findOne({
      _id: new Types.ObjectId(id),
      businessId: business._id,
    });
    if (!row) {
      throw new NotFoundException({
        error: "invoice_not_found",
        message: "Invoice not found",
      });
    }
    return this.toPayload(row.toObject() as unknown as Record<string, unknown>);
  }

  async create(user: AuthUser, dto: CreateInvoiceDto): Promise<InvoicePayload> {
    const business = await this.requireBusiness(user);
    const draft = await this.composeInvoice(business, dto);
    const seqDoc = await this.businesses.findOneAndUpdate(
      { _id: business._id },
      { $inc: { invoiceSeq: 1 } },
      { new: true },
    );
    const seq = seqDoc?.invoiceSeq || 1;
    const payment = paymentFromDto(dto, draft.doc.grandTotal);
    const created = await this.invoices.create({
      businessId: business._id,
      userId: new Types.ObjectId(user.id),
      invoiceNumber: `INV-${String(seq).padStart(4, "0")}`,
      invoiceDate: parseInvoiceDate(dto.invoiceDate),
      ...payment,
      ...draft.doc,
    });
    await this.applyStockDelta(business._id, [], draft.doc.lines);
    return this.toPayload(created.toObject() as unknown as Record<string, unknown>);
  }

  async update(user: AuthUser, id: string, dto: CreateInvoiceDto): Promise<InvoicePayload> {
    const { business, row } = await this.loadOwned(user, id);
    const draft = await this.composeInvoice(business, dto);
    const previous = (row.lines || []) as InvoiceLine[];
    const payment = paymentFromDto(dto, draft.doc.grandTotal, row);
    row.set({
      invoiceDate: parseInvoiceDate(dto.invoiceDate),
      ...draft.doc,
      status: payment.status,
      payMode: payment.payMode,
      amountPaid: payment.amountPaid,
    });
    if (payment.payModeOther) row.payModeOther = payment.payModeOther;
    else row.set("payModeOther", undefined);
    if (payment.paidAt) row.paidAt = payment.paidAt;
    else row.set("paidAt", undefined);
    await row.save();
    await this.applyStockDelta(business._id, previous, draft.doc.lines);
    return this.toPayload(row.toObject() as unknown as Record<string, unknown>);
  }

  async markPaid(user: AuthUser, id: string, dto: MarkPaidDto): Promise<InvoicePayload> {
    const { row } = await this.loadOwned(user, id);
    const payMode = dto.payMode || (isPayMode(row.payMode) ? row.payMode : undefined);
    if (!payMode) {
      throw new BadRequestException({
        error: "validation_error",
        message: "Choose a pay mode",
      });
    }
    const grandTotal = roundMoney(Number(row.grandTotal ?? 0));
    const already = roundMoney(Number(row.amountPaid ?? 0));
    const due = roundMoney(Math.max(0, grandTotal - already));
    if (row.status === "partial" && (dto.amountPaid == null || !Number.isFinite(dto.amountPaid))) {
      throw new BadRequestException({
        error: "validation_error",
        message: "Enter the remaining amount",
      });
    }
    let extra = dto.amountPaid == null ? due : roundMoney(dto.amountPaid);
    if (!(extra > 0)) {
      throw new BadRequestException({
        error: "validation_error",
        message: "Enter the remaining amount",
      });
    }
    if (extra > due) {
      throw new BadRequestException({
        error: "validation_error",
        message: "Amount cannot be more than the remaining balance",
      });
    }
    const nextPaid = roundMoney(already + extra);
    const otherSource = dto.payMode ? dto.payModeOther : row.payModeOther;
    const payModeOther = normalizePayModeOther(payMode, otherSource);
    row.payMode = payMode;
    if (payModeOther) row.payModeOther = payModeOther;
    else row.set("payModeOther", undefined);
    if (nextPaid >= grandTotal) {
      row.status = "paid";
      row.amountPaid = grandTotal;
      row.paidAt = new Date();
    } else {
      row.status = "partial";
      row.amountPaid = nextPaid;
    }
    await row.save();
    return this.toPayload(row.toObject() as unknown as Record<string, unknown>);
  }

  async remove(user: AuthUser, id: string): Promise<{ ok: true }> {
    const { business, row } = await this.loadOwned(user, id);
    await this.applyStockDelta(business._id, (row.lines || []) as InvoiceLine[], []);
    await row.deleteOne();
    return { ok: true };
  }

  async templates(user: AuthUser): Promise<{
    templates: ReturnType<typeof catalogPayload>["templates"];
    printers: ReturnType<typeof catalogPayload>["printers"];
    selected: PrintChoice;
  }> {
    const business = await this.requireBusiness(user);
    return {
      ...catalogPayload(),
      selected: resolvePrint(business.invoiceTemplate, business.invoicePrinter),
    };
  }

  async pdf(
    user: AuthUser,
    id: string,
    opts?: { template?: string; printer?: string },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const inv = await this.findOne(user, id);
    const business = await this.requireBusiness(user);
    const print = resolvePrint(
      opts?.template || business.invoiceTemplate,
      opts?.printer || business.invoicePrinter,
    );
    const brand = await loadBrandAssets(business);
    const buffer = await renderInvoicePdf(inv, brand, print);
    return { buffer, filename: `${inv.invoiceNumber}.pdf` };
  }

  private async loadOwned(user: AuthUser, id: string) {
    const business = await this.requireBusiness(user);
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        error: "invoice_not_found",
        message: "Invoice not found",
      });
    }
    const row = await this.invoices.findOne({
      _id: new Types.ObjectId(id),
      businessId: business._id,
    });
    if (!row) {
      throw new NotFoundException({
        error: "invoice_not_found",
        message: "Invoice not found",
      });
    }
    return { business, row };
  }

  private async resolveCustomer(
    business: BusinessDocument,
    dto: CreateInvoiceDto,
  ): Promise<{
    _id?: Types.ObjectId;
    name: string;
    mobile?: string;
    email?: string;
    gstin?: string;
    address?: string;
    city?: string;
    stateCode?: string;
    state?: string;
    pincode?: string;
  }> {
    if (dto.customerId) {
      if (!Types.ObjectId.isValid(dto.customerId)) {
        throw new NotFoundException({
          error: "customer_not_found",
          message: "Choose a saved customer",
        });
      }
      const customer = await this.customers.findOne({
        _id: new Types.ObjectId(dto.customerId),
        businessId: business._id,
      });
      if (!customer) {
        throw new NotFoundException({
          error: "customer_not_found",
          message: "Choose a saved customer",
        });
      }
      return customer;
    }
    const name = String(dto.customerName || "").trim();
    if (name.length < 2) {
      throw new BadRequestException({
        error: "validation_error",
        message: "Choose a customer",
      });
    }
    return { name };
  }

  private async composeInvoice(business: BusinessDocument, dto: CreateInvoiceDto) {
    const customer = await this.resolveCustomer(business, dto);

    const itemIds = [...new Set(dto.lines.map((line) => line.itemId).filter(Boolean))] as string[];
    const itemRows = itemIds.length
      ? await this.items.find({
          _id: { $in: itemIds.map((id) => new Types.ObjectId(id)) },
          businessId: business._id,
        })
      : [];
    const byId = new Map(itemRows.map((item) => [String(item._id), item]));
    const missing = itemIds.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new BadRequestException({
        error: "item_not_found",
        message: "One or more items are missing from the catalog",
      });
    }

    const sellerState = stateCodeFromParty(business.stateCode, business.gstin);
    const buyerState = stateCodeFromParty(customer.stateCode, customer.gstin);
    const split = taxSplit(sellerState, buyerState);
    const placeCode = buyerState || sellerState;
    const sellerStateName = sellerState ? stateName(sellerState) : undefined;
    const buyerStateName = customer.state || (buyerState ? stateName(buyerState) : undefined);

    const lines: InvoiceLine[] = dto.lines.map((input) => {
      if (input.itemId) {
        const item = byId.get(input.itemId)!;
        const qty = Number(input.qty);
        const rate = input.rate == null ? Number(item.salePrice) : Number(input.rate);
        const gstRate = input.gstRate == null ? item.gstRate : input.gstRate;
        const amounts = lineAmounts(qty, rate, gstRate, item.cessRate ?? 0, item.taxInclusive);
        const taxes = splitGst(amounts.gst, split);
        return {
          itemId: item._id,
          source: "catalog" as const,
          name: item.name,
          sku: item.sku,
          hsnSac: item.hsnSac,
          type: item.type,
          unit: item.unit,
          qty,
          rate,
          gstRate,
          cessRate: item.cessRate ?? 0,
          taxInclusive: Boolean(item.taxInclusive),
          taxable: amounts.taxable,
          gst: amounts.gst,
          cess: amounts.cess,
          cgst: taxes.cgst,
          sgst: taxes.sgst,
          igst: taxes.igst,
          lineTotal: amounts.lineTotal,
        };
      }
      const name = String(input.name || "").trim();
      if (name.length < 2) {
        throw new BadRequestException({
          error: "validation_error",
          message: "Item name is required",
        });
      }
      const kind = input.kind === "charge" ? "charge" : input.kind === "service" ? "service" : "goods";
      const source = kind === "charge" ? "charge" : "custom";
      const qty = Number(input.qty);
      const rate = Number(input.rate ?? 0);
      const gstRate = input.gstRate == null ? (kind === "charge" ? 0 : 18) : input.gstRate;
      const amounts = lineAmounts(qty, rate, gstRate, 0, false);
      const taxes = splitGst(amounts.gst, split);
      return {
        source,
        name,
        type: kind,
        unit: input.unit?.trim() || (kind === "charge" ? "nos" : "pcs"),
        qty,
        rate,
        gstRate,
        cessRate: 0,
        taxInclusive: false,
        taxable: amounts.taxable,
        gst: amounts.gst,
        cess: amounts.cess,
        cgst: taxes.cgst,
        sgst: taxes.sgst,
        igst: taxes.igst,
        lineTotal: amounts.lineTotal,
      };
    });

    return {
      doc: {
        customerId: customer._id,
        customer: {
          name: customer.name,
          mobile: customer.mobile,
          email: customer.email,
          gstin: customer.gstin,
          address: customer.address,
          city: customer.city,
          stateCode: customer.stateCode || buyerState,
          state: buyerStateName,
          pincode: customer.pincode,
        } as InvoiceParty,
        seller: {
          name: business.name,
          mobile: business.mobile,
          email: business.email,
          gstin: business.gstin,
          address: business.address,
          city: business.city,
          stateCode: business.stateCode || sellerState,
          state: business.state || sellerStateName,
          pincode: business.pincode,
        } as InvoiceParty,
        placeOfSupply: buyerStateName || sellerStateName,
        placeOfSupplyCode: placeCode,
        taxSplit: split,
        lines,
        taxableTotal: roundMoney(lines.reduce((sum, line) => sum + line.taxable, 0)),
        cgstTotal: roundMoney(lines.reduce((sum, line) => sum + line.cgst, 0)),
        sgstTotal: roundMoney(lines.reduce((sum, line) => sum + line.sgst, 0)),
        igstTotal: roundMoney(lines.reduce((sum, line) => sum + line.igst, 0)),
        cessTotal: roundMoney(lines.reduce((sum, line) => sum + line.cess, 0)),
        grandTotal: roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
        notes: dto.notes?.trim() || undefined,
      },
    };
  }

  private async applyStockDelta(
    businessId: Types.ObjectId,
    previous: InvoiceLine[],
    next: InvoiceLine[],
  ) {
    const before = catalogGoodsQty(previous);
    const after = catalogGoodsQty(next);
    const ids = new Set([...before.keys(), ...after.keys()]);
    for (const id of ids) {
      const delta = (before.get(id) || 0) - (after.get(id) || 0);
      if (!delta) continue;
      await this.items.updateOne(
        { _id: new Types.ObjectId(id), businessId },
        { $inc: { stockQty: delta } },
      );
    }
  }

  private async requireBusiness(user: AuthUser) {
    const business = await this.businesses.findOne({ userId: new Types.ObjectId(user.id) });
    if (!business) {
      throw new ForbiddenException({
        error: "onboarding_required",
        message: "Finish business setup before creating invoices",
      });
    }
    return business;
  }

  private toListItem(row: Record<string, unknown>): InvoiceListItem {
    const customer = (row.customer || {}) as Record<string, unknown>;
    const lines = Array.isArray(row.lines) ? row.lines : [];
    return {
      id: String(row._id),
      invoiceNumber: String(row.invoiceNumber ?? ""),
      invoiceDate: dateOnly(row.invoiceDate),
      customerName: String(customer.name ?? ""),
      customerGstin: customer.gstin ? String(customer.gstin) : null,
      placeOfSupply: row.placeOfSupply ? String(row.placeOfSupply) : null,
      taxSplit: String(row.taxSplit ?? "cgst_sgst"),
      grandTotal: Number(row.grandTotal ?? 0),
      lineCount: lines.length,
      status: String(row.status ?? "issued"),
      paid: String(row.status ?? "issued") === "paid",
      partial: String(row.status ?? "issued") === "partial",
      amountPaid: roundMoney(Number(row.amountPaid ?? 0)),
      amountDue: roundMoney(Math.max(0, Number(row.grandTotal ?? 0) - Number(row.amountPaid ?? 0))),
      payMode: isPayMode(row.payMode) ? row.payMode : null,
      payModeOther: row.payModeOther ? String(row.payModeOther) : null,
    };
  }

  private toPayload(row: Record<string, unknown>): InvoicePayload {
    const created = row.createdAt instanceof Date ? row.createdAt.toISOString() : null;
    const lines = Array.isArray(row.lines) ? row.lines : [];
    return {
      id: String(row._id),
      invoiceNumber: String(row.invoiceNumber ?? ""),
      invoiceDate: dateOnly(row.invoiceDate),
      status: String(row.status ?? "issued"),
      customerId: row.customerId ? String(row.customerId) : null,
      customer: partyPayload(row.customer),
      seller: partyPayload(row.seller),
      placeOfSupply: row.placeOfSupply ? String(row.placeOfSupply) : null,
      placeOfSupplyCode: row.placeOfSupplyCode ? String(row.placeOfSupplyCode) : null,
      taxSplit: String(row.taxSplit ?? "cgst_sgst"),
      lines: lines.map((line) => linePayload(line as Record<string, unknown>)),
      taxableTotal: Number(row.taxableTotal ?? 0),
      cgstTotal: Number(row.cgstTotal ?? 0),
      sgstTotal: Number(row.sgstTotal ?? 0),
      igstTotal: Number(row.igstTotal ?? 0),
      cessTotal: Number(row.cessTotal ?? 0),
      grandTotal: Number(row.grandTotal ?? 0),
      notes: row.notes ? String(row.notes) : null,
      paid: String(row.status ?? "issued") === "paid",
      partial: String(row.status ?? "issued") === "partial",
      amountPaid: roundMoney(Number(row.amountPaid ?? 0)),
      amountDue: roundMoney(Math.max(0, Number(row.grandTotal ?? 0) - Number(row.amountPaid ?? 0))),
      payMode: isPayMode(row.payMode) ? row.payMode : null,
      payModeOther: row.payModeOther ? String(row.payModeOther) : null,
      paidAt: row.paidAt instanceof Date && !Number.isNaN(row.paidAt.getTime()) ? row.paidAt.toISOString() : null,
      createdAt: created,
    };
  }
}

function paymentFromDto(
  dto: CreateInvoiceDto,
  grandTotal: number,
  previous?: { status?: string; paidAt?: Date; payMode?: string; payModeOther?: string },
): {
  status: "issued" | "partial" | "paid";
  payMode?: PayMode;
  payModeOther?: string;
  amountPaid: number;
  paidAt?: Date;
} {
  const total = roundMoney(grandTotal);
  const payMode = dto.payMode || (isPayMode(previous?.payMode) ? previous.payMode : undefined);
  const wantsPaid = Boolean(dto.paid);
  const wantsPartial = !wantsPaid && Boolean(dto.partial);
  if ((wantsPaid || wantsPartial) && !payMode) {
    throw new BadRequestException({
      error: "validation_error",
      message: "Choose a pay mode",
    });
  }
  if (wantsPaid) {
    return {
      status: "paid",
      payMode,
      payModeOther: normalizePayModeOther(payMode, dto.payModeOther),
      amountPaid: total,
      paidAt: previous?.paidAt || new Date(),
    };
  }
  if (wantsPartial) {
    const received = roundMoney(Number(dto.amountPaid));
    if (!(received > 0)) {
      throw new BadRequestException({
        error: "validation_error",
        message: "Enter the amount received",
      });
    }
    if (received > total) {
      throw new BadRequestException({
        error: "validation_error",
        message: "Amount cannot be more than the bill total",
      });
    }
    if (received === total) {
      return {
        status: "paid",
        payMode,
        payModeOther: normalizePayModeOther(payMode, dto.payModeOther),
        amountPaid: total,
        paidAt: previous?.paidAt || new Date(),
      };
    }
    return {
      status: "partial",
      payMode,
      payModeOther: normalizePayModeOther(payMode, dto.payModeOther),
      amountPaid: received,
    };
  }
  return {
    status: "issued",
    payMode,
    payModeOther: normalizePayModeOther(payMode, dto.payModeOther),
    amountPaid: 0,
  };
}

function catalogGoodsQty(lines: InvoiceLine[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const line of lines || []) {
    if (line.source !== "catalog" || line.type !== "goods" || !line.itemId) continue;
    const id = String(line.itemId);
    map.set(id, (map.get(id) || 0) + Number(line.qty || 0));
  }
  return map;
}

function utcDay(value?: string, end = false): Date | undefined {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return undefined;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (end) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function invoiceDateRange(from?: string, to?: string): { $gte?: Date; $lt?: Date } | undefined {
  let start = utcDay(from);
  let end = utcDay(to, true);
  if (start && end && start >= end) {
    const swap = start;
    start = utcDay(to);
    end = utcDay(from, true);
  }
  if (!start && !end) return undefined;
  const range: { $gte?: Date; $lt?: Date } = {};
  if (start) range.$gte = start;
  if (end) range.$lt = end;
  return range;
}

function parseInvoiceDate(value?: string): Date {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new BadRequestException({
      error: "validation_error",
      message: "Use a valid invoice date",
    });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestException({
      error: "validation_error",
      message: "Use a valid invoice date",
    });
  }
  return date;
}

function dateOnly(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value) return value.slice(0, 10);
  return "";
}

function partyPayload(raw: unknown): InvoicePartyPayload {
  const row = (raw || {}) as Record<string, unknown>;
  return {
    name: String(row.name ?? ""),
    mobile: row.mobile ? String(row.mobile) : null,
    email: row.email ? String(row.email) : null,
    gstin: row.gstin ? String(row.gstin) : null,
    address: row.address ? String(row.address) : null,
    city: row.city ? String(row.city) : null,
    stateCode: row.stateCode ? String(row.stateCode) : null,
    state: row.state ? String(row.state) : null,
    pincode: row.pincode ? String(row.pincode) : null,
  };
}

function linePayload(row: Record<string, unknown>): InvoiceLinePayload {
  return {
    itemId: row.itemId ? String(row.itemId) : null,
    source: String(row.source ?? (row.itemId ? "catalog" : "custom")),
    name: String(row.name ?? ""),
    sku: row.sku ? String(row.sku) : null,
    hsnSac: row.hsnSac ? String(row.hsnSac) : null,
    type: String(row.type ?? "goods"),
    unit: String(row.unit ?? "pcs"),
    qty: Number(row.qty ?? 0),
    rate: Number(row.rate ?? 0),
    gstRate: Number(row.gstRate ?? 0),
    cessRate: Number(row.cessRate ?? 0),
    taxInclusive: Boolean(row.taxInclusive),
    taxable: Number(row.taxable ?? 0),
    gst: Number(row.gst ?? 0),
    cess: Number(row.cess ?? 0),
    cgst: Number(row.cgst ?? 0),
    sgst: Number(row.sgst ?? 0),
    igst: Number(row.igst ?? 0),
    lineTotal: Number(row.lineTotal ?? 0),
  };
}
