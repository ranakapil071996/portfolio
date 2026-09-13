import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { HttpErrorFilter } from "../src/common/http-exception.filter";

describe("Customers (e2e)", () => {
  let app: NestExpressApplication;
  let mongo: MongoMemoryServer;
  const mobile = "9876501234";
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
      .send({ businessName: "Rana Traders" })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  it("creates, lists, and reloads a customer for invoices", async () => {
    const server = app.getHttpServer();

    const created = await request(server)
      .post("/api/customers")
      .set("Cookie", cookie)
      .send({
        name: "Sharma Stores",
        mobile: "9123456789",
        email: "shop@example.com",
        gstin: "27AAAAA0000A1Z5",
        address: "12 MG Road",
        city: "Mumbai",
        pincode: "400001",
      })
      .expect(201);

    expect(created.body.name).toBe("Sharma Stores");
    expect(created.body.gstin).toBe("27AAAAA0000A1Z5");
    expect(created.body.stateCode).toBe("27");
    expect(created.body.state).toBe("Maharashtra");
    expect(created.body.gstRegistered).toBe(true);

    const list = await request(server)
      .get("/api/customers?page=1&limit=10")
      .set("Cookie", cookie)
      .expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].name).toBe("Sharma Stores");
    expect(list.body.items[0].gstin).toBe("27AAAAA0000A1Z5");

    const one = await request(server)
      .get(`/api/customers/${created.body.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(one.body.id).toBe(created.body.id);
    expect(one.body.address).toBe("12 MG Road");
    expect(one.body.city).toBe("Mumbai");
    expect(one.body.pincode).toBe("400001");
  });

  it("rejects a duplicate GSTIN and an empty name", async () => {
    const server = app.getHttpServer();

    await request(server)
      .post("/api/customers")
      .set("Cookie", cookie)
      .send({ name: "Same GSTIN", gstin: "27AAAAA0000A1Z5" })
      .expect(409);

    await request(server)
      .post("/api/customers")
      .set("Cookie", cookie)
      .send({ name: "" })
      .expect(400);
  });
});
