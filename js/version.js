// js/version.js
const APP_VERSION = "v3.2 Nova";
const DATA_VERSIN = "08 سبتمبر 2025";

window.APP_VERSION = APP_VERSION;

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".version-badge, #appVersion").forEach(el => {
    el.textContent = APP_VERSION;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".dev-date, #appVersion").forEach(el => {
    el.textContent = DATA_VERSIN; 
  });
});