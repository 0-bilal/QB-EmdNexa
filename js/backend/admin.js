/* =====================[ إعدادات عامة ]===================== */
const WEB_APP_URL = QB.CONFIG.API_BASE;
const LOGIN_PAGE_URL = 'login.html';                            // ← مسار صفحة تسجيل الدخول

/* مفاتيح الذاكرة المحلية القادمة من login.js */
const ADMIN_KEY_OBJECT = 'QB_ADMIN_AUTH'; // {id, name, role, ts, expiry, token?, sig?}
const ADMIN_KEY_ID     = 'QB_ADMIN_ID';
const ADMIN_KEY_TS     = 'QB_ADMIN_TS';
const ADMIN_KEY_SIG    = 'QB_ADMIN_SIG';
const ADMIN_TTL_MS     = 24 * 60 * 60 * 1000; // 24 ساعة افتراضيًا

/* حالة عامة */
let employees = [];
let editingIndex = -1;
let deletingIndex = -1;
let ADMIN_AUTH = null;

/* مختصرات DOM */
const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const byId = (id) => document.getElementById(id);

/* =====================[ أدوات واجهة ]===================== */
function showLoading(title = 'جاري التحميل...', message = 'يرجى الانتظار') {
  const overlay   = byId('loadingOverlay');
  const titleEl   = byId('loadingTitle');
  const messageEl = byId('loadingMessage');
  if (titleEl)   titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (overlay) { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}
function hideLoading() {
  const overlay = byId('loadingOverlay');
  if (overlay) { overlay.style.display = 'none'; document.body.style.overflow = 'auto'; }
}
function formatDateISO(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const dd = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

/* =====================[ مصادقة الإدمن (متصفح) ]===================== */
function readAdminAuth() {
  // أولوية للكائن الكامل
  const raw = localStorage.getItem(ADMIN_KEY_OBJECT);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (obj && obj.id) return obj;
    } catch (_) {}
  }
  // توافق خلفي: مفاتيح منفصلة
  const id = localStorage.getItem(ADMIN_KEY_ID);
  if (!id) return null;
  const ts  = Number(localStorage.getItem(ADMIN_KEY_TS) || '0') || Date.now();
  const sig = localStorage.getItem(ADMIN_KEY_SIG) || null;
  return { id, name:'', role:'admin', ts, expiry: ts + ADMIN_TTL_MS, sig };
}
function isAdminAuthValid(auth) {
  if (!auth || !auth.id) return false;
  const now = Date.now();
  const expiry = Number(auth.expiry || 0);
  if (expiry && now > expiry) return false;
  if (!expiry && auth.ts && (now - Number(auth.ts)) > ADMIN_TTL_MS) return false;
  return true;
}
function redirectToLogin(reason = 'auth') {
  const url = new URL(LOGIN_PAGE_URL, location.href);
  url.searchParams.set('from', 'admin');
  url.searchParams.set('reason', reason);
  location.href = url.toString();
}
function requireAdminAuth() {
  ADMIN_AUTH = readAdminAuth();
  if (!isAdminAuthValid(ADMIN_AUTH)) {
    localStorage.removeItem(ADMIN_KEY_OBJECT);
    localStorage.removeItem(ADMIN_KEY_ID);
    localStorage.removeItem(ADMIN_KEY_TS);
    localStorage.removeItem(ADMIN_KEY_SIG);
    redirectToLogin('missing_or_expired');
    return false;
  }
  return true;
}

/* =====================[ اتصال GAS وتمرير adminId ]===================== */
async function postToGAS(url, bodyObj) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(bodyObj)
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch {
    console.error('[GAS raw]', text);
    throw new Error('رد غير JSON من الويب-آب: ' + text.slice(0, 200));
  }
  if (!json.ok) {
    const err = new Error(json.error || 'Request failed');
    err.code = json.error || '';
    throw err;
  }
  return json;
}
async function callAdmin(action, payload = {}) {
  if (!requireAdminAuth()) return Promise.reject(new Error('NO_LOCAL_ADMIN'));
  const body = {
    action,
    adminId: ADMIN_AUTH.id,
    ts: ADMIN_AUTH.ts || Date.now(),
    ...(ADMIN_AUTH.sig ? { sig: ADMIN_AUTH.sig } : {}),
    ...payload
  };
  return postToGAS(WEB_APP_URL, body);
}

