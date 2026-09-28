/**
 * brine-theme preview page behaviour.
 *
 * Page-local only - the shipped piece is the palette stylesheet. The drawer
 * wiring mirrors the state AppShell.tsx keeps for the mobile navigation.
 */
(function () {
  "use strict";

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
    var name = node.getAttribute("data-icon");
    if (!name) {
      return;
    }

    node.innerHTML = svgFor(name, node.getAttribute("data-icon-size") || "1em");
  }

  function renderIcons() {
    var nodes = document.querySelectorAll("[data-icon]");
    for (var i = 0; i < nodes.length; i++) {
      renderIcon(nodes[i]);
    }
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
    startDrawer();

    var year = document.getElementById("ptPreviewYear");
    if (year) {
      year.textContent = String(new Date().getFullYear());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
