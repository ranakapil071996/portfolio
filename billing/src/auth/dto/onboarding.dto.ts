import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class OnboardingDto {
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @IsNotEmpty({ message: "Business name is required" })
  @MinLength(2, { message: "Business name must be at least 2 characters" })
  @MaxLength(120, { message: "Business name must be 120 characters or fewer" })
  businessName!: string;

  @Transform(({ value }) => (value == null ? undefined : String(value).trim()))
  @IsOptional()
  @IsString()
  gstin?: string;
}