/* =====================[ تحويل سطر K إلى كائن موظف ]===================== */
function parseAggregatedLine(line) {
  const obj = {};
  if (!line) return obj;
  line.split('|').forEach(part => {
    const [k, ...rest] = part.trim().split('=');
    obj[(k || '').trim()] = (rest.join('=') || '').trim();
  });
  return obj;
}
function toEmployeeObject(kObj) {
  return {
    id:            (kObj.id || '').trim(),
    name:          (kObj.nm || '').trim(),
    role:          (kObj.rl || '').trim(),
    status:        (kObj.st || '').trim(),
    expiryDate:    (kObj.exp || '').trim(),
    loginCount:    (kObj.lg || '0').trim(),
    lastActivity:  (kObj.act || '').trim(),
    deviceStatus:  (kObj.dev || '').trim(),
    operationsCount:(kObj.op || '0').trim(),
    lastVersion:   (kObj.ver || '').trim()
  };
}
function statusToClass(st) {
  const s = (st || '').toLowerCase().trim();
  if (s === 'active') return 'status-active';
  if (s === 'no active' || s === 'inactive') return 'status-inactive';
  if (s === 'expired' || s === 'expired session') return 'status-expired';
  return 'status-active';
}

/* =====================[ عمليات GAS: list/get (GET) + addOrUpdate/delete (POST) ]===================== */
// حمّل القائمة كاملة (GET / action=list)
async function loadEmployeesFromSheet() {
  showLoading('جاري تحميل البيانات...', 'جلب القائمة من الخادم');
  try {
    const u = new URL(WEB_APP_URL);
    u.searchParams.set('service','admin');   // <<< مهم
    u.searchParams.set('action', 'list');
    u.searchParams.set('adminId', (ADMIN_AUTH?.id || ''));
    u.searchParams.set('t', Date.now()); // منع الكاش

    const res  = await fetch(u.toString(), { method: 'GET' });
    const json = await res.json();

    if (!json.ok) {
      const err = new Error(json.error || 'Request failed');
      err.code = json.error || '';
      throw err;
    }

    employees = (json.data || []).map(parseAggregatedLine).map(toEmployeeObject);
    renderEmployeeTable();
    renderMobileCards();
  } catch (error) {
    console.error('[Load]', error);
    if (['UNAUTHORIZED','MISSING_ADMIN_ID','ADMIN_NOT_FOUND','NOT_ADMIN'].includes(error.code)) {
      redirectToLogin(error.code.toLowerCase());
      return;
    }
    alert('تعذر تحميل البيانات. تحقّق من رابط الويب-آب والصلاحيات.');
  } finally {
    hideLoading();
  }
}

// جلب سجل واحد عبر id (GET / action=get)
async function getEmployeeById(id) {
  if (!id) throw new Error('MISSING_ID');
  showLoading('جاري التحميل...', `جلب السجل ${id}`);
  try {
    const u = new URL(WEB_APP_URL);
    u.searchParams.set('action','get');
    u.searchParams.set('service','admin');   // <<< مهم
    u.searchParams.set('adminId', (ADMIN_AUTH?.id || ''));
    u.searchParams.set('id', id);
    u.searchParams.set('t', Date.now());
    const res = await fetch(u.toString(), { method: 'GET' });
    const json = await res.json();
    if (!json.ok) { const e = new Error(json.error||'Request failed'); e.code=json.error||''; throw e; }
    const agg = parseAggregatedLine(json.data || '');
    return toEmployeeObject(agg);
  } catch (error) {
    console.error('[Get]', error);
    if (['UNAUTHORIZED','MISSING_ADMIN_ID','ADMIN_NOT_FOUND','NOT_ADMIN'].includes(error.code)) {
      redirectToLogin(error.code.toLowerCase());
      return null;
    }
    if (error.code === 'NOT_FOUND') {
      alert('لم يتم العثور على السجل المطلوب.');
      return null;
    }
    throw error;
  } finally {
    hideLoading();
  }
}

