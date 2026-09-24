import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BusinessModule } from "./businesses/business.module";
import { MongoTxModule } from "./common/mongo-tx.module";
import { loadEnv, type AppEnv } from "./config/env.validation";
import { CustomersModule } from "./customers/customers.module";
import { HealthController } from "./health.controller";
import { HsnModule } from "./hsn/hsn.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { ItemsModule } from "./items/items.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [".env"],
      load: [() => loadEnv()],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        uri: config.get("mongodbUri", { infer: true }),
        serverSelectionTimeoutMS: 8000,
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 40 }],
    }),
    MongoTxModule,
    AuthModule,
    BusinessModule,
    ItemsModule,
    CustomersModule,
    InvoicesModule,
    HsnModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
