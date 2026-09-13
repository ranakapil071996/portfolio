import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { HttpErrorFilter } from "../src/common/http-exception.filter";

describe("Invoices (e2e)", () => {
  let app: NestExpressApplication;
  let mongo: MongoMemoryServer;
  const mobile = "9876502222";
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
      .send({ businessName: "Hawkey", gstin: "07AAAAA0000A1Z5" })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  it("creates, lists, and reloads a GST invoice", async () => {
    const server = app.getHttpServer();

    const customer = await request(server)
      .post("/api/customers")
      .set("Cookie", cookie)
      .send({
        name: "Sharma Stores",
        gstin: "27AAAAA0000A1Z5",
        city: "Mumbai",
        stateCode: "27",
      })
      .expect(201);

    const item = await request(server)
      .post("/api/items")
      .set("Cookie", cookie)
      .send({
        name: "Notebook",
        type: "goods",
        unit: "pcs",
        salePrice: 100,
        gstRate: 18,
        taxInclusive: false,
        stockQty: 20,
      })
      .expect(201);

    const created = await request(server)
      .post("/api/invoices")
      .set("Cookie", cookie)
      .send({
        customerId: customer.body.id,
        invoiceDate: "2026-09-12",
        notes: "Sample bill",
        lines: [{ itemId: item.body.id, qty: 2 }],
      })
      .expect(201);

    expect(created.body.invoiceNumber).toBe("INV-0001");
    expect(created.body.taxSplit).toBe("igst");
    expect(created.body.grandTotal).toBe(236);
    expect(created.body.customer.name).toBe("Sharma Stores");
    expect(created.body.lines[0].name).toBe("Notebook");
    expect(created.body.placeOfSupply).toBe("Maharashtra");

    const list = await request(server).get("/api/invoices").set("Cookie", cookie).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].invoiceNumber).toBe("INV-0001");

    const one = await request(server)
      .get(`/api/invoices/${created.body.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(one.body.notes).toBe("Sample bill");
    expect(one.body.igstTotal).toBe(36);

    const stock = await request(server).get("/api/items?q=Notebook").set("Cookie", cookie).expect(200);
    expect(stock.body.items[0].stockQty).toBe(18);

    const mixed = await request(server)
      .post("/api/invoices")
      .set("Cookie", cookie)
      .send({
        customerId: customer.body.id,
        lines: [
          { name: "Loose sugar", kind: "goods", qty: 2, rate: 50, gstRate: 5 },
          { name: "Delivery", kind: "charge", qty: 1, rate: 40, gstRate: 18 },
        ],
      })
      .expect(201);
    expect(mixed.body.invoiceNumber).toBe("INV-0002");
    expect(mixed.body.lines[0].source).toBe("custom");
    expect(mixed.body.lines[1].source).toBe("charge");
    expect(mixed.body.grandTotal).toBe(152.2);

    const pdf = await request(server)
      .get(`/api/invoices/${created.body.id}/pdf`)
      .set("Cookie", cookie)
      .expect(200);
    expect(pdf.headers["content-type"]).toMatch(/pdf/);
    expect(Buffer.isBuffer(pdf.body) ? pdf.body.length : pdf.text.length).toBeGreaterThan(100);

    const edited = await request(server)
      .patch(`/api/invoices/${created.body.id}`)
      .set("Cookie", cookie)
      .send({
        customerId: customer.body.id,
        invoiceDate: "2026-09-13",
        notes: "Corrected qty",
        lines: [{ itemId: item.body.id, qty: 3 }],
      })
      .expect(200);
    expect(edited.body.invoiceNumber).toBe("INV-0001");
    expect(edited.body.grandTotal).toBe(354);
    expect(edited.body.notes).toBe("Corrected qty");

    const afterEdit = await request(server).get("/api/items?q=Notebook").set("Cookie", cookie).expect(200);
    expect(afterEdit.body.items[0].stockQty).toBe(17);

    await request(server)
      .delete(`/api/invoices/${created.body.id}`)
      .set("Cookie", cookie)
      .expect(200);
    await request(server)
      .get(`/api/invoices/${created.body.id}`)
      .set("Cookie", cookie)
      .expect(404);
    const afterDelete = await request(server).get("/api/items?q=Notebook").set("Cookie", cookie).expect(200);
    expect(afterDelete.body.items[0].stockQty).toBe(20);
  });

  it("rejects an invoice with no lines", async () => {
    const server = app.getHttpServer();
    const customer = await request(server)
      .get("/api/customers?q=Sharma")
      .set("Cookie", cookie)
      .expect(200);
    await request(server)
      .post("/api/invoices")
      .set("Cookie", cookie)
      .send({ customerId: customer.body.items[0].id, lines: [] })
      .expect(400);
  });
});
