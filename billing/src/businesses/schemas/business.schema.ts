import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

@Schema({ timestamps: true, collection: "businesses" })
export class Business {
  @Prop({ type: Types.ObjectId, ref: "User", required: true, unique: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, match: /^[6-9]\d{9}$/ })
  mobile!: string;

  @Prop({ uppercase: true, trim: true, maxlength: 15 })
  gstin?: string;

  @Prop({ trim: true, lowercase: true, maxlength: 120 })
  email?: string;

  @Prop({ uppercase: true, trim: true, maxlength: 10 })
  pan?: string;

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

  @Prop({ trim: true, maxlength: 80 })
  logoFile?: string;

  @Prop({ trim: true, maxlength: 80 })
  signatureFile?: string;

  @Prop({ trim: true, maxlength: 80 })
  qrFile?: string;

  @Prop({ trim: true, maxlength: 80 })
  bankName?: string;

  @Prop({ trim: true, maxlength: 120 })
  bankAccountName?: string;

  @Prop({ trim: true, maxlength: 24 })
  bankAccountNumber?: string;

  @Prop({ uppercase: true, trim: true, maxlength: 11 })
  bankIfsc?: string;

  @Prop({ trim: true, lowercase: true, maxlength: 80 })
  upiId?: string;

  @Prop({ default: 0, min: 0 })
  invoiceSeq?: number;

  @Prop({ trim: true, maxlength: 20 })
  invoiceTemplate?: string;

  @Prop({ trim: true, maxlength: 20 })
  invoicePrinter?: string;
}

export type BusinessDocument = HydratedDocument<Business>;
export const BusinessSchema = SchemaFactory.createForClass(Business);
