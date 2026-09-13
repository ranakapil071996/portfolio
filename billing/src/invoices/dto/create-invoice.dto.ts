import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { GST_RATES } from "../../items/schemas/item.schema";

export const INVOICE_LINE_KINDS = ["goods", "service", "charge"] as const;

function emptyToUndef(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

export class InvoiceLineDto {
  @Transform(({ value }) => emptyToUndef(value))
  @IsOptional()
  @IsMongoId({ message: "Choose a saved item" })
  itemId?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @ValidateIf((row: InvoiceLineDto) => !row.itemId)
  @IsString()
  @MinLength(2, { message: "Item name is required" })
  @MaxLength(160)
  name?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsIn(INVOICE_LINE_KINDS, { message: "Line must be goods, service, or charge" })
  kind?: (typeof INVOICE_LINE_KINDS)[number];

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: "Quantity must be greater than 0" })
  @Max(1_000_000)
  qty!: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Rate cannot be negative" })
  rate?: number;

  @Transform(({ value }) => (value === "" || value == null ? undefined : Number(value)))
  @IsOptional()
  @IsIn(GST_RATES, { message: "GST rate must be 0, 3, 5, 12, 18, 28, or 40" })
  gstRate?: number;
}

export class CreateInvoiceDto {
  @IsMongoId({ message: "Choose a customer" })
  customerId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Use a valid invoice date" })
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Add at least one item" })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}
