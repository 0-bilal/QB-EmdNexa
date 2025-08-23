const LOGIN_PAGE = "index.html";   
const MAX_SESSION_AGE_MIN = 15;    
const IDLE_TIMEOUT_MIN     = 10;   


function getSession() {
  try { return JSON.parse(localStorage.getItem("qb_session")); }
  catch { return null; }
}

function requireSessionNow() {
  const s = getSession();
  if (!s || !s.user_id || !s.ts) {
    redirectToLogin();
    return null;
  }
  return s;
}

function isExpiredByAge(ts) {
  const ageMs = Date.now() - Number(ts || 0);
  return !(ageMs >= 0) || ageMs > MAX_SESSION_AGE_MIN * 60 * 1000;
}

function redirectToLogin() {
  try { localStorage.removeItem("qb_session"); } catch {}
  location.replace(LOGIN_PAGE);
}

let lastActivity = Date.now();
function markActivity() { lastActivity = Date.now(); }
["click","keydown","mousemove","touchstart","scroll","visibilitychange"].forEach(ev => {
  window.addEventListener(ev, markActivity, { passive: true });
});

window.addEventListener("storage", (e) => {
  if (e.key === "qb_session") {
    const s = getSession();
    if (!s) redirectToLogin();
  }
});

function startGuard() {
  const s0 = requireSessionNow();
  if (!s0) return;

  const ticker = setInterval(() => {
    const s = getSession();
    if (!s) { clearInterval(ticker); return redirectToLogin(); }

    // 1) انتهاء عمر الجلسة
    if (isExpiredByAge(s.ts)) {
      clearInterval(ticker);
      return redirectToLogin();
    }

    const idleMs = Date.now() - lastActivity;
    if (idleMs > IDLE_TIMEOUT_MIN * 60 * 1000) {
      clearInterval(ticker);
      return redirectToLogin();
    }
  }, 5_000); // 
}

startGuard();
