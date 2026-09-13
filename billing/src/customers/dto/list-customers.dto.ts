import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListCustomersDto {
  @Transform(({ value }) => (value == null || value === "" ? 1 : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Transform(({ value }) => (value == null || value === "" ? 10 : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @Transform(({ value }) => {
    const text = String(value ?? "").trim();
    return text ? text : undefined;
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
