/**
 * Story mode — Kapil walks an interviewer through the portfolio.
 * Welcome chooser on load; optional voice via SpeechSynthesis.
 */
(function () {
  "use strict";

  if (window.__storyModeBooted) return;
  window.__storyModeBooted = true;
  if (!document.getElementById("hero")) return;

  var STORAGE_SEEN = "portfolio-guide-seen";
  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function basePath() {
    if (window.__I18N_BASE != null) return window.__I18N_BASE;
    return "";
  }

  function t(key, fallback) {
    if (window.I18n && window.I18n.getDict()) {
      var v = window.I18n.t(key);
      if (v && v.indexOf(key) !== 0) return v;
    }
    return fallback;
  }

  function years() {
    if (typeof window.__YEARS_EXP === "number") return window.__YEARS_EXP;
    var start = new Date(2018, 8, 1);
    return Math.max(1, Math.round((Date.now() - start.getTime()) / (365.25 * 864e5)));
  }

  function fill(s) {
    return String(s).replace(/\{years\}/g, String(years()));
  }

  function defaultSteps() {
    return [
      {
        id: "welcome",
        title: "Introduction",
        target: ".hero-content",
        align: "start",
        audio: "assets/story-voice/welcome.mp3?v=kapil2",
        text:
          "Hi, I'm Kapil Rana, I'm a Senior Manager and SDE III at Airtel Payments Bank. I walk you through this portfolio the way I would in an interview: impact first, then the technologies.",
      },
      {
        id: "positioning",
        title: "What I do",
        target: ".hero-stats",
        align: "start",
        audio: "assets/story-voice/positioning.mp3?v=kapil2",
        text:
          "I have {years} years of full-stack experience in React, Next.js, TypeScript, Node.js and React Native. I led Internet Banking for about a million users a day and I manage a team of 4. I ship products across 5 companies mostly in fintech, commerce, advertising, marketing.",
      },
      {
        id: "impact",
        title: "Impact",
        target: "#impact-heading",
        align: "start",
        action: "impact:all",
        audio: "assets/story-voice/impact.mp3?v=kapil2",
        text:
          "I organize each role by business impact and technical impact. First, what changed for users and revenue, then the stack that made it possible. Let's start with Airtel, my current role.",
      },
      {
        id: "airtel",
        title: "Airtel Payments Bank",
        target: '[data-impact-company="airtel"]',
        action: "impact:airtel",
        audio: "assets/story-voice/airtel.mp3?v=kapil2",
        text:
          "At Airtel, I own the internet banking experience under RBI compliance. We improved page speed with Next.js server-side rendering, Cloudflare caching and Core Web Vitals. We reduced bot abuse with Cloudflare security and Google reCAPTCHA. I own a NestJS backend also on Node.js in front of that service. I run a Kong gateway for load balancing with plugins for CORS, JWT and rate limiting. On the content side, Next.js and Prismic sits on a Node.js Prismic service I built. In production, I use Kibana and Grafana for logging and monitoring.",
      },
      {
        id: "dotpe",
        title: "DotPe",
        target: '[data-impact-company="dotpe"]',
        action: "impact:dotpe",
        audio: "assets/story-voice/dotpe.mp3?v=kapil2",
        text:
          "Before Airtel, I was a software engineer II at DotPe. From 2020 to 2025, I led 4 engineers on merchant billing, invoicing, inventory, GST and analytics. Food ordering reached 50,000 daily users and over a crore a day. I built the React Native waiter app and owned the Node.js backend behind it. APIs, order sync and offline-ready flows. We also shipped real-time chat with Socket.io and Firebase.",
      },
      {
        id: "tyroo",
        title: "Tyroo",
        target: '[data-impact-company="tyroo"]',
        action: "impact:tyroo",
        audio: "assets/story-voice/tyroo.mp3?v=kapil2",
        text:
          "At Tyroo, I built the video template UI in React, Redux and Ant Design. I also owned the video generation backend, a Node.js service and a Lottie service that rendered marketing videos at scale.",
      },
      {
        id: "meddo",
        title: "Meddo Health",
        target: '[data-impact-company="meddo"]',
        action: "impact:meddo",
        audio: "assets/story-voice/meddo.mp3?v=kapil2",
        text:
          "At Meddo Health, I built the React Native patient app, the doctor app plus the web product. Those covered video consults, chats, EMR and lab bookings. I also wrote Node.js APIs for Google Auth, bulk upload and media.",
      },
      {
        id: "lotto",
        title: "Skill and Lotto",
        target: '[data-impact-company="lotto"]',
        action: "impact:lotto",
        audio: "assets/story-voice/lotto.mp3?v=kapil2",
        text:
          "My first role was at Skill and Lotto. I built an online platform and back-office tools with JavaScript, jQuery, PHP and Bootstrap.",
      },
      {
        id: "about",
        title: "How I work",
        target: "#about-heading",
        align: "start",
        audio: "assets/story-voice/about.mp3?v=kapil2",
        text:
          "Day to day, I run the team in Jira, planning, priorities and delivery. I keep a high bar on React, TypeScript, quality. I own Node.js and NestJS services and I work with other engineers on API contracts and backend designing. After we ship, I stay in logs and dashboards using Kibana, Grafana and Kong.",
      },
      {
        id: "exp-airtel",
        title: "Airtel — full story",
        target: '.timeline-item[data-company="airtel"]',
        align: "start",
        action: "job:airtel",
        audio: "assets/story-voice/exp-airtel.mp3?v=kapil2",
        text:
          "This is the full Airtel role. I lead four engineers, we ship Next.js with Prismic and NestJS backend and Kong for load balancing, JWT, CORS and rate limiting. Page speed comes from server-side rendering, Cloudflare caching and Web Vitals. I own this surface end-to-end, not just tickets.",
      },
      {
        id: "exp-dotpe",
        title: "DotPe — full story",
        target: '.timeline-item[data-company="dotpe"]',
        align: "start",
        action: "job:dotpe",
        audio: "assets/story-voice/exp-dotpe.mp3?v=kapil2",
        text:
          "DotPe is a multi-product chapter: billing, WhatsApp marketing, live chat, the React Native waiter app, the Node.js behind it. It was revenue-linked work, across web, mobile and backend.",
      },
      {
        id: "skills",
        title: "Skills",
        target: "#skills-heading",
        align: "start",
        action: "skill:React.js",
        audio: "assets/story-voice/skills.mp3?v=kapil2",
        text:
          "Skills are grouped into frontend, backend, mobile, DevOps and leadership. React and TypeScript and Node are the core. On the backend, I own NestJS and Node service for Prismic. The waiter app is built on React Native and the video generation tool is built on Node.js backend. On mobile, waiter app, patient app, doctor app is on React Native. Then Express, MongoDB, SQL, AWS, Docker, Kong, Kibana and Grafana.",
      },
      {
        id: "education",
        title: "Education",
        target: "#education-heading",
        align: "start",
        audio: "assets/story-voice/education.mp3?v=kapil2",
        text:
          "I completed B.Tech in Computer Science engineering at K.R. Mangalam University from 2014 to 2018. Since then, I have worked at product companies in Gurgaon.",
      },
      {
        id: "close",
        title: "Next step",
        target: "#contact-heading",
        align: "start",
        audio: "assets/story-voice/close.mp3?v=kapil2",
        text:
          "That's the walkthrough. If you would like to talk, email or LinkedIn is the easiest, or you can contact me on my number. You can also download the PDF, restart this anytime from the avatar. Thank you.",
      },
    ];
  }

  var state = {
    index: 0,
    playing: false,
    muted: false,
    typing: null,
    advanceTimer: 0,
    spotTimer: 0,
    captionRaf: 0,
    utterance: null,
    player: null,
    voices: [],
    list: [],
    wordsPack: null,
    words: [],
  };

  var els = {};

  function injectCss() {
    if (document.getElementById("story-mode-css")) return;
    var link = document.createElement("link");
    link.id = "story-mode-css";
    link.rel = "stylesheet";
    link.href = basePath() + "css/story-mode.css";
    document.head.appendChild(link);
  }

  function avatarUrl() {
    return basePath() + "assets/avatar-kapil.jpg";
  }

  function icon(name) {
    var paths = {
      play: '<path d="M8 5v14l11-7z"/>',
      pause: '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
      prev: '<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>',
      next: '<path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z"/>',
      close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      mute: '<path d="M4 10v4h4l5 4V6L8 10H4zm12.5 2a3.5 3.5 0 00-1.8-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 8.5a6 6 0 010 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      unmute:
        '<path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    };
    return (
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      (paths[name] || "") +
      "</svg>"
    );
  }

  function build() {
    var root = document.createElement("div");
    root.id = "story-root";
    root.innerHTML =
      '<div class="story-welcome" id="story-welcome" hidden role="dialog" aria-modal="true" aria-labelledby="story-welcome-title">' +
      '  <div class="story-welcome-card">' +
      '    <div class="story-avatar-wrap story-avatar-lg">' +
      '      <img class="story-avatar-img" src="' +
      avatarUrl() +
      '" width="160" height="160" alt="Kapil Rana" />' +
      '      <span class="story-pulse" aria-hidden="true"></span>' +
      "    </div>" +
      '    <p class="story-kicker" data-story-i18n="story.kicker">Choose how to view</p>' +
      '    <h2 id="story-welcome-title">Hi — I\'m Kapil.</h2>' +
      '    <p class="story-welcome-lead" id="story-welcome-lead"></p>' +
      '    <div class="story-welcome-actions">' +
      '      <button type="button" class="btn btn-primary" id="story-start">' +
      icon("play") +
      " <span>AI assistance mode</span></button>" +
      '      <button type="button" class="btn btn-outline" id="story-read">Normal mode</button>' +
      "    </div>" +
      '    <p class="story-welcome-hint">About 3 minutes · covers the full resume · pause anytime</p>' +
      "  </div>" +
      "</div>" +
      '<aside class="story-dock" id="story-dock" hidden aria-label="AI assistance mode">' +
      '  <div class="story-avatar-wrap story-avatar-sm" id="story-dock-avatar">' +
      '    <img class="story-avatar-img" src="' +
      avatarUrl() +
      '" width="72" height="72" alt="" />' +
      '    <span class="story-pulse" aria-hidden="true"></span>' +
      "  </div>" +
      '  <div class="story-dock-body">' +
      '    <div class="story-dock-top">' +
      '      <p class="story-kicker" id="story-step-title">Kapil</p>' +
      '      <p class="story-count" id="story-count"></p>' +
      "    </div>" +
      '    <p class="story-caption" id="story-caption" aria-live="polite"></p>' +
      '    <div class="story-progress" aria-hidden="true"><i id="story-progress-bar"></i></div>' +
      '    <div class="story-controls">' +
      '      <button type="button" class="story-ctrl" id="story-prev" aria-label="Previous">' +
      icon("prev") +
      "</button>" +
      '      <button type="button" class="story-ctrl story-ctrl-main" id="story-toggle" aria-label="Pause">' +
      icon("pause") +
      "</button>" +
      '      <button type="button" class="story-ctrl" id="story-next" aria-label="Next">' +
      icon("next") +
      "</button>" +
      '      <button type="button" class="story-ctrl" id="story-mute" aria-label="Mute voice">' +
      icon("mute") +
      "</button>" +
      '      <button type="button" class="story-ctrl" id="story-exit" aria-label="Exit AI assistance mode">' +
      icon("close") +
      "</button>" +
      "    </div>" +
      "  </div>" +
      "</aside>" +
      '<button type="button" class="story-fab" id="story-fab" hidden>' +
      '  <img src="' +
      avatarUrl() +
      '" width="48" height="48" alt="" />' +
      '  <span>Ask Kapil</span>' +
      "</button>";

    document.body.appendChild(root);

    els.welcome = document.getElementById("story-welcome");
    els.lead = document.getElementById("story-welcome-lead");
    els.start = document.getElementById("story-start");
    els.read = document.getElementById("story-read");
    els.dock = document.getElementById("story-dock");
    els.caption = document.getElementById("story-caption");
    els.title = document.getElementById("story-step-title");
    els.count = document.getElementById("story-count");
    els.bar = document.getElementById("story-progress-bar");
    els.prev = document.getElementById("story-prev");
    els.toggle = document.getElementById("story-toggle");
    els.next = document.getElementById("story-next");
    els.mute = document.getElementById("story-mute");
    els.exit = document.getElementById("story-exit");
    els.fab = document.getElementById("story-fab");
    els.dockAvatar = document.getElementById("story-dock-avatar");

    els.start.addEventListener("click", function () {
      hideWelcome();
      startTour(0);
    });
    els.read.addEventListener("click", chooseRead);
    els.fab.addEventListener("click", function () {
      hideFab();
      startTour(0);
    });
    els.prev.addEventListener("click", function () {
      go(state.index - 1);
    });
    els.next.addEventListener("click", function () {
      go(state.index + 1);
    });
    els.toggle.addEventListener("click", togglePlay);
    els.mute.addEventListener("click", toggleMute);
    els.exit.addEventListener("click", exitTour);

    document.addEventListener("keydown", onKey);

    insertNavButton();
  }

  function insertNavButton() {
    var actions = document.querySelector(".nav-actions");
    if (!actions || document.getElementById("story-nav-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "story-nav-btn";
    btn.className = "story-nav-btn";
    btn.title = "AI assistance mode";
    btn.setAttribute("aria-label", "Start AI assistance mode");
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><span>AI assist</span>';
    btn.addEventListener("click", function () {
      hideWelcome();
      hideFab();
      startTour(0);
    });
    var theme = document.getElementById("theme-toggle");
    if (theme) actions.insertBefore(btn, theme);
    else actions.insertBefore(btn, actions.firstChild);
  }

  function showWelcome() {
    els.welcome.hidden = false;
    document.body.classList.add("story-welcome-open");
    if (els.lead) {
      els.lead.textContent =
        "Continue with AI assistance mode, or browse in Normal mode.";
    }
    setTimeout(function () {
      try {
        els.start.focus({ preventScroll: true });
      } catch (e) {}
    }, 40);
  }

  function hideWelcome() {
    els.welcome.hidden = true;
    document.body.classList.remove("story-welcome-open");
    try {
      sessionStorage.setItem(STORAGE_SEEN, "1");
    } catch (e) {}
  }

  function showFab() {
    els.fab.hidden = false;
  }

  function hideFab() {
    els.fab.hidden = true;
  }

  function chooseRead() {
    hideWelcome();
    stopSpeech();
    showFab();
    var toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "AI assist is in the corner if you want the walkthrough.";
      toast.classList.add("show");
      setTimeout(function () {
        toast.classList.remove("show");
      }, 2600);
    }
  }

  function startTour(i) {
    var begin = function () {
      state.list = buildSteps();
      state.index = Math.max(0, Math.min(i || 0, state.list.length - 1));
      state.playing = true;
      els.dock.hidden = false;
      document.documentElement.classList.add("story-playing");
      setHeavyFx(false);
      hideFab();
      hideWelcome();
      playStep();
    };
    if (state.wordsReady) state.wordsReady.then(begin).catch(begin);
    else begin();
  }

  function exitTour() {
    state.playing = false;
    stopSpeech();
    clearTimers();
    clearSpot();
    els.dock.hidden = true;
    document.documentElement.classList.remove("story-playing");
    setSpeaking(false);
    setHeavyFx(true);
    showFab();
  }

  function togglePlay() {
    if (state.playing) {
      state.playing = false;
      if (state.player) {
        try {
          state.player.pause();
        } catch (e) {}
      } else {
        stopSpeech();
      }
      clearTimers();
      setSpeaking(false);
      renderToggle();
    } else {
      state.playing = true;
      renderToggle();
      if (state.player && state.player.paused && !state.player.ended) {
        setSpeaking(true);
        startCaptionSync();
        state.player.play().catch(function () {
          playStep();
        });
      } else {
        playStep();
      }
    }
  }

  function toggleMute() {
    state.muted = !state.muted;
    if (state.muted) stopSpeech();
    els.mute.innerHTML = icon(state.muted ? "unmute" : "mute");
    els.mute.setAttribute("aria-label", state.muted ? "Unmute voice" : "Mute voice");
    if (state.playing && !state.muted) speakCurrent();
  }

  function renderToggle() {
    els.toggle.innerHTML = icon(state.playing ? "pause" : "play");
    els.toggle.setAttribute("aria-label", state.playing ? "Pause" : "Play");
  }

  function go(i) {
    if (i < 0 || i >= state.list.length) {
      if (i >= state.list.length) finish();
      return;
    }
    state.index = i;
    state.playing = true;
    playStep();
  }

  function finish() {
    exitTour();
  }

  function buildSteps() {
    var pack = state.wordsPack;
    return defaultSteps().map(function (step) {
      var next = Object.assign({}, step);
      if (pack && pack.texts && pack.texts[step.id]) next.text = pack.texts[step.id];
      if (pack && pack.words && pack.words[step.id]) next.words = pack.words[step.id];
      return next;
    });
  }

  function setHeavyFx(on) {
    try {
      if (window.__threeScene) {
        if (on) window.__threeScene.start();
        else window.__threeScene.stop();
      }
    } catch (e) {}
    var particles = document.getElementById("particles-js");
    if (particles) particles.style.visibility = on ? "visible" : "hidden";
    var glow = document.getElementById("cursor-glow");
    if (glow) glow.style.visibility = on ? "visible" : "hidden";
  }

  function playStep() {
    var step = state.list[state.index];
    if (!step) return finish();

    stopSpeech();
    clearTimers();
    renderToggle();

    var n = state.list.length;
    els.title.textContent = step.title;
    els.count.textContent = state.index + 1 + " / " + n;
    els.bar.style.width = ((state.index + 1) / n) * 100 + "%";
    els.prev.disabled = state.index === 0;
    els.next.disabled = false;

    applyAction(step.action);
    var instant = !!(step.action && step.action.indexOf("job:") === 0);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        spot(step.target, step.align, instant);
        var timeline = document.getElementById("timeline");
        if (timeline) timeline.classList.remove("story-layout-lock");
        if (instant) {
          clearTimeout(state.spotTimer);
          state.spotTimer = setTimeout(function () {
            if (!state.playing || state.list[state.index] !== step) return;
            spot(step.target, step.align, true);
          }, 80);
        }
      });
    });

    var text = fill(step.text);
    state.words = step.words || [];
    if (els.caption) els.caption.textContent = reduced ? text : "";

    if (!state.muted) speakCurrent();
    else {
      if (els.caption) els.caption.textContent = text;
      scheduleAdvance(Math.min(estimateMs(text), 3500));
    }
  }

  function applyAction(action) {
    if (!action) return;
    var parts = action.split(":");
    var kind = parts[0];
    var val = parts.slice(1).join(":");

    if (kind === "impact") {
      var btn = document.querySelector('[data-impact-filter="' + val + '"]');
      if (btn) btn.click();
    }
    if (kind === "job") {
      var timeline = document.getElementById("timeline");
      if (timeline) timeline.classList.add("story-layout-lock");
      document.querySelectorAll(".timeline-item").forEach(function (item) {
        var on = item.getAttribute("data-company") === val;
        item.classList.toggle("open", on);
        var b = item.querySelector("[data-expand]");
        if (b) b.setAttribute("aria-expanded", on ? "true" : "false");
      });
      if (timeline) void timeline.offsetHeight;
    }
    if (kind === "skill") {
      var all = document.querySelector('.skill-cat[data-skill-cat="all"]');
      if (all) all.click();
      setTimeout(function () {
        var chip = document.querySelector('.skill-chip[data-skill="' + val + '"]');
        if (chip) chip.click();
      }, 40);
    }
  }

  function spot(sel, align, instant) {
    clearSpot();
    if (!sel) return;
    var el = document.querySelector(sel);
    if (!el) return;
    el.classList.add("story-spot");
    var nav = document.getElementById("nav");
    var navH = nav ? nav.getBoundingClientRect().height : 72;
    var pad = navH + 28;
    var block = align || "center";
    var measure =
      el.classList && el.classList.contains("timeline-item")
        ? el.querySelector(".timeline-header") || el
        : el;
    var elTop = measure.getBoundingClientRect().top + window.pageYOffset;
    var top;
    if (block === "start") {
      top = elTop - pad;
    } else {
      var mid = elTop + measure.offsetHeight / 2;
      top = mid - window.innerHeight * 0.4;
      if (top > elTop - pad) top = elTop - pad;
    }
    window.scrollTo({
      top: Math.max(0, top),
      behavior: instant || reduced ? "auto" : "smooth",
    });
  }

  function clearSpot() {
    document.querySelectorAll(".story-spot").forEach(function (n) {
      n.classList.remove("story-spot");
    });
  }

  function estimateMs(text) {
    var words = String(text).trim().split(/\s+/).length;
    return Math.max(1800, Math.round((words / 190) * 60000) + 400);
  }

  function captionAt(time) {
    if (!state.words.length) return fill((state.list[state.index] || {}).text || "");
    var out = [];
    var i;
    for (i = 0; i < state.words.length; i++) {
      if (state.words[i].t <= time + 0.04) out.push(state.words[i].w);
      else break;
    }
    return out.join(" ");
  }

  function startCaptionSync() {
    if (state.captionRaf) cancelAnimationFrame(state.captionRaf);
    function tick() {
      if (!state.player || !els.caption) return;
      els.caption.textContent = captionAt(state.player.currentTime);
      state.captionRaf = requestAnimationFrame(tick);
    }
    state.captionRaf = requestAnimationFrame(tick);
  }

  function scheduleAdvance(ms) {
    clearTimeout(state.advanceTimer);
    state.advanceTimer = setTimeout(function () {
      if (!state.playing) return;
      go(state.index + 1);
    }, ms);
  }

  function speakCurrent() {
    var step = state.list[state.index];
    if (!step) return;
    var text = fill(step.text);
    stopSpeech();
    if (step.audio) {
      playFile(basePath() + step.audio, text);
      return;
    }
    speakFallback(text);
  }

  function playFile(src, fallbackText) {
    var audio = new Audio(src);
    audio.preload = "auto";
    audio.playbackRate = 1;
    state.player = audio;
    setSpeaking(true);
    startCaptionSync();
    audio.onended = function () {
      if (state.player !== audio) return;
      setSpeaking(false);
      if (els.caption) els.caption.textContent = fallbackText;
      if (state.playing) scheduleAdvance(350);
    };
    audio.onerror = function () {
      if (state.player !== audio) return;
      state.player = null;
      if (els.caption) els.caption.textContent = fallbackText;
      speakFallback(fallbackText);
    };
    var playPromise = audio.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {
        if (els.caption) els.caption.textContent = fallbackText;
        speakFallback(fallbackText);
      });
    }
  }

  function speakFallback(text) {
    if (!window.speechSynthesis) {
      scheduleAdvance(estimateMs(text));
      return;
    }
    var spoken = text
      .replace(/—/g, ". ")
      .replace(/\s+/g, " ")
      .trim();
    var u = new SpeechSynthesisUtterance(spoken);
    u.rate = 1.12;
    u.pitch = 0.95;
    u.lang = "en-IN";
    var voice = pickVoice();
    if (voice) {
      u.voice = voice;
      if (voice.lang) u.lang = voice.lang;
    }
    u.onstart = function () {
      setSpeaking(true);
    };
    u.onend = function () {
      setSpeaking(false);
      if (state.playing && state.utterance === u) scheduleAdvance(650);
    };
    u.onerror = function () {
      setSpeaking(false);
      if (state.playing) scheduleAdvance(estimateMs(text));
    };
    state.utterance = u;
    window.speechSynthesis.speak(u);
  }

  function stopSpeech() {
    state.utterance = null;
    if (state.player) {
      try {
        state.player.onended = null;
        state.player.onerror = null;
        state.player.pause();
        state.player.src = "";
      } catch (e) {}
      state.player = null;
    }
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {}
    setSpeaking(false);
  }

  function clearTimers() {
    clearTimeout(state.advanceTimer);
    clearTimeout(state.spotTimer);
    if (state.captionRaf) {
      cancelAnimationFrame(state.captionRaf);
      state.captionRaf = 0;
    }
    if (state.typing) {
      clearInterval(state.typing);
      state.typing = null;
    }
  }

  function setSpeaking(on) {
    document.querySelectorAll(".story-avatar-wrap").forEach(function (n) {
      n.classList.toggle("is-speaking", on);
    });
  }

  function pickVoice() {
    var voices = state.voices.length
      ? state.voices
      : window.speechSynthesis
        ? window.speechSynthesis.getVoices()
        : [];
    if (!voices || !voices.length) return null;
    var scored = voices
      .map(function (v) {
        var n = (v.name || "") + " " + (v.lang || "");
        var score = 0;
        if (/en-IN/i.test(v.lang)) score += 6;
        if (/en-GB/i.test(v.lang)) score += 4;
        if (/^en/i.test(v.lang)) score += 3;
        if (/Ravi|Google UK|Daniel|Male|Sagar|Ashok/i.test(n)) score += 3;
        if (/Female|Samantha|Karen|Moira/i.test(n)) score -= 1;
        return { v: v, score: score };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });
    return scored[0] && scored[0].score > 0 ? scored[0].v : voices[0];
  }

  function loadVoices() {
    if (!window.speechSynthesis) return;
    state.voices = window.speechSynthesis.getVoices() || [];
    window.speechSynthesis.addEventListener("voiceschanged", function () {
      state.voices = window.speechSynthesis.getVoices() || [];
    });
  }

  function onKey(e) {
    if (e.key === "Escape") {
      if (!els.welcome.hidden) {
        chooseRead();
        e.preventDefault();
        return;
      }
      if (!els.dock.hidden) {
        exitTour();
        e.preventDefault();
      }
      return;
    }
    if (els.dock.hidden) return;
    if (e.key === " " && !/input|textarea|select/i.test((e.target || {}).tagName || "")) {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(state.index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(state.index - 1);
    }
  }

  function loadWordTimings() {
    state.wordsReady = fetch(basePath() + "assets/story-voice/words.json?v=kapil2")
      .then(function (r) {
        if (!r.ok) throw new Error("words");
        return r.json();
      })
      .then(function (data) {
        state.wordsPack = data;
      })
      .catch(function () {
        state.wordsPack = null;
      });
    return state.wordsReady;
  }

  function resetToTop() {
    try {
      if (history.scrollRestoration) history.scrollRestoration = "manual";
    } catch (e) {}
    if (location.hash && location.hash !== "#") {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e2) {}
    }
    window.scrollTo(0, 0);
  }

  function boot() {
    injectCss();
    resetToTop();
    build();
    loadVoices();
    loadWordTimings();

    var params = new URLSearchParams(location.search);
    var storyQ = params.get("story");
    if (storyQ === "1") {
      startTour(0);
    } else if (storyQ === "0") {
      showFab();
    } else {
      showWelcome();
    }
    requestAnimationFrame(function () {
      window.scrollTo(0, 0);
    });

    window.StoryMode = {
      start: function () {
        startTour(0);
      },
      exit: exitTour,
      play: function () {
        if (!state.playing) togglePlay();
      },
      pause: function () {
        if (state.playing) togglePlay();
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
