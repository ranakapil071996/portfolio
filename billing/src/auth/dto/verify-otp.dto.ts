import { Transform } from "class-transformer";
import { Matches } from "class-validator";
import { MOBILE_RE, OTP_RE } from "../../common/input";
import { compactMobileDigits } from "../../common/mobile";

export class VerifyOtpDto {
  @Transform(({ value }) => compactMobileDigits(value))
  @Matches(MOBILE_RE, { message: "Enter a valid 10-digit Indian mobile number" })
  mobile!: string;

  @Transform(({ value }) => String(value ?? "").replace(/\D/g, ""))
  @Matches(OTP_RE, { message: "Enter the 4-digit OTP" })
  code!: string;
}
