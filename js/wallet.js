
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbywXfqFC0fgZoBcjgBM2VUTnQSKZuY7CqdVeflqFvC9HoIpE8cNN0arAMY3deZaM_AL/exec"; // ضع رابط /exec

const ANIM_SPEED = 0.9;
const WALLET_HTML_URL = "wallet.html";

function ensureMountContainer() {
  let mount = document.getElementById('wallet-mount') || document.querySelector('.wallet-mount');
  if (mount) return mount;
  mount = document.createElement('div');
  mount.id = 'wallet-mount';
  document.body.appendChild(mount);
  return mount;
}
async function ensureWalletInjected() {
  if (document.getElementById("walletModal")) return;
  const mount = ensureMountContainer();
  const resp = await fetch(WALLET_HTML_URL, { cache: "no-cache" });
  if (!resp.ok) throw new Error("فشل تحميل wallet.html");
  const html = await resp.text();
  mount.insertAdjacentHTML("beforeend", html);
}

function safeSession() {
  try {
    const s = JSON.parse(localStorage.getItem("qb_session") || "{}");
    return (s && s.user_id) ? s : null;
  } catch { return null; }
}
function parseCompactData(compact) {
  const out = {};
  if (!compact || typeof compact !== "string") return out;
  compact.split("|").forEach(pair => {
    const idx = pair.indexOf("=");
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim().replace(/¦/g, "|");
      if (k) out[k] = v;
    }
  });
  return out;
}

const FIELD_ALIASES = {
  carPrice:       ['PRICE','PR','CB'],         
  bankPrice:      ['BP','PR','XB','CB'],
  monthlyPayment: ['MP','NP'],
};
function pickAlias(data, keys){
  for (const k of keys) if (data[k] !== undefined && data[k] !== '') return data[k];
  return '';
}
function summarizeForUI(data) {
  return {
    carPrice:       pickAlias(data, FIELD_ALIASES.carPrice),
    bankPrice:      pickAlias(data, FIELD_ALIASES.bankPrice),
    monthlyPayment: pickAlias(data, FIELD_ALIASES.monthlyPayment),
  };
}

const FILL_MAP = {
  PT:    'vatType',
  PRICE: 'carPrice',
  XB:    'extras',
  SVC:   'other1',
  CB:    'cashback',
  SUP:   'support',
  NP:    'other2',
  DPR:   'downPaymentRate',
  BLR:   'balloonRate',
  PR:    'profitRate',
  IR:    'insuranceRate',
  AR:    'adminRate',
  Y:     'years'
};

function normalizeNumberLike(val) {
  if (val == null) return '';
  const s = String(val).replace(/[^\d.]/g, '');
  if (!s) return '';
  const parts = s.split('.');
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('');
  return s;
}
function displayNumber(val){
  if (val == null || val === '') return '';
  const n = Number(val);
  return isFinite(n) ? n.toLocaleString('ar-EG') : String(val);
}

class WalletModalManager {
  constructor() {
    this.walletBtn = document.getElementById('walletBtn');
    this.walletModal = document.getElementById('walletModal');
    this.closeModalBtn = document.getElementById('closeWalletModal');
    this.refreshBtn = document.getElementById('refreshWalletBtn');
    this.loadingContainer = document.getElementById('walletLoadingBar');
    this.walletContent = document.getElementById('walletContent');
    this.operationsList = document.getElementById('savedOperationsList');
    this.emptyState = document.getElementById('emptyState');
    this.operationsCount = document.getElementById('operationsCount');
    this.progressFill = document.getElementById('walletProgressFill');
    this.progressText = document.getElementById('walletProgressText');

    this.deleteModal = document.getElementById('deleteModal');
    this.deleteOperationName = document.getElementById('deleteOperationName');
    this.cancelDeleteBtn = document.getElementById('cancelDelete');
    this.confirmDeleteBtn = document.getElementById('confirmDelete');

    this.operationsCache = [];
    this.currentDeleteId = null;
    this.isModalOpen = false;
    this.isLoading = false;

    this.init();
  }

