// js/version.js
const APP_VERSION = "v3.0 Nova";
const DATA_VERSIN = "25 أغسطس 2025";


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