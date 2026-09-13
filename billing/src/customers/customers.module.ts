import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Business, BusinessSchema } from "../businesses/schemas/business.schema";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { Customer, CustomerSchema } from "./schemas/customer.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Business.name, schema: BusinessSchema },
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
