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
import {
  ACCOUNT_RE,
  cleanLine,
  emptyToUndef,
  GSTIN_RE,
  IFSC_RE,
  PAN_RE,
  PIN_RE,
  UPI_RE,
} from "../../common/input";
import { INVOICE_PRINTERS, INVOICE_TEMPLATES } from "../../invoices/templates/catalog";

export class UpdateBusinessDto {
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @MinLength(2, { message: "Business name must be at least 2 characters" })
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toLowerCase()))
  @IsOptional()
  @IsEmail({}, { message: "Enter a valid email, or leave it blank" })
  @MaxLength(120)
  email?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toUpperCase()))
  @IsOptional()
  @Matches(GSTIN_RE, { message: "Enter a valid 15-character GSTIN, or leave it blank" })
  gstin?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toUpperCase()))
  @IsOptional()
  @Matches(PAN_RE, { message: "Enter a valid 10-character PAN, or leave it blank" })
  pan?: string;

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

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankAccountName?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).replace(/\s+/g, "")))
  @IsOptional()
  @Matches(ACCOUNT_RE, { message: "Enter a valid account number, or leave it blank" })
  bankAccountNumber?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toUpperCase()))
  @IsOptional()
  @Matches(IFSC_RE, { message: "Enter a valid IFSC, or leave it blank" })
  bankIfsc?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toLowerCase()))
  @IsOptional()
  @Matches(UPI_RE, { message: "Enter a valid UPI ID, or leave it blank" })
  upiId?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsIn(INVOICE_TEMPLATES, { message: "Choose a valid invoice template" })
  invoiceTemplate?: (typeof INVOICE_TEMPLATES)[number];

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsIn(INVOICE_PRINTERS, { message: "Choose a valid printer size" })
  invoicePrinter?: (typeof INVOICE_PRINTERS)[number];
}
