import { Transform } from "class-transformer";
import { Matches } from "class-validator";
import { MOBILE_RE } from "../../common/input";
import { compactMobileDigits } from "../../common/mobile";

export class RequestOtpDto {
  @Transform(({ value }) => compactMobileDigits(value))
  @Matches(MOBILE_RE, { message: "Enter a valid 10-digit Indian mobile number" })
  mobile!: string;
}
