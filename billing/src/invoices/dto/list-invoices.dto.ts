import { Transform } from "class-transformer";
import { IsIn, IsOptional } from "class-validator";
import { cleanLine, emptyToUndef, IsInvoiceDate } from "../../common/input";
import { ListQueryDto } from "../../common/list-query.dto";

export class ListInvoicesDto extends ListQueryDto {
  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsInvoiceDate()
  from?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value)))
  @IsOptional()
  @IsInvoiceDate()
  to?: string;

  @Transform(({ value }) => emptyToUndef(cleanLine(value).toLowerCase()))
  @IsOptional()
  @IsIn(["unpaid", "partial", "paid"], { message: "Choose unpaid, partial, or paid" })
  pay?: "unpaid" | "partial" | "paid";
}
