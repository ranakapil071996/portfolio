import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { ClientSession, Connection } from "mongoose";

@Injectable()
export class MongoTx {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async run<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let value!: T;
      await session.withTransaction(async () => {
        value = await work(session);
      });
      return value;
    } finally {
      await session.endSession();
    }
  }
}
