/**
 * brine-theme preview page behaviour.
 *
 * Page-local only - the shipped pieces are the palette stylesheet and the
 * `ptero-theme` storage key, so a change made on one page follows to the next.
 * the two preview pages stay in sync. The drawer wiring mirrors the state
 * AppShell.tsx keeps for the mobile navigation.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "ptero-theme";

  function readTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") {
      return attr;
    }

    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        return stored;
      }
    } catch (e) {
      /* storage unavailable */
    }

    return "dark";
  }

  function svgFor(name, size) {
    var entry = window.PTERO_ICONS && window.PTERO_ICONS[name];
    if (!entry) {
      return "";
    }

    return (
      '<svg viewBox="' +
      entry[0] +
      '" width="' +
      size +
      '" height="' +
      size +
      '" aria-hidden="true" focusable="false" style="display:inline-block;vertical-align:-0.125em">' +
      '<path fill="currentColor" d="' +
      entry[1] +
      '"/></svg>'
    );
  }

  function renderIcon(node) {
    var toggle = node.getAttribute("data-icon-toggle");
    var name = node.getAttribute("data-icon");

    if (toggle) {
      var pair = toggle.split(":");
      name = readTheme() === "dark" ? pair[0] : pair[1];
      node.setAttribute("data-icon", name);
    }

    if (!name) {
      return;
    }

    node.innerHTML = svgFor(name, node.getAttribute("data-icon-size") || "1em");
  }

  function renderIcons() {
    var nodes = document.querySelectorAll("[data-icon], [data-icon-toggle]");
    for (var i = 0; i < nodes.length; i++) {
      renderIcon(nodes[i]);
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* storage unavailable - the attribute alone still themes the page */
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "light" ? "#f8f7f4" : "#1f2a3a");
    }

    renderIcons();
    syncNavToggle();
  }

  function syncNavToggle() {
    var button = document.getElementById("ptPreviewToggle");
    if (!button) {
      return;
    }

    var theme = readTheme();
    var title =
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

    button.title = title;
    button.setAttribute("aria-label", title);
    button.setAttribute("data-next-theme", theme === "dark" ? "light" : "dark");
  }

  function startDrawer() {
    var drawer = document.getElementById("ptPreviewDrawer");
    var burger = document.getElementById("ptPreviewBurger");
    if (!drawer) {
      return;
    }

    function setDrawer(open) {
      drawer.classList.toggle("is-open", open);
      drawer.setAttribute("aria-hidden", open ? "false" : "true");
      document.body.style.overflow = open ? "hidden" : "";
    }

    if (burger) {
      burger.addEventListener("click", function () {
        setDrawer(true);
      });
    }

    var closers = drawer.querySelectorAll("[data-drawer-close]");
    for (var i = 0; i < closers.length; i++) {
      closers[i].addEventListener("click", function () {
        setDrawer(false);
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setDrawer(false);
      }
    });
  }

  function start() {
    renderIcons();
    syncNavToggle();
    startDrawer();

    var year = document.getElementById("ptPreviewYear");
    if (year) {
      year.textContent = String(new Date().getFullYear());
    }

    var button = document.getElementById("ptPreviewToggle");
    if (button) {
      button.addEventListener("click", function () {
        setTheme(readTheme() === "dark" ? "light" : "dark");
      });
    }

    // the bootstrap writes data-theme directly, so watch the attribute to
    // keep icons and titles in agreement on both preview pages.
    if (window.MutationObserver) {
      new MutationObserver(function () {
        renderIcons();
        syncNavToggle();
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
