/**
 * base.js — global utilities used across all pages.
 * Loaded as a regular script so flashMessage is available on window
 * and usable from ES modules without an explicit import.
 */

/**
 * Build a Bootstrap dismissible alert element as an HTML string.
 * @param {string} data    - Alert body text.
 * @param {string} category - Bootstrap alert category (e.g. 'warning', 'danger').
 * @returns {string} HTML string for the alert.
 */
window.flashMessage = function flashMessage(data, category) {
    return (
        '<div class="alert alert-' + category + ' alert-dismissible" role="alert">' +
            '<div>' + data + '</div>' +
            '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
        '</div>'
    );
};

// Basic dark-mode toggle for pages that do NOT include the graph.
// Graph pages replace this handler with one that also repaints the graph.
document.querySelector('#darkMode').onclick = function () {
    const checkbox = document.querySelector('#darkMode input[type="checkbox"]');
    const isDark = checkbox.checked;
    checkbox.checked = !isDark;
    document.documentElement.setAttribute('data-theme',    isDark ? 'light' : 'dark');
    document.documentElement.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
};
