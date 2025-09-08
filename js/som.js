const SAVE_API_URL = "https://script.google.com/macros/s/AKfycbywXfqFC0fgZoBcjgBM2VUTnQSKZuY7CqdVeflqFvC9HoIpE8cNN0arAMY3deZaM_AL/exec";

function safeSession() {
  try {
    const s = JSON.parse(localStorage.getItem("qb_session") || "{}");
    return (s && s.user_id) ? s : null;
  } catch {
    return null;
  }
}

// رقم الإصدار (اختياري لكنه مفيد للتتبّع)
function getAppVersionSafe() {
  if (typeof APP_VERSION !== "undefined" && APP_VERSION) return APP_VERSION;
  const el = document.querySelector(".version-badge,#appVersion");
  return (el && el.textContent || "unknown").trim() || "unknown";
}

function normalizeNumberEn(v) {
  if (v == null) return "";
  let s = String(v).trim();

  const arabicIndic  = "٠١٢٣٤٥٦٧٨٩";
  const easternIndic = "۰۱۲۳۴۵۶۷۸۹";
  s = s.replace(/[٠-٩]/g, d => String(arabicIndic.indexOf(d)))
       .replace(/[۰-۹]/g, d => String(easternIndic.indexOf(d)));

  s = s.replace(/[،٬٫]/g, ".").replace(/,/g, ".");

  s = s.replace(/[^0-9.\-]/g, "");

  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");

  return (s === "." || s === "-") ? "" : s;
}

function mapPriceTypeToPT() {
  const v = (document.getElementById("priceType")?.value || "").trim();
  if (v === "withTax")    return "NOVAT"; // سعر بطاقة (بدون ضريبة)
  if (v === "withoutTax") return "VAT";   // سعر شامل الضريبة
  return "NOVAT"; // افتراضيًا
}

function collectInputFields() {
  return {
    PT: mapPriceTypeToPT(),
    PRICE: normalizeNumberEn(document.getElementById("carPrice")?.value || ""),

    XB:  normalizeNumberEn(document.getElementById("extras")?.value || ""),
    SVC: normalizeNumberEn(document.getElementById("other1")?.value || ""),
    CB:  normalizeNumberEn(document.getElementById("cashback")?.value || ""),
    SUP: normalizeNumberEn(document.getElementById("support")?.value || ""),
    NP:  normalizeNumberEn(document.getElementById("other2")?.value || ""),
    DPR: normalizeNumberEn(document.getElementById("downPaymentRate")?.value || ""), 
    BLR: normalizeNumberEn(document.getElementById("balloonRate")?.value || ""),
    PR:  normalizeNumberEn(document.getElementById("profitRate")?.value || ""),
    IR:  normalizeNumberEn(document.getElementById("insuranceRate")?.value || ""),
    AR:  normalizeNumberEn(document.getElementById("adminRate")?.value || ""),
    Y:   normalizeNumberEn(document.getElementById("years")?.value || "")
  };
}

function buildDataCompactFrom(obj) {
  return Object.entries(obj)
    .filter(([_, v]) => v !== undefined && v !== null && String(v) !== "")
    .map(([k, v]) => `${k}=${String(v).replace(/\|/g, "¦")}`)
    .join("|");
}

async function saveOperation(operationName) {
  const session = safeSession();
  if (!session?.user_id) {
    alert("الرجاء تسجيل الدخول أولًا قبل حفظ العملية.");
    return;
  }

  const inputs = collectInputFields();
  const data_compact = buildDataCompactFrom(inputs);

  const payload = {
    action: "save_operation",
    user_id: session.user_id,
    operation_name: operationName,
    data_compact,
    version: getAppVersionSafe(),
    ts_client: Date.now()
  };

  try {
    const res = await fetch(SAVE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); } catch { json = { ok:false, error:"NON_JSON_RESPONSE", raw: txt }; }

    if (json && json.ok) {
      showSaveSuccess();
    } else {
      console.warn("[SaveOperation] server error:", json);
      alert("تعذر حفظ العملية. تحقّق من نشر الويب آب واسم الورقة وصلاحيات الوصول.");
    }
  } catch (err) {
    console.error("[SaveOperation] network error:", err);
    alert("تعذر الاتصال بالخادم. تأكد من SAVE_API_URL والنشر كـ Web App (Anyone with the link).");
  }
}

function showSaveSuccess() {
  const success = document.getElementById("saveSuccess");
  const modal   = document.getElementById("saveModal");
  const form    = document.getElementById("saveForm");

  success?.classList.add("show");
  setTimeout(() => {
    modal?.classList.remove("active");
    form?.reset();
    success?.classList.remove("show");
    document.body.style.overflow = "";
  }, 2000);
}

function openSaveModal() {
  const modal = document.getElementById("saveModal");
  const nameInput = document.getElementById("operationName");
  const success = document.getElementById("saveSuccess");

  modal?.classList.add("active");
  nameInput?.focus();
  success?.classList.remove("show");
  document.body.style.overflow = "hidden";
}

function closeSaveModal() {
  const modal = document.getElementById("saveModal");
  const form  = document.getElementById("saveForm");
  const success = document.getElementById("saveSuccess");

  modal?.classList.remove("active");
  form?.reset();
  success?.classList.remove("show");
  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const saveBtn   = document.getElementById("saveDataBtn");
  const closeBtn  = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelSave");
  const modal     = document.getElementById("saveModal");
  const form      = document.getElementById("saveForm");
  const nameInput = document.getElementById("operationName");
  const success   = document.getElementById("saveSuccess");

  saveBtn?.addEventListener("click", openSaveModal);

  closeBtn?.addEventListener("click", closeSaveModal);
  cancelBtn?.addEventListener("click", closeSaveModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeSaveModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("active")) closeSaveModal();
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const operationName = (nameInput?.value || "").trim();
    if (!operationName) { nameInput?.focus(); return; }
    saveOperation(operationName);
  });

  nameInput?.addEventListener("input", () => {
    success?.classList.remove("show");
  });
});
