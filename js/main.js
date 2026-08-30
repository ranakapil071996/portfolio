/**
 * Main interactions — employer-focused portfolio UX
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- i18n (single component tree; no page duplicates) ---------- */
  if (window.I18n) {
    window.I18n.init({ base: window.__I18N_BASE || "" }).catch(function () {});
  }

  function startAfterContent(resume) {
    if (window.ResumeRender && resume) {
      window.ResumeRender.fillPage(resume, { base: window.__I18N_BASE || "" });
    }

  /* ---------- Year + dynamic experience ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /** Career start: Sept 2018 (Skill & Lotto — first full-time role) */
  function calcYearsExp(start) {
    const s = start || new Date(2018, 8, 1);
    const years = Math.round((Date.now() - s.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return Math.max(years, 1);
  }

  const yearsExp =
    typeof window.__YEARS_EXP === "number" ? window.__YEARS_EXP : calcYearsExp();
  window.__YEARS_EXP = yearsExp;

  // Sync year labels — ONLY span[data-years-exp], never <html>
  function syncYearsLabels() {
    $$("span[data-years-exp]").forEach((el) => {
      el.textContent = String(yearsExp);
    });
    const yearsStat = $("[data-count-years]");
    if (yearsStat) {
      yearsStat.setAttribute("data-count", String(yearsExp));
      if (!yearsStat.dataset.counted) yearsStat.textContent = String(yearsExp);
    }
  }
  syncYearsLabels();
  document.addEventListener("i18n:changed", syncYearsLabels);

  /* ---------- Theme (light / dark) ---------- */
  const themeToggle = $("#theme-toggle");
  const metaTheme = $("#meta-theme-color");

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (_) {}
    if (metaTheme) {
      metaTheme.setAttribute("content", next === "light" ? "#eef2f7" : "#050816");
    }
    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        next === "light" ? "Switch to dark mode" : "Switch to light mode"
      );
      themeToggle.title = next === "light" ? "Dark mode" : "Light mode";
    }
    // Notify Three scene / particles if present
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
  }

  // Sync meta + label with FOUC script result
  applyTheme(getTheme());

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      applyTheme(getTheme() === "light" ? "dark" : "light");
    });
  }

  /* ---------- Nav scroll + mobile ---------- */
  const nav = $("#nav");
  const navLinks = $("#nav-links");
  const navToggle = $("#nav-toggle");

  function onScrollNav() {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  if (navToggle && navLinks) {
    function setMenuOpen(open) {
      navLinks.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("nav-open", open);
      if (open) {
        const first = navLinks.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      } else {
        navToggle.focus({ preventScroll: true });
      }
    }

    navToggle.addEventListener("click", () => {
      setMenuOpen(!navLinks.classList.contains("open"));
    });
    navLinks.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setMenuOpen(false));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && navLinks.classList.contains("open")) {
        e.preventDefault();
        setMenuOpen(false);
      }
    });
  }

  /* ---------- Active section spy ---------- */
  const sections = $$("main section[id]");
  const linkMap = new Map(
    $$(".nav-links a").map((a) => [a.getAttribute("href")?.slice(1), a])
  );

  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          linkMap.forEach((el, key) => {
            const on = key === id;
            el.classList.toggle("active", on);
            if (on) el.setAttribute("aria-current", "page");
            else el.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$(".reveal");
  reveals.forEach((el) => {
    const d = el.getAttribute("data-delay");
    if (d) el.style.setProperty("--delay", d + "ms");
  });

  // Hero / above-the-fold must never stay opacity:0
  $$("#hero .reveal").forEach((el) => el.classList.add("in"));

  if ("IntersectionObserver" in window) {
    const revObs = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => {
      if (!el.classList.contains("in")) revObs.observe(el);
    });
    // Show rendered resume cards immediately — filters feel instant
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Hero counters ---------- */
  function animateCount(el, target, duration) {
    const start = performance.now();
    const from = 0;
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (target - from) * eased));
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = String(target);
    }
    requestAnimationFrame(frame);
  }

  const stats = $$(".stat-value[data-count]");
  // Ensure years (and others) show final values even if animation is skipped
  stats.forEach((el) => {
    const target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (!el.textContent || el.textContent === "0") {
      // keep 0 for animation start; years already set via data-count
    }
  });

  function runCounters(fromZero) {
    stats.forEach((el) => {
      if (el.dataset.counted === "1") return;
      el.dataset.counted = "1";
      const target = parseInt(el.getAttribute("data-count"), 10) || 0;
      if (fromZero) animateCount(el, target, 1100);
      else el.textContent = String(target);
    });
  }

  // Set final stat numbers immediately so something is always readable
  stats.forEach((el) => {
    const target = parseInt(el.getAttribute("data-count"), 10) || 0;
    el.textContent = String(target);
  });

  if (stats.length && "IntersectionObserver" in window) {
    const cObs = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          if (el.dataset.counted === "1") return;
          el.dataset.counted = "1";
          const target = parseInt(el.getAttribute("data-count"), 10) || 0;
          el.textContent = "0";
          animateCount(el, target, 1100);
          obs.unobserve(el);
        });
      },
      { threshold: 0.15 }
    );
    stats.forEach((el) => cObs.observe(el));
    // Failsafe: if animation never starts, keep final values
    setTimeout(() => runCounters(false), 1000);
  } else {
    runCounters(false);
  }

  /* ---------- Experience / impact / skills (from js/resume-data.json) ---------- */
  if (window.ResumeRender) {
    window.ResumeRender.bindAll(resume || window.RESUME_CONTENT);
  }

  /* ---------- Cursor glow (desktop only) ---------- */
  const glow = $("#cursor-glow");
  const canGlow =
    glow &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !document.documentElement.classList.contains("perf-lite") &&
    window.matchMedia("(pointer: fine)").matches;

  if (canGlow) {
    let gx = 0, gy = 0, tx = 0, ty = 0, glowRaf = 0;
    glow.classList.add("visible");

    window.addEventListener(
      "pointermove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
      },
      { passive: true }
    );

    function glowTick() {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0) translate3d(-50%, -50%, 0)`;
      glowRaf = requestAnimationFrame(glowTick);
    }
    glowRaf = requestAnimationFrame(glowTick);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(glowRaf);
      } else {
        glowRaf = requestAnimationFrame(glowTick);
      }
    });
  }

  /* ---------- Toast helper ---------- */
  const toast = $("#toast");
  let toastTimer = 0;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  /* Copy email on long-press alternative: click with modifier */
  const mailCard = $('a[href^="mailto:"]');
  if (mailCard) {
    mailCard.addEventListener("click", (e) => {
      // double-click copies
    });
    mailCard.addEventListener("dblclick", (e) => {
      e.preventDefault();
      const email = "rana.kapil071996@gmail.com";
      if (navigator.clipboard) {
        navigator.clipboard.writeText(email).then(() => showToast("Email copied to clipboard"));
      }
    });
  }

  /* ---------- Back to top ---------- */
  const backTop = $("#back-top");
  if (backTop) {
    backTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Keyboard: expand focused timeline with Enter already native on button ---------- */

  /* ---------- Prefetch resume on idle ---------- */
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = "assets/Kapil_Rana_Resume.pdf";
      document.head.appendChild(link);
    });
  }

  /* ---------- Story mode (interview walkthrough) ---------- */
  if (document.getElementById("hero")) {
    var story = document.createElement("script");
    story.src = (window.__I18N_BASE || "") + "js/story-mode.js";
    document.body.appendChild(story);
  }
  }

  var boot = function (resume) {
    startAfterContent(resume || window.RESUME_CONTENT);
  };
  if (window.ResumeContent && window.ResumeContent.ready) {
    window.ResumeContent.ready.then(boot).catch(function () { boot(null); });
  } else {
    boot(window.RESUME_CONTENT);
  }
})();
