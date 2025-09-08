// ملف JavaScript لصندوق الأدوات - toolbox-script.js

'use strict';

/**
 * صندوق الأدوات - نظام حاسبة التأمين
 * يقوم بحساب النسبة المئوية للتأمين وإدارة الواجهة المنبثقة
 */

// متغيرات عامة
window.toolboxData = window.toolboxData || {
  isOpen: false,
  mainSiteData: null,
  calculationResult: null,
  elements: {},
  observers: []
};


// بيانات افتراضية من الموقع الأساسي (يتم استبدالها بالبيانات الحقيقية)
const DEFAULT_MAIN_SITE_DATA = {
    liftPrice: 0,        // سعر الرفع من الموقع الأساسي
    years: 5,            // عدد السنوات من الموقع الأساسي
    vatRate: 1.15        // ضريبة القيمة المضافة 15%
};

/**
 * تهيئة صندوق الأدوات مع تأخير للتأكد من تحميل العناصر
 */
function delayedInitialize() {
    // انتظار حتى تصبح العناصر متاحة
    if (document.getElementById('toolboxOverlay')) {
        initializeToolbox();
        setupEventListeners();
        loadMainSiteData();
        watchMainSiteChanges();
        startPeriodicUpdate();
        console.log('تم تحميل وتهيئة صندوق الأدوات بنجاح');
    } else {
        // إعادة المحاولة بعد 100ms
        setTimeout(delayedInitialize, 100);
    }
}

/**
 * تهيئة صندوق الأدوات عند تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', function() {
    // تأخير التهيئة للسماح بتحميل العناصر الديناميكية
    setTimeout(delayedInitialize, 500);
});

/**
 * تهيئة العناصر والمتغيرات
 */
function initializeToolbox() {
    try {
        // حفظ مراجع العناصر
        toolboxData.elements = {
            overlay: document.getElementById('toolboxOverlay'),
            container: document.querySelector('.toolbox-container'),
            closeBtn: document.getElementById('closeToolboxBtn'),
            walletSection: document.getElementById('walletSection'),
            calculatorForm: document.getElementById('calculatorForm'),
            liftPrice: document.getElementById('liftPrice'),
            insuranceAmount: document.getElementById('insuranceAmount'),
            percentageValue: document.getElementById('percentageValue'),
            statusMessage: document.getElementById('statusMessage'),
            statusIcon: document.getElementById('statusIcon'),
            statusText: document.getElementById('statusText'),
            calculationDetails: document.getElementById('calculationDetails'),
            calculationInfo: document.getElementById('calculationInfo'),
            yearsInFormula: document.getElementById('yearsInFormula'),
            yearsDisplay: document.getElementById('yearsDisplay'),
            yearlyPayment: document.getElementById('yearlyPayment'),
            withVAT: document.getElementById('withVAT'),
            resetBtn: document.getElementById('resetBtn'),
            saveBtn: document.getElementById('saveBtn')
        };

        // التحقق من وجود العناصر المطلوبة
        const isValid = validateElements();
        if (!isValid) {
            console.warn('بعض العناصر المطلوبة غير موجودة');
        }
    } catch (error) {
        console.error('خطأ في تهيئة صندوق الأدوات:', error);
    }
}

/**
 * التحقق من وجود العناصر المطلوبة
 */
function validateElements() {
    const requiredElements = [
        'overlay', 'closeBtn', 'liftPrice', 
        'insuranceAmount', 'percentageValue', 'resetBtn', 'saveBtn'
    ];

    let allValid = true;
    for (const elementKey of requiredElements) {
        if (!toolboxData.elements[elementKey]) {
            console.warn(`العنصر المطلوب غير موجود: ${elementKey}`);
            allValid = false;
        }
    }
    return allValid;
}

/**
 * إعداد مستمعي الأحداث
 */
function setupEventListeners() {
    const { elements } = toolboxData;

    try {
        // إغلاق صندوق الأدوات
        elements.closeBtn?.addEventListener('click', closeToolbox);
        
        // إغلاق عند النقر خارج النافذة
        elements.overlay?.addEventListener('click', function(e) {
            if (e.target === elements.overlay) {
                closeToolbox();
            }
        });

        // فتح المحفظة — استدعاء تعريف wallet.js نفسه مع تحميل كسول عند الحاجة
        elements.walletSection?.addEventListener('click', openWalletFromToolbox);
        elements.walletSection?.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
               openWalletFromToolbox();
            }
       });

        // حقل مبلغ التأمين
        elements.insuranceAmount?.addEventListener('input', handleInsuranceAmountChange);
        elements.insuranceAmount?.addEventListener('blur', validateInsuranceAmount);

        // نموذج الحاسبة
        elements.calculatorForm?.addEventListener('submit', handleFormSubmit);

        // أزرار الإجراءات
        elements.resetBtn?.addEventListener('click', resetCalculator);
        elements.saveBtn?.addEventListener('click', saveCalculation);

        // دعم لوحة المفاتيح
        document.addEventListener('keydown', handleKeyboardEvents);

        // تحديث البيانات عند تغيير النافذة
        window.addEventListener('focus', loadMainSiteData);

        console.log('تم إعداد مستمعي الأحداث بنجاح');
    } catch (error) {
        console.error('خطأ في إعداد مستمعي الأحداث:', error);
    }
}

