function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function integer(name: string, value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return n;
}

export type AppEnv = {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieName: string;
  otpStaticCode: string;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  otpRequestWindowSeconds: number;
  otpRequestMax: number;
  corsOrigins: string[];
  isProd: boolean;
};

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = raw.NODE_ENV || "development";
  const jwtSecret = required("JWT_SECRET", raw.JWT_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  const otpStaticCode = raw.OTP_STATIC_CODE || "0000";
  if (!/^\d{4}$/.test(otpStaticCode)) {
    throw new Error("OTP_STATIC_CODE must be a 4-digit code");
  }
  return {
    nodeEnv,
    isProd: nodeEnv === "production",
    port: integer("PORT", raw.PORT, 3000),
    mongodbUri: required("MONGODB_URI", raw.MONGODB_URI),
    jwtSecret,
    jwtExpiresIn: raw.JWT_EXPIRES_IN || "7d",
    cookieName: raw.COOKIE_NAME || "billing_sid",
    otpStaticCode,
    otpTtlSeconds: integer("OTP_TTL_SECONDS", raw.OTP_TTL_SECONDS, 300),
    otpMaxAttempts: integer("OTP_MAX_ATTEMPTS", raw.OTP_MAX_ATTEMPTS, 5),
    otpRequestWindowSeconds: integer(
      "OTP_REQUEST_WINDOW_SECONDS",
      raw.OTP_REQUEST_WINDOW_SECONDS,
      600,
    ),
    otpRequestMax: integer("OTP_REQUEST_MAX", raw.OTP_REQUEST_MAX, 3),
    corsOrigins: (raw.CORS_ORIGIN || "http://127.0.0.1:8080,http://localhost:8080")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
