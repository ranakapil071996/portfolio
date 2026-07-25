/**
 * Company-themed resume renderer with unique layouts + heavy FX
 */
(function () {
  "use strict";

  function yearsExp() {
    if (typeof window.__YEARS_EXP === "number") return window.__YEARS_EXP;
    var start = new Date(2018, 8, 1);
    var now = new Date();
    var y = now.getFullYear() - start.getFullYear();
    var m = now.getMonth() - start.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < start.getDate())) y--;
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
  }

  function monogram(name) {
    return name
      .split(/\s+/)
      .map(function (w) { return w[0]; })
      .join("")
      .slice(0, 3)
      .toUpperCase();
  }

  function skillsHtml(resume) {
    return resume.skills
      .map(function (s) {
        return (
          '<div class="skill-row"><dt>' +
          esc(s.label) +
          "</dt><dd>" +
          esc(s.value) +
          "</dd></div>"
        );
      })
      .join("");
  }

  function expHtml(resume) {
    return resume.experience
      .map(function (job) {
        var bullets = job.bullets
          .map(function (b) {
            return "<li>" + esc(b) + "</li>";
          })
          .join("");
        return (
          '<article class="job cr-reveal">' +
          '<div class="job-head"><span class="job-company">' +
          esc(job.company) +
          " · " +
          esc(job.location) +
          '</span><span class="job-dates">' +
          esc(job.dates) +
          "</span></div>" +
          '<div class="job-role">' +
          esc(job.role) +
          "</div><ul>" +
          bullets +
          "</ul></article>"
        );
      })
      .join("");
  }

  function impactHtml(resume) {
    return resume.impact
      .map(function (imp) {
        return (
          '<article class="impact-card cr-reveal"><h3>' +
          esc(imp.company) +
          '</h3><p><span class="lbl">' + esc(ui('business','Business')) + '</span>' +
          esc(imp.business) +
          '</p><p><span class="lbl">' + esc(ui('tech','Tech')) + '</span>' +
          esc(imp.tech) +
          "</p></article>"
        );
      })
      .join("");
  }

  function sectionsHtml(resume, summary) {
    return (
      '<section class="cr-section cr-reveal"><h2>' + esc(ui('summary','Professional Summary')) + '</h2><p>' +
      esc(summary) +
      "</p></section>" +
      '<section class="cr-section cr-reveal"><h2>' + esc(ui('skills','Technical Skills')) + '</h2><dl>' +
      skillsHtml(resume) +
      "</dl></section>" +
      '<section class="cr-section cr-reveal"><h2>' + esc(ui('experience','Professional Experience')) + '</h2>' +
      expHtml(resume) +
      "</section>" +
      '<section class="cr-section cr-reveal"><h2>' + esc(ui('impact','Business & Tech Impact')) + '</h2>' +
      impactHtml(resume) +
      "</section>" +
      '<section class="cr-section cr-reveal"><h2>' + esc(ui('education','Education')) + '</h2><div class="edu"><div><strong>' +
      esc(resume.education.school) +
      "</strong> · " +
      esc(resume.education.location) +
      "<br/>" +
      esc(resume.education.degree) +
      '</div><div class="job-dates">' +
      esc(resume.education.dates) +
      "</div></div></section>"
    );
  }

  function topBar(c, base) {
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
      "</span><span>Resume · " +
      esc(c.name) +
      "</span></a>" +
      '<div class="cr-actions">' +
      '<div class="lang-switcher" id="lang-switcher"></div>' +
      '<a class="cr-btn" href="' +
      base +
      "for/?lang=" +
      (window.I18n ? window.I18n.getLang() : "en") +
      '">' +
      esc(ui("allCompanies", "All companies")) +
      "</a>" +
      '<a class="cr-btn" href="' +
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
        '<p class="cr-tagline" style="margin-top:1rem">' +
        esc(c.tagline) +
        "</p>" +
        "<h1>" +
        esc(resume.name) +
        "</h1>" +
        '<p class="cr-role">' +
        esc(resume.title) +
        "</p>" +
        contact +
        '<p style="margin-top:1.25rem;font-size:0.85rem;opacity:0.85">' +
        esc(c.industry) +
        " · layout <code>" +
        esc(layout) +
        "</code></p></aside>"
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
      '<p class="cr-tagline">' +
      esc(c.tagline) +
      "</p>" +
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
    var nodes = document.querySelectorAll(".cr-reveal");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (n) {
        n.classList.add("in");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -5% 0px" }
    );
    nodes.forEach(function (n, i) {
      n.style.transitionDelay = Math.min(i * 40, 400) + "ms";
      io.observe(n);
    });
    // hero visible immediately
    setTimeout(function () {
      document.querySelectorAll(".cr-banner .cr-reveal, .cr-side.cr-reveal, .cr-pitch .cr-reveal").forEach(function (n) {
        n.classList.add("in");
      });
    }, 30);
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

    document.title = resume.name + " — Resume for " + c.name + " · " + (c.layout || "classic");
    var desc = document.getElementById("meta-desc");
    if (desc) {
      desc.setAttribute(
        "content",
        resume.name + " resume for " + c.name + ". " + c.pitch
      );
    }

    var y = yearsExp();
    var summary = resume.summary.replace(/\{years\}/g, String(y));
    var base = "../";
    var layout = c.layout || "classic";

    var root = document.getElementById("app");
    if (!root) return;

    root.innerHTML =
      '<canvas id="cr-three" aria-hidden="true"></canvas>' +
      '<div id="cr-particles" aria-hidden="true"></div>' +
      '<div class="cr-noise" aria-hidden="true"></div>' +
      '<div class="cr-shell">' +
      '<a class="skip" href="#resume-main">' + esc(ui("skip","Skip to resume")) + '</a>' +
      topBar(c, base) +
      banner(c, resume, base, layout) +
      '<div class="cr-pitch"><div class="cr-pitch-card cr-reveal"><strong>' +
      esc(ui("whyFor", "Why this version for {company}:").replace("{company}", c.name)) +
      "</strong> " +
      esc(c.pitch) +
      ' <span style="opacity:0.7">· Theme: ' +
      esc(layout) +
      " / 3D: " +
      esc(c.threeMode || "orbs") +
      " / particles: " +
      esc(c.particlesMode || "constellation") +
      "</span></div></div>" +
      '<main class="cr-main" id="resume-main">' +
      sectionsHtml(resume, summary) +
      "</main>" +
      '<footer class="cr-footer">' +
      "<p>© " +
      new Date().getFullYear() +
      " " +
      esc(resume.name) +
      " · Themed for <strong>" +
      esc(c.name) +
      "</strong> (" +
      esc(c.industry) +
      ")</p>" +
      '<p class="no-print"><a href="' +
      base +
      'for/">All company themes</a> · Share <code>/' +
      esc(c.slug) +
      "/</code></p></footer></div>";

    var printBtn = document.getElementById("print-btn");
    if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

    bindReveal();

    // Heavy FX
    if (window.CompanyFX && window.CompanyFX.start) {
      window.CompanyFX.start(c);
    }
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
    if (window.I18n) {
      var q = new URLSearchParams(location.search).get("lang");
      window.I18n.init({ base: "../", lang: window.__LANG || q || undefined }).then(start).catch(start);
    } else {
      start();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