/**
 * مراقبة التغييرات في الموقع الأساسي
 */
function watchMainSiteChanges() {
    try {
        // مراقبة تغييرات سعر الرفع
        const bankPriceElement = document.getElementById('bankPrice');
        if (bankPriceElement) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        if (toolboxData.isOpen) {
                            setTimeout(loadMainSiteData, 100);
                        }
                    }
                });
            });
            
            observer.observe(bankPriceElement, {
                childList: true,
                characterData: true,
                subtree: true
            });

            toolboxData.observers.push(observer);
        }
        
        // مراقبة جميع حقول الإدخال التي تؤثر على الحساب
        const fieldsToWatch = [
            'priceType', 'carPrice', 'extras', 'other1', 'other2', 
            'cashback', 'support', 'downPaymentRate', 'balloonRate', 
            'profitRate', 'insuranceRate', 'adminRate', 'years'
        ];
        
        fieldsToWatch.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.addEventListener('input', function() {
                    if (toolboxData.isOpen) {
                        // تأخير أكبر للسماح بإكمال الحسابات في الموقع الأساسي
                        setTimeout(loadMainSiteData, 500);
                    }
                });
                element.addEventListener('change', function() {
                    if (toolboxData.isOpen) {
                        setTimeout(loadMainSiteData, 500);
                    }
                });
            }
        });

        console.log('تم إعداد مراقبة التغييرات في الموقع الأساسي');
    } catch (error) {
        console.error('خطأ في إعداد مراقبة التغييرات:', error);
    }
}

/**
 * تحديث دوري للبيانات
 */
function startPeriodicUpdate() {
    setInterval(() => {
        if (toolboxData.isOpen) {
            loadMainSiteData();
        }
    }, 3000); // تحديث كل 3 ثوان
}

/**
 * معالجة أحداث لوحة المفاتيح
 */
function handleKeyboardEvents(e) {
    if (!toolboxData.isOpen) return;

    switch(e.key) {
        case 'Escape':
            closeToolbox();
            break;
        case 'F5':
            e.preventDefault();
            loadMainSiteData();
            break;
    }
}

/**
 * فتح صندوق الأدوات
 */
function openToolbox() {
    try {
        if (toolboxData.isOpen) return;

        toolboxData.isOpen = true;
        
        // تحديث البيانات من الموقع الأساسي
        loadMainSiteData();
        
        // إظهار الواجهة
        toolboxData.elements.overlay?.classList.add('active');
        
        // تركيز على أول حقل إدخال
        setTimeout(() => {
            toolboxData.elements.insuranceAmount?.focus();
        }, 300);

        // منع التمرير في الخلفية
        document.body.style.overflow = 'hidden';
        
        console.log('تم فتح صندوق الأدوات');
    } catch (error) {
        console.error('خطأ في فتح صندوق الأدوات:', error);
    }
}

/**
 * إغلاق صندوق الأدوات
 */
function closeToolbox(opts = {}) {
  try {
    if (!toolboxData.isOpen) return;

    const preserveScrollLock = !!opts.preserveScrollLock;
    toolboxData.isOpen = false;

    // إخفاء الواجهة
    toolboxData.elements.overlay?.classList.remove('active');

    // إدارة التمرير: لا تُمكّن التمرير إذا كان مودال المحفظة مفتوح
    const walletOpen = document.getElementById('walletModal')?.classList.contains('show');
    if (!preserveScrollLock && !walletOpen) {
      document.body.style.overflow = '';
    }

    // إخفاء رسائل الحالة
    hideStatusMessage?.();

    console.log('تم إغلاق صندوق الأدوات');
  } catch (error) {
    console.error('خطأ في إغلاق صندوق الأدوات:', error);
  }
}


/**
 * تحميل البيانات من الموقع الأساسي
 */
function loadMainSiteData() {
    try {
        // محاولة الحصول على البيانات من الموقع الأساسي
        const mainSiteData = getMainSiteData();
        
        if (mainSiteData && mainSiteData.liftPrice > 0) {
            toolboxData.mainSiteData = mainSiteData;
            updateLiftPriceDisplay(mainSiteData.liftPrice);
            updateYearsDisplay(mainSiteData.years);
            
            // إعادة حساب النسبة إذا كان هناك مبلغ تأمين مدخل
            if (toolboxData.elements.insuranceAmount?.value) {
                calculatePercentage();
            }
            
            console.log('تم تحديث البيانات من الموقع الأساسي:', mainSiteData);
        } else {
            // استخدام البيانات الافتراضية
            toolboxData.mainSiteData = { ...DEFAULT_MAIN_SITE_DATA };
            if (toolboxData.isOpen) {
                showStatusMessage('warning', '⚠️', 'لم يتم العثور على بيانات من الموقع الأساسي. قم بإدخال البيانات في الموقع الأساسي أولاً.');
            }
        }
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
        toolboxData.mainSiteData = { ...DEFAULT_MAIN_SITE_DATA };
        if (toolboxData.isOpen) {
            showStatusMessage('error', '❌', 'خطأ في تحميل البيانات من الموقع الأساسي');
        }
    }
}

