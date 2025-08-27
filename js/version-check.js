(async function initVersionWatcher() {
  const CURRENT = (window.APP_VERSION || '').trim();

  async function fetchRemoteVersion() {
    // no-store/no-cache لضمان تجاوز الكاش
    const res = await fetch('/version.json?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) throw new Error('version.json fetch failed');
    const data = await res.json();
    return (data.version || '').trim();
  }

  async function checkNow() {
    try {
      const remote = await fetchRemoteVersion();
      if (remote && CURRENT && remote !== CURRENT) {
        // اختياري: إظهار تنبيه ودي قبل الإنعاش
         alert('🔁 تم إصدار تحديث جديد. سيتم تحديث الصفحة الآن.');
        // reload
        location.reload(); // يكفي بدون true
      }
    } catch (e) {
      // تجاهل الأخطاء المؤقتة في الشبكة
      console.debug('[VersionCheck]', e);
    }
  }

  // فحص عند رجوع التركيز للتاب (أغلب الحالات ستكون هنا)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkNow();
  });

  // فحص دوري (مثلاً كل 5 دقائق)
  setInterval(checkNow, 5 * 60 * 1000);

  // فحص أولي بعد تحميل الصفحة
  // (انتظر ثانيتين حتى تتهيأ الصفحة)
  setTimeout(checkNow, 2000);
})();
