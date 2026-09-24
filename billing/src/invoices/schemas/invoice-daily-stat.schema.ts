import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

@Schema({ collection: "invoice_daily_stats", versionKey: false })
export class InvoiceDailyStat {
  @Prop({ type: Types.ObjectId, ref: "Business", required: true })
  businessId!: Types.ObjectId;

  @Prop({ required: true })
  day!: string;

  @Prop({ required: true })
  month!: string;

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

export type InvoiceDailyStatDocument = HydratedDocument<InvoiceDailyStat>;
export const InvoiceDailyStatSchema = SchemaFactory.createForClass(InvoiceDailyStat);

InvoiceDailyStatSchema.index({ businessId: 1, day: 1 }, { unique: true });
InvoiceDailyStatSchema.index({ businessId: 1, month: 1 });
