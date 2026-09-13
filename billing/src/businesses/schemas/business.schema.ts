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

  @Prop({ default: 0, min: 0 })
  invoiceSeq?: number;
}

export type BusinessDocument = HydratedDocument<Business>;
export const BusinessSchema = SchemaFactory.createForClass(Business);
