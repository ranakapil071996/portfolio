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

function emptyToUndef(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

function compactMobile(value: unknown): unknown {
  const raw = emptyToUndef(value != null ? String(value).trim() : value);
  if (raw == null) return undefined;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits;
}

export class CreateCustomerDto {
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @IsNotEmpty({ message: "Customer name is required" })
  @MinLength(2, { message: "Customer name must be at least 2 characters" })
  @MaxLength(160)
  name!: string;

  @Transform(({ value }) => compactMobile(value))
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: "Enter a valid 10-digit Indian mobile number" })
  mobile?: string;

  @Transform(({ value }) =>
    emptyToUndef(value != null ? String(value).trim().toLowerCase() : value),
  )
  @IsOptional()
  @IsEmail({}, { message: "Enter a valid email, or leave it blank" })
  @MaxLength(120)
  email?: string;

  @Transform(({ value }) =>
    emptyToUndef(value != null ? String(value).trim().toUpperCase() : value),
  )
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, {
    message: "Enter a valid 15-character GSTIN, or leave it blank",
  })
  gstin?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsIn(INDIAN_STATE_CODES, { message: "Choose a valid Indian state" })
  stateCode?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @Matches(/^\d{6}$/, { message: "Enter a 6-digit PIN code, or leave it blank" })
  pincode?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}
