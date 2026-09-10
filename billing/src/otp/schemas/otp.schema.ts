import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

@Schema({ timestamps: true, collection: "otps" })
export class OtpChallenge {
  @Prop({ required: true, index: true })
  mobile!: string;

  @Prop({ required: true })
  codeHash!: string;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt!: Date;

  @Prop({ required: true, default: 0 })
  attempts!: number;

  @Prop()
  consumedAt?: Date;

  createdAt?: Date;
}

export type OtpDocument = HydratedDocument<OtpChallenge>;
export const OtpSchema = SchemaFactory.createForClass(OtpChallenge);
