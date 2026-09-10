import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

export class RequestOtpDto {
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @IsNotEmpty({ message: "Mobile number is required" })
  mobile!: string;
}