/**
 * الحصول على البيانات من الموقع الأساسي (نسخة معدلة تدعم dataset.raw)
 */
function getMainSiteData() {
    try {
        const bankPriceElement = document.getElementById('bankPrice');
        const yearsElement = document.getElementById('years');

        let liftPrice = 0;

        if (bankPriceElement) {
            // الأولوية للقراءة من data-raw إذا متوفرة
            const raw = bankPriceElement.dataset?.raw;
            if (raw) {
                liftPrice = parseFloat(raw) || 0;
            } else if (bankPriceElement.textContent) {
                // fallback: لو ما في dataset.raw، نقرأ النص وننظفه
                const priceText = bankPriceElement.textContent.trim();
                const cleanPrice = priceText.replace(/[^\d.-]/g, '');
                liftPrice = parseFloat(cleanPrice) || 0;
            }
        }

        // الحصول على عدد السنوات
        const years = yearsElement && yearsElement.value
            ? parseInt(yearsElement.value) || 5
            : 5;

        return {
            liftPrice: liftPrice,
            years: years,
            vatRate: 0.15
        };
    } catch (error) {
        console.error('خطأ في قراءة البيانات من الموقع الأساسي:', error);
        return null;
    }
}

/**
 * تحديث عرض سعر الرفع
 */
function updateLiftPriceDisplay(price) {
    if (toolboxData.elements.liftPrice) {
        toolboxData.elements.liftPrice.value = formatCurrency(price) + ' ريال سعودي';
    }
}

/**
 * تحديث عرض عدد السنوات
 */
function updateYearsDisplay(years) {
    if (toolboxData.elements.yearsInFormula) {
        toolboxData.elements.yearsInFormula.textContent = years;
    }
    if (toolboxData.elements.yearsDisplay) {
        toolboxData.elements.yearsDisplay.textContent = `${years} سنوات`;
    }
}

/**
 * معالجة تغيير مبلغ التأمين
 */
function handleInsuranceAmountChange(e) {
    const value = e.target.value;
    
    // تنظيف القيمة
    if (value && isNaN(parseFloat(value))) {
        e.target.value = '';
        return;
    }
    
    // حساب النسبة
    calculatePercentage();
    
    // إخفاء رسائل الخطأ
    hideStatusMessage();
}

/**
 * التحقق من صحة مبلغ التأمين
 */
function validateInsuranceAmount() {
    const amount = parseFloat(toolboxData.elements.insuranceAmount?.value || 0);
    
    if (amount < 0) {
        showStatusMessage('error', '❌', 'مبلغ التأمين لا يمكن أن يكون سالباً');
        return false;
    }
    
    if (amount > 10000000) {
        showStatusMessage('warning', '⚠️', 'مبلغ التأمين كبير جداً. تأكد من صحة المبلغ');
    }
    
    return true;
}

/**
 * حساب النسبة المئوية للتأمين
 */
function calculatePercentage() {
    try {
        const insuranceAmount = parseFloat(toolboxData.elements.insuranceAmount?.value || 0);
        
        if (!toolboxData.mainSiteData || !insuranceAmount || insuranceAmount <= 0) {
            resetCalculationDisplay();
            return;
        }
        
        const { liftPrice, years, vatRate } = toolboxData.mainSiteData;
        
if (!years || years <= 0) {
  showStatusMessage('error', '❌', 'عدد السنوات غير صحيح');
  resetCalculationDisplay();
  return;
}
        
// 1) قسمة مبلغ التأمين على عدد السنوات (K66/K68)
const yearlyInsurance = insuranceAmount / years;

// 2) معامل التأمين 1.15 (K66/K68 * 1.15)
const INSURANCE_FACTOR = 1.15; // اجعلها ثابتة هنا أو انقلها لإعدادات عامة إذا حبيت
const adjustedWithVAT = yearlyInsurance * INSURANCE_FACTOR; // هذا يطابق K67 في إكسل

// 3) إزالة ضريبة القيمة المضافة بقسمة 1.15 (K67/1.15)
const exVAT = adjustedWithVAT / (1 + vatRate);

// 4) تحويلها لنسبة من سعر الرفع (K69 = (…)/K65) ثم ×100 للعرض
const percentage = (exVAT / liftPrice) * 100;

// حفظ نتيجة الحساب (حافظنا على اسم withVAT لأنه مستخدم في الواجهة)
toolboxData.calculationResult = {
  insuranceAmount,
  yearlyInsurance,
  withVAT: adjustedWithVAT, // يساوي K67 قبل خصم الضريبة (متوافق مع عرض الحقل الحالي)
  percentage,
  liftPrice,
  years,
  vatRate
};

// عرض النتائج وتفعيل الحفظ
displayCalculationResults(toolboxData.calculationResult);
enableSaveButton();
        
    } catch (error) {
        console.error('خطأ في حساب النسبة:', error);
        showStatusMessage('error', '❌', 'خطأ في حساب النسبة المئوية');
        resetCalculationDisplay();
    }
}

