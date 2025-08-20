/* =======================
   QB — Login Logic
   ======================= */

/** ❶ غيّر هذا الرابط إلى رابط الـ Web App الخاص بك (من Google Apps Script → Deploy → Web app) */
const API_URL = "https://script.google.com/macros/s/AKfycbxBlG06bCUg0UcW2765Md7_q6rs0h75iDbEssrqnAFVFay_oLdrZYSpDZrfgkqGGFfu/exec";

/** ❷ غيّر اسم صفحة التحويل إن كانت ليست home.html أو كانت داخل مجلد */
const REDIRECT_TO = "home.html"; // أمثلة: "pages/home.html" أو "./home.html"

const form = document.getElementById("loginForm");
const userIdInput = document.getElementById("userId");
const msg = document.getElementById("msg");

async function validateAndLogin(e) {
  if (e) e.preventDefault();

  const id = (userIdInput.value || "").trim();
  if (!id) {
    msg.style.color = "tomato";
    msg.textContent = "يرجى إدخال رقم التعريف.";
    userIdInput.focus();
    return;
  }

  msg.style.color = "var(--muted)";
  msg.textContent = "جارِ التحقق...";

  try {
    const url = `${API_URL}?action=validate&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });

    // تحقق من حالة HTTP أولًا
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data && data.ok) {
      // خزن جلسة خفيفة في المتصفح
    localStorage.setItem("qb_session", JSON.stringify({
     user_id: data.user.user_id,
     name: data.user.name,
     role: data.user.role,
     ts: Date.now()                 // مهم: توقيت إنشاء الجلسة
    }));

      msg.style.color = "var(--brand)";
      msg.textContent = "تم تسجيل الدخول ✅";
      // التحويل للصفحة الرئيسية
      setTimeout(() => { location.href = REDIRECT_TO; }, 600);
    } else {
      const map = {
        MISSING_ID: "يرجى إدخال رقم التعريف.",
        NOT_FOUND: "الرقم غير موجود.",
        BLOCKED: "الحساب محظور.",
        EXPIRED: "انتهت صلاحية الوصول.",
        UNKNOWN_ACTION: "طلب غير معروف.",
        SHEET_NOT_FOUND: "تعذر الوصول إلى ورقة المستخدمين.",
        SERVER_ERROR: "خطأ في الخادم."
      };
      msg.style.color = "tomato";
      msg.textContent = data && data.error ? (map[data.error] || "تعذر تسجيل الدخول.") : "تعذر تسجيل الدخول.";
    }
  } catch (err) {
    msg.style.color = "tomato";
    msg.textContent = "تعذر الاتصال بالخادم.";
    // لغايات التشخيص اليدوي: افتح Console وشاهد الخطأ
    console.error("Login error:", err);
  }
}

// ربط الأحداث
form.addEventListener("submit", validateAndLogin);
userIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    validateAndLogin();
  }
});


if (data.ok) {
  localStorage.setItem("qb_session", JSON.stringify({
    user_id: data.user.user_id,
    name: data.user.name,
    role: data.user.role,
    ts: Date.now()
  }));

  // إرسال الإشعار مباشرة (إن كان الملف مضمّنًا في صفحة الدخول)
  if (window.notifyActiveUserIfLoggedIn) {
    window.notifyActiveUserIfLoggedIn();
  }

  setTimeout(() => { location.href = REDIRECT_TO; }, 500);
}
