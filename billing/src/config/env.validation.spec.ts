import { loadEnv } from "./env.validation";

const base = {
  JWT_SECRET: "x".repeat(32),
  MONGODB_URI: "mongodb://127.0.0.1:27017/billing",
};

describe("loadEnv", () => {
  it("loads defaults", () => {
    const env = loadEnv(base);
    expect(env.port).toBe(3000);
    expect(env.otpStaticCode).toBe("0000");
    expect(env.cookieName).toBe("billing_sid");
    expect(env.corsOrigins).toContain("http://127.0.0.1:8080");
  });

  it("rejects a short JWT secret", () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: "short" })).toThrow(/32 characters/);
  });

  it("rejects a non-4-digit OTP", () => {
    expect(() => loadEnv({ ...base, OTP_STATIC_CODE: "12" })).toThrow(/4-digit/);
  });
});
