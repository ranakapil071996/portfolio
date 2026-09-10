import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import type { AppEnv } from "../config/env.validation";
import { CurrentUser } from "../common/current-user.decorator";
import { AuthService } from "./auth.service";
import type { AuthUser } from "./auth.types";
import { OnboardingDto } from "./dto/onboarding.dto";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  @Post("otp/request")
  @HttpCode(200)
  async requestOtp(@Body() body: RequestOtpDto) {
    const result = await this.auth.requestOtp(body.mobile);
    return {
      ok: true,
      expiresInSeconds: result.expiresInSeconds,
      hint: "Use OTP 0000",
    };
  }

  @Post("otp/verify")
  @HttpCode(200)
  async verifyOtp(@Body() body: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.verifyOtp(body.mobile, body.code);
    this.setSession(res, this.auth.signToken({ id: session.user.id, mobile: session.user.mobile }));
    return session;
  }

  @Post("onboarding")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async onboarding(@CurrentUser() user: AuthUser, @Body() body: OnboardingDto) {
    return this.auth.completeOnboarding(user, body);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.config.get("cookieName", { infer: true }), this.cookieBase());
    return { ok: true };
  }

  private setSession(res: Response, token: string): void {
    res.cookie(this.config.get("cookieName", { infer: true }), token, {
      ...this.cookieBase(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private cookieBase() {
    const isProd = this.config.get("isProd", { infer: true });
    return {
      httpOnly: true,
      sameSite: (isProd ? "none" : "lax") as "none" | "lax",
      secure: isProd,
      path: "/",
    };
  }
}