/**
 * عرض نتائج الحساب
 */
function displayCalculationResults(result) {
    try {
        // عرض النسبة المئوية
        if (toolboxData.elements.percentageValue) {
            toolboxData.elements.percentageValue.textContent = result.percentage.toFixed(2);
        }
        
        // عرض تفاصيل الحساب
        if (toolboxData.elements.calculationDetails) {
            toolboxData.elements.calculationDetails.style.display = 'block';
        }
        
        // عرض المعلومات الإضافية
        if (toolboxData.elements.calculationInfo) {
            toolboxData.elements.calculationInfo.style.display = 'block';
        }
        
        if (toolboxData.elements.yearlyPayment) {
            toolboxData.elements.yearlyPayment.textContent = formatCurrency(result.yearlyInsurance) + ' ريال';
        }
        
        if (toolboxData.elements.withVAT) {
            toolboxData.elements.withVAT.textContent = formatCurrency(result.withVAT) + ' ريال';
        }
    } catch (error) {
        console.error('خطأ في عرض النتائج:', error);
    }
}

/**
 * إعادة تعيين عرض النتائج
 */
function resetCalculationDisplay() {
    try {
        if (toolboxData.elements.percentageValue) {
            toolboxData.elements.percentageValue.textContent = '0';
        }
        
        if (toolboxData.elements.calculationDetails) {
            toolboxData.elements.calculationDetails.style.display = 'none';
        }
        
        if (toolboxData.elements.calculationInfo) {
            toolboxData.elements.calculationInfo.style.display = 'none';
        }
        
        disableSaveButton();
        toolboxData.calculationResult = null;
    } catch (error) {
        console.error('خطأ في إعادة تعيين العرض:', error);
    }
}

/**
 * معالجة إرسال النموذج
 */
function handleFormSubmit(e) {
    e.preventDefault();
    
    if (validateInsuranceAmount()) {
        calculatePercentage();
    }
}

/**
 * حفظ النسبة المحسوبة
 */
function saveCalculation() {
    try {
        if (!toolboxData.calculationResult) {
            showStatusMessage('error', '❌', 'لا توجد نتيجة للحفظ. قم بإدخال مبلغ التأمين أولاً');
            return;
        }
        
        const { percentage } = toolboxData.calculationResult;
        
        // إظهار حالة التحميل
        showLoadingState();
        
        // محاكاة حفظ البيانات
        setTimeout(() => {
            // نقل النسبة للموقع الأساسي
            const success = transferDataToMainSite(percentage);
            
            if (success) {
                showStatusMessage('success', '✅', `تم حفظ نسبة التأمين ${percentage.toFixed(2)}% بنجاح!`);
                
                // تحديث حالة الزر
                setSaveButtonSuccess();
                
                // إغلاق النافذة بعد فترة
                setTimeout(() => {
                    closeToolbox();
                }, 2000);
                
            } else {
                showStatusMessage('error', '❌', 'فشل في حفظ البيانات. حاول مرة أخرى');
                hideLoadingState();
            }
        }, 1000);
        
    } catch (error) {
        console.error('خطأ في حفظ البيانات:', error);
        showStatusMessage('error', '❌', 'حدث خطأ أثناء الحفظ');
        hideLoadingState();
    }
}

/**
 * نقل البيانات للموقع الأساسي
 */
function transferDataToMainSite(percentage) {
    try {
        // البحث عن حقل نسبة التأمين في الموقع الأساسي
        const insuranceRateField = document.getElementById('insuranceRate');
        
        if (insuranceRateField) {
            insuranceRateField.value = percentage.toFixed(2);
            
            // إثارة حدث التغيير لتحديث الحسابات
            const changeEvent = new Event('input', { bubbles: true });
            insuranceRateField.dispatchEvent(changeEvent);
            
            // محاولة إثارة حدث change أيضاً
            const changeEvent2 = new Event('change', { bubbles: true });
            insuranceRateField.dispatchEvent(changeEvent2);
            
            console.log(`تم نقل نسبة التأمين ${percentage.toFixed(2)}% للموقع الأساسي`);
            return true;
        } else {
            console.warn('لم يتم العثور على حقل نسبة التأمين في الموقع الأساسي');
            return false;
        }
    } catch (error) {
        console.error('خطأ في نقل البيانات:', error);
        return false;
    }
}

/**
 * إعادة تعيين الحاسبة
 */
function resetCalculator() {
    try {
        // تنظيف الحقول
        if (toolboxData.elements.insuranceAmount) {
            toolboxData.elements.insuranceAmount.value = '';
        }
        
        // إعادة تعيين العرض
        resetCalculationDisplay();
        
        // إخفاء الرسائل
        hideStatusMessage();
        
        // إعادة تعيين الزر
        resetSaveButton();
        
        // تركيز على حقل الإدخال
        toolboxData.elements.insuranceAmount?.focus();
        
        console.log('تم إعادة تعيين الحاسبة');
    } catch (error) {
        console.error('خطأ في إعادة تعيين الحاسبة:', error);
    }
}

/**
 * فتح المحفظة — يستدعي نفس تعريف wallet.js مع تحميل كسول عند الحاجة
 */
