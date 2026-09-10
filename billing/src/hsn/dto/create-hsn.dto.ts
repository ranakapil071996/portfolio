import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { GST_RATES } from "../../items/schemas/item.schema";
import { HSN_TYPES } from "../schemas/hsn-code.schema";

export class CreateHsnDto {
  @Transform(({ value }) => String(value ?? "").trim().toUpperCase())
  @IsString()
  @Matches(/^[A-Z0-9]{2,12}$/, { message: "Enter a valid 2–12 character HSN/SAC code" })
  code!: string;

  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @IsNotEmpty({ message: "Description is required" })
  @MinLength(2, { message: "Description must be at least 2 characters" })
  @MaxLength(400)
  description!: string;

  @Transform(({ value }) => String(value ?? "goods").trim())
  @IsIn(HSN_TYPES, { message: "Type must be goods or service" })
  type!: (typeof HSN_TYPES)[number];

  @Transform(({ value }) => Number(value))
  @IsIn(GST_RATES, { message: "GST rate must be 0, 3, 5, 12, 18, 28, or 40" })
  gstRate!: number;
}
