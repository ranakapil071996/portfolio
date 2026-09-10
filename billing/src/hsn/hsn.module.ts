import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { HsnController } from "./hsn.controller";
import { HsnService } from "./hsn.service";
import { HsnCode, HsnCodeSchema } from "./schemas/hsn-code.schema";

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: HsnCode.name, schema: HsnCodeSchema }])],
  controllers: [HsnController],
  providers: [HsnService],
  exports: [HsnService],
})
export class HsnModule {}
