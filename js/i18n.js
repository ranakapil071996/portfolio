/**
 * Single-source i18n for portfolio + company resumes.
 * - No duplicated page components
 * - RTL for Arabic
 * - Localized meta / Open Graph / JSON-LD
 * - hreflang + document language
 */
(function (global) {
  "use strict";

  var SUPPORTED = ["en", "de", "fr", "es", "ja", "ar", "hi"];
  var RTL = { ar: true };
  var DEFAULT = "en";
  var STORAGE_KEY = "portfolio-lang";
  var cache = {};
  var current = DEFAULT;
  var basePrefix = ""; // e.g. "" or ".." from company pages

  function getBase() {
    if (global.__I18N_BASE != null) return global.__I18N_BASE;
    // company pages under /wolt/ → ../i18n/
    // lang pages under /de/ → ../i18n/
    // root → i18n/
    var path = location.pathname.replace(/\\/g, "/");
    if (/\/(en|de|fr|es|ja|ar|hi)\/?$/.test(path) || /\/(en|de|fr|es|ja|ar|hi)\/index\.html$/.test(path)) {
      return "../";
    }
    // /wolt/ or /for/
    if (/\/[a-z0-9-]+\/?$/.test(path) && !/index\.html$/.test(path.split("/").pop() || "")) {
      var seg = path.replace(/\/+$/, "").split("/").pop();
      if (SUPPORTED.indexOf(seg) === -1 && seg !== "" && seg.indexOf(".") === -1) {
        // might be company slug or "for"
        return "../";
      }
    }
    if (path.indexOf("/for/") !== -1 || /\/[a-z0-9-]+\/index\.html$/.test(path)) {
      return "../";
    }
    return "";
  }

  function detectLang() {
    if (global.__LANG && SUPPORTED.indexOf(global.__LANG) !== -1) return global.__LANG;
    var path = location.pathname.replace(/\\/g, "/");
    var m = path.match(/\/(en|de|fr|es|ja|ar|hi)(?:\/|$)/);
    if (m) return m[1];
    var q = new URLSearchParams(location.search).get("lang");
    if (q && SUPPORTED.indexOf(q) !== -1) return q;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (e) {}
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (SUPPORTED.indexOf(nav) !== -1) return nav;
    return DEFAULT;
  }

  function t(dict, path) {
    if (!dict) return path;
    var parts = path.split(".");
    var cur = dict;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return path;
      cur = cur[parts[i]];
    }
    return cur == null ? path : cur;
  }

  function loadLocale(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);
    var base = getBase();
    var url = base + "i18n/locales/" + lang + ".json";
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("locale " + lang);
        return r.json();
      })
      .then(function (data) {
        cache[lang] = data;
        return data;
      })
      .catch(function () {
        if (lang !== DEFAULT) return loadLocale(DEFAULT);
        return enFallback();
      });
  }

  function enFallback() {
    return cache.en || { meta: { lang: "en", dir: "ltr", title: document.title }, nav: {}, hero: {} };
  }

  function setMetaById(id, attr, value) {
    var el = document.getElementById(id);
    if (el && value != null) el.setAttribute(attr, value);
  }

  function setMetaName(selector, value) {
    var el = document.querySelector(selector);
    if (el && value != null) el.setAttribute("content", value);
  }

  function absoluteUrl(path) {
    try {
      var origin = location.origin;
      var root = location.pathname;
      // strip trailing file / lang
      root = root.replace(/\/index\.html$/, "").replace(/\/(en|de|fr|es|ja|ar|hi)\/?$/, "/");
      if (!root.endsWith("/")) {
        var parts = root.split("/");
        if (parts[parts.length - 1].indexOf(".") !== -1) parts.pop();
        root = parts.join("/") + "/";
      }
      // for company pages base is one level down
      var base = getBase();
      if (base === "../") {
        root = root.replace(/\/[^/]+\/?$/, "/");
      }
      if (path.charAt(0) === "/") path = path.slice(1);
      return origin + root + path;
    } catch (e) {
      return path;
    }
  }

  function updateHead(dict, lang) {
    var meta = dict.meta || {};
    document.documentElement.lang = meta.lang || lang;
    document.documentElement.dir = meta.dir || (RTL[lang] ? "rtl" : "ltr");
    document.documentElement.setAttribute("data-lang", lang);
    if (meta.dir === "rtl" || RTL[lang]) {
      document.documentElement.classList.add("rtl");
    } else {
      document.documentElement.classList.remove("rtl");
    }

    if (meta.title) document.title = meta.title;
    setMetaName('meta[name="description"]', meta.description);
    setMetaById("meta-desc", "content", meta.description);
    setMetaName('meta[property="og:title"]', meta.ogTitle || meta.title);
    setMetaById("og-title", "content", meta.ogTitle || meta.title);
    setMetaName('meta[property="og:description"]', meta.ogDescription || meta.description);
    setMetaById("og-description", "content", meta.ogDescription || meta.description);
    setMetaName('meta[property="og:locale"]', meta.ogLocale || lang);
    setMetaName('meta[property="og:site_name"]', meta.siteName);
    setMetaName('meta[name="twitter:title"]', meta.twitterTitle || meta.ogTitle);
    setMetaById("twitter-title", "content", meta.twitterTitle || meta.ogTitle);
    setMetaName('meta[name="twitter:description"]', meta.twitterDescription || meta.ogDescription);
    setMetaById("twitter-description", "content", meta.twitterDescription || meta.ogDescription);
    setMetaById("og-image-alt", "content", meta.imageAlt);
    setMetaName('meta[property="og:image:alt"]', meta.imageAlt);
    setMetaName('meta[name="twitter:image:alt"]', meta.imageAlt);

    // locale URL
    var pageUrl = absoluteUrl(lang + "/");
    setMetaById("og-url", "content", pageUrl);
    setMetaById("canonical-link", "href", pageUrl);
    setMetaName('meta[property="og:url"]', pageUrl);

    // hreflang
    ensureHreflang(lang);

    // JSON-LD
    updateJsonLd(dict, lang, pageUrl);
  }

  function ensureHreflang(activeLang) {
    // remove old
    document.querySelectorAll('link[data-i18n-hreflang]').forEach(function (n) {
      n.remove();
    });
    var head = document.head;
    SUPPORTED.forEach(function (code) {
      var link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = code;
      link.href = absoluteUrl(code + "/");
      link.setAttribute("data-i18n-hreflang", code);
      head.appendChild(link);
    });
    var xdef = document.createElement("link");
    xdef.rel = "alternate";
    xdef.hreflang = "x-default";
    xdef.href = absoluteUrl("en/");
    xdef.setAttribute("data-i18n-hreflang", "x-default");
    head.appendChild(xdef);
  }

  function updateJsonLd(dict, lang, pageUrl) {
    var jl = dict.jsonLd || {};
    var person = document.getElementById("ld-person");
    if (person) {
      try {
        var data = JSON.parse(person.textContent);
        data.jobTitle = jl.jobTitle || data.jobTitle;
        data.description = jl.description || data.description;
        data.url = pageUrl;
        if (data.worksFor && jl.worksFor) data.worksFor.name = jl.worksFor;
        if (jl.knowsAbout) data.knowsAbout = jl.knowsAbout;
        person.textContent = JSON.stringify(data);
      } catch (e) {}
    }
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (script) {
      if (script.id === "ld-person") return;
      try {
        var d = JSON.parse(script.textContent);
        if (d["@type"] === "WebSite") {
          d.name = jl.webSiteName || d.name;
          d.description = jl.webSiteDescription || d.description;
          d.url = pageUrl;
          d.inLanguage = lang;
          script.textContent = JSON.stringify(d);
        }
        if (d["@type"] === "ProfilePage") {
          d.name = jl.profilePageName || d.name;
          d.url = pageUrl;
          d.inLanguage = lang;
          script.textContent = JSON.stringify(d);
        }
      } catch (e) {}
    });
  }

  function applyDom(dict) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = t(dict, key);
      if (val == null || val === key) return;
      var mode = el.getAttribute("data-i18n-mode") || "text";
      if (mode === "html") {
        el.innerHTML = val;
      } else if (mode === "attr") {
        var attr = el.getAttribute("data-i18n-attr") || "content";
        el.setAttribute(attr, String(val).replace(/\{year\}/g, String(new Date().getFullYear())));
      } else {
        var s = String(val).replace(/\{year\}/g, String(new Date().getFullYear()));
        el.textContent = s;
      }
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      var val = t(dict, key);
      if (val && val !== key) el.setAttribute("aria-label", val);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      var val = t(dict, key);
      if (val && val !== key) el.setAttribute("placeholder", val);
    });

    // footer year
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  function renderLangSwitcher(dict, lang) {
    var host = document.getElementById("lang-switcher");
    if (!host) return;
    var names = (dict.langNames) || {};
    var label = t(dict, "nav.lang") || "Language";
    host.innerHTML =
      '<label class="lang-switcher-label" for="lang-select">' +
      escapeHtml(label) +
      '</label><select id="lang-select" class="lang-select" aria-label="' +
      escapeHtml(label) +
      '">' +
      SUPPORTED.map(function (code) {
        return (
          '<option value="' +
          code +
          '"' +
          (code === lang ? " selected" : "") +
          ">" +
          escapeHtml(names[code] || code) +
          "</option>"
        );
      }).join("") +
      "</select>";

    var sel = document.getElementById("lang-select");
    if (sel) {
      sel.addEventListener("change", function () {
        setLanguage(sel.value, true);
      });
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function navigateToLang(lang) {
    var base = getBase();
    // From root: go to lang/
    // From /de/: go to ../fr/
    // From /wolt/: go to ../fr/ or stay with ?lang=
    var path = location.pathname.replace(/\\/g, "/");
    var isLangPage = /\/(en|de|fr|es|ja|ar|hi)\/?$/.test(path) || /\/(en|de|fr|es|ja|ar|hi)\/index\.html$/.test(path);
    var isCompanyOrFor =
      !isLangPage &&
      (path.indexOf("/for") !== -1 ||
        /\/[a-z0-9-]+\/?(index\.html)?$/.test(path));

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}

    if (isLangPage) {
      location.href = base + lang + "/";
      return;
    }
    if (path.endsWith("/") === false && path.split("/").pop().indexOf(".") === -1) {
      // ok
    }
    // company / for pages: query param keep same page
    if (isCompanyOrFor && base === "../") {
      var url = new URL(location.href);
      url.searchParams.set("lang", lang);
      location.href = url.toString();
      return;
    }
    // root portfolio
    location.href = (base || "") + lang + "/";
  }

  function setLanguage(lang, navigate) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT;
    current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    if (navigate) {
      navigateToLang(lang);
      return Promise.resolve(lang);
    }
    return loadLocale(lang).then(function (dict) {
      global.__I18N_DICT = dict;
      global.__LANG = lang;
      updateHead(dict, lang);
      applyDom(dict);
      renderLangSwitcher(dict, lang);
      document.dispatchEvent(
        new CustomEvent("i18n:changed", { detail: { lang: lang, dict: dict } })
      );
      return dict;
    });
  }

  function init(options) {
    options = options || {};
    if (options.base != null) global.__I18N_BASE = options.base;
    var lang = options.lang || detectLang();
    current = lang;
    return setLanguage(lang, false);
  }

  global.I18n = {
    SUPPORTED: SUPPORTED,
    init: init,
    setLanguage: setLanguage,
    t: function (key) {
      return t(global.__I18N_DICT, key);
    },
    getLang: function () {
      return current;
    },
    getDict: function () {
      return global.__I18N_DICT;
    },
    loadLocale: loadLocale,
  };
})(window);
