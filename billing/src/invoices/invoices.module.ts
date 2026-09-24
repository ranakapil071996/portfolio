import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Business, BusinessSchema } from "../businesses/schemas/business.schema";
import { Customer, CustomerSchema } from "../customers/schemas/customer.schema";
import { Item, ItemSchema } from "../items/schemas/item.schema";
import { InvoiceStatsService } from "./invoice-stats.service";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceBusinessStat, InvoiceBusinessStatSchema } from "./schemas/invoice-business-stat.schema";
import { InvoiceDailyStat, InvoiceDailyStatSchema } from "./schemas/invoice-daily-stat.schema";
import { Invoice, InvoiceSchema } from "./schemas/invoice.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: InvoiceDailyStat.name, schema: InvoiceDailyStatSchema },
      { name: InvoiceBusinessStat.name, schema: InvoiceBusinessStatSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Item.name, schema: ItemSchema },
      { name: Business.name, schema: BusinessSchema },
    ]),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceStatsService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
