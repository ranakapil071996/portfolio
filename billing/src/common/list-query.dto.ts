import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { cleanLine, emptyToUndef, PAGE_MAX, QUERY_MAX } from "./input";

export class ListQueryDto {
  @Transform(({ value }) => (value == null || value === "" ? 1 : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(PAGE_MAX)
  page?: number = 1;

  @Transform(({ value }) => (value == null || value === "" ? 10 : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsString()
  @MaxLength(QUERY_MAX)
  q?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sort?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toLowerCase()))
  @IsOptional()
  @IsIn(["asc", "desc"], { message: "Sort direction must be asc or desc" })
  dir?: "asc" | "desc";
}
