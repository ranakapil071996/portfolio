import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./common/http-exception.filter";
import type { AppEnv } from "./config/env.validation";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const config = app.get(ConfigService<AppEnv, true>);
  const isProd = config.get("isProd", { infer: true });
  const corsOrigins = config.get("corsOrigins", { infer: true });

  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser("json", { limit: "200kb" });
  app.useBodyParser("urlencoded", { limit: "50kb", extended: true });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
  });
  app.set("trust proxy", 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  app.setGlobalPrefix("api");

  const port = config.get("port", { infer: true });
  await app.listen(port, "0.0.0.0");
  const mode = isProd ? "production" : "development";
  console.log(`Billing API ${mode} on http://127.0.0.1:${port}/api`);
  console.log(`CORS origins: ${corsOrigins.join(", ")}`);
}

void bootstrap();
