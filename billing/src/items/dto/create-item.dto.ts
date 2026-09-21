import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  CESS_MAX,
  cleanLine,
  cleanMultiline,
  emptyToUndef,
  HSN_RE,
  MONEY_MAX,
  SKU_RE,
  STOCK_MAX,
  toFiniteNumber,
} from "../../common/input";
import { GST_RATES, ITEM_TYPES, ITEM_UNITS } from "../schemas/item.schema";

export class CreateItemDto {
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @IsNotEmpty({ message: "Item name is required" })
  @MinLength(2, { message: "Item name must be at least 2 characters" })
  @MaxLength(160)
  name!: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @Matches(SKU_RE, { message: "SKU can only use letters, numbers, and . _ - /" })
  sku?: string;

  @Transform(({ value }) => emptyToUndef(cleanMultiline(value)))
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @Transform(({ value }) => cleanLine(value || "goods"))
  @IsIn(ITEM_TYPES, { message: "Type must be goods or service" })
  type!: (typeof ITEM_TYPES)[number];

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toUpperCase()))
  @IsOptional()
  @Matches(HSN_RE, { message: "Enter a valid HSN/SAC code" })
  hsnSac?: string;

  @Transform(({ value }) => cleanLine(value || "pcs"))
  @IsIn(ITEM_UNITS, { message: "Choose a valid unit" })
  unit!: (typeof ITEM_UNITS)[number];

  @Transform(({ value }) => toFiniteNumber(value))
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0, { message: "Sale price cannot be negative" })
  @Max(MONEY_MAX, { message: "Sale price is too large" })
  salePrice!: number;

  @Transform(({ value }) => toFiniteNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0, { message: "Purchase price cannot be negative" })
  @Max(MONEY_MAX, { message: "Purchase price is too large" })
  purchasePrice?: number;

  @Transform(({ value }) => toFiniteNumber(value))
  @IsIn(GST_RATES, { message: "GST rate must be 0, 3, 5, 12, 18, 28, or 40" })
  gstRate!: number;

  @Transform(({ value }) => value === true || value === "true" || value === 1 || value === "1")
  @IsBoolean()
  taxInclusive!: boolean;

  @Transform(({ value }) => (value === "" || value == null ? 0 : toFiniteNumber(value)))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(CESS_MAX)
  cessRate?: number;

  @Transform(({ value }) => (value === "" || value == null ? 0 : toFiniteNumber(value)))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(STOCK_MAX, { message: "Stock quantity is too large" })
  stockQty?: number;

  @Transform(({ value }) => toFiniteNumber(value))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(STOCK_MAX, { message: "Low-stock alert is too large" })
  lowStockAt?: number;
}
