import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

@Schema({ timestamps: true, collection: "customers" })
export class Customer {
  @Prop({ type: Types.ObjectId, ref: "Business", required: true, index: true })
  businessId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: "User", required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 160 })
  name!: string;

  @Prop({ trim: true, match: /^[6-9]\d{9}$/ })
  mobile?: string;

  @Prop({ trim: true, lowercase: true, maxlength: 120 })
  email?: string;

  @Prop({ uppercase: true, trim: true, maxlength: 15 })
  gstin?: string;

  @Prop({ trim: true, maxlength: 200 })
  address?: string;

  @Prop({ trim: true, maxlength: 80 })
  city?: string;

  @Prop({ trim: true, maxlength: 2 })
  stateCode?: string;

  @Prop({ trim: true, maxlength: 80 })
  state?: string;

  @Prop({ trim: true, match: /^\d{6}$/ })
  pincode?: string;

  @Prop({ trim: true, maxlength: 400 })
  notes?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ index: true })
  deletedAt?: Date;
}

export type CustomerDocument = HydratedDocument<Customer>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);

CustomerSchema.index({ businessId: 1, name: 1 });
CustomerSchema.index(
  { businessId: 1, gstin: 1 },
  { unique: true, partialFilterExpression: { gstin: { $type: "string" }, deletedAt: null } },
);
CustomerSchema.index(
  { businessId: 1, mobile: 1 },
  { unique: true, partialFilterExpression: { mobile: { $type: "string" }, deletedAt: null } },
);
