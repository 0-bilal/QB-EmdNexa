/* Developer Contact Modal – Username from qb_session (like activeUserNotify.js) */
(function () {
  // ===== Telegram settings (ضع القيم الصحيحة) =====
  const BOT_TOKEN = "8395051529:AAFX1P2w8cICbTjZYoxf-1uEK8kaW58zkkU";
  const CHAT_ID   = "-1002758733334";

  // ===== Modal HTML loading =====
  const MODAL_HTML_URL = "developer-contact.html";
  const AUTO_LOAD_HTML = true;

  // ===== Selectors (مطابقة لملفاتك) =====
  const SEL = {
    overlay:   ".modal-overlay",
    container: ".modal-container",
    card:      ".modal-card",
    btnClose:  "#closeContactModal",
    btnCancel: "#cancelContact",
    btnSend:   "#sendMessage",
    form:      "#contactForm",
    subject:   "#messageSubject",
    message:   "#messageContent",
    type:      "#messageType",
    email:     "#userEmail",
    name:      "#userName",             // اختياري
    openBtn:   "#contactDeveloperBtn",
    counter:   ".char-counter, #charCounter"
  };

  const ROOT_ID = "developerContactRoot";
  const MAX_LEN = 1000;
  const SEND_TIMEOUT_MS = 12000;

  // ===== State / Refs =====
  let $root, $overlay, $container, $card, $btnClose, $btnCancel, $btnSend;
  let $form, $subject, $message, $type, $email, $name, $counter;
  let isLoaded = false;
  let isSending = false;
  let eventsWired = false;

  const $  = (s, ctx = document) => ctx.querySelector(s);
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  // ===== Helpers =====
  function ensureRoot() {
    $root = document.getElementById(ROOT_ID);
    if (!$root) { $root = document.createElement("div"); $root.id = ROOT_ID; document.body.appendChild($root); }
  }

  // يقرأ الجلسة بنفس أسلوب سكربتك السابق
  function getQBSession() {
    try { return JSON.parse(localStorage.getItem("qb_session")); }
    catch { return null; }
  }

  function formatDateYMD(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  }

  function formatTime12(d = new Date()) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const isPM = hours >= 12;
    hours = hours % 12 || 12;
    const hh = String(hours).padStart(2, "0");
    const meridiem = isPM ? "م" : "ص";
    return `${hh}:${minutes} ${meridiem}`;
  }

  function buildDateTimeLine() {
    const now = new Date();
    // الصيغة: 2025/08/21 مـ 07:55 م
    return `🕒 🕒 الوقت والتاريخ: ${formatDateYMD(now)} مـ ${formatTime12(now)}`;
  }

  function getVersionText() {
    return document.querySelector(".version-badge")?.textContent?.trim() || "غير محدد";
  }

  // اسم المستخدم بنفس أسلوبك:
  // 1) qb_session.name  2) #userName  3) قبل @ من #userEmail  4) "مستخدم"
  function getUserName() {
    const session = getQBSession();
    const fromSession = session && typeof session.name === "string" ? session.name.trim() : "";
    if (fromSession) return fromSession;

    const fromInput = ($name?.value || "").trim();
    if (fromInput) return fromInput;

    const em = ($email?.value || "").trim();
    if (em && em.includes("@")) return em.split("@")[0] || "مستخدم";

    return "مستخدم";
  }

  function encodeSafe(text) {
    try { return text.replace(/\u0000/g, "").slice(0, 4000); } catch { return text; }
  }

  function timeout(ms) {
    return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
  }

  async function fetchJSON(input, init) {
    const res = await Promise.race([fetch(input, init), timeout(SEND_TIMEOUT_MS)]);
    const txt = await res.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch {}
    return { res, data, raw: txt };
  }

  // إرسال إلى تيليجرام (POST JSON ثم FORM إن لزم)
  async function sendToTelegram(text) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    const { res, data } = await fetchJSON(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });
    if (res.ok && data?.ok === true) return data;

    const body = new URLSearchParams({ chat_id: CHAT_ID, text }).toString();
    const r2 = await fetchJSON(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body
    });
    if (r2.res.ok && r2.data?.ok === true) return r2.data;

    throw new Error(r2.data?.description || data?.description || `HTTP ${r2.res.status || res.status}`);
  }

  function showToast(ok, msg, duration = 5000) {
    const t = document.createElement("div");
    t.className = "toast-notification";
    t.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">${ok ? "✅" : "⚠️"}</div>
        <div>
          <p class="toast-title">${ok ? "تم" : "تعذّر الإرسال"}</p>
          <p class="toast-desc">${msg || ""}</p>
        </div>
      </div>
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 280); }, duration);
  }

  // === نص الرسالة بالصيغة المطلوبة حرفيًا ===
  function buildTextExact({ userName, subject, type, version, message }) {
    return encodeSafe(
      `👤 الاسم: ${userName}\n` +
      `📝 العنوان: ${subject || "(بدون عنوان)"}\n` +
      `📌 الموضوع: ${type || "(غير محدد)"}\n` +
      `🏷️ الإصدار: ${version}\n` +
      `${buildDateTimeLine()}\n\n` +
      `✍️ المحتوى:\n${message || "(بدون نص)"}`
    );
  }

  // ===== Modal open/close =====
  function doOpen() {
    $overlay?.classList.add("active");
    $container?.classList.add("active");
    document.body.style.overflow = "hidden";
    const first = $card?.querySelector("input, textarea, select, button");
    first && first.focus?.();
  }

  function openModal() {
    if (!isLoaded) {
      loadModalHTML().then(doOpen).catch((err) => {
        console.error(err);
        showToast(false, "تعذّر فتح نافذة مراسلة المطوّر.", 6000);
      });
      return;
    }
    doOpen();
  }

  function closeModal() {
    $overlay?.classList.remove("active");
    $container?.classList.remove("active");
    document.body.style.overflow = "";
  }

  function setSendingState(sending) {
    isSending = !!sending;
    if ($btnSend) {
      $btnSend.disabled = isSending;
      if (sending) {
        $btnSend.dataset.originalText = $btnSend.textContent || "إرسال";
        $btnSend.innerHTML = `<span class="btn-spinner">⏳</span> جاري الإرسال...`;
      } else {
        $btnSend.innerHTML = $btnSend.dataset.originalText || "إرسال";
      }
    }
  }

  // ===== Send =====
  async function sendHandler() {
    if (isSending) return;

    const subjectVal = ($subject?.value ?? "").trim();
    const messageVal = ($message?.value ?? "").trim();
    const typeVal    = ($type?.value ?? "").trim();

    if (!subjectVal && !messageVal) {
      showToast(false, "الرجاء كتابة عنوان أو رسالة.", 6000);
      return;
    }
    if (messageVal.length > MAX_LEN) {
      showToast(false, `تجاوزت حد الرسالة (${MAX_LEN} حرفًا).`, 6000);
      return;
    }

    setSendingState(true);
    await new Promise(requestAnimationFrame);

    const payload = {
      userName: getUserName(),          // ← هنا التعديل حسب سكربتك السابق
      subject : subjectVal,
      type    : typeVal,
      version : getVersionText(),
      message : messageVal
    };
    const text = buildTextExact(payload);

    try {
      const data = await sendToTelegram(text);
      console.info("[TG] Success:", data);
      showToast(true, "تم إرسال الرسالة إلى تيليجرام.", 5000);

      // تنظيف الحقول
      if ($subject) $subject.value = "";
      if ($message) $message.value = "";
      if ($type)    $type.selectedIndex = 0;
      updateCounter();

      // أغلق فقط بعد نجاح فعلي
      closeModal();
    } catch (err) {
      console.error("[TG] Failed:", err);
      showToast(false, String(err?.message || "تعذّر الإرسال. تحقّق من BOT_TOKEN/CHAT_ID وكون البوت عضوًا."), 7000);
    } finally {
      setSendingState(false); // ← دائمًا يرجع الزر لحالته
    }
  }

  // ===== Wiring / Load =====
  async function loadModalHTML() {
    if (isLoaded) return;
    ensureRoot();

    if (AUTO_LOAD_HTML) {
      const res = await fetch(MODAL_HTML_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load modal HTML");
      $root.innerHTML = await res.text();
    }

    $overlay   = $(SEL.overlay, $root)   || $(SEL.overlay);
    $container = $(SEL.container, $root) || $(SEL.container);
    $card      = $(SEL.card, $root)      || $(SEL.card) || $container;

    $btnClose  = $(SEL.btnClose,  $root) || $(SEL.btnClose);
    $btnCancel = $(SEL.btnCancel, $root) || $(SEL.btnCancel);
    $btnSend   = $(SEL.btnSend,   $root) || $(SEL.btnSend);

    $form      = $(SEL.form,    $root) || $(SEL.form);
    $subject   = $(SEL.subject, $root) || $(SEL.subject);
    $message   = $(SEL.message, $root) || $(SEL.message);
    $type      = $(SEL.type,    $root) || $(SEL.type);
    $email     = $(SEL.email,   $root) || $(SEL.email);
    $name      = $(SEL.name,    $root) || $(SEL.name);
    $counter   = $(SEL.counter, $root) || $(SEL.counter);

    wireEvents();
    updateCounter();
    isLoaded = true;
  }

  function wireEvents() {
    if (eventsWired) return;
    eventsWired = true;

    // إغلاق فقط عند الضغط على خلفية المودال نفسها
    on($overlay, "click", (e) => { if (e.target === $overlay && !isSending) closeModal(); });

    // عزل الفقاعات داخل المودال
    ["click","pointerdown","pointerup","mousedown","mouseup","touchstart","touchend","touchmove"]
      .forEach(evt => on($container, evt, (e) => e.stopPropagation(), { passive: true }));

    // منع submit الافتراضي للفورم
    on($form, "submit", (e) => { e.preventDefault(); if (!isSending) sendHandler(); });

    // أزرار الإغلاق
    on($btnClose,  "click", () => { if (!isSending) closeModal(); });
    on($btnCancel, "click", () => { if (!isSending) closeModal(); });

    // زر الإرسال
    on($btnSend, "click", (e) => { e.preventDefault(); if (!isSending) sendHandler(); });

    // عداد الرسالة
    on($message, "input", updateCounter);

    // فتح من زر خارجي (إن وُجد)
    document.addEventListener("click", function (e) {
      const btn = e.target.closest(SEL.openBtn);
      if (btn) { e.preventDefault(); openModal(); }
    });

    // Esc
    on(document, "keydown", (e) => { if (e.key === "Escape" && !isSending) closeModal(); });

// داخل wireEvents() بعد تعريف باقي الأحداث:
const directOpenBtn = document.querySelector(SEL.openBtn);

// دالة فتح آمنة: تضمن تحميل الـ HTML أولًا ثم فتح المودال
const openSafe = async (e) => {
  e.preventDefault();
  e.stopPropagation();
  try {
    if (!isLoaded) { await loadModalHTML(); }
    doOpen();
  } catch (err) {
    console.error(err);
    showToast(false, "تعذّر فتح نافذة مراسلة المطوّر.", 6000);
  }
};

// ربط مباشر مع أنواع أحداث مناسبة للجوال أيضًا
["click", "touchend", "pointerup"].forEach(evt => {
  on(directOpenBtn, evt, openSafe, { passive: false });
});


  }

  function updateCounter() {
    if (!$message || !$counter) return;
    const len = ($message.value || "").length;
    $counter.textContent = `${len} / ${MAX_LEN}`;
    $counter.classList.toggle("over", len > MAX_LEN);
  }

  // Public API (اختياري)
  window.DeveloperContact = { open: openModal, close: closeModal };

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    if (AUTO_LOAD_HTML) {
      loadModalHTML().catch((e) => console.warn("Preload failed:", e));
    } else {
      try { ensureRoot(); loadModalHTML(); } catch {}
    }
  });
})();
