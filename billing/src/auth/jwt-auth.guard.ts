import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { AppEnv } from "../config/env.validation";
import { AuthService } from "./auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const cookieName = this.config.get("cookieName", { infer: true });
    const token = req.cookies?.[cookieName];
    if (!token || typeof token !== "string") {
      throw new UnauthorizedException({ error: "unauthorized", message: "Please sign in again" });
    }
    req.user = await this.auth.userFromToken(token);
    return true;
  }
}