  init() {
    this.walletBtn?.addEventListener('click', async () => {
      if (!this.walletModal) { await ensureWalletInjected(); this._rebindDOM(); }
      this.openModal();
    });
    this.closeModalBtn?.addEventListener('click', () => this.closeModal());
    this.refreshBtn?.addEventListener('click', () => this.refreshWalletContent());
    this.walletModal?.addEventListener('click', (e) => { if (e.target === this.walletModal) this.closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isModalOpen) this.closeModal();
        if (this.deleteModal?.classList.contains('active')) this.closeDeleteModal();
      }
    });
    this.cancelDeleteBtn?.addEventListener('click', () => this.closeDeleteModal());
    this.confirmDeleteBtn?.addEventListener('click', () => this.deleteOperation());
    this.deleteModal?.addEventListener('click', (e) => { if (e.target === this.deleteModal) this.closeDeleteModal(); });
  }

  _rebindDOM() {
    this.walletModal = document.getElementById('walletModal');
    this.closeModalBtn = document.getElementById('closeWalletModal');
    this.refreshBtn = document.getElementById('refreshWalletBtn');
    this.loadingContainer = document.getElementById('walletLoadingBar');
    this.walletContent = document.getElementById('walletContent');
    this.operationsList = document.getElementById('savedOperationsList');
    this.emptyState = document.getElementById('emptyState');
    this.operationsCount = document.getElementById('operationsCount');
    this.progressFill = document.getElementById('walletProgressFill');
    this.progressText = document.getElementById('walletProgressText');
    this.deleteModal = document.getElementById('deleteModal');
    this.deleteOperationName = document.getElementById('deleteOperationName');
    this.cancelDeleteBtn = document.getElementById('cancelDelete');
    this.confirmDeleteBtn = document.getElementById('confirmDelete');

    this.closeModalBtn?.addEventListener('click', () => this.closeModal());
    this.refreshBtn?.addEventListener('click', () => this.refreshWalletContent());
    this.walletModal?.addEventListener('click', (e) => { if (e.target === this.walletModal) this.closeModal(); });
    this.cancelDeleteBtn?.addEventListener('click', () => this.closeDeleteModal());
    this.confirmDeleteBtn?.addEventListener('click', () => this.deleteOperation());
  }

  openModal() {
    if (this.isLoading || !this.walletModal) return;
    this.walletModal.classList.add('show');
    this.walletBtn?.classList.add('active');
    this.isModalOpen = true;
    document.body.style.overflow = 'hidden';
    this.startLoading();
  }
  closeModal() {
    this.walletModal?.classList.remove('show');
    this.walletBtn?.classList.remove('active');
    this.isModalOpen = false;
    document.body.style.overflow = '';
    this.hideContent();
  }
  refreshWalletContent() { if (!this.isLoading) this.startLoading(); }
  startLoading() {
    this.isLoading = true;
    this.refreshBtn?.classList.add('loading');
    this.showLoading();
    this.simulateLoading();
  }
  showLoading() {
    this.loadingContainer?.classList.add('show');
    this.walletContent?.classList.remove('show');
    if (this.progressFill) this.progressFill.style.width = '0%';
    if (this.progressText) this.progressText.textContent = '0%';
  }
  hideLoading() {
    this.loadingContainer?.classList.remove('show');
    this.isLoading = false;
    this.refreshBtn?.classList.remove('loading');
  }
  showContent() { this.walletContent?.classList.add('show'); }
  hideContent() { this.walletContent?.classList.remove('show'); this.loadingContainer?.classList.remove('show'); }

  simulateLoading() {
    const base = [
      { p: 20, d: 220, t: 'جاري البحث عن العمليات...' },
      { p: 55, d: 260, t: 'جاري تحليل البيانات...' },
      { p: 78, d: 200, t: 'جاري تنظيم النتائج...' },
      { p: 100, d: 160, t: 'اكتمل التحميل!' }
    ];
    const steps = base.map(s => ({ progress: s.p, delay: Math.max(80, Math.round(s.d * ANIM_SPEED)), text: s.t }));
    let i = 0;
    const updateProgress = () => {
      if (i < steps.length) {
        const step = steps[i];
        if (this.progressFill) this.progressFill.style.width = step.progress + '%';
        if (this.progressText) this.progressText.textContent = step.progress + '%';
        const loadingText = this.loadingContainer?.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = step.text;
        i++;
        setTimeout(updateProgress, step.delay);
      } else {
        setTimeout(async () => {
          await this.loadWalletContent();
          this.hideLoading();
          this.showContent();
        }, Math.max(80, Math.round(250 * ANIM_SPEED)));
      }
    };
    updateProgress();
  }

  async loadWalletContent() {
    try {
      const session = safeSession();
      if (!session?.user_id) {
        this.operationsCache = [];
        this.renderFromCache();
        return;
      }
      const payload = { action: "get_operations", user_id: session.user_id };
      const res = await fetch(GAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const txt = await res.text();
      let json; try { json = JSON.parse(txt); } catch { json = { ok:false, error:"NON_JSON_RESPONSE", raw: txt }; }
      if (!json.ok || !Array.isArray(json.rows)) {
        console.warn("[Wallet] GAS response not ok:", json);
        this.operationsCache = [];
        this.renderFromCache();
        return;
      }
      this.operationsCache = json.rows.map(row => {
        const data = parseCompactData(row.data_compact || "");
        const summary = summarizeForUI(data);
        return {
          id: Number(row.id) || Date.parse(row.ts) || Date.now(),
          name: row.name || "عملية بدون اسم",
          date: (row.ts ? new Date(row.ts) : new Date()).toLocaleString('ar-SA'),
          data: {
            carPrice:       summary.carPrice,
            bankPrice:      summary.bankPrice,
            monthlyPayment: summary.monthlyPayment,
          },
          _raw: data
        };
      });
      this.renderFromCache();
    } catch (err) {
      console.error("[Wallet] fetch from GAS failed:", err);
      this.operationsCache = [];
      this.renderFromCache();
    }
  }

  renderFromCache() {
    const list = this.operationsCache || [];
    if (list.length === 0) {
      this.showEmptyState(); this.updateOperationsCount(0);
      if (this.operationsList) this.operationsList.innerHTML = "";
      return;
    }
    this.hideEmptyState();
    this.updateOperationsCount(list.length);
    if (!this.operationsList) return;
    const sorted = [...list].sort((a, b) => b.id - a.id);
    this.operationsList.innerHTML = sorted.map(op => this.createOperationHTML(op)).join('');
    this.attachOperationEvents();
  }

  showEmptyState() { if (this.operationsList) this.operationsList.innerHTML = ''; this.emptyState?.classList.add('show'); }
  hideEmptyState() { this.emptyState?.classList.remove('show'); }

  updateOperationsCount(count) {
    if (!this.operationsCount) return;
    if (count === 0) this.operationsCount.textContent = '';
    else if (count === 1) this.operationsCount.textContent = 'عملية واحدة محفوظة';
    else if (count === 2) this.operationsCount.textContent = 'عمليتان محفوظتان';
    else if (count >= 3 && count <= 10) this.operationsCount.textContent = `${count} عمليات محفوظة`;
    else this.operationsCount.textContent = `${count} عملية محفوظة`;
  }

  createOperationHTML(operation) {
    const d = operation.data || {};
    const bankPrice      = displayNumber(normalizeNumberLike(d.bankPrice));
    const monthlyPayment = displayNumber(normalizeNumberLike(d.monthlyPayment));
    const carPrice       = displayNumber(normalizeNumberLike(d.carPrice));

    return `
      <div class="saved-operation-item" data-id="${operation.id}">
        <div class="operation-info">
          <div class="operation-name">${this.escapeHTML(operation.name)}</div>
          <div class="operation-date">${operation.date}</div>
          <div class="operation-summary">
            <div class="summary-item"><div class="summary-label">سعر السيارة</div><div class="summary-value">${carPrice || '0'} ريال</div></div>
            <div class="summary-item"><div class="summary-label">هامش الربح</div><div class="summary-value">${bankPrice || '0'} %</div></div>
            <div class="summary-item"><div class="summary-label">صافي الربح</div><div class="summary-value">${monthlyPayment || '0'} ريال</div></div>
           
          </div>
        </div>
        <div class="operation-actions">
          <button class="action-btn action-btn-load" data-action="load" data-id="${operation.id}" title="تحميل العملية">📂</button>
          <button class="action-btn action-btn-delete" data-action="delete" data-id="${operation.id}" data-name="${this.escapeHTML(operation.name)}" title="حذف العملية">🗑️</button>
        </div>
      </div>
    `;
  }

  attachOperationEvents() {
    if (!this.operationsList) return;
    this.operationsList.querySelectorAll('.saved-operation-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.action-btn')) return;
        const id = parseInt(item.dataset.id);
        this.loadOperation(id);
      });
    });
    this.operationsList.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);
        const name = btn.dataset.name;
        btn.style.transform = 'scale(0.96)';
        setTimeout(() => { btn.style.transform = ''; }, Math.max(60, Math.round(120 * ANIM_SPEED)));
        if (action === 'load') this.loadOperation(id);
        else if (action === 'delete') this.showDeleteConfirmation(id, name);
      });
    });
  }

  fillFormFromOperation(operation) {
    const summary = operation.data || {};
    const raw = operation._raw || {};

    this._fillKeyToTargets({
      carPrice:       summary.carPrice,
      bankPrice:      summary.bankPrice,
      monthlyPayment: summary.monthlyPayment,
    });

    for (const [srcKey, targetField] of Object.entries(FILL_MAP)) {
      try {
        if (raw[srcKey] !== undefined) this._fillOne(targetField, raw[srcKey]);
      } catch (e) {
        console.warn('[Wallet] fill map fail:', srcKey, '->', targetField, e);
      }
    }

    for (const [k, v] of Object.entries(raw)) {
      try { this._fillOne(k, v); } catch (e) { /* تجاهل */ }
    }
  }

  _fillOne(targetKey, value) {
    try {
      if (value == null) return;
      const v = String(value).trim();

      if (targetKey === 'vatType' || targetKey === 'PT') {
        const sel = document.getElementById('priceType');
        if (sel) {
          const upper = v.toUpperCase();
          if (upper === 'NOVAT') sel.value = 'withTax';
          else if (upper === 'VAT') sel.value = 'withoutTax';
          sel.dispatchEvent(new Event('input',  { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }

      let el =
        document.getElementById(targetKey) ||
        document.querySelector(`[name="${targetKey}"]`) ||
        document.querySelector(`[data-field="${targetKey}"]`);
      if (!el) return;

      if ('value' in el) el.value = v;
      else el.textContent = v;

      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      console.warn('[Wallet] _fillOne skipped for', targetKey, '=>', err);
    }
  }

  loadOperation(id) {
    const idStr = String(id);
    const operation = (this.operationsCache || []).find(op => String(op.id) === idStr);
    if (!operation) {
      this.showNotification('العملية غير موجودة', 'error');
      return;
    }

    const item = this.operationsList?.querySelector(`[data-id="${id}"]`);
    if (item) item.classList.add('loading');

    setTimeout(() => { 
      try {

        window.dispatchEvent(new CustomEvent('wallet:load', { detail: {
          id: operation.id, name: operation.name, summary: operation.data, raw: operation._raw
        }}));

        this.fillFormFromOperation(operation);

        this.closeModal();
        this.showNotification(`تم تحميل عملية: ${operation.name}`, 'success');
      } catch (e) {
        console.error('[Wallet] loadOperation error:', e);
        this.showNotification('حدث خطأ أثناء الاسترجاع', 'error');
      } finally {
        if (item) item.classList.remove('loading');
      }
    }, Math.max(200, Math.round(600 * ANIM_SPEED)));
  }

  showDeleteConfirmation(id, name) {
    this.currentDeleteId = id;
    if (this.deleteOperationName) this.deleteOperationName.textContent = name || '';
    this.deleteModal?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  closeDeleteModal() {
    this.deleteModal?.classList.remove('active');
    this.currentDeleteId = null;
    document.body.style.overflow = this.isModalOpen ? 'hidden' : '';
  }
async deleteOperation() {
  if (!this.currentDeleteId) return;

  const rowId = this.currentDeleteId;
  const opIndex = this.operationsCache.findIndex(o => String(o.id) === String(rowId));
  const op = opIndex > -1 ? this.operationsCache[opIndex] : null;

  this.confirmDeleteBtn?.setAttribute('disabled', 'true');

  try {
    const session = safeSession();
    const payload = { action: "delete_operation", id: rowId, user_id: session?.user_id || "" };

    const res = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    let json;
    try { json = await res.json(); }
    
    catch { json = { ok: false, error: "NON_JSON_RESPONSE" }; }

    if (json.ok) {

      if (opIndex > -1) this.operationsCache.splice(opIndex, 1);
      await this.loadWalletContent();
      this.showNotification(`تم حذف ${op ? op.name : 'العملية'} من الشيت`, 'success');
    } else {
      this.showNotification(`تعذّر الحذف: ${json.error || 'خطأ غير معروف'}`, 'error');
    }
  } catch (e) {
    console.error('[Wallet] delete failed:', e);
    this.showNotification('فشل الاتصال بالخادم', 'error');
  } finally {

    this.closeDeleteModal();
    this.confirmDeleteBtn?.removeAttribute('disabled');
  }
}

  escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _fillKeyToTargets(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null || v === '') continue;
      try { this._fillOne(k, v); } catch (e) {
        console.warn('[Wallet] _fillKeyToTargets skip:', k, e);
      }
    }
  }

  showNotification(message, type = 'success') {
    try {
      const n = document.createElement('div');
      n.className = `wallet-notification wallet-notification-${type}`;
      n.innerHTML = `
        <div class="wallet-notification-content">
          <span class="wallet-notification-icon">${type === 'success' ? '✅' : '❌'}</span>
          <span class="wallet-notification-message">${message}</span>
        </div>
      `;
      document.body.appendChild(n);

      requestAnimationFrame(() => n.classList.add('show'));

      setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), Math.max(80, Math.round(260 * ANIM_SPEED)));
      }, Math.max(1800, Math.round(2800 * ANIM_SPEED)));
    } catch (e) {
      console.warn('[Wallet] notify fail:', e, message);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (document.getElementById('walletModal')) {
    window.walletModalManager = new WalletModalManager();
    return;
  }
  const walletBtn = document.getElementById('walletBtn');
  if (walletBtn && !window.walletModalManager) {
    walletBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await ensureWalletInjected();
      window.walletModalManager = new WalletModalManager();
      window.walletModalManager.openModal();
    }, { once: true });
  }
});
