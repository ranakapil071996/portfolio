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
import { GST_RATES, ITEM_TYPES, ITEM_UNITS } from "../schemas/item.schema";

function emptyToUndef(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

export class CreateItemDto {
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @IsNotEmpty({ message: "Item name is required" })
  @MinLength(2, { message: "Item name must be at least 2 characters" })
  @MaxLength(160)
  name!: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sku?: string;

  @Transform(({ value }) => emptyToUndef(value != null ? String(value).trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @Transform(({ value }) => String(value ?? "goods").trim())
  @IsIn(ITEM_TYPES, { message: "Type must be goods or service" })
  type!: (typeof ITEM_TYPES)[number];

  @Transform(({ value }) =>
    emptyToUndef(value != null ? String(value).trim().toUpperCase() : value),
  )
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{2,12}$/, { message: "Enter a valid HSN/SAC code" })
  hsnSac?: string;

  @Transform(({ value }) => String(value ?? "pcs").trim())
  @IsIn(ITEM_UNITS, { message: "Choose a valid unit" })
  unit!: (typeof ITEM_UNITS)[number];

  @Transform(({ value }) => Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Sale price cannot be negative" })
  salePrice!: number;

  @Transform(({ value }) => (value === "" || value == null ? undefined : Number(value)))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchasePrice?: number;

  @Transform(({ value }) => Number(value))
  @IsIn(GST_RATES, { message: "GST rate must be 0, 3, 5, 12, 18, 28, or 40" })
  gstRate!: number;

  @Transform(({ value }) => value === true || value === "true" || value === 1 || value === "1")
  @IsBoolean()
  taxInclusive!: boolean;

  @Transform(({ value }) => (value === "" || value == null ? 0 : Number(value)))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  cessRate?: number;

  @Transform(({ value }) => (value === "" || value == null ? 0 : Number(value)))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockQty?: number;

  @Transform(({ value }) => (value === "" || value == null ? undefined : Number(value)))
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  lowStockAt?: number;
}
