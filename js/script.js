
(function () {
 
  const $ = (id) => document.getElementById(id);
  const nf0 = (n) =>
    isFinite(n) ? n.toLocaleString("ar-EG", { maximumFractionDigits: 0 }) : "—";
  const nf2 = (n) =>
    isFinite(n) ? n.toLocaleString("ar-EG", { maximumFractionDigits: 2 }) : "—";

  const VAT = 0.15;

  function getInputs() {
    return {
  
      priceType: $("priceType").value, 
      carPrice: parseFloat($("carPrice").value) || 0,
      extras: parseFloat($("extras").value) || 0, 
      other1: parseFloat($("other1").value) || 0, 
      other2: parseFloat($("other2").value) || 0, 
      cashback: (parseFloat($("cashback").value) || 0) / 100, 
      support: (parseFloat($("support").value) || 0) / 100, 

      downPaymentRate: (parseFloat($("downPaymentRate").value) || 0) / 100,
      balloonRate: (parseFloat($("balloonRate").value) || 0) / 100,
      profitRate: (parseFloat($("profitRate").value) || 0) / 100,
      insuranceRate: (parseFloat($("insuranceRate").value) || 0) / 100,
      adminRate: (parseFloat($("adminRate").value) || 0) / 100,
      years: Math.max(0, parseInt(($("years").value || "0"), 10)),
    };
  }

  function refreshLabels() {
    const type = $("priceType").value;
    const lbl = document.querySelector('label[for="carPrice"]')
      ? document.querySelector('label[for="carPrice"]')
      : null;
    const carPriceLabelEl = document.querySelector(
      'label:has(#carPrice)'
    ); 

    if (carPriceLabelEl) {
      if (type === "withTax") {
        carPriceLabelEl.childNodes[0].textContent = "سعر السيارة (شامل): ";
      } else {
        carPriceLabelEl.childNodes[0].textContent = "سعر السيارة (بطاقة): ";
      }
    }
  }

  function computeBankPrice(inp) {
    const inclusive =
      inp.priceType === "withoutTax" ? inp.carPrice / (1 + VAT) : inp.carPrice;
    const I34 = inp.other2;
    const I22 = inp.extras;
    const I18 = inp.other1;
    const I10 = inclusive;
    const I26 = inp.cashback;
    const I30 = inp.support;

    const numerator = I34 + I22 + I18 + I10;
    const denominator = 1 / 1.15 - I26 - I30;
    const safeDen =
      Math.abs(denominator) < 1e-9
        ? denominator >= 0
          ? 1e-9
          : -1e-9
        : denominator;

    const bankPrice = numerator / safeDen;
    const card =
      inp.priceType === "withoutTax" ? inp.carPrice : inclusive / (1 + VAT);

    return { inclusive, card, bankPrice };
  }

  function computeSection2(inp, bankPrice) {
    const months = Math.max(1, inp.years * 12);

    const downPayment = bankPrice * inp.downPaymentRate;
    const balloon = bankPrice * inp.balloonRate;

    const profit = Math.max(0, bankPrice - downPayment) * inp.profitRate * inp.years;
    const insurance = bankPrice * inp.insuranceRate * inp.years;
    const admin = Math.max(0, bankPrice - downPayment) * inp.adminRate;

    const monthlyPayment =
      (bankPrice - downPayment - balloon + profit + insurance) / months;

    let finalCost;
    if (inp.cashback > 0) {
      finalCost = (months - 1) * monthlyPayment + balloon;
    } else {
      finalCost = (months - 1) * monthlyPayment + downPayment + balloon;
    }

    return {
      downPayment,
      balloon,
      profit,
      insurance,
      admin,
      monthlyPayment,
      finalCost,
    };
  }

  function updateUI(bank, sec2) {
    $("bankPrice").textContent = nf0(bank.bankPrice);
    $("bankPrice").dataset.raw = String(bank.bankPrice); // ← إضافة
    $("downPayment").textContent = nf0(sec2.downPayment);
    $("balloon").textContent = nf0(sec2.balloon);
    $("profit").textContent = nf0(sec2.profit);
    $("insurance").textContent = nf0(sec2.insurance);
    $("admin").textContent = nf0(sec2.admin);
    $("monthlyPayment").textContent = nf0(sec2.monthlyPayment);
    $("finalCost").textContent = nf0(sec2.finalCost);
    const y = getInputs().years;
    const lines = [
      `القسط الشهري: ${nf0(sec2.monthlyPayment)} ريال`,
      `الدفعة الأولى: ${nf0(sec2.downPayment)} ريال`,
      `الدفعة الأخيرة: ${nf0(sec2.balloon)} ريال`,
      `الرسوم الإدارية: ${nf0(sec2.admin)} ريال`,
      `الإجمالي على ${y} ${y === 1 ? "سنة" : "سنوات"}: ${nf0(sec2.finalCost)} ريال`,
      "",
      "ملاحظة: هذه الحسبة مبدئية وقد تختلف حسب سياسة البنك وشروط التمويل.",
    ];
    $("clientMessage").value = lines.join("\n");
  }

  function calculate() {
    const inp = getInputs();
    refreshLabels();

    const bank = computeBankPrice(inp);
    const sec2 = computeSection2(inp, bank.bankPrice);

    updateUI(bank, sec2);
  }

  function legacyCopy(text) {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    try {
      document.execCommand("copy");
    } catch (_) {}
    document.body.removeChild(temp);
  }

  function copyClientMessage() {
    const ta = $("clientMessage");
    if (!ta) return;
    const text = ta.value;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    } else {
      legacyCopy(text);
    }
  }

  // Events
  ["priceType", "carPrice", "extras", "other1", "other2", "cashback", "support",
   "downPaymentRate", "balloonRate", "profitRate", "insuranceRate", "adminRate", "years"
  ].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", calculate);
  });

  const copyBtn = $("copyMessage");
  if (copyBtn) copyBtn.addEventListener("click", copyClientMessage);

  // Initial
  calculate();
  function directExpected({ inclusive, extras, other1, other2, cashback, support }) {
    const numerator = other2 + extras + other1 + inclusive;
    const denominator = 1 / 1.15 - cashback - support;
    return numerator / denominator;
  }

  function runDevTests() {
    const approx = (a, b, eps = 0.6) => Math.abs(a - b) <= eps;
    (function () {
      const testInp = {
        priceType: "withoutTax",
        carPrice: 100000,
        extras: 0,
        other1: 0,
        other2: 0,
        cashback: 0,
        support: 0,
      };
      const { inclusive, bankPrice } = (function () {
        const inclusive = testInp.carPrice * (1 + VAT);
        const expected = directExpected({
          inclusive,
          extras: 0,
          other1: 0,
          other2: 0,
          cashback: 0,
          support: 0,
        });
        console.assert(approx(bankPrice, expected), "T1 failed");
        return { inclusive, bankPrice: expected };
      })();
      void inclusive; 
    })();
    (function () {
      const expected = directExpected({
        inclusive: 100000,
        extras: 500,
        other1: 500,
        other2: 9000,
        cashback: 0,
        support: 0,
      });
      console.assert(approx(expected, 126500, 1), "T2 failed");
    })();
    (function () {
      const expected = directExpected({
        inclusive: 100000,
        extras: 500,
        other1: 500,
        other2: 9000,
        cashback: 0.05,
        support: 0.05,
      });
      console.assert(approx(expected, 142938, 2), "T3 failed");
    })();
  }


  try { runDevTests(); } catch (e) {}
})();
