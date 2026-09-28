/**
 * Pterotheme - admin colour scheme toggle.
 *
 * Shares the `ptero-theme` localStorage key with the React panel so a choice
 * made in either half of the panel sticks everywhere.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'ptero-theme';
    var LIGHT_META = '#eef2f6';
    var DARK_META = '#141a20';

    function read() {
        var attr = document.documentElement.getAttribute('data-theme');
        if (attr === 'dark' || attr === 'light') {
            return attr;
        }

        try {
            var stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored === 'dark' || stored === 'light') {
                return stored;
            }
        } catch (e) {
            /* storage unavailable - fall through to the default */
        }

        return 'dark';
    }

    function apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            /* ignore */
        }

        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'light' ? LIGHT_META : DARK_META);
        }

        var icon = document.getElementById('adminThemeIcon');
        if (icon) {
            // Show the theme you would switch *to*, matching ThemeToggle.tsx.
            icon.className = theme === 'dark' ? 'fa fa-sun-o' : 'fa fa-moon-o';
        }

        var button = document.getElementById('adminThemeToggle');
        if (button) {
            button.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
            button.setAttribute('aria-label', button.title);
        }
    }

    function toggle() {
        apply(read() === 'dark' ? 'light' : 'dark');
    }

    function bind() {
        apply(read());

        document.addEventListener('click', function (event) {
            var target = event.target;
            if (!target || !target.closest) {
                return;
            }

            if (target.closest('#adminThemeToggle')) {
                event.preventDefault();
                toggle();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
