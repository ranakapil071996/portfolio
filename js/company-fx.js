/**
 * Heavy particles.js + Three.js for company resume pages.
 * Modes driven by company.threeMode / company.particlesMode.
 */
(function () {
  "use strict";

  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || window.innerWidth < 768;

  function hexToRgb(hex) {
    hex = (hex || "#2563eb").replace("#", "");
    if (hex.length === 3)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  /* ---------- Particles ---------- */
  function bootParticles(company) {
    if (typeof particlesJS === "undefined") return;
    var el = document.getElementById("cr-particles");
    if (!el) return;

    var mode = company.particlesMode || "constellation";
    var heavy = company.fxIntensity === "heavy" && !isMobile;
    var count = heavy ? 140 : isMobile ? 45 : 90;
    var primary = company.primary || "#60a5fa";
    var secondary = company.secondary || "#0f172a";
    var colors = [primary, company.primaryDark || primary, secondary];

    var cfg = {
      particles: {
        number: { value: count, density: { enable: true, value_area: 700 } },
        color: { value: colors },
        shape: { type: "circle" },
        opacity: {
          value: 0.55,
          random: true,
          anim: { enable: true, speed: 1.2, opacity_min: 0.12, sync: false },
        },
        size: {
          value: 3.2,
          random: true,
          anim: { enable: true, speed: 3.5, size_min: 0.4, sync: false },
        },
        line_linked: {
          enable: true,
          distance: 150,
          color: primary,
          opacity: 0.28,
          width: 1.2,
        },
        move: {
          enable: true,
          speed: heavy ? 2.4 : 1.4,
          direction: "none",
          random: true,
          straight: false,
          out_mode: "out",
          bounce: false,
          attract: { enable: true, rotateX: 800, rotateY: 1400 },
        },
      },
      interactivity: {
        detect_on: "window",
        events: {
          onhover: { enable: true, mode: "grab" },
          onclick: { enable: true, mode: "push" },
          resize: true,
        },
        modes: {
          grab: { distance: 200, line_linked: { opacity: 0.65 } },
          bubble: { distance: 200, size: 8, duration: 1.2, opacity: 0.9, speed: 3 },
          repulse: { distance: 140, duration: 0.4 },
          push: { particles_nb: heavy ? 8 : 4 },
        },
      },
      retina_detect: true,
    };

    // Mode-specific overrides
    if (mode === "energy" || mode === "burst") {
      cfg.particles.move.speed = heavy ? 3.5 : 2;
      cfg.particles.line_linked.distance = 120;
      cfg.interactivity.events.onhover.mode = "repulse";
    }
    if (mode === "embers" || mode === "rain") {
      cfg.particles.move.direction = mode === "rain" ? "bottom" : "top";
      cfg.particles.move.straight = mode === "rain";
      cfg.particles.line_linked.enable = mode !== "rain";
      cfg.particles.size.value = mode === "embers" ? 2.5 : 2;
    }
    if (mode === "bubbles") {
      cfg.particles.shape.type = "circle";
      cfg.particles.size.value = 6;
      cfg.particles.opacity.value = 0.25;
      cfg.particles.line_linked.enable = false;
      cfg.particles.move.speed = 1.1;
    }
    if (mode === "neon" || mode === "fintech") {
      cfg.particles.number.value = heavy ? 160 : 80;
      cfg.particles.line_linked.opacity = 0.4;
      cfg.particles.move.speed = 2.8;
    }
    if (mode === "matrix" || mode === "nodes") {
      cfg.particles.shape.type = mode === "matrix" ? "edge" : "circle";
      cfg.particles.line_linked.distance = 170;
      cfg.particles.number.value = heavy ? 150 : 70;
    }
    if (mode === "grid") {
      cfg.particles.move.straight = true;
      cfg.particles.move.direction = "right";
      cfg.particles.line_linked.distance = 100;
    }
    if (mode === "dust" || mode === "soft-mesh") {
      cfg.particles.line_linked.enable = false;
      cfg.particles.size.value = 2;
      cfg.particles.number.value = heavy ? 180 : 70;
      cfg.particles.move.speed = 0.7;
    }
    if (mode === "orbit") {
      cfg.particles.move.attract.enable = true;
      cfg.particles.line_linked.distance = 180;
    }
    if (mode === "bounce") {
      cfg.particles.move.bounce = true;
      cfg.particles.move.out_mode = "bounce";
    }
    if (mode === "links") {
      cfg.particles.line_linked.opacity = 0.45;
      cfg.particles.number.value = heavy ? 120 : 60;
    }

    particlesJS("cr-particles", cfg);
  }

  /* ---------- Three.js ---------- */
  function bootThree(company) {
    if (typeof THREE === "undefined") return;
    var canvas = document.getElementById("cr-three");
    if (!canvas) return;

    var mode = company.threeMode || "orbs";
    var heavy = company.fxIntensity === "heavy" && !isMobile;
    var primary = company.primary || "#3b82f6";
    var primaryDark = company.primaryDark || primary;
    var secondary = company.secondary || "#0f172a";
    var rgb = hexToRgb(primary);

    var w = window.innerWidth;
    var h = window.innerHeight;
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.z = 9;

    var amb = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(amb);
    var dir = new THREE.DirectionalLight(parseInt(primary.replace("#", "0x")), 1.1);
    dir.position.set(4, 5, 8);
    scene.add(dir);
    var point = new THREE.PointLight(parseInt(primaryDark.replace("#", "0x")), 0.9, 40);
    point.position.set(-5, -2, 4);
    scene.add(point);

    var group = new THREE.Group();
    scene.add(group);
    var meshes = [];
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    var clickPulse = 0;

    function matStandard(color, opacity) {
      return new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.35,
        metalness: 0.45,
        roughness: 0.35,
        transparent: true,
        opacity: opacity == null ? 0.55 : opacity,
      });
    }

    function addWire(geo, color, scale) {
      var m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: color,
          wireframe: true,
          transparent: true,
          opacity: 0.28,
        })
      );
      if (scale) m.scale.setScalar(scale);
      group.add(m);
      meshes.push(m);
      return m;
    }

    if (mode === "orbs") {
      var geo = new THREE.IcosahedronGeometry(1.8, heavy ? 2 : 1);
      var core = new THREE.Mesh(geo, matStandard(parseInt(primary.replace("#", "0x")), 0.5));
      group.add(core);
      meshes.push(core);
      addWire(geo.clone(), parseInt(primaryDark.replace("#", "0x")), 1.08);
      for (var i = 0; i < (heavy ? 8 : 4); i++) {
        var sat = new THREE.Mesh(
          new THREE.SphereGeometry(0.12 + (i % 3) * 0.04, 12, 12),
          matStandard(parseInt(primary.replace("#", "0x")), 0.85)
        );
        sat.userData = { r: 2.2 + i * 0.25, s: 0.5 + i * 0.15, p: (i / 8) * Math.PI * 2 };
        group.add(sat);
        meshes.push(sat);
      }
    } else if (mode === "torus") {
      var t1 = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.08, 16, heavy ? 120 : 64),
        matStandard(parseInt(primary.replace("#", "0x")), 0.7)
      );
      t1.rotation.x = Math.PI / 2.5;
      group.add(t1);
      meshes.push(t1);
      var t2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.8, 0.05, 12, heavy ? 100 : 48),
        matStandard(parseInt(primaryDark.replace("#", "0x")), 0.45)
      );
      t2.rotation.x = Math.PI / 3;
      t2.rotation.y = 0.6;
      group.add(t2);
      meshes.push(t2);
      var ball = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.1, 1),
        matStandard(parseInt(primary.replace("#", "0x")), 0.4)
      );
      group.add(ball);
      meshes.push(ball);
    } else if (mode === "boxes") {
      var n = heavy ? 28 : 14;
      for (var b = 0; b < n; b++) {
        var size = 0.25 + Math.random() * 0.55;
        var box = new THREE.Mesh(
          new THREE.BoxGeometry(size, size, size),
          matStandard(parseInt(primary.replace("#", "0x")), 0.35 + Math.random() * 0.35)
        );
        box.position.set(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 4
        );
        box.rotation.set(Math.random() * 2, Math.random() * 2, 0);
        box.userData = { spin: 0.2 + Math.random() * 0.8 };
        group.add(box);
        meshes.push(box);
      }
    } else if (mode === "stars") {
      var count = heavy ? 900 : 400;
      var pos = new Float32Array(count * 3);
      for (var s = 0; s < count; s++) {
        var r = 8 + Math.random() * 25;
        var th = Math.random() * Math.PI * 2;
        var ph = Math.acos(2 * Math.random() - 1);
        pos[s * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[s * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
        pos[s * 3 + 2] = r * Math.cos(ph) - 5;
      }
      var st = new THREE.Points(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3)),
        new THREE.PointsMaterial({
          color: parseInt(primary.replace("#", "0x")),
          size: 0.04,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        })
      );
      scene.add(st);
      meshes.push(st);
      var core2 = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.4, 0),
        matStandard(parseInt(primary.replace("#", "0x")), 0.45)
      );
      group.add(core2);
      meshes.push(core2);
    } else if (mode === "network") {
      var nodes = heavy ? 40 : 22;
      var nodeMeshes = [];
      for (var n2 = 0; n2 < nodes; n2++) {
        var node = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 10, 10),
          matStandard(parseInt(primary.replace("#", "0x")), 0.9)
        );
        node.position.set(
          (Math.random() - 0.5) * 7,
          (Math.random() - 0.5) * 4.5,
          (Math.random() - 0.5) * 3
        );
        group.add(node);
        nodeMeshes.push(node);
        meshes.push(node);
      }
      // lines between nearby nodes
      var lineMat = new THREE.LineBasicMaterial({
        color: parseInt(primary.replace("#", "0x")),
        transparent: true,
        opacity: 0.25,
      });
      for (var i1 = 0; i1 < nodeMeshes.length; i1++) {
        for (var j1 = i1 + 1; j1 < nodeMeshes.length; j1++) {
          if (nodeMeshes[i1].position.distanceTo(nodeMeshes[j1].position) < 2.2) {
            var lg = new THREE.BufferGeometry().setFromPoints([
              nodeMeshes[i1].position,
              nodeMeshes[j1].position,
            ]);
            group.add(new THREE.Line(lg, lineMat));
          }
        }
      }
    } else if (mode === "crystal") {
      var crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.9, heavy ? 1 : 0),
        matStandard(parseInt(primary.replace("#", "0x")), 0.5)
      );
      group.add(crystal);
      meshes.push(crystal);
      addWire(new THREE.OctahedronGeometry(1.9, 0), parseInt(primaryDark.replace("#", "0x")), 1.12);
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.04, 12, 80),
        matStandard(parseInt(primary.replace("#", "0x")), 0.55)
      );
      ring.rotation.x = Math.PI / 2.2;
      group.add(ring);
      meshes.push(ring);
    } else {
      // default orbs
      var dgeo = new THREE.IcosahedronGeometry(1.6, 1);
      var dcore = new THREE.Mesh(dgeo, matStandard(parseInt(primary.replace("#", "0x")), 0.5));
      group.add(dcore);
      meshes.push(dcore);
    }

    // Position based on layout (right side bias for most)
    group.position.set(isMobile ? 0 : 2.4, 0.2, 0);
    if (company.layout === "sidebar") group.position.set(-2.2, 0.5, 0);
    if (company.layout === "magazine") group.position.set(2.8, -0.3, 0);

    function onResize() {
      w = window.innerWidth;
      h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener(
      "pointermove",
      function (e) {
        mouse.tx = (e.clientX / w) * 2 - 1;
        mouse.ty = -(e.clientY / h) * 2 + 1;
      },
      { passive: true }
    );
    window.addEventListener(
      "click",
      function () {
        clickPulse = 1;
      },
      { passive: true }
    );

    var last = performance.now();
    var running = true;
    function tick(now) {
      if (!running) return;
      requestAnimationFrame(tick);
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      var t = now * 0.001;
      if (clickPulse > 0) clickPulse = Math.max(0, clickPulse - dt * 1.6);

      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;

      group.rotation.y += dt * 0.25 + mouse.x * 0.002;
      group.rotation.x += (mouse.y * 0.35 - group.rotation.x) * 0.04;
      group.scale.setScalar(1 + clickPulse * 0.1);

      meshes.forEach(function (m, idx) {
        if (m.userData && m.userData.r != null) {
          var a = t * m.userData.s + m.userData.p;
          m.position.x = Math.cos(a) * m.userData.r;
          m.position.y = Math.sin(a * 0.7) * 0.6;
          m.position.z = Math.sin(a) * m.userData.r * 0.8;
        } else if (m.userData && m.userData.spin) {
          m.rotation.x += dt * m.userData.spin;
          m.rotation.y += dt * m.userData.spin * 0.7;
        } else if (m.isPoints) {
          m.rotation.y += dt * 0.04;
        } else if (m.geometry && m.geometry.type !== "BufferGeometry") {
          m.rotation.y += dt * (0.15 + (idx % 5) * 0.02);
        }
      });

      camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.04;
      camera.position.y += (mouse.y * 0.35 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      point.intensity = 0.7 + clickPulse * 1.2;
      renderer.render(scene, camera);
    }

    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running) {
        last = performance.now();
        requestAnimationFrame(tick);
      }
    });

    if (!reduced) requestAnimationFrame(tick);
    else renderer.render(scene, camera);

    window.__companyThree = { renderer: renderer, scene: scene };
  }

  function start(company) {
    if (reduced) {
      document.documentElement.classList.add("fx-reduced");
      return;
    }
    var THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    var PART_SRC = "https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js";

    Promise.all([loadScript(THREE_SRC), loadScript(PART_SRC)])
      .then(function () {
        bootParticles(company);
        bootThree(company);
        document.documentElement.classList.add("fx-ready");
      })
      .catch(function () {
        document.documentElement.classList.add("fx-failed");
      });
  }

  window.CompanyFX = { start: start };
})();
