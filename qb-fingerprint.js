/* =======================
   QB — Fingerprint & Heartbeat (No-CORS, Once-Per-Session Login FP)
   ======================= */

/* 1) رابط الويب آب (GAS Web App) */
const FP_API_URL = "https://script.google.com/macros/s/AKfycbxdt8fC80BlrU7Sh5ZYA2wBCp6lt6wRWCbgYuB_MNi4JS5HK9qqCYf9GZbJVJNWy1yN/exec"; // ينتهي بـ /exec

/* 2) أدوات جلسة/جهاز */
function safeSession() {
  try {
    const s = JSON.parse(localStorage.getItem("qb_session") || "{}");
    return (s && s.user_id) ? s : null;
  } catch {
    return null;
  }
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem("qb_device");
  if (!id) {
    id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now().toString(36);
    localStorage.setItem("qb_device", id);
  }
  return id;
}

/* 3) تجميع بصمة خفيفة وآمنة */
function collectFingerprint() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const langs = (navigator.languages && navigator.languages.join(",")) || navigator.language || "";
  const ua = navigator.userAgent || "";
  const screenStr = `${screen?.width || 0}x${screen?.height || 0}x${screen?.colorDepth || 0}`;
  const viewport = `${innerWidth || 0}x${innerHeight || 0}`;
  const touch = navigator.maxTouchPoints || 0;
  const platform = navigator.platform || "";
  const hw = (navigator.hardwareConcurrency || "");
  const mem = (navigator.deviceMemory || ""); // قد لا تتوفر في كل المتصفحات
  const cookies = navigator.cookieEnabled ? "1" : "0";
  const ref = document.referrer || "";
  return {
    ua, langs, tz, screen: screenStr, viewport, touch,
    platform, hw_concurrency: String(hw), mem_gb: String(mem),
    cookies, ref
  };
}

/* 4) إرسال (بدون هيدرز → Simple Request) */
async function fpPost(payload) {
  try {
    const res = await fetch(FP_API_URL, { method: "POST", body: JSON.stringify(payload) });
    const txt = await res.text();
    console.log("[FP] response:", txt);
    return txt;
  } catch (e) {
    console.warn("[FP] post error:", e);
    return null;
  }
}

/* 5) علامة "أُرسلت بصمة الدخول لهذه الجلسة" — منع التكرار مع كل تحديث */
function loginMarkerKeyForSession(s) {
  const device = getOrCreateDeviceId();
  const ts = s.ts || "0"; // مهم: تحفظ ts عند إنشاء الجلسة
  return `fp_login_session:${s.user_id}:${device}:${ts}`;
}
function hasLoginFingerprintBeenSent(s) {
  return localStorage.getItem(loginMarkerKeyForSession(s)) === "1";
}
function markLoginFingerprintSent(s) {
  localStorage.setItem(loginMarkerKeyForSession(s), "1");
}

/* 6) إرسال بصمة الدخول — تُكتب مرة واحدة لكل جلسة */
async function sendLoginFingerprint() {
  const s = safeSession();
  if (!s) { console.warn("[FP] no session; skip login FP"); return; }
  if ((s.role || "").toLowerCase() === "admin") { console.log("[FP] skip admin"); return; }

  if (hasLoginFingerprintBeenSent(s)) {
    console.log("[FP] login FP already sent for this session; skipping");
    return;
  }

  const payload = {
    action: "login",
    user_id: s.user_id,
    name: s.name || "",
    role: (s.role || "").toLowerCase(),
    device_id: getOrCreateDeviceId(),
    ...collectFingerprint(),
    ts_client: Date.now()
  };
  console.log("[FP] login ->", payload);

  const txt = await fpPost(payload);
  // علّم الجلسة كمُرسلة فقط عند نجاح الرد
  try {
    const res = JSON.parse(txt || "{}");
    if (res && res.ok) {
      markLoginFingerprintSent(s);
      console.log("[FP] login FP marked as sent for this session");
    } else {
      console.warn("[FP] login FP not marked (server did not return ok)");
    }
  } catch {
    console.warn("[FP] login FP not marked (non-JSON response)");
  }
}

/* 7) إرسال نبضة — (تُكتب في Heartbeats إن فعّلتها) */
async function sendHeartbeat() {
  const s = safeSession();
  if (!s) return;
  if ((s.role || "").toLowerCase() === "admin") return;

  const payload = {
    action: "hb",
    user_id: s.user_id,
    name: s.name || "",
    role: (s.role || "").toLowerCase(),
    device_id: getOrCreateDeviceId(),
    ts_client: Date.now()
  };
  console.log("[FP] hb ->", payload);
  await fpPost(payload);
}

/* 8) وداع عند الإغلاق — مُعطّل افتراضيًا (لا نسجل bye) */
/*
function sendFinalBeat() {
  const s = safeSession();
  if (!s) return;
  if ((s.role || "").toLowerCase() === "admin") return;

  const payload = { action: "bye", user_id: s.user_id, device_id: getOrCreateDeviceId(), ts_client: Date.now() };
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=utf-8" });
    navigator.sendBeacon?.(FP_API_URL, blob);
  } catch (e) {}
}
*/

/* 9) إدارة النبضات */
let HB_TIMER = null;
// الإنتاج المقترح: كل 5 دقائق
const HB_MS = 5 * 60 * 1000;

function startHeartbeats() {
  stopHeartbeats();
  setTimeout(sendHeartbeat, 2000); // نبضة مبكرة (اختياري)
  HB_TIMER = setInterval(sendHeartbeat, HB_MS);
  console.log("[FP] HB started every", HB_MS / 1000, "sec");
}

function stopHeartbeats() {
  if (HB_TIMER) {
    clearInterval(HB_TIMER);
    HB_TIMER = null;
    console.log("[FP] HB stopped");
  }
}

/* 10) تهيئة تلقائية عند تحميل الصفحة المحمية */
let __FP_INIT_DONE__ = false;

async function initFingerprintAndHB() {
  if (__FP_INIT_DONE__) { console.log("[FP] already initialized"); return; }
  const s = safeSession();
  if (!s) { console.warn("[FP] no session; won't init"); return; }

  await sendLoginFingerprint();   // ✅ تُرسل مرة واحدة فقط لكل جلسة

  // 👇 السطر الوحيد الذي يفعّل النبضات.
  //    إذا أردت إيقاف تسجيل النبضات لاحقًا، علّق هذا السطر فقط.
  startHeartbeats();              // ← علّق هذا السطر لإيقاف النبضات

  __FP_INIT_DONE__ = true;
}

/* (اختياري) لو فعّلت بصمة الخروج لاحقًا أزل التعليق:
window.addEventListener("pagehide", sendFinalBeat);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") sendFinalBeat();
});
*/

/* نشغّل التهيئة عندما تصبح الـ DOM جاهزة أو عند load */
window.addEventListener("DOMContentLoaded", () => {
  if (window.QBFingerprint?.init) return;
  initFingerprintAndHB();
});
window.addEventListener("load", () => {
  initFingerprintAndHB();
});

/* 11) واجهة للاستخدام اليدوي أثناء الاختبار */
window.QBFingerprint = {
  init: initFingerprintAndHB,
  startHeartbeats,
  stopHeartbeats,
  ping: sendHeartbeat,
  debugSession: () => console.log("qb_session:", safeSession(), "qb_device:", localStorage.getItem("qb_device"))
};
