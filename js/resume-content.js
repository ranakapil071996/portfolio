/**
 * Single source of resume facts: js/resume-data.json
 * Edit that file — portfolio, company pages, and the PDF all read it.
 */
(function (global) {
  "use strict";

  function getBase() {
    if (global.__I18N_BASE != null) return global.__I18N_BASE;
    var path = location.pathname.replace(/\\/g, "/");
    if (path.indexOf("/tools/") !== -1 || /\/tools\/?$/.test(path)) {
      var after = "";
      var idx = path.indexOf("/tools/");
      if (idx !== -1) after = path.slice(idx + "/tools/".length);
      after = after.replace(/index\.html$/, "").replace(/\/+$/, "");
      return after ? "../../" : "../";
    }
    if (
      /\/(en|de|fr|es|ja|ar|hi)\/?$/.test(path) ||
      /\/(en|de|fr|es|ja|ar|hi)\/index\.html$/.test(path)
    ) {
      return "../";
    }
    if (path.indexOf("/for/") !== -1 || /\/[a-z0-9-]+\/index\.html$/.test(path)) {
      return "../";
    }
    if (/\/[a-z0-9-]+\/?$/.test(path)) {
      var seg = path.replace(/\/+$/, "").split("/").pop();
      if (seg && seg.indexOf(".") === -1 && !/^(en|de|fr|es|ja|ar|hi)$/.test(seg)) {
        return "../";
      }
    }
    return "";
  }

  function yearsExp(startIso) {
    if (typeof global.__YEARS_EXP === "number") return global.__YEARS_EXP;
    var parts = String(startIso || "2018-09-01").split("-");
    var start = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2] || 1));
    var y = Math.round((Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return Math.max(y, 1);
  }

  function fillYears(value, y) {
    if (typeof value === "string") return value.replace(/\{years\}/g, String(y));
    if (Array.isArray(value)) return value.map(function (v) { return fillYears(v, y); });
    if (value && typeof value === "object") {
      var out = {};
      Object.keys(value).forEach(function (k) {
        out[k] = fillYears(value[k], y);
      });
      return out;
    }
    return value;
  }

  function load() {
    var url = getBase() + "js/resume-data.json";
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("resume-data " + r.status);
        return r.json();
      })
      .then(function (data) {
        var y = yearsExp(data.careerStart);
        global.__YEARS_EXP = y;
        global.__CAREER_START = data.careerStart;
        var filled = fillYears(data, y);
        global.RESUME_CONTENT = filled;
        document.dispatchEvent(
          new CustomEvent("resume:loaded", { detail: { data: filled, years: y } })
        );
        return filled;
      });
  }

  var ready = load();

  global.ResumeContent = {
    load: load,
    ready: ready,
    years: function () {
      return typeof global.__YEARS_EXP === "number" ? global.__YEARS_EXP : yearsExp();
    },
    get: function () {
      return global.RESUME_CONTENT;
    },
  };
})(window);