async function openWalletFromToolbox() {
  try {
    // 1) حمّل wallet.js عند الحاجة (مرة واحدة)
    if (typeof ensureWalletInjected !== 'function') {
      await loadScriptOnce('js/wallet.js', 'qb-wallet-js');
      await waitFor(() => typeof ensureWalletInjected === 'function', 4000);
    }

    // 2) ضَمّن هيكل المحفظة (wallet.html) إذا لم يكن موجودًا
    await ensureWalletInjected(); // wallet.js يوفّر الدالة وتحقن wallet.html عند الحاجة

    // 3) أنشئ/أعد ربط مدير المحفظة ثم افتحها
    if (!window.walletModalManager) {
      // ملاحظة: WalletModalManager معرّفة داخل wallet.js
      window.walletModalManager = new WalletModalManager();
    } else if (!window.walletModalManager.walletModal) {
      // في حال تم حقن DOM بعد الإنشاء الأول
      window.walletModalManager._rebindDOM?.();
    }

    window.walletModalManager.openModal();
    window.walletModalManager.refreshWalletContent?.();

// ✅ [جديد] انتظر تأكّد ظهور مودال المحفظة ثم أغلق صندوق الأدوات
await waitFor(() => {
  const m = document.getElementById('walletModal');
  return (m && m.classList.contains('show')) || window.walletModalManager?.isModalOpen;
}, 1200);

// أغلق صندوق الأدوات مع إبقاء قفل التمرير (لأن المودال مفتوح)
closeToolbox({ preserveScrollLock: true });


    // (اختياري) توحيد اسم الاستدعاء مع الصفحات الأخرى
    if (typeof window.openWallet !== 'function') {
      window.openWallet = openWalletFromToolbox;
    }
  } catch (err) {
    console.error('فتح المحفظة من صندوق الأدوات فشل:', err);
    alert('تعذّر فتح المحفظة. تأكد من وجود wallet.html و js/wallet.js');
  }
}

// تحميل سكربت مرة واحدة فقط
function loadScriptOnce(src, id) {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) return resolve();
    const exists = Array.from(document.scripts).some(s => (s.src || '').includes(src));
    if (exists) return resolve();

    const s = document.createElement('script');
    if (id) s.id = id;
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('فشل تحميل ' + src));
    document.head.appendChild(s);
  });
}

// الانتظار حتى يتوفر شرط معيّن
function waitFor(predicate, timeout = 3000, interval = 50) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      if (predicate()) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(t);
        reject(new Error('انتهت المهلة'));
      }
    }, interval);
  });
}


/**
 * إظهار رسالة الحالة
 */
function showStatusMessage(type, icon, message) {
    try {
        const { statusMessage, statusIcon, statusText } = toolboxData.elements;
        
        if (!statusMessage || !statusIcon || !statusText) return;
        
        statusMessage.className = `status-message ${type} show`;
        statusIcon.textContent = icon;
        statusText.textContent = message;
        
        // إخفاء الرسالة تلقائياً بعد 5 ثواني للرسائل العادية
        if (type !== 'success') {
            setTimeout(() => {
                hideStatusMessage();
            }, 5000);
        }
    } catch (error) {
        console.error('خطأ في إظهار رسالة الحالة:', error);
    }
}

/**
 * إخفاء رسالة الحالة
 */
function hideStatusMessage() {
    try {
        const { statusMessage } = toolboxData.elements;
        if (statusMessage) {
            statusMessage.classList.remove('show');
        }
    } catch (error) {
        console.error('خطأ في إخفاء رسالة الحالة:', error);
    }
}

/**
 * تفعيل زر الحفظ
 */
function enableSaveButton() {
    if (toolboxData.elements.saveBtn) {
        toolboxData.elements.saveBtn.disabled = false;
        toolboxData.elements.saveBtn.classList.remove('loading');
    }
}

/**
 * تعطيل زر الحفظ
 */
function disableSaveButton() {
    if (toolboxData.elements.saveBtn) {
        toolboxData.elements.saveBtn.disabled = true;
        toolboxData.elements.saveBtn.classList.remove('loading');
    }
}

/**
 * إظهار حالة التحميل
 */
function showLoadingState() {
    if (toolboxData.elements.saveBtn) {
        toolboxData.elements.saveBtn.classList.add('loading');
        toolboxData.elements.saveBtn.disabled = true;
    }
}

/**
 * إخفاء حالة التحميل
 */
function hideLoadingState() {
    if (toolboxData.elements.saveBtn) {
        toolboxData.elements.saveBtn.classList.remove('loading');
        toolboxData.elements.saveBtn.disabled = false;
    }
}

/**
 * تحديث زر الحفظ لحالة النجاح
 */
function setSaveButtonSuccess() {
    if (toolboxData.elements.saveBtn) {
        const saveBtn = toolboxData.elements.saveBtn;
        saveBtn.classList.remove('loading');
        saveBtn.disabled = true;
        
        const iconSpan = saveBtn.querySelector('.btn-icon');
        const textSpan = saveBtn.querySelector('.btn-text');
        
        if (iconSpan) iconSpan.textContent = '✅';
        if (textSpan) textSpan.textContent = 'تم الحفظ';
    }
}

