/**
 * Lazy-load Three.js + particles after first paint / idle.
 * Keeps initial JS payload small for employers measuring LCP / TBT.
 */
(function () {
  "use strict";

  if (window.__effectsBootstrapped) return;
  window.__effectsBootstrapped = true;

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData =
    navigator.connection &&
    (navigator.connection.saveData ||
      /2g/.test(navigator.connection.effectiveType || ""));

  // Skip heavy visuals on reduced motion or data-saver
  if (reduced || saveData) {
    var canvas = document.getElementById("three-canvas");
    var particles = document.getElementById("particles-js");
    if (canvas) canvas.style.display = "none";
    if (particles) particles.style.display = "none";
    document.documentElement.classList.add("perf-lite", "effects-off");
    return;
  }

  var loaded = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("Failed: " + src));
      };
      document.body.appendChild(s);
    });
  }

  function bootEffects() {
    if (loaded) return;
    loaded = true;

    var THREE_SRC =
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    var PARTICLES_SRC =
      "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js";

    // Load in parallel where possible; three-scene needs THREE global
    Promise.all([loadScript(THREE_SRC), loadScript(PARTICLES_SRC)])
      .then(function () {
        return Promise.all([
          loadScript("js/three-scene.js"),
          loadScript("js/particles-config.js"),
        ]);
      })
      .catch(function () {
        document.documentElement.classList.add("effects-off");
      });
  }

  function schedule() {
    // Prefer idle; hard cap so effects appear soon without blocking TTI
    if ("requestIdleCallback" in window) {
      requestIdleCallback(
        function () {
          bootEffects();
        },
        { timeout: 2200 }
      );
    } else {
      setTimeout(bootEffects, 1200);
    }
  }

  // Also load on first user gesture (feels instant if idle is late)
  var onceOpts = { once: true, passive: true };
  function onInteract() {
    bootEffects();
  }
  window.addEventListener("pointerdown", onInteract, onceOpts);
  window.addEventListener("touchstart", onInteract, onceOpts);
  window.addEventListener("keydown", onInteract, onceOpts);

  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
  }
})();
