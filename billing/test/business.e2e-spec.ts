import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { HttpErrorFilter } from "../src/common/http-exception.filter";

describe("Business profile (e2e)", () => {
  let app: NestExpressApplication;
  let mongo: MongoMemoryServer;
  const mobile = "9876503333";
  let cookie = "";

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

    const server = app.getHttpServer();
    await request(server).post("/api/auth/otp/request").send({ mobile }).expect(200);
    const verify = await request(server)
      .post("/api/auth/otp/verify")
      .send({ mobile, code: "0000" })
      .expect(200);
    cookie = verify.headers["set-cookie"]?.[0];
    await request(server)
      .post("/api/auth/onboarding")
      .set("Cookie", cookie)
      .send({ businessName: "Hawkey" })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  it("updates the profile and reports completion", async () => {
    const server = app.getHttpServer();
    const me = await request(server).get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body.business.profile.complete).toBe(false);
    expect(me.body.business.profile.percent).toBe(20);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await request(server)
      .post("/api/business/logo")
      .set("Cookie", cookie)
      .attach("file", png, { filename: "logo.png", contentType: "image/png" })
      .expect(200);
    await request(server)
      .post("/api/business/signature")
      .set("Cookie", cookie)
      .attach("file", png, { filename: "sign.png", contentType: "image/png" })
      .expect(200);

    const saved = await request(server)
      .patch("/api/business")
      .set("Cookie", cookie)
      .send({
        name: "Hawkey Traders",
        email: "shop@hawkey.in",
        address: "12 MG Road",
        city: "New Delhi",
        stateCode: "07",
        pincode: "110001",
      })
      .expect(200);
    expect(saved.body.profile.complete).toBe(true);
    expect(saved.body.profile.percent).toBe(100);
    expect(saved.body.state).toBe("Delhi");
    expect(saved.body.hasLogo).toBe(true);

    const qr = await request(server)
      .post("/api/business/qr")
      .set("Cookie", cookie)
      .attach("file", png, { filename: "qr.png", contentType: "image/png" })
      .expect(200);
    expect(qr.body.hasQr).toBe(true);
    expect(qr.body.profile.complete).toBe(true);

    const file = await request(server).get("/api/business/logo").set("Cookie", cookie).expect(200);
    expect(file.headers["content-type"]).toMatch(/image/);
  });
});
