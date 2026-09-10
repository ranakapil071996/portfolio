import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches } from "class-validator";

export class VerifyOtpDto {
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @IsNotEmpty({ message: "Mobile number is required" })
  mobile!: string;

  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @Matches(/^\d{4}$/, { message: "Enter the 4-digit OTP" })
  code!: string;
}
