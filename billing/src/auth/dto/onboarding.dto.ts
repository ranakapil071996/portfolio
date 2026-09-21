import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { cleanLine, emptyToUndef, GSTIN_RE } from "../../common/input";

export class OnboardingDto {
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @IsNotEmpty({ message: "Business name is required" })
  @MinLength(2, { message: "Business name must be at least 2 characters" })
  @MaxLength(120, { message: "Business name must be 120 characters or fewer" })
  businessName!: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toUpperCase()))
  @IsOptional()
  @Matches(GSTIN_RE, { message: "Enter a valid 15-character GSTIN, or leave it blank" })
  gstin?: string;
}
