# Billing

NestJS + MongoDB billing service. This first slice is **mobile OTP login / signup** and **business onboarding**.

OTP is hardcoded to `0000` until an SMS provider is wired.

## Run locally

Two processes: **static frontend** (Vercel / `python3 -m http.server`) and **Nest API**.

```bash
# API
cd billing
docker compose up -d
npm install
npm run start:dev          # http://127.0.0.1:3000/api

# Frontend (repo root)
python3 -m http.server 8080
```

- Site: http://127.0.0.1:8080/
- Billing UI: http://127.0.0.1:8080/tools/billing/
- API: http://127.0.0.1:3000/api

On Vercel, set `BILLING_API_PRODUCTION` in `js/billing-config.js` to the public API URL, and add that Vercel origin to `CORS_ORIGIN` on the API.

1. Enter a 10-digit Indian mobile number
2. OTP: `0000`
3. New users set **business name** (required) and **GSTIN** (optional)
4. Existing users land in the workspace

Invoice print: open a saved invoice and pick a **template** (Classic GST, Modern, Compact, Receipt) plus a **printer** (A4, A5, 80 mm, 58 mm). Preview uses the business logo, signature, payment QR, and bank/UPI from Profile. **Print** sends the on-screen sheet to the printer; **PDF** downloads that layout. **Save as default** stores the pair on the business profile.

## API

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/otp/request` | `{ mobile }` |
| `POST` | `/api/auth/otp/verify` | `{ mobile, code }` — sets httpOnly cookie |
| `POST` | `/api/auth/onboarding` | `{ businessName, gstin? }` + cookie |
| `GET` | `/api/auth/me` | cookie |
| `POST` | `/api/auth/logout` | clears cookie |
| `GET` | `/api/items?page=&limit=&q=&sort=&dir=` | cookie — `sort=name\|sku\|type\|hsn\|price\|gst\|stock` |
| `POST` | `/api/items` | cookie |
| `GET` | `/api/customers?page=&limit=&q=&sort=&dir=` | cookie — `sort=name\|mobile\|gstin\|place` |
| `POST` | `/api/customers` | cookie |
| `GET` | `/api/customers/:id` | cookie — full record for invoicing |
| `GET` | `/api/invoices?page=&limit=&q=&sort=&dir=&from=&to=&pay=` | cookie — `sort=number\|date\|customer\|place\|total\|status`, `pay=unpaid\|partial\|paid` |
| `POST` | `/api/invoices` | cookie — `{ customerId, invoiceDate?, notes?, payMode?, paid?, lines: [{ itemId, qty, rate? }] }` |
| `GET` | `/api/invoices/:id` | cookie |
| `PATCH` | `/api/invoices/:id` | cookie — same body as create |
| `PATCH` | `/api/invoices/:id/paid` | cookie — `{ payMode? }` marks the bill paid |
| `DELETE` | `/api/invoices/:id` | cookie |
| `GET` | `/api/invoices/templates` | cookie — layouts + printer sizes + saved default |
| `GET` | `/api/invoices/:id/pdf` | cookie — `?template=classic\|modern\|minimal\|thermal&printer=a4\|a5\|thermal80\|thermal58` |
| `GET` | `/api/hsn?q=&type=` | cookie — find HSN/SAC + GST rate |
| `POST` | `/api/hsn` | cookie — add a missing HSN/SAC |
| `GET` | `/api/business` | cookie — full profile + completion |
| `PATCH` | `/api/business` | cookie — name, address, GSTIN, PAN, bank |
| `POST` | `/api/business/logo` | cookie — multipart `file` |
| `POST` | `/api/business/signature` | cookie — multipart `file` |
| `POST` | `/api/business/qr` | cookie — multipart `file` (optional) |
| `GET` | `/api/business/logo` | cookie |
| `GET` | `/api/business/signature` | cookie |
| `GET` | `/api/business/qr` | cookie |
| `GET` | `/api/health` | public |

## Tests

```bash
npm test
npm run test:e2e
```
