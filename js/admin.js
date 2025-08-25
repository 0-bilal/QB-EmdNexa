const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyESxUtYPNcVNrMf2_dAUy7d6vbydDvASw_5tBo3E6Rl1dYPRBhCz4r2pUhv6dMqcKK/exec';

let employees = [];
let editingIndex = -1;
let deletingIndex = -1;

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const byId = (id) => document.getElementById(id);

function showLoading(title = 'جاري التحميل...', message = 'يرجى الانتظار') {
  const overlay = byId('loadingOverlay');
  const titleEl = byId('loadingTitle');
  const messageEl = byId('loadingMessage');
  
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  
  if (overlay) {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function hideLoading() {
  const overlay = byId('loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

function formatDateISO(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const dd = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

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
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json;
}

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
    id:   (kObj.id || '').trim(),   
    name: (kObj.nm || '').trim(),   
    role: (kObj.rl || '').trim(),   
    status: (kObj.st || '').trim(), 
    expiryDate: (kObj.exp || '').trim(), 
    loginCount: (kObj.lg || '0').trim(),
    lastActivity: (kObj.act || '').trim(),
    deviceStatus: (kObj.dev || '').trim(),
    operationsCount: (kObj.op || '0').trim(),
    lastVersion: (kObj.ver || '').trim()
  };
}

function statusToClass(st) {
  const s = (st || '').toLowerCase().trim();
  if (s === 'active') return 'status-active';
  if (s === 'no active' || s === 'inactive') return 'status-inactive';
  if (s === 'expired' || s === 'expired session') return 'status-expired';
  return 'status-active';
}

async function loadEmployeesFromSheet() {
  showLoading('جاري تحميل البيانات...', 'يتم استرجاع قائمة الموظفين من الخادم');
  
  try {
    const res = await fetch(WEB_APP_URL, { cache: 'no-store' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Load failed');
    employees = (json.data || []).map(parseAggregatedLine).map(toEmployeeObject);
    renderEmployeeTable();
    renderMobileCards();
  } catch (error) {
    console.error('[Load]', error);
    throw error;
  } finally {
    hideLoading();
  }
}

async function saveEmployeeToSheet(emp) {
  const isEdit = editingIndex > -1;
  const title = isEdit ? 'جاري تحديث البيانات...' : 'جاري إضافة الموظف...';
  const message = isEdit ? 'يتم تعديل معلومات الموظف في النظام' : 'يتم حفظ بيانات الموظف الجديد';
  
  showLoading(title, message);
  
  try {
    const result = await postToGAS(WEB_APP_URL, {
      action: 'addOrUpdate',
      id: emp.id,          
      nm: emp.name,       
      rl: emp.role,       
      st: emp.status,     
      exp: emp.expiryDate  
    });
    return result;
  } catch (error) {
    console.error('[Save]', error);
    throw error;
  } finally {
    hideLoading();
  }
}

async function deleteEmployeeFromSheet(employeeId) {
  showLoading('جاري حذف الموظف...', 'يتم إزالة بيانات الموظف من النظام');
  
  try {
    const result = await postToGAS(WEB_APP_URL, { action: 'delete', id: employeeId });
    return result;
  } catch (error) {
    console.error('[Delete]', error);
    throw error;
  } finally {
    hideLoading();
  }
}

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

$$('.mobile-edit-btn').forEach(btn => {
  btn.onclick = () => openEmployeeModal(Number(btn.dataset.index));
});
$$('.mobile-delete-btn').forEach(btn => {
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

function openEmployeeModal(index = -1) {
  editingIndex = index;
  const modal = byId('employeeModal');
  if (!modal) return;

  const emp = (index > -1) ? employees[index] : {
    id: '', name: '', role: '', status: 'active',
    expiryDate: formatDateISO(new Date(new Date().setFullYear(new Date().getFullYear()+1)))
  };

  byId('employeeId').value = emp.id || '';
  byId('employeeName').value = emp.name || '';
  byId('employeeRole').value = emp.role || '';
  byId('employeeStatus').value = emp.status || 'active';
  byId('expiryDate').value = emp.expiryDate || '';

  byId('modalTitle').textContent = (index > -1) ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد';
  byId('modalIcon').textContent = (index > -1) ? '✏️' : '➕';
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
  byId('deleteEmployeeId').textContent = emp?.id || '';
  const modal = byId('deleteModal');
  if (modal) modal.style.display = 'flex';
}

function closeDeleteModalFunction() {
  const modal = byId('deleteModal');
  if (modal) modal.style.display = 'none';
  deletingIndex = -1;
}

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

  if (!data.id)   { alert('رقم التعريف (id) مطلوب'); idField?.focus();   return; }
  if (!data.name) { alert('اسم الموظف (nm) مطلوب');  nameField?.focus(); return; }
  if (!data.role) { alert('الدور مطلوب');             roleField?.focus(); return; }
  if (!data.status) { alert('الحالة مطلوبة');         stField?.focus();   return; }
  if (!data.expiryDate) { alert('تاريخ الصلاحية مطلوب'); expField?.focus(); return; }

const wasEdit = editingIndex > -1;

  try {
  await saveEmployeeToSheet(data);
  await loadEmployeesFromSheet();
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
    await loadEmployeesFromSheet();
    closeDeleteModalFunction();
    showSuccessMessage('تم الحذف بنجاح 🗑️');
    
  } catch (err) {
    console.error('[Delete]', err);
    alert('تعذّر الحذف. تحقّق من رابط الويب-آب والصلاحيات.');
  }
}

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


document.addEventListener('DOMContentLoaded', () => {

  byId('addEmployeeBtn')?.addEventListener('click', () => openEmployeeModal(-1));
  byId('employeeForm')?.addEventListener('submit', handleFormSubmit);

  byId('closeModal')?.addEventListener('click', closeEmployeeModal);
  byId('cancelBtn')?.addEventListener('click', closeEmployeeModal);

  byId('closeDeleteModal')?.addEventListener('click', closeDeleteModalFunction);
  byId('cancelDeleteBtn')?.addEventListener('click', closeDeleteModalFunction);
  byId('confirmDeleteBtn')?.addEventListener('click', confirmDelete);

  const expiryDateInput = byId('expiryDate');
  if (expiryDateInput && !expiryDateInput.value) {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expiryDateInput.value = nextYear.toISOString().split('T')[0];
  }


  if (!WEB_APP_URL || WEB_APP_URL.includes('PUT_YOUR_WEB_APP_URL_HERE')) {
    console.warn('⚠️ WEB_APP_URL غير مضبوط. ضع رابط الويب-آب الصحيح.');
  } else {

    loadEmployeesFromSheet().catch(err => {
      console.error('[Initial Load]', err);
      hideLoading();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEmployeeModal();
      closeDeleteModalFunction();
      hideLoading();
    }
  });
});