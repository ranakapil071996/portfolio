/**
 * Billing tool — mobile OTP login + business onboarding.
 * Lives at /tools/billing/ and talks to same-origin /api.
 */
(function () {
  "use strict";

  var mount = document.getElementById("billing-app");
  if (!mount) return;

  var toastEl = document.getElementById("toast");
  var state = { mobile: "", session: null };

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

  function toast(msg) {
    if (!toastEl) return;
    toastEl.hidden = false;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.classList.remove("show");
      toastEl.hidden = true;
    }, 2600);
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
        ...(opts && opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
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
      return { page: "app", tab: parts[1] || "home", screen: parts[2] || "" };
    }
    if (parts[0] === "otp") return { page: "otp", tab: "home" };
    return { page: "login", tab: "home" };
  }

  function go(name) {
    var next = name.indexOf("#") === 0 ? name : "#" + name;
    if (location.hash !== next) location.hash = next;
  }

  function setChrome(page) {
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
        form.id !== "bill-item-form"
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (form.id === "bill-phone-form") handlePhoneSubmit();
      else if (form.id === "bill-otp-form") handleOtpSubmit();
      else if (form.id === "bill-item-form") handleItemSubmit();
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

  function tabPanel(tab, s) {
    var biz = s && s.business;
    if (tab === "home") {
      return (
        '<header class="bill-stage-head"><h2>' +
        esc(t("tools.billing.tabHome", "Home")) +
        "</h2><p>" +
        esc(t("tools.billing.signedIn", "Overview of this business. Use the sidebar to open invoices, customers, and more.")) +
        "</p></header>" +
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

  function fillDrawer(tab) {
    var list = document.getElementById("bill-tab-list");
    if (!list) return;
    list.innerHTML = TABS.map(function (item) {
      var on = item.id === tab || (tab === "items" && item.id === "items");
      return (
        '<a class="bill-tab' +
        (on ? " is-on" : "") +
        '" href="#app' +
        (item.id === "home" ? "" : "/" + item.id) +
        '" data-tab="' +
        item.id +
        '" title="' +
        esc(t(item.key, item.label)) +
        '"><span class="bill-tab-ico" aria-hidden="true">' +
        ICO[item.icon] +
        '</span><span class="bill-drawer-label">' +
        esc(t(item.key, item.label)) +
        "</span></a>"
      );
    }).join("");
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

  function appView(tab, screen) {
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
    stage.innerHTML = tabPanel(tab, s);
  }

  function render() {
    paint(view());
  }

  function restoreSession() {
    api("/auth/me", { timeout: 5000 })
      .then(function (session) {
        if (!session || session.needsOnboarding) return;
        state.session = session;
        if (view().page !== "app") go("app");
        else paint(view());
      })
      .catch(function () {
        /* stay on the login form */
      });
  }

  function paint(route) {
    if (typeof route === "string") route = { page: route, tab: "home" };
    var name = route.page;
    setChrome(name);
    if (state.session && !state.session.needsOnboarding && name !== "app") {
      go("app");
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
    else if (name === "app") appView(route.tab, route.screen);
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
  render();
  restoreSession();
  initCarousel();
})();
