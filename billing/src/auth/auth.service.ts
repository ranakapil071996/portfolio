import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import { ClientSession, Model, Types } from "mongoose";
import { MongoTx } from "../common/mongo-tx";
import type { AppEnv } from "../config/env.validation";
import { normalizeGstin } from "../common/gstin";
import { normalizeMobile } from "../common/mobile";
import { Business, BusinessDocument } from "../businesses/schemas/business.schema";
import { OtpChallenge, OtpDocument } from "../otp/schemas/otp.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { profileStatus } from "../common/profile-completion";
import { resolvePrint } from "../invoices/templates/catalog";
import type { AuthUser, SessionPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Business.name) private readonly businesses: Model<BusinessDocument>,
    @InjectModel(OtpChallenge.name) private readonly otps: Model<OtpDocument>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
    @Optional() private readonly tx?: MongoTx,
  ) {}

  private transaction<T>(work: (session: ClientSession | null) => Promise<T>): Promise<T> {
    if (!this.tx) return work(null);
    return this.tx.run(work);
  }

  async requestOtp(mobileRaw: string): Promise<{ expiresInSeconds: number }> {
    const mobile = normalizeMobile(mobileRaw);
    const windowMs = this.config.get("otpRequestWindowSeconds", { infer: true }) * 1000;
    const max = this.config.get("otpRequestMax", { infer: true });
    const recent = await this.otps.countDocuments({
      mobile,
      createdAt: { $gte: new Date(Date.now() - windowMs) },
    });
    if (recent >= max) {
      throw new HttpException(
        { error: "too_many_requests", message: "Wait a few minutes before requesting another OTP" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.config.get("otpStaticCode", { infer: true });
    const codeHash = await bcrypt.hash(code, 10);
    const ttl = this.config.get("otpTtlSeconds", { infer: true });
    await this.transaction(async (session) => {
      const opts = session ? { session } : {};
      await this.otps.updateMany({ mobile, consumedAt: { $exists: false } }, { $set: { consumedAt: new Date() } }, opts);
      const challenge = { mobile, codeHash, expiresAt: new Date(Date.now() + ttl * 1000), attempts: 0 };
      if (session) await this.otps.create([challenge], opts);
      else await this.otps.create(challenge);
    });
    return { expiresInSeconds: ttl };
  }

  async verifyOtp(mobileRaw: string, code: string): Promise<SessionPayload> {
    const mobile = normalizeMobile(mobileRaw);
    const otp = await this.otps
      .findOne({ mobile, consumedAt: { $exists: false } })
      .sort({ createdAt: -1 });
    if (!otp) {
      throw new UnauthorizedException({
        error: "otp_not_found",
        message: "Request a new OTP and try again",
      });
    }
    if (otp.expiresAt.getTime() <= Date.now()) {
      otp.consumedAt = new Date();
      await otp.save();
      throw new UnauthorizedException({
        error: "otp_expired",
        message: "That OTP has expired. Request a new one",
      });
    }
    const maxAttempts = this.config.get("otpMaxAttempts", { infer: true });
    if (otp.attempts >= maxAttempts) {
      throw new HttpException(
        { error: "otp_locked", message: "Too many incorrect attempts. Request a new OTP" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    otp.attempts += 1;
    const match = await bcrypt.compare(code, otp.codeHash);
    if (!match) {
      await otp.save();
      throw new UnauthorizedException({
        error: "otp_invalid",
        message: "Incorrect OTP. Use 0000 for now",
      });
    }
    const user = await this.transaction(async (session) => {
      const opts = session ? { session } : {};
      otp.consumedAt = new Date();
      await otp.save(opts);
      let account = await this.users.findOne({ mobile }, null, opts);
      if (!account) {
        const created = {
          mobile,
          status: "pending_onboarding" as const,
          mobileVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        };
        const written = session ? await this.users.create([created], opts) : await this.users.create(created);
        account = Array.isArray(written) ? written[0] : written;
      } else {
        account.mobileVerifiedAt = account.mobileVerifiedAt || new Date();
        account.lastLoginAt = new Date();
        await account.save(opts);
      }
      return account;
    });

    return this.sessionFor(user);
  }

  async completeOnboarding(
    authUser: AuthUser,
    input: { businessName: string; gstin?: string },
  ): Promise<SessionPayload> {
    const user = await this.users.findById(authUser.id);
    if (!user) {
      throw new UnauthorizedException({ error: "unauthorized", message: "Please sign in again" });
    }
    const existing = await this.businesses.findOne({ userId: user._id });
    if (existing) {
      throw new ConflictException({
        error: "already_onboarded",
        message: "This account already has a business",
      });
    }
    const name = input.businessName.trim();
    if (name.length < 2) {
      throw new HttpException(
        { error: "validation_error", message: "Business name is required" },
        HttpStatus.BAD_REQUEST,
      );
    }
    let gstin: string | undefined;
    try {
      gstin = normalizeGstin(input.gstin);
    } catch (err) {
      throw new HttpException(
        { error: "validation_error", message: (err as Error).message },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.transaction(async (session) => {
      const opts = session ? { session } : {};
      const business = { userId: user._id, name, mobile: user.mobile, gstin };
      if (session) await this.businesses.create([business], opts);
      else await this.businesses.create(business);
      user.status = "active";
      await user.save(opts);
    });
    return this.sessionFor(user);
  }

  async me(authUser: AuthUser): Promise<SessionPayload> {
    const user = await this.users.findById(authUser.id);
    if (!user) {
      throw new UnauthorizedException({ error: "unauthorized", message: "Please sign in again" });
    }
    return this.sessionFor(user);
  }

  signToken(user: { id: string; mobile: string }): string {
    return this.jwt.sign({ sub: user.id, mobile: user.mobile });
  }

  async userFromToken(token: string): Promise<AuthUser> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; mobile: string }>(token);
      if (!payload?.sub || !Types.ObjectId.isValid(payload.sub)) {
        throw new Error("bad token");
      }
      const user = await this.users.findById(payload.sub);
      if (!user) throw new Error("missing user");
      return { id: String(user._id), mobile: user.mobile, status: user.status };
    } catch {
      throw new UnauthorizedException({ error: "unauthorized", message: "Please sign in again" });
    }
  }

  private async sessionFor(user: UserDocument): Promise<SessionPayload> {
    const business = await this.businesses.findOne({ userId: user._id });
    const needsOnboarding = !business;
    return {
      needsOnboarding,
      user: {
        id: String(user._id),
        mobile: user.mobile,
        status: needsOnboarding ? "pending_onboarding" : "active",
      },
      business: business
        ? {
            id: String(business._id),
            name: business.name,
            mobile: business.mobile,
            gstin: business.gstin || null,
            invoiceTemplate: resolvePrint(business.invoiceTemplate, business.invoicePrinter).template,
            invoicePrinter: resolvePrint(business.invoiceTemplate, business.invoicePrinter).printer,
            profile: (() => {
              const status = profileStatus(business);
              return {
                percent: status.percent,
                complete: status.complete,
                missing: status.missing,
              };
            })(),
          }
        : null,
    };
  }
}
