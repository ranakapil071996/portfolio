import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

@Schema({ collection: "invoice_business_stats", versionKey: false })
export class InvoiceBusinessStat {
  @Prop({ type: Types.ObjectId, ref: "Business", required: true })
  businessId!: Types.ObjectId;

  @Prop({ default: false })
  rebuilt!: boolean;

  @Prop({ default: 0 })
  statsVersion!: number;

  @Prop({ default: 0 }) sales!: number;
  @Prop({ default: 0 }) taxable!: number;
  @Prop({ default: 0 }) gst!: number;
  @Prop({ default: 0 }) cess!: number;
  @Prop({ default: 0 }) paid!: number;
  @Prop({ default: 0 }) due!: number;
  @Prop({ default: 0 }) count!: number;
  @Prop({ default: 0 }) paidCount!: number;
  @Prop({ default: 0 }) partialCount!: number;
  @Prop({ default: 0 }) unpaidCount!: number;
  @Prop({ default: 0 }) cash!: number;
  @Prop({ default: 0 }) upi!: number;
  @Prop({ default: 0 }) card!: number;
  @Prop({ default: 0 }) bank!: number;
  @Prop({ default: 0 }) cheque!: number;
  @Prop({ default: 0 }) other!: number;
}

export type InvoiceBusinessStatDocument = HydratedDocument<InvoiceBusinessStat>;
export const InvoiceBusinessStatSchema = SchemaFactory.createForClass(InvoiceBusinessStat);

InvoiceBusinessStatSchema.index({ businessId: 1 }, { unique: true });
