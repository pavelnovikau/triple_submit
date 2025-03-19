// Common trial period configuration and logic
const TrialConfig = {
  TEST_MODE: true,
  TRIAL_PERIOD: 10, // 10 minutes in test mode, 7 days in release mode
  SECONDS_IN_TEST_MINUTE: 2000,
  TEST_MINUTE_DURATION: SECONDS_IN_TEST_MINUTE * 60, // 2000 seconds = 1 test minute
  MS_PER_DAY: 86400000, // 24 * 60 * 60 * 1000 (hours * minutes * seconds * milliseconds)
  
  // UI update intervals
  UI_UPDATE_INTERVAL: {
    TEST: 600,    // 6 seconds in test mode
    RELEASE: 60000 // 1 minute in release mode
  },
  
  // Вычисляет оставшееся время триала
  calculateTimeLeft(installDate) {
    if (!installDate) return 0;
    
    const timePassed = Date.now() - installDate;
    
    if (this.TEST_MODE) {
      // В тестовом режиме считаем в минутах
      const minutesPassed = Math.floor(timePassed / this.TEST_MINUTE_DURATION);
      const timeLeft = Math.max(0, this.TRIAL_PERIOD - minutesPassed);
      
      console.log('Trial time calculation:', {
        mode: 'TEST',
        initialPeriod: this.TRIAL_PERIOD,
        timePassed: Math.round(timePassed / 1000) + 's',
        minuteDuration: this.TEST_MINUTE_DURATION / 60 + 's',
        minutesPassed,
        timeLeft,
        installDate: new Date(installDate).toISOString(),
        now: new Date().toISOString()
      });
      
      return timeLeft;
    } else {
      // В релизном режиме считаем в днях
      const daysPassed = Math.floor(timePassed / this.MS_PER_DAY);
      const timeLeft = Math.max(0, this.TRIAL_PERIOD - daysPassed);
      
      console.log('Trial time calculation:', {
        mode: 'RELEASE',
        initialPeriod: this.TRIAL_PERIOD,
        timePassed: Math.round(timePassed / (1000 * 60 * 60 * 24)) + ' days',
        daysPassed,
        timeLeft,
        installDate: new Date(installDate).toISOString(),
        now: new Date().toISOString()
      });
      
      return timeLeft;
    }
  },
  
  // Проверяет статус триала
  async checkStatus() {
    try {
      const data = await chrome.storage.sync.get(['installDate', 'trialExpired', 'isPremium']);
      
      // Если премиум - триал не нужен
      if (data.isPremium) {
        return { 
          isActive: true, 
          daysLeft: -1,
          isPremium: true 
        };
      }
      
      // Если триал уже помечен как истекший
      if (data.trialExpired) {
        return { 
          isActive: false, 
          daysLeft: 0,
          isPremium: false,
          trialExpired: true 
        };
      }
      
      // Если нет даты установки
      if (!data.installDate) {
        const now = Date.now();
        await chrome.storage.sync.set({ 
          installDate: now,
          trialExpired: false
        });
        return { 
          isActive: true, 
          daysLeft: this.TRIAL_PERIOD,
          isPremium: false,
          installDate: now 
        };
      }
      
      // Вычисляем оставшееся время
      const timeLeft = this.calculateTimeLeft(data.installDate);
      
      // Если время вышло, обновляем статус
      if (timeLeft === 0 && !data.trialExpired) {
        await chrome.storage.sync.set({ trialExpired: true });
      }
      
      return {
        isActive: timeLeft > 0,
        daysLeft: timeLeft,
        isPremium: false,
        trialExpired: timeLeft === 0,
        installDate: data.installDate
      };
    } catch (error) {
      console.error('Error checking trial status:', error);
      return { 
        isActive: false, 
        daysLeft: 0,
        error: error.message 
      };
    }
  },
  
  // Форматирует оставшееся время для отображения
  formatTimeLeft(timeLeft) {
    if (this.TEST_MODE) {
      return `${timeLeft} min`;
    } else {
      return `${timeLeft} days`;
    }
  },
  
  // Получает детальную информацию о времени
  getTimeDetails(installDate) {
    const now = Date.now();
    const timePassed = now - installDate;
    
    if (this.TEST_MODE) {
      const minutesPassed = Math.floor(timePassed / this.TEST_MINUTE_DURATION);
      const secondsUntilNextMinute = Math.floor((timePassed % this.TEST_MINUTE_DURATION) / 1000);
      const timeLeft = Math.max(0, this.TRIAL_PERIOD - minutesPassed);
      
      return {
        timeLeft,
        minutesPassed,
        secondsUntilNextMinute,
        totalSecondsLeft: (timeLeft * this.SECONDS_IN_TEST_MINUTE) - secondsUntilNextMinute
      };
    } else {
      const daysPassed = Math.floor(timePassed / this.MS_PER_DAY);
      const hoursInDay = Math.floor((timePassed % this.MS_PER_DAY) / 3600000); // 1000 * 60 * 60 (milliseconds * seconds * minutes)
      const timeLeft = Math.max(0, this.TRIAL_PERIOD - daysPassed);
      
      return {
        timeLeft,
        daysPassed,
        hoursInDay,
        totalHoursLeft: (timeLeft * 24) - hoursInDay
      };
    }
  }
};

// Export for use in other modules
export default TrialConfig; 