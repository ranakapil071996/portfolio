import { Controller, Get } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";

@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  check() {
    const ready = this.connection.readyState === 1;
    return {
      ok: ready,
      service: "billing",
      db: ready ? "up" : "down",
    };
  }
}
