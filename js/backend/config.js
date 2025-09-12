/* assets/js/config.js */
(function (w) {
  // غيّر هذا فقط عند تغيير رابط الويب آب
  const API_BASE =
    "https://script.google.com/macros/s/AKfycbz5zJMy8LVry8e3NtwddGWt-BW37AHE6ZiPdiqjpAV5R3IdztTEdsrEYeME5lj8vCjC/exec";

  // كائن إعدادات موحّد
  const CONFIG = Object.freeze({
    API_BASE,
    ENDPOINTS: Object.freeze({
      // روابط جاهزة لبعض الاستدعاءات الشائعة
      PING:            `${API_BASE}?action=ping`,
      LOGIN_VALIDATE:  `${API_BASE}?action=validate`,
      ADMIN:           `${API_BASE}`, // POST مع action=list/get/addOrUpdate/delete
      WALLET:          `${API_BASE}`, // POST مع action=save_operation/get_operations/delete_operation
    }),
    ACTIONS: Object.freeze({
      VALIDATE:        "validate",
      PING:            "ping",
      SAVE_OPERATION:  "save_operation",
      GET_OPERATIONS:  "get_operations",
      DELETE_OPERATION:"delete_operation",
      ADMIN_LIST:      "list",
      ADMIN_GET:       "get",
      ADMIN_UPSERT:    "addOrUpdate",
      ADMIN_DELETE:    "delete",
    }),
    // مُنشئ روابط GET مع بارامترات
    buildUrl(action, params = {}) {
      const sp = new URLSearchParams({ action, ...params });
      return `${API_BASE}?${sp.toString()}`;
    },
  });

  // تعريضه كعام (Global)
  w.QB = w.QB || {};
  w.QB.CONFIG = CONFIG;

  // مساعدات جاهزة (اختيارية) لتوحيد طريقة الاتصال
  w.qbGet = (action, params = {}) =>
    fetch(CONFIG.buildUrl(action, params), { method: "GET" });

  w.qbPost = (action, payload = {}) =>
    fetch(CONFIG.API_BASE, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // بدون preflight
      body: JSON.stringify({ action, ...payload }),
    });

  // تحذير مفيد لو نُسّيت تحميل الملف قبل الباقي
  console.assert(!!w.QB.CONFIG, "[config] لم يتم تحميل CONFIG");
})(window);
