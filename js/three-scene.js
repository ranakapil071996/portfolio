/**
 * Three.js interactive ambient scene — globe-like core, rings, satellites
 * Performance: DPR cap, pause on hide, reduced motion, low-power mode
 */
(function () {
  "use strict";

  const canvas = document.getElementById("three-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
  const isLowPower =
    isMobile ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4);

  if (isLowPower) document.documentElement.classList.add("perf-lite");

  let renderer, scene, camera, group, icosa, wire, torus, torus2, stars, satellites;
  let ambLight, dirLight, fillLight, coreLight;
  let rafId = 0;
  let running = false;
  let lastT = 0;
  let width = 0;
  let height = 0;
  let clickPulse = 0;
  let hoverBoost = 0;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const targetRot = { x: 0, y: 0 };

  const PALETTE = {
    dark: {
      core: 0x3b82f6,
      emissive: 0x1e3a8a,
      emissiveI: 0.4,
      opacity: 0.58,
      wire: 0x93c5fd,
      wireOp: 0.28,
      ring1: 0xa78bfa,
      ring2: 0x34d399,
      stars: 0x93c5fd,
      amb: 0x6688cc,
      canvasOp: "1",
      sat: 0x60a5fa,
    },
    light: {
      // Richer blues/teals that read well on pale backgrounds
      core: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveI: 0.55,
      opacity: 0.88,
      wire: 0x1e40af,
      wireOp: 0.45,
      ring1: 0x7c3aed,
      ring2: 0x0d9488,
      stars: 0x3b82f6,
      amb: 0x94a3b8,
      canvasOp: "0.85",
      sat: 0x4f46e5,
    },
  };

  function themeKey() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyPalette(key) {
    const p = PALETTE[key] || PALETTE.dark;
    if (icosa && icosa.material) {
      icosa.material.color.setHex(p.core);
      icosa.material.emissive.setHex(p.emissive);
      icosa.material.emissiveIntensity = p.emissiveI;
      icosa.material.opacity = p.opacity;
      icosa.material.metalness = key === "light" ? 0.35 : 0.55;
      icosa.material.roughness = key === "light" ? 0.28 : 0.35;
      icosa.material.needsUpdate = true;
    }
    if (wire && wire.material) {
      wire.material.color.setHex(p.wire);
      wire.material.opacity = p.wireOp;
      wire.material.needsUpdate = true;
    }
    if (torus && torus.material) {
      torus.material.color.setHex(p.ring1);
      torus.material.opacity = key === "light" ? 0.7 : 0.5;
      torus.material.needsUpdate = true;
    }
    if (torus2 && torus2.material) {
      torus2.material.color.setHex(p.ring2);
      torus2.material.opacity = key === "light" ? 0.55 : 0.32;
      torus2.material.needsUpdate = true;
    }
    if (stars && stars.material) {
      stars.material.color.setHex(p.stars);
      stars.material.opacity = key === "light" ? 0.55 : 0.75;
      stars.material.needsUpdate = true;
    }
    if (satellites) {
      satellites.forEach(function (s) {
        if (s.material) {
          s.material.color.setHex(p.sat);
          s.material.opacity = key === "light" ? 0.9 : 0.75;
        }
      });
    }
    if (ambLight) ambLight.color.setHex(p.amb);
    if (dirLight) dirLight.intensity = key === "light" ? 1.1 : 0.85;
    if (fillLight) fillLight.intensity = key === "light" ? 0.65 : 0.45;
    if (coreLight) {
      coreLight.color.setHex(p.core);
      coreLight.intensity = key === "light" ? 0.9 : 0.55;
    }
    canvas.style.opacity = p.canvasOp;
  }

  function init() {
    width = window.innerWidth;
    height = window.innerHeight;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: !isLowPower,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isLowPower ? 1.25 : 1.6));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 8;

    group = new THREE.Group();
    scene.add(group);

    ambLight = new THREE.AmbientLight(0x6688cc, 0.6);
    scene.add(ambLight);
    dirLight = new THREE.DirectionalLight(0xa78bfa, 0.85);
    dirLight.position.set(4, 6, 8);
    scene.add(dirLight);
    fillLight = new THREE.PointLight(0x34d399, 0.45, 40);
    fillLight.position.set(-6, -2, 4);
    scene.add(fillLight);
    coreLight = new THREE.PointLight(0x3b82f6, 0.55, 12);
    group.add(coreLight);

    // Globe-like icosahedron (keep subdivision low for GPU cost)
    const geo = new THREE.IcosahedronGeometry(1.65, isLowPower ? 0 : 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.4,
      metalness: 0.55,
      roughness: 0.35,
      transparent: true,
      opacity: 0.58,
    });
    icosa = new THREE.Mesh(geo, mat);
    group.add(icosa);

    wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.65, isLowPower ? 0 : 1),
      new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
      })
    );
    wire.scale.setScalar(1.03);
    group.add(wire);

    // Latitude-like torus rings
    torus = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.04, 12, isLowPower ? 64 : 100),
      new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.5 })
    );
    torus.rotation.x = Math.PI / 2.35;
    group.add(torus);

    torus2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.025, 10, isLowPower ? 48 : 80),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.32 })
    );
    torus2.rotation.x = Math.PI / 3.1;
    torus2.rotation.y = 0.55;
    group.add(torus2);

    // Orbiting satellites (interactive feel)
    satellites = [];
    const satCount = isLowPower ? 2 : 4;
    for (let i = 0; i < satCount; i++) {
      const sat = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 + (i % 3) * 0.02, 10, 10),
        new THREE.MeshStandardMaterial({
          color: 0x60a5fa,
          emissive: 0x1e40af,
          emissiveIntensity: 0.5,
          metalness: 0.6,
          roughness: 0.3,
          transparent: true,
          opacity: 0.85,
        })
      );
      sat.userData = {
        radius: 2.1 + (i % 3) * 0.35,
        speed: 0.4 + i * 0.12,
        phase: (i / satCount) * Math.PI * 2,
        tilt: 0.3 + (i % 4) * 0.2,
      };
      group.add(sat);
      satellites.push(sat);
    }

    // Star field (capped for load + frame time)
    const starCount = isLowPower ? 120 : 280;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 10 + Math.random() * 32;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) - 6;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0x93c5fd,
        size: isLowPower ? 0.04 : 0.032,
        transparent: true,
        opacity: 0.75,
        sizeAttenuation: true,
        depthWrite: false,
      })
    );
    scene.add(stars);

    group.position.set(isMobile ? 0 : 2.15, isMobile ? 0.35 : 0.15, 0);
    group.scale.setScalar(isMobile ? 0.72 : 1);

    applyPalette(themeKey());

    window.addEventListener("resize", onResize, { passive: true });
    if (!reducedMotion) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("click", onClick, { passive: true });
      // Hover boost when pointer is over right/hero visual area
      window.addEventListener(
        "pointermove",
        function (e) {
          const nx = e.clientX / width;
          const ny = e.clientY / height;
          // boost when near globe region (right half on desktop, center top on mobile)
          const inZone = isMobile ? ny < 0.45 : nx > 0.45;
          hoverBoost += ((inZone ? 1 : 0) - hoverBoost) * 0.08;
        },
        { passive: true }
      );
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("themechange", function (e) {
      applyPalette(e.detail && e.detail.theme === "light" ? "light" : "dark");
    });

    if (!reducedMotion) start();
    else renderer.render(scene, camera);
  }

  function onPointer(e) {
    mouse.tx = (e.clientX / width) * 2 - 1;
    mouse.ty = -(e.clientY / height) * 2 + 1;
  }

  function onClick() {
    clickPulse = 1;
  }

  function onResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isLowPower ? 1.25 : 1.6));
    renderer.setSize(width, height, false);
  }

  function onVisibility() {
    if (document.hidden) stop();
    else if (!reducedMotion) start();
  }

  function start() {
    if (running) return;
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function tick(now) {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const t = now * 0.001;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    targetRot.y = mouse.x * 0.45;
    targetRot.x = mouse.y * 0.28;

    // Click pulse decay
    if (clickPulse > 0) clickPulse = Math.max(0, clickPulse - dt * 1.8);

    const pulse = 1 + clickPulse * 0.12 + hoverBoost * 0.04;

    if (group) {
      group.rotation.y += (targetRot.y - group.rotation.y) * 0.06;
      group.rotation.x += (targetRot.x - group.rotation.x) * 0.06;
      group.rotation.y += dt * (0.1 + hoverBoost * 0.15);
      group.scale.setScalar((isMobile ? 0.72 : 1) * pulse);
    }

    if (icosa) {
      icosa.rotation.y += dt * (0.32 + hoverBoost * 0.2);
      icosa.rotation.x += dt * 0.1;
      if (icosa.material) {
        const base = themeKey() === "light" ? 0.55 : 0.4;
        icosa.material.emissiveIntensity = base + clickPulse * 0.45 + hoverBoost * 0.15;
      }
    }

    if (wire) {
      wire.rotation.y -= dt * 0.18;
      wire.rotation.z += dt * 0.05;
    }

    if (torus) {
      torus.rotation.z += dt * (0.22 + hoverBoost * 0.1);
      torus.rotation.y += dt * 0.06;
    }

    if (torus2) {
      torus2.rotation.z -= dt * 0.16;
      torus2.rotation.x += dt * 0.03;
    }

    if (satellites) {
      satellites.forEach(function (sat) {
        const u = sat.userData;
        const a = t * u.speed + u.phase;
        sat.position.x = Math.cos(a) * u.radius;
        sat.position.y = Math.sin(a * 0.7) * u.tilt;
        sat.position.z = Math.sin(a) * u.radius * 0.85;
      });
    }

    if (stars) {
      stars.rotation.y += dt * 0.018;
      stars.rotation.x += dt * 0.006;
    }

    if (coreLight) {
      coreLight.intensity = (themeKey() === "light" ? 0.85 : 0.5) + clickPulse * 0.8;
    }

    camera.position.x += (mouse.x * 0.55 - camera.position.x) * 0.035;
    camera.position.y += (mouse.y * 0.35 - camera.position.y) * 0.035;
    camera.lookAt(isMobile ? 0 : 1.2, 0, 0);

    renderer.render(scene, camera);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else if (typeof THREE !== "undefined") {
    init();
  } else {
    window.addEventListener("load", init);
  }

  window.__threeScene = { start: start, stop: stop, applyPalette: applyPalette };
})();