/**
 * إعادة تعيين زر الحفظ
 */
function resetSaveButton() {
    if (toolboxData.elements.saveBtn) {
        const saveBtn = toolboxData.elements.saveBtn;
        saveBtn.classList.remove('loading');
        saveBtn.disabled = true;
        
        const iconSpan = saveBtn.querySelector('.btn-icon');
        const textSpan = saveBtn.querySelector('.btn-text');
        
        if (iconSpan) iconSpan.textContent = '💾';
        if (textSpan) textSpan.textContent = 'حفظ النسبة';
    }
}

/**
 * تنسيق العملة
 */
function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '0';
    }
    
    return new Intl.NumberFormat('ar-SA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * تنظيف الموارد عند إغلاق الصفحة
 */
window.addEventListener('beforeunload', function() {
    // إيقاف جميع المراقبين
    toolboxData.observers.forEach(observer => {
        observer.disconnect();
    });
    toolboxData.observers = [];
});

/**
 * دوال عامة للاستخدام من الموقع الأساسي
 */

// تصدير الدوال للاستخدام العام
window.toolboxAPI = {
    open: openToolbox,
    close: closeToolbox,
    isOpen: () => toolboxData.isOpen,
    refreshData: loadMainSiteData,
    reset: resetCalculator,
    getData: () => toolboxData.mainSiteData,
    getResult: () => toolboxData.calculationResult
};

// للتوافق مع الإصدارات السابقة
window.openToolbox = openToolbox;
window.closeToolbox = closeToolbox;

/**
 * إعادة تهيئة صندوق الأدوات (للاستخدام الخارجي)
 */
window.reinitializeToolbox = function() {
    try {
        // إعادة تهيئة العناصر
        initializeToolbox();
        
        // إعادة إعداد مستمعي الأحداث
        setupEventListeners();
        
        // تحديث البيانات
        loadMainSiteData();
        
        console.log('تم إعادة تهيئة صندوق الأدوات بنجاح');
        return true;
    } catch (error) {
        console.error('خطأ في إعادة تهيئة صندوق الأدوات:', error);
        return false;
    }
};

/**
 * تحديث البيانات من الخارج
 */
window.updateToolboxData = function(data) {
    try {
        if (data && typeof data === 'object') {
            toolboxData.mainSiteData = { ...toolboxData.mainSiteData, ...data };
            
            if (data.liftPrice) {
                updateLiftPriceDisplay(data.liftPrice);
            }
            
            if (data.years) {
                updateYearsDisplay(data.years);
            }
            
            // إعادة حساب النسبة إذا كان هناك مبلغ تأمين
            if (toolboxData.elements.insuranceAmount?.value) {
                calculatePercentage();
            }
            
            console.log('تم تحديث بيانات صندوق الأدوات:', data);
            return true;
        }
        return false;
    } catch (error) {
        console.error('خطأ في تحديث البيانات:', error);
        return false;
    }
};

// رسالة تأكيد التحميل
console.log('تم تحميل صندوق الأدوات بنجاح - جميع الوظائف متاحة');

// زر تحديث سعر الرفع
const refreshPriceBtn = document.getElementById('refreshPriceBtn');
if (refreshPriceBtn) {
    refreshPriceBtn.addEventListener('click', function() {
        loadMainSiteData();
        showStatusMessage('success', '✅', 'تم تحديث البيانات');
    });
}

// إضافة هذا الكود في نهاية ملف toolbox-script.js

/**
 * تهيئة حاسبة الاستقطاع عند تحميل صندوق الأدوات
 */
function initializeDeductionCalculator() {
    try {
        // التحقق من وجود عناصر حاسبة الاستقطاع
        const deductionHeader = document.getElementById('deductionHeader');
        const deductionContent = document.getElementById('deductionContent');
        
        if (!deductionHeader || !deductionContent) {
            console.warn('عناصر حاسبة الاستقطاع غير موجودة');
            return;
        }

        // تهيئة وظيفة الطي والتوسيع
        setupDeductionCollapsible();
        
        // تهيئة حسابات الاستقطاع
        setupDeductionCalculations();
        
        console.log('تم تهيئة حاسبة الاستقطاع بنجاح');
    } catch (error) {
        console.error('خطأ في تهيئة حاسبة الاستقطاع:', error);
    }
}

/**
 * إعداد وظيفة الطي والتوسيع لحاسبة الاستقطاع
 */
function setupDeductionCollapsible() {
    const deductionHeader = document.getElementById('deductionHeader');
    const deductionContent = document.getElementById('deductionContent');
    
    if (!deductionHeader || !deductionContent) return;

    // إضافة مستمع النقر
    deductionHeader.addEventListener('click', function() {
        toggleDeductionSection();
    });

    // إضافة مستمع لوحة المفاتيح
    deductionHeader.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDeductionSection();
        }
    });

    // تأثيرات التمرير
    deductionHeader.addEventListener('mouseenter', function() {
        if (!this.matches(':focus')) {
            this.style.transform = 'translateY(-1px)';
        }
    });

    deductionHeader.addEventListener('mouseleave', function() {
        if (!this.matches(':focus')) {
            this.style.transform = 'translateY(0)';
        }
    });
}

