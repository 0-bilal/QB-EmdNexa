// js/version.js
const APP_VERSION = "v2.6 Nexus";


document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".version-badge, #appVersion").forEach(el => {
    el.textContent = APP_VERSION;
  });
});