// حفظ (إضافة/تحديث) — عبر POST / addOrUpdate (الخادم يحدّث فقط إن كان id موجودًا)
async function saveEmployeeToSheet(emp) {
  const isEdit = editingIndex > -1;
  const title = isEdit ? 'جاري تحديث البيانات...' : 'جاري إضافة الموظف...';
  const message = isEdit ? 'يتم تعديل معلومات الموظف' : 'يتم حفظ بيانات الموظف';
  showLoading(title, message);
  try {
    const result = await callAdmin('addOrUpdate', {
      id:  emp.id,
      nm:  emp.name,
      rl:  emp.role,
      st:  emp.status,
      exp: emp.expiryDate
    });
    return result;
  } catch (error) {
    console.error('[Save]', error);
    if (['UNAUTHORIZED','MISSING_ADMIN_ID','ADMIN_NOT_FOUND','NOT_ADMIN'].includes(error.code)) {
      redirectToLogin(error.code.toLowerCase());
      return;
    }
    throw error;
  } finally {
    hideLoading();
  }
}

// حذف — عبر POST / delete
async function deleteEmployeeFromSheet(employeeId) {
  showLoading('جاري الحذف...', 'يتم التحقق من الصلاحيات ثم الإزالة');
  try {
    const result = await callAdmin('delete', { id: employeeId });
    return result;
  } catch (error) {
    console.error('[Delete]', error);
    if (['UNAUTHORIZED','MISSING_ADMIN_ID','ADMIN_NOT_FOUND','NOT_ADMIN'].includes(error.code)) {
      redirectToLogin(error.code.toLowerCase());
      return;
    }
    throw error;
  } finally {
    hideLoading();
  }
}

