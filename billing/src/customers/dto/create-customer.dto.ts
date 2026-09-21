import { Transform } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { INDIAN_STATE_CODES } from "../../common/indian-states";
import {
  cleanLine,
  cleanMultiline,
  emptyToUndef,
  GSTIN_RE,
  MOBILE_RE,
  NOTES_MAX,
  PIN_RE,
} from "../../common/input";
import { compactMobileDigits } from "../../common/mobile";

export class CreateCustomerDto {
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @IsNotEmpty({ message: "Customer name is required" })
  @MinLength(2, { message: "Customer name must be at least 2 characters" })
  @MaxLength(160)
  name!: string;

  @Transform(({ value }) => emptyToUndef(compactMobileDigits(value)))
  @IsOptional()
  @Matches(MOBILE_RE, { message: "Enter a valid 10-digit Indian mobile number" })
  mobile?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toLowerCase()))
  @IsOptional()
  @IsEmail({}, { message: "Enter a valid email, or leave it blank" })
  @MaxLength(120)
  email?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toUpperCase()))
  @IsOptional()
  @Matches(GSTIN_RE, { message: "Enter a valid 15-character GSTIN, or leave it blank" })
  gstin?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsIn(INDIAN_STATE_CODES, { message: "Choose a valid Indian state" })
  stateCode?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @Matches(PIN_RE, { message: "Enter a 6-digit PIN code, or leave it blank" })
  pincode?: string;

  @Transform(({ value }) => emptyToUndef(cleanMultiline(value)))
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX)
  notes?: string;
}
