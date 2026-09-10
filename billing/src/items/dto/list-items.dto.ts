import { Transform } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class ListItemsDto {
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
}
