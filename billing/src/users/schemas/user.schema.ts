import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type { UserStatus } from "../../auth/auth.types";

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, unique: true, index: true, match: /^[6-9]\d{9}$/ })
  mobile!: string;

  @Prop({ required: true, enum: ["pending_onboarding", "active"], default: "pending_onboarding" })
  status!: UserStatus;

  @Prop()
  mobileVerifiedAt?: Date;

  @Prop()
  lastLoginAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