/* =====================[ رسم الجدول/الكروت ]===================== */
function renderEmployeeTable() {
  const tbody = byId('employeeTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  employees.forEach((e, idx) => {
    const tr = document.createElement('tr');
    const statusClass = statusToClass(e.status);
    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${e.name}</td>
      <td>${e.role}</td>
      <td><span class="status-badge ${statusClass}">${e.status || '-'}</span></td>
      <td>${e.expiryDate || '-'}</td>
      <td>${e.loginCount || '0'}</td>
      <td>${e.lastActivity || '-'}</td>
      <td>${e.deviceStatus || '-'}</td>
      <td>${e.operationsCount || '0'}</td>
      <td>${e.lastVersion || '-'}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-btn" data-index="${idx}" title="تعديل">✏️</button>
          <button class="action-btn delete-btn" data-index="${idx}" title="حذف">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  $$('#employeeTableBody .edit-btn').forEach(btn => {
    btn.onclick = () => openEmployeeModal(Number(btn.dataset.index));
  });
  $$('#employeeTableBody .delete-btn').forEach(btn => {
    btn.onclick = () => openDeleteModal(Number(btn.dataset.index));
  });
}

function renderMobileCards() {
  const wrap = byId('mobileEmployeeCards');
  if (!wrap) return;
  wrap.innerHTML = '';

  employees.forEach((e, idx) => {
    const statusClass = statusToClass(e.status);
    const card = document.createElement('div');
    card.className = 'employee-card';
    card.innerHTML = `
      <div class="employee-card-header">
        <div class="employee-basic-info">
          <h3>${e.name || '-'}</h3>
          <div class="employee-id">${e.id || '-'}</div>
        </div>
        <span class="status-badge ${statusClass}">${e.status || '-'}</span>
      </div>

      <div class="employee-card-body">
        <div class="info-item"><div class="info-label">الدور</div><div class="info-value">${e.role || '-'}</div></div>
        <div class="info-item"><div class="info-label">تاريخ الانتهاء</div><div class="info-value">${e.expiryDate || '-'}</div></div>
        <div class="info-item"><div class="info-label">تسجيلات الدخول</div><div class="info-value">${e.loginCount || '0'}</div></div>
        <div class="info-item"><div class="info-label">آخر نشاط</div><div class="info-value">${e.lastActivity || '-'}</div></div>
        <div class="info-item"><div class="info-label">حالة الجهاز</div><div class="info-value">${e.deviceStatus || '-'}</div></div>
        <div class="info-item"><div class="info-label">العمليات</div><div class="info-value">${e.operationsCount || '0'}</div></div>
        <div class="info-item"><div class="info-label">آخر إصدار</div><div class="info-value">${e.lastVersion || '-'}</div></div>
      </div>

      <div class="employee-card-actions">
        <button class="mobile-action-btn mobile-edit-btn" data-index="${idx}"><span>✏️</span><span>تعديل</span></button>
        <button class="mobile-action-btn mobile-delete-btn" data-index="${idx}"><span>🗑️</span><span>حذف</span></button>
      </div>
    `;
    wrap.appendChild(card);
  });

  $$('.mobile-edit-btn').forEach(btn => {
    btn.onclick = () => openEmployeeModal(Number(btn.dataset.index));
  });
  $$('.mobile-delete-btn').forEach(btn => {
    btn.onclick = () => openDeleteModal(Number(btn.dataset.index));
  });
}

/* =====================[ نوافذ وتفاعلات ]===================== */
function openEmployeeModal(index = -1) {
  editingIndex = index;
  const modal = byId('employeeModal');
  if (!modal) return;

  const emp = (index > -1) ? employees[index] : {
    id: '', name: '', role: '', status: 'active',
    expiryDate: formatDateISO(new Date(new Date().setFullYear(new Date().getFullYear()+1)))
  };

  byId('employeeId').value     = emp.id || '';
  byId('employeeName').value   = emp.name || '';
  byId('employeeRole').value   = emp.role || '';
  byId('employeeStatus').value = emp.status || 'active';
  byId('expiryDate').value     = emp.expiryDate || '';

  byId('modalTitle').textContent  = (index > -1) ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد';
  byId('modalIcon').textContent   = (index > -1) ? '✏️' : '➕';
  byId('saveBtnText').textContent = (index > -1) ? 'تحديث البيانات' : 'إضافة الموظف';

  modal.style.display = 'flex';
}
function closeEmployeeModal() {
  const modal = byId('employeeModal');
  if (modal) modal.style.display = 'none';
  editingIndex = -1;
}
function openDeleteModal(index) {
  deletingIndex = index;
  const emp = employees[index];
  byId('deleteEmployeeName').textContent = emp?.name || '';
  byId('deleteEmployeeId').textContent   = emp?.id || '';
  const modal = byId('deleteModal');
  if (modal) modal.style.display = 'flex';
}
function closeDeleteModalFunction() {
  const modal = byId('deleteModal');
  if (modal) modal.style.display = 'none';
  deletingIndex = -1;
}

/* =====================[ حفظ/حذف ]===================== */
async function handleFormSubmit(e) {
  e.preventDefault();

  const idField   = byId('employeeId');
  const nameField = byId('employeeName');
  const roleField = byId('employeeRole');
  const stField   = byId('employeeStatus');
  const expField  = byId('expiryDate');

  const data = {
    id: (idField?.value || '').trim(),
    name: (nameField?.value || '').trim(),
    role: (roleField?.value || '').trim(),
    status: (stField?.value || '').trim(),
    expiryDate: expField?.value || ''
  };

  if (!data.id)         { alert('رقم التعريف (id) مطلوب'); idField?.focus();   return; }
  if (!data.name)       { alert('اسم الموظف مطلوب');        nameField?.focus(); return; }
  if (!data.role)       { alert('الدور مطلوب');              roleField?.focus(); return; }
  if (!data.status)     { alert('الحالة مطلوبة');            stField?.focus();   return; }
  if (!data.expiryDate) { alert('تاريخ الصلاحية مطلوب');     expField?.focus();  return; }

  const wasEdit = editingIndex > -1;

  try {
    await saveEmployeeToSheet(data);

    // بعد التحديث/الإضافة: إن كان لدينا id محدد في رابط الصفحة، أعد تحميل نفس السجل فقط
    const idInQuery = (new URL(location.href)).searchParams.get('id');
    if (idInQuery) {
      const emp = await getEmployeeById(idInQuery);
      employees = emp?.id ? [emp] : [];
      renderEmployeeTable();
      renderMobileCards();
    } else {
      await loadEmployeesFromSheet();
    }

    closeEmployeeModal();
    showSuccessMessage(wasEdit ? 'تم التحديث بنجاح ✅' : 'تم الحفظ بنجاح ✅');
  } catch (err) {
    console.error('[Save]', err);
    alert('تعذّر الحفظ. تحقّق من رابط الويب-آب والصلاحيات.');
  }
}
async function confirmDelete() {
  if (deletingIndex < 0) return;
  const employeeId = employees[deletingIndex].id;
  try {
    await deleteEmployeeFromSheet(employeeId);
    const idInQuery = (new URL(location.href)).searchParams.get('id');
    if (idInQuery) {
      // لو كنت في عرض سجل محدد واحذفته، أفرغ الجدول
      employees = [];
      renderEmployeeTable();
      renderMobileCards();
    } else {
      await loadEmployeesFromSheet();
    }
    closeDeleteModalFunction();
    showSuccessMessage('تم الحذف بنجاح 🗑️');
  } catch (err) {
    console.error('[Delete]', err);
    alert('تعذّر الحذف. تحقّق من رابط الويب-آب والصلاحيات.');
  }
}

/* =====================[ Toast نجاح بسيط ]===================== */
let successTimer = null;
function showSuccessMessage(text = 'تم') {
  let el = byId('successToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'successToast';
    el.style.position = 'fixed';
    el.style.bottom = '20px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.padding = '10px 16px';
    el.style.borderRadius = '10px';
    el.style.background = '#16a34a';
    el.style.color = '#fff';
    el.style.fontSize = '14px';
    el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
    el.style.zIndex = '9999';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  if (successTimer) clearTimeout(successTimer);
  successTimer = setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
  }, 1600);
}

