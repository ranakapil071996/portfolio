/**
 * Tools dropdown in the primary nav (portfolio + tool pages).
 */
(function () {
  "use strict";

  var item = document.getElementById("nav-tools");
  var btn = document.getElementById("nav-tools-btn");
  var panel = document.getElementById("nav-tools-panel");
  if (!item || !btn || !panel) return;

  function isOpen() {
    return btn.getAttribute("aria-expanded") === "true";
  }

  function setOpen(open) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
    item.classList.toggle("open", open);
  }

  btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!isOpen());
  });

  document.addEventListener("click", function (e) {
    if (!isOpen()) return;
    if (item.contains(e.target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) {
      e.preventDefault();
      setOpen(false);
      btn.focus({ preventScroll: true });
    }
  });

  var current = window.__TOOL_ID;
  if (current) {
    panel.querySelectorAll("a[data-tool]").forEach(function (a) {
      if (a.getAttribute("data-tool") === current) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }
})();
