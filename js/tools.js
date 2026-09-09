/**
 * Finance tools — hub + EMI / SIP / GST calculators.
 */
(function () {
  "use strict";

  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.from((r || document).querySelectorAll(s));
  };

  function t(key, fallback) {
    if (window.I18n && window.I18n.getDict()) {
      var v = window.I18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback == null ? key : fallback;
  }

  function lang() {
    if (window.I18n && window.I18n.getLang) return window.I18n.getLang() || "en";
    return window.__LANG || "en";
  }

  function localeTag() {
    var map = { en: "en-IN", hi: "hi-IN", de: "de-DE", fr: "fr-FR", es: "es-ES", ja: "ja-JP", ar: "ar-IN" };
    return map[lang()] || "en-IN";
  }

  function money(n, digits) {
    if (!isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat(localeTag(), {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: digits == null ? 0 : digits,
        minimumFractionDigits: digits == null ? 0 : digits,
      }).format(n);
    } catch (e) {
      return "₹" + Math.round(n).toLocaleString("en-IN");
    }
  }

  function num(n, digits) {
    if (!isFinite(n)) return "—";
    try {
      return new Intl.NumberFormat(localeTag(), {
        maximumFractionDigits: digits == null ? 2 : digits,
        minimumFractionDigits: 0,
      }).format(n);
    } catch (e) {
      return String(n);
    }
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  function parseInput(el, min, max, fallback) {
    if (!el) return fallback;
    var raw = String(el.value || "").replace(/,/g, "").trim();
    var n = parseFloat(raw);
    if (!isFinite(n)) return fallback;
    return clamp(n, min, max);
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function token(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function paintRange(el) {
    if (!el) return;
    var min = parseFloat(el.min);
    var max = parseFloat(el.max);
    var val = parseFloat(el.value);
    if (!isFinite(min) || !isFinite(max) || max === min) return;
    el.style.setProperty("--range-pct", ((clamp(val, min, max) - min) / (max - min)) * 100 + "%");
  }

  function pop(el) {
    if (!el || reducedMotion()) return;
    el.classList.remove("is-pop");
    void el.offsetWidth;
    el.classList.add("is-pop");
  }

  function countTo(el, next, fmt) {
    if (!el) return;
    var from = el._n;
    if (from == null || !isFinite(from)) from = next;
    el._n = next;
    if (reducedMotion() || Math.abs(next - from) < 0.5) {
      el.textContent = fmt(next);
      return;
    }
    if (el._raf) cancelAnimationFrame(el._raf);
    var start = performance.now();
    var dur = 420;
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (next - from) * eased);
      if (p < 1) el._raf = requestAnimationFrame(frame);
    }
    el._raf = requestAnimationFrame(frame);
  }

  function svgEl(name, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.keys(attrs || {}).forEach(function (k) {
      n.setAttribute(k, attrs[k]);
    });
    return n;
  }

  function renderDonut(svg, slices) {
    if (!svg) return;
    var animate = !svg._booted && !reducedMotion();
    svg._booted = true;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var total = slices.reduce(function (s, x) { return s + Math.max(0, x.value); }, 0);
    var cx = 60;
    var cy = 60;
    var r = 42;
    var C = 2 * Math.PI * r;
    svg.appendChild(
      svgEl("circle", {
        cx: cx,
        cy: cy,
        r: r,
        fill: "none",
        stroke: token("--level-track", "rgba(148,163,184,0.2)"),
        "stroke-width": 14,
      })
    );
    if (total <= 0) return;
    var offset = 0;
    slices.forEach(function (slice) {
      if (slice.value <= 0) return;
      var len = (slice.value / total) * C;
      var c = svgEl("circle", {
        cx: cx,
        cy: cy,
        r: r,
        fill: "none",
        stroke: slice.color,
        "stroke-width": 14,
        "stroke-linecap": "butt",
        "stroke-dasharray": len + " " + (C - len),
        "stroke-dashoffset": String(-offset),
        transform: "rotate(-90 " + cx + " " + cy + ")",
      });
      if (animate) {
        c.style.strokeDasharray = "0 " + C;
        requestAnimationFrame(function () {
          c.style.transition = "stroke-dasharray 0.55s cubic-bezier(0.22, 1, 0.36, 1)";
          c.style.strokeDasharray = len + " " + (C - len);
        });
      }
      svg.appendChild(c);
      offset += len;
    });
  }

  function renderLineChart(svg, series, tip) {
    if (!svg) return;
    var animate = !svg._booted && !reducedMotion();
    svg._booted = true;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = 360;
    var H = 180;
    var pad = { l: 8, r: 10, t: 14, b: 28 };
    var n = 0;
    series.forEach(function (s) {
      n = Math.max(n, (s.points || []).length);
    });
    if (n < 2) return;
    var max = 0;
    series.forEach(function (s) {
      (s.points || []).forEach(function (v) {
        if (v > max) max = v;
      });
    });
    if (max <= 0) max = 1;
    var innerW = W - pad.l - pad.r;
    var innerH = H - pad.t - pad.b;
    function x(i) {
      return pad.l + (i / (n - 1)) * innerW;
    }
    function y(v) {
      return pad.t + innerH - (v / max) * innerH;
    }
    var grid = token("--border", "rgba(148,163,184,0.2)");
    var muted = token("--text-dim", "#64748b");
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var gy = y(max * f);
      svg.appendChild(svgEl("line", { x1: pad.l, x2: W - pad.r, y1: gy, y2: gy, stroke: grid, "stroke-width": 1 }));
    });
    series.forEach(function (s) {
      var pts = s.points || [];
      var d = pts
        .map(function (v, i) {
          return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1);
        })
        .join(" ");
      if (s.fill) {
        var area =
          d +
          " L" +
          x(pts.length - 1).toFixed(1) +
          " " +
          y(0).toFixed(1) +
          " L" +
          x(0).toFixed(1) +
          " " +
          y(0).toFixed(1) +
          " Z";
        svg.appendChild(svgEl("path", { d: area, fill: s.fill, "fill-opacity": "0.22", stroke: "none" }));
      }
      var path = svgEl("path", {
        d: d,
        fill: "none",
        stroke: s.color,
        "stroke-width": 2.4,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      if (animate) {
        var len = 900;
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len);
        requestAnimationFrame(function () {
          path.style.transition = "stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)";
          path.style.strokeDashoffset = "0";
        });
      }
      svg.appendChild(path);
    });
    var step = n > 16 ? Math.ceil(n / 6) : n > 8 ? 2 : 1;
    for (var i = 0; i < n; i += step) {
      var label = svgEl("text", {
        x: x(i),
        y: H - 8,
        fill: muted,
        "font-size": "9",
        "text-anchor": "middle",
      });
      label.textContent = String(i + 1);
      svg.appendChild(label);
    }
    var hover = svgEl("line", {
      x1: 0,
      x2: 0,
      y1: pad.t,
      y2: H - pad.b,
      stroke: token("--accent", "#60a5fa"),
      "stroke-width": 1,
      "stroke-dasharray": "3 3",
      opacity: 0,
    });
    svg.appendChild(hover);
    var dots = series.map(function (s) {
      var c = svgEl("circle", { r: 4, fill: s.color, stroke: token("--bg", "#050816"), "stroke-width": 2, opacity: 0 });
      svg.appendChild(c);
      return c;
    });
    var hit = svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "transparent" });
    svg.appendChild(hit);
    function nearest(evt) {
      var box = svg.getBoundingClientRect();
      var px = ((evt.clientX - box.left) / box.width) * W;
      var idx = Math.round(((px - pad.l) / innerW) * (n - 1));
      return clamp(idx, 0, n - 1);
    }
    function show(evt) {
      var idx = nearest(evt);
      var xi = x(idx);
      hover.setAttribute("x1", xi);
      hover.setAttribute("x2", xi);
      hover.setAttribute("opacity", "1");
      var lines = ["Y" + (idx + 1)];
      series.forEach(function (s, si) {
        var v = s.points[idx] || 0;
        dots[si].setAttribute("cx", xi);
        dots[si].setAttribute("cy", y(v));
        dots[si].setAttribute("opacity", "1");
        lines.push(s.name + ": " + money(v, 0));
      });
      if (tip) {
        tip.hidden = false;
        tip.innerHTML = lines.join("<br>");
        var box = svg.getBoundingClientRect();
        tip.style.left = ((xi / W) * box.width) + "px";
        tip.style.top = "18px";
      }
      var table = svg.closest(".tool-card-out");
      if (table) {
        var rows = table.querySelectorAll("tbody tr");
        rows.forEach(function (row, ri) {
          row.classList.toggle("is-hot", ri === idx);
        });
      }
    }
    function hide() {
      hover.setAttribute("opacity", "0");
      dots.forEach(function (d) { d.setAttribute("opacity", "0"); });
      if (tip) tip.hidden = true;
      var table = svg.closest(".tool-card-out");
      if (table) table.querySelectorAll("tbody tr").forEach(function (row) { row.classList.remove("is-hot"); });
    }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerleave", hide);
  }

  function renderStack(svg, parts) {
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var total = parts.reduce(function (s, p) { return s + Math.max(0, p.value); }, 0) || 1;
    var x0 = 16;
    var y0 = 36;
    var w = 328;
    var h = 36;
    var radius = h / 2;
    var clipId = "gst-stack-clip";
    var defs = svgEl("defs");
    var clip = svgEl("clipPath", { id: clipId });
    clip.appendChild(svgEl("rect", { x: x0, y: y0, width: w, height: h, rx: radius, ry: radius }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    svg.appendChild(
      svgEl("rect", {
        x: x0,
        y: y0,
        width: w,
        height: h,
        rx: radius,
        ry: radius,
        fill: token("--level-track", "rgba(148,163,184,0.2)"),
      })
    );
    var group = svgEl("g", { "clip-path": "url(#" + clipId + ")" });
    var x = x0;
    parts.forEach(function (p) {
      var ww = (Math.max(0, p.value) / total) * w;
      group.appendChild(
        svgEl("rect", {
          x: x,
          y: y0,
          width: Math.max(ww, 0),
          height: h,
          fill: p.color,
        })
      );
      if (ww > 48) {
        var lab = svgEl("text", {
          x: x + ww / 2,
          y: y0 + 23,
          fill: p.ink || "#0b1224",
          "font-size": "11",
          "font-weight": "700",
          "text-anchor": "middle",
        });
        lab.textContent = p.label;
        group.appendChild(lab);
      }
      x += ww;
    });
    svg.appendChild(group);
  }

  function paintLegend(host, items) {
    if (!host) return;
    host.innerHTML = items
      .map(function (item) {
        return (
          '<span><i class="tool-swatch" style="background:' +
          item.color +
          '"></i>' +
          item.label +
          "</span>"
        );
      })
      .join("");
  }

  /* ---------- Math ---------- */
  function calcEmi(principal, annualPct, months) {
    var P = clamp(principal, 0, 1e12);
    var n = Math.max(1, Math.round(months));
    var r = clamp(annualPct, 0, 100) / 12 / 100;
    var emi;
    if (r === 0) emi = P / n;
    else {
      var pow = Math.pow(1 + r, n);
      emi = (P * r * pow) / (pow - 1);
    }
    var total = emi * n;
    var interest = total - P;
    var rows = [];
    var bal = P;
    var yearP = 0;
    var yearI = 0;
    var y = 1;
    for (var m = 1; m <= n; m++) {
      var iPart = bal * r;
      var pPart = emi - iPart;
      if (pPart > bal) pPart = bal;
      bal = Math.max(0, bal - pPart);
      yearP += pPart;
      yearI += iPart;
      if (m % 12 === 0 || m === n) {
        rows.push({ year: y, principal: yearP, interest: yearI, balance: bal });
        yearP = 0;
        yearI = 0;
        y += 1;
      }
    }
    return { emi: emi, principal: P, interest: interest, total: total, months: n, years: rows };
  }

  function calcSip(pmt, annualPct, months) {
    var P = clamp(pmt, 0, 1e9);
    var n = Math.max(1, Math.round(months));
    var i = clamp(annualPct, 0, 100) / 12 / 100;
    var fv;
    if (i === 0) fv = P * n;
    else fv = P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    var invested = P * n;
    var rows = [];
    for (var y = 1; y <= Math.ceil(n / 12); y++) {
      var m = Math.min(n, y * 12);
      var val = i === 0 ? P * m : P * ((Math.pow(1 + i, m) - 1) / i) * (1 + i);
      rows.push({ year: y, invested: P * m, value: val, gain: val - P * m });
    }
    return { fv: fv, invested: invested, gain: fv - invested, months: n, years: rows };
  }

  function calcGst(amount, rate, inclusive, inter) {
    var A = clamp(amount, 0, 1e12);
    var r = clamp(rate, 0, 100);
    var base;
    var gst;
    var total;
    if (inclusive) {
      total = A;
      base = r === 0 ? A : A / (1 + r / 100);
      gst = total - base;
    } else {
      base = A;
      gst = (A * r) / 100;
      total = base + gst;
    }
    if (inter) return { base: base, gst: gst, total: total, cgst: 0, sgst: 0, igst: gst, rate: r, inclusive: inclusive, inter: true };
    return { base: base, gst: gst, total: total, cgst: gst / 2, sgst: gst / 2, igst: 0, rate: r, inclusive: inclusive, inter: false };
  }

  /* ---------- Theme (same contract as main.js) ---------- */
  function bindTheme() {
    var themeToggle = $("#theme-toggle");
    var metaTheme = $("#meta-theme-color");
    function getTheme() {
      return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    }
    function applyTheme(theme) {
      var next = theme === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (_) {}
      if (metaTheme) metaTheme.setAttribute("content", next === "light" ? "#eef2f7" : "#050816");
      if (themeToggle) {
        var aria =
          next === "light"
            ? t("nav.themeDark", "Switch to dark mode")
            : t("nav.themeLight", "Switch to light mode");
        themeToggle.setAttribute("aria-label", aria);
        themeToggle.title = aria;
      }
      window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
    }
    applyTheme(getTheme());
    if (themeToggle) {
      themeToggle.addEventListener("click", function () {
        applyTheme(getTheme() === "light" ? "dark" : "light");
      });
    }
    window.addEventListener("themechange", function () {
      document.dispatchEvent(new CustomEvent("tools:recalc"));
    });
    var nav = $("#nav");
    if (nav) {
      function onScrollNav() {
        nav.classList.toggle("scrolled", window.scrollY > 8);
      }
      window.addEventListener("scroll", onScrollNav, { passive: true });
      onScrollNav();
    }
    var navLinks = $("#nav-links");
    var navToggle = $("#nav-toggle");
    if (navToggle && navLinks) {
      function setMenuOpen(open) {
        navLinks.classList.toggle("open", open);
        navToggle.setAttribute("aria-expanded", open ? "true" : "false");
        navToggle.setAttribute("aria-label", open ? t("nav.menuClose", "Close menu") : t("nav.menuOpen", "Open menu"));
        document.body.classList.toggle("nav-open", open);
      }
      navToggle.addEventListener("click", function () {
        setMenuOpen(!navLinks.classList.contains("open"));
      });
      navLinks.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          setMenuOpen(false);
        });
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && navLinks.classList.contains("open")) {
          e.preventDefault();
          setMenuOpen(false);
        }
      });
    }
  }

  function applyToolHead() {
    var id = window.__TOOL_ID || "hub";
    var prefix = id === "hub" ? "tools.hub" : "tools." + id;
    var title = t(prefix + ".metaTitle", document.title);
    var desc = t(prefix + ".metaDescription", "");
    if (title) document.title = title;
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && desc) metaDesc.setAttribute("content", desc);
    var ogTitle = document.getElementById("og-title");
    if (ogTitle) ogTitle.setAttribute("content", t(prefix + ".ogTitle", title));
    var ogDesc = document.getElementById("og-description");
    if (ogDesc) ogDesc.setAttribute("content", t(prefix + ".ogDescription", desc));
    var twTitle = document.getElementById("twitter-title");
    if (twTitle) twTitle.setAttribute("content", t(prefix + ".ogTitle", title));
    var twDesc = document.getElementById("twitter-description");
    if (twDesc) twDesc.setAttribute("content", t(prefix + ".ogDescription", desc));
    try {
      if (location.protocol.indexOf("http") === 0) {
        var path = location.pathname.replace(/index\.html$/, "");
        if (!path.endsWith("/")) path += "/";
        var pageUrl = location.origin + path;
        var canon = document.getElementById("canonical-link");
        if (canon) canon.setAttribute("href", pageUrl);
        var ogUrl = document.getElementById("og-url");
        if (ogUrl) ogUrl.setAttribute("content", pageUrl);
        document.querySelectorAll("link[data-i18n-hreflang]").forEach(function (n) {
          n.remove();
        });
        var langs = (window.I18n && window.I18n.SUPPORTED) || ["en", "de", "fr", "es", "ja", "ar", "hi"];
        langs.forEach(function (code) {
          var link = document.createElement("link");
          link.rel = "alternate";
          link.hreflang = code;
          link.href = pageUrl + "?lang=" + code;
          link.setAttribute("data-i18n-hreflang", code);
          document.head.appendChild(link);
        });
        var xdef = document.createElement("link");
        xdef.rel = "alternate";
        xdef.hreflang = "x-default";
        xdef.href = pageUrl;
        xdef.setAttribute("data-i18n-hreflang", "x-default");
        document.head.appendChild(xdef);
      }
    } catch (e) {}
  }

  function writeParams(map) {
    try {
      var url = new URL(location.href);
      Object.keys(map).forEach(function (k) {
        url.searchParams.set(k, String(map[k]));
      });
      history.replaceState(null, "", url);
    } catch (e) {}
  }

  function param(name, fallback) {
    try {
      var v = new URLSearchParams(location.search).get(name);
      if (v == null || v === "") return fallback;
      var n = parseFloat(v);
      return isFinite(n) ? n : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function paramStr(name, fallback) {
    try {
      var v = new URLSearchParams(location.search).get(name);
      return v == null || v === "" ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function fillTable(tbody, rows, cols) {
    if (!tbody) return;
    tbody.innerHTML = rows
      .map(function (row) {
        return (
          "<tr>" +
          cols
            .map(function (col) {
              return "<td>" + col(row) + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
  }

  /* ---------- EMI ---------- */
  function bindEmi() {
    var amount = $("#emi-amount");
    var rate = $("#emi-rate");
    var years = $("#emi-years");
    var months = $("#emi-months");
    var amountRange = $("#emi-amount-range");
    var rateRange = $("#emi-rate-range");
    var yearsRange = $("#emi-years-range");
    if (!amount || !rate || !years) return;

    if (param("p", null) != null) amount.value = String(param("p", 1000000));
    if (param("r", null) != null) rate.value = String(param("r", 8.5));
    if (param("y", null) != null) years.value = String(param("y", 20));
    if (param("m", null) != null && months) months.value = String(param("m", 0));

    function syncRanges() {
      if (amountRange) amountRange.value = String(clamp(parseFloat(amount.value) || 0, 10000, 20000000));
      if (rateRange) rateRange.value = String(clamp(parseFloat(rate.value) || 0, 0, 24));
      if (yearsRange) yearsRange.value = String(clamp(parseFloat(years.value) || 1, 1, 40));
    }

    function run() {
      var P = parseInput(amount, 0, 1e12, 0);
      var R = parseInput(rate, 0, 100, 0);
      var Y = parseInput(years, 0, 40, 0);
      var extra = months ? parseInput(months, 0, 11, 0) : 0;
      var n = Math.max(1, Math.round(Y * 12 + extra));
      var res = calcEmi(P, R, n);
      countTo($("#emi-result"), res.emi, function (v) { return money(v, 0); });
      pop($("#emi-result"));
      countTo($("#emi-interest"), res.interest, function (v) { return money(v, 0); });
      countTo($("#emi-total"), res.total, function (v) { return money(v, 0); });
      countTo($("#emi-principal-out"), res.principal, function (v) { return money(v, 0); });
      var pi = res.total > 0 ? (res.principal / res.total) * 100 : 0;
      var ii = res.total > 0 ? (res.interest / res.total) * 100 : 0;
      setText("emi-result-sub", t("tools.common.perMonth", "every month") + " · " + num(Y || n / 12, 1) + " " + t("tools.emi.years", "years"));
      setText("emi-donut-label", num(pi, 0) + "%");
      var cPri = token("--accent", "#60a5fa");
      var cInt = token("--accent-2", "#a78bfa");
      renderDonut($("#emi-donut"), [
        { value: res.principal, color: cPri },
        { value: Math.max(0, res.interest), color: cInt },
      ]);
      paintLegend($("#emi-legend"), [
        { color: cPri, label: t("tools.emi.principal", "Principal") + " · " + num(pi, 1) + "%" },
        { color: cInt, label: t("tools.emi.interest", "Interest") + " · " + num(ii, 1) + "%" },
      ]);
      renderLineChart(
        $("#emi-chart"),
        [
          {
            name: t("tools.emi.balance", "Balance"),
            color: cPri,
            fill: cPri,
            points: res.years.map(function (row) { return row.balance; }),
          },
        ],
        $("#emi-tip")
      );
      fillTable($("#emi-schedule tbody"), res.years, [
        function (row) {
          return String(row.year);
        },
        function (row) {
          return money(row.principal, 0);
        },
        function (row) {
          return money(row.interest, 0);
        },
        function (row) {
          return money(row.balance, 0);
        },
      ]);
      writeParams({ p: P, r: R, y: Y, m: extra });
      syncRanges();
      [amountRange, rateRange, yearsRange].forEach(paintRange);
    }

    ["input", "change"].forEach(function (ev) {
      [amount, rate, years, months].forEach(function (el) {
        if (el) el.addEventListener(ev, run);
      });
    });
    if (amountRange)
      amountRange.addEventListener("input", function () {
        amount.value = amountRange.value;
        run();
      });
    if (rateRange)
      rateRange.addEventListener("input", function () {
        rate.value = rateRange.value;
        run();
      });
    if (yearsRange)
      yearsRange.addEventListener("input", function () {
        years.value = yearsRange.value;
        run();
      });
    var reset = $("#emi-reset");
    if (reset)
      reset.addEventListener("click", function () {
        amount.value = "1000000";
        rate.value = "8.5";
        years.value = "20";
        if (months) months.value = "0";
        run();
      });
    document.addEventListener("tools:recalc", run);
    run();
  }

  /* ---------- SIP ---------- */
  function bindSip() {
    var pmt = $("#sip-amount");
    var rate = $("#sip-rate");
    var years = $("#sip-years");
    var pmtRange = $("#sip-amount-range");
    var rateRange = $("#sip-rate-range");
    var yearsRange = $("#sip-years-range");
    if (!pmt || !rate || !years) return;

    if (param("p", null) != null) pmt.value = String(param("p", 10000));
    if (param("r", null) != null) rate.value = String(param("r", 12));
    if (param("y", null) != null) years.value = String(param("y", 15));

    function run() {
      var P = parseInput(pmt, 0, 1e9, 0);
      var R = parseInput(rate, 0, 100, 0);
      var Y = parseInput(years, 1, 50, 1);
      var res = calcSip(P, R, Y * 12);
      countTo($("#sip-value"), res.fv, function (v) { return money(v, 0); });
      pop($("#sip-value"));
      countTo($("#sip-invested"), res.invested, function (v) { return money(v, 0); });
      countTo($("#sip-gain"), res.gain, function (v) { return money(v, 0); });
      var invPct = res.fv > 0 ? (res.invested / res.fv) * 100 : 0;
      var gainPct = res.fv > 0 ? (res.gain / res.fv) * 100 : 0;
      setText("sip-result-sub", num(Y) + " " + t("tools.sip.years", "years") + " · " + num(gainPct, 1) + "% " + t("tools.sip.gain", "returns"));
      setText("sip-donut-label", num(gainPct, 0) + "%");
      var cInv = token("--accent", "#60a5fa");
      var cGain = token("--accent-3", "#34d399");
      renderDonut($("#sip-donut"), [
        { value: res.invested, color: cInv },
        { value: Math.max(0, res.gain), color: cGain },
      ]);
      paintLegend($("#sip-legend"), [
        { color: cInv, label: t("tools.sip.invested", "Invested") + " · " + num(invPct, 1) + "%" },
        { color: cGain, label: t("tools.sip.gain", "Est. returns") + " · " + num(gainPct, 1) + "%" },
      ]);
      renderLineChart(
        $("#sip-chart"),
        [
          {
            name: t("tools.sip.invested", "Invested"),
            color: cInv,
            fill: cInv,
            points: res.years.map(function (row) { return row.invested; }),
          },
          {
            name: t("tools.sip.resultLabel", "Value"),
            color: cGain,
            fill: cGain,
            points: res.years.map(function (row) { return row.value; }),
          },
        ],
        $("#sip-tip")
      );
      fillTable($("#sip-schedule tbody"), res.years, [
        function (row) {
          return String(row.year);
        },
        function (row) {
          return money(row.invested, 0);
        },
        function (row) {
          return money(row.gain, 0);
        },
        function (row) {
          return money(row.value, 0);
        },
      ]);
      if (pmtRange) pmtRange.value = String(clamp(P, 500, 200000));
      if (rateRange) rateRange.value = String(clamp(R, 1, 30));
      if (yearsRange) yearsRange.value = String(clamp(Y, 1, 40));
      [pmtRange, rateRange, yearsRange].forEach(paintRange);
      writeParams({ p: P, r: R, y: Y });
    }

    ["input", "change"].forEach(function (ev) {
      [pmt, rate, years].forEach(function (el) {
        el.addEventListener(ev, run);
      });
    });
    if (pmtRange)
      pmtRange.addEventListener("input", function () {
        pmt.value = pmtRange.value;
        run();
      });
    if (rateRange)
      rateRange.addEventListener("input", function () {
        rate.value = rateRange.value;
        run();
      });
    if (yearsRange)
      yearsRange.addEventListener("input", function () {
        years.value = yearsRange.value;
        run();
      });
    var reset = $("#sip-reset");
    if (reset)
      reset.addEventListener("click", function () {
        pmt.value = "10000";
        rate.value = "12";
        years.value = "15";
        run();
      });
    document.addEventListener("tools:recalc", run);
    run();
  }

  /* ---------- GST ---------- */
  function bindGst() {
    var amount = $("#gst-amount");
    var rate = $("#gst-rate");
    var chips = $$("[data-gst-rate]");
    var modeBtns = $$("[data-gst-mode]");
    var splitBtns = $$("[data-gst-split]");
    if (!amount || !rate) return;

    var inclusive = paramStr("inc", "0") === "1";
    var inter = paramStr("igst", "0") === "1";
    if (param("a", null) != null) amount.value = String(param("a", 10000));
    if (param("r", null) != null) rate.value = String(param("r", 18));

    function setPressed(list, attr, value) {
      list.forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.getAttribute(attr) === value ? "true" : "false");
      });
    }

    function run() {
      var A = parseInput(amount, 0, 1e12, 0);
      var R = parseInput(rate, 0, 100, 0);
      var res = calcGst(A, R, inclusive, inter);
      countTo($("#gst-total"), res.total, function (v) { return money(v, 2); });
      pop($("#gst-total"));
      countTo($("#gst-base"), res.base, function (v) { return money(v, 2); });
      countTo($("#gst-tax"), res.gst, function (v) { return money(v, 2); });
      countTo($("#gst-cgst"), res.cgst, function (v) { return money(v, 2); });
      countTo($("#gst-sgst"), res.sgst, function (v) { return money(v, 2); });
      countTo($("#gst-igst"), res.igst, function (v) { return money(v, 2); });
      var taxPct = res.total > 0 ? (res.gst / res.total) * 100 : 0;
      setText("gst-result-sub", num(res.rate, 1) + "% GST · " + (inter ? "IGST" : "CGST + SGST"));
      setText("gst-donut-label", num(taxPct, 1) + "%");
      var cBase = token("--accent", "#60a5fa");
      var cTax = token("--accent-2", "#a78bfa");
      var cAlt = token("--accent-3", "#34d399");
      var slices = inter
        ? [
            { value: res.base, color: cBase },
            { value: res.igst, color: cTax },
          ]
        : [
            { value: res.base, color: cBase },
            { value: res.cgst, color: cTax },
            { value: res.sgst, color: cAlt },
          ];
      renderDonut($("#gst-donut"), slices);
      paintLegend(
        $("#gst-legend"),
        inter
          ? [
              { color: cBase, label: t("tools.gst.base", "Taxable value") },
              { color: cTax, label: "IGST" },
            ]
          : [
              { color: cBase, label: t("tools.gst.base", "Taxable value") },
              { color: cTax, label: "CGST" },
              { color: cAlt, label: "SGST" },
            ]
      );
      renderStack(
        $("#gst-chart"),
        inter
          ? [
              { value: res.base, color: cBase, label: t("tools.gst.base", "Base"), ink: token("--primary-fg", "#0b1224") },
              { value: res.igst, color: cTax, label: "IGST", ink: "#f5f5f7" },
            ]
          : [
              { value: res.base, color: cBase, label: t("tools.gst.base", "Base"), ink: token("--primary-fg", "#0b1224") },
              { value: res.cgst, color: cTax, label: "CGST", ink: "#f5f5f7" },
              { value: res.sgst, color: cAlt, label: "SGST", ink: "#052e1c" },
            ]
      );
      var splitIntra = $("#gst-split-intra");
      var splitInter = $("#gst-split-inter");
      if (splitIntra) splitIntra.hidden = inter;
      if (splitInter) splitInter.hidden = !inter;
      setPressed(chips, "data-gst-rate", String(R));
      setPressed(modeBtns, "data-gst-mode", inclusive ? "inc" : "exc");
      setPressed(splitBtns, "data-gst-split", inter ? "igst" : "intra");
      writeParams({ a: A, r: R, inc: inclusive ? 1 : 0, igst: inter ? 1 : 0 });
    }

    amount.addEventListener("input", run);
    rate.addEventListener("input", function () {
      run();
    });
    chips.forEach(function (btn) {
      btn.addEventListener("click", function () {
        rate.value = btn.getAttribute("data-gst-rate");
        run();
      });
    });
    modeBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        inclusive = btn.getAttribute("data-gst-mode") === "inc";
        run();
      });
    });
    splitBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        inter = btn.getAttribute("data-gst-split") === "igst";
        run();
      });
    });
    var reset = $("#gst-reset");
    if (reset)
      reset.addEventListener("click", function () {
        amount.value = "10000";
        rate.value = "18";
        inclusive = false;
        inter = false;
        run();
      });
    document.addEventListener("tools:recalc", run);
    run();
  }

  function boot() {
    bindTheme();
    applyToolHead();
    var id = window.__TOOL_ID;
    if (id === "emi") bindEmi();
    else if (id === "sip") bindSip();
    else if (id === "gst") bindGst();
    if (window.I18n && window.I18n.apply) window.I18n.apply();
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  var i18nReady = window.I18n
    ? window.I18n.init({
        base: window.__I18N_BASE || "../",
        lang: window.__LANG || undefined,
      }).catch(function () {})
    : Promise.resolve();
  i18nReady.then(boot);
})();
