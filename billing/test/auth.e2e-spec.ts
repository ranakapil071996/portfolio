import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { HttpErrorFilter } from "../src/common/http-exception.filter";

describe("Auth flow (e2e)", () => {
  let app: NestExpressApplication;
  let mongo: MongoMemoryServer;
  const mobile = "9876543210";

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_SECRET = "test-secret-must-be-32-chars-min";
    process.env.OTP_STATIC_CODE = "0000";
    process.env.COOKIE_NAME = "billing_sid";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpErrorFilter());
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  it("registers a new user with OTP 0000 and onboarding", async () => {
    const server = app.getHttpServer();

    await request(server)
      .post("/api/auth/otp/request")
      .send({ mobile })
      .expect(200);

    const bad = await request(server)
      .post("/api/auth/otp/verify")
      .send({ mobile, code: "1234" })
      .expect(401);
    expect(bad.body.error.message).toMatch(/Incorrect OTP/i);

    const verify = await request(server)
      .post("/api/auth/otp/verify")
      .send({ mobile, code: "0000" })
      .expect(200);
    expect(verify.body.needsOnboarding).toBe(true);
    const cookie = verify.headers["set-cookie"]?.[0];
    expect(cookie).toMatch(/billing_sid=/);

    await request(server).get("/api/auth/me").expect(401);

    const onboard = await request(server)
      .post("/api/auth/onboarding")
      .set("Cookie", cookie)
      .send({ businessName: "Rana Traders", gstin: "22AAAAA0000A1Z5" })
      .expect(200);
    expect(onboard.body.needsOnboarding).toBe(false);
    expect(onboard.body.business.name).toBe("Rana Traders");
    expect(onboard.body.business.gstin).toBe("22AAAAA0000A1Z5");

    const me = await request(server).get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body.user.mobile).toBe(mobile);
    expect(me.body.business.name).toBe("Rana Traders");
  });

  it("logs an existing user back in without onboarding", async () => {
    const server = app.getHttpServer();
    await request(server).post("/api/auth/otp/request").send({ mobile }).expect(200);
    const verify = await request(server)
      .post("/api/auth/otp/verify")
      .send({ mobile, code: "0000" })
      .expect(200);
    expect(verify.body.needsOnboarding).toBe(false);
    expect(verify.body.business.name).toBe("Rana Traders");
  });

  it("requires business name and accepts missing GSTIN", async () => {
    const server = app.getHttpServer();
    const other = "9123456789";
    await request(server).post("/api/auth/otp/request").send({ mobile: other }).expect(200);
    const verify = await request(server)
      .post("/api/auth/otp/verify")
      .send({ mobile: other, code: "0000" })
      .expect(200);
    const cookie = verify.headers["set-cookie"]?.[0];

    await request(server)
      .post("/api/auth/onboarding")
      .set("Cookie", cookie)
      .send({ businessName: "" })
      .expect(400);

    const ok = await request(server)
      .post("/api/auth/onboarding")
      .set("Cookie", cookie)
      .send({ businessName: "No GST Shop" })
      .expect(200);
    expect(ok.body.business.gstin).toBeNull();
  });
});