/**
 * تبديل حالة قسم حاسبة الاستقطاع
 */
function toggleDeductionSection() {
    const deductionHeader = document.getElementById('deductionHeader');
    const deductionContent = document.getElementById('deductionContent');
    
    if (!deductionHeader || !deductionContent) return;

    const isExpanded = deductionHeader.getAttribute('aria-expanded') === 'true';
    
    if (isExpanded) {
        closeDeductionSection();
    } else {
        openDeductionSection();
    }
}

/**
 * فتح قسم حاسبة الاستقطاع
 */
function openDeductionSection() {
    const deductionHeader = document.getElementById('deductionHeader');
    const deductionContent = document.getElementById('deductionContent');
    const monthlySalaryInput = document.getElementById('monthlySalary');
    
    if (!deductionHeader || !deductionContent) return;

    deductionHeader.setAttribute('aria-expanded', 'true');
    deductionContent.setAttribute('aria-hidden', 'false');
    deductionContent.classList.add('expanded');
    
    // تركيز على أول حقل إدخال
    setTimeout(() => {
        if (monthlySalaryInput) {
            monthlySalaryInput.focus();
        }
    }, 300);

    // حفظ حالة القسم
    try {
        localStorage.setItem('deduction_calculator_expanded', 'true');
    } catch (e) {
        console.warn('لا يمكن حفظ حالة القسم:', e);
    }
}

/**
 * إغلاق قسم حاسبة الاستقطاع
 */
function closeDeductionSection() {
    const deductionHeader = document.getElementById('deductionHeader');
    const deductionContent = document.getElementById('deductionContent');
    
    if (!deductionHeader || !deductionContent) return;

    deductionHeader.setAttribute('aria-expanded', 'false');
    deductionContent.setAttribute('aria-hidden', 'true');
    deductionContent.classList.remove('expanded');

    // حفظ حالة القسم
    try {
        localStorage.setItem('deduction_calculator_expanded', 'false');
    } catch (e) {
        console.warn('لا يمكن حفظ حالة القسم:', e);
    }
}

/**
 * إعداد حسابات الاستقطاع
 */
