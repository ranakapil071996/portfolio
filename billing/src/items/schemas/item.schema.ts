import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export const ITEM_TYPES = ["goods", "service"] as const;
export const ITEM_UNITS = ["pcs", "nos", "kg", "g", "ltr", "mtr", "box", "hour", "day", "sqft"] as const;
export const GST_RATES = [0, 3, 5, 12, 18, 28, 40] as const;

@Schema({ timestamps: true, collection: "items" })
export class Item {
  @Prop({ type: Types.ObjectId, ref: "Business", required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 160 })
  name!: string;

  @Prop({ trim: true, maxlength: 40 })
  sku?: string;

  @Prop({ trim: true, maxlength: 400 })
  description?: string;

  @Prop({ type: String, required: true, enum: ITEM_TYPES, default: "goods" })
  type!: (typeof ITEM_TYPES)[number];

  @Prop({ uppercase: true, trim: true, maxlength: 12 })
  hsnSac?: string;

  @Prop({ type: String, required: true, enum: ITEM_UNITS, default: "pcs" })
  unit!: (typeof ITEM_UNITS)[number];

  @Prop({ required: true, min: 0 })
  salePrice!: number;

  @Prop({ min: 0 })
  purchasePrice?: number;

  @Prop({ type: Number, required: true, enum: GST_RATES, default: 18 })
  gstRate!: number;

  @Prop({ default: false })
  taxInclusive!: boolean;

  @Prop({ min: 0, default: 0 })
  cessRate!: number;

  @Prop({ min: 0, default: 0 })
  stockQty!: number;

  @Prop({ min: 0 })
  lowStockAt?: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export type ItemDocument = HydratedDocument<Item>;
export const ItemSchema = SchemaFactory.createForClass(Item);

ItemSchema.index({ businessId: 1, name: 1 });
ItemSchema.index({ businessId: 1, sku: 1 }, { unique: true, sparse: true });
