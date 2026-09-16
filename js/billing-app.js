/**
 * Billing tool — mobile OTP login + business onboarding.
 * Lives at /tools/billing/ and talks to same-origin /api.
 */
(function () {
  "use strict";

  var mount = document.getElementById("billing-app");
  if (!mount) return;

  var toastEl = document.getElementById("toast");
  var state = { mobile: "", session: null, boot: true };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function t(key, fallback) {
    if (window.I18n && window.I18n.getDict()) {
      var v = window.I18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback == null ? key : fallback;
  }

  function toast(msg, kind) {
    if (!toastEl) return;
    toastEl.hidden = false;
    toastEl.textContent = msg;
    toastEl.classList.remove("is-ok", "is-err");
    toastEl.classList.add("show", kind === "err" ? "is-err" : "is-ok");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.classList.remove("show", "is-ok", "is-err");
      toastEl.hidden = true;
    }, kind === "err" ? 3600 : 2600);
  }

  function apiBase() {
    return String(window.__BILLING_API || "").replace(/\/+$/, "");
  }

  function api(path, opts) {
    var base = apiBase();
    if (!base) {
      return Promise.reject(
        new Error(
          t("tools.billing.apiMissing", "Billing API URL is not configured. Set it in js/billing-config.js"),
        ),
      );
    }
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, (opts && opts.timeout) || 8000);
    return fetch(base + "/api" + path, {
      method: (opts && opts.method) || "GET",
      credentials: "include",
      signal: ctrl ? ctrl.signal : undefined,
      headers: {
        Accept: "application/json",
        ...(opts && opts.body && !(opts.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        opts && opts.body
          ? opts.body instanceof FormData
            ? opts.body
            : JSON.stringify(opts.body)
          : undefined,
    })
      .then(function (res) {
        return res.json().catch(function () {
          return {};
        }).then(function (data) {
          if (!res.ok) {
            throw new Error((data.error && data.error.message) || t("tools.billing.error", "Request failed"));
          }
          return data;
        });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          throw new Error(t("tools.billing.apiTimeout", "Cannot reach the billing API. Is it running on port 3000?"));
        }
        if (err && err.message && err.message !== "Failed to fetch") throw err;
        throw new Error(t("tools.billing.apiDown", "Cannot reach the billing API. Start Nest on port 3000."));
      })
      .then(function (data) {
        clearTimeout(timer);
        return data;
      }, function (err) {
        clearTimeout(timer);
        throw err;
      });
  }

  function view() {
    var hash = (location.hash || "").replace(/^#\/?/, "");
    var parts = hash.split("/");
    if (parts[0] === "onboarding") return { page: "onboarding", tab: "home" };
    if (parts[0] === "app") {
      return { page: "app", tab: parts[1] || "home", screen: parts[2] || "", extra: parts[3] || "" };
    }
    if (parts[0] === "otp") return { page: "otp", tab: "home" };
    return { page: "login", tab: "home" };
  }

  function go(name) {
    var next = name.indexOf("#") === 0 ? name : "#" + name;
    if (location.hash !== next) location.hash = next;
  }

  function setChrome(page) {
    if (state.boot && page !== "app") return;
    var dash = page === "app";
    document.body.classList.toggle("billing-dash", dash);
    var drawer = document.getElementById("bill-drawer");
    if (drawer) drawer.hidden = !dash;
    var layout = document.querySelector(".billing-layout");
    if (layout) layout.hidden = dash;
    var stage = document.getElementById("bill-stage");
    if (stage) stage.hidden = !dash;
    var nameEl = document.getElementById("bill-biz-name");
    if (nameEl) {
      var biz = state.session && state.session.business;
      nameEl.textContent = dash && biz ? biz.name : "";
    }
    renderProfileChip();
  }

  function setBusy(form, busy) {
    if (!form) return;
    form.querySelectorAll("button").forEach(function (el) {
      el.disabled = busy;
    });
  }

  function errBox() {
    return document.getElementById("billing-error");
  }

  function handlePhoneSubmit() {
    var form = document.getElementById("bill-phone-form");
    var input = document.getElementById("billing-mobile");
    var err = errBox();
    if (!form || !input) return;
    if (err) err.textContent = "";
    var mobile = input.value.trim();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      if (err) err.textContent = t("tools.billing.mobileInvalid", "Enter a valid 10-digit Indian mobile number");
      input.focus();
      return;
    }
    setBusy(form, true);
    api("/auth/otp/request", { method: "POST", body: { mobile: mobile } })
      .then(function () {
        state.mobile = mobile;
        try {
          sessionStorage.setItem("billing_mobile", mobile);
        } catch (_) {}
        toast(t("tools.billing.otpHint", "OTP sent. Use 0000"));
        go("otp");
      })
      .catch(function (ex) {
        if (err) err.textContent = ex.message;
      })
      .then(function () {
        setBusy(form, false);
      });
  }

  function handleOtpSubmit() {
    var form = document.getElementById("bill-otp-form");
    var err = errBox();
    var boxes = Array.prototype.slice.call(document.querySelectorAll(".billing-otp-box"));
    if (!form) return;
    if (err) err.textContent = "";
    var code = boxes.map(function (b) { return b.value; }).join("");
    if (!/^\d{4}$/.test(code)) {
      if (err) err.textContent = t("tools.billing.otpInvalid", "Enter the 4-digit OTP");
      return;
    }
    setBusy(form, true);
    api("/auth/otp/verify", { method: "POST", body: { mobile: state.mobile, code: code } })
      .then(function (session) {
        state.session = session;
        go(session.needsOnboarding ? "onboarding" : "app");
      })
      .catch(function (ex) {
        if (err) err.textContent = ex.message;
      })
      .then(function () {
        setBusy(form, false);
      });
  }

  function handleOnboardSubmit() {
    var form = document.getElementById("bill-onboard-form");
    var err = errBox();
    if (!form) return;
    if (err) err.textContent = "";
    var nameEl = document.getElementById("billing-name");
    var gstEl = document.getElementById("billing-gstin");
    var businessName = nameEl ? nameEl.value.trim() : "";
    var gstin = gstEl ? gstEl.value.trim() : "";
    if (businessName.length < 2) {
      if (err) err.textContent = t("tools.billing.businessRequired", "Business name is required");
      return;
    }
    setBusy(form, true);
    api("/auth/onboarding", {
      method: "POST",
      body: { businessName: businessName, gstin: gstin || undefined },
    })
      .then(function (session) {
        state.session = session;
        toast(t("tools.billing.saved", "Business saved"));
        go("app");
      })
      .catch(function (ex) {
        if (err) err.textContent = ex.message;
      })
      .then(function () {
        setBusy(form, false);
      });
  }

  function moneyInr(n) {
    var v = Number(n);
    if (!isFinite(v)) return "—";
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(v);
    } catch (_) {
      return "₹" + v.toFixed(2);
    }
  }

  function fieldVal(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function handleItemSubmit() {
    var form = document.getElementById("bill-item-form");
    var err = errBox();
    if (!form) return;
    if (err) err.textContent = "";
    var name = fieldVal("item-name");
    if (name.length < 2) {
      if (err) err.textContent = t("tools.billing.itemNameRequired", "Item name is required");
      return;
    }
    var payload = {
      name: name,
      sku: fieldVal("item-sku") || undefined,
      description: fieldVal("item-desc") || undefined,
      type: fieldVal("item-type") || "goods",
      hsnSac: fieldVal("item-hsn") || undefined,
      unit: fieldVal("item-unit") || "pcs",
      salePrice: Number(fieldVal("item-sale") || 0),
      purchasePrice: fieldVal("item-cost") === "" ? undefined : Number(fieldVal("item-cost")),
      gstRate: Number(fieldVal("item-gst") || 18),
      taxInclusive: fieldVal("item-taxmode") === "inc",
      cessRate: fieldVal("item-cess") === "" ? 0 : Number(fieldVal("item-cess")),
      stockQty: fieldVal("item-stock") === "" ? 0 : Number(fieldVal("item-stock")),
      lowStockAt: fieldVal("item-low") === "" ? undefined : Number(fieldVal("item-low")),
    };
    setBusy(form, true);
    api("/items", { method: "POST", body: payload })
      .then(function () {
        toast(t("tools.billing.itemSaved", "Item saved"));
        go("app/items");
      })
      .catch(function (ex) {
        if (err) err.textContent = ex.message;
      })
      .then(function () {
        setBusy(form, false);
      });
  }

  function handleCustomerSubmit() {
    var form = document.getElementById("bill-customer-form");
    var err = errBox();
    if (!form) return;
    if (err) err.textContent = "";
    var name = fieldVal("customer-name");
    if (name.length < 2) {
      if (err) err.textContent = t("tools.billing.customerNameRequired", "Customer name is required");
      return;
    }
    var mobile = fieldVal("customer-mobile").replace(/\D/g, "");
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      if (err) err.textContent = t("tools.billing.mobileInvalid", "Enter a valid 10-digit Indian mobile number");
      return;
    }
    var email = fieldVal("customer-email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (err) err.textContent = t("tools.billing.customerEmailInvalid", "Enter a valid email, or leave it blank");
      return;
    }
    var gstin = fieldVal("customer-gstin").toUpperCase();
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      if (err) err.textContent = t("tools.billing.customerGstinInvalid", "Enter a valid 15-character GSTIN, or leave it blank");
      return;
    }
    var pincode = fieldVal("customer-pincode");
    if (pincode && !/^\d{6}$/.test(pincode)) {
      if (err) err.textContent = t("tools.billing.customerPincodeInvalid", "Enter a 6-digit PIN code, or leave it blank");
      return;
    }
    var payload = {
      name: name,
      mobile: mobile || undefined,
      email: email || undefined,
      gstin: gstin || undefined,
      address: fieldVal("customer-address") || undefined,
      city: fieldVal("customer-city") || undefined,
      stateCode: fieldVal("customer-state") || undefined,
      pincode: pincode || undefined,
      notes: fieldVal("customer-notes") || undefined,
    };
    setBusy(form, true);
    api("/customers", { method: "POST", body: payload })
      .then(function () {
        toast(t("tools.billing.customerSaved", "Customer saved"));
        go("app/customers");
      })
      .catch(function (ex) {
        if (err) err.textContent = ex.message;
      })
      .then(function () {
        setBusy(form, false);
      });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var modal = document.getElementById("bill-hsn-modal");
    if (!modal || modal.hidden) return;
    e.preventDefault();
    modal.hidden = true;
    var findBtn = document.getElementById("item-hsn-find");
    if (findBtn) findBtn.focus();
  });

  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!form || !form.id) return;
      if (
        form.id !== "bill-phone-form" &&
        form.id !== "bill-otp-form" &&
        form.id !== "bill-onboard-form" &&
        form.id !== "bill-item-form" &&
        form.id !== "bill-customer-form" &&
        form.id !== "bill-invoice-form" &&
        form.id !== "bill-profile-form" &&
        form.id !== "bill-print-form"
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (form.id === "bill-phone-form") handlePhoneSubmit();
      else if (form.id === "bill-otp-form") handleOtpSubmit();
      else if (form.id === "bill-item-form") handleItemSubmit();
      else if (form.id === "bill-customer-form") handleCustomerSubmit();
      else if (form.id === "bill-invoice-form") handleInvoiceSubmit();
      else if (form.id === "bill-profile-form") handleProfileSubmit();
      else if (form.id === "bill-print-form") handlePrintSettingsSubmit();
      else handleOnboardSubmit();
    },
    true,
  );

  function phoneView() {
    mount.innerHTML =
      '<section class="billing-card glass">' +
      '<p class="tool-kicker">' +
      esc(t("tools.billing.kicker", "Mobile login")) +
      "</p>" +
      "<h2>" +
      esc(t("tools.billing.signInTitle", "Sign in or create an account")) +
      "</h2>" +
      '<p class="tool-lead">' +
      esc(t("tools.billing.signInLead", "Use your business mobile number. New and existing users follow the same steps.")) +
      "</p>" +
      '<form id="bill-phone-form" method="post" action="#" onsubmit="return false;">' +
      '<div class="tool-field"><label for="billing-mobile">' +
      esc(t("tools.billing.mobile", "Mobile number")) +
      ' <span class="billing-req">*</span></label>' +
      '<div class="billing-input"><span>+91</span>' +
      '<input id="billing-mobile" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" placeholder="9876543210" required /></div>' +
      '<span class="tool-note">' +
      esc(t("tools.billing.mobileHint", "10-digit Indian mobile number")) +
      "</span></div>" +
      '<p class="billing-err" id="billing-error" role="alert"></p>' +
      '<button class="btn btn-primary" type="submit">' +
      esc(t("tools.billing.sendOtp", "Send OTP")) +
      "</button></form></section>";

    var input = document.getElementById("billing-mobile");
    if (input && state.mobile) input.value = state.mobile;
  }

  function otpView() {
    mount.innerHTML =
      '<section class="billing-card glass">' +
      '<p class="tool-kicker">' +
      esc(t("tools.billing.verifyKicker", "Verify")) +
      "</p>" +
      "<h2>" +
      esc(t("tools.billing.otpTitle", "Enter the 4-digit OTP")) +
      "</h2>" +
      '<p class="tool-lead">' +
      esc(t("tools.billing.otpLead", "Sent to")) +
      " +91 " +
      esc(state.mobile) +
      ". " +
      esc(t("tools.billing.otpStatic", "For now the code is 0000.")) +
      "</p>" +
      '<form id="bill-otp-form" method="post" action="#" onsubmit="return false;">' +
      '<div class="billing-otp" id="billing-otp">' +
      '<input class="billing-otp-box" inputmode="numeric" maxlength="1" aria-label="Digit 1" />' +
      '<input class="billing-otp-box" inputmode="numeric" maxlength="1" aria-label="Digit 2" />' +
      '<input class="billing-otp-box" inputmode="numeric" maxlength="1" aria-label="Digit 3" />' +
      '<input class="billing-otp-box" inputmode="numeric" maxlength="1" aria-label="Digit 4" />' +
      "</div>" +
      '<p class="billing-err" id="billing-error" role="alert"></p>' +
      '<div class="billing-actions">' +
      '<button class="btn btn-primary" type="submit">' +
      esc(t("tools.billing.verify", "Verify & continue")) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" id="billing-resend">' +
      esc(t("tools.billing.resend", "Resend OTP")) +
      "</button>" +
      '<button class="btn btn-ghost" type="button" id="billing-change">' +
      esc(t("tools.billing.changeMobile", "Use a different number")) +
      "</button></div></form></section>";

    var boxes = Array.prototype.slice.call(document.querySelectorAll(".billing-otp-box"));
    var err = errBox();
    if (boxes[0]) boxes[0].focus();
    boxes.forEach(function (box, i) {
      box.addEventListener("input", function () {
        box.value = box.value.replace(/\D/g, "").slice(0, 1);
        if (box.value && boxes[i + 1]) boxes[i + 1].focus();
      });
      box.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !box.value && boxes[i - 1]) boxes[i - 1].focus();
      });
      box.addEventListener("paste", function (e) {
        var text = ((e.clipboardData || window.clipboardData).getData("text") || "").replace(/\D/g, "").slice(0, 4);
        if (!text) return;
        e.preventDefault();
        boxes.forEach(function (b, idx) {
          b.value = text[idx] || "";
        });
        boxes[Math.min(text.length, 3)].focus();
      });
    });

    var resend = document.getElementById("billing-resend");
    if (resend)
      resend.addEventListener("click", function () {
        if (err) err.textContent = "";
        api("/auth/otp/request", { method: "POST", body: { mobile: state.mobile } })
          .then(function () {
            toast(t("tools.billing.otpHint", "OTP sent. Use 0000"));
          })
          .catch(function (ex) {
            if (err) err.textContent = ex.message;
          });
      });
    var change = document.getElementById("billing-change");
    if (change)
      change.addEventListener("click", function () {
        go("login");
      });
  }

  function onboardingView() {
    var mobile = (state.session && state.session.user.mobile) || state.mobile;
    mount.innerHTML =
      '<section class="billing-card glass">' +
      '<p class="tool-kicker">' +
      esc(t("tools.billing.onboardKicker", "Onboarding")) +
      "</p>" +
      "<h2>" +
      esc(t("tools.billing.onboardTitle", "Tell us about your business")) +
      "</h2>" +
      '<p class="tool-lead">' +
      esc(t("tools.billing.onboardLead", "Business name and mobile are required. GSTIN can be added later.")) +
      "</p>" +
      '<form id="bill-onboard-form" method="post" action="#" onsubmit="return false;">' +
      '<div class="tool-field"><label for="billing-name">' +
      esc(t("tools.billing.businessName", "Business name")) +
      ' <span class="billing-req">*</span></label>' +
      '<input id="billing-name" name="businessName" type="text" maxlength="120" autocomplete="organization" required /></div>' +
      '<div class="tool-field"><label for="billing-onboard-mobile">' +
      esc(t("tools.billing.mobile", "Mobile number")) +
      ' <span class="billing-req">*</span></label>' +
      '<input id="billing-onboard-mobile" type="text" value="+91 ' +
      esc(mobile) +
      '" disabled /></div>' +
      '<div class="tool-field"><label for="billing-gstin">' +
      esc(t("tools.billing.gstin", "GSTIN")) +
      " <span class=\"tool-note\">(" +
      esc(t("tools.billing.optional", "optional")) +
      ")</span></label>" +
      '<input id="billing-gstin" name="gstin" type="text" maxlength="15" autocomplete="off" placeholder="22AAAAA0000A1Z5" /></div>' +
      '<p class="billing-err" id="billing-error" role="alert"></p>' +
      '<button class="btn btn-primary" type="submit">' +
      esc(t("tools.billing.finish", "Finish setup")) +
      '</button><button class="btn btn-ghost" type="button" id="billing-back-login">' +
      esc(t("tools.billing.changeMobile", "Use a different number")) +
      "</button></form></section>";

    var nameEl = document.getElementById("billing-name");
    if (nameEl) nameEl.focus();
    var back = document.getElementById("billing-back-login");
    if (back)
      back.addEventListener("click", function () {
        state.session = null;
        go("login");
      });
  }

  var ICO = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>',
    invoices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h10a1 1 0 0 1 1 1v16l-2.2-1.4L13.6 20 12 18.6 10.4 20 8.2 18.6 6 20V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 19v-1.2A2.8 2.8 0 0 0 13.2 15H8.8A2.8 2.8 0 0 0 6 17.8V19"/><circle cx="11" cy="8.5" r="2.6"/><path d="M18.5 19v-1.1a2.4 2.4 0 0 0-1.7-2.3"/><circle cx="17.2" cy="9.2" r="2"/></svg>',
    items: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8.5 12 4l8 4.5-8 4.5L4 8.5z"/><path d="M4 12.5 12 17l8-4.5"/><path d="M4 16.5 12 21l8-4.5"/></svg>',
    reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 19V9M10 19V5M15 19v-7M20 19V8"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7 1 1.1 1.7 1.2H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 7V5a1 1 0 0 1 1-1h8v16h-8a1 1 0 0 1-1-1v-2"/><path d="M4 12h10M8 8l-4 4 4 4"/></svg>',
  };

  var TABS = [
    { id: "home", key: "tools.billing.tabHome", label: "Home", icon: "home" },
    { id: "invoices", key: "tools.billing.tabInvoices", label: "Invoices", icon: "invoices" },
    { id: "customers", key: "tools.billing.tabCustomers", label: "Customers", icon: "customers" },
    { id: "items", key: "tools.billing.tabItems", label: "Items", icon: "items" },
    { id: "reports", key: "tools.billing.tabReports", label: "Reports", icon: "reports" },
    { id: "settings", key: "tools.billing.tabSettings", label: "Settings", icon: "settings" },
  ];

  var SETTINGS_TABS = [
    { id: "profile", key: "tools.billing.tabProfile", label: "Profile" },
    { id: "print", key: "tools.billing.profilePrint", label: "Invoice print" },
  ];

  function drawerOpen() {
    try {
      return localStorage.getItem("billing_drawer") !== "collapsed";
    } catch (_) {
      return true;
    }
  }

  function setDrawer(open) {
    try {
      localStorage.setItem("billing_drawer", open ? "open" : "collapsed");
    } catch (_) {}
    var drawer = document.getElementById("bill-drawer");
    if (!drawer) return;
    drawer.classList.toggle("is-collapsed", !open);
    drawer.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("drawer-collapsed", !open);
    var btn = document.getElementById("bill-drawer-toggle");
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        open ? t("tools.billing.collapseNav", "Collapse menu") : t("tools.billing.expandNav", "Expand menu"),
      );
    }
  }

  function homeProfileCard() {
    var info = profileInfo();
    if (info.complete) return "";
    var missing = (info.missing || []).filter(Boolean);
    var next = missing[0] || t("tools.billing.profileMissing", "missing details");
    var list = missing.length
      ? '<ul class="bill-home-missing">' +
        missing
          .map(function (item) {
            return "<li>" + esc(item) + "</li>";
          })
          .join("") +
        "</ul>"
      : "";
    return (
      '<a class="bill-home-card glass" href="#app/settings/profile">' +
      '<span class="bill-home-card-ico" aria-hidden="true">' +
      ICO.settings +
      "</span><span class=\"bill-home-card-copy\"><strong>" +
      esc(t("tools.billing.homeProfileTitle", "Finish your business profile")) +
      "</strong><em>" +
      esc(
        t(
          "tools.billing.homeProfileLead",
          "Add the details printed on every invoice — address, logo, and signature.",
        ),
      ) +
      "</em>" +
      list +
      '<span class="bill-home-card-cta">' +
      esc(t("tools.billing.profileAddNext", "Add {field}").replace("{field}", next.toLowerCase())) +
      "</span></span></a>"
    );
  }

  function tabPanel(tab, s) {
    var biz = s && s.business;
    if (tab === "home") {
      return (
        '<header class="bill-stage-head"><h2>' +
        esc(t("tools.billing.tabHome", "Home")) +
        "</h2><p>" +
        esc(t("tools.billing.signedIn", "Overview of this business. Use the sidebar to open invoices, customers, and more.")) +
        "</p></header>" +
        homeProfileCard() +
        '<div class="billing-meta">' +
        "<div><span>" +
        esc(t("tools.billing.mobile", "Mobile number")) +
        "</span><strong>+91 " +
        esc(s.user.mobile) +
        "</strong></div>" +
        "<div><span>" +
        esc(t("tools.billing.gstin", "GSTIN")) +
        "</span><strong>" +
        esc((biz && biz.gstin) || t("tools.billing.gstinEmpty", "Not added")) +
        "</strong></div></div>"
      );
    }
    if (tab === "settings") {
      return (
        '<header class="bill-stage-head"><h2>' +
        esc(t("tools.billing.tabSettings", "Settings")) +
        "</h2></header>" +
        '<div class="billing-meta">' +
        "<div><span>" +
        esc(t("tools.billing.businessName", "Business name")) +
        "</span><strong>" +
        esc((biz && biz.name) || "—") +
        "</strong></div>" +
        "<div><span>" +
        esc(t("tools.billing.gstin", "GSTIN")) +
        "</span><strong>" +
        esc((biz && biz.gstin) || t("tools.billing.gstinEmpty", "Not added")) +
        "</strong></div></div>"
      );
    }
    var titles = {
      invoices: t("tools.billing.tabInvoices", "Invoices"),
      customers: t("tools.billing.tabCustomers", "Customers"),
      reports: t("tools.billing.tabReports", "Reports"),
    };
    return (
      '<header class="bill-stage-head"><h2>' +
      esc(titles[tab] || tab) +
      "</h2><p>" +
      esc(t("tools.billing.tabSoon", "This section is ready for the next build.")) +
      "</p></header>"
    );
  }

  function profileInfo() {
    var biz = state.session && state.session.business;
    return (biz && biz.profile) || { percent: 0, complete: true, missing: [] };
  }

  function ringSvg(percent, size) {
    var p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    var r = 15.5;
    var c = 2 * Math.PI * r;
    var dash = (p / 100) * c;
    return (
      '<svg class="bill-ring" viewBox="0 0 36 36" width="' +
      size +
      '" height="' +
      size +
      '" aria-hidden="true"><circle class="bill-ring-bg" cx="18" cy="18" r="15.5" fill="none" stroke-width="3.2"></circle><circle class="bill-ring-fg" cx="18" cy="18" r="15.5" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="' +
      dash.toFixed(2) +
      " " +
      (c - dash).toFixed(2) +
      '" transform="rotate(-90 18 18)"></circle></svg>'
    );
  }

  function renderProfileChip() {
    var chip = document.getElementById("bill-profile-chip");
    if (!chip) return;
    chip.hidden = true;
    chip.innerHTML = "";
  }

  function syncSessionProfile(profile) {
    if (!state.session || !state.session.business || !profile) return;
    state.session.business.profile = {
      percent: profile.percent,
      complete: profile.complete,
      missing: profile.missing || [],
    };
    if (profile.name) state.session.business.name = profile.name;
    if (profile.gstin !== undefined) state.session.business.gstin = profile.gstin;
    renderProfileChip();
    var nameEl = document.getElementById("bill-biz-name");
    if (nameEl && state.session.business.name) nameEl.textContent = state.session.business.name;
    var list = document.getElementById("bill-tab-list");
    if (list) fillDrawer(view().tab);
  }

  function fillDrawer(tab) {
    var list = document.getElementById("bill-tab-list");
    if (!list) return;
    if (tab === "profile") tab = "settings";
    list.innerHTML = TABS.map(function (item) {
      var on = item.id === tab || (tab === "items" && item.id === "items");
      return (
        '<a class="bill-tab' +
        (on ? " is-on" : "") +
        '" href="#app' +
        (item.id === "home" ? "" : item.id === "settings" ? "/settings/profile" : "/" + item.id) +
        '" data-tab="' +
        item.id +
        '" title="' +
        esc(t(item.key, item.label)) +
        '">' +
        '<span class="bill-tab-ico" aria-hidden="true">' +
        ICO[item.icon] +
        '</span><span class="bill-drawer-label">' +
        esc(t(item.key, item.label)) +
        "</span></a>"
      );
    }).join("");
    var create = document.getElementById("bill-create-invoice");
    if (create) {
      create.setAttribute("title", t("tools.billing.addInvoice", "Create invoice"));
    }
  }

  function settingsSubNav(active) {
    return (
      '<nav class="bill-subtabs" aria-label="' +
      esc(t("tools.billing.tabSettings", "Settings")) +
      '">' +
      SETTINGS_TABS.map(function (item) {
        return (
          '<a class="bill-subtab' +
          (item.id === active ? " is-on" : "") +
          '" href="#app/settings/' +
          item.id +
          '">' +
          esc(t(item.key, item.label)) +
          "</a>"
        );
      }).join("") +
      "</nav>"
    );
  }

  function settingsHead(active, lead) {
    var info = profileInfo();
    return (
      '<header class="bill-stage-head bill-stage-head-row"><div><h2>' +
      esc(t("tools.billing.tabSettings", "Settings")) +
      "</h2><p>" +
      esc(lead) +
      "</p></div>" +
      (active === "profile"
        ? '<div id="profile-meter" class="bill-profile-meter"></div>'
        : '<div class="bill-profile-meter">' +
          ringSvg(info.percent, 72) +
          "<div><strong>" +
          esc(String(info.percent)) +
          "%</strong><span>" +
          esc(t("tools.billing.profileCompleteLabel", "complete")) +
          "</span></div></div>") +
      "</header>" +
      settingsSubNav(active)
    );
  }

  function bindDrawerOnce() {
    var toggle = document.getElementById("bill-drawer-toggle");
    if (toggle && !toggle._bound) {
      toggle._bound = true;
      toggle.addEventListener("click", function () {
        setDrawer(!drawerOpen());
      });
    }
    var logout = document.getElementById("billing-logout");
    if (logout && !logout._bound) {
      logout._bound = true;
      logout.addEventListener("click", function () {
        api("/auth/logout", { method: "POST" })
          .catch(function () {})
          .then(function () {
            state.session = null;
            go("login");
          });
      });
    }
  }

  function itemsHref(page) {
    var n = Number(page) || 1;
    return n <= 1 ? "#app/items" : "#app/items/" + n;
  }

  function itemsListView(page) {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    var asked = Math.max(1, Number(page) || 1);
    stage.innerHTML =
      '<header class="bill-stage-head bill-stage-head-row">' +
      "<div><h2>" +
      esc(t("tools.billing.tabItems", "Items")) +
      "</h2><p>" +
      esc(t("tools.billing.itemsLead", "Catalog used on invoices — name, HSN/SAC, unit, price, and GST.")) +
      "</p></div>" +
      '<a class="btn btn-primary" href="#app/items/new">' +
      esc(t("tools.billing.addItem", "Add item")) +
      "</a></header>" +
      '<p class="tool-note" id="items-status">' +
      esc(t("tools.billing.itemsLoading", "Loading items…")) +
      "</p>";
    api("/items?page=" + encodeURIComponent(String(asked)) + "&limit=10")
      .then(function (data) {
        var items = (data && data.items) || [];
        var total = Number(data && data.total) || 0;
        var current = Number(data && data.page) || asked;
        var pages = Number(data && data.pages) || 0;
        var limit = Number(data && data.limit) || 10;
        var status = document.getElementById("items-status");
        if (status) status.remove();
        if (current !== asked && pages > 0) {
          go(itemsHref(current).slice(1));
          return;
        }
        if (!total) {
          stage.insertAdjacentHTML(
            "beforeend",
            '<div class="bill-empty glass"><p>' +
              esc(t("tools.billing.itemsEmpty", "No items yet. Add your first product or service.")) +
              '</p><a class="btn btn-primary" href="#app/items/new">' +
              esc(t("tools.billing.addItem", "Add item")) +
              "</a></div>",
          );
          return;
        }
        var rows = items
          .map(function (it) {
            var low =
              it.type === "goods" && it.lowStockAt != null && it.stockQty <= it.lowStockAt
                ? ' <span class="bill-chip bill-chip-warn">' +
                  esc(t("tools.billing.lowStock", "Low stock")) +
                  "</span>"
                : "";
            return (
              "<tr><td><strong>" +
              esc(it.name) +
              "</strong>" +
              (it.sku ? '<span class="bill-sub">' + esc(it.sku) + "</span>" : "") +
              "</td><td>" +
              esc(it.type === "service" ? t("tools.billing.itemService", "Service") : t("tools.billing.itemGoods", "Goods")) +
              "</td><td>" +
              esc(it.hsnSac || "—") +
              "</td><td>" +
              esc(it.unit) +
              "</td><td>" +
              esc(moneyInr(it.salePrice)) +
              (it.taxInclusive ? ' <span class="bill-sub">incl.</span>' : "") +
              "</td><td>" +
              esc(String(it.gstRate)) +
              "%</td><td>" +
              (it.type === "service" ? "—" : esc(String(it.stockQty)) + low) +
              "</td></tr>"
            );
          })
          .join("");
        var from = (current - 1) * limit + 1;
        var to = Math.min(total, (current - 1) * limit + items.length);
        var prev = current > 1
          ? '<a class="btn btn-ghost" href="' + itemsHref(current - 1) + '">' +
            esc(t("tools.billing.itemsPrev", "Previous")) +
            "</a>"
          : '<span class="btn btn-ghost" aria-disabled="true">' +
            esc(t("tools.billing.itemsPrev", "Previous")) +
            "</span>";
        var next = current < pages
          ? '<a class="btn btn-ghost" href="' + itemsHref(current + 1) + '">' +
            esc(t("tools.billing.itemsNext", "Next")) +
            "</a>"
          : '<span class="btn btn-ghost" aria-disabled="true">' +
            esc(t("tools.billing.itemsNext", "Next")) +
            "</span>";
        stage.insertAdjacentHTML(
          "beforeend",
          '<div class="bill-table-wrap"><table class="bill-table"><thead><tr>' +
            "<th>" +
            esc(t("tools.billing.itemName", "Item")) +
            "</th><th>" +
            esc(t("tools.billing.itemType", "Type")) +
            "</th><th>" +
            esc(t("tools.billing.itemHsn", "HSN/SAC")) +
            "</th><th>" +
            esc(t("tools.billing.itemUnit", "Unit")) +
            "</th><th>" +
            esc(t("tools.billing.itemPrice", "Sale price")) +
            "</th><th>GST</th><th>" +
            esc(t("tools.billing.itemStock", "Stock")) +
            "</th></tr></thead><tbody>" +
            rows +
            "</tbody></table></div>" +
            '<nav class="bill-pager" aria-label="' +
            esc(t("tools.billing.itemsPages", "Item pages")) +
            '">' +
            prev +
            '<p class="bill-pager-meta">' +
            esc(
              t("tools.billing.itemsRange", "Showing {from}–{to} of {total}")
                .replace("{from}", String(from))
                .replace("{to}", String(to))
                .replace("{total}", String(total)),
            ) +
            "<span>" +
            esc(
              t("tools.billing.itemsPage", "Page {page} of {pages}")
                .replace("{page}", String(current))
                .replace("{pages}", String(pages)),
            ) +
            "</span></p>" +
            next +
            "</nav>",
        );
      })
      .catch(function (ex) {
        var status = document.getElementById("items-status");
        if (status) status.textContent = ex.message;
      });
  }

  function itemFormView() {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    var units = ["pcs", "nos", "kg", "g", "ltr", "mtr", "box", "hour", "day", "sqft"];
    var unitOpts = units
      .map(function (u) {
        return '<option value="' + u + '">' + u + "</option>";
      })
      .join("");
    stage.innerHTML =
      '<header class="bill-stage-head">' +
      "<h2>" +
      esc(t("tools.billing.addItemTitle", "Add item")) +
      "</h2><p>" +
      esc(t("tools.billing.addItemLead", "These fields are used when you put the item on an invoice.")) +
      "</p></header>" +
      '<form id="bill-item-form" class="bill-item-form glass" method="post" action="#" onsubmit="return false;">' +
      '<div class="bill-form-grid">' +
      '<div class="tool-field bill-span-2"><label for="item-name">' +
      esc(t("tools.billing.itemName", "Item name")) +
      ' <span class="billing-req">*</span></label>' +
      '<input id="item-name" type="text" maxlength="160" required autocomplete="off" /></div>' +
      '<div class="tool-field"><label for="item-sku">' +
      esc(t("tools.billing.itemSku", "SKU / code")) +
      "</label>" +
      '<input id="item-sku" type="text" maxlength="40" autocomplete="off" /></div>' +
      '<div class="tool-field"><label for="item-type">' +
      esc(t("tools.billing.itemType", "Type")) +
      ' <span class="billing-req">*</span></label>' +
      '<select id="item-type"><option value="goods">' +
      esc(t("tools.billing.itemGoods", "Goods")) +
      '</option><option value="service">' +
      esc(t("tools.billing.itemService", "Service")) +
      "</option></select></div>" +
      '<div class="tool-field bill-span-2"><label for="item-hsn">' +
      esc(t("tools.billing.itemHsn", "HSN / SAC")) +
      "</label>" +
      '<div class="bill-hsn-row">' +
      '<input id="item-hsn" type="text" maxlength="12" autocomplete="off" />' +
      '<button class="btn btn-ghost" type="button" id="item-hsn-find">' +
      esc(t("tools.billing.findHsn", "Find")) +
      "</button></div>" +
      '<div id="item-hsn-chips" class="bill-hsn-chips" hidden></div>' +
      '<span class="tool-note">' +
      esc(t("tools.billing.findHsnFieldHint", "Search the HSN/SAC directory for the code and GST rate.")) +
      "</span></div>" +
      '<div class="tool-field bill-span-2"><label for="item-desc">' +
      esc(t("tools.billing.itemDesc", "Description")) +
      "</label>" +
      '<textarea id="item-desc" rows="2" maxlength="400"></textarea></div>' +
      '<div class="tool-field"><label for="item-unit">' +
      esc(t("tools.billing.itemUnit", "Unit")) +
      ' <span class="billing-req">*</span></label>' +
      '<select id="item-unit">' +
      unitOpts +
      "</select></div>" +
      '<div class="tool-field"><label for="item-sale">' +
      esc(t("tools.billing.itemPrice", "Sale price (₹)")) +
      ' <span class="billing-req">*</span></label>' +
      '<input id="item-sale" type="number" inputmode="decimal" min="0" step="0.01" value="0" required /></div>' +
      '<div class="tool-field"><label for="item-cost">' +
      esc(t("tools.billing.itemCost", "Purchase price (₹)")) +
      "</label>" +
      '<input id="item-cost" type="number" inputmode="decimal" min="0" step="0.01" /></div>' +
      '<div class="tool-field"><label for="item-gst">GST %</label>' +
      '<select id="item-gst"><option>0</option><option>3</option><option>5</option><option>12</option><option value="18" selected>18</option><option>28</option><option>40</option></select></div>' +
      '<div class="tool-field"><label for="item-taxmode">' +
      esc(t("tools.billing.itemTaxMode", "Price type")) +
      "</label>" +
      '<select id="item-taxmode"><option value="exc">' +
      esc(t("tools.billing.itemTaxExc", "Exclusive (add GST)")) +
      '</option><option value="inc">' +
      esc(t("tools.billing.itemTaxInc", "Inclusive (GST in price)")) +
      "</option></select></div>" +
      '<div class="tool-field"><label for="item-cess">' +
      esc(t("tools.billing.itemCess", "Cess %")) +
      "</label>" +
      '<input id="item-cess" type="number" inputmode="decimal" min="0" max="100" step="0.01" value="0" /></div>' +
      '<div class="tool-field" id="item-stock-field"><label for="item-stock">' +
      esc(t("tools.billing.itemStock", "Opening stock")) +
      "</label>" +
      '<input id="item-stock" type="number" inputmode="decimal" min="0" step="0.001" value="0" /></div>' +
      '<div class="tool-field" id="item-low-field"><label for="item-low">' +
      esc(t("tools.billing.itemLow", "Low-stock alert")) +
      "</label>" +
      '<input id="item-low" type="number" inputmode="decimal" min="0" step="0.001" /></div>' +
      "</div>" +
      '<p class="billing-err" id="billing-error" role="alert"></p>' +
      '<div class="billing-actions">' +
      '<button class="btn btn-primary" type="submit">' +
      esc(t("tools.billing.saveItem", "Save item")) +
      '</button><a class="btn btn-ghost" href="#app/items">' +
      esc(t("tools.billing.backToItems", "Back to items")) +
      "</a></div></form>" +
      '<div id="bill-hsn-modal" class="bill-modal" hidden>' +
      '<div class="bill-modal-card glass" role="dialog" aria-modal="true" aria-labelledby="hsn-modal-title">' +
      '<header class="bill-modal-head">' +
      '<h3 id="hsn-modal-title">' +
      esc(t("tools.billing.findHsnTitle", "Find HSN / SAC")) +
      '</h3><button class="bill-modal-close" type="button" id="hsn-close" aria-label="' +
      esc(t("tools.billing.findHsnClose", "Close")) +
      '">×</button></header>' +
      '<p class="tool-note" id="hsn-modal-lead">' +
      esc(t("tools.billing.findHsnHint", "Search by code or description. GST % is a typical slab — confirm before you invoice.")) +
      "</p>" +
      '<div id="hsn-search-pane">' +
      '<div class="tool-field"><label for="hsn-search">' +
      esc(t("tools.billing.findHsnSearch", "Code or description")) +
      "</label>" +
      '<input id="hsn-search" type="search" maxlength="80" autocomplete="off" /></div>' +
      '<div id="hsn-results" class="bill-hsn-results"></div></div>' +
      '<div id="hsn-add-pane" hidden>' +
      '<div class="bill-form-grid">' +
      '<div class="tool-field"><label for="hsn-add-code">' +
      esc(t("tools.billing.findHsnAddCode", "HSN / SAC code")) +
      ' <span class="billing-req">*</span></label>' +
      '<input id="hsn-add-code" type="text" maxlength="12" autocomplete="off" /></div>' +
      '<div class="tool-field"><label for="hsn-add-type">' +
      esc(t("tools.billing.itemType", "Type")) +
      "</label>" +
      '<select id="hsn-add-type"><option value="goods">' +
      esc(t("tools.billing.itemGoods", "Goods")) +
      '</option><option value="service">' +
      esc(t("tools.billing.itemService", "Service")) +
      "</option></select></div>" +
      '<div class="tool-field bill-span-2"><label for="hsn-add-desc">' +
      esc(t("tools.billing.findHsnAddDesc", "Description")) +
      ' <span class="billing-req">*</span></label>' +
      '<input id="hsn-add-desc" type="text" maxlength="400" autocomplete="off" /></div>' +
      '<div class="tool-field"><label for="hsn-add-gst">GST %</label>' +
      '<select id="hsn-add-gst"><option>0</option><option>3</option><option>5</option><option>12</option><option value="18" selected>18</option><option>28</option><option>40</option></select></div></div>' +
      '<p class="billing-err" id="hsn-add-error" role="alert"></p>' +
      '<div class="billing-actions">' +
      '<button class="btn btn-primary" type="button" id="hsn-add-save">' +
      esc(t("tools.billing.findHsnAddSave", "Save code")) +
      '</button><button class="btn btn-ghost" type="button" id="hsn-add-cancel">' +
      esc(t("tools.billing.findHsnAddCancel", "Back to search")) +
      "</button></div></div></div></div>";

    var typeEl = document.getElementById("item-type");
    function syncType() {
      var service = typeEl && typeEl.value === "service";
      var stock = document.getElementById("item-stock-field");
      var low = document.getElementById("item-low-field");
      if (stock) stock.hidden = service;
      if (low) low.hidden = service;
    }
    if (typeEl) typeEl.addEventListener("change", syncType);
    syncType();
    bindHsnFinder();
    var nameEl = document.getElementById("item-name");
    if (nameEl) nameEl.focus();
  }

  function itemTypeValue() {
    var el = document.getElementById("item-type");
    return el && el.value === "service" ? "service" : "goods";
  }

  function searchHsn(q, limit) {
    var path =
      "/hsn?q=" +
      encodeURIComponent(q) +
      "&type=" +
      encodeURIComponent(itemTypeValue());
    if (limit) path += "&limit=" + encodeURIComponent(String(limit));
    return api(path, { timeout: 10000 });
  }

  function setGstRate(rate) {
    var sel = document.getElementById("item-gst");
    if (!sel) return;
    var v = String(rate);
    var found = false;
    var i;
    for (i = 0; i < sel.options.length; i += 1) {
      if (sel.options[i].value === v) {
        found = true;
        break;
      }
    }
    if (!found) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }
    sel.value = v;
  }

  function applyHsnHit(hit, quiet) {
    if (!hit || !hit.code) return;
    var hsn = document.getElementById("item-hsn");
    if (hsn) hsn.value = hit.code;
    setGstRate(hit.gstRate);
    var typeEl = document.getElementById("item-type");
    if (typeEl && hit.type) {
      typeEl.value = hit.type;
      typeEl.dispatchEvent(new Event("change"));
    }
    var desc = document.getElementById("item-desc");
    if (desc && !String(desc.value || "").trim() && hit.description) {
      desc.value = hit.description;
    }
    if (!quiet) toast(t("tools.billing.findHsnApplied", "HSN/SAC applied"));
  }

  function bindHsnFinder() {
    var findBtn = document.getElementById("item-hsn-find");
    var modal = document.getElementById("bill-hsn-modal");
    var search = document.getElementById("hsn-search");
    var results = document.getElementById("hsn-results");
    var closeBtn = document.getElementById("hsn-close");
    var nameEl = document.getElementById("item-name");
    var chips = document.getElementById("item-hsn-chips");
    var typeEl = document.getElementById("item-type");
    var searchPane = document.getElementById("hsn-search-pane");
    var addPane = document.getElementById("hsn-add-pane");
    var addCode = document.getElementById("hsn-add-code");
    var addDesc = document.getElementById("hsn-add-desc");
    var addType = document.getElementById("hsn-add-type");
    var addGst = document.getElementById("hsn-add-gst");
    var addErr = document.getElementById("hsn-add-error");
    var addSave = document.getElementById("hsn-add-save");
    var addCancel = document.getElementById("hsn-add-cancel");
    var titleEl = document.getElementById("hsn-modal-title");
    var leadEl = document.getElementById("hsn-modal-lead");
    if (!findBtn || !modal || !search || !results) return;

    var timer = 0;
    var seq = 0;
    var lastHits = {};
    var chipHits = {};
    var lastSuggest = "";
    var suggestSeq = 0;
    var lastLookup = "";
    var hsnInput = document.getElementById("item-hsn");

    function markChip(code) {
      if (!chips) return;
      chips.querySelectorAll("[data-hsn-chip]").forEach(function (el) {
        el.classList.toggle("is-on", el.getAttribute("data-hsn-chip") === code);
      });
    }

    function renderChips(items) {
      chipHits = {};
      if (!chips) return;
      if (!items || !items.length) {
        chips.hidden = true;
        chips.innerHTML = "";
        return;
      }
      chips.hidden = false;
      chips.innerHTML =
        '<span class="bill-hsn-chips-label">' +
        esc(t("tools.billing.hsnSuggest", "Suggested")) +
        "</span>" +
        items
          .slice(0, 5)
          .map(function (hit) {
            chipHits[hit.code] = hit;
            return (
              '<button type="button" class="bill-hsn-suggest" data-hsn-chip="' +
              esc(hit.code) +
              '" title="' +
              esc(hit.description) +
              '"><span>' +
              esc(hit.code) +
              '</span><span class="bill-hsn-suggest-gst">' +
              esc(String(hit.gstRate)) +
              "%</span></button>"
            );
          })
          .join("");
    }

    function suggestFromName() {
      if (!nameEl || !chips) return;
      var q = nameEl.value.trim();
      var key = q.toLowerCase() + "|" + itemTypeValue();
      if (q.length < 2) {
        lastSuggest = "";
        renderChips([]);
        return;
      }
      if (key === lastSuggest) return;
      var my = (suggestSeq += 1);
      searchHsn(q, 5)
        .then(function (data) {
          if (my !== suggestSeq) return;
          lastSuggest = key;
          renderChips(data.items || []);
        })
        .catch(function () {
          if (my !== suggestSeq) return;
          renderChips([]);
        });
    }

    function closeModal() {
      modal.hidden = true;
      findBtn.focus();
    }

    function looksLikeHsnCode(value) {
      return /^[A-Z0-9]{2,12}$/i.test(String(value || "").replace(/\s+/g, ""));
    }

    function addMissingMarkup(q) {
      return (
        '<div class="bill-hsn-empty">' +
        '<p class="tool-note">' +
        esc(t("tools.billing.findHsnEmpty", "No matching codes")) +
        "</p>" +
        '<button type="button" class="btn btn-primary" id="hsn-add-open" data-hsn-add="' +
        esc(q) +
        '">' +
        esc(t("tools.billing.findHsnAdd", "Add HSN / SAC")) +
        "</button></div>"
      );
    }

    function showSearchPane() {
      if (searchPane) searchPane.hidden = false;
      if (addPane) addPane.hidden = true;
      if (titleEl) titleEl.textContent = t("tools.billing.findHsnTitle", "Find HSN / SAC");
      if (leadEl) {
        leadEl.textContent = t(
          "tools.billing.findHsnHint",
          "Search by code or description. GST % is a typical slab — confirm before you invoice.",
        );
      }
    }

    function showAddPane(q) {
      if (searchPane) searchPane.hidden = true;
      if (addPane) addPane.hidden = false;
      if (titleEl) titleEl.textContent = t("tools.billing.findHsnAddTitle", "Add a missing code");
      if (leadEl) {
        leadEl.textContent = t(
          "tools.billing.findHsnAddLead",
          "Save this HSN/SAC in your catalog so you can find it next time.",
        );
      }
      if (addErr) addErr.textContent = "";
      var compact = String(q || "").replace(/\s+/g, "").toUpperCase();
      if (addCode) addCode.value = looksLikeHsnCode(compact) ? compact : "";
      if (addDesc) {
        addDesc.value = looksLikeHsnCode(compact)
          ? fieldVal("item-name")
          : String(q || fieldVal("item-name") || "").trim();
      }
      if (addType) addType.value = itemTypeValue();
      if (addGst) addGst.value = "18";
      if (addCode && !addCode.value) addCode.focus();
      else if (addDesc) addDesc.focus();
    }

    function renderHits(items, q) {
      lastHits = {};
      var query = String(q || "").trim();
      var missing =
        !items ||
        !items.length ||
        (looksLikeHsnCode(query) &&
          !items.some(function (hit) {
            return hit.code === query.replace(/\s+/g, "").toUpperCase();
          }));
      if (!items || !items.length) {
        results.innerHTML = addMissingMarkup(query);
        return;
      }
      var html = items
        .map(function (hit) {
          lastHits[hit.code] = hit;
          return (
            '<button type="button" class="bill-hsn-hit" data-hsn-code="' +
            esc(hit.code) +
            '"><span class="bill-hsn-hit-top"><strong>' +
            esc(hit.code) +
            '</strong><span class="bill-chip">' +
            esc(String(hit.gstRate)) +
            '% GST</span></span><span class="bill-hsn-hit-desc">' +
            esc(hit.description) +
            "</span></button>"
          );
        })
        .join("");
      if (missing) html += addMissingMarkup(query);
      results.innerHTML = html;
    }

    function runSearch() {
      var q = search.value.trim();
      if (q.length < 2) {
        results.innerHTML =
          '<p class="tool-note">' +
          esc(t("tools.billing.findHsnHint", "Search by code or description. GST % is a typical slab — confirm before you invoice.")) +
          "</p>";
        return;
      }
      var my = (seq += 1);
      results.innerHTML =
        '<p class="tool-note">' +
        esc(t("tools.billing.findHsnLoading", "Searching…")) +
        "</p>";
      searchHsn(q)
        .then(function (data) {
          if (my !== seq) return;
          renderHits(data.items || [], q);
        })
        .catch(function (ex) {
          if (my !== seq) return;
          results.innerHTML = '<p class="billing-err">' + esc(ex.message) + "</p>";
        });
    }

    function openModal() {
      modal.hidden = false;
      showSearchPane();
      var hsn = document.getElementById("item-hsn");
      search.value = hsn && hsn.value ? hsn.value : "";
      search.focus();
      if (search.value.trim().length >= 2) runSearch();
      else {
        results.innerHTML =
          '<p class="tool-note">' +
          esc(t("tools.billing.findHsnHint", "Search by code or description. GST % is a typical slab — confirm before you invoice.")) +
          "</p>";
      }
    }

    function saveAddedCode() {
      if (addErr) addErr.textContent = "";
      var code = addCode ? String(addCode.value || "").trim().toUpperCase() : "";
      var description = addDesc ? String(addDesc.value || "").trim() : "";
      if (!looksLikeHsnCode(code)) {
        if (addErr) addErr.textContent = t("tools.billing.findHsnAddCodeRequired", "Enter a valid 2–12 character HSN/SAC code");
        if (addCode) addCode.focus();
        return;
      }
      if (description.length < 2) {
        if (addErr) addErr.textContent = t("tools.billing.findHsnAddDescRequired", "Enter a description");
        if (addDesc) addDesc.focus();
        return;
      }
      if (addSave) addSave.disabled = true;
      api("/hsn", {
        method: "POST",
        body: {
          code: code,
          description: description,
          type: addType ? addType.value : itemTypeValue(),
          gstRate: Number(addGst ? addGst.value : 18),
        },
      })
        .then(function (hit) {
          applyHsnHit(hit, true);
          markChip(hit.code);
          toast(t("tools.billing.findHsnAddSaved", "HSN/SAC saved"));
          closeModal();
        })
        .catch(function (ex) {
          if (addErr) addErr.textContent = ex.message;
        })
        .then(function () {
          if (addSave) addSave.disabled = false;
        });
    }

    findBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    search.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 280);
    });
    results.addEventListener("click", function (e) {
      var addBtn = e.target.closest ? e.target.closest("[data-hsn-add]") : null;
      if (addBtn) {
        showAddPane(addBtn.getAttribute("data-hsn-add") || search.value);
        return;
      }
      var btn = e.target.closest ? e.target.closest("[data-hsn-code]") : null;
      if (!btn) return;
      applyHsnHit(lastHits[btn.getAttribute("data-hsn-code")]);
      markChip(btn.getAttribute("data-hsn-code"));
      closeModal();
    });
    if (addSave) addSave.addEventListener("click", saveAddedCode);
    if (addCancel) addCancel.addEventListener("click", showSearchPane);
    if (chips) {
      chips.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("[data-hsn-chip]") : null;
        if (!btn) return;
        var code = btn.getAttribute("data-hsn-chip");
        applyHsnHit(chipHits[code]);
        markChip(code);
      });
    }
    function pickExactCode(items, code) {
      var compact = String(code || "").replace(/\s+/g, "").toUpperCase();
      var exact = (items || []).filter(function (hit) {
        return hit && hit.code === compact;
      });
      if (!exact.length) return null;
      var typed = itemTypeValue();
      var i;
      for (i = 0; i < exact.length; i += 1) {
        if (exact[i].type === typed) return exact[i];
      }
      return exact[0];
    }

    function fillFromTypedCode() {
      if (!hsnInput) return;
      var compact = String(hsnInput.value || "").replace(/\s+/g, "").toUpperCase();
      if (compact) hsnInput.value = compact;
      if (!looksLikeHsnCode(compact) || compact === lastLookup) return;
      api("/hsn?q=" + encodeURIComponent(compact) + "&limit=15", { timeout: 10000 })
        .then(function (data) {
          var hit = pickExactCode(data.items || [], compact);
          if (!hit) return;
          lastLookup = compact;
          applyHsnHit(hit, true);
          markChip(hit.code);
        })
        .catch(function () {});
    }

    if (nameEl) nameEl.addEventListener("blur", suggestFromName);
    if (typeEl) {
      typeEl.addEventListener("change", function () {
        lastSuggest = "";
        suggestFromName();
      });
    }
    if (hsnInput) {
      hsnInput.addEventListener("blur", fillFromTypedCode);
      hsnInput.addEventListener("input", function () {
        lastLookup = "";
      });
    }
  }

  var IN_STATES = [
    { code: "01", name: "Jammu and Kashmir" },
    { code: "02", name: "Himachal Pradesh" },
    { code: "03", name: "Punjab" },
    { code: "04", name: "Chandigarh" },
    { code: "05", name: "Uttarakhand" },
    { code: "06", name: "Haryana" },
    { code: "07", name: "Delhi" },
    { code: "08", name: "Rajasthan" },
    { code: "09", name: "Uttar Pradesh" },
    { code: "10", name: "Bihar" },
    { code: "11", name: "Sikkim" },
    { code: "12", name: "Arunachal Pradesh" },
    { code: "13", name: "Nagaland" },
    { code: "14", name: "Manipur" },
    { code: "15", name: "Mizoram" },
    { code: "16", name: "Tripura" },
    { code: "17", name: "Meghalaya" },
    { code: "18", name: "Assam" },
    { code: "19", name: "West Bengal" },
    { code: "20", name: "Jharkhand" },
    { code: "21", name: "Odisha" },
    { code: "22", name: "Chhattisgarh" },
    { code: "23", name: "Madhya Pradesh" },
    { code: "24", name: "Gujarat" },
    { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
    { code: "27", name: "Maharashtra" },
    { code: "29", name: "Karnataka" },
    { code: "30", name: "Goa" },
    { code: "31", name: "Lakshadweep" },
    { code: "32", name: "Kerala" },
    { code: "33", name: "Tamil Nadu" },
    { code: "34", name: "Puducherry" },
    { code: "35", name: "Andaman and Nicobar Islands" },
    { code: "36", name: "Telangana" },
    { code: "37", name: "Andhra Pradesh" },
    { code: "38", name: "Ladakh" },
    { code: "97", name: "Other Territory" },
  ];

  function customersHref(page) {
    var n = Number(page) || 1;
    return n <= 1 ? "#app/customers" : "#app/customers/" + n;
  }

  function customersListView(page) {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    var asked = Math.max(1, Number(page) || 1);
    stage.innerHTML =
      '<header class="bill-stage-head bill-stage-head-row">' +
      "<div><h2>" +
      esc(t("tools.billing.tabCustomers", "Customers")) +
      "</h2><p>" +
      esc(t("tools.billing.customersLead", "Parties you bill — name, mobile, GSTIN, and address for invoices.")) +
      "</p></div>" +
      '<a class="btn btn-primary" href="#app/customers/new">' +
      esc(t("tools.billing.addCustomer", "Add customer")) +
      "</a></header>" +
      '<p class="tool-note" id="customers-status">' +
      esc(t("tools.billing.customersLoading", "Loading customers…")) +
      "</p>";
    api("/customers?page=" + encodeURIComponent(String(asked)) + "&limit=10")
      .then(function (data) {
        var items = (data && data.items) || [];
        var total = Number(data && data.total) || 0;
        var current = Number(data && data.page) || asked;
        var pages = Number(data && data.pages) || 0;
        var limit = Number(data && data.limit) || 10;
        var status = document.getElementById("customers-status");
        if (status) status.remove();
        if (current !== asked && pages > 0) {
          go(customersHref(current).slice(1));
          return;
        }
        if (!total) {
          stage.insertAdjacentHTML(
            "beforeend",
            '<div class="bill-empty glass"><p>' +
              esc(t("tools.billing.customersEmpty", "No customers yet. Add your first customer.")) +
              '</p><a class="btn btn-primary" href="#app/customers/new">' +
              esc(t("tools.billing.addCustomer", "Add customer")) +
              "</a></div>",
          );
          return;
        }
        var rows = items
          .map(function (it) {
            var place = [it.city, it.state].filter(Boolean).join(", ") || "—";
            var gst = it.gstin
              ? esc(it.gstin)
              : '<span class="bill-sub">' +
                esc(t("tools.billing.customerUnregistered", "Unregistered")) +
                "</span>";
            return (
              "<tr><td><strong>" +
              esc(it.name) +
              "</strong>" +
              (it.email ? '<span class="bill-sub">' + esc(it.email) + "</span>" : "") +
              "</td><td>" +
              (it.mobile ? "+91 " + esc(it.mobile) : "—") +
              "</td><td>" +
              gst +
              "</td><td>" +
              esc(place) +
              (it.pincode ? '<span class="bill-sub">' + esc(it.pincode) + "</span>" : "") +
              "</td></tr>"
            );
          })
          .join("");
        var from = (current - 1) * limit + 1;
        var to = Math.min(total, (current - 1) * limit + items.length);
        var prev =
          current > 1
            ? '<a class="btn btn-ghost" href="' +
              customersHref(current - 1) +
              '">' +
              esc(t("tools.billing.customersPrev", "Previous")) +
              "</a>"
            : '<span class="btn btn-ghost" aria-disabled="true">' +
              esc(t("tools.billing.customersPrev", "Previous")) +
              "</span>";
        var next =
          current < pages
            ? '<a class="btn btn-ghost" href="' +
              customersHref(current + 1) +
              '">' +
              esc(t("tools.billing.customersNext", "Next")) +
              "</a>"
            : '<span class="btn btn-ghost" aria-disabled="true">' +
              esc(t("tools.billing.customersNext", "Next")) +
              "</span>";
        stage.insertAdjacentHTML(
          "beforeend",
          '<div class="bill-table-wrap"><table class="bill-table"><thead><tr>' +
            "<th>" +
            esc(t("tools.billing.customerName", "Customer")) +
            "</th><th>" +
            esc(t("tools.billing.mobile", "Mobile number")) +
            "</th><th>" +
            esc(t("tools.billing.gstin", "GSTIN")) +
            "</th><th>" +
            esc(t("tools.billing.customerPlace", "Place of supply")) +
            "</th></tr></thead><tbody>" +
            rows +
            "</tbody></table></div>" +
            '<nav class="bill-pager" aria-label="' +
            esc(t("tools.billing.customersPages", "Customer pages")) +
            '">' +
            prev +
            '<p class="bill-pager-meta">' +
            esc(
              t("tools.billing.customersRange", "Showing {from}–{to} of {total}")
                .replace("{from}", String(from))
                .replace("{to}", String(to))
                .replace("{total}", String(total)),
            ) +
            "<span>" +
            esc(
              t("tools.billing.customersPage", "Page {page} of {pages}")
                .replace("{page}", String(current))
                .replace("{pages}", String(pages)),
            ) +
            "</span></p>" +
            next +
            "</nav>",
        );
      })
      .catch(function (ex) {
        var status = document.getElementById("customers-status");
        if (status) status.textContent = ex.message;
      });
  }

  function customerFormView() {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    var stateOpts =
      '<option value="">' +
      esc(t("tools.billing.customerStateNone", "Select state")) +
      "</option>" +
      IN_STATES.map(function (row) {
        return '<option value="' + row.code + '">' + esc(row.name) + "</option>";
      }).join("");
    stage.innerHTML =
      '<header class="bill-stage-head">' +
      "<h2>" +
      esc(t("tools.billing.addCustomerTitle", "Add customer")) +
      "</h2><p>" +
      esc(t("tools.billing.addCustomerLead", "These details are copied onto invoices for this customer.")) +
      "</p></header>" +
      '<form id="bill-customer-form" class="bill-item-form glass" method="post" action="#" onsubmit="return false;">' +
      '<div class="bill-form-grid">' +
      '<div class="tool-field bill-span-2"><label for="customer-name">' +
      esc(t("tools.billing.customerName", "Customer name")) +
      ' <span class="billing-req">*</span></label>' +
      '<input id="customer-name" type="text" maxlength="160" required autocomplete="organization" /></div>' +
      '<div class="tool-field"><label for="customer-mobile">' +
      esc(t("tools.billing.mobile", "Mobile number")) +
      "</label>" +
      '<div class="billing-input"><span>+91</span>' +
      '<input id="customer-mobile" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel" /></div></div>' +
      '<div class="tool-field"><label for="customer-email">' +
      esc(t("tools.billing.customerEmail", "Email")) +
      "</label>" +
      '<input id="customer-email" type="email" maxlength="120" autocomplete="email" /></div>' +
      '<div class="tool-field bill-span-2"><label for="customer-gstin">' +
      esc(t("tools.billing.gstin", "GSTIN")) +
      " <span class=\"tool-note\">(" +
      esc(t("tools.billing.optional", "optional")) +
      ")</span></label>" +
      '<input id="customer-gstin" type="text" maxlength="15" autocomplete="off" placeholder="22AAAAA0000A1Z5" />' +
      '<span class="tool-note">' +
      esc(t("tools.billing.customerGstinHint", "If added, state is filled from the GSTIN for place of supply.")) +
      "</span></div>" +
      '<div class="tool-field bill-span-2"><label for="customer-address">' +
      esc(t("tools.billing.customerAddress", "Billing address")) +
      "</label>" +
      '<input id="customer-address" type="text" maxlength="200" autocomplete="street-address" /></div>' +
      '<div class="tool-field"><label for="customer-city">' +
      esc(t("tools.billing.customerCity", "City")) +
      "</label>" +
      '<input id="customer-city" type="text" maxlength="80" autocomplete="address-level2" /></div>' +
      '<div class="tool-field"><label for="customer-state">' +
      esc(t("tools.billing.customerState", "State")) +
      "</label>" +
      '<select id="customer-state">' +
      stateOpts +
      "</select></div>" +
      '<div class="tool-field"><label for="customer-pincode">' +
      esc(t("tools.billing.customerPincode", "PIN code")) +
      "</label>" +
      '<input id="customer-pincode" type="text" inputmode="numeric" maxlength="6" autocomplete="postal-code" /></div>' +
      '<div class="tool-field bill-span-2"><label for="customer-notes">' +
      esc(t("tools.billing.customerNotes", "Notes")) +
      "</label>" +
      '<textarea id="customer-notes" rows="2" maxlength="400"></textarea></div>' +
      "</div>" +
      '<p class="billing-err" id="billing-error" role="alert"></p>' +
      '<div class="billing-actions">' +
      '<button class="btn btn-primary" type="submit">' +
      esc(t("tools.billing.saveCustomer", "Save customer")) +
      '</button><a class="btn btn-ghost" href="#app/customers">' +
      esc(t("tools.billing.backToCustomers", "Back to customers")) +
      "</a></div></form>";

    var gstEl = document.getElementById("customer-gstin");
    var stateEl = document.getElementById("customer-state");
    function fillStateFromGstin() {
      if (!gstEl || !stateEl) return;
      var compact = String(gstEl.value || "").replace(/\s+/g, "").toUpperCase();
      if (compact) gstEl.value = compact;
      if (compact.length < 2) return;
      var code = compact.slice(0, 2);
      var i;
      for (i = 0; i < stateEl.options.length; i += 1) {
        if (stateEl.options[i].value === code) {
          stateEl.value = code;
          return;
        }
      }
    }
    if (gstEl) gstEl.addEventListener("blur", fillStateFromGstin);
    var nameEl = document.getElementById("customer-name");
    if (nameEl) nameEl.focus();
  }

  var invDraft = { customer: null, lines: [], charges: [], seq: 0 };
  var GST_OPTS = [0, 3, 5, 12, 18, 28, 40];
  var CHARGE_PRESETS = ["Delivery", "Packing", "Installation", "Loading", "Round off"];

  function isObjectId(value) {
    return /^[a-f0-9]{24}$/i.test(String(value || ""));
  }

  function roundMoney(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function lineAmounts(qty, rate, gstRate, cessRate, taxInclusive) {
    var units = Number(qty) || 0;
    var price = Number(rate) || 0;
    var gstPct = Number(gstRate) || 0;
    var cessPct = Number(cessRate) || 0;
    var gross = units * price;
    var taxable;
    if (taxInclusive) {
      var factor = 1 + gstPct / 100 + cessPct / 100;
      taxable = factor > 0 ? roundMoney(gross / factor) : roundMoney(gross);
    } else {
      taxable = roundMoney(gross);
    }
    var gst = roundMoney((taxable * gstPct) / 100);
    var cess = roundMoney((taxable * cessPct) / 100);
    return { taxable: taxable, gst: gst, cess: cess, lineTotal: roundMoney(taxable + gst + cess) };
  }

  function invoiceTaxSplit(customer) {
    var sellerGstin = state.session && state.session.business && state.session.business.gstin;
    var sellerState = sellerGstin ? String(sellerGstin).slice(0, 2) : "";
    var buyerState = customer && (customer.stateCode || (customer.gstin ? String(customer.gstin).slice(0, 2) : ""));
    if (sellerState && buyerState && sellerState !== buyerState) return "igst";
    return "cgst_sgst";
  }

  function splitGstPreview(gst, mode) {
    var amount = roundMoney(gst);
    if (mode === "igst") return { cgst: 0, sgst: 0, igst: amount };
    var paise = Math.round(amount * 100);
    var cgstPaise = Math.floor(paise / 2);
    return { cgst: cgstPaise / 100, sgst: (paise - cgstPaise) / 100, igst: 0 };
  }

  function downloadInvoicePdf(id, number, template, printer) {
    var base = apiBase();
    if (!base) {
      toast(t("tools.billing.apiMissing", "Billing API URL is not configured. Set it in js/billing-config.js"));
      return Promise.reject(new Error("missing api"));
    }
    var qs = "";
    if (template) {
      qs =
        "?template=" +
        encodeURIComponent(template) +
        (printer ? "&printer=" + encodeURIComponent(printer) : "");
    }
    return fetch(base + "/api/invoices/" + encodeURIComponent(id) + "/pdf" + qs, {
      credentials: "include",
      headers: { Accept: "application/pdf" },
    })
      .then(function (res) {
        if (!res.ok) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              throw new Error((data.error && data.error.message) || t("tools.billing.invoicePdfFail", "Could not download PDF"));
            });
        }
        return res.blob();
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = (number || "invoice") + ".pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1200);
      })
      .catch(function (ex) {
        toast(ex.message || t("tools.billing.invoicePdfFail", "Could not download PDF"));
        throw ex;
      });
  }

  function deleteInvoice(id) {
    if (
      !window.confirm(
        t("tools.billing.invoiceDeleteConfirm", "Delete this invoice? Catalog stock will be restored."),
      )
    ) {
      return Promise.resolve(false);
    }
    return api("/invoices/" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
      toast(t("tools.billing.invoiceDeleted", "Invoice deleted"));
      return true;
    });
  }

  function invoiceActionButtons(id, number) {
    return (
      '<div class="bill-inv-actions">' +
      '<button type="button" class="bill-act" data-act="pdf" data-id="' +
      esc(id) +
      '" data-no="' +
      esc(number) +
      '">' +
      esc(t("tools.billing.invoicePdf", "PDF")) +
      "</button>" +
      '<button type="button" class="bill-act" data-act="edit" data-id="' +
      esc(id) +
      '">' +
      esc(t("tools.billing.invoiceEdit", "Edit")) +
      "</button>" +
      '<button type="button" class="bill-act bill-act-danger" data-act="del" data-id="' +
      esc(id) +
      '">' +
      esc(t("tools.billing.invoiceDelete", "Delete")) +
      "</button></div>"
    );
  }

  function bindInvoiceActions(root) {
    if (!root) return;
    root.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-act]") : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var id = btn.getAttribute("data-id");
      var act = btn.getAttribute("data-act");
      if (act === "pdf") {
        var onDetail =
          view().tab === "invoices" && isObjectId(view().screen) && !view().extra && invStudio.inv;
        downloadInvoicePdf(
          id,
          btn.getAttribute("data-no"),
          onDetail ? invStudio.template : undefined,
          onDetail ? invStudio.printer : undefined,
        );
        return;
      }
      if (act === "edit") {
        go("app/invoices/" + id + "/edit");
        return;
      }
      if (act === "del") {
        deleteInvoice(id)
          .then(function (ok) {
            if (ok) go("app/invoices");
          })
          .catch(function (ex) {
            toast(ex.message);
          });
      }
    });
  }

  function invoicesHref(page) {
    var n = Number(page) || 1;
    return n <= 1 ? "#app/invoices" : "#app/invoices/" + n;
  }

  function invoicesListView(page) {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    var asked = Math.max(1, Number(page) || 1);
    stage.innerHTML =
      '<header class="bill-stage-head bill-stage-head-row">' +
      "<div><h2>" +
      esc(t("tools.billing.tabInvoices", "Invoices")) +
      "</h2><p>" +
      esc(t("tools.billing.invoicesLead", "GST invoices with a customer snapshot and line totals.")) +
      "</p></div>" +
      '<a class="btn btn-primary" href="#app/invoices/new">' +
      esc(t("tools.billing.addInvoice", "Create invoice")) +
      "</a></header>" +
      '<p class="tool-note" id="invoices-status">' +
      esc(t("tools.billing.invoicesLoading", "Loading invoices…")) +
      "</p>";
    api("/invoices?page=" + encodeURIComponent(String(asked)) + "&limit=10")
      .then(function (data) {
        var items = (data && data.items) || [];
        var total = Number(data && data.total) || 0;
        var current = Number(data && data.page) || asked;
        var pages = Number(data && data.pages) || 0;
        var limit = Number(data && data.limit) || 10;
        var status = document.getElementById("invoices-status");
        if (status) status.remove();
        if (current !== asked && pages > 0) {
          go(invoicesHref(current).slice(1));
          return;
        }
        if (!total) {
          stage.insertAdjacentHTML(
            "beforeend",
            '<div class="bill-empty glass"><p>' +
              esc(t("tools.billing.invoicesEmpty", "No invoices yet. Create your first bill.")) +
              '</p><a class="btn btn-primary" href="#app/invoices/new">' +
              esc(t("tools.billing.addInvoice", "Create invoice")) +
              "</a></div>",
          );
          return;
        }
        var rows = items
          .map(function (it) {
            var taxLabel =
              it.taxSplit === "igst"
                ? t("tools.billing.invoiceIgst", "IGST")
                : t("tools.billing.invoiceCgstSgst", "CGST + SGST");
            return (
              '<tr class="bill-row-link" data-href="#app/invoices/' +
              esc(it.id) +
              '"><td><strong>' +
              esc(it.invoiceNumber) +
              '</strong><span class="bill-sub">' +
              esc(it.invoiceDate) +
              "</span></td><td>" +
              esc(it.customerName) +
              (it.customerGstin ? '<span class="bill-sub">' + esc(it.customerGstin) + "</span>" : "") +
              "</td><td>" +
              esc(it.placeOfSupply || "—") +
              '<span class="bill-sub">' +
              esc(taxLabel) +
              "</span></td><td>" +
              esc(moneyInr(it.grandTotal)) +
              '<span class="bill-sub">' +
              esc(String(it.lineCount)) +
              " " +
              esc(t("tools.billing.invoiceLines", "lines")) +
              "</span></td><td>" +
              invoiceActionButtons(it.id, it.invoiceNumber) +
              "</td></tr>"
            );
          })
          .join("");
        var from = (current - 1) * limit + 1;
        var to = Math.min(total, (current - 1) * limit + items.length);
        var prev =
          current > 1
            ? '<a class="btn btn-ghost" href="' +
              invoicesHref(current - 1) +
              '">' +
              esc(t("tools.billing.invoicesPrev", "Previous")) +
              "</a>"
            : '<span class="btn btn-ghost" aria-disabled="true">' +
              esc(t("tools.billing.invoicesPrev", "Previous")) +
              "</span>";
        var next =
          current < pages
            ? '<a class="btn btn-ghost" href="' +
              invoicesHref(current + 1) +
              '">' +
              esc(t("tools.billing.invoicesNext", "Next")) +
              "</a>"
            : '<span class="btn btn-ghost" aria-disabled="true">' +
              esc(t("tools.billing.invoicesNext", "Next")) +
              "</span>";
        stage.insertAdjacentHTML(
          "beforeend",
          '<div class="bill-table-wrap"><table class="bill-table"><thead><tr>' +
            "<th>" +
            esc(t("tools.billing.invoiceNumber", "Invoice")) +
            "</th><th>" +
            esc(t("tools.billing.customerName", "Customer")) +
            "</th><th>" +
            esc(t("tools.billing.customerPlace", "Place of supply")) +
            "</th><th>" +
            esc(t("tools.billing.invoiceTotal", "Total")) +
            "</th><th>" +
            esc(t("tools.billing.invoiceActions", "Actions")) +
            "</th></tr></thead><tbody>" +
            rows +
            "</tbody></table></div>" +
            '<nav class="bill-pager" aria-label="' +
            esc(t("tools.billing.invoicesPages", "Invoice pages")) +
            '">' +
            prev +
            '<p class="bill-pager-meta">' +
            esc(
              t("tools.billing.invoicesRange", "Showing {from}–{to} of {total}")
                .replace("{from}", String(from))
                .replace("{to}", String(to))
                .replace("{total}", String(total)),
            ) +
            "<span>" +
            esc(
              t("tools.billing.invoicesPage", "Page {page} of {pages}")
                .replace("{page}", String(current))
                .replace("{pages}", String(pages)),
            ) +
            "</span></p>" +
            next +
            "</nav>",
        );
        bindInvoiceActions(stage);
        stage.querySelectorAll("[data-href]").forEach(function (row) {
          row.addEventListener("click", function (e) {
            if (e.target.closest && e.target.closest("[data-act]")) return;
            go(row.getAttribute("data-href").replace(/^#/, ""));
          });
        });
      })
      .catch(function (ex) {
        var status = document.getElementById("invoices-status");
        if (status) status.textContent = ex.message;
      });
  }

  function invoiceAllLines() {
    return (invDraft.lines || []).concat(invDraft.charges || []);
  }

  function gstSelect(value) {
    var cur = String(value == null ? 18 : value);
    return (
      '<div class="bill-dd" data-value="' +
      cur +
      '"><button type="button" class="bill-dd-btn" aria-haspopup="listbox" aria-expanded="false">' +
      cur +
      '%</button><div class="bill-dd-menu" hidden role="listbox">' +
      GST_OPTS.map(function (n) {
        return (
          '<button type="button" class="bill-dd-opt' +
          (String(n) === cur ? " is-on" : "") +
          '" role="option" data-value="' +
          n +
          '">' +
          n +
          "%</button>"
        );
      }).join("") +
      "</div></div>"
    );
  }

  function closeGstMenus(except) {
    document.querySelectorAll(".bill-dd.is-open").forEach(function (dd) {
      if (except && dd === except) return;
      dd.classList.remove("is-open");
      var menu = dd.querySelector(".bill-dd-menu");
      var btn = dd.querySelector(".bill-dd-btn");
      if (menu) menu.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function closeSuggestLists(except) {
    document.querySelectorAll(".bill-suggest-list").forEach(function (list) {
      if (except && list === except) return;
      list.hidden = true;
      list.innerHTML = "";
      if (list.parentNode) list.parentNode.classList.remove("is-open");
    });
  }

  function setGstValue(dd, val) {
    if (!dd) return;
    dd.setAttribute("data-value", String(val));
    var btn = dd.querySelector(".bill-dd-btn");
    if (btn) btn.textContent = val + "%";
    dd.querySelectorAll(".bill-dd-opt").forEach(function (opt) {
      opt.classList.toggle("is-on", opt.getAttribute("data-value") === String(val));
    });
    var row = dd.closest("tr[data-line]");
    if (row) {
      var line = invDraft.lines.filter(function (l) {
        return l.key === row.getAttribute("data-line");
      })[0];
      if (line) {
        line.gstRate = Number(val) || 0;
        var amt = lineAmounts(line.qty, line.rate, line.gstRate, line.cessRate, line.taxInclusive);
        var cell = row.querySelector(".inv-amt");
        if (cell) cell.textContent = moneyInr(amt.lineTotal);
        renderInvoiceTotals();
      }
      return;
    }
    var charge = dd.closest("[data-charge]");
    if (!charge) return;
    var ch = invDraft.charges.filter(function (c) {
      return c.key === charge.getAttribute("data-charge");
    })[0];
    if (!ch) return;
    ch.gstRate = Number(val) || 0;
    renderInvoiceTotals();
  }

  function bindGstMenus(root) {
    if (!root || root._gstBound) return;
    root._gstBound = true;
    root.addEventListener("click", function (e) {
      var opt = e.target.closest ? e.target.closest(".bill-dd-opt") : null;
      if (opt) {
        e.preventDefault();
        e.stopPropagation();
        setGstValue(opt.closest(".bill-dd"), opt.getAttribute("data-value"));
        closeGstMenus();
        return;
      }
      var btn = e.target.closest ? e.target.closest(".bill-dd-btn") : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var dd = btn.closest(".bill-dd");
      var open = !dd.classList.contains("is-open");
      closeGstMenus();
      if (!open) return;
      dd.classList.add("is-open");
      var menu = dd.querySelector(".bill-dd-menu");
      if (menu) menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    });
  }

  function invoiceTotals(customer, lines) {
    var mode = invoiceTaxSplit(customer);
    var taxable = 0;
    var cgst = 0;
    var sgst = 0;
    var igst = 0;
    var cess = 0;
    var grand = 0;
    (lines || invoiceAllLines()).forEach(function (line) {
      var amt = lineAmounts(line.qty, line.rate, line.gstRate, line.cessRate, line.taxInclusive);
      var split = splitGstPreview(amt.gst, mode);
      taxable += amt.taxable;
      cgst += split.cgst;
      sgst += split.sgst;
      igst += split.igst;
      cess += amt.cess;
      grand += amt.lineTotal;
    });
    return {
      mode: mode,
      taxable: roundMoney(taxable),
      cgst: roundMoney(cgst),
      sgst: roundMoney(sgst),
      igst: roundMoney(igst),
      cess: roundMoney(cess),
      grand: roundMoney(grand),
    };
  }

  function renderInvoiceTotals() {
    var totalsEl = document.getElementById("inv-totals");
    if (!totalsEl) return;
    var tot = invoiceTotals(invDraft.customer, invoiceAllLines());
    var taxRows =
      tot.mode === "igst"
        ? "<div><span>IGST</span><strong>" + esc(moneyInr(tot.igst)) + "</strong></div>"
        : "<div><span>CGST</span><strong>" +
          esc(moneyInr(tot.cgst)) +
          "</strong></div><div><span>SGST</span><strong>" +
          esc(moneyInr(tot.sgst)) +
          "</strong></div>";
    totalsEl.innerHTML =
      "<div><span>" +
      esc(t("tools.billing.invoiceTaxable", "Taxable")) +
      "</span><strong>" +
      esc(moneyInr(tot.taxable)) +
      "</strong></div>" +
      taxRows +
      (tot.cess
        ? "<div><span>Cess</span><strong>" + esc(moneyInr(tot.cess)) + "</strong></div>"
        : "") +
      '<div class="bill-total-grand"><span>' +
      esc(t("tools.billing.invoiceTotal", "Total")) +
      "</span><strong>" +
      esc(moneyInr(tot.grand)) +
      "</strong></div>";
  }

  function renderInvoiceLines() {
    var body = document.getElementById("inv-lines-body");
    if (!body) return;
    if (!invDraft.lines.length) {
      body.innerHTML =
        '<tr><td colspan="6" class="bill-sub">' +
        esc(t("tools.billing.invoiceNoLines", "Search and add items below.")) +
        "</td></tr>";
    } else {
      body.innerHTML = invDraft.lines
        .map(function (line) {
          var amt = lineAmounts(line.qty, line.rate, line.gstRate, line.cessRate, line.taxInclusive);
          var chip =
            line.source === "custom"
              ? '<span class="bill-chip">' + esc(t("tools.billing.invoiceOneOff", "This bill only")) + "</span>"
              : "";
          return (
            '<tr data-line="' +
            line.key +
            '"><td><strong>' +
            esc(line.name) +
            "</strong>" +
            chip +
            (line.hsnSac ? '<span class="bill-sub">' + esc(line.hsnSac) + "</span>" : "") +
            '</td><td><input class="inv-qty" type="number" min="0.001" step="0.001" value="' +
            esc(String(line.qty)) +
            '" /></td><td><input class="inv-rate" type="number" min="0" step="0.01" value="' +
            esc(String(line.rate)) +
            '" /></td><td class="inv-gst-cell">' +
            gstSelect(line.gstRate) +
            '</td><td class="inv-amt">' +
            esc(moneyInr(amt.lineTotal)) +
            '</td><td><button type="button" class="btn btn-ghost inv-remove">' +
            esc(t("tools.billing.invoiceRemove", "Remove")) +
            "</button></td></tr>"
          );
        })
        .join("");
    }
    renderInvoiceTotals();
  }

  function renderPickedCustomer() {
    var box = document.getElementById("inv-customer-picked");
    var search = document.getElementById("inv-customer-search");
    if (!box) return;
    var c = invDraft.customer;
    if (!c) {
      box.hidden = true;
      box.innerHTML = "";
      if (search) search.hidden = false;
      return;
    }
    box.hidden = false;
    if (search) search.hidden = true;
    var place = [c.city, c.state].filter(Boolean).join(", ") || t("tools.billing.customerUnregistered", "Unregistered");
    var mode = invoiceTaxSplit(c);
    box.innerHTML =
      "<div><strong>" +
      esc(c.name) +
      "</strong><span class=\"bill-sub\">" +
      esc(c.gstin || t("tools.billing.customerUnregistered", "Unregistered")) +
      " · " +
      esc(place) +
      "</span></div><div class=\"bill-sub\">" +
      esc(
        mode === "igst"
          ? t("tools.billing.invoiceIgstHint", "Inter-state — IGST")
          : t("tools.billing.invoiceLocalHint", "Intra-state — CGST + SGST"),
      ) +
      '</div><button type="button" class="btn btn-ghost" id="inv-customer-clear">' +
      esc(t("tools.billing.invoiceChangeParty", "Change")) +
      "</button>";
    var clear = document.getElementById("inv-customer-clear");
    if (clear)
      clear.addEventListener("click", function () {
        invDraft.customer = null;
        renderPickedCustomer();
        renderInvoiceLines();
        var q = document.getElementById("inv-customer-q");
        if (q) q.focus();
      });
  }

  function bindSuggest(inputId, listId, searchFn, pickFn) {
    var input = document.getElementById(inputId);
    var list = document.getElementById(listId);
    if (!input || !list) return;
    var timer = 0;
    var seq = 0;
    function close() {
      list.hidden = true;
      list.innerHTML = "";
      if (list.parentNode) list.parentNode.classList.remove("is-open");
    }
    function run() {
      var q = input.value.trim();
      if (q.length < 1) {
        close();
        return;
      }
      var my = (seq += 1);
      list.hidden = false;
      if (list.parentNode) list.parentNode.classList.add("is-open");
      list.innerHTML = '<p class="tool-note">' + esc(t("tools.billing.findHsnLoading", "Searching…")) + "</p>";
      searchFn(q)
        .then(function (items) {
          if (my !== seq) return;
          if (!items.length) {
            list.innerHTML =
              '<div class="bill-suggest-empty"><p>' +
              esc(t("tools.billing.invoiceNoMatches", "No matching customers")) +
              "</p></div>";
            return;
          }
          list.innerHTML = items
            .map(function (hit, idx) {
              return (
                '<button type="button" class="bill-hsn-hit" data-idx="' +
                idx +
                '"><span class="bill-hsn-hit-top"><strong>' +
                esc(hit.title) +
                '</strong><span class="bill-chip">' +
                esc(hit.meta) +
                '</span></span><span class="bill-hsn-hit-desc">' +
                esc(hit.sub || "") +
                "</span></button>"
              );
            })
            .join("");
          list._hits = items;
        })
        .catch(function (ex) {
          if (my !== seq) return;
          list.innerHTML = '<p class="billing-err">' + esc(ex.message) + "</p>";
        });
    }
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(run, 220);
    });
    list.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-idx]") : null;
      if (!btn || !list._hits) return;
      var hit = list._hits[Number(btn.getAttribute("data-idx"))];
      if (!hit) return;
      pickFn(hit.raw);
      input.value = "";
      close();
    });
  }

  function addInvoiceLine(line) {
    invDraft.seq += 1;
    invDraft.lines.push(
      Object.assign(
        {
          key: "l" + invDraft.seq,
          source: "catalog",
          qty: 1,
          rate: 0,
          gstRate: 18,
          cessRate: 0,
          taxInclusive: false,
        },
        line,
      ),
    );
    renderInvoiceLines();
  }

  function itemEmptyActions(q) {
    return (
      '<div class="bill-suggest-empty">' +
      '<p>' +
      esc(t("tools.billing.invoiceNoMatches", "No matching items")) +
      "</p>" +
      '<div class="bill-suggest-actions">' +
      '<button type="button" class="btn btn-primary" data-inv-custom="' +
      esc(q) +
      '">' +
      esc(t("tools.billing.invoiceUseOnce", "Use on this bill")) +
      "</button>" +
      '<button type="button" class="btn btn-ghost" data-inv-save="' +
      esc(q) +
      '">' +
      esc(t("tools.billing.invoiceSaveItem", "Save to items")) +
      "</button></div></div>"
    );
  }

  function bindItemSearch() {
    var input = document.getElementById("inv-item-q");
    var list = document.getElementById("inv-item-hits");
    if (!input || !list) return;
    var timer = 0;
    var seq = 0;
    function close() {
      list.hidden = true;
      list.innerHTML = "";
      if (list.parentNode) list.parentNode.classList.remove("is-open");
    }
    function addCustom(name) {
      var label = String(name || "").trim();
      if (label.length < 2) return;
      addInvoiceLine({ source: "custom", name: label, qty: 1, rate: 0, gstRate: 18 });
      input.value = "";
      close();
    }
    function saveItem(name) {
      var label = String(name || "").trim();
      if (label.length < 2) return;
      api("/items", {
        method: "POST",
        body: {
          name: label,
          type: "goods",
          unit: "pcs",
          salePrice: 0,
          gstRate: 18,
          taxInclusive: false,
        },
      })
        .then(function (it) {
          addInvoiceLine({
            source: "catalog",
            itemId: it.id,
            name: it.name,
            hsnSac: it.hsnSac,
            qty: 1,
            rate: Number(it.salePrice) || 0,
            gstRate: Number(it.gstRate) || 18,
            cessRate: Number(it.cessRate) || 0,
            taxInclusive: Boolean(it.taxInclusive),
          });
          toast(t("tools.billing.itemSaved", "Item saved"));
          input.value = "";
          close();
        })
        .catch(function (ex) {
          list.innerHTML = '<p class="billing-err">' + esc(ex.message) + "</p>";
          list.hidden = false;
        });
    }
    function run() {
      var q = input.value.trim();
      if (q.length < 1) {
        close();
        return;
      }
      var my = (seq += 1);
      list.hidden = false;
      if (list.parentNode) list.parentNode.classList.add("is-open");
      list.innerHTML = '<p class="tool-note">' + esc(t("tools.billing.findHsnLoading", "Searching…")) + "</p>";
      api("/items?q=" + encodeURIComponent(q) + "&limit=20")
        .then(function (data) {
          if (my !== seq) return;
          var items = (data && data.items) || [];
          var html = items
            .map(function (it, idx) {
              return (
                '<button type="button" class="bill-hsn-hit" data-idx="' +
                idx +
                '"><span class="bill-hsn-hit-top"><strong>' +
                esc(it.name) +
                '</strong><span class="bill-chip">' +
                esc(moneyInr(it.salePrice)) +
                '</span></span><span class="bill-hsn-hit-desc">' +
                esc([it.hsnSac, it.unit, it.gstRate + "% GST"].filter(Boolean).join(" · ")) +
                "</span></button>"
              );
            })
            .join("");
          if (!items.length) {
            html = itemEmptyActions(q);
          } else if (
            !items.some(function (it) {
              return String(it.name).toLowerCase() === q.toLowerCase();
            })
          ) {
            html += itemEmptyActions(q);
          }
          list.innerHTML = html || itemEmptyActions(q);
          list._hits = items;
          list._q = q;
        })
        .catch(function (ex) {
          if (my !== seq) return;
          list.innerHTML = '<p class="billing-err">' + esc(ex.message) + "</p>";
        });
    }
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(run, 220);
    });
    list.addEventListener("click", function (e) {
      var custom = e.target.closest ? e.target.closest("[data-inv-custom]") : null;
      if (custom) {
        addCustom(custom.getAttribute("data-inv-custom") || list._q);
        return;
      }
      var save = e.target.closest ? e.target.closest("[data-inv-save]") : null;
      if (save) {
        saveItem(save.getAttribute("data-inv-save") || list._q);
        return;
      }
      var btn = e.target.closest ? e.target.closest("[data-idx]") : null;
      if (!btn || !list._hits) return;
      var it = list._hits[Number(btn.getAttribute("data-idx"))];
      if (!it) return;
      addInvoiceLine({
        source: "catalog",
        itemId: it.id,
        name: it.name,
        hsnSac: it.hsnSac,
        qty: 1,
        rate: Number(it.salePrice) || 0,
        gstRate: Number(it.gstRate) || 0,
        cessRate: Number(it.cessRate) || 0,
        taxInclusive: Boolean(it.taxInclusive),
      });
      input.value = "";
      close();
    });
  }

  function renderCharges() {
    var root = document.getElementById("inv-charges");
    if (!root) return;
    if (!invDraft.charges.length) {
      root.innerHTML = "";
      renderInvoiceTotals();
      return;
    }
    var listId = "inv-charge-presets";
    root.innerHTML =
      '<datalist id="' +
      listId +
      '">' +
      CHARGE_PRESETS.map(function (n) {
        return '<option value="' + esc(n) + '"></option>';
      }).join("") +
      "</datalist>" +
      invDraft.charges
        .map(function (ch) {
          return (
            '<div class="bill-charge-row" data-charge="' +
            ch.key +
            '"><input class="inv-charge-name" type="text" list="' +
            listId +
            '" maxlength="80" value="' +
            esc(ch.name) +
            '" placeholder="' +
            esc(t("tools.billing.invoiceChargeName", "Charge name")) +
            '" />' +
            '<input class="inv-rate" type="number" min="0" step="0.01" value="' +
            esc(String(ch.rate)) +
            '" aria-label="' +
            esc(t("tools.billing.invoiceAmount", "Amount")) +
            '" />' +
            gstSelect(ch.gstRate) +
            '<button type="button" class="btn btn-ghost inv-charge-remove">' +
            esc(t("tools.billing.invoiceRemove", "Remove")) +
            "</button></div>"
          );
        })
        .join("");
    renderInvoiceTotals();
  }

  function bindCharges() {
    var addBtn = document.getElementById("inv-add-charge");
    var root = document.getElementById("inv-charges");
    if (addBtn)
      addBtn.addEventListener("click", function () {
        invDraft.seq += 1;
        invDraft.charges.push({
          key: "c" + invDraft.seq,
          source: "charge",
          kind: "charge",
          name: "Delivery",
          qty: 1,
          rate: 0,
          gstRate: 0,
          cessRate: 0,
          taxInclusive: false,
        });
        renderCharges();
      });
    if (!root) return;
    root.addEventListener("input", function (e) {
      var row = e.target.closest ? e.target.closest("[data-charge]") : null;
      if (!row) return;
      var ch = invDraft.charges.filter(function (c) {
        return c.key === row.getAttribute("data-charge");
      })[0];
      if (!ch) return;
      if (e.target.classList.contains("inv-rate")) ch.rate = Number(e.target.value) || 0;
      if (e.target.classList.contains("inv-charge-name")) ch.name = e.target.value.trim() || ch.name;
      renderInvoiceTotals();
    });
    root.addEventListener("change", function (e) {
      var row = e.target.closest ? e.target.closest("[data-charge]") : null;
      if (!row) return;
      var ch = invDraft.charges.filter(function (c) {
        return c.key === row.getAttribute("data-charge");
      })[0];
      if (!ch) return;
      if (e.target.classList.contains("inv-charge-name")) ch.name = e.target.value.trim() || ch.name;
      renderInvoiceTotals();
    });
    root.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".inv-charge-remove") : null;
      if (!btn) return;
      var row = btn.closest("[data-charge]");
      if (!row) return;
      invDraft.charges = invDraft.charges.filter(function (c) {
        return c.key !== row.getAttribute("data-charge");
      });
      renderCharges();
    });
  }

  function bindInvoiceChrome() {
    if (document._billInvChrome) return;
    document._billInvChrome = true;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t.closest || !t.closest(".bill-dd")) closeGstMenus();
      if (!t.closest || !t.closest(".bill-suggest")) closeSuggestLists();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      closeGstMenus();
      closeSuggestLists();
    });
  }

  function invoiceFormView(editId) {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    invDraft = { customer: null, lines: [], charges: [], seq: 0, editId: editId || null };
    var today = new Date();
    var iso =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    stage.innerHTML =
      '<header class="bill-stage-head">' +
      "<h2>" +
      esc(
        editId
          ? t("tools.billing.editInvoiceTitle", "Edit invoice")
          : t("tools.billing.addInvoiceTitle", "Create invoice"),
      ) +
      "</h2><p>" +
      esc(t("tools.billing.addInvoiceLead", "Pick a customer, add items, and GST is calculated from place of supply.")) +
      "</p></header>" +
      '<form id="bill-invoice-form" class="bill-item-form glass" method="post" action="#" onsubmit="return false;">' +
      '<div class="bill-form-grid">' +
      '<div class="tool-field bill-span-2"><label for="inv-customer-q">' +
      esc(t("tools.billing.invoiceCustomer", "Customer")) +
      ' <span class="billing-req">*</span></label>' +
      '<div id="inv-customer-search" class="bill-suggest"><input id="inv-customer-q" type="search" maxlength="80" autocomplete="off" placeholder="' +
      esc(t("tools.billing.invoiceCustomerHint", "Search name, mobile, or GSTIN")) +
      '" /><div id="inv-customer-hits" class="bill-suggest-list" hidden></div></div>' +
      '<div id="inv-customer-picked" class="bill-picked" hidden></div></div>' +
      '<div class="tool-field"><label for="inv-date">' +
      esc(t("tools.billing.invoiceDate", "Invoice date")) +
      "</label>" +
      '<input id="inv-date" type="date" value="' +
      iso +
      '" required /></div>' +
      '<div class="tool-field bill-span-2"><label>' +
      esc(t("tools.billing.invoiceItems", "Items")) +
      ' <span class="billing-req">*</span></label>' +
      '<div class="bill-table-wrap"><table class="bill-table bill-inv-lines"><thead><tr>' +
      "<th>" +
      esc(t("tools.billing.itemName", "Item")) +
      "</th><th>" +
      esc(t("tools.billing.invoiceQty", "Qty")) +
      "</th><th>" +
      esc(t("tools.billing.invoiceRate", "Rate")) +
      "</th><th>GST</th><th>" +
      esc(t("tools.billing.invoiceAmount", "Amount")) +
      "</th><th></th></tr></thead><tbody id=\"inv-lines-body\"></tbody></table></div>" +
      '<div class="bill-suggest"><input id="inv-item-q" type="search" maxlength="80" autocomplete="off" placeholder="' +
      esc(t("tools.billing.invoiceItemHint", "Search catalog to add a line")) +
      '" /><div id="inv-item-hits" class="bill-suggest-list" hidden></div></div></div>' +
      '<div class="tool-field bill-span-2"><label>' +
      esc(t("tools.billing.invoiceCharges", "Other charges")) +
      "</label>" +
      '<div id="inv-charges" class="bill-charge-list"></div>' +
      '<div class="bill-charge-actions">' +
      '<button class="bill-add-charge" type="button" id="inv-add-charge">+ ' +
      esc(t("tools.billing.invoiceAddCharge", "Add charge")) +
      "</button>" +
      '<span class="tool-note">' +
      esc(t("tools.billing.invoiceChargesHint", "Delivery, packing, or any extra amount on this bill.")) +
      "</span></div></div>" +
      '<div class="tool-field bill-span-2"><label for="inv-notes">' +
      esc(t("tools.billing.invoiceNotes", "Notes")) +
      "</label>" +
      '<textarea id="inv-notes" rows="2" maxlength="400"></textarea></div></div>' +
      '<div id="inv-totals" class="bill-inv-totals"></div>' +
      '<p class="billing-err" id="billing-error" role="alert"></p>' +
      '<div class="billing-actions">' +
      '<button class="btn btn-primary" type="submit">' +
      esc(editId ? t("tools.billing.saveInvoiceChanges", "Save changes") : t("tools.billing.saveInvoice", "Save invoice")) +
      '</button><a class="btn btn-ghost" href="#app/invoices">' +
      esc(t("tools.billing.backToInvoices", "Back to invoices")) +
      "</a></div></form>";

    renderInvoiceLines();
    bindSuggest(
      "inv-customer-q",
      "inv-customer-hits",
      function (q) {
        return api("/customers?q=" + encodeURIComponent(q) + "&limit=20").then(function (data) {
          return ((data && data.items) || []).map(function (c) {
            return {
              title: c.name,
              meta: c.gstin || t("tools.billing.customerUnregistered", "Unregistered"),
              sub: [c.mobile ? "+91 " + c.mobile : "", c.city, c.state].filter(Boolean).join(" · "),
              raw: c,
            };
          });
        });
      },
      function (c) {
        invDraft.customer = c;
        renderPickedCustomer();
        renderInvoiceLines();
      },
    );
    bindItemSearch();
    bindCharges();
    bindGstMenus(document.getElementById("bill-invoice-form"));
    bindInvoiceChrome();
    var body = document.getElementById("inv-lines-body");
    if (body) {
      body.addEventListener("input", function (e) {
        var row = e.target.closest ? e.target.closest("tr[data-line]") : null;
        if (!row) return;
        var line = invDraft.lines.filter(function (l) {
          return l.key === row.getAttribute("data-line");
        })[0];
        if (!line) return;
        if (e.target.classList.contains("inv-qty")) line.qty = Number(e.target.value) || 0;
        if (e.target.classList.contains("inv-rate")) line.rate = Number(e.target.value) || 0;
        var amt = lineAmounts(line.qty, line.rate, line.gstRate, line.cessRate, line.taxInclusive);
        var cell = row.querySelector(".inv-amt");
        if (cell) cell.textContent = moneyInr(amt.lineTotal);
        renderInvoiceTotals();
      });
      body.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest(".inv-remove") : null;
        if (!btn) return;
        var row = btn.closest("tr[data-line]");
        if (!row) return;
        invDraft.lines = invDraft.lines.filter(function (l) {
          return l.key !== row.getAttribute("data-line");
        });
        renderInvoiceLines();
      });
    }
    var q = document.getElementById("inv-customer-q");
    if (q) q.focus();
    if (editId) {
      api("/invoices/" + encodeURIComponent(editId))
        .then(fillInvoiceDraft)
        .catch(function (ex) {
          toast(ex.message);
          go("app/invoices");
        });
    }
  }

  function fillInvoiceDraft(inv) {
    invDraft.customer = Object.assign({ id: inv.customerId }, inv.customer || {});
    invDraft.lines = [];
    invDraft.charges = [];
    invDraft.seq = 0;
    (inv.lines || []).forEach(function (line) {
      invDraft.seq += 1;
      var row = {
        key: (line.source === "charge" ? "c" : "l") + invDraft.seq,
        itemId: line.itemId || undefined,
        source: line.source || (line.itemId ? "catalog" : "custom"),
        name: line.name,
        hsnSac: line.hsnSac,
        qty: line.qty,
        rate: line.rate,
        gstRate: line.gstRate,
        cessRate: line.cessRate || 0,
        taxInclusive: Boolean(line.taxInclusive),
      };
      if (row.source === "charge") invDraft.charges.push(row);
      else invDraft.lines.push(row);
    });
    var dateEl = document.getElementById("inv-date");
    if (dateEl && inv.invoiceDate) dateEl.value = inv.invoiceDate;
    var notes = document.getElementById("inv-notes");
    if (notes) notes.value = inv.notes || "";
    var title = document.querySelector("#bill-stage .bill-stage-head h2");
    if (title) title.textContent = t("tools.billing.editInvoiceTitle", "Edit invoice") + " " + inv.invoiceNumber;
    renderPickedCustomer();
    renderInvoiceLines();
    renderCharges();
  }

  function handleInvoiceSubmit() {
    var form = document.getElementById("bill-invoice-form");
    var err = errBox();
    if (!form) return;
    if (err) err.textContent = "";
    if (!invDraft.customer || !invDraft.customer.id) {
      if (err) err.textContent = t("tools.billing.invoiceCustomerRequired", "Choose a customer");
      return;
    }
    var itemLines = invDraft.lines.filter(function (line) {
      return (line.itemId || (line.name && line.name.trim().length >= 2)) && Number(line.qty) > 0;
    });
    var chargeLines = (invDraft.charges || []).filter(function (line) {
      return line.name && line.name.trim().length >= 2 && Number(line.rate) >= 0;
    });
    if (!itemLines.length && !chargeLines.length) {
      if (err) err.textContent = t("tools.billing.invoiceLinesRequired", "Add at least one item");
      return;
    }
    setBusy(form, true);
    var editing = Boolean(invDraft.editId);
    api(editing ? "/invoices/" + encodeURIComponent(invDraft.editId) : "/invoices", {
      method: editing ? "PATCH" : "POST",
      body: {
        customerId: invDraft.customer.id,
        invoiceDate: fieldVal("inv-date") || undefined,
        notes: fieldVal("inv-notes") || undefined,
        lines: itemLines
          .map(function (line) {
            if (line.itemId) {
              return {
                itemId: line.itemId,
                qty: Number(line.qty),
                rate: Number(line.rate),
                gstRate: Number(line.gstRate),
              };
            }
            return {
              name: line.name,
              kind: "goods",
              qty: Number(line.qty),
              rate: Number(line.rate),
              gstRate: Number(line.gstRate),
            };
          })
          .concat(
            chargeLines.map(function (line) {
              return {
                name: line.name.trim(),
                kind: "charge",
                qty: 1,
                rate: Number(line.rate) || 0,
                gstRate: Number(line.gstRate) || 0,
              };
            }),
          ),
      },
    })
      .then(function (inv) {
        toast(
          editing
            ? t("tools.billing.invoiceUpdated", "Invoice updated")
            : t("tools.billing.invoiceSaved", "Invoice saved"),
        );
        go("app/invoices/" + inv.id);
      })
      .catch(function (ex) {
        if (err) err.textContent = ex.message;
      })
      .then(function () {
        setBusy(form, false);
      });
  }

  var INVOICE_TEMPLATES = [
    {
      id: "classic",
      name: "Classic GST",
      hint: "Full tax invoice with HSN, bank, logo, QR, and signature",
      printers: ["a4", "a5"],
      def: "a4",
    },
    {
      id: "modern",
      name: "Modern",
      hint: "Bold header for laser and inkjet printers",
      printers: ["a4", "a5"],
      def: "a4",
    },
    {
      id: "minimal",
      name: "Compact",
      hint: "Dense retail bill — A4, A5, or 80 mm",
      printers: ["a4", "a5", "thermal80"],
      def: "a5",
    },
    {
      id: "thermal",
      name: "Receipt",
      hint: "Centered POS slip for 80 mm and 58 mm rolls",
      printers: ["thermal80", "thermal58"],
      def: "thermal80",
    },
  ];

  var INVOICE_PRINTERS = [
    { id: "a4", name: "A4", hint: "210 × 297 mm" },
    { id: "a5", name: "A5", hint: "148 × 210 mm" },
    { id: "thermal80", name: "80 mm", hint: "Thermal roll" },
    { id: "thermal58", name: "58 mm", hint: "Compact roll" },
  ];

  var invStudio = { template: "classic", printer: "a4", inv: null, biz: null, assets: {} };

  function invoiceTemplateInfo(id) {
    var i = 0;
    for (i = 0; i < INVOICE_TEMPLATES.length; i += 1) {
      if (INVOICE_TEMPLATES[i].id === id) return INVOICE_TEMPLATES[i];
    }
    return INVOICE_TEMPLATES[0];
  }

  function resolvePrintChoice(template, printer) {
    var info = invoiceTemplateInfo(template);
    if (printer && info.printers.indexOf(printer) !== -1) return { template: info.id, printer: printer };
    return { template: info.id, printer: info.def };
  }

  function amountInWordsInr(value) {
    var ones = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    var tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    function below100(n) {
      if (n < 20) return ones[n];
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    }
    function chunk(n, scale) {
      if (!n) return "";
      if (n > 99) {
        return (
          ones[Math.floor(n / 100)] +
          " Hundred" +
          (n % 100 ? " " + below100(n % 100) : "") +
          (scale ? " " + scale : "")
        );
      }
      return below100(n) + (scale ? " " + scale : "");
    }
    var rounded = Math.round((Number(value) || 0) * 100) / 100;
    var rupees = Math.floor(rounded);
    var paise = Math.round((rounded - rupees) * 100);
    if (!rupees && !paise) return "Zero Rupees Only";
    var parts = [
      chunk(Math.floor(rupees / 10000000), "Crore"),
      chunk(Math.floor((rupees % 10000000) / 100000), "Lakh"),
      chunk(Math.floor((rupees % 100000) / 1000), "Thousand"),
      rupees % 1000 ? chunk(rupees % 1000, "") : "",
    ].filter(Boolean);
    var out = parts.join(" ").replace(/\s+/g, " ").trim();
    out = out ? out + (rupees === 1 ? " Rupee" : " Rupees") : "Zero Rupees";
    if (paise) out += " and " + below100(paise) + (paise === 1 ? " Paisa" : " Paise");
    return out + " Only";
  }

  function loadBrandAssets() {
    return Promise.all(
      ["logo", "signature", "qr"].map(function (kind) {
        return fetch(apiBase() + "/api/business/" + kind, { credentials: "include" })
          .then(function (res) {
            if (!res.ok) throw new Error("missing");
            return res.blob();
          })
          .then(function (blob) {
            if (invStudio.assets[kind]) URL.revokeObjectURL(invStudio.assets[kind]);
            invStudio.assets[kind] = URL.createObjectURL(blob);
          })
          .catch(function () {
            invStudio.assets[kind] = "";
          });
      }),
    );
  }

  function invPartyHtml(p) {
    if (!p) return "";
    var bits = ["<strong>" + esc(p.name) + "</strong>"];
    if (p.gstin) bits.push("<span>GSTIN " + esc(p.gstin) + "</span>");
    if (p.mobile) bits.push("<span>+91 " + esc(p.mobile) + "</span>");
    if (p.address) bits.push("<span>" + esc(p.address) + "</span>");
    var place = [p.city, p.state, p.pincode].filter(Boolean).join(", ");
    if (place) bits.push("<span>" + esc(place) + "</span>");
    return bits.join("");
  }

  function invTaxRowsHtml(inv) {
    var rows =
      inv.taxSplit === "igst"
        ? '<div><span>IGST</span><strong>' + esc(moneyInr(inv.igstTotal)) + "</strong></div>"
        : "<div><span>CGST</span><strong>" +
          esc(moneyInr(inv.cgstTotal)) +
          "</strong></div><div><span>SGST</span><strong>" +
          esc(moneyInr(inv.sgstTotal)) +
          "</strong></div>";
    return (
      "<div><span>" +
      esc(t("tools.billing.invoiceTaxable", "Taxable")) +
      "</span><strong>" +
      esc(moneyInr(inv.taxableTotal)) +
      "</strong></div>" +
      rows +
      (inv.cessTotal
        ? "<div><span>Cess</span><strong>" + esc(moneyInr(inv.cessTotal)) + "</strong></div>"
        : "") +
      '<div class="inv-grand"><span>' +
      esc(t("tools.billing.invoiceTotal", "Total")) +
      "</span><strong>" +
      esc(moneyInr(inv.grandTotal)) +
      "</strong></div>"
    );
  }

  function invBrandFooterHtml(biz, wide) {
    var bank = [];
    if (biz.bankName) bank.push(esc(biz.bankName));
    if (biz.bankAccountName) bank.push(esc(biz.bankAccountName));
    if (biz.bankAccountNumber) bank.push("A/C " + esc(biz.bankAccountNumber));
    if (biz.bankIfsc) bank.push("IFSC " + esc(biz.bankIfsc));
    if (biz.upiId) bank.push("UPI " + esc(biz.upiId));
    var qr = invStudio.assets.qr
      ? '<div class="inv-foot-col"><h4>' +
        esc(t("tools.billing.invoicePayQr", "Pay by QR")) +
        '</h4><img class="inv-qr" src="' +
        esc(invStudio.assets.qr) +
        '" alt="" />' +
        (biz.upiId ? "<span>" + esc(biz.upiId) + "</span>" : "") +
        "</div>"
      : "";
    var sign = invStudio.assets.signature
      ? '<img class="inv-sign" src="' + esc(invStudio.assets.signature) + '" alt="" />'
      : '<span class="inv-sign-line"></span>';
    return (
      '<div class="inv-foot' +
      (wide ? " is-wide" : "") +
      '">' +
      (bank.length
        ? '<div class="inv-foot-col"><h4>' +
          esc(t("tools.billing.invoiceBank", "Bank details")) +
          "</h4><p>" +
          bank.join("<br/>") +
          "</p></div>"
        : "") +
      qr +
      '<div class="inv-foot-col inv-foot-sign"><h4>' +
      esc(t("tools.billing.invoiceSign", "Authorised signatory")) +
      "</h4>" +
      sign +
      '</div></div><p class="inv-fine">' +
      esc(t("tools.billing.invoiceComputer", "This is a computer generated invoice.")) +
      "</p>"
    );
  }

  function invoiceSheetHtml(inv, biz) {
    var taxLabel =
      inv.taxSplit === "igst"
        ? t("tools.billing.invoiceIgst", "IGST")
        : t("tools.billing.invoiceCgstSgst", "CGST + SGST");
    var logo = invStudio.assets.logo
      ? '<img class="inv-logo" src="' + esc(invStudio.assets.logo) + '" alt="" />'
      : '<span class="inv-logo-fallback">' + esc(String((inv.seller && inv.seller.name) || "B").charAt(0)) + "</span>";
    var tpl = invStudio.template;
    var lines = inv.lines || [];
    var compact = invStudio.printer !== "a4";

    if (tpl === "thermal") {
      return (
        '<div class="inv-thermal-head">' +
        logo +
        "<strong>" +
        esc(inv.seller.name) +
        "</strong>" +
        (inv.seller.gstin ? "<span>GSTIN " + esc(inv.seller.gstin) + "</span>" : "") +
        (inv.seller.mobile ? "<span>+91 " + esc(inv.seller.mobile) + "</span>" : "") +
        (inv.seller.address ? "<span>" + esc(inv.seller.address) + "</span>" : "") +
        '</div><div class="inv-dash"></div><div class="inv-thermal-meta"><strong>TAX INVOICE</strong><span>' +
        esc(inv.invoiceNumber) +
        "</span><span>" +
        esc(inv.invoiceDate) +
        "</span><span>Bill to: " +
        esc(inv.customer.name) +
        "</span>" +
        (inv.placeOfSupply ? "<span>POS " + esc(inv.placeOfSupply) + " · " + esc(taxLabel) + "</span>" : "") +
        '</div><div class="inv-dash"></div><div class="inv-thermal-lines">' +
        lines
          .map(function (line) {
            return (
              "<p><strong>" +
              esc(line.name) +
              "</strong><span>" +
              esc(String(line.qty)) +
              " " +
              esc(line.unit) +
              " × " +
              esc(moneyInr(line.rate)) +
              " · GST " +
              esc(String(line.gstRate)) +
              "%</span><b>" +
              esc(moneyInr(line.lineTotal)) +
              "</b></p>"
            );
          })
          .join("") +
        '</div><div class="inv-dash"></div><div class="inv-totals inv-totals-thermal">' +
        invTaxRowsHtml(inv) +
        "</div>" +
        (inv.notes ? '<p class="inv-notes">' + esc(inv.notes) + "</p>" : "") +
        '<div class="inv-thermal-end">' +
        (invStudio.assets.qr
          ? '<img class="inv-qr inv-qr-center" src="' + esc(invStudio.assets.qr) + '" alt="" />'
          : "") +
        (biz.upiId ? '<p class="inv-upi">' + esc(biz.upiId) + "</p>" : "") +
        (invStudio.assets.signature
          ? '<img class="inv-sign inv-sign-center" src="' + esc(invStudio.assets.signature) + '" alt="" />'
          : "") +
        '<p class="inv-thanks">' +
        esc(t("tools.billing.invoiceThanks", "Thank you. Visit again.")) +
        "</p></div>"
      );
    }

    var table =
      tpl === "minimal"
        ? '<table class="inv-table"><thead><tr><th>' +
          esc(t("tools.billing.itemName", "Item")) +
          "</th><th>" +
          esc(t("tools.billing.invoiceQty", "Qty")) +
          "</th><th>" +
          esc(t("tools.billing.invoiceAmount", "Amount")) +
          "</th></tr></thead><tbody>" +
          lines
            .map(function (line) {
              return (
                "<tr><td><strong>" +
                esc(line.name) +
                "</strong><span>" +
                esc(moneyInr(line.rate)) +
                " · GST " +
                esc(String(line.gstRate)) +
                "%</span></td><td>" +
                esc(String(line.qty)) +
                "</td><td>" +
                esc(moneyInr(line.lineTotal)) +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>"
        : '<table class="inv-table"><thead><tr><th>' +
          esc(t("tools.billing.itemName", "Item")) +
          "</th>" +
          (compact ? "" : "<th>HSN</th>") +
          "<th>" +
          esc(t("tools.billing.invoiceQty", "Qty")) +
          "</th><th>" +
          esc(t("tools.billing.invoiceRate", "Rate")) +
          "</th><th>GST</th><th>" +
          esc(t("tools.billing.invoiceAmount", "Amount")) +
          "</th></tr></thead><tbody>" +
          lines
            .map(function (line) {
              return (
                "<tr><td><strong>" +
                esc(line.name) +
                "</strong></td>" +
                (compact ? "" : "<td>" + esc(line.hsnSac || "—") + "</td>") +
                "<td>" +
                esc(String(line.qty)) +
                " " +
                esc(line.unit) +
                "</td><td>" +
                esc(moneyInr(line.rate)) +
                "</td><td>" +
                esc(String(line.gstRate)) +
                "%</td><td>" +
                esc(moneyInr(line.lineTotal)) +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>";

    var header =
      tpl === "modern"
        ? '<div class="inv-modern-head">' +
          logo +
          "<div><strong>" +
          esc(inv.seller.name) +
          "</strong>" +
          (inv.seller.gstin ? "<span>GSTIN " + esc(inv.seller.gstin) + "</span>" : "") +
          '</div><div class="inv-modern-meta"><em>TAX INVOICE</em><span>' +
          esc(inv.invoiceNumber) +
          "</span><span>" +
          esc(inv.invoiceDate) +
          "</span></div></div>"
        : '<div class="inv-classic-head">' +
          logo +
          "<div><strong>" +
          esc(inv.seller.name) +
          "</strong>" +
          (inv.seller.gstin ? "<span>GSTIN " + esc(inv.seller.gstin) + "</span>" : "") +
          (inv.seller.mobile ? "<span>+91 " + esc(inv.seller.mobile) + "</span>" : "") +
          (inv.seller.address ? "<span>" + esc(inv.seller.address) + "</span>" : "") +
          '</div><div class="inv-classic-meta"><em>TAX INVOICE</em><span>' +
          esc(inv.invoiceNumber) +
          "</span><span>" +
          esc(inv.invoiceDate) +
          "</span></div></div>";

    return (
      header +
      '<div class="inv-parties"><div><h4>' +
      esc(t("tools.billing.invoiceFrom", "From")) +
      "</h4>" +
      invPartyHtml(inv.seller) +
      "</div><div><h4>" +
      esc(t("tools.billing.invoiceTo", "Bill to")) +
      "</h4>" +
      invPartyHtml(inv.customer) +
      '</div></div><p class="inv-pos">Place of supply: ' +
      esc(inv.placeOfSupply || "—") +
      " · " +
      esc(taxLabel) +
      "</p>" +
      table +
      '<div class="inv-totals">' +
      invTaxRowsHtml(inv) +
      "</div>" +
      (tpl !== "minimal"
        ? '<p class="inv-words"><em>' +
          esc(t("tools.billing.invoiceAmountWords", "Amount in words")) +
          "</em> " +
          esc(amountInWordsInr(inv.grandTotal)) +
          "</p>"
        : "") +
      (inv.notes ? '<p class="inv-notes">' + esc(inv.notes) + "</p>" : "") +
      invBrandFooterHtml(biz, tpl === "classic" && invStudio.printer === "a4")
    );
  }

  function renderInvoiceSheet() {
    var root = document.getElementById("inv-sheet");
    if (!root || !invStudio.inv || !invStudio.biz) return;
    root.className = "inv-sheet inv-sheet--" + invStudio.template + " inv-sheet--" + invStudio.printer;
    root.innerHTML = invoiceSheetHtml(invStudio.inv, invStudio.biz);
  }

  function setPrintPageSize() {
    var style = document.getElementById("inv-print-page");
    if (!style) {
      style = document.createElement("style");
      style.id = "inv-print-page";
      document.head.appendChild(style);
    }
    var sizes = { a4: "A4", a5: "A5", thermal80: "80mm auto", thermal58: "58mm auto" };
    var margin = String(invStudio.printer).indexOf("thermal") === 0 ? "3mm" : "10mm";
    style.textContent = "@page { size: " + (sizes[invStudio.printer] || "A4") + "; margin: " + margin + "; }";
  }

  function printInvoiceSheet() {
    setPrintPageSize();
    document.body.classList.add("inv-printing");
    window.print();
    setTimeout(function () {
      document.body.classList.remove("inv-printing");
    }, 400);
  }

  function saveInvoicePrintDefault() {
    var biz = invStudio.biz;
    if (!biz) return Promise.resolve();
    return api("/business", {
      method: "PATCH",
      body: {
        name: biz.name,
        email: biz.email || undefined,
        gstin: biz.gstin || undefined,
        pan: biz.pan || undefined,
        address: biz.address || undefined,
        city: biz.city || undefined,
        stateCode: biz.stateCode || undefined,
        pincode: biz.pincode || undefined,
        bankName: biz.bankName || undefined,
        bankAccountName: biz.bankAccountName || undefined,
        bankIfsc: biz.bankIfsc || undefined,
        bankAccountNumber: biz.bankAccountNumber || undefined,
        upiId: biz.upiId || undefined,
        invoiceTemplate: invStudio.template,
        invoicePrinter: invStudio.printer,
      },
    }).then(function (saved) {
      invStudio.biz = saved;
      if (state.session && state.session.business) {
        state.session.business.invoiceTemplate = saved.invoiceTemplate;
        state.session.business.invoicePrinter = saved.invoicePrinter;
      }
      toast(t("tools.billing.invoicePrintSaved", "Saved as default print layout"));
    });
  }

  function paintInvoiceStudioControls() {
    var tpls = document.getElementById("inv-tpls");
    var printers = document.getElementById("inv-printers");
    if (tpls) {
      tpls.innerHTML = INVOICE_TEMPLATES.map(function (row) {
        return (
          '<button type="button" class="inv-tpl' +
          (row.id === invStudio.template ? " is-on" : "") +
          '" data-tpl="' +
          row.id +
          '"><strong>' +
          esc(t("tools.billing.invoiceTpl_" + row.id, row.name)) +
          "</strong><span>" +
          esc(t("tools.billing.invoiceTplHint_" + row.id, row.hint)) +
          "</span></button>"
        );
      }).join("");
    }
    var info = invoiceTemplateInfo(invStudio.template);
    if (printers) {
      printers.innerHTML = INVOICE_PRINTERS.filter(function (row) {
        return info.printers.indexOf(row.id) !== -1;
      })
        .map(function (row) {
          return (
            '<button type="button" class="inv-printer' +
            (row.id === invStudio.printer ? " is-on" : "") +
            '" data-printer="' +
            row.id +
            '">' +
            esc(t("tools.billing.invoicePrinter_" + row.id, row.name)) +
            "<em>" +
            esc(row.hint) +
            "</em></button>"
          );
        })
        .join("");
    }
  }

  function bindInvoiceStudio(root) {
    if (!root) return;
    root.addEventListener("click", function (e) {
      var tpl = e.target.closest ? e.target.closest("[data-tpl]") : null;
      var printer = e.target.closest ? e.target.closest("[data-printer]") : null;
      var act = e.target.closest ? e.target.closest("[data-studio]") : null;
      if (tpl) {
        var next = resolvePrintChoice(tpl.getAttribute("data-tpl"), invStudio.printer);
        invStudio.template = next.template;
        invStudio.printer = next.printer;
        paintInvoiceStudioControls();
        renderInvoiceSheet();
        return;
      }
      if (printer) {
        invStudio.printer = printer.getAttribute("data-printer");
        paintInvoiceStudioControls();
        renderInvoiceSheet();
        return;
      }
      if (!act) return;
      var kind = act.getAttribute("data-studio");
      if (kind === "print") printInvoiceSheet();
      if (kind === "default") {
        saveInvoicePrintDefault().catch(function (ex) {
          toast(ex.message, "err");
        });
      }
    });
  }

  function invoiceDetailView(id) {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    stage.innerHTML =
      '<p class="tool-note">' + esc(t("tools.billing.invoicesLoading", "Loading invoices…")) + "</p>";
    Promise.all([api("/invoices/" + encodeURIComponent(id)), api("/business")])
      .then(function (pair) {
        var inv = pair[0];
        var biz = pair[1];
        var choice = resolvePrintChoice(biz.invoiceTemplate, biz.invoicePrinter);
        invStudio.inv = inv;
        invStudio.biz = biz;
        invStudio.template = choice.template;
        invStudio.printer = choice.printer;
        return loadBrandAssets().then(function () {
          return inv;
        });
      })
      .then(function (inv) {
        var taxLabel =
          inv.taxSplit === "igst"
            ? t("tools.billing.invoiceIgst", "IGST")
            : t("tools.billing.invoiceCgstSgst", "CGST + SGST");
        stage.innerHTML =
          '<header class="bill-stage-head bill-stage-head-row"><div><h2>' +
          esc(inv.invoiceNumber) +
          "</h2><p>" +
          esc(inv.invoiceDate) +
          " · " +
          esc(taxLabel) +
          (inv.placeOfSupply ? " · " + esc(inv.placeOfSupply) : "") +
          "</p></div>" +
          '<div class="bill-inv-toolbar">' +
          '<button type="button" class="bill-act" data-studio="print">' +
          esc(t("tools.billing.invoicePrint", "Print")) +
          "</button>" +
          invoiceActionButtons(inv.id, inv.invoiceNumber) +
          '<button type="button" class="bill-act" data-studio="default">' +
          esc(t("tools.billing.invoiceSavePrint", "Save as default")) +
          '</button><a class="btn btn-ghost" href="#app/invoices">' +
          esc(t("tools.billing.backToInvoices", "Back to invoices")) +
          "</a></div></header>" +
          '<div class="inv-studio">' +
          '<aside class="inv-studio-aside glass">' +
          "<h3>" +
          esc(t("tools.billing.invoiceTemplate", "Invoice template")) +
          "</h3><p>" +
          esc(t("tools.billing.invoiceTemplatesLead", "Preview uses your logo, signature, QR, and bank details.")) +
          '</p><div id="inv-tpls" class="inv-tpl-grid"></div>' +
          "<h3>" +
          esc(t("tools.billing.invoicePrinter", "Printer")) +
          '</h3><div id="inv-printers" class="inv-printers"></div></aside>' +
          '<div class="inv-preview inv-print-root"><div id="inv-sheet" class="inv-sheet"></div></div></div>';
        paintInvoiceStudioControls();
        renderInvoiceSheet();
        bindInvoiceStudio(stage);
        bindInvoiceActions(stage);
      })
      .catch(function (ex) {
        stage.innerHTML =
          '<div class="bill-empty glass"><p>' +
          esc(ex.message) +
          '</p><a class="btn btn-ghost" href="#app/invoices">' +
          esc(t("tools.billing.backToInvoices", "Back to invoices")) +
          "</a></div>";
      });
  }

  function profileFieldCheck(id, label, on) {
    return (
      '<li class="' +
      (on ? "is-on" : "") +
      '"><span>' +
      (on ? "✓" : "○") +
      "</span>" +
      esc(label) +
      "</li>"
    );
  }

  var crop = {
    kind: "",
    previewId: "",
    img: null,
    aspect: 1,
    scale: 1,
    minScale: 1,
    x: 0,
    y: 0,
    drag: false,
    sx: 0,
    sy: 0,
    ox: 0,
    oy: 0,
  };

  function cropViewSize() {
    var wide = Math.min(360, window.innerWidth - 72);
    return { w: wide, h: Math.round(wide / crop.aspect) };
  }

  function clampCrop() {
    if (!crop.img) return;
    var view = cropViewSize();
    var w = crop.img.naturalWidth * crop.scale;
    var h = crop.img.naturalHeight * crop.scale;
    crop.x = Math.min(0, Math.max(view.w - w, crop.x));
    crop.y = Math.min(0, Math.max(view.h - h, crop.y));
  }

  function paintCrop() {
    var img = document.getElementById("bill-crop-img");
    var stage = document.getElementById("bill-crop-stage");
    var zoom = document.getElementById("bill-crop-zoom");
    if (!img || !stage || !crop.img) return;
    var view = cropViewSize();
    stage.style.width = view.w + "px";
    stage.style.height = view.h + "px";
    clampCrop();
    img.style.width = crop.img.naturalWidth * crop.scale + "px";
    img.style.height = crop.img.naturalHeight * crop.scale + "px";
    img.style.left = crop.x + "px";
    img.style.top = crop.y + "px";
    if (zoom) zoom.value = String(crop.scale);
  }

  function closeCrop() {
    var modal = document.getElementById("bill-crop");
    if (modal) modal.hidden = true;
    crop.img = null;
    crop.drag = false;
    ["profile-logo", "profile-signature", "profile-qr"].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.value = "";
    });
  }

  function uploadCroppedBlob(kind, previewId, blob) {
    var data = new FormData();
    data.append("file", blob, kind + ".png");
    return api("/business/" + kind, { method: "POST", body: data }).then(function (biz) {
      toast(
        kind === "logo"
          ? t("tools.billing.profileLogoSaved", "Logo saved")
          : kind === "qr"
            ? t("tools.billing.profileQrSaved", "QR saved")
            : t("tools.billing.profileSignSaved", "Signature saved"),
      );
      syncSessionProfile(biz.profile ? Object.assign({ name: biz.name, gstin: biz.gstin }, biz.profile) : biz);
      showProfileAsset(kind, previewId);
      refreshProfileChecklist(biz.profile);
    });
  }

  function applyCrop() {
    if (!crop.img) return;
    var view = cropViewSize();
    var outW = crop.kind === "signature" ? 800 : 512;
    var outH = Math.round(outW / crop.aspect);
    var canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    var ctx = canvas.getContext("2d");
    var sx = -crop.x / crop.scale;
    var sy = -crop.y / crop.scale;
    var sw = view.w / crop.scale;
    var sh = view.h / crop.scale;
    ctx.drawImage(crop.img, sx, sy, sw, sh, 0, 0, outW, outH);
    var kind = crop.kind;
    var previewId = crop.previewId;
    canvas.toBlob(
      function (blob) {
        if (!blob) {
          toast(t("tools.billing.profileCropFail", "Could not crop that image"));
          return;
        }
        closeCrop();
        uploadCroppedBlob(kind, previewId, blob).catch(function (ex) {
          toast(ex.message);
        });
      },
      "image/png",
      0.95,
    );
  }

  function bindCropOnce() {
    var modal = document.getElementById("bill-crop");
    if (!modal || modal._bound) return;
    modal._bound = true;
    modal.addEventListener("click", function (e) {
      if (e.target.id === "bill-crop" || (e.target.closest && e.target.closest("[data-crop-cancel]"))) {
        closeCrop();
      }
      if (e.target.closest && e.target.closest("[data-crop-apply]")) applyCrop();
    });
    var stage = document.getElementById("bill-crop-stage");
    if (stage) {
      stage.addEventListener("pointerdown", function (e) {
        if (!crop.img) return;
        crop.drag = true;
        crop.sx = e.clientX;
        crop.sy = e.clientY;
        crop.ox = crop.x;
        crop.oy = crop.y;
        stage.setPointerCapture(e.pointerId);
      });
      stage.addEventListener("pointermove", function (e) {
        if (!crop.drag) return;
        crop.x = crop.ox + (e.clientX - crop.sx);
        crop.y = crop.oy + (e.clientY - crop.sy);
        paintCrop();
      });
      stage.addEventListener("pointerup", function () {
        crop.drag = false;
      });
      stage.addEventListener(
        "wheel",
        function (e) {
          if (!crop.img) return;
          e.preventDefault();
          var next = crop.scale * (e.deltaY < 0 ? 1.08 : 0.92);
          crop.scale = Math.max(crop.minScale, Math.min(crop.minScale * 4, next));
          paintCrop();
        },
        { passive: false },
      );
    }
    var zoom = document.getElementById("bill-crop-zoom");
    if (zoom) {
      zoom.addEventListener("input", function () {
        crop.scale = Number(zoom.value) || crop.minScale;
        paintCrop();
      });
    }
  }

  function openCropper(kind, file, previewId) {
    var img = new Image();
    img.onload = function () {
      crop.kind = kind;
      crop.previewId = previewId;
      crop.img = img;
      crop.aspect = kind === "signature" ? 2 : 1;
      var view = cropViewSize();
      crop.minScale = Math.max(view.w / img.naturalWidth, view.h / img.naturalHeight);
      crop.scale = crop.minScale;
      crop.x = (view.w - img.naturalWidth * crop.scale) / 2;
      crop.y = (view.h - img.naturalHeight * crop.scale) / 2;
      var modal = document.getElementById("bill-crop");
      if (!modal) return;
      var title = document.getElementById("bill-crop-title");
      var hint = document.getElementById("bill-crop-hint");
      var frame = document.getElementById("bill-crop-img");
      var zoom = document.getElementById("bill-crop-zoom");
      if (title) {
        title.textContent =
          kind === "logo"
            ? t("tools.billing.profileCropLogo", "Crop logo · 1:1")
            : kind === "qr"
              ? t("tools.billing.profileCropQr", "Crop QR · 1:1")
              : t("tools.billing.profileCropSign", "Crop signature · 2:1");
      }
      if (hint) hint.textContent = t("tools.billing.profileCropHint", "Drag to reposition. Use the slider or scroll to zoom.");
      if (frame) frame.src = img.src;
      if (zoom) {
        zoom.min = String(crop.minScale);
        zoom.max = String(crop.minScale * 4);
        zoom.step = String(crop.minScale / 40);
        zoom.value = String(crop.scale);
      }
      modal.hidden = false;
      bindCropOnce();
      paintCrop();
    };
    img.onerror = function () {
      toast(t("tools.billing.profileCropFail", "Could not crop that image"));
    };
    img.src = URL.createObjectURL(file);
  }

  function bindProfileAsset(kind, previewId) {
    var input = document.getElementById("profile-" + kind);
    if (!input || input._bound) return;
    input._bound = true;
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        toast(t("tools.billing.profileCropType", "Use a PNG, JPG, or WebP image"));
        input.value = "";
        return;
      }
      openCropper(kind, file, previewId);
    });
  }

  function showProfileAsset(kind, previewId) {
    var img = document.getElementById(previewId);
    var empty = document.getElementById(previewId + "-empty");
    if (!img) return;
    fetch(apiBase() + "/api/business/" + kind, { credentials: "include" })
      .then(function (res) {
        if (!res.ok) throw new Error("missing");
        return res.blob();
      })
      .then(function (blob) {
        img.src = URL.createObjectURL(blob);
        img.hidden = false;
        if (empty) empty.hidden = true;
      })
      .catch(function () {
        img.hidden = true;
        if (empty) empty.hidden = false;
      });
  }

  function refreshProfileChecklist(profile) {
    var box = document.getElementById("profile-check");
    var meter = document.getElementById("profile-meter");
    if (!profile) return;
    if (meter) {
      meter.innerHTML =
        ringSvg(profile.percent, 72) +
        '<div><strong>' +
        esc(String(profile.percent)) +
        "%</strong><span>" +
        esc(t("tools.billing.profileCompleteLabel", "complete")) +
        "</span></div>";
    }
    if (box) {
      var map = {};
      (profile.fields || []).forEach(function (f) {
        map[f.id] = f;
      });
      box.innerHTML =
        profileFieldCheck("name", t("tools.billing.businessName", "Business name"), !!(map.name && map.name.filled)) +
        profileFieldCheck("email", t("tools.billing.profileEmail", "Email"), !!(map.email && map.email.filled)) +
        profileFieldCheck("address", t("tools.billing.customerAddress", "Billing address"), !!(map.address && map.address.filled)) +
        profileFieldCheck("logo", t("tools.billing.profileLogo", "Business logo"), !!(map.logo && map.logo.filled)) +
        profileFieldCheck("signature", t("tools.billing.profileSignature", "Signature"), !!(map.signature && map.signature.filled));
    }
  }

  var profileBiz = null;

  function profileView() {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    stage.innerHTML =
      settingsHead(
        "profile",
        t("tools.billing.profileLead", "Add the details printed on every invoice — address, logo, and signature."),
      ) +
      '<p class="tool-note">' +
      esc(t("tools.billing.profileLoading", "Loading profile…")) +
      "</p>";
    api("/business")
      .then(function (biz) {
        profileBiz = biz;
        var stateOpts =
          '<option value="">' +
          esc(t("tools.billing.customerStateNone", "Select state")) +
          "</option>" +
          IN_STATES.map(function (row) {
            return (
              '<option value="' +
              row.code +
              '"' +
              (biz.stateCode === row.code ? " selected" : "") +
              ">" +
              esc(row.name) +
              "</option>"
            );
          }).join("");
        stage.innerHTML =
          settingsHead(
            "profile",
            t("tools.billing.profileLead", "Add the details printed on every invoice — address, logo, and signature."),
          ) +
          '<ul id="profile-check" class="bill-profile-check"></ul>' +
          '<form id="bill-profile-form" class="bill-item-form glass" method="post" action="#" onsubmit="return false;">' +
          "<h3>" +
          esc(t("tools.billing.profileIdentity", "Business identity")) +
          "</h3>" +
          '<div class="bill-form-grid">' +
          '<div class="tool-field bill-span-2"><label for="profile-name">' +
          esc(t("tools.billing.businessName", "Business name")) +
          ' <span class="billing-req">*</span></label>' +
          '<input id="profile-name" type="text" maxlength="120" required value="' +
          esc(biz.name || "") +
          '" /></div>' +
          '<div class="tool-field"><label for="profile-email">' +
          esc(t("tools.billing.profileEmail", "Email")) +
          ' <span class="billing-req">*</span></label>' +
          '<input id="profile-email" type="email" maxlength="120" value="' +
          esc(biz.email || "") +
          '" /></div>' +
          '<div class="tool-field"><label>' +
          esc(t("tools.billing.mobile", "Mobile number")) +
          "</label>" +
          '<input type="text" value="+91 ' +
          esc(biz.mobile || "") +
          '" disabled /></div>' +
          '<div class="tool-field"><label for="profile-gstin">' +
          esc(t("tools.billing.gstin", "GSTIN")) +
          "</label>" +
          '<input id="profile-gstin" type="text" maxlength="15" value="' +
          esc(biz.gstin || "") +
          '" /></div>' +
          '<div class="tool-field"><label for="profile-pan">' +
          esc(t("tools.billing.profilePan", "PAN")) +
          "</label>" +
          '<input id="profile-pan" type="text" maxlength="10" value="' +
          esc(biz.pan || "") +
          '" /></div></div>' +
          "<h3>" +
          esc(t("tools.billing.profileAddress", "Business address")) +
          "</h3>" +
          '<div class="bill-form-grid">' +
          '<div class="tool-field bill-span-2"><label for="profile-address">' +
          esc(t("tools.billing.customerAddress", "Billing address")) +
          ' <span class="billing-req">*</span></label>' +
          '<input id="profile-address" type="text" maxlength="200" value="' +
          esc(biz.address || "") +
          '" /></div>' +
          '<div class="tool-field"><label for="profile-city">' +
          esc(t("tools.billing.customerCity", "City")) +
          ' <span class="billing-req">*</span></label>' +
          '<input id="profile-city" type="text" maxlength="80" value="' +
          esc(biz.city || "") +
          '" /></div>' +
          '<div class="tool-field"><label for="profile-state">' +
          esc(t("tools.billing.customerState", "State")) +
          ' <span class="billing-req">*</span></label>' +
          '<select id="profile-state">' +
          stateOpts +
          "</select></div>" +
          '<div class="tool-field"><label for="profile-pincode">' +
          esc(t("tools.billing.customerPincode", "PIN code")) +
          ' <span class="billing-req">*</span></label>' +
          '<input id="profile-pincode" type="text" inputmode="numeric" maxlength="6" value="' +
          esc(biz.pincode || "") +
          '" /></div></div>' +
          "<h3>" +
          esc(t("tools.billing.profileBrand", "Logo, signature, and QR")) +
          "</h3>" +
          '<div class="bill-profile-assets">' +
          '<label class="bill-asset-card"><span>' +
          esc(t("tools.billing.profileLogo", "Business logo")) +
          '</span><img id="profile-logo-preview" alt="" hidden /><span id="profile-logo-preview-empty" class="bill-asset-empty">' +
          esc(t("tools.billing.profileLogoHint", "Square PNG or JPG, under 2 MB")) +
          '</span><input id="profile-logo" type="file" accept="image/png,image/jpeg,image/webp" /></label>' +
          '<label class="bill-asset-card"><span>' +
          esc(t("tools.billing.profileSignature", "Signature")) +
          '</span><img id="profile-sign-preview" alt="" hidden /><span id="profile-sign-preview-empty" class="bill-asset-empty">' +
          esc(t("tools.billing.profileSignHint", "Sign on white paper and upload")) +
          '</span><input id="profile-signature" type="file" accept="image/png,image/jpeg,image/webp" /></label>' +
          '<label class="bill-asset-card"><span>' +
          esc(t("tools.billing.profileQr", "Payment QR")) +
          ' <em>' +
          esc(t("tools.billing.optional", "optional")) +
          "</em></span><img id=\"profile-qr-preview\" alt=\"\" hidden /><span id=\"profile-qr-preview-empty\" class=\"bill-asset-empty\">" +
          esc(t("tools.billing.profileQrHint", "Square UPI or payment QR, 1:1")) +
          '</span><input id="profile-qr" type="file" accept="image/png,image/jpeg,image/webp" /></label></div>' +
          "<h3>" +
          esc(t("tools.billing.profileBank", "Bank and UPI")) +
          "</h3>" +
          '<div class="bill-form-grid">' +
          '<div class="tool-field"><label for="profile-bank-name">' +
          esc(t("tools.billing.profileBankName", "Bank name")) +
          "</label>" +
          '<input id="profile-bank-name" type="text" maxlength="80" value="' +
          esc(biz.bankName || "") +
          '" /></div>' +
          '<div class="tool-field"><label for="profile-bank-holder">' +
          esc(t("tools.billing.profileBankHolder", "Account holder")) +
          "</label>" +
          '<input id="profile-bank-holder" type="text" maxlength="120" value="' +
          esc(biz.bankAccountName || "") +
          '" /></div>' +
          '<div class="tool-field"><label for="profile-bank-no">' +
          esc(t("tools.billing.profileBankNo", "Account number")) +
          "</label>" +
          '<input id="profile-bank-no" type="text" maxlength="24" value="' +
          esc(biz.bankAccountNumber || "") +
          '" /></div>' +
          '<div class="tool-field"><label for="profile-ifsc">' +
          esc(t("tools.billing.profileIfsc", "IFSC")) +
          "</label>" +
          '<input id="profile-ifsc" type="text" maxlength="11" value="' +
          esc(biz.bankIfsc || "") +
          '" /></div>' +
          '<div class="tool-field bill-span-2"><label for="profile-upi">' +
          esc(t("tools.billing.profileUpi", "UPI ID")) +
          "</label>" +
          '<input id="profile-upi" type="text" maxlength="80" value="' +
          esc(biz.upiId || "") +
          '" /></div></div>' +
          '<p class="billing-err" id="billing-error" role="alert"></p>' +
          '<div class="billing-actions"><button class="btn btn-primary" type="submit">' +
          esc(t("tools.billing.profileSave", "Save profile")) +
          "</button></div></form>";
        refreshProfileChecklist(biz.profile);
        if (biz.hasLogo) showProfileAsset("logo", "profile-logo-preview");
        if (biz.hasSignature) showProfileAsset("signature", "profile-sign-preview");
        if (biz.hasQr) showProfileAsset("qr", "profile-qr-preview");
        bindProfileAsset("logo", "profile-logo-preview");
        bindProfileAsset("signature", "profile-sign-preview");
        bindProfileAsset("qr", "profile-qr-preview");
        syncSessionProfile(Object.assign({ name: biz.name, gstin: biz.gstin }, biz.profile));
      })
      .catch(function (ex) {
        stage.innerHTML =
          settingsHead(
            "profile",
            t("tools.billing.profileLead", "Add the details printed on every invoice — address, logo, and signature."),
          ) +
          '<div class="bill-empty glass"><p>' +
          esc(ex.message) +
          "</p></div>";
      });
  }

  function sampleInvoiceFromBiz(biz) {
    var sellerState = biz && biz.stateCode ? String(biz.stateCode) : "";
    var buyerState = "27";
    var igst = sellerState && sellerState !== buyerState;
    return {
      invoiceNumber: "INV-0001",
      invoiceDate: new Date().toISOString().slice(0, 10),
      taxSplit: igst ? "igst" : "cgst_sgst",
      placeOfSupply: "Maharashtra",
      notes: t("tools.billing.invoiceSampleNote", "Sample invoice — not saved"),
      seller: {
        name: (biz && biz.name) || t("tools.billing.businessName", "Business name"),
        mobile: (biz && biz.mobile) || null,
        email: (biz && biz.email) || null,
        gstin: (biz && biz.gstin) || null,
        address: (biz && biz.address) || null,
        city: (biz && biz.city) || null,
        stateCode: (biz && biz.stateCode) || null,
        state: (biz && biz.state) || null,
        pincode: (biz && biz.pincode) || null,
      },
      customer: {
        name: "Sample Customer",
        mobile: "9876543210",
        email: null,
        gstin: "27AAAAA0000A1Z5",
        address: "12 MG Road",
        city: "Mumbai",
        stateCode: "27",
        state: "Maharashtra",
        pincode: "400001",
      },
      lines: [
        {
          name: "Notebook",
          hsnSac: "482010",
          qty: 2,
          unit: "pcs",
          rate: 100,
          gstRate: 18,
          lineTotal: 236,
          source: "catalog",
        },
        {
          name: "Delivery",
          hsnSac: "",
          qty: 1,
          unit: "nos",
          rate: 40,
          gstRate: 18,
          lineTotal: 47.2,
          source: "charge",
        },
      ],
      taxableTotal: 240,
      cgstTotal: igst ? 0 : 21.6,
      sgstTotal: igst ? 0 : 21.6,
      igstTotal: igst ? 43.2 : 0,
      cessTotal: 0,
      grandTotal: 283.2,
    };
  }

  function printerInfo(id) {
    var i = 0;
    for (i = 0; i < INVOICE_PRINTERS.length; i += 1) {
      if (INVOICE_PRINTERS[i].id === id) return INVOICE_PRINTERS[i];
    }
    return INVOICE_PRINTERS[0];
  }

  function syncPrintSettingsPreview() {
    var sheet = document.getElementById("inv-sheet");
    if (!sheet || !profileBiz) return;
    var choice = resolvePrintChoice(fieldVal("profile-template"), fieldVal("profile-printer"));
    invStudio.template = choice.template;
    invStudio.printer = choice.printer;
    invStudio.biz = profileBiz;
    invStudio.inv = sampleInvoiceFromBiz(profileBiz);
    renderInvoiceSheet();
    var cap = document.getElementById("inv-sample-caption");
    if (cap) {
      var tpl = invoiceTemplateInfo(choice.template);
      var prn = printerInfo(choice.printer);
      cap.textContent =
        t("tools.billing.invoiceTpl_" + tpl.id, tpl.name) +
        " · " +
        t("tools.billing.invoicePrinter_" + prn.id, prn.name) +
        " · " +
        prn.hint;
    }
  }

  function fillProfilePrinters(template, selected) {
    var sel = document.getElementById("profile-printer");
    if (!sel) return;
    var info = invoiceTemplateInfo(template);
    var choice = resolvePrintChoice(template, selected);
    sel.innerHTML = INVOICE_PRINTERS.filter(function (row) {
      return info.printers.indexOf(row.id) !== -1;
    })
      .map(function (row) {
        return (
          '<option value="' +
          row.id +
          '"' +
          (row.id === choice.printer ? " selected" : "") +
          ">" +
          esc(t("tools.billing.invoicePrinter_" + row.id, row.name)) +
          " — " +
          esc(row.hint) +
          "</option>"
        );
      })
      .join("");
  }

  function bindProfilePrintSelects(template, printer) {
    var tpl = document.getElementById("profile-template");
    var prn = document.getElementById("profile-printer");
    fillProfilePrinters(template || (tpl && tpl.value) || "classic", printer);
    if (tpl && !tpl._bound) {
      tpl._bound = true;
      tpl.addEventListener("change", function () {
        fillProfilePrinters(tpl.value, prn && prn.value);
        syncPrintSettingsPreview();
      });
    }
    if (prn && !prn._bound) {
      prn._bound = true;
      prn.addEventListener("change", function () {
        syncPrintSettingsPreview();
      });
    }
    syncPrintSettingsPreview();
  }

  function handleProfileSubmit() {
    var form = document.getElementById("bill-profile-form");
    var err = errBox();
    if (!form) return;
    if (err) err.textContent = "";
    var name = fieldVal("profile-name");
    if (name.length < 2) {
      var nameMsg = t("tools.billing.profileNameRequired", "Business name is required");
      if (err) err.textContent = nameMsg;
      toast(nameMsg, "err");
      return;
    }
    var email = fieldVal("profile-email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      var emailMsg = t("tools.billing.customerEmailInvalid", "Enter a valid email, or leave it blank");
      if (err) err.textContent = emailMsg;
      toast(emailMsg, "err");
      return;
    }
    var acct = fieldVal("profile-bank-no").replace(/\s+/g, "");
    if (acct && !/^\d{6,22}$/.test(acct)) {
      var acctMsg = t("tools.billing.profileBankNoInvalid", "Enter a valid account number, or leave it blank");
      if (err) err.textContent = acctMsg;
      toast(acctMsg, "err");
      return;
    }
    setBusy(form, true);
    api("/business", {
      method: "PATCH",
      body: {
        name: name,
        email: email || undefined,
        gstin: fieldVal("profile-gstin") || undefined,
        pan: fieldVal("profile-pan") || undefined,
        address: fieldVal("profile-address") || undefined,
        city: fieldVal("profile-city") || undefined,
        stateCode: fieldVal("profile-state") || undefined,
        pincode: fieldVal("profile-pincode") || undefined,
        bankName: fieldVal("profile-bank-name") || undefined,
        bankAccountName: fieldVal("profile-bank-holder") || undefined,
        bankAccountNumber: fieldVal("profile-bank-no") || undefined,
        bankIfsc: fieldVal("profile-ifsc") || undefined,
        upiId: fieldVal("profile-upi") || undefined,
        invoiceTemplate:
          fieldVal("profile-template") || (profileBiz && profileBiz.invoiceTemplate) || undefined,
        invoicePrinter:
          fieldVal("profile-printer") || (profileBiz && profileBiz.invoicePrinter) || undefined,
      },
    })
      .then(function (biz) {
        toast(t("tools.billing.profileSaved", "Profile saved"), "ok");
        profileBiz = biz;
        if (state.session && state.session.business) {
          state.session.business.invoiceTemplate = biz.invoiceTemplate;
          state.session.business.invoicePrinter = biz.invoicePrinter;
        }
        syncSessionProfile(Object.assign({ name: biz.name, gstin: biz.gstin }, biz.profile));
        refreshProfileChecklist(biz.profile);
      })
      .catch(function (ex) {
        var msg = ex.message || t("tools.billing.profileSaveFail", "Could not save profile");
        if (err) err.textContent = msg;
        toast(msg, "err");
      })
      .then(function () {
        setBusy(form, false);
      });
  }

  function businessPatchBody(biz, extra) {
    var body = {
      name: biz.name,
      email: biz.email || undefined,
      gstin: biz.gstin || undefined,
      pan: biz.pan || undefined,
      address: biz.address || undefined,
      city: biz.city || undefined,
      stateCode: biz.stateCode || undefined,
      pincode: biz.pincode || undefined,
      bankName: biz.bankName || undefined,
      bankAccountName: biz.bankAccountName || undefined,
      bankAccountNumber: biz.bankAccountNumber || undefined,
      bankIfsc: biz.bankIfsc || undefined,
      upiId: biz.upiId || undefined,
      invoiceTemplate: biz.invoiceTemplate || undefined,
      invoicePrinter: biz.invoicePrinter || undefined,
    };
    if (extra) {
      Object.keys(extra).forEach(function (key) {
        body[key] = extra[key];
      });
    }
    return body;
  }

  function printSettingsView() {
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    stage.innerHTML =
      settingsHead(
        "print",
        t(
          "tools.billing.profilePrintLead",
          "Used when you download or print a bill. You can still change it on each invoice.",
        ),
      ) +
      '<p class="tool-note">' +
      esc(t("tools.billing.profileLoading", "Loading profile…")) +
      "</p>";
    api("/business")
      .then(function (biz) {
        profileBiz = biz;
        var note = document.querySelector("#bill-stage > .tool-note");
        if (note) note.remove();
        stage.insertAdjacentHTML(
          "beforeend",
          '<div class="inv-sample-studio">' +
            '<form id="bill-print-form" class="bill-item-form glass" method="post" action="#" onsubmit="return false;">' +
            "<h3>" +
            esc(t("tools.billing.profilePrint", "Invoice print defaults")) +
            "</h3>" +
            '<p class="tool-note">' +
            esc(
              t(
                "tools.billing.invoiceSampleLead",
                "The sample updates when you change the template or printer. It is not a real invoice.",
              ),
            ) +
            "</p>" +
            '<div class="bill-form-grid">' +
            '<div class="tool-field"><label for="profile-template">' +
            esc(t("tools.billing.invoiceTemplate", "Invoice template")) +
            "</label>" +
            '<select id="profile-template">' +
            INVOICE_TEMPLATES.map(function (row) {
              return (
                '<option value="' +
                row.id +
                '"' +
                (biz.invoiceTemplate === row.id ? " selected" : "") +
                ">" +
                esc(t("tools.billing.invoiceTpl_" + row.id, row.name)) +
                "</option>"
              );
            }).join("") +
            "</select></div>" +
            '<div class="tool-field"><label for="profile-printer">' +
            esc(t("tools.billing.invoicePrinter", "Printer")) +
            '</label><select id="profile-printer"></select></div></div>' +
            '<p class="billing-err" id="billing-error" role="alert"></p>' +
            '<div class="billing-actions"><button class="btn btn-primary" type="submit">' +
            esc(t("tools.billing.invoiceSavePrint", "Save as default")) +
            "</button></div></form>" +
            '<div class="inv-preview inv-sample-preview">' +
            '<p class="inv-sample-badge">' +
            esc(t("tools.billing.invoiceSample", "Sample")) +
            '</p><p class="inv-sample-caption" id="inv-sample-caption"></p>' +
            '<div id="inv-sheet" class="inv-sheet"></div></div></div>',
        );
        invStudio.biz = biz;
        invStudio.inv = sampleInvoiceFromBiz(biz);
        loadBrandAssets().then(function () {
          bindProfilePrintSelects(biz.invoiceTemplate, biz.invoicePrinter);
        });
        syncSessionProfile(Object.assign({ name: biz.name, gstin: biz.gstin }, biz.profile));
      })
      .catch(function (ex) {
        stage.innerHTML =
          settingsHead(
            "print",
            t(
              "tools.billing.profilePrintLead",
              "Used when you download or print a bill. You can still change it on each invoice.",
            ),
          ) +
          '<div class="bill-empty glass"><p>' +
          esc(ex.message) +
          "</p></div>";
      });
  }

  function handlePrintSettingsSubmit() {
    var form = document.getElementById("bill-print-form");
    var err = errBox();
    if (!form || !profileBiz) return;
    if (err) err.textContent = "";
    setBusy(form, true);
    api("/business", {
      method: "PATCH",
      body: businessPatchBody(profileBiz, {
        invoiceTemplate: fieldVal("profile-template") || undefined,
        invoicePrinter: fieldVal("profile-printer") || undefined,
      }),
    })
      .then(function (biz) {
        profileBiz = biz;
        if (state.session && state.session.business) {
          state.session.business.invoiceTemplate = biz.invoiceTemplate;
          state.session.business.invoicePrinter = biz.invoicePrinter;
        }
        toast(t("tools.billing.invoicePrintSaved", "Saved as default print layout"));
      })
      .catch(function (ex) {
        var msg = ex.message || t("tools.billing.profileSaveFail", "Could not save profile");
        if (err) err.textContent = msg;
        toast(msg, "err");
      })
      .then(function () {
        setBusy(form, false);
      });
  }

  function settingsView(sub) {
    if (!sub || sub === "profile") {
      if (!sub) {
        go("app/settings/profile");
        return;
      }
      profileView();
      return;
    }
    if (sub === "print") {
      printSettingsView();
      return;
    }
    go("app/settings/profile");
  }

  function appView(tab, screen, extra) {
    var s = state.session;
    if (!s) return;
    tab = tab || "home";
    fillDrawer(tab === "new" ? "items" : tab);
    bindDrawerOnce();
    setDrawer(drawerOpen());
    var stage = document.getElementById("bill-stage");
    if (!stage) return;
    if (tab === "items" && screen === "new") {
      itemFormView();
      return;
    }
    if (tab === "items") {
      itemsListView(screen);
      return;
    }
    if (tab === "customers" && screen === "new") {
      customerFormView();
      return;
    }
    if (tab === "customers") {
      customersListView(screen);
      return;
    }
    if (tab === "invoices" && screen === "new") {
      invoiceFormView();
      return;
    }
    if (tab === "invoices" && isObjectId(screen) && extra === "edit") {
      invoiceFormView(screen);
      return;
    }
    if (tab === "invoices" && isObjectId(screen)) {
      invoiceDetailView(screen);
      return;
    }
    if (tab === "invoices") {
      invoicesListView(screen);
      return;
    }
    if (tab === "profile") {
      go("app/settings/profile");
      return;
    }
    if (tab === "settings") {
      settingsView(screen);
      return;
    }
    stage.innerHTML = tabPanel(tab, s);
  }

  function render() {
    paint(view());
  }

  function finishBoot() {
    state.boot = false;
    document.documentElement.classList.remove("billing-boot");
    paint(view());
  }

  function restoreSession() {
    api("/auth/me", { timeout: 5000 })
      .then(function (session) {
        if (!session) return;
        state.session = session;
        if (session.needsOnboarding) {
          if (view().page !== "onboarding") go("onboarding");
          return;
        }
        if (view().page !== "app") go("app");
      })
      .catch(function () {
        /* no cookie — show login after boot */
      })
      .then(function () {
        finishBoot();
      });
  }

  function paint(route) {
    if (typeof route === "string") route = { page: route, tab: "home" };
    var name = route.page;
    if (state.boot && name !== "app") {
      setChrome("boot");
      return;
    }
    setChrome(name);
    if (state.session && !state.session.needsOnboarding && name !== "app") {
      go("app");
      return;
    }
    if (state.session && state.session.needsOnboarding && name !== "onboarding") {
      go("onboarding");
      return;
    }
    if (!state.session && name === "app") {
      go("login");
      return;
    }
    if (!state.session && name === "onboarding") {
      go("login");
      return;
    }
    if (name === "onboarding") onboardingView();
    else if (name === "app") appView(route.tab, route.screen, route.extra);
    else if (name === "otp" && state.mobile) otpView();
    else phoneView();
    if (window.I18n && window.I18n.apply) window.I18n.apply();
  }

  window.addEventListener("hashchange", function () {
    render();
  });
  document.addEventListener("i18n:changed", function () {
    render();
  });

  function initCarousel() {
    var root = document.getElementById("billing-carousel");
    if (!root || root._booted) return;
    root._booted = true;
    var slides = Array.prototype.slice.call(root.querySelectorAll(".billing-slide"));
    var dots = Array.prototype.slice.call(root.querySelectorAll("[data-carousel-dot]"));
    if (slides.length < 2) return;
    var i = 0;
    var timer = 0;
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function show(next) {
      i = (next + slides.length) % slides.length;
      slides.forEach(function (slide, idx) {
        slide.classList.toggle("is-active", idx === i);
      });
      dots.forEach(function (dot, idx) {
        dot.classList.toggle("is-on", idx === i);
        dot.setAttribute("aria-current", idx === i ? "true" : "false");
      });
    }

    function play() {
      if (reduced) return;
      clearInterval(timer);
      timer = setInterval(function () {
        show(i + 1);
      }, 4200);
    }

    var prev = root.querySelector("[data-carousel-prev]");
    var next = root.querySelector("[data-carousel-next]");
    if (prev) prev.addEventListener("click", function () { show(i - 1); play(); });
    if (next) next.addEventListener("click", function () { show(i + 1); play(); });
    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        show(Number(dot.getAttribute("data-carousel-dot")) || 0);
        play();
      });
    });
    root.addEventListener("pointerenter", function () { clearInterval(timer); });
    root.addEventListener("pointerleave", play);
    show(0);
    play();
  }

  try {
    state.mobile = sessionStorage.getItem("billing_mobile") || "";
  } catch (_) {}
  restoreSession();
  initCarousel();
})();
