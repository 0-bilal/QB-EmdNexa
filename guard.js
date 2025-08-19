/* ===== QB Session Guard =====
   - يعيد التوجيه لصفحة الدخول إذا لا توجد جلسة
   - يضبط أقصى عمر للجلسة
   - يسجل خروج تلقائي عند الخمول
*/

const LOGIN_PAGE = "index.html";    // ← غيّرها لو اسم صفحة الدخول مختلف
const MAX_SESSION_AGE_MIN = 180;    // أقصى عمر للجلسة بالدقائق (مثال: 12 ساعة)
const IDLE_TIMEOUT_MIN     = 30;    // أقصى خمول قبل الخروج التلقائي (نقرة/كتابة/حركة ماوس/لمس)

/* اقرأ الجلسة */
function getSession() {
  try { return JSON.parse(localStorage.getItem("qb_session")); }
  catch { return null; }
}

/* تحقّق فوري عند التحميل */
function requireSessionNow() {
  const s = getSession();
  if (!s || !s.user_id || !s.ts) {
    redirectToLogin();
    return null;
  }
  return s;
}

/* أعمار وتوقيت */
function isExpiredByAge(ts) {
  const ageMs = Date.now() - Number(ts || 0);
  return !(ageMs >= 0) || ageMs > MAX_SESSION_AGE_MIN * 60 * 1000;
}

/* إعادة التوجيه */
function redirectToLogin() {
  try { localStorage.removeItem("qb_session"); } catch {}
  location.replace(LOGIN_PAGE);
}

/* تتبّع الخمول */
let lastActivity = Date.now();
function markActivity() { lastActivity = Date.now(); }
["click","keydown","mousemove","touchstart","scroll","visibilitychange"].forEach(ev => {
  window.addEventListener(ev, markActivity, { passive: true });
});

/* راقب تغيّر التخزين (لو خرج المستخدم من تبويب آخر) */
window.addEventListener("storage", (e) => {
  if (e.key === "qb_session") {
    const s = getSession();
    if (!s) redirectToLogin();
  }
});

/* فحص متكرر */
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

    // 2) انتهاء مهلة الخمول
    const idleMs = Date.now() - lastActivity;
    if (idleMs > IDLE_TIMEOUT_MIN * 60 * 1000) {
      clearInterval(ticker);
      return redirectToLogin();
    }
  }, 5_000); // يفحص كل 5 ثوانٍ
}

startGuard();
