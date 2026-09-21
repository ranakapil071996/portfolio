import { Transform } from "class-transformer";
import { IsIn, IsNumber, IsOptional, Matches, Max, Min } from "class-validator";
import { cleanLine, emptyToUndef, MONEY_MAX, PAY_MODE_OTHER_RE, toFiniteNumber } from "../../common/input";
import { PAY_MODES, type PayMode } from "../invoice-payment";

export class MarkPaidDto {
  @Transform(({ value }) => emptyToUndef(cleanLine(value).toLowerCase()))
  @IsOptional()
  @IsIn(PAY_MODES, { message: "Choose a valid pay mode" })
  payMode?: PayMode;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @Matches(PAY_MODE_OTHER_RE, { message: "Enter a valid pay mode" })
  payModeOther?: string;

  @Transform(({ value }) => toFiniteNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0.01, { message: "Enter the remaining amount" })
  @Max(MONEY_MAX, { message: "Amount is too large" })
  amountPaid?: number;
}
