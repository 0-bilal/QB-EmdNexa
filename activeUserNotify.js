// ===============================
// Active User Telegram Notifier (KSA format)
// ===============================

// ضع التوكن والمعرّف الصحيحين هنا
const BOT_TOKEN = "8395051529:AAFX1P2w8cICbTjZYoxf-1uEK8kaW58zkkU";
const CHAT_ID   = "-1002758733334";

// قراءة جلسة الدخول
function getQBSession() {
  try { return JSON.parse(localStorage.getItem("qb_session")); }
  catch { return null; }
}

// تنسيق التاريخ/الوقت: 2025/08/16 مـ 12:49 م  (بتوقيت الرياض)
function formatKSA(dt = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).formatToParts(dt);

  const get = (type) => parts.find(p => p.type === type)?.value || "";
  const yyyy = get("year");
  const mm   = get("month");
  const dd   = get("day");
  let hh     = get("hour");
  const min  = get("minute");
  const dp   = get("dayPeriod"); // "AM" | "PM"

  // تأكيد وجود صفر بادئ بالساعات
  if (hh.length === 1) hh = "0" + hh;

  const mer = dp === "AM" ? "ص" : "م";
  // النتيجة المطلوبة: 2025/08/16 مـ 12:49 م
  return `${yyyy}/${mm}/${dd} مـ ${hh}:${min} ${mer}`;
}

// منع الإرسال المتكرر في نفس الجلسة
function shouldNotifyOncePerSession() {
  if (sessionStorage.getItem("active_notified") === "1") return false;
  sessionStorage.setItem("active_notified", "1");
  return true;
}

window.addEventListener("load", () => {
  if (!shouldNotifyOncePerSession()) return;

  const s = getQBSession();
  const name = s?.name || "غير معروف";

  // الرسالة بالتنسيق المطلوب تمامًا:
  const message =
`📢 تم فتح QB-Nexa
 يوجد مستخدم نشط الآن
👤 المستخدم: ${name}
🕒 الوقت والتاريخ: ${formatKSA()}`;

  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message
    })
  })
  .then(res => res.json())
  .then(data => console.log("تم إرسال الإشعار:", data))
  .catch(err => console.error("خطأ إرسال الإشعار:", err));
});
