/**
 * Billing API origin (NestJS). The static site (Vercel / local :8080) is separate.
 *
 * Local: Nest listens on http://127.0.0.1:3000
 * Production: set BILLING_API_PRODUCTION to your API URL, e.g. "https://api.example.com"
 */
(function (global) {
  "use strict";
  var BILLING_API_PRODUCTION = "";
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  global.__BILLING_API =
    global.__BILLING_API ||
    (local ? "http://127.0.0.1:3000" : BILLING_API_PRODUCTION);
})(window);
