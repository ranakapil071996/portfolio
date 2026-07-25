/**
 * Main interactions — employer-focused portfolio UX
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Year + dynamic experience ---------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /** Career start: Sept 2018 (Skill & Lotto — first full-time role) */
  function calcYearsExp(start) {
    const s = start || new Date(2018, 8, 1);
    const now = new Date();
    let years = now.getFullYear() - s.getFullYear();
    const m = now.getMonth() - s.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < s.getDate())) years--;
    return Math.max(years, 1);
  }

  const yearsExp =
    typeof window.__YEARS_EXP === "number" ? window.__YEARS_EXP : calcYearsExp();
  window.__YEARS_EXP = yearsExp;

  // Sync year labels — ONLY span[data-years-exp], never <html>
  $$("span[data-years-exp]").forEach((el) => {
    el.textContent = String(yearsExp);
  });
  const yearsStat = $("[data-count-years]");
  if (yearsStat) {
    yearsStat.setAttribute("data-count", String(yearsExp));
    yearsStat.textContent = String(yearsExp);
  }

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
    // Failsafe: never leave content invisible if IO misses
    setTimeout(() => {
      reveals.forEach((el) => el.classList.add("in"));
    }, 1200);
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

  /* ---------- Experience expand / filter ---------- */
  $$("[data-expand]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".timeline-item");
      if (!item) return;
      const open = item.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  // Open first item by default for employers
  const firstItem = $(".timeline-item");
  if (firstItem) {
    firstItem.classList.add("open");
    const b = firstItem.querySelector("[data-expand]");
    if (b) b.setAttribute("aria-expanded", "true");
  }

  function bindFilterGroup(selector, onChange) {
    const buttons = $$(selector);
    buttons.forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.classList.contains("active") ? "true" : "false");
      btn.addEventListener("click", () => {
        buttons.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        onChange(btn);
      });
    });
  }

  bindFilterGroup(".filter-btn[data-filter]", (btn) => {
    const filter = btn.getAttribute("data-filter") || "all";
    $$(".timeline-item").forEach((item) => {
      const tags = (item.getAttribute("data-tags") || "").split(/\s+/);
      const show = filter === "all" || tags.includes(filter);
      item.classList.toggle("filtered-out", !show);
      item.setAttribute("aria-hidden", show ? "false" : "true");
    });
  });

  /* ---------- Impact company filter ---------- */
  bindFilterGroup("[data-impact-filter]", (btn) => {
    const filter = btn.getAttribute("data-impact-filter") || "all";
    $$("[data-impact-company]").forEach((card) => {
      const co = card.getAttribute("data-impact-company");
      const show = filter === "all" || co === filter;
      card.classList.toggle("filtered-out", !show);
      card.setAttribute("aria-hidden", show ? "false" : "true");
    });
  });

  /* ---------- Skills data + interaction ---------- */
  const SKILLS = [
    {
      name: "React.js",
      cat: "frontend",
      level: 95,
      desc:
        "Primary UI stack for " +
        yearsExp +
        "+ years — architecture, design systems, and performance-sensitive banking & commerce interfaces.",
      used: "Airtel Payments Bank · DotPe · Tyroo · Meddo",
    },
    {
      name: "Next.js",
      cat: "frontend",
      level: 88,
      desc: "Server-side rendering and App/Pages architecture for high-traffic product surfaces — currently powering dynamic Internet Banking UI.",
      used: "Airtel Payments Bank (current)",
    },
    {
      name: "Prismic CMS",
      cat: "frontend",
      level: 82,
      desc: "Headless CMS integration with Next.js for dynamic, content-driven UI composition without hard-coding every layout.",
      used: "Airtel Payments Bank (current)",
    },
    {
      name: "Cloudflare",
      cat: "devops",
      level: 80,
      desc: "Edge caching/CDN to improve page load and Cloudflare security controls to help prevent attacks on Internet Banking web properties.",
      used: "Airtel Payments Bank",
    },
    {
      name: "Google reCAPTCHA",
      cat: "frontend",
      level: 78,
      desc: "Bot and abuse protection on sensitive banking forms and critical user actions.",
      used: "Airtel Payments Bank",
    },
    {
      name: "TypeScript",
      cat: "frontend",
      level: 92,
      desc: "Typed large codebases across React/Next.js UIs and Node services — safer refactors and clearer API contracts.",
      used: "Airtel · DotPe · Node backends",
    },
    {
      name: "Redux Toolkit / RTK Query",
      cat: "frontend",
      level: 90,
      desc: "State management and data fetching for dashboards, billing flows, and multi-product merchant tools.",
      used: "DotPe",
    },
    {
      name: "JavaScript (ES6+)",
      cat: "frontend",
      level: 95,
      desc: "Language depth for architecture decisions, tooling, and mentoring across the team.",
      used: "All roles",
    },
    {
      name: "HTML5 / CSS3 / SCSS",
      cat: "frontend",
      level: 90,
      desc: "Accessible, responsive interfaces and maintainable styling systems.",
      used: "All roles",
    },
    {
      name: "Tailwind CSS",
      cat: "frontend",
      level: 85,
      desc: "Utility-first styling for consistent, fast product UI delivery.",
      used: "DotPe · product UIs",
    },
    {
      name: "Material UI",
      cat: "frontend",
      level: 88,
      desc: "Enterprise dense UIs for admin portals and healthcare-style applications.",
      used: "Meddo · product apps",
    },
    {
      name: "Styled Components",
      cat: "frontend",
      level: 82,
      desc: "Component-scoped styling for design-system-driven React apps.",
      used: "DotPe",
    },
    {
      name: "Webpack",
      cat: "frontend",
      level: 78,
      desc: "Bundling, code-splitting, and production build optimization for SPA performance.",
      used: "Product platforms",
    },
    {
      name: "Jest / Testing",
      cat: "frontend",
      level: 80,
      desc: "Unit and component tests protecting critical money and order flows.",
      used: "DotPe · Airtel",
    },
    {
      name: "Performance Optimization",
      cat: "frontend",
      level: 90,
      desc: "Load-time and render efficiency for high-traffic Internet Banking and commerce UIs.",
      used: "Airtel · DotPe",
    },
    {
      name: "Accessibility",
      cat: "frontend",
      level: 85,
      desc: "Inclusive UX ownership for regulated banking customer journeys.",
      used: "Airtel Payments Bank",
    },
    {
      name: "React Native",
      cat: "mobile",
      level: 85,
      desc: "Waiter app (offline-ready) and healthcare patient/partner apps with Firebase.",
      used: "DotPe · Meddo",
    },
    {
      name: "Node.js",
      cat: "backend",
      level: 86,
      desc: "Backend services with Express — REST APIs, admin backends, rendering pipelines, and product integrations with TypeScript/JS.",
      used: "Tyroo · Meddo · DotPe · platform services",
    },
    {
      name: "Express",
      cat: "backend",
      level: 84,
      desc: "HTTP APIs and middleware for admin portals, bulk ops, and service integrations.",
      used: "Meddo · DotPe · internal services",
    },
    {
      name: "MongoDB",
      cat: "backend",
      level: 80,
      desc: "Document data modeling and queries for product features and service persistence.",
      used: "Product backends · services",
    },
    {
      name: "SQL",
      cat: "backend",
      level: 80,
      desc: "Relational data design, queries, and integrations for transactional application workflows.",
      used: "Product backends · reporting flows",
    },
    {
      name: "API Design",
      cat: "backend",
      level: 86,
      desc: "Collaborate with backend engineers to define requirements, contracts, and architecture for product features.",
      used: "Airtel · DotPe",
    },
    {
      name: "Kong",
      cat: "backend",
      level: 80,
      desc: "Configure Kong API Gateway for backend APIs — traffic control, authentication, and cross-origin policies.",
      used: "Airtel Payments Bank",
    },
    {
      name: "JWT",
      cat: "backend",
      level: 80,
      desc: "Token-based authentication for secure access to backend APIs in banking workflows.",
      used: "Airtel Payments Bank",
    },
    {
      name: "CORS",
      cat: "backend",
      level: 78,
      desc: "Cross-origin resource policies for browser clients calling protected banking APIs.",
      used: "Airtel Payments Bank",
    },
    {
      name: "Socket.io",
      cat: "backend",
      level: 80,
      desc: "Real-time chat and live updates for merchant marketing and operations tools.",
      used: "DotPe",
    },
    {
      name: "Firebase",
      cat: "backend",
      level: 78,
      desc: "Auth, realtime data, and offline-capable mobile flows for restaurant operations.",
      used: "DotPe Waiter App",
    },
    {
      name: "AWS",
      cat: "devops",
      level: 78,
      desc: "Cloud infrastructure experience for deploying and operating application services and related resources.",
      used: "Cloud deployments · platform work",
    },
    {
      name: "Private Servers",
      cat: "devops",
      level: 76,
      desc: "Own private server management — provisioning, maintenance, and keeping app services healthy.",
      used: "Self-managed infrastructure",
    },
    {
      name: "Kibana",
      cat: "devops",
      level: 84,
      desc: "Production log analysis to diagnose issues on a high-traffic banking platform.",
      used: "Airtel Payments Bank",
    },
    {
      name: "Grafana",
      cat: "devops",
      level: 84,
      desc: "Monitor server and service health for Internet Banking at ~1M users/day.",
      used: "Airtel Payments Bank",
    },
    {
      name: "Prometheus",
      cat: "devops",
      level: 72,
      desc: "Metrics-backed observability alongside Grafana for production awareness.",
      used: "Production systems",
    },
    {
      name: "Docker / Nginx",
      cat: "devops",
      level: 72,
      desc: "Containerized services and reverse-proxy setups for reliable delivery.",
      used: "Platform deployments",
    },
    {
      name: "Jira",
      cat: "soft",
      level: 92,
      desc: "Day-to-day team management — backlog, sprint planning, prioritization, and delivery tracking.",
      used: "Airtel Payments Bank",
    },
    {
      name: "Team Leadership",
      cat: "soft",
      level: 90,
      desc: "Led squads of 4 engineers — mentoring, architecture decisions, and cross-functional delivery.",
      used: "Airtel · DotPe",
    },
    {
      name: "Agile / Scrum",
      cat: "soft",
      level: 88,
      desc: "Iterative delivery with Product, Design, Backend, and Compliance partners.",
      used: "All product companies",
    },
  ];

  const cloud = $("#skills-cloud");
  const detailWrap = $(".skills-detail-body");
  const hint = $(".skills-hint");
  const skillName = $("#skill-name");
  const skillDesc = $("#skill-desc");
  const skillLevel = $("#skill-level");
  const skillUsed = $("#skill-used");

  function renderSkills(cat) {
    if (!cloud) return;
    cloud.innerHTML = "";
    SKILLS.forEach((s) => {
      if (cat !== "all" && s.cat !== cat) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skill-chip";
      btn.textContent = s.name;
      btn.setAttribute("data-skill", s.name);
      btn.addEventListener("click", () => selectSkill(s, btn));
      cloud.appendChild(btn);
    });
  }

  function selectSkill(s, btn) {
    $$(".skill-chip").forEach((c) => c.classList.remove("active"));
    if (btn) btn.classList.add("active");
    if (hint) hint.hidden = true;
    if (detailWrap) detailWrap.hidden = false;
    if (skillName) skillName.textContent = s.name;
    if (skillDesc) skillDesc.textContent = s.desc;
    if (skillUsed) skillUsed.textContent = "Used at: " + s.used;
    if (skillLevel) {
      skillLevel.style.width = "0%";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          skillLevel.style.width = s.level + "%";
        });
      });
    }
  }

  renderSkills("all");

  $$(".skill-cat").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".skill-cat").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderSkills(btn.getAttribute("data-skill-cat") || "all");
      if (hint) hint.hidden = false;
      if (detailWrap) detailWrap.hidden = true;
    });
  });

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
})();