function setupDeductionCalculations() {
    const monthlySalaryInput = document.getElementById('monthlySalary');
    const deductionRateSelect = document.getElementById('deductionRate');
    const commitmentAmountInput = document.getElementById('commitmentAmount');
    const deductionForm = document.getElementById('deductionForm');
    const deductionResetBtn = document.getElementById('deductionResetBtn');
    const deductionSaveBtn = document.getElementById('deductionSaveBtn');

    if (!deductionForm) return;

    // متغيرات حاسبة الاستقطاع
    let currentFinancingAmount = 0;

    // مستمعي الأحداث للحقول
    if (monthlySalaryInput) {
        monthlySalaryInput.addEventListener('input', calculateDeduction);
        monthlySalaryInput.addEventListener('keypress', validateNumericInput);
    }

    if (deductionRateSelect) {
        deductionRateSelect.addEventListener('change', calculateDeduction);
    }

    if (commitmentAmountInput) {
        commitmentAmountInput.addEventListener('input', calculateDeduction);
        commitmentAmountInput.addEventListener('keypress', validateNumericInput);
    }

    // مستمعي النموذج والأزرار
    deductionForm.addEventListener('submit', function(e) {
        e.preventDefault();
        saveDeductionResult();
    });

    if (deductionResetBtn) {
        deductionResetBtn.addEventListener('click', resetDeductionForm);
    }

    if (deductionSaveBtn) {
        deductionSaveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            saveDeductionResult();
        });
    }

    /**
     * حساب الحد الأدنى للتمويل
     */
    function calculateDeduction() {
        const monthlySalary = parseFloat(monthlySalaryInput?.value) || 0;
        const deductionRate = parseFloat(deductionRateSelect?.value) || 0;
        const commitmentAmount = parseFloat(commitmentAmountInput?.value) || 0;

        if (monthlySalary > 0 && deductionRate > 0) {
            // الراتب الشهري × نسبة الاستقطاع / 100 - مبلغ الالتزام
            const deductionAmount = (monthlySalary * deductionRate) / 100;
            const minimumFinancing = Math.max(0, deductionAmount - commitmentAmount);
            
            currentFinancingAmount = minimumFinancing;
            updateDeductionDisplay(minimumFinancing);
            
            // تفعيل زر الحفظ
            if (deductionSaveBtn) {
                deductionSaveBtn.disabled = false;
            }
        } else {
            currentFinancingAmount = 0;
            updateDeductionDisplay(0);
            
            // تعطيل زر الحفظ
            if (deductionSaveBtn) {
                deductionSaveBtn.disabled = true;
            }
        }
    }

    /**
     * تحديث عرض النتيجة
     */
    function updateDeductionDisplay(amount) {
        const financingValueElement = document.getElementById('financingValue');
        if (!financingValueElement) return;

        const formattedAmount = formatCurrency(amount);
        financingValueElement.textContent = formattedAmount;
        
        // تأثير بصري
        financingValueElement.style.transform = 'scale(1.1)';
        financingValueElement.style.color = amount > 0 ? 'var(--text-accent)' : 'var(--text-tertiary)';
        
        setTimeout(() => {
            financingValueElement.style.transform = 'scale(1)';
        }, 200);
    }

    /**
     * حفظ نتيجة الاستقطاع
     */
    function saveDeductionResult() {
        if (currentFinancingAmount <= 0) {
            showDeductionStatus('warning', 'لا توجد نتيجة صحيحة للحفظ');
            return;
        }

        try {
            const deductionData = {
                monthlySalary: parseFloat(monthlySalaryInput?.value) || 0,
                deductionRate: parseFloat(deductionRateSelect?.value) || 0,
                commitmentAmount: parseFloat(commitmentAmountInput?.value) || 0,
                minimumFinancing: currentFinancingAmount,
                calculatedAt: new Date().toISOString(),
                type: 'deduction_calculation'
            };

            // حفظ في التخزين المحلي
            let savedCalculations = [];
            try {
                const existingData = localStorage.getItem('saved_calculations');
                if (existingData) {
                    savedCalculations = JSON.parse(existingData);
                }
            } catch (e) {
                console.warn('خطأ في قراءة البيانات المحفوظة:', e);
            }

            savedCalculations.push(deductionData);

            // الاحتفاظ بآخر 50 حساب
            if (savedCalculations.length > 50) {
                savedCalculations = savedCalculations.slice(-50);
            }

            localStorage.setItem('saved_calculations', JSON.stringify(savedCalculations));

            showDeductionStatus('success', `تم حفظ النتيجة بنجاح! الحد الأدنى للتمويل: ${formatCurrency(currentFinancingAmount)} ريال`);

            // إرسال حدث مخصص
            window.dispatchEvent(new CustomEvent('deductionCalculationSaved', {
                detail: deductionData
            }));

        } catch (error) {
            console.error('خطأ في حفظ البيانات:', error);
            showDeductionStatus('error', 'حدث خطأ في حفظ البيانات');
        }
    }

    /**
     * إعادة تعيين النموذج
     */
    function resetDeductionForm() {
        if (deductionForm) {
            deductionForm.reset();
        }
        
        currentFinancingAmount = 0;
        updateDeductionDisplay(0);
        
        if (deductionSaveBtn) {
            deductionSaveBtn.disabled = true;
        }
        
        hideDeductionStatus();
        
        // تركيز على أول حقل
        if (monthlySalaryInput) {
            monthlySalaryInput.focus();
        }
        
        showDeductionStatus('success', 'تم إعادة تعيين النموذج');
    }

    /**
     * التحقق من المدخلات الرقمية
     */
    function validateNumericInput(e) {
        if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter'].includes(e.key)) {
            e.preventDefault();
        }
        
        // منع أكثر من نقطة عشرية واحدة
        if (e.key === '.' && e.target.value.includes('.')) {
            e.preventDefault();
        }
    }

    /**
     * عرض رسالة حالة الاستقطاع
     */
    function showDeductionStatus(type, message) {
        const deductionStatusMessage = document.getElementById('deductionStatusMessage');
        const deductionStatusIcon = document.getElementById('deductionStatusIcon');
        const deductionStatusText = document.getElementById('deductionStatusText');
        
        if (!deductionStatusMessage || !deductionStatusIcon || !deductionStatusText) return;

        deductionStatusMessage.className = `status-message show ${type}`;
        deductionStatusText.textContent = message;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        deductionStatusIcon.textContent = icons[type] || '✅';
        
        // إخفاء الرسالة بعد 4 ثوان
        setTimeout(() => {
            hideDeductionStatus();
        }, 4000);
    }

    /**
     * إخفاء رسالة الحالة
     */
    function hideDeductionStatus() {
        const deductionStatusMessage = document.getElementById('deductionStatusMessage');
        if (deductionStatusMessage) {
            deductionStatusMessage.classList.remove('show');
        }
    }

    // استرجاع حالة القسم عند التحميل
    try {
        const isExpanded = localStorage.getItem('deduction_calculator_expanded') === 'true';
        if (isExpanded) {
            setTimeout(() => {
                openDeductionSection();
            }, 100);
        }
    } catch (e) {
        console.warn('لا يمكن استرجاع حالة القسم:', e);
    }
}

// تحديث دالة التهيئة الرئيسية لتشمل حاسبة الاستقطاع
const originalInitializeToolbox = initializeToolbox;
initializeToolbox = function() {
    try {
        // تشغيل التهيئة الأصلية
        originalInitializeToolbox();
        
        // تهيئة حاسبة الاستقطاع
        setTimeout(() => {
            initializeDeductionCalculator();
        }, 100);
        
    } catch (error) {
        console.error('خطأ في تهيئة صندوق الأدوات المحدث:', error);
    }
};

// تصدير وظائف حاسبة الاستقطاع للاستخدام العام
window.deductionCalculatorAPI = {
    toggle: toggleDeductionSection,
    open: openDeductionSection,
    close: closeDeductionSection
};

console.log('تم تحميل تكامل حاسبة الاستقطاع بنجاح');

