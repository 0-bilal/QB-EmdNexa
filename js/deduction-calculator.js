// ملف JavaScript الكامل لحاسبة الاستقطاع - deduction-calculator.js

document.addEventListener('DOMContentLoaded', function() {
    // عناصر DOM
    const deductionHeader = document.getElementById('deductionHeader');
    const deductionContent = document.getElementById('deductionContent');
    const deductionForm = document.getElementById('deductionForm');
    const monthlySalaryInput = document.getElementById('monthlySalary');
    const deductionRateSelect = document.getElementById('deductionRate');
    const commitmentAmountInput = document.getElementById('commitmentAmount');
    const financingValueElement = document.getElementById('financingValue');
    const deductionSaveBtn = document.getElementById('deductionSaveBtn');
    const deductionResetBtn = document.getElementById('deductionResetBtn');
    const deductionStatusMessage = document.getElementById('deductionStatusMessage');
    const deductionStatusIcon = document.getElementById('deductionStatusIcon');
    const deductionStatusText = document.getElementById('deductionStatusText');

    // متغيرات لحفظ البيانات
    let currentFinancingAmount = 0;
    let isInitialized = false;

    // ===============================
    // وظائف الطي والتوسيع
    // ===============================

    // إعداد خاصية الفتح والإغلاق
    function initializeCollapsible() {
        if (!deductionHeader) return;

        deductionHeader.addEventListener('click', toggleSection);
        deductionHeader.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSection();
            }
        });

        // إضافة تأثير التمرير
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

    // تبديل حالة القسم (فتح/إغلاق)
    function toggleSection() {
        const isExpanded = deductionHeader.getAttribute('aria-expanded') === 'true';
        
        if (isExpanded) {
            closeSection();
        } else {
            openSection();
        }
    }

    // فتح القسم
    function openSection() {
        deductionHeader.setAttribute('aria-expanded', 'true');
        deductionContent.setAttribute('aria-hidden', 'false');
        deductionContent.classList.add('expanded');
        
        // تركيز على أول حقل إدخال بعد الانتهاء من الانيميشن
        setTimeout(() => {
            if (monthlySalaryInput) {
                monthlySalaryInput.focus();
            }
        }, 300);

        // حفظ حالة القسم
        localStorage.setItem('deduction_calculator_expanded', 'true');
    }

    // إغلاق القسم
    function closeSection() {
        deductionHeader.setAttribute('aria-expanded', 'false');
        deductionContent.setAttribute('aria-hidden', 'true');
        deductionContent.classList.remove('expanded');

        // حفظ حالة القسم
        localStorage.setItem('deduction_calculator_expanded', 'false');
    }

    // ===============================
    // وظائف الحسابات
    // ===============================

    // حساب الحد الأدنى للتمويل
    function calculateMinimumFinancing() {
        const monthlySalary = parseFloat(monthlySalaryInput.value) || 0;
        const deductionRate = parseFloat(deductionRateSelect.value) || 0;
        const commitmentAmount = parseFloat(commitmentAmountInput.value) || 0;

        if (monthlySalary > 0 && deductionRate > 0) {
            // الراتب الشهري × نسبة الاستقطاع / 100 - مبلغ الالتزام
            const deductionAmount = (monthlySalary * deductionRate) / 100;
            const minimumFinancing = Math.max(0, deductionAmount - commitmentAmount);
            
            currentFinancingAmount = minimumFinancing;
            
            // تحديث العرض
            updateFinancingDisplay(minimumFinancing);
            
            // تفعيل زر الحفظ
            if (deductionSaveBtn) {
                deductionSaveBtn.disabled = false;
            }
            
            // إظهار معلومات إضافية في وحدة التحكم للمطورين
            console.log('تفاصيل الحساب:', {
                راتب_شهري: monthlySalary,
                نسبة_استقطاع: deductionRate + '%',
                مبلغ_استقطاع: deductionAmount.toFixed(2),
                التزامات: commitmentAmount,
                الحد_الأدنى_للتمويل: minimumFinancing.toFixed(2)
            });
            
            return minimumFinancing;
        } else {
            currentFinancingAmount = 0;
            updateFinancingDisplay(0);
            if (deductionSaveBtn) {
                deductionSaveBtn.disabled = true;
            }
            return 0;
        }
    }

    // تحديث عرض النتيجة
    function updateFinancingDisplay(amount) {
        if (!financingValueElement) return;

        const formattedAmount = formatCurrency(amount);
        financingValueElement.textContent = formattedAmount;
        
        // إضافة تأثير بصري
        financingValueElement.style.transform = 'scale(1.1)';
        financingValueElement.style.color = amount > 0 ? 'var(--text-accent)' : 'var(--text-tertiary)';
        
        setTimeout(() => {
            financingValueElement.style.transform = 'scale(1)';
        }, 200);

        // تحديث لون الحدود حسب القيمة
        const financingResult = document.getElementById('minimumFinancingResult');
        if (financingResult) {
            if (amount > 0) {
                financingResult.style.borderColor = 'var(--border-success)';
            } else {
                financingResult.style.borderColor = 'var(--border-primary)';
            }
        }
    }

    // تنسيق العملة
    function formatCurrency(amount) {
        return new Intl.NumberFormat('ar-SA', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // ===============================
    // وظائف رسائل الحالة
    // ===============================

    // عرض رسالة الحالة
    function showStatusMessage(type, message) {
        if (!deductionStatusMessage) return;

        deductionStatusMessage.className = `status-message show ${type}`;
        if (deductionStatusText) {
            deductionStatusText.textContent = message;
        }
        
        // أيقونات مختلفة للحالات
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        if (deductionStatusIcon) {
            deductionStatusIcon.textContent = icons[type] || '✅';
        }
        
        // إخفاء الرسالة بعد 4 ثوان
        setTimeout(() => {
            if (deductionStatusMessage) {
                deductionStatusMessage.classList.remove('show');
            }
        }, 4000);
    }

    // ===============================
    // وظائف الحفظ والاسترجاع
    // ===============================

    // حفظ النتيجة
    function saveFinancingResult() {
        if (currentFinancingAmount <= 0) {
            showStatusMessage('warning', 'لا توجد نتيجة صحيحة للحفظ');
            return;
        }

        try {
            // إنشاء كائن البيانات للحفظ
            const deductionData = {
                monthlySalary: parseFloat(monthlySalaryInput.value),
                deductionRate: parseFloat(deductionRateSelect.value),
                commitmentAmount: parseFloat(commitmentAmountInput.value) || 0,
                minimumFinancing: currentFinancingAmount,
                calculatedAt: new Date().toISOString(),
                type: 'deduction_calculation',
                id: generateUniqueId()
            };

            // محاولة الحفظ في التخزين المحلي
            let savedCalculations = getSavedCalculations();

            // إضافة الحساب الجديد
            savedCalculations.push(deductionData);

            // الاحتفاظ بآخر 50 حساب فقط
            if (savedCalculations.length > 50) {
                savedCalculations = savedCalculations.slice(-50);
            }

            // حفظ البيانات
            localStorage.setItem('saved_calculations', JSON.stringify(savedCalculations));

            // إظهار رسالة نجاح
            showStatusMessage('success', `تم حفظ النتيجة بنجاح! الحد الأدنى للتمويل: ${formatCurrency(currentFinancingAmount)} ريال`);

            // إرسال حدث مخصص لإشعار أجزاء أخرى من التطبيق
            window.dispatchEvent(new CustomEvent('deductionCalculationSaved', {
                detail: deductionData
            }));

            // تحديث إحصائيات الاستخدام
            updateUsageStats();

        } catch (error) {
            console.error('خطأ في حفظ البيانات:', error);
            showStatusMessage('error', 'حدث خطأ في حفظ البيانات. يرجى المحاولة مرة أخرى.');
        }
    }

    // استرجاع الحسابات المحفوظة
    function getSavedCalculations() {
        try {
            const existingData = localStorage.getItem('saved_calculations');
            return existingData ? JSON.parse(existingData) : [];
        } catch (e) {
            console.warn('خطأ في قراءة البيانات المحفوظة:', e);
            return [];
        }
    }

    // توليد معرف فريد
    function generateUniqueId() {
        return 'deduction_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // تحديث إحصائيات الاستخدام
    function updateUsageStats() {
        try {
            let stats = JSON.parse(localStorage.getItem('calculator_usage_stats') || '{}');
            stats.deductionCalculatorUsage = (stats.deductionCalculatorUsage || 0) + 1;
            stats.lastUsed = new Date().toISOString();
            localStorage.setItem('calculator_usage_stats', JSON.stringify(stats));
        } catch (error) {
            console.warn('خطأ في تحديث الإحصائيات:', error);
        }
    }

    // ===============================
    // وظائف إعادة التعيين والتحميل
    // ===============================

    // إعادة تعيين النموذج
    function resetForm() {
        if (deductionForm) {
            deductionForm.reset();
        }
        
        currentFinancingAmount = 0;
        updateFinancingDisplay(0);
        
        if (deductionSaveBtn) {
            deductionSaveBtn.disabled = true;
        }
        
        if (deductionStatusMessage) {
            deductionStatusMessage.classList.remove('show');
        }
        
        // تركيز على أول حقل
        if (monthlySalaryInput) {
            monthlySalaryInput.focus();
        }
        
        showStatusMessage('success', 'تم إعادة تعيين النموذج بنجاح');
    }

    // تحميل البيانات المحفوظة
    function loadSavedData() {
        try {
            const savedCalculations = getSavedCalculations();
            const lastDeductionCalc = savedCalculations
                .filter(calc => calc.type === 'deduction_calculation')
                .pop();
            
            if (lastDeductionCalc) {
                const timeDiff = new Date() - new Date(lastDeductionCalc.calculatedAt);
                const hoursDiff = timeDiff / (1000 * 60 * 60);
                
                // عرض خيار التحميل فقط إذا كان الحساب حديث (أقل من 24 ساعة)
                if (hoursDiff < 24 && confirm('هل تريد تحميل آخر حساب محفوظ؟')) {
                    if (monthlySalaryInput) monthlySalaryInput.value = lastDeductionCalc.monthlySalary;
                    if (deductionRateSelect) deductionRateSelect.value = lastDeductionCalc.deductionRate;
                    if (commitmentAmountInput) commitmentAmountInput.value = lastDeductionCalc.commitmentAmount || '';
                    
                    // فتح القسم وحساب النتيجة
                    openSection();
                    setTimeout(() => {
                        handleInputChange();
                        showStatusMessage('info', 'تم تحميل آخر حساب محفوظ');
                    }, 300);
                }
            }
        } catch (error) {
            console.warn('خطأ في تحميل البيانات المحفوظة:', error);
        }
    }

    // استرجاع حالة القسم المحفوظة
    function restoreSectionState() {
        try {
            const isExpanded = localStorage.getItem('deduction_calculator_expanded') === 'true';
            if (isExpanded) {
                openSection();
            }
        } catch (error) {
            console.warn('خطأ في استرجاع حالة القسم:', error);
        }
    }

    // ===============================
    // وظائف التحقق والتجاوب
    // ===============================

    // التحقق من صحة المدخلات
    function validateInputs() {
        const monthlySalary = parseFloat(monthlySalaryInput.value);
        const deductionRate = parseFloat(deductionRateSelect.value);
        const commitmentAmount = parseFloat(commitmentAmountInput.value) || 0;
        
        let isValid = true;
        let errorMessage = '';

        if (!monthlySalary || monthlySalary <= 0) {
            isValid = false;
            errorMessage = 'يرجى إدخال راتب شهري صحيح';
        } else if (!deductionRate || deductionRate <= 0) {
            isValid = false;
            errorMessage = 'يرجى اختيار نسبة الاستقطاع';
        } else if (monthlySalary < 1000) {
            isValid = false;
            errorMessage = 'الراتب الشهري يجب أن يكون أكبر من 1000 ريال';
        } else if (commitmentAmount >= monthlySalary) {
            isValid = false;
            errorMessage = 'مبلغ الالتزام لا يمكن أن يكون أكبر من أو يساوي الراتب';
        }

        return { isValid, errorMessage };
    }

    // معالج إرسال النموذج
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const validation = validateInputs();
        if (!validation.isValid) {
            showStatusMessage('error', validation.errorMessage);
            return;
        }

        saveFinancingResult();
    }

    // تحديث الحساب عند تغيير المدخلات
    function handleInputChange() {
        const validation = validateInputs();
        
        if (validation.isValid) {
            calculateMinimumFinancing();
        } else {
            currentFinancingAmount = 0;
            updateFinancingDisplay(0);
            if (deductionSaveBtn) {
                deductionSaveBtn.disabled = true;
            }
        }
    }

    // ===============================
    // وظائف مستمعي الأحداث
    // ===============================

    // إضافة مستمعي الأحداث
    function addEventListeners() {
        // التحقق من وجود العناصر قبل إضافة المستمعين
        if (!deductionForm) {
            console.warn('لم يتم العثور على نموذج حاسبة الاستقطاع');
            return;
        }

        // أحداث تغيير المدخلات
        if (monthlySalaryInput) {
            monthlySalaryInput.addEventListener('input', handleInputChange);
            monthlySalaryInput.addEventListener('blur', formatInputOnBlur);
        }
        
        if (deductionRateSelect) {
            deductionRateSelect.addEventListener('change', handleInputChange);
        }
        
        if (commitmentAmountInput) {
            commitmentAmountInput.addEventListener('input', handleInputChange);
            commitmentAmountInput.addEventListener('blur', formatInputOnBlur);
        }

        // أحداث النموذج والأزرار
        deductionForm.addEventListener('submit', handleFormSubmit);
        
        if (deductionResetBtn) {
            deductionResetBtn.addEventListener('click', resetForm);
        }

        // أحداث لوحة المفاتيح للمدخلات الرقمية
        [monthlySalaryInput, commitmentAmountInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', validateNumericInput);
                input.addEventListener('paste', handlePasteEvent);
            }
        });

        // أحداث تحسين تجربة المستخدم
        addUserExperienceEnhancements();
    }

    // تحسين تجربة المستخدم
    function addUserExperienceEnhancements() {
        // تلميحات تفاعلية
        const tooltips = [
            { element: monthlySalaryInput, message: 'أدخل إجمالي الراتب الشهري قبل الخصومات' },
            { element: deductionRateSelect, message: 'اختر النسبة المئوية المسموحة للاستقطاع من الراتب' },
            { element: commitmentAmountInput, message: 'أدخل مجموع الالتزامات الشهرية الحالية (اختياري)' }
        ];

        tooltips.forEach(({ element, message }) => {
            if (element) {
                element.addEventListener('focus', function() {
                    this.setAttribute('title', message);
                });
            }
        });

        // تحسين إمكانية الوصول
        enhanceAccessibility();
    }

    // التحقق من المدخلات الرقمية
    function validateNumericInput(e) {
        // السماح فقط بالأرقام والنقطة العشرية والمفاتيح الخاصة
        if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
        
        // منع إدخال أكثر من نقطة عشرية واحدة
        if (e.key === '.' && e.target.value.includes('.')) {
            e.preventDefault();
        }
    }

    // معالجة أحداث اللصق
    function handlePasteEvent(e) {
        setTimeout(() => {
            const value = e.target.value;
            // إزالة أي رموز غير صحيحة من النص الملصق
            const cleanValue = value.replace(/[^0-9.]/g, '');
            if (value !== cleanValue) {
                e.target.value = cleanValue;
                handleInputChange();
            }
        }, 0);
    }

    // تنسيق المدخلات عند فقدان التركيز
    function formatInputOnBlur(e) {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value > 0) {
            e.target.value = value.toFixed(2);
        }
    }

    // تحسين إمكانية الوصول
    function enhanceAccessibility() {
        // إضافة وصف للنتيجة
        const financingResult = document.getElementById('minimumFinancingResult');
        if (financingResult) {
            financingResult.setAttribute('aria-label', 'نتيجة حساب الحد الأدنى للتمويل');
        }

        // تحسين تجربة قارئ الشاشة
        if (deductionForm) {
            deductionForm.setAttribute('aria-label', 'نموذج حاسبة الاستقطاع');
        }
        
        // إضافة وصف للحالة
        if (deductionStatusMessage) {
            deductionStatusMessage.setAttribute('aria-label', 'رسالة حالة العملية');
        }
    }

    // ===============================
    // دالة التهيئة الرئيسية
    // ===============================

    // دالة التهيئة الرئيسية
    function initialize() {
        try {
            // التحقق من وجود العناصر الأساسية
            if (!deductionHeader || !deductionContent) {
                console.warn('عناصر حاسبة الاستقطاع غير موجودة في الصفحة');
                return;
            }

            initializeCollapsible();
            addEventListeners();
            
            // استرجاع حالة القسم المحفوظة
            restoreSectionState();
            
            // تحميل البيانات المحفوظة بعد تأخير قصير
            setTimeout(loadSavedData, 1500);
            
            isInitialized = true;
            console.log('تم تهيئة حاسبة الاستقطاع بنجاح');
            
            // إرسال حدث التهيئة
            window.dispatchEvent(new CustomEvent('deductionCalculatorInitialized'));
            
        } catch (error) {
            console.error('خطأ في تهيئة حاسبة الاستقطاع:', error);
        }
    }

    // ===============================
    // بدء التهيئة والتصدير
    // ===============================

    // بدء التهيئة
    initialize();

    // تصدير الوظائف للاستخدام العام
    window.deductionCalculator = {
        openSection,
        closeSection,
        toggleSection,
        calculateMinimumFinancing,
        resetForm,
        saveFinancingResult,
        getCurrentFinancingAmount: () => currentFinancingAmount,
        getSavedCalculations,
        isInitialized: () => isInitialized,
        
        // وظائف مساعدة
        formatCurrency,
        validateInputs,
        
        // إعادة التهيئة إذا لزم الأمر
        reinitialize: initialize
    };

    // معالجة الأخطاء العامة
    window.addEventListener('error', function(e) {
        if (e.filename && e.filename.includes('deduction-calculator')) {
            console.error('خطأ في حاسبة الاستقطاع:', e.error);
            showStatusMessage('error', 'حدث خطأ غير متوقع. يرجى إعادة تحميل الصفحة.');
        }
    });
});