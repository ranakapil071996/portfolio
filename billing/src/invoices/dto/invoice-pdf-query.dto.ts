import { Transform } from "class-transformer";
import { IsIn, IsOptional } from "class-validator";
import { INVOICE_PRINTERS, INVOICE_TEMPLATES } from "../templates/catalog";

function emptyToUndef(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

export class InvoicePdfQueryDto {
  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsIn(INVOICE_TEMPLATES, { message: "Choose a valid invoice template" })
  template?: (typeof INVOICE_TEMPLATES)[number];

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsIn(INVOICE_PRINTERS, { message: "Choose a valid printer size" })
  printer?: (typeof INVOICE_PRINTERS)[number];
}
