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

## API

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/auth/otp/request` | `{ mobile }` |
| `POST` | `/api/auth/otp/verify` | `{ mobile, code }` — sets httpOnly cookie |
| `POST` | `/api/auth/onboarding` | `{ businessName, gstin? }` + cookie |
| `GET` | `/api/auth/me` | cookie |
| `POST` | `/api/auth/logout` | clears cookie |
| `GET` | `/api/items?page=&limit=` | cookie |
| `POST` | `/api/items` | cookie |
| `GET` | `/api/hsn?q=&type=` | cookie — find HSN/SAC + GST rate |
| `POST` | `/api/hsn` | cookie — add a missing HSN/SAC |
| `GET` | `/api/health` | public |

## Tests

```bash
npm test
npm run test:e2e
```
