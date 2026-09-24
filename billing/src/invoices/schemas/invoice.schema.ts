import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

import { PAY_MODES } from "../invoice-payment";

export const INVOICE_STATUSES = ["issued", "partial", "paid"] as const;
export const TAX_SPLITS = ["cgst_sgst", "igst"] as const;
export { PAY_MODES };

@Schema({ _id: false })
export class InvoiceParty {
  @Prop({ required: true, trim: true, maxlength: 160 })
  name!: string;

  @Prop({ trim: true })
  mobile?: string;

  @Prop({ trim: true })
  email?: string;

  @Prop({ uppercase: true, trim: true })
  gstin?: string;

  @Prop({ trim: true, maxlength: 200 })
  address?: string;

  @Prop({ trim: true, maxlength: 80 })
  city?: string;

  @Prop({ trim: true, maxlength: 2 })
  stateCode?: string;

  @Prop({ trim: true, maxlength: 80 })
  state?: string;

  @Prop({ trim: true })
  pincode?: string;
}

export const INVOICE_LINE_SOURCES = ["catalog", "custom", "charge"] as const;

@Schema({ _id: false })
export class InvoiceLine {
  @Prop({ type: Types.ObjectId, ref: "Item" })
  itemId?: Types.ObjectId;

  @Prop({ type: String, enum: INVOICE_LINE_SOURCES, default: "catalog" })
  source!: (typeof INVOICE_LINE_SOURCES)[number];

  @Prop({ required: true, trim: true, maxlength: 160 })
  name!: string;

  @Prop({ trim: true, maxlength: 40 })
  sku?: string;

  @Prop({ uppercase: true, trim: true, maxlength: 12 })
  hsnSac?: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  type!: string;

  @Prop({ required: true, trim: true, maxlength: 20 })
  unit!: string;

  @Prop({ required: true, min: 0.001 })
  qty!: number;

  @Prop({ required: true, min: 0 })
  rate!: number;

  @Prop({ required: true, min: 0 })
  gstRate!: number;

  @Prop({ min: 0, default: 0 })
  cessRate!: number;

  @Prop({ default: false })
  taxInclusive!: boolean;

  @Prop({ required: true, min: 0 })
  taxable!: number;

  @Prop({ required: true, min: 0 })
  gst!: number;

  @Prop({ required: true, min: 0 })
  cess!: number;

  @Prop({ required: true, min: 0 })
  cgst!: number;

  @Prop({ required: true, min: 0 })
  sgst!: number;

  @Prop({ required: true, min: 0 })
  igst!: number;

  @Prop({ required: true, min: 0 })
  lineTotal!: number;
}

@Schema({ timestamps: true, collection: "invoices" })
export class Invoice {
  @Prop({ type: Types.ObjectId, ref: "Business", required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 20 })
  invoiceNumber!: string;

  @Prop({ required: true })
  invoiceDate!: Date;

  @Prop({ type: String, enum: INVOICE_STATUSES, default: "issued" })
  status!: (typeof INVOICE_STATUSES)[number];

  @Prop({ type: String, enum: PAY_MODES })
  payMode?: (typeof PAY_MODES)[number];

  @Prop({ trim: true, maxlength: 40 })
  payModeOther?: string;

  @Prop({ default: 0 })
  amountPaid?: number;

  @Prop()
  paidAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "Customer", index: true })
  customerId?: Types.ObjectId;

  @Prop({ type: InvoiceParty, required: true })
  customer!: InvoiceParty;

  @Prop({ type: InvoiceParty, required: true })
  seller!: InvoiceParty;

  @Prop({ trim: true, maxlength: 80 })
  placeOfSupply?: string;

  @Prop({ trim: true, maxlength: 2 })
  placeOfSupplyCode?: string;

  @Prop({ type: String, enum: TAX_SPLITS, required: true })
  taxSplit!: (typeof TAX_SPLITS)[number];

  @Prop({ type: [InvoiceLine], required: true })
  lines!: InvoiceLine[];

  @Prop({ required: true, min: 0 })
  taxableTotal!: number;

  @Prop({ required: true, min: 0 })
  cgstTotal!: number;

  @Prop({ required: true, min: 0 })
  sgstTotal!: number;

  @Prop({ required: true, min: 0 })
  igstTotal!: number;

  @Prop({ required: true, min: 0 })
  cessTotal!: number;

  @Prop({ required: true, min: 0 })
  grandTotal!: number;

  @Prop({ trim: true, maxlength: 400 })
  notes?: string;

  @Prop({ index: true })
  deletedAt?: Date;
}

export type InvoiceDocument = HydratedDocument<Invoice>;
export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ businessId: 1, createdAt: -1 });
