import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { cleanLine, QUERY_MAX } from "../../common/input";
import { HSN_TYPES } from "../schemas/hsn-code.schema";

export class SearchHsnDto {
  @Transform(({ value }) => cleanLine(value))
  @IsString()
  @MinLength(2, { message: "Type at least 2 characters" })
  @MaxLength(QUERY_MAX)
  q!: string;

  @Transform(({ value }) => (value == null || value === "" ? undefined : cleanLine(value)))
  @IsOptional()
  @IsIn(HSN_TYPES, { message: "Type must be goods or service" })
  type?: (typeof HSN_TYPES)[number];

  @Transform(({ value }) => (value == null || value === "" ? undefined : Number(value)))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;
}
