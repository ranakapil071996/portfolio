/**
 * Company-themed resume renderer with unique layouts + heavy FX
 */
(function () {
  "use strict";

  function yearsExp() {
    if (typeof window.__YEARS_EXP === "number") return window.__YEARS_EXP;
    var start = new Date(2018, 8, 1);
    var y = Math.round((Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return Math.max(y, 1);
  }

  function ui(key, fallback) {
    if (window.I18n && window.I18n.getDict()) {
      var v = window.I18n.t("companyUi." + key);
      if (v && v.indexOf("companyUi.") !== 0) return v;
    }
    return fallback;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseRgb(str) {
    str = String(str || "").trim();
    if (!str) return null;
    if (str.charAt(0) === "#") {
      var hex = str.slice(1);
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (hex.length < 6) return null;
      var n = parseInt(hex.slice(0, 6), 16);
      if (isNaN(n)) return null;
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    var m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }

  function relLuma(rgb) {
    if (!rgb) return 1;
    function lin(c) {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  }

  function contrastRatio(a, b) {
    var l1 = relLuma(a);
    var l2 = relLuma(b);
    var hi = Math.max(l1, l2);
    var lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function readableOn(bgRgb) {
    var white = { r: 245, g: 245, b: 247 };
    var black = { r: 17, g: 17, b: 20 };
    return contrastRatio(white, bgRgb) >= contrastRatio(black, bgRgb) ? "#f5f5f7" : "#111114";
  }

  function mutedOn(bgRgb, inkHex) {
    var ink = parseRgb(inkHex) || { r: 17, g: 17, b: 20 };
    var dark = relLuma(bgRgb) < 0.45;
    if (dark) return contrastRatio(ink, bgRgb) >= 4.5 ? inkHex : "#d4d4d8";
    return contrastRatio(ink, bgRgb) >= 4.5 ? inkHex : "#3f3f46";
  }

  function applyReadableTokens(target, c) {
    var cs = getComputedStyle(document.body);
    var surface =
      parseRgb(cs.getPropertyValue("--c-surface")) ||
      parseRgb(c.surface) ||
      parseRgb("#ffffff");
    var pageBg = parseRgb(cs.getPropertyValue("--c-bg")) || parseRgb(c.bg) || surface;
    var inkWanted =
      parseRgb(cs.getPropertyValue("--c-text")) || parseRgb(c.text) || { r: 17, g: 17, b: 20 };
    var mutedWanted =
      parseRgb(cs.getPropertyValue("--c-muted")) || parseRgb(c.muted) || inkWanted;
    var accentWanted = parseRgb(cs.getPropertyValue("--c-accent")) || parseRgb(c.accent);
    var primary = parseRgb(cs.getPropertyValue("--c-primary")) || parseRgb(c.primary);

    var ink = contrastRatio(inkWanted, surface) >= 4.5 ? rgbToHex(inkWanted) : readableOn(surface);
    var muted = contrastRatio(mutedWanted, surface) >= 3.5 ? rgbToHex(mutedWanted) : mutedOn(surface, ink);
    var darkSurface = relLuma(surface) < 0.45;
    var darkPage = relLuma(pageBg) < 0.45;
    var accent = accentWanted;
    if (!accent || contrastRatio(accent, primary || surface) < 3) {
      accent = parseRgb(readableOn(primary || surface));
    }
    // Banner is a dark gradient of secondary — accent-as-text must read on it
    var banner = parseRgb(c.secondary) || pageBg;
    if (accent && contrastRatio(accent, banner) < 3.2) {
      accent = parseRgb(readableOn(banner));
    }

    var glass = darkSurface ? "#1c1c1f" : rgbToHex(surface);
    target.setProperty("--c-text", ink);
    target.setProperty("--c-muted", muted);
    if (accent) target.setProperty("--c-accent", rgbToHex(accent));
    target.setProperty("--bg", rgbToHex(pageBg));
    target.setProperty("--bg-elevated", glass);
    target.setProperty("--bg-glass", glass);
    target.setProperty("--text", ink);
    target.setProperty("--text-muted", muted);
    target.setProperty("--text-dim", muted);
    target.setProperty("--stat-bg", glass);
    target.setProperty("--toast-bg", glass);
    target.setProperty("--border", darkSurface ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.12)");
    target.setProperty("--border-strong", c.primary);
    target.setProperty("--tech-bg", darkSurface ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)");
    target.setProperty("--tech-border", darkSurface ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.12)");
    target.setProperty("--employer-bg", darkSurface ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)");
    target.setProperty("--employer-border", c.primary);
    target.setProperty("--level-track", darkSurface ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.1)");
    // Pair gradient/primary-fg to the brand, and give the AI-assist
    // chooser its own fill + contrast ink so the label stays readable.
    var brand = c.primary || rgbToHex(primary || surface);
    var brandDark = c.primaryDark || brand;
    var brandInk = readableOn(primary || surface);
    target.setProperty("--gradient", "linear-gradient(135deg, " + brand + " 0%, " + brandDark + " 100%)");
    target.setProperty("--primary-fg", brandInk);
    target.setProperty("--accent", c.primary);
    target.setProperty("--accent-2", c.primaryDark || c.primary);
    target.setProperty("--story-btn-bg", brand);
    target.setProperty("--story-btn-fg", brandInk);
    document.documentElement.setAttribute("data-theme", darkPage ? "dark" : "light");
    document.documentElement.style.colorScheme = darkPage ? "dark" : "light";
  }

  function rgbToHex(rgb) {
    function h(v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    return "#" + h(rgb.r) + h(rgb.g) + h(rgb.b);
  }

  function applyTheme(c) {
    var r = document.documentElement.style;
    r.setProperty("--c-primary", c.primary);
    r.setProperty("--c-primary-dark", c.primaryDark);
    r.setProperty("--c-secondary", c.secondary);
    r.setProperty("--c-accent", c.accent);
    r.setProperty("--c-bg", c.bg);
    r.setProperty("--c-surface", c.surface);
    r.setProperty("--c-text", c.text);
    r.setProperty("--c-muted", c.muted);
    r.setProperty("--c-font", c.font);
    r.setProperty("--c-heading", c.headingFont);
    var meta = document.getElementById("theme-color-meta");
    if (meta) meta.setAttribute("content", c.primary);
    document.body.className = "layout-" + (c.layout || "classic");
    // Layout CSS may force a dark surface (noir / terminal / neon).
    // Re-read computed colors and fix any unreadable text pairs.
    applyReadableTokens(document.body.style, c);
    applyReadableTokens(r, c);
  }

  function monogram(name) {
    return name
      .split(/\s+/)
      .map(function (w) { return w[0]; })
      .join("")
      .slice(0, 3)
      .toUpperCase();
  }

  function topBar(c, resume, base) {
    var logoUrl = "https://logo.clearbit.com/" + c.domain + "?size=128";
    return (
      '<header class="cr-top">' +
      '<div class="cr-top-inner">' +
      '<a class="cr-brand" href="./">' +
      '<img class="cr-logo" src="' +
      esc(logoUrl) +
      '" alt="" width="36" height="36" onerror="this.style.display=\'none\';this.nextElementSibling.hidden=false" />' +
      '<span class="cr-mono" hidden>' +
      esc(monogram(c.name)) +
      "</span><span>" +
      esc(resume.name) +
      "</span></a>" +
      '<div class="cr-actions">' +
      '<div class="lang-switcher" id="lang-switcher"></div>' +
      '<a class="cr-btn cr-btn-primary" href="' +
      base +
      (window.I18n ? window.I18n.getLang() + "/" : "") +
      '">' +
      esc(ui("portfolio", "Portfolio")) +
      "</a>" +
      '<a class="cr-btn" href="' +
      base +
      'assets/Kapil_Rana_Resume.pdf" download>' +
      esc(ui("pdf", "PDF")) +
      "</a>" +
      '<button type="button" class="cr-btn cr-btn-primary" id="print-btn">' +
      esc(ui("print", "Print")) +
      "</button>" +
      "</div></div></header>"
    );
  }

  function banner(c, resume, base, layout) {
    var contact =
      '<div class="cr-contact">' +
      "<span>" +
      esc(resume.location) +
      "</span>" +
      '<a href="mailto:' +
      esc(resume.email) +
      '">' +
      esc(resume.email) +
      "</a>" +
      '<a href="tel:' +
      esc(resume.phone.replace(/\s/g, "")) +
      '">' +
      esc(resume.phone) +
      "</a>" +
      '<a href="' +
      esc(resume.linkedin) +
      '" target="_blank" rel="noopener">' +
      esc(resume.linkedinLabel) +
      "</a></div>";

    if (layout === "sidebar") {
      return (
        '<aside class="cr-side cr-reveal">' +
        '<img class="cr-avatar" src="' +
        base +
        'assets/profile.png" width="96" height="96" alt="" style="width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.35)" />' +
        "<h1>" +
        esc(resume.name) +
        "</h1>" +
        '<p class="cr-role">' +
        esc(resume.title) +
        "</p>" +
        contact +
        "</aside>"
      );
    }

    return (
      '<section class="cr-banner" aria-label="Candidate">' +
      '<div class="cr-banner-inner">' +
      '<img class="cr-avatar" src="' +
      base +
      'assets/profile.png" width="96" height="96" alt="Portrait of ' +
      esc(resume.name) +
      '" />' +
      "<div>" +
      "<h1>" +
      esc(resume.name) +
      "</h1>" +
      '<p class="cr-role">' +
      esc(resume.title) +
      "</p>" +
      contact +
      "</div></div></section>"
    );
  }

  function bindReveal() {
    document.querySelectorAll(".reveal, .cr-reveal").forEach(function (n) {
      n.classList.add("in");
    });
  }

  function render(slug) {
    var companies = window.COMPANIES || {};
    var resume = window.RESUME_CONTENT;
    var c = companies[slug];
    if (!c || !resume) {
      document.body.innerHTML =
        '<main style="padding:2rem;font-family:system-ui"><h1>Resume not found</h1><p><a href="../for/">Browse company resumes</a></p></main>';
      return;
    }

    applyTheme(c);

    // i18n: shared locales, no duplicated resume components
    var langPromise = window.I18n
      ? window.I18n.init({ base: "../", lang: window.__LANG })
      : Promise.resolve(null);

    document.title = resume.name + " — Resume";
    var desc = document.getElementById("meta-desc");
    if (desc) {
      desc.setAttribute(
        "content",
        resume.name + " — SDE III. React, Next.js, TypeScript, Node.js."
      );
    }

    var base = "../";
    var layout = c.layout || "classic";

    var root = document.getElementById("app");
    if (!root) return;

    var bodyHtml =
      window.ResumeRender && window.ResumeRender.sectionsHtml
        ? window.ResumeRender.sectionsHtml(resume, { base: base })
        : "";

    root.innerHTML =
      '<canvas id="cr-three" aria-hidden="true"></canvas>' +
      '<div id="cr-particles" aria-hidden="true"></div>' +
      '<div class="cr-noise" aria-hidden="true"></div>' +
      '<div class="cr-shell">' +
      '<a class="skip" href="#resume-main">' + esc(ui("skip","Skip to resume")) + '</a>' +
      topBar(c, resume, base) +
      banner(c, resume, base, layout) +
      '<main class="cr-main portfolio-resume" id="resume-main">' +
      bodyHtml +
      "</main>" +
      '<footer class="cr-footer">' +
      "<p>© " +
      new Date().getFullYear() +
      " " +
      esc(resume.name) +
      "</p>" +
      '<p class="no-print"><a href="' +
      base +
      (window.I18n ? window.I18n.getLang() + "/" : "") +
      '">' +
      esc(ui("portfolio", "Portfolio")) +
      "</a></p></footer></div>" +
      '<div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"></div>';

    var printBtn = document.getElementById("print-btn");
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

    if (window.ResumeRender && window.ResumeRender.bindAll) {
      window.ResumeRender.bindAll(resume);
    }
    bindReveal();

    // Heavy FX
    if (window.CompanyFX && window.CompanyFX.start) {
      window.CompanyFX.start(c);
    }
    loadStoryMode(base);
    scheduleSwitchPrompt(c, base);
  }

  function loadStoryMode(base) {
    window.__I18N_BASE = base;
    if (window.__storyModeBooted || document.getElementById("story-mode-script")) return;
    var s = document.createElement("script");
    s.id = "story-mode-script";
    s.src = base + "js/story-mode.js?v=choice4";
    document.body.appendChild(s);
  }

  function scheduleSwitchPrompt(c, base) {
    function tryMount() {
      if (document.getElementById("cr-switch")) return;
      var welcome = document.getElementById("story-welcome");
      if (welcome && !welcome.hidden) return;
      mountSwitchPrompt(c, base);
    }
    document.addEventListener("story:idle", tryMount);
    document.addEventListener("story:ready", tryMount);
    setTimeout(tryMount, 8000);
    setTimeout(tryMount, 12000);
  }

  function portfolioHref(base) {
    return base + (window.I18n ? window.I18n.getLang() + "/" : "");
  }

  function popAudioEl(base) {
    if (window.__crPopAudio) return window.__crPopAudio;
    var audio = new Audio(base + "assets/ui-pop.mp3");
    audio.preload = "auto";
    audio.volume = 0.7;
    window.__crPopAudio = audio;
    return audio;
  }

  function popCtx() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!window.__crPopCtx) window.__crPopCtx = new AC();
    return window.__crPopCtx;
  }

  function primeSwitchAudio(base) {
    var audio = popAudioEl(base);
    var ctx = popCtx();
    try {
      if (ctx && ctx.state === "suspended") ctx.resume();
    } catch (e1) {}
    try {
      if (ctx) {
        var buf = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      }
    } catch (e2) {}
    try {
      audio.muted = true;
      audio.volume = 0;
      var p = audio.play();
      if (p && p.then) {
        p.then(function () {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = 0.7;
          window.__crPopReady = true;
        }).catch(function () {
          audio.muted = false;
          audio.volume = 0.7;
        });
      }
    } catch (e3) {
      audio.muted = false;
      audio.volume = 0.7;
    }
  }

  function playSwitchPopSynth() {
    try {
      var ctx = popCtx();
      if (!ctx) return Promise.reject();
      return ctx.resume().then(function () {
        function tone(freq, start, dur, gain) {
          var o = ctx.createOscillator();
          var g = ctx.createGain();
          o.type = "triangle";
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
          g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(ctx.currentTime + start);
          o.stop(ctx.currentTime + start + dur + 0.02);
        }
        tone(880, 0, 0.1, 0.18);
        tone(1320, 0.05, 0.13, 0.14);
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function playSwitchPop(base) {
    if (window.__crPopPlayed) return;
    var audio = popAudioEl(base);
    function mark() {
      window.__crPopPlayed = true;
      window.__crPopPending = false;
    }
    function failOver() {
      playSwitchPopSynth().then(mark).catch(function () {});
    }
    try {
      audio.muted = false;
      audio.volume = 0.7;
      audio.currentTime = 0;
      var p = audio.play();
      if (p && p.then) {
        p.then(mark).catch(failOver);
      } else {
        mark();
      }
    } catch (e) {
      failOver();
    }
  }

  function bindAudioUnlock(base) {
    if (window.__crPopUnlockBound) return;
    window.__crPopUnlockBound = true;
    var evts = ["pointerdown", "touchstart", "keydown", "wheel", "scroll"];
    function onUse() {
      primeSwitchAudio(base);
      if (window.__crPopPending) {
        window.__crPopPending = false;
        playSwitchPop(base);
      }
    }
    evts.forEach(function (evt) {
      window.addEventListener(evt, onUse, { capture: true, passive: true });
    });
  }

  function mountSwitchPrompt(c, base) {
    if (document.getElementById("cr-switch")) return;
    var href = portfolioHref(base);
    popAudioEl(base);
    bindAudioUnlock(base);
    primeSwitchAudio(base);

    var root = document.createElement("div");
    root.id = "cr-switch";
    root.className = "cr-switch no-print";
    root.innerHTML =
      '<div class="cr-switch-toast" role="status" aria-live="polite">' +
      '<button type="button" class="cr-switch-x" id="cr-switch-close" aria-label="Dismiss">×</button>' +
      "<p><strong>" +
      esc(ui("switchTitle", "This resume is specially designed for you.")) +
      "</strong></p>" +
      "<p>" +
      esc(
        ui(
          "switchBody",
          "If you want, you can also check out my default version of this."
        )
      ) +
      "</p>" +
      '<a class="cr-btn cr-btn-primary" id="cr-switch-go" href="' +
      esc(href) +
      '">' +
      esc(ui("switchCta", "Open default portfolio")) +
      "</a>" +
      "</div>" +
      '<a class="cr-switch-fab" href="' +
      esc(href) +
      '" title="' +
      esc(ui("portfolio", "Portfolio")) +
      '" aria-label="' +
      esc(ui("portfolio", "Portfolio")) +
      '">' +
      '<span class="cr-switch-fab-dot" aria-hidden="true"></span>' +
      "<span>Portfolio</span>" +
      "</a>";
    document.body.appendChild(root);

    var close = document.getElementById("cr-switch-close");
    if (close) {
      close.addEventListener("click", function () {
        root.classList.remove("is-open");
        root.classList.add("is-fab-only");
      });
    }

    setTimeout(function () {
      root.classList.add("is-on", "is-open");
      window.__crPopPending = true;
      playSwitchPop(base);
      setTimeout(function () {
        if (!window.__crPopPlayed) playSwitchPop(base);
      }, 80);
    }, 5000);
  }

  function resolveSlug() {
    if (window.__COMPANY_SLUG) return window.__COMPANY_SLUG;
    var parts = location.pathname.replace(/\/+$/, "").split("/");
    return parts[parts.length - 1] || "";
  }

  function boot() {
    var slug = resolveSlug();
    var start = function () {
      render(slug);
    };
    var i18nReady = window.I18n
      ? window.I18n.init({
          base: "../",
          lang: window.__LANG || new URLSearchParams(location.search).get("lang") || undefined,
        })
      : Promise.resolve();
    var dataReady =
      window.ResumeContent && window.ResumeContent.ready
        ? window.ResumeContent.ready
        : Promise.resolve(window.RESUME_CONTENT);
    Promise.all([i18nReady.catch(function () {}), dataReady.catch(function () {})]).then(start);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
