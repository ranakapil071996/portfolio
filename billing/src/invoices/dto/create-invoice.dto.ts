import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
import {
  cleanLine,
  cleanMultiline,
  emptyToUndef,
  IsInvoiceDate,
  MONEY_MAX,
  NOTES_MAX,
  PAY_MODE_OTHER_RE,
  QTY_MAX,
  toFiniteNumber,
} from "../../common/input";
import { GST_RATES, ITEM_UNITS } from "../../items/schemas/item.schema";
import { PAY_MODES, type PayMode } from "../invoice-payment";

export const INVOICE_LINE_KINDS = ["goods", "service", "charge"] as const;

export class InvoiceLineDto {
  @Transform(({ value }) => emptyToUndef(value))
  @IsOptional()
  @IsMongoId({ message: "Choose a saved item" })
  itemId?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @ValidateIf((row: InvoiceLineDto) => !row.itemId)
  @IsString()
  @MinLength(2, { message: "Item name is required" })
  @MaxLength(160)
  name?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsIn(INVOICE_LINE_KINDS, { message: "Line must be goods, service, or charge" })
  kind?: (typeof INVOICE_LINE_KINDS)[number];

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsIn(ITEM_UNITS, { message: "Choose a valid unit" })
  unit?: (typeof ITEM_UNITS)[number];

  @Transform(({ value }) => toFiniteNumber(value))
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0.001, { message: "Quantity must be greater than 0" })
  @Max(QTY_MAX, { message: "Quantity is too large" })
  qty!: number;

  @Transform(({ value }) => toFiniteNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0, { message: "Rate cannot be negative" })
  @Max(MONEY_MAX, { message: "Rate is too large" })
  rate?: number;

  @Transform(({ value }) => toFiniteNumber(value))
  @IsOptional()
  @IsIn(GST_RATES, { message: "GST rate must be 0, 3, 5, 12, 18, 28, or 40" })
  gstRate?: number;
}

export class CreateInvoiceDto {
  @Transform(({ value }) => emptyToUndef(value))
  @ValidateIf((dto: CreateInvoiceDto) => !dto.customerName)
  @IsMongoId({ message: "Choose a customer" })
  customerId?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @ValidateIf((dto: CreateInvoiceDto) => !dto.customerId)
  @IsString()
  @MinLength(2, { message: "Customer name is required" })
  @MaxLength(160)
  customerName?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsInvoiceDate()
  invoiceDate?: string;

  @Transform(({ value }) => emptyToUndef(cleanMultiline(value)))
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_MAX)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Add at least one item" })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toLowerCase()))
  @IsOptional()
  @IsIn(PAY_MODES, { message: "Choose a valid pay mode" })
  payMode?: PayMode;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @Matches(PAY_MODE_OTHER_RE, { message: "Enter a valid pay mode" })
  payModeOther?: string;

  @Transform(({ value }) => value === true || value === "true" || value === 1 || value === "1")
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @Transform(({ value }) => value === true || value === "true" || value === 1 || value === "1")
  @IsOptional()
  @IsBoolean()
  partial?: boolean;

  @Transform(({ value }) => toFiniteNumber(value))
  @ValidateIf((dto: CreateInvoiceDto) => dto.partial === true && dto.paid !== true)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0.01, { message: "Enter the amount received" })
  @Max(MONEY_MAX, { message: "Amount is too large" })
  amountPaid?: number;
}
