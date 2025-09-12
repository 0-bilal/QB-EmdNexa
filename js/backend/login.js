const API_URL = QB.CONFIG.API_BASE;
const REDIRECT_TO = "home.html";
const REDIRECT_AD = "about.html";

const PIN_LENGTH = 4;

// =====[ مفاتيح/إعدادات خاصة بالإدمن ليقرأها admin.js ]=====
const ADMIN_KEY_OBJECT = "QB_ADMIN_AUTH";   // كائن موحّد
const ADMIN_KEY_ID     = "QB_ADMIN_ID";     // مفاتيح منفصلة
const ADMIN_KEY_TS     = "QB_ADMIN_TS";
const ADMIN_KEY_SIG    = "QB_ADMIN_SIG";
const ADMIN_TTL_MS     = 24 * 60 * 60 * 1000; // 24 ساعة (صلاحية افتراضية)

// =====[ DOM ]=====
const form = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const msg = document.getElementById("msg");

// =====[ أدوات إدمن ]=====
function setAdminAuth(user, apiData) {
  // user: { user_id, name, role }
  // apiData: استجابة الـAPI كاملة (قد تحتوي token/sig إن أضفتها لاحقًا من السيرفر)
  const now = Date.now();
  const payload = {
    id: user.user_id,
    name: user.name || "",
    role: (user.role || "").toLowerCase(),
    ts: now,
    expiry: now + ADMIN_TTL_MS,
    // دعم اختياري إن الـAPI أعاد توكن/توقيع:
    token: apiData?.admin?.token ?? apiData?.token ?? null,
    sig:   apiData?.admin?.sig   ?? apiData?.sig   ?? null
  };

  // احفظ بصيغتين: كائن موحّد + مفاتيح منفصلة (للسهولة/التوافق)
  localStorage.setItem(ADMIN_KEY_OBJECT, JSON.stringify(payload));
  localStorage.setItem(ADMIN_KEY_ID, user.user_id);
  localStorage.setItem(ADMIN_KEY_TS, String(now));
  if (payload.sig) localStorage.setItem(ADMIN_KEY_SIG, String(payload.sig));
  else localStorage.removeItem(ADMIN_KEY_SIG);
}

function clearAdminAuth() {
  localStorage.removeItem(ADMIN_KEY_OBJECT);
  localStorage.removeItem(ADMIN_KEY_ID);
  localStorage.removeItem(ADMIN_KEY_TS);
  localStorage.removeItem(ADMIN_KEY_SIG);
}

// =====[ سلوك الإدخال ]=====
function normalizeInput() {
  let v = (userIdInput.value || "").replace(/\D+/g, "");
  if (v.length > PIN_LENGTH) v = v.slice(0, PIN_LENGTH);
  userIdInput.value = v;
}
if (userIdInput) {
  userIdInput.setAttribute("maxlength", String(PIN_LENGTH));
  userIdInput.setAttribute("inputmode", "numeric");
  userIdInput.addEventListener("input", normalizeInput);
}

function isFourDigitCode(s) {
  return /^\d{4}$/.test(s);
}

function showError(text) {
  msg.style.color = "tomato";
  msg.textContent = text;
  userIdInput?.focus();

  // أغلق نافذة NFS إن كانت قد فُتحت بواسطة مستمع submit في الصفحة
  if (window.NFS && typeof window.NFS.setStatus === "function") {
    window.NFS.setStatus("رمز غير صالح", "error");
    if (typeof window.NFS.closeAfter === "function") window.NFS.closeAfter(500);
  }
}

// =====[ المنطق الرئيسي ]=====
async function validateAndLogin(e) {
  if (e) e.preventDefault();

  const id = (userIdInput.value || "").trim();

  // 1) فارغ؟
  if (!id) {
    clearAdminAuth();
    showError("يرجى إدخال الرمز.");
    return;
  }

  // 2) التحقق الصارم: 4 أرقام فقط
  if (!isFourDigitCode(id)) {
    clearAdminAuth();
    showError("الرجاء إدخال رمز مكوَّن من 4 أرقام فقط.");
    return;
  }

  // صالح: ابدأ إجراء الدخول
  msg.style.color = "var(--text-secondary)";
  msg.textContent = "جارٍ تسجيل الدخول";

  try {
    const url = `${API_URL}?action=validate&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    if (data && data.ok) {
      // جلسة عامة
      localStorage.setItem("qb_session", JSON.stringify({
        user_id: data.user.user_id,
        name: data.user.name,
        role: data.user.role,
        ts: Date.now()
      }));
      localStorage.setItem("qb_login_signal", String(Date.now()));

      // لو إدمن احفظ بياناته ليستفيد منها admin.js
      const isAdmin = String(data.user.role || "").toLowerCase() === "admin";
      if (isAdmin) {
        setAdminAuth(data.user, data);
      } else {
        // مستخدم عادي: تأكد من مسح أي بقايا إدمن
        clearAdminAuth();
      }

      msg.style.color = "var(--text-success)";
      msg.textContent = "تم تسجيل الدخول";

      const redirectTo = isAdmin ? REDIRECT_AD : REDIRECT_TO;
      setTimeout(() => { location.href = redirectTo; }, 600);
    } else {
      clearAdminAuth();

      const map = {
        MISSING_ID: "يرجى إدخال الرمز.",
        INVALID_FORMAT: "الرجاء إدخال رمز مكوَّن من 4 أرقام فقط.",
        NOT_FOUND: "الرقم غير موجود.",
        BLOCKED: "الحساب محظور.",
        EXPIRED: "انتهت صلاحية الوصول.",
        UNKNOWN_ACTION: "طلب غير معروف.",
        SHEET_NOT_FOUND: "تعذر الوصول.",
        SERVER_ERROR: "خطأ في الخادم."
      };
      msg.style.color = "tomato";
      msg.textContent = data && data.error ? (map[data.error] || "تعذر تسجيل الدخول.") : "تعذر تسجيل الدخول.";

      if (window.NFS && typeof window.NFS.setStatus === "function") {
        window.NFS.setStatus("فشل التسجيل", "error");
        if (typeof window.NFS.closeAfter === "function") window.NFS.closeAfter(800);
      }
    }
  } catch (err) {
    clearAdminAuth();

    msg.style.color = "tomato";
    msg.textContent = "تعذر الاتصال بالخادم.";
    console.error("Login error:", err);

    if (window.NFS && typeof window.NFS.setStatus === "function") {
      window.NFS.setStatus("يتعذر الاتصال بالخادم — سيتم إعادة المحاولة…", "error");
      if (typeof window.NFS.closeAfter === "function") window.NFS.closeAfter(600);
    }
  }
}

// =====[ أحداث ]=====
form.addEventListener("submit", validateAndLogin);
userIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    validateAndLogin();
  }
});