/* =====================[ إقلاع الصفحة ]===================== */
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAdminAuth()) return;

  byId('addEmployeeBtn')?.addEventListener('click', () => openEmployeeModal(-1));
  byId('employeeForm')?.addEventListener('submit', handleFormSubmit);

  byId('closeModal')?.addEventListener('click', closeEmployeeModal);
  byId('cancelBtn')?.addEventListener('click', closeEmployeeModal);

  byId('closeDeleteModal')?.addEventListener('click', closeDeleteModalFunction);
  byId('cancelDeleteBtn')?.addEventListener('click', closeDeleteModalFunction);
  byId('confirmDeleteBtn')?.addEventListener('click', confirmDelete);

  // تعبئة افتراضية لحقل تاريخ الانتهاء عند فتح النموذج لأول مرّة
  const expiryDateInput = byId('expiryDate');
  if (expiryDateInput && !expiryDateInput.value) {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expiryDateInput.value = nextYear.toISOString().split('T')[0];
  }

  try {
    const url = new URL(location.href);
    const idParam = (url.searchParams.get('id') || '').trim();

    if (!WEB_APP_URL || WEB_APP_URL.includes('PUT_YOUR_ADMIN_WEB_APP_EXEC_URL_HERE')) {
      console.warn('⚠️ WEB_APP_URL غير مضبوط. ضع رابط الويب-آب الصحيح.');
    }

    if (idParam) {
      // عرض سجل واحد عبر id
      const emp = await getEmployeeById(idParam);
      employees = emp?.id ? [emp] : [];
      renderEmployeeTable();
      renderMobileCards();
    } else {
      // عرض القائمة الكاملة
      await loadEmployeesFromSheet();
    }
  } catch (err) {
    console.error('[Initial Load]', err);
    alert('تعذر التحميل الأولي. تحقّق من رابط الويب-آب والصلاحيات.');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEmployeeModal();
      closeDeleteModalFunction();
      hideLoading();
    }
  });
});
