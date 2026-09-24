import { Global, Module } from "@nestjs/common";
import { MongoTx } from "./mongo-tx";

@Global()
@Module({
  providers: [MongoTx],
  exports: [MongoTx],
})
export class MongoTxModule {}
