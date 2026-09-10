import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Business, BusinessSchema } from "../businesses/schemas/business.schema";
import { ItemsController } from "./items.controller";
import { ItemsService } from "./items.service";
import { Item, ItemSchema } from "./schemas/item.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Item.name, schema: ItemSchema },
      { name: Business.name, schema: BusinessSchema },
    ]),
  ],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
