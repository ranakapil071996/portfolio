import { HttpException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Types } from "mongoose";
import { AuthService } from "./auth.service";

function env() {
  return {
    otpStaticCode: "0000",
    otpTtlSeconds: 300,
    otpMaxAttempts: 5,
    otpRequestWindowSeconds: 600,
    otpRequestMax: 3,
    jwtSecret: "x".repeat(32),
    jwtExpiresIn: "7d",
  };
}

function mockModel(overrides: Record<string, unknown> = {}) {
  return {
    countDocuments: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn(),
    findById: jest.fn(),
    ...overrides,
  };
}

describe("AuthService", () => {
  const config = {
    get: jest.fn((key: string) => env()[key as keyof ReturnType<typeof env>]),
  } as unknown as ConfigService<import("../config/env.validation").AppEnv, true>;
  const jwt = { sign: jest.fn().mockReturnValue("token") } as unknown as JwtService;

  it("rate-limits OTP requests", async () => {
    const otps = mockModel({ countDocuments: jest.fn().mockResolvedValue(3) });
    const service = new AuthService(
      mockModel() as never,
      mockModel() as never,
      otps as never,
      jwt,
      config,
    );
    await expect(service.requestOtp("9876543210")).rejects.toBeInstanceOf(HttpException);
    expect(otps.create).not.toHaveBeenCalled();
  });

  it("issues an OTP for a valid mobile", async () => {
    const otps = mockModel();
    const service = new AuthService(
      mockModel() as never,
      mockModel() as never,
      otps as never,
      jwt,
      config,
    );
    const result = await service.requestOtp("+91 9876543210");
    expect(result.expiresInSeconds).toBe(300);
    expect(otps.create).toHaveBeenCalled();
  });

  it("rejects an incorrect OTP", async () => {
    const otpDoc = {
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      codeHash: await (await import("bcrypt")).hash("0000", 4),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const otps = mockModel({
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(otpDoc),
      }),
    });
    const service = new AuthService(
      mockModel() as never,
      mockModel() as never,
      otps as never,
      jwt,
      config,
    );
    await expect(service.verifyOtp("9876543210", "1111")).rejects.toBeInstanceOf(HttpException);
    expect(otpDoc.save).toHaveBeenCalled();
  });

  it("creates a pending user on first successful OTP", async () => {
    const bcrypt = await import("bcrypt");
    const otpDoc = {
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      codeHash: await bcrypt.hash("0000", 4),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const created = {
      _id: new Types.ObjectId(),
      mobile: "9876543210",
      status: "pending_onboarding",
    };
    const users = mockModel({
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    });
    const businesses = mockModel({ findOne: jest.fn().mockResolvedValue(null) });
    const otps = mockModel({
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockResolvedValue(otpDoc),
      }),
    });
    const service = new AuthService(users as never, businesses as never, otps as never, jwt, config);
    const session = await service.verifyOtp("9876543210", "0000");
    expect(session.needsOnboarding).toBe(true);
    expect(session.user.mobile).toBe("9876543210");
    expect(users.create).toHaveBeenCalled();
  });
});
