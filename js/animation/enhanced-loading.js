class LoadingScreen {
      constructor() {
        this.config = {
          minDuration: 3000,    // 3 ثوان كحد أدنى
          maxDuration: 8000,    // 8 ثوان كحد أقصى
          messageInterval: 1500, // تغيير الرسالة كل 1.5 ثانية
          progressSpeed: 80     // سرعة التقدم
        };

        this.elements = {
          screen: document.getElementById('loadingScreen'),
          message: document.getElementById('loadingMessage'),
          submessage: document.getElementById('loadingSubmessage'),
          statusIcon: document.getElementById('statusIcon'),
          progressBar: document.getElementById('progressBar'),
          progressPercentage: document.getElementById('progressPercentage'),
          progressDots: document.querySelectorAll('.progress-dot')
        };

        this.state = {
          currentProgress: 0,
          currentMessageIndex: 0,
          isComplete: false,
          startTime: Date.now()
        };

        this.messages = [
          {
            main: 'جاري تحضير النظام',
            sub: 'نحضر لك تجربة استثنائية',
            icon: '⚡'
          },
          {
            main: 'إعداد الأدوات المتقدمة',
            sub: 'حاسبات ذكية ودقيقة',
            icon: '🧰'
          },
          {
            main: 'تجهيز البيانات الأساسية',
            sub: 'معلومات آمنة ومحمية',
            icon: '🔒'
          },
          {
            main: 'تحسين الأداء',
            sub: 'سرعة وكفاءة عالية',
            icon: '🚀'
          },
          {
            main: 'اللمسات الأخيرة',
            sub: 'جاري الانتهاء من التحضيرات',
            icon: '✨'
          },
          {
            main: 'مرحباً بك!',
            sub: 'كل شيء جاهز الآن',
            icon: '🎉'
          }
        ];

        this.intervals = {
          progress: null,
          message: null,
          dots: null
        };

        this.init();
      }

      init() {
        this.startProgressAnimation();
        this.startMessageRotation();
        this.startDotsAnimation();
        this.ensureMinimumDuration();
      }

      startProgressAnimation() {
        let lastUpdate = Date.now();
        
        this.intervals.progress = setInterval(() => {
          const now = Date.now();
          const deltaTime = now - lastUpdate;
          lastUpdate = now;

          // حساب سرعة التقدم بناءً على الوقت المتبقي
          const elapsed = now - this.state.startTime;
          const timeRemaining = this.config.maxDuration - elapsed;
          const progressRemaining = 100 - this.state.currentProgress;
          
          let increment;
          if (timeRemaining > 2000) {
            // تقدم طبيعي
            increment = (deltaTime / 1000) * (this.config.progressSpeed / 10);
          } else {
            // تسريع في النهاية
            increment = progressRemaining * 0.05;
          }

          // إضافة عشوائية للواقعية
          increment += (Math.random() - 0.5) * 2;
          
          this.updateProgress(Math.min(this.state.currentProgress + increment, 99.5));

          // إنهاء عند اكتمال الحد الأدنى للوقت والتقدم
          if (elapsed >= this.config.minDuration && this.state.currentProgress >= 99) {
            this.completeLoading();
          }
        }, 50);
      }

      updateProgress(newProgress) {
        this.state.currentProgress = newProgress;
        this.elements.progressBar.style.width = `${newProgress}%`;
        this.elements.progressPercentage.textContent = `${Math.round(newProgress)}%`;
      }

      startMessageRotation() {
        // عرض أول رسالة
        this.updateMessage();

        this.intervals.message = setInterval(() => {
          if (this.state.currentMessageIndex < this.messages.length - 1) {
            this.state.currentMessageIndex++;
            this.updateMessage();
          }
        }, this.config.messageInterval);
      }

      updateMessage() {
        const message = this.messages[this.state.currentMessageIndex];
        
        // إخفاء الرسالة الحالية
        this.elements.message.classList.remove('active');
        this.elements.submessage.classList.remove('active');
        
        setTimeout(() => {
          // تحديث المحتوى
          this.elements.message.textContent = message.main;
          this.elements.submessage.textContent = message.sub;
          this.elements.statusIcon.textContent = message.icon;
          
          // إظهار الرسالة الجديدة
          this.elements.message.classList.add('active');
          this.elements.submessage.classList.add('active');
        }, 300);
      }

      startDotsAnimation() {
        let activeDotIndex = 0;
        
        this.intervals.dots = setInterval(() => {
          // إزالة التفعيل من النقطة الحالية
          this.elements.progressDots[activeDotIndex]?.classList.remove('active');
          
          // الانتقال للنقطة التالية
          activeDotIndex = (activeDotIndex + 1) % this.elements.progressDots.length;
          
          // تفعيل النقطة الجديدة
          this.elements.progressDots[activeDotIndex]?.classList.add('active');
        }, 500);
      }

      ensureMinimumDuration() {
        setTimeout(() => {
          if (!this.state.isComplete) {
            this.completeLoading();
          }
        }, this.config.maxDuration);
      }

      completeLoading() {
        if (this.state.isComplete) return;
        
        this.state.isComplete = true;
        
        // مسح جميع التايمرز
        Object.values(this.intervals).forEach(interval => {
          if (interval) clearInterval(interval);
        });

        // إكمال التقدم
        this.updateProgress(100);
        
        // عرض رسالة الإكمال
        if (this.state.currentMessageIndex < this.messages.length - 1) {
          this.state.currentMessageIndex = this.messages.length - 1;
          this.updateMessage();
        }

        // تفعيل جميع النقاط
        this.elements.progressDots.forEach(dot => {
          dot.classList.add('active');
        });

        // إخفاء الشاشة بعد فترة قصيرة
        setTimeout(() => {
          this.hideScreen();
        }, 1500);
      }

      hideScreen() {
        this.elements.screen.classList.add('hidden');
        
        // إزالة العنصر من DOM بعد انتهاء الحركة
        setTimeout(() => {
          if (this.elements.screen.parentNode) {
            this.elements.screen.parentNode.removeChild(this.elements.screen);
          }
          
          // إشعار بانتهاء التحميل
          document.dispatchEvent(new CustomEvent('loadingComplete'));
        }, 1000);
      }

      // واجهة برمجية عامة
      static getInstance() {
        if (!window._loadingScreenInstance) {
          window._loadingScreenInstance = new LoadingScreen();
        }
        return window._loadingScreenInstance;
      }

      forceComplete() {
        this.completeLoading();
      }

      getProgress() {
        return this.state.currentProgress;
      }

      isComplete() {
        return this.state.isComplete;
      }
    }

    // تشغيل شاشة التحميل عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', () => {
      window.loadingScreen = LoadingScreen.getInstance();
    });

    // للتحكم الخارجي
    window.LoadingScreen = LoadingScreen;

    // مستمع لأحداث لوحة المفاتيح (للاختبار)
    document.addEventListener('keydown', (e) => {
      // اضغط مسافة لإنهاء التحميل فوراً (للاختبار)
      if (e.code === 'Space' && window.loadingScreen) {
        e.preventDefault();
        window.loadingScreen.forceComplete();
      }
    });