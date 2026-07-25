/**
 * particles.js — denser, interactive (hover + click), theme-aware
 */
(function () {
  "use strict";

  var booted = false;

  function isLight() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  function config() {
    var isMobile = window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
    var low = document.documentElement.classList.contains("perf-lite") || isMobile;
    var light = isLight();

    // Lean counts for faster paint / lower main-thread cost
    var count = low ? 22 : 48;

    return {
      particles: {
        number: {
          value: count,
          density: { enable: true, value_area: low ? 750 : 820 },
        },
        color: {
          value: light
            ? ["#1d4ed8", "#6d28d9", "#0f766e", "#2563eb"]
            : ["#60a5fa", "#a78bfa", "#34d399", "#93c5fd"],
        },
        shape: { type: "circle" },
        opacity: {
          value: light ? 0.45 : 0.5,
          random: true,
          anim: { enable: true, speed: 0.8, opacity_min: 0.12, sync: false },
        },
        size: {
          value: low ? 2.4 : 2.8,
          random: true,
          anim: {
            enable: !low,
            speed: 2.2,
            size_min: 0.6,
            sync: false,
          },
        },
        line_linked: {
          enable: true,
          distance: low ? 120 : 155,
          color: light ? "#1d4ed8" : "#60a5fa",
          opacity: light ? 0.18 : 0.2,
          width: 1.1,
        },
        move: {
          enable: true,
          speed: low ? 0.85 : 1.35,
          direction: "none",
          random: true,
          straight: false,
          out_mode: "out",
          bounce: false,
          attract: { enable: !low, rotateX: 800, rotateY: 1400 },
        },
      },
      interactivity: {
        // window so UI stays clickable while particles react to pointer
        detect_on: "window",
        events: {
          onhover: { enable: true, mode: low ? "grab" : "grab" },
          onclick: { enable: true, mode: "push" },
          resize: true,
        },
        modes: {
          grab: {
            distance: low ? 130 : 180,
            line_linked: { opacity: light ? 0.45 : 0.55 },
          },
          bubble: {
            distance: 160,
            size: 5,
            duration: 1.4,
            opacity: 0.85,
            speed: 2,
          },
          repulse: { distance: 120, duration: 0.35 },
          push: { particles_nb: low ? 3 : 5 },
          remove: { particles_nb: 2 },
        },
      },
      retina_detect: true,
    };
  }

  function destroyExisting() {
    try {
      if (window.pJSDom && window.pJSDom.length) {
        while (window.pJSDom.length) {
          var inst = window.pJSDom[0];
          if (inst && inst.pJS && inst.pJS.fn && inst.pJS.fn.vendors) {
            // cancel rAF if available
            if (inst.pJS.fn.drawAnimFrame) {
              cancelAnimationFrame(inst.pJS.fn.drawAnimFrame);
            }
          }
          if (inst && inst.pJS && inst.pJS.canvas && inst.pJS.canvas.el) {
            var parent = inst.pJS.canvas.el.parentNode;
            if (parent) parent.removeChild(inst.pJS.canvas.el);
          }
          window.pJSDom.splice(0, 1);
        }
      }
      var el = document.getElementById("particles-js");
      if (el) el.innerHTML = "";
    } catch (e) {}
  }

  function boot() {
    if (typeof particlesJS === "undefined") return;
    var el = document.getElementById("particles-js");
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.display = "none";
      return;
    }

    destroyExisting();
    particlesJS("particles-js", config());
    booted = true;

    // Theme-aware opacity
    el.style.opacity = isLight() ? "0.55" : "0.7";
  }

  function onTheme() {
    if (!booted) return;
    // Rebuild for clean color/link updates
    boot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(boot, 0);
    });
  } else {
    setTimeout(boot, 0);
  }

  document.addEventListener("visibilitychange", function () {
    var el = document.getElementById("particles-js");
    if (!el) return;
    el.style.visibility = document.hidden ? "hidden" : "visible";
  });

  window.addEventListener("themechange", onTheme);
})();
