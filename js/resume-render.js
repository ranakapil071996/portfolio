/**
 * Render resume sections from window.RESUME_CONTENT.
 * Used by the portfolio and every company page so copy stays identical.
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function htmlList(items) {
    return (items || [])
      .map(function (item) {
        return "<li>" + item + "</li>";
      })
      .join("");
  }

  function techRow(items) {
    if (!items || !items.length) return "";
    return (
      '<div class="tech-row">' +
      items
        .map(function (t) {
          return "<span>" + esc(t) + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  function impactFilters(resume) {
    var btns =
      '<button class="filter-btn active" type="button" data-impact-filter="all" data-i18n="impact.filterAll">All</button>';
    (resume.impact || []).forEach(function (imp) {
      btns +=
        '<button class="filter-btn" type="button" data-impact-filter="' +
        esc(imp.id) +
        '">' +
        esc(imp.filter || imp.company) +
        "</button>";
    });
    return btns;
  }

  function impactCards(resume) {
    return (resume.impact || [])
      .map(function (imp, i) {
        var delay = i ? ' data-delay="' + i * 40 + '"' : "";
        var badge = imp.current
          ? '<span class="badge badge-current" data-i18n="impact.current">Current</span>'
          : "";
        var metrics = (imp.metrics || [])
          .map(function (m) {
            return (
              '<div class="metric"><span class="metric-value">' +
              esc(m.value) +
              '</span><span class="metric-label">' +
              esc(m.label) +
              "</span></div>"
            );
          })
          .join("");
        return (
          '<article class="company-impact glass reveal" data-impact-company="' +
          esc(imp.id) +
          '"' +
          delay +
          ">" +
          '<header class="company-impact-head"><div>' +
          badge +
          "<h3>" +
          esc(imp.company) +
          '</h3><p class="company-impact-role">' +
          esc(imp.role) +
          " · " +
          esc(imp.dates) +
          "</p></div>" +
          (metrics
            ? '<div class="company-impact-metrics">' + metrics + "</div>"
            : "") +
          "</header>" +
          '<div class="impact-columns">' +
          '<div class="impact-col"><h4 class="impact-col-title business" data-i18n="impact.business">Business impact</h4><ul>' +
          htmlList(imp.business) +
          "</ul></div>" +
          '<div class="impact-col"><h4 class="impact-col-title tech" data-i18n="impact.tech">Tech impact</h4><ul>' +
          htmlList(imp.tech) +
          "</ul></div></div>" +
          techRow(imp.techRow) +
          "</article>"
        );
      })
      .join("");
  }

  function aboutCards(resume) {
    var a = resume.about || {};
    return (
      '<div class="about-card glass reveal"><h3>' +
      esc(a.builderTitle || "Builder & Leader") +
      "</h3><p>" +
      (a.builderBodyHtml || "") +
      "</p></div>" +
      '<div class="about-card glass reveal" data-delay="80"><h3>' +
      esc(a.howTitle || "How I work") +
      '</h3><ul class="check-list">' +
      htmlList(a.how) +
      "</ul></div>" +
      '<div class="about-card glass reveal" data-delay="160"><h3>' +
      esc(a.shipTitle || "What I ship") +
      "</h3><p>" +
      (a.shipBodyHtml || "") +
      "</p></div>"
    );
  }

  function timeline(resume) {
    return (resume.experience || [])
      .map(function (job, i) {
        var delay = i ? ' data-delay="' + i * 60 + '"' : "";
        var badge = job.current
          ? '<span class="badge badge-current">Current</span>'
          : "";
        var note = job.note
          ? '<div class="employer-note"><strong><span data-i18n="experience.why">Why this matters to you:</span></strong> ' +
            job.note +
            "</div>"
          : "";
        return (
          '<article class="timeline-item glass reveal" data-tags="' +
          esc((job.tags || []).join(" ")) +
          '" data-company="' +
          esc(job.id) +
          '"' +
          delay +
          ">" +
          '<div class="timeline-dot"></div>' +
          '<button class="timeline-header" aria-expanded="false" data-expand>' +
          '<div class="timeline-meta"><span class="company">' +
          esc(job.company) +
          "</span>" +
          badge +
          '<span class="dates">' +
          esc(job.dates) +
          " · " +
          esc(job.location) +
          "</span></div>" +
          '<div class="timeline-title-row"><h3>' +
          esc(job.role) +
          '</h3><span class="chevron" aria-hidden="true"></span></div>' +
          '<p class="timeline-blurb">' +
          esc(job.blurb || "") +
          "</p></button>" +
          '<div class="timeline-body"><div class="timeline-body-inner"><ul>' +
          htmlList(job.bullets) +
          "</ul>" +
          techRow(job.techRow) +
          note +
          "</div></div></article>"
        );
      })
      .join("");
  }

  function educationCard(resume) {
    var e = resume.education || {};
    return (
      '<div class="edu-left"><h3>' +
      esc(e.degree) +
      '</h3><p class="edu-school">' +
      esc(e.school) +
      " · " +
      esc(e.location) +
      '</p></div><div class="edu-right"><span class="edu-year">' +
      esc(e.dates) +
      "</span></div>"
    );
  }

  function contactGrid(resume, base) {
    base = base || "";
    return (
      '<a class="contact-card glass reveal" href="mailto:' +
      esc(resume.email) +
      '"><span class="contact-label" data-i18n="contact.email">Email</span><span class="contact-value">' +
      esc(resume.email) +
      "</span></a>" +
      '<a class="contact-card glass reveal" data-delay="60" href="tel:+' +
      esc(String(resume.phoneHref || resume.phone).replace(/[^\d]/g, "")) +
      '"><span class="contact-label" data-i18n="contact.phone">Phone</span><span class="contact-value">' +
      esc(resume.phone) +
      "</span></a>" +
      '<a class="contact-card glass reveal" data-delay="120" href="' +
      esc(resume.linkedin) +
      '" target="_blank" rel="noopener"><span class="contact-label" data-i18n="contact.linkedin">LinkedIn</span><span class="contact-value">' +
      esc(resume.linkedinLabel) +
      "</span></a>" +
      '<a class="contact-card glass reveal" data-delay="180" href="' +
      esc(base + (resume.pdf || "assets/Kapil_Rana_Resume.pdf")) +
      '" download><span class="contact-label" data-i18n="contact.download">Download</span><span class="contact-value" data-i18n="contact.resumePdf">Resume PDF</span></a>'
    );
  }

  function fillHero(resume) {
    var name = document.querySelector(".hero h1 .gradient-text");
    if (name) name.textContent = resume.name;
    var role = document.querySelector(".hero-role [data-i18n='hero.role']") || document.querySelector(".hero-role span");
    if (role) role.textContent = resume.heroRole || resume.title;
    var tag = document.querySelector(".hero-tagline [data-i18n='hero.tagline']") || document.querySelector(".hero-tagline span");
    if (tag) tag.innerHTML = resume.heroTaglineHtml || resume.summary;
    var pills = document.querySelector(".hero-pills");
    if (pills && resume.pills) {
      pills.innerHTML = resume.pills
        .map(function (p) {
          return '<span class="pill">' + esc(p) + "</span>";
        })
        .join("");
    }
    var yearsStat = document.querySelector("[data-count-years]");
    if (yearsStat && global.__YEARS_EXP != null) {
      yearsStat.setAttribute("data-count", String(global.__YEARS_EXP));
      yearsStat.textContent = String(global.__YEARS_EXP);
    }
    document.querySelectorAll("span[data-years-exp]").forEach(function (el) {
      if (global.__YEARS_EXP != null) el.textContent = String(global.__YEARS_EXP);
    });
  }

  function setHtml(id, html) {
    var el = document.getElementById(id);
    if (el && html != null) el.innerHTML = html;
    return el;
  }

  function fillPage(resume, opts) {
    opts = opts || {};
    if (!resume) return;
    fillHero(resume);
    setHtml("impact-filters", impactFilters(resume));
    setHtml("company-impact-list", impactCards(resume));
    setHtml("about-grid", aboutCards(resume));
    setHtml("timeline", timeline(resume));
    var edu = document.getElementById("edu-card");
    if (edu) edu.innerHTML = educationCard(resume);
    setHtml("contact-grid", contactGrid(resume, opts.base || ""));
    var loc = document.getElementById("contact-location");
    if (loc) loc.textContent = resume.locationLine || resume.location;
  }

  function sectionsHtml(resume, opts) {
    opts = opts || {};
    return (
      '<section class="section" id="impact" aria-labelledby="impact-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">01</span><h2 id="impact-heading">My Impact in Companies</h2>' +
      '<p class="section-sub">Business outcomes first, then the tech that enabled them — what I delivered at each company</p></div>' +
      '<div class="impact-filter reveal" id="impact-filters" role="group" aria-label="Filter impact by company">' +
      impactFilters(resume) +
      "</div>" +
      '<div class="company-impact-list" id="company-impact-list">' +
      impactCards(resume) +
      "</div></div></section>" +
      '<section class="section" id="about" aria-labelledby="about-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">02</span><h2 id="about-heading">About</h2>' +
      '<p class="section-sub">How I work and what I bring to an engineering org</p></div>' +
      '<div class="about-grid" id="about-grid">' +
      aboutCards(resume) +
      "</div></div></section>" +
      '<section class="section" id="experience" aria-labelledby="experience-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">03</span><h2 id="experience-heading">Experience</h2>' +
      '<p class="section-sub">Expand any role for delivery detail — proof is above; this is the full story</p></div>' +
      '<div class="exp-toolbar reveal"><div class="filter-group" role="group" aria-label="Filter experience">' +
      '<button class="filter-btn active" data-filter="all">All</button>' +
      '<button class="filter-btn" data-filter="leadership">Leadership</button>' +
      '<button class="filter-btn" data-filter="fintech">Fintech</button>' +
      '<button class="filter-btn" data-filter="mobile">Mobile</button>' +
      '<button class="filter-btn" data-filter="fullstack">Full-stack</button>' +
      "</div></div>" +
      '<div class="timeline" id="timeline">' +
      timeline(resume) +
      "</div></div></section>" +
      '<section class="section" id="skills" aria-labelledby="skills-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">04</span><h2 id="skills-heading">Skills</h2>' +
      '<p class="section-sub">Interactive map — hover or tap chips; filter by category</p></div>' +
      '<div class="skills-layout">' +
      '<div class="skills-cats reveal">' +
      '<button class="skill-cat active" data-skill-cat="all">All</button>' +
      '<button class="skill-cat" data-skill-cat="frontend">Frontend</button>' +
      '<button class="skill-cat" data-skill-cat="backend">Backend</button>' +
      '<button class="skill-cat" data-skill-cat="mobile">Mobile</button>' +
      '<button class="skill-cat" data-skill-cat="devops">DevOps</button>' +
      '<button class="skill-cat" data-skill-cat="soft">Leadership</button>' +
      "</div>" +
      '<div class="skills-cloud glass reveal" id="skills-cloud"></div>' +
      '<div class="skills-detail glass reveal" id="skills-detail"><p class="skills-hint">Select a skill to see how I’ve used it in production.</p>' +
      '<div class="skills-detail-body" hidden><h3 id="skill-name"></h3><p id="skill-desc"></p>' +
      '<div class="skill-level"><span>Proficiency</span><div class="level-bar"><div class="level-fill" id="skill-level"></div></div></div>' +
      '<p class="skill-used" id="skill-used"></p></div></div></div></div></section>' +
      '<section class="section" id="education" aria-labelledby="education-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">05</span><h2 id="education-heading">Education</h2></div>' +
      '<div class="edu-card glass reveal" id="edu-card">' +
      educationCard(resume) +
      "</div></div></section>" +
      '<section class="section contact-section" id="contact" aria-labelledby="contact-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">06</span><h2 id="contact-heading">Let’s work together</h2>' +
      '<p class="section-sub">Open to senior engineer / SDE III conversations</p></div>' +
      '<div class="contact-grid" id="contact-grid">' +
      contactGrid(resume, opts.base || "") +
      '</div><p class="location reveal">📍 <span id="contact-location">' +
      esc(resume.locationLine || resume.location) +
      "</span></p></div></section>"
    );
  }

  function bindFilters() {
    function group(selector, onChange) {
      var buttons = Array.prototype.slice.call(document.querySelectorAll(selector));
      buttons.forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.classList.contains("active") ? "true" : "false");
        btn.addEventListener("click", function () {
          buttons.forEach(function (b) {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
          onChange(btn);
        });
      });
    }

    document.querySelectorAll("[data-expand]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".timeline-item");
        if (!item) return;
        var open = item.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
    var first = document.querySelector(".timeline-item");
    if (first) {
      first.classList.add("open");
      var b = first.querySelector("[data-expand]");
      if (b) b.setAttribute("aria-expanded", "true");
    }

    function setExpFilter(filter, preferCompany) {
      var timeline = document.getElementById("timeline");
      if (timeline) timeline.classList.add("filter-instant");
      var firstVisible = null;
      document.querySelectorAll(".timeline-item").forEach(function (item) {
        var tags = (item.getAttribute("data-tags") || "").split(/\s+/);
        var company = item.getAttribute("data-company");
        var show =
          filter === "all" ||
          (preferCompany ? company === filter : tags.indexOf(filter) !== -1);
        item.classList.toggle("filtered-out", !show);
        item.setAttribute("aria-hidden", show ? "false" : "true");
        if (show && !firstVisible) firstVisible = item;
        if (preferCompany) {
          item.classList.toggle("open", show && filter !== "all");
        } else if (!show) {
          item.classList.remove("open");
        }
        var b = item.querySelector("[data-expand]");
        if (b) b.setAttribute("aria-expanded", item.classList.contains("open") ? "true" : "false");
      });
      if (filter === "all" && firstVisible) {
        firstVisible.classList.add("open");
        var hb = firstVisible.querySelector("[data-expand]");
        if (hb) hb.setAttribute("aria-expanded", "true");
      }
      if (timeline) {
        void timeline.offsetHeight;
        requestAnimationFrame(function () {
          timeline.classList.remove("filter-instant");
        });
      }
    }

    group(".filter-btn[data-filter]", function (btn) {
      setExpFilter(btn.getAttribute("data-filter") || "all", false);
    });

    group("[data-impact-filter]", function (btn) {
      var filter = btn.getAttribute("data-impact-filter") || "all";
      document.querySelectorAll("[data-impact-company]").forEach(function (card) {
        var co = card.getAttribute("data-impact-company");
        var show = filter === "all" || co === filter;
        card.classList.toggle("filtered-out", !show);
        card.setAttribute("aria-hidden", show ? "false" : "true");
      });
      // Keep Experience in lockstep so the page does not reflow a full timeline
      setExpFilter(filter, true);
      var expAll = document.querySelector('.filter-btn[data-filter="all"]');
      if (expAll && filter === "all") {
        document.querySelectorAll(".filter-btn[data-filter]").forEach(function (b) {
          b.classList.toggle("active", b === expAll);
          b.setAttribute("aria-pressed", b === expAll ? "true" : "false");
        });
      }
    });
  }

  function bindSkills(resume) {
    var SKILLS = (resume && resume.skillChips) || [];
    var cloud = document.getElementById("skills-cloud");
    var detailWrap = document.querySelector(".skills-detail-body");
    var hint = document.querySelector(".skills-hint");
    var skillName = document.getElementById("skill-name");
    var skillDesc = document.getElementById("skill-desc");
    var skillLevel = document.getElementById("skill-level");
    var skillUsed = document.getElementById("skill-used");
    if (!cloud) return;

    function renderSkills(cat) {
      cloud.innerHTML = "";
      SKILLS.forEach(function (s) {
        if (cat !== "all" && s.cat !== cat) return;
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "skill-chip";
        btn.textContent = s.name;
        btn.setAttribute("data-skill", s.name);
        btn.addEventListener("click", function () {
          cloud.querySelectorAll(".skill-chip").forEach(function (c) {
            c.classList.remove("active");
          });
          btn.classList.add("active");
          if (hint) hint.hidden = true;
          if (detailWrap) detailWrap.hidden = false;
          if (skillName) skillName.textContent = s.name;
          if (skillDesc) skillDesc.textContent = s.desc;
          if (skillUsed) skillUsed.textContent = "Used at: " + s.used;
          if (skillLevel) {
            skillLevel.style.width = "0%";
            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                skillLevel.style.width = s.level + "%";
              });
            });
          }
        });
        cloud.appendChild(btn);
      });
    }

    renderSkills("all");
    document.querySelectorAll(".skill-cat").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".skill-cat").forEach(function (b) {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        renderSkills(btn.getAttribute("data-skill-cat") || "all");
        if (hint) hint.hidden = false;
        if (detailWrap) detailWrap.hidden = true;
      });
    });
  }

  global.ResumeRender = {
    fillPage: fillPage,
    sectionsHtml: sectionsHtml,
    bindFilters: bindFilters,
    bindSkills: bindSkills,
    bindAll: function (resume) {
      document.querySelectorAll(".reveal").forEach(function (n) {
        n.classList.add("in");
      });
      bindFilters();
      bindSkills(resume);
    },
  };
})(window);
