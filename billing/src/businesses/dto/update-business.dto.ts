import { Transform } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { INDIAN_STATE_CODES } from "../../common/indian-states";
import { INVOICE_PRINTERS, INVOICE_TEMPLATES } from "../../invoices/templates/catalog";

function emptyToUndef(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

export class UpdateBusinessDto {
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @MinLength(2, { message: "Business name must be at least 2 characters" })
  @MaxLength(120)
  name!: string;

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

  @Transform(({ value }) =>
    emptyToUndef(value != null ? String(value).trim().toUpperCase() : value),
  )
  @IsOptional()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: "Enter a valid 10-character PAN, or leave it blank" })
  pan?: string;

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
  @MaxLength(80)
  bankName?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountName?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).replace(/\s+/g, "") : value))
  @IsOptional()
  @Matches(/^\d{6,22}$/, { message: "Enter a valid account number, or leave it blank" })
  bankAccountNumber?: string;

  @Transform(({ value }) =>
    emptyToUndef(value != null ? String(value).trim().toUpperCase() : value),
  )
  @IsOptional()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: "Enter a valid IFSC, or leave it blank" })
  bankIfsc?: string;

  @Transform(({ value }) =>
    emptyToUndef(value != null ? String(value).trim().toLowerCase() : value),
  )
  @IsOptional()
  @Matches(/^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/i, {
    message: "Enter a valid UPI ID, or leave it blank",
  })
  upiId?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsIn(INVOICE_TEMPLATES, { message: "Choose a valid invoice template" })
  invoiceTemplate?: (typeof INVOICE_TEMPLATES)[number];

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsIn(INVOICE_PRINTERS, { message: "Choose a valid printer size" })
  invoicePrinter?: (typeof INVOICE_PRINTERS)[number];
}
