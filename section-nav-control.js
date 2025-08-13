// section-nav-control.js
(function () {
  // عناصر
  const navWrap  = document.getElementById('sectionNav');
  const navBtn   = document.getElementById('sectionNavBtn');
  const footerEl = document.getElementById('devSection');

  // الأقسام المراد التنقل بينها (حدّث IDs لو لزم)
  const sections = [
    document.getElementById('sec1'),
    document.getElementById('sec2'),
    document.getElementById('sec3'),
  ].filter(Boolean);

  if (!navWrap || !navBtn || !footerEl || sections.length === 0) return;

  // تفعيل مساحة سفلية للمحتوى على الجوال
  function enableBodyPaddingForSticky() {
    if (window.matchMedia('(max-width: 820px)').matches) {
      document.body.classList.add('has-sticky-nav');
      navBtn.style.display = 'inline-flex';
    } else {
      document.body.classList.remove('has-sticky-nav');
      navBtn.style.display = 'none';
    }
  }

  // تحديث عنوان الزر حسب القسم الحالي
  let currentIndex = 0;
  function updateBtnLabel() {
    const labels = ['التفاصيل', 'الرسالة', 'البداية'];
    navBtn.textContent = labels[currentIndex] || 'التالي';
  }

  // تحريك التمرير إلى القسم التالي
  function onNavClick(e) {
    e.preventDefault();
    currentIndex = (currentIndex + 1) % sections.length;
    const target = sections[currentIndex];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateBtnLabel();
  }

  // مراقبة ظهور الفوتر لإخفاء الزر ومنع تغطيته
  function setupFooterObserver() {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        navWrap.classList.add('is-footer-visible');
      } else {
        navWrap.classList.remove('is-footer-visible');
      }
    }, {
      root: null,
      threshold: 0,
      rootMargin: '0px 0px -6% 0px' // إخفاء مبكر قليلًا لراحة الفوتر
    });
    io.observe(footerEl);
  }

  // متابعة أي الأقسام في الشاشة لتحديث تسمية الزر تلقائيًا
  function setupSectionWatcher() {
    const ioSec = new IntersectionObserver((entries) => {
      // نختار القسم الأكثر ظهورًا لتحديد currentIndex
      let topCandidate = null; let maxRatio = 0;
      for (const en of entries) {
        if (en.isIntersecting && en.intersectionRatio > maxRatio) {
          maxRatio = en.intersectionRatio;
          topCandidate = sections.indexOf(en.target);
        }
      }
      if (topCandidate !== null && topCandidate !== -1) {
        currentIndex = topCandidate;
        updateBtnLabel();
      }
    }, { threshold: [0.2, 0.4, 0.6, 0.8, 1] });

    sections.forEach(sec => ioSec.observe(sec));
  }

  // بدء التشغيل
  document.addEventListener('DOMContentLoaded', () => {
    enableBodyPaddingForSticky();
    setupFooterObserver();
    setupSectionWatcher();
    updateBtnLabel();
    navBtn.addEventListener('click', onNavClick, { passive: false });
  });

  // استجابة لتغيير القياس
  window.addEventListener('resize', enableBodyPaddingForSticky);
})();
