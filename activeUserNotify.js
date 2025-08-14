// بيانات البوت
const BOT_TOKEN = "8395051529:AAFX1P2w8cICbTjZYoxf-1uEK8kaW58zkkU";
const CHAT_ID = "-1002758733334";

// الحصول على التاريخ والوقت الحالي
const now = new Date();
const dateTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh" });

// نص الرسالة
const message = `📢 تم فتح QB-Nexa — يوجد مستخدم نشط الآن\n🕒 الوقت والتاريخ: ${dateTime}`;

// إرسال الطلب عند تحميل الصفحة
window.addEventListener("load", () => {
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: message
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log("تم إرسال الإشعار بنجاح:", data);
  })
  .catch(err => {
    console.error("حدث خطأ أثناء إرسال الإشعار:", err);
  });
});
