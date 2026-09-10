import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export const HSN_TYPES = ["goods", "service"] as const;
export const HSN_SOURCES = ["catalog", "user"] as const;

@Schema({ timestamps: true, collection: "hsn_codes" })
export class HsnCode {
  @Prop({ required: true, uppercase: true, trim: true, maxlength: 12 })
  code!: string;

  @Prop({ type: String, required: true, enum: HSN_TYPES })
  type!: (typeof HSN_TYPES)[number];

  @Prop({ required: true, trim: true, maxlength: 400 })
  description!: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 420 })
  searchKey!: string;

  @Prop({ type: Number, required: true })
  gstRate!: number;

  @Prop({ required: true, trim: true, maxlength: 8 })
  chapter!: string;

  @Prop({ required: true, trim: true, maxlength: 40 })
  catalogVersion!: string;

  @Prop({ type: String, enum: HSN_SOURCES, default: "catalog", index: true })
  source!: (typeof HSN_SOURCES)[number];
}

export type HsnCodeDocument = HydratedDocument<HsnCode>;
export const HsnCodeSchema = SchemaFactory.createForClass(HsnCode);

HsnCodeSchema.index({ code: 1 }, { unique: true });
HsnCodeSchema.index({ type: 1, code: 1 });
HsnCodeSchema.index({ type: 1, searchKey: 1 });
