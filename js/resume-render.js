/**
 * Render resume sections from window.RESUME_CONTENT.
 * Used by the portfolio and every company page so copy stays identical.
 */
(function (global) {
  "use strict";

  function tx(key, fallback) {
    if (global.I18n && global.I18n.getDict()) {
      var v = global.I18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback == null ? key : fallback;
  }

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

  function htmlListI18n(items, keyPrefix) {
    return (items || [])
      .map(function (item, i) {
        var key = keyPrefix + "." + i;
        return (
          '<li data-i18n="' +
          key +
          '" data-i18n-mode="html">' +
          tx(key, item) +
          "</li>"
        );
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
      '<button class="filter-btn active" type="button" data-impact-filter="all" data-i18n="impact.filterAll">' +
      esc(tx("impact.filterAll", "All")) +
      "</button>";
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
          ? '<span class="badge badge-current" data-i18n="impact.current">' +
            esc(tx("impact.current", "Current")) +
            "</span>"
          : "";
        var cardKey = "impact.cards." + imp.id;
        var metrics = (imp.metrics || [])
          .map(function (m, mi) {
            var labelKey = cardKey + ".metrics." + mi;
            return (
              '<div class="metric"><span class="metric-value">' +
              esc(m.value) +
              '</span><span class="metric-label" data-i18n="' +
              labelKey +
              '">' +
              esc(tx(labelKey, m.label)) +
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
          '</h3><p class="company-impact-role"><span data-i18n="' +
          cardKey +
          '.role">' +
          esc(tx(cardKey + ".role", imp.role)) +
          '</span> · <span data-i18n="' +
          cardKey +
          '.dates">' +
          esc(tx(cardKey + ".dates", imp.dates)) +
          "</span></p></div>" +
          (metrics
            ? '<div class="company-impact-metrics">' + metrics + "</div>"
            : "") +
          "</header>" +
          '<div class="impact-columns">' +
          '<div class="impact-col"><h4 class="impact-col-title business" data-i18n="impact.business">' +
          esc(tx("impact.business", "Business impact")) +
          "</h4><ul>" +
          htmlListI18n(imp.business, cardKey + ".business") +
          "</ul></div>" +
          '<div class="impact-col"><h4 class="impact-col-title tech" data-i18n="impact.tech">' +
          esc(tx("impact.tech", "Tech impact")) +
          "</h4><ul>" +
          htmlListI18n(imp.tech, cardKey + ".tech") +
          "</ul></div></div>" +
          techRow(imp.techRow) +
          "</article>"
        );
      })
      .join("");
  }

  function aboutCards(resume) {
    var a = resume.about || {};
    var how = a.how || [];
    var howHtml = how
      .map(function (item, i) {
        var key = "about.how" + (i + 1);
        return "<li data-i18n=\"" + key + "\">" + esc(tx(key, item)) + "</li>";
      })
      .join("");
    return (
      '<div class="about-card glass reveal"><h3 data-i18n="about.builderTitle">' +
      esc(tx("about.builderTitle", a.builderTitle || "Builder & Leader")) +
      '</h3><p data-i18n="about.builderBody" data-i18n-mode="html">' +
      tx("about.builderBody", a.builderBodyHtml || "") +
      "</p></div>" +
      '<div class="about-card glass reveal" data-delay="80"><h3 data-i18n="about.howTitle">' +
      esc(tx("about.howTitle", a.howTitle || "How I work")) +
      '</h3><ul class="check-list">' +
      howHtml +
      "</ul></div>" +
      '<div class="about-card glass reveal" data-delay="160"><h3 data-i18n="about.shipTitle">' +
      esc(tx("about.shipTitle", a.shipTitle || "What I ship")) +
      '</h3><p data-i18n="about.shipBody" data-i18n-mode="html">' +
      tx("about.shipBody", a.shipBodyHtml || "") +
      "</p></div>"
    );
  }

  function timeline(resume) {
    return (resume.experience || [])
      .map(function (job, i) {
        var jobKey = "experience.jobs." + job.id;
        var delay = i ? ' data-delay="' + i * 60 + '"' : "";
        var badge = job.current
          ? '<span class="badge badge-current" data-i18n="impact.current">' +
            esc(tx("impact.current", "Current")) +
            "</span>"
          : "";
        var note = job.note
          ? '<div class="employer-note"><strong><span data-i18n="experience.why">' +
            esc(tx("experience.why", "Why this matters to you:")) +
            '</span></strong> <span data-i18n="' +
            jobKey +
            '.note">' +
            tx(jobKey + ".note", job.note) +
            "</span></div>"
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
          '<span class="dates"><span data-i18n="' +
          jobKey +
          '.dates">' +
          esc(tx(jobKey + ".dates", job.dates)) +
          '</span> · <span data-i18n="' +
          jobKey +
          '.location">' +
          esc(tx(jobKey + ".location", job.location)) +
          "</span></span></div>" +
          '<div class="timeline-title-row"><h3 data-i18n="' +
          jobKey +
          '.role">' +
          esc(tx(jobKey + ".role", job.role)) +
          '</h3><span class="chevron" aria-hidden="true"></span></div>' +
          '<p class="timeline-blurb" data-i18n="' +
          jobKey +
          '.blurb">' +
          esc(tx(jobKey + ".blurb", job.blurb || "")) +
          "</p></button>" +
          '<div class="timeline-body"><div class="timeline-body-inner"><ul>' +
          htmlListI18n(job.bullets, jobKey + ".bullets") +
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
    var schoolLine = [e.school, e.location].filter(Boolean).join(" · ");
    return (
      '<div class="edu-left"><h3 data-i18n="education.degree">' +
      esc(tx("education.degree", e.degree)) +
      '</h3><p class="edu-school" data-i18n="education.school">' +
      esc(tx("education.school", schoolLine)) +
      '</p></div><div class="edu-right"><span class="edu-year" data-i18n="education.years">' +
      esc(tx("education.years", e.dates)) +
      "</span></div>"
    );
  }

  function contactGrid(resume, base) {
    base = base || "";
    return (
      '<a class="contact-card glass reveal" href="mailto:' +
      esc(resume.email) +
      '"><span class="contact-label" data-i18n="contact.email">' +
      esc(tx("contact.email", "Email")) +
      '</span><span class="contact-value">' +
      esc(resume.email) +
      "</span></a>" +
      '<a class="contact-card glass reveal" data-delay="60" href="tel:+' +
      esc(String(resume.phoneHref || resume.phone).replace(/[^\d]/g, "")) +
      '"><span class="contact-label" data-i18n="contact.phone">' +
      esc(tx("contact.phone", "Phone")) +
      '</span><span class="contact-value">' +
      esc(resume.phone) +
      "</span></a>" +
      '<a class="contact-card glass reveal" data-delay="120" href="' +
      esc(resume.linkedin) +
      '" target="_blank" rel="noopener"><span class="contact-label" data-i18n="contact.linkedin">' +
      esc(tx("contact.linkedin", "LinkedIn")) +
      '</span><span class="contact-value">' +
      esc(resume.linkedinLabel) +
      "</span></a>" +
      '<a class="contact-card glass reveal" data-delay="180" href="' +
      esc(base + (resume.pdf || "assets/Kapil_Rana_Resume.pdf")) +
      '" download><span class="contact-label" data-i18n="contact.download">' +
      esc(tx("contact.download", "Download")) +
      '</span><span class="contact-value" data-i18n="contact.resumePdf">' +
      esc(tx("contact.resumePdf", "Resume PDF")) +
      "</span></a>"
    );
  }

  function fillHero(resume) {
    var name = document.querySelector(".hero h1 .gradient-text");
    if (name) name.textContent = resume.name;
    var role = document.querySelector(".hero-role [data-i18n='hero.role']");
    if (role) {
      role.textContent = tx("hero.role", resume.heroRole || resume.title);
    } else {
      var roleFb = document.querySelector(".hero-role span");
      if (roleFb) roleFb.textContent = tx("hero.role", resume.heroRole || resume.title);
    }
    var tag = document.querySelector(".hero-tagline [data-i18n='hero.tagline']");
    if (tag) {
      tag.innerHTML = tx("hero.tagline", resume.heroTaglineHtml || resume.summary);
    }
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
    if (loc) {
      loc.textContent = tx("contact.location", resume.locationLine || resume.location);
    }
    if (global.I18n && global.I18n.apply) global.I18n.apply();
  }

  function sectionsHtml(resume, opts) {
    opts = opts || {};
    return (
      '<section class="section" id="impact" aria-labelledby="impact-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">01</span><h2 id="impact-heading" data-i18n="impact.title">' +
      esc(tx("impact.title", "My Impact in Companies")) +
      '</h2><p class="section-sub"><span data-i18n="impact.sub">' +
      esc(tx("impact.sub", "Business outcomes first, then the tech that enabled them — what I delivered at each company")) +
      "</span></p></div>" +
      '<div class="impact-filter reveal" id="impact-filters" role="group" aria-label="Filter impact by company">' +
      impactFilters(resume) +
      "</div>" +
      '<div class="company-impact-list" id="company-impact-list">' +
      impactCards(resume) +
      "</div></div></section>" +
      '<section class="section" id="about" aria-labelledby="about-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">02</span><h2 id="about-heading" data-i18n="about.title">' +
      esc(tx("about.title", "About")) +
      '</h2><p class="section-sub"><span data-i18n="about.sub">' +
      esc(tx("about.sub", "How I work and what I bring to an engineering org")) +
      "</span></p></div>" +
      '<div class="about-grid" id="about-grid">' +
      aboutCards(resume) +
      "</div></div></section>" +
      '<section class="section" id="experience" aria-labelledby="experience-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">03</span><h2 id="experience-heading" data-i18n="experience.title">' +
      esc(tx("experience.title", "Experience")) +
      '</h2><p class="section-sub"><span data-i18n="experience.sub">' +
      esc(tx("experience.sub", "Expand any role for delivery detail — proof is above; this is the full story")) +
      "</span></p></div>" +
      '<div class="exp-toolbar reveal"><div class="filter-group" role="group" aria-label="Filter experience">' +
      '<button class="filter-btn active" data-filter="all" data-i18n="experience.filterAll">' +
      esc(tx("experience.filterAll", "All")) +
      '</button><button class="filter-btn" data-filter="leadership" data-i18n="experience.filterLeadership">' +
      esc(tx("experience.filterLeadership", "Leadership")) +
      '</button><button class="filter-btn" data-filter="fintech" data-i18n="experience.filterFintech">' +
      esc(tx("experience.filterFintech", "Fintech")) +
      '</button><button class="filter-btn" data-filter="mobile" data-i18n="experience.filterMobile">' +
      esc(tx("experience.filterMobile", "Mobile")) +
      '</button><button class="filter-btn" data-filter="fullstack" data-i18n="experience.filterFullstack">' +
      esc(tx("experience.filterFullstack", "Full-stack")) +
      "</button></div></div>" +
      '<div class="timeline" id="timeline">' +
      timeline(resume) +
      "</div></div></section>" +
      '<section class="section" id="skills" aria-labelledby="skills-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">04</span><h2 id="skills-heading" data-i18n="skills.title">' +
      esc(tx("skills.title", "Skills")) +
      '</h2><p class="section-sub"><span data-i18n="skills.sub">' +
      esc(tx("skills.sub", "Interactive map — hover or tap chips; filter by category")) +
      "</span></p></div>" +
      '<div class="skills-layout">' +
      '<div class="skills-cats reveal">' +
      '<button class="skill-cat active" data-skill-cat="all" data-i18n="skills.all">' +
      esc(tx("skills.all", "All")) +
      '</button><button class="skill-cat" data-skill-cat="frontend" data-i18n="skills.frontend">' +
      esc(tx("skills.frontend", "Frontend")) +
      '</button><button class="skill-cat" data-skill-cat="backend" data-i18n="skills.backend">' +
      esc(tx("skills.backend", "Backend")) +
      '</button><button class="skill-cat" data-skill-cat="mobile" data-i18n="skills.mobile">' +
      esc(tx("skills.mobile", "Mobile")) +
      '</button><button class="skill-cat" data-skill-cat="devops" data-i18n="skills.devops">' +
      esc(tx("skills.devops", "DevOps")) +
      '</button><button class="skill-cat" data-skill-cat="soft" data-i18n="skills.soft">' +
      esc(tx("skills.soft", "Leadership")) +
      "</button></div>" +
      '<div class="skills-cloud glass reveal" id="skills-cloud"></div>' +
      '<div class="skills-detail glass reveal" id="skills-detail"><p class="skills-hint"><span data-i18n="skills.hint">' +
      esc(tx("skills.hint", "Select a skill to see how I’ve used it in production.")) +
      '</span></p><div class="skills-detail-body" hidden><h3 id="skill-name"></h3><p id="skill-desc"></p>' +
      '<div class="skill-level"><span data-i18n="skills.proficiency">' +
      esc(tx("skills.proficiency", "Proficiency")) +
      '</span><div class="level-bar"><div class="level-fill" id="skill-level"></div></div></div>' +
      '<p class="skill-used" id="skill-used"></p></div></div></div></div></section>' +
      '<section class="section" id="education" aria-labelledby="education-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">05</span><h2 id="education-heading" data-i18n="education.title">' +
      esc(tx("education.title", "Education")) +
      "</h2></div>" +
      '<div class="edu-card glass reveal" id="edu-card">' +
      educationCard(resume) +
      "</div></div></section>" +
      '<section class="section contact-section" id="contact" aria-labelledby="contact-heading"><div class="container">' +
      '<div class="section-head reveal"><span class="section-num">06</span><h2 id="contact-heading" data-i18n="contact.title">' +
      esc(tx("contact.title", "Let’s work together")) +
      '</h2><p class="section-sub"><span data-i18n="contact.sub">' +
      esc(tx("contact.sub", "Open to senior engineer / SDE III conversations")) +
      '</span></p></div>' +
      '<div class="contact-grid" id="contact-grid">' +
      contactGrid(resume, opts.base || "") +
      '</div><p class="location reveal">📍 <span id="contact-location" data-i18n="contact.location">' +
      esc(tx("contact.location", resume.locationLine || resume.location)) +
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

  function skillSlug(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function skillCopy(s, field) {
    var key = "skills.chips." + skillSlug(s.name) + "." + field;
    var val = tx(key, s[field] || "");
    if (global.__YEARS_EXP != null) {
      val = String(val).replace(/\{years\}/g, String(global.__YEARS_EXP));
    }
    return val;
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
          if (skillDesc) skillDesc.textContent = skillCopy(s, "desc");
          if (skillUsed) {
            skillUsed.textContent = tx("skills.usedAt", "Used at:") + " " + skillCopy(s, "used");
          }
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
