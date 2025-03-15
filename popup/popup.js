// Popup.js - main script for managing popup in Triple Submit

// Logger module for better debugging
const Logger = {
  debug: function(message, data) {
    console.debug(`[Triple Submit] ${message}`, data || '');
  },
  info: function(message, data) {
    console.info(`[Triple Submit] ${message}`, data || '');
  },
  warn: function(message, data) {
    console.warn(`[Triple Submit] ${message}`, data || '');
  },
  error: function(message, data) {
    console.error(`[Triple Submit] ERROR: ${message}`, data || '');
  }
};

// Test mode configuration
const TEST_MODE = true; // Set to false for production/release mode
const TRIAL_PERIOD = TEST_MODE ? 10 : 7; // 10 minutes for test mode, 7 days for release mode

// Custom localization cache
let localizedStrings = {};
const defaultLanguage = 'en';

document.addEventListener('DOMContentLoaded', function() {
  // Main UI elements
  const domainToggle = document.getElementById('domain-toggle');
  const currentDomainText = document.getElementById('current-domain-text');
  const decreaseCountBtn = document.getElementById('decrease-count');
  const increaseCountBtn = document.getElementById('increase-count');
  const pressCountEl = document.getElementById('press-count');
  const feedbackToggle = document.getElementById('feedback-toggle');
  const usageCountEl = document.getElementById('usage-count');
  const premiumBanner = document.querySelector('.premium-banner');
  const premiumModal = document.getElementById('premium-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const payButton = document.getElementById('pay-button');
  const delaySlider = document.getElementById('delay-slider');
  const languageSelect = document.getElementById('language-select');
  
  // Delay value labels
  const delayLabels = {
    fast: { min: 200, max: 700 },
    normal: { min: 701, max: 1300 },
    slow: { min: 1301, max: 2000 }
  };
  
  // Current settings and state
  let currentDomain = '';
  let currentSettings = {
    domainEnabled: false,
    pressCount: 3,
    showFeedback: true,
    delay: 600,
    language: 'en'
  };
  
  let isPremium = false;
  let trialDaysLeft = 0;
  let isTrialOver = false;
  let installDate = null;
  
  let uiUpdateTimer = null; // Add timer variable
  
  /**
   * Get current tab domain
   */
  async function getCurrentTabDomain() {
    return new Promise(async (resolve) => {
      try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs && tabs.length > 0) {
        const url = new URL(tabs[0].url);
        currentDomain = url.hostname;
          resolve(currentDomain);
        } else {
          Logger.error('Error getting active tab');
          resolve('');
        }
      } catch (error) {
        Logger.error('Error getting domain:', error);
        resolve('');
      }
    });
  }
  
  /**
   * Check trial period status
   */
  async function checkTrialStatus() {
    try {
      Logger.info('=== TRIAL STATUS CHECK START ===');
      
      const data = await chrome.storage.sync.get(['installDate', 'isPremium']);
      isPremium = data.isPremium || false;
      
      Logger.info('Mode and Status:', {
        mode: TEST_MODE ? 'TEST MODE (minutes)' : 'RELEASE MODE (days)',
        premium: isPremium ? 'ACTIVE' : 'NOT ACTIVE'
      });
      
      if (!isPremium) {
        // If no install date, set it now
        if (!data.installDate) {
          installDate = Date.now();
          await chrome.storage.sync.set({ installDate });
          Logger.info('NEW Install date:', new Date(installDate).toLocaleString());
        } else {
          installDate = data.installDate;
          Logger.info('Existing install date:', new Date(installDate).toLocaleString());
        }
        
        // Calculate remaining trial time based on mode
        const timePassed = Date.now() - installDate;
        let timeLeft;
        
        if (TEST_MODE) {
          // In test mode: calculate minutes
          const minutesPassed = Math.floor(timePassed / (1000 * 60));
          timeLeft = Math.max(0, TRIAL_PERIOD - minutesPassed);
          trialDaysLeft = timeLeft; // For display purposes
          
          const secondsUntilNextMinute = Math.floor((timePassed % (1000 * 60)) / 1000);
          const totalSecondsLeft = (timeLeft * 60) - secondsUntilNextMinute;
          
          Logger.info('=== REMAINING TRIAL TIME ===');
          Logger.info('Time details:', {
            minutesLeft: timeLeft,
            secondsLeft: totalSecondsLeft % 60,
            totalSecondsLeft: totalSecondsLeft,
            nextMinuteIn: 60 - secondsUntilNextMinute
          });
          
          Logger.info('Test mode time check:', {
            totalMinutes: TRIAL_PERIOD,
            minutesPassed: minutesPassed,
            minutesLeft: timeLeft,
            secondsUntilNextMinute: secondsUntilNextMinute
          });
          
        } else {
          // In release mode: calculate days
          const daysPassed = Math.floor(timePassed / (1000 * 60 * 60 * 24));
          timeLeft = Math.max(0, TRIAL_PERIOD - daysPassed);
          trialDaysLeft = timeLeft;
          
          const hoursInDay = Math.floor((timePassed % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const totalHoursLeft = (timeLeft * 24) - hoursInDay;
          
          Logger.info('=== REMAINING TRIAL TIME ===');
          Logger.info('Time details:', {
            daysLeft: timeLeft,
            hoursLeft: totalHoursLeft % 24,
            totalHoursLeft: totalHoursLeft,
            nextDayIn: 24 - hoursInDay
          });
          
          Logger.info('Release mode time check:', {
            totalDays: TRIAL_PERIOD,
            daysPassed: daysPassed,
            daysLeft: timeLeft
          });
        }
        
        isTrialOver = timeLeft === 0;
        Logger.info('Trial status:', {
          timeLeft: timeLeft,
          isOver: isTrialOver,
          unit: TEST_MODE ? 'minutes' : 'days',
          expiresAt: new Date(installDate + (TEST_MODE ? TRIAL_PERIOD * 60 * 1000 : TRIAL_PERIOD * 24 * 60 * 60 * 1000)).toLocaleString()
        });
        
        // If trial is over, disable functionality
        if (isTrialOver) {
          Logger.info('!!! TRIAL PERIOD HAS ENDED - DISABLING FUNCTIONALITY !!!');
          // Force disable domain toggle
          currentSettings.domainEnabled = false;
          domainToggle.checked = false;
          domainToggle.disabled = true;
          
          // Show modal
          showPremiumModal();
          
          // Remove close button from modal
          const closeBtn = document.querySelector('.close-modal');
          if (closeBtn) {
            closeBtn.style.display = 'none';
          }
          
          // Prevent clicking outside to close
          window.removeEventListener('click', handleModalOutsideClick);
          
          // Save disabled state
          await chrome.storage.sync.set({
            settings: {
              ...currentSettings,
              domainEnabled: false
            }
          });
          
          // Notify background script to disable functionality
          chrome.runtime.sendMessage({
            action: 'trial_ended',
            timestamp: Date.now()
          });
        }
      }
      
      return !isTrialOver || isPremium;
    } catch (error) {
      Logger.error('Error checking trial status:', error);
      return false;
    }
  }
  
  /**
   * Start periodic UI updates
   */
  function startPeriodicUpdates() {
    // Clear any existing timer
    if (uiUpdateTimer) {
      clearInterval(uiUpdateTimer);
    }
    
    // Update UI immediately
    checkTrialStatus().then(() => updateUI());
    
    // Set update interval based on mode
    const updateInterval = TEST_MODE ? 1000 : 60000; // 1 second in test mode, 1 minute in release mode
    
    uiUpdateTimer = setInterval(async () => {
      await checkTrialStatus();
      updateUI();
    }, updateInterval);
    
    Logger.info(`Started periodic UI updates with interval: ${updateInterval}ms`);
  }
  
  /**
   * Stop periodic UI updates
   */
  function stopPeriodicUpdates() {
    if (uiUpdateTimer) {
      clearInterval(uiUpdateTimer);
      uiUpdateTimer = null;
      Logger.info('Stopped periodic UI updates');
    }
  }
  
  /**
   * Initialize popup
   */
  async function initPopup() {
    try {
      Logger.info('=== POPUP INITIALIZATION START ===');
      
      // Check trial status first
      Logger.info('Checking trial status...');
      await checkTrialStatus();
      
      // Get current domain
      Logger.info('Getting current domain...');
      await getCurrentTabDomain();
      
      // Display current domain
      if (currentDomainText) {
        currentDomainText.textContent = currentDomain || 'unknown';
      }
      
      // Get general settings
      const data = await chrome.storage.sync.get(['settings', 'language']);
      if (data && data.settings) {
        // Only apply enabled state if trial is not over or premium
        if (!isTrialOver || isPremium) {
          currentSettings = { ...currentSettings, ...data.settings };
        } else {
          // If trial is over, force disable but keep other settings
          currentSettings = {
            ...data.settings,
            domainEnabled: false
          };
        }
      }
      
      // Get language setting
      if (data && data.language) {
        currentSettings.language = data.language;
      } else {
        // If no language set, use browser language or default to English
        const browserLang = chrome.i18n.getUILanguage() || 'en';
        const supportedLangs = ['en', 'ru', 'es', 'de', 'fr', 'it', 'ja', 'zh', 'pt', 'ar'];
        const langCode = browserLang.split('-')[0]; // Get primary language code (en-US -> en)
        
        if (supportedLangs.includes(langCode)) {
          currentSettings.language = langCode;
        } else {
          currentSettings.language = 'en'; // Default to English
        }
        
        // Save the language setting
        await chrome.storage.sync.set({ language: currentSettings.language });
      }
      
      // Set selected language in dropdown
      if (languageSelect) {
        languageSelect.value = currentSettings.language;
      }
      
      // Load localized strings first, then update UI
      await loadLocalizedStrings(currentSettings.language);
      
      // Update UI
      updateUI();
      
      // Apply language
      updateLanguage(currentSettings.language);
      
      // Start periodic updates
      startPeriodicUpdates();
      
      Logger.info('Popup initialized with settings:', currentSettings);
    } catch (error) {
      Logger.error('Error initializing popup:', error);
    }
  }
  
  /**
   * Load localized strings for a specific language
   */
  async function loadLocalizedStrings(langCode) {
    try {
      // Skip if already loaded
      if (localizedStrings[langCode]) {
        Logger.info(`Using cached strings for language: ${langCode}`);
        return;
      }
      
      Logger.info(`Loading strings for language: ${langCode}`);
      
      // Fetch the messages file for the specified language
      const url = chrome.runtime.getURL(`_locales/${langCode}/messages.json`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load strings for ${langCode}: ${response.status}`);
      }
      
      const messages = await response.json();
      localizedStrings[langCode] = messages;
      
      Logger.info(`Successfully loaded ${Object.keys(messages).length} strings for ${langCode}`);
    } catch (error) {
      Logger.error(`Error loading localized strings for ${langCode}:`, error);
      
      // If failed and not English, try loading English as fallback
      if (langCode !== defaultLanguage && !localizedStrings[defaultLanguage]) {
        Logger.info(`Falling back to ${defaultLanguage} locale`);
        await loadLocalizedStrings(defaultLanguage);
      }
    }
  }
  
  /**
   * Get a localized message by key
   */
  function getLocalizedMessage(key, defaultText = '') {
    const currentLang = currentSettings.language;
    
    // Try current language
    if (localizedStrings[currentLang] && 
        localizedStrings[currentLang][key] && 
        localizedStrings[currentLang][key].message) {
      return localizedStrings[currentLang][key].message;
    }
    
    // Try default language if different from current
    if (currentLang !== defaultLanguage && 
        localizedStrings[defaultLanguage] && 
        localizedStrings[defaultLanguage][key] && 
        localizedStrings[defaultLanguage][key].message) {
      return localizedStrings[defaultLanguage][key].message;
    }
    
    // Fallback to Chrome's i18n API
    const chromeMessage = chrome.i18n.getMessage(key);
    if (chromeMessage) {
      return chromeMessage;
    }
    
    // Last resort: return default text
    return defaultText;
  }
  
  /**
   * Update UI with current settings
   */
  function updateUI() {
    // Update domain toggle
    domainToggle.checked = currentSettings.domainEnabled;
    domainToggle.disabled = isTrialOver && !isPremium;
    
    // Update press count
    pressCountEl.textContent = currentSettings.pressCount;
    
    // Update feedback toggle
    feedbackToggle.checked = currentSettings.showFeedback;
    
    // Update delay slider
    delaySlider.value = currentSettings.delay;
    
    // Make sure the delay is within the new range
    if (currentSettings.delay > 2000) {
      currentSettings.delay = 2000;
    }
    
    updateDelayLabel(currentSettings.delay);
    
    // Update trial/premium status
    if (isPremium) {
      document.getElementById('usage-label').textContent = getLocalizedMessage('premium_status', 'Premium activated');
      document.getElementById('usage-count').style.display = 'none';
    } else {
      const usageLabel = document.getElementById('usage-label');
      const usageCount = document.getElementById('usage-count');
      
      if (isTrialOver) {
        usageLabel.textContent = getLocalizedMessage('trialEndedLabel', 'Trial period is Over');
        usageLabel.style.color = '#f4511e';
        usageLabel.style.fontWeight = 'bold';
        usageCount.style.display = 'none';
      } else {
        // Use correct message key based on mode
        const messageKey = TEST_MODE ? 'usageLabelMinutes' : 'usageLabel';
        // Show fixed "Trial period:" text
        usageLabel.textContent = getLocalizedMessage('trialPeriodLabel', 'Trial period:');
        usageLabel.style.color = '';
        usageLabel.style.fontWeight = '';
        
        // Update the count display with number and units
        usageCount.textContent = `${trialDaysLeft} ${getLocalizedMessage(messageKey)}`;
        usageCount.style.display = 'inline';
      }
    }
    
    // Update UI availability based on domain enabled state and trial status
    updateUIAvailability();
  }
  
  /**
   * Update UI elements availability
   */
  function updateUIAvailability() {
    // Update settings availability based on domain enabled and trial status
    const settingsDisabled = !currentSettings.domainEnabled || (isTrialOver && !isPremium);
    
    decreaseCountBtn.disabled = settingsDisabled;
    increaseCountBtn.disabled = settingsDisabled;
    feedbackToggle.disabled = settingsDisabled;
    delaySlider.disabled = settingsDisabled;
    
    // Apply visual style for disabled elements
    document.querySelectorAll('.settings-preview').forEach(el => {
      if (settingsDisabled) {
        el.classList.add('disabled');
      } else {
        el.classList.remove('disabled');
      }
    });
  }
  
  /**
   * Updates the interface language
   */
  async function updateLanguage(langCode) {
    try {
      // Log language change attempt
      Logger.info(`Applying language change to: ${langCode}`);
      
      // Update current settings
      currentSettings.language = langCode;
      
      // Set HTML lang attribute
      document.documentElement.lang = langCode;
      
      // Set selected language in dropdown if it doesn't match
      if (languageSelect && languageSelect.value !== langCode) {
        languageSelect.value = langCode;
      }
      
      // Special handling for RTL languages like Arabic
      if (langCode === 'ar') {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
      
      // Ensure strings are loaded for this language
      await loadLocalizedStrings(langCode);
      
      // Update all text elements with localized strings
      updateElementText('language-label', 'languageLabel', 'Language:');
      updateElementText('premium-label', 'premiumLabel', 'Upgrade to Premium');
      updateElementText('usage-label', 'usageLabel', 'Trial period:');
      updateElementText('current-site-label', 'currentSiteLabel', 'Current site:');
      updateElementText('enable-for-site-label', 'enableForSiteLabel', 'Enable for this site');
      updateElementText('enter-presses-label', 'enterPressesLabel', 'Enter presses:');
      updateElementText('delay-label', 'delayLabel', 'Delay:');
      updateElementText('visual-feedback-label', 'visualFeedbackLabel', 'Visual feedback:');
      updateElementText('fast-label', 'fastLabel', 'Fast');
      updateElementText('normal-label', 'normalLabel', 'Normal');
      updateElementText('slow-label', 'slowLabel', 'Slow');
      
      // Update modal texts
      const modalTitle = document.querySelector('.modal-content h2');
      if (modalTitle) {
        modalTitle.textContent = getLocalizedMessage('limitReachedTitle', 'Usage Limit Reached');
      }
      
      const modalParagraphs = document.querySelectorAll('.modal-content p');
      if (modalParagraphs && modalParagraphs.length >= 2) {
        modalParagraphs[0].textContent = getLocalizedMessage('usageLimitText', 
          'You have used the free version of Triple Submit 20 times.');
        
        modalParagraphs[1].textContent = getLocalizedMessage('upgradeText', 
          'To continue using, please upgrade to the Premium version.');
      }
      
      const periodSpan = document.querySelector('.price-period');
      if (periodSpan) {
        periodSpan.textContent = getLocalizedMessage('perMonth', '/ month');
      }
      
      const payButtonEl = document.getElementById('pay-button');
      if (payButtonEl) {
        payButtonEl.textContent = getLocalizedMessage('payNowButton', 'Pay Now');
      }
      
      // Save the language setting to storage
      chrome.storage.sync.set({ language: langCode });
      
      Logger.info('Language updated successfully to:', langCode);
    } catch (error) {
      Logger.error('Error updating language:', error);
    }
  }
  
  /**
   * Helper function to update element text with localized message
   */
  function updateElementText(elementId, messageName, defaultText) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = getLocalizedMessage(messageName, defaultText);
    }
  }
  
  /**
   * Save settings
   */
  async function saveSettings() {
    try {
      // Check trial status before saving
      const canSave = await checkTrialStatus();
      if (!canSave) {
        Logger.warn('Cannot save settings - trial period ended');
        return;
      }
      
      // Определяем, является ли это переключением домена
      const isDomainToggle = currentDomain && currentSettings.domainEnabled !== undefined;
      
      // Save general settings
      await chrome.storage.sync.set({
        settings: {
          pressCount: currentSettings.pressCount,
          showFeedback: currentSettings.showFeedback,
          delay: currentSettings.delay
        },
        language: currentSettings.language
      });
      
      // Save domain-specific settings
      if (currentDomain) {
        const domainData = await chrome.storage.sync.get(['domains']);
        let domains = {};
        
        if (domainData && domainData.domains) {
          domains = domainData.domains;
        }
        
        // If enabled, add domain to list, otherwise remove it
        if (currentSettings.domainEnabled) {
          domains[currentDomain] = true;
        } else {
          delete domains[currentDomain];
        }
        
        // Save updated domains
        await chrome.storage.sync.set({ domains });
      }
      
      // Notify background script about settings update with confirmation callback
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'settings_updated',
          isToggle: isDomainToggle, // Флаг, что это переключение настроек (особенно важно при включении/выключении)
          forceActivation: true, // Всегда принудительно активируем обработчики
          timestamp: Date.now() // Добавляем временную метку для отслеживания
        }, (response) => {
          Logger.info('Settings update notification confirmed by background script:', response);
          Logger.info('Settings saved:', currentSettings);
          resolve(response);
        });
      });
    } catch (error) {
      Logger.error('Error saving settings:', error);
    }
  }
  
  /**
   * Update press count
   */
  function updatePressCount(change) {
    const newCount = currentSettings.pressCount + change;
    if (newCount >= 2 && newCount <= 5) {
      currentSettings.pressCount = newCount;
      pressCountEl.textContent = newCount;
      saveSettings();
    }
  }
  
  /**
   * Show Premium modal
   */
  function showPremiumModal() {
    premiumModal.style.display = 'block';
    
    // If trial is over, prevent closing the modal
    if (isTrialOver && !isPremium) {
      const closeBtn = document.querySelector('.close-modal');
      if (closeBtn) {
        closeBtn.style.display = 'none';
      }
      
      // Prevent clicking outside to close
      window.removeEventListener('click', handleModalOutsideClick);
    }
  }
  
  /**
   * Close Premium modal
   */
  function closePremiumModal() {
    premiumModal.style.display = 'none';
  }
  
  /**
   * Handle Premium payment
   */
  function handlePayment() {
    window.open('https://example.com/premium-payment', '_blank');
    closePremiumModal();
  }

  /**
   * Event handlers
   */
    
  // Toggle for enabling/disabling for current domain
  domainToggle.addEventListener('change', async function() {
    Logger.info('=== DOMAIN TOGGLE CHANGE START ===');
    
    // Check trial status before allowing changes
    Logger.info('Checking trial status before toggle...');
    const canChange = await checkTrialStatus();
    Logger.info('Trial status check result:', canChange);
    
    if (!canChange) {
      Logger.info('Cannot change - trial restrictions');
      this.checked = false;
      return;
    }
    
    const oldValue = currentSettings.domainEnabled;
    currentSettings.domainEnabled = this.checked;
    
    Logger.info(`Domain toggle changed from ${oldValue} to ${currentSettings.domainEnabled} for domain ${currentDomain}`);
    
    updateUIAvailability();
    await saveSettingsWithDomainToggle();
    
    Logger.info('=== DOMAIN TOGGLE CHANGE END ===');
  });
  
  // Функция для сохранения настроек с явным указанием, что это переключение домена
  async function saveSettingsWithDomainToggle() {
    try {
      // Get current domains list
      const data = await chrome.storage.sync.get(['domains']);
      const domains = data.domains || {};
      
      // If domain is enabled (toggle is on), remove it from disabled list
      // If domain is disabled (toggle is off), add it to disabled list
      if (currentSettings.domainEnabled) {
        delete domains[currentDomain];
      } else {
        domains[currentDomain] = false; // Explicitly disable domain
      }
      
      Logger.info(`Saving domain ${currentDomain} status: ${currentSettings.domainEnabled}`);
      
      // Save updated domains list
      await chrome.storage.sync.set({ domains: domains });
      
      // Save other settings
      await chrome.storage.sync.set({ settings: currentSettings });
      
      // Notify background script about settings update
      chrome.runtime.sendMessage({ 
        action: 'settings_updated',
        isToggle: true
      });
      
      Logger.info('Settings saved successfully');
    } catch (error) {
      Logger.error('Error saving settings:', error);
    }
  }
  
  // Press count control
  decreaseCountBtn.addEventListener('click', function() {
    updatePressCount(-1);
  });
  
  increaseCountBtn.addEventListener('click', function() {
    updatePressCount(1);
  });
  
  // Toggle for visual feedback
  feedbackToggle.addEventListener('change', function() {
    currentSettings.showFeedback = this.checked;
    saveSettings();
  });
  
  // Delay slider
  delaySlider.addEventListener('input', function() {
    const value = parseInt(this.value);
    currentSettings.delay = value;
    
    // Update visual indicator for which speed is selected
    updateDelayLabel(value);
  });
  
  delaySlider.addEventListener('change', function() {
    saveSettings();
  });
  
  // Language selector
  languageSelect.addEventListener('change', function() {
    const selectedLang = this.value;
    Logger.info(`Language changed to: ${selectedLang}`);
    currentSettings.language = selectedLang;
    updateLanguage(selectedLang);
    saveSettings();
  });
  
  // Premium modal handlers
  premiumBanner.addEventListener('click', function() {
    showPremiumModal();
  });
  
  closeModalBtn.addEventListener('click', function() {
        closePremiumModal();
  });
  
  payButton.addEventListener('click', function() {
    handlePayment();
  });
  
  // Close modal when clicking outside content
  window.addEventListener('click', function(event) {
    if (event.target === premiumModal) {
      closePremiumModal();
    }
  });
  
  /**
   * Updates the visual indication of which delay label is active
   */
  function updateDelayLabel(value) {
    const fastLabel = document.getElementById('fast-label');
    const normalLabel = document.getElementById('normal-label');
    const slowLabel = document.getElementById('slow-label');
    
    // Reset all labels to default style
    fastLabel.classList.remove('active');
    normalLabel.classList.remove('active');
    slowLabel.classList.remove('active');
    
    // Determine which label to highlight based on value
    if (value <= delayLabels.fast.max) {
      fastLabel.classList.add('active');
    } else if (value <= delayLabels.normal.max) {
      normalLabel.classList.add('active');
    } else {
      slowLabel.classList.add('active');
    }
  }
  
  // Update modal outside click handler
  function handleModalOutsideClick(event) {
    if (event.target === premiumModal && (!isTrialOver || isPremium)) {
      closePremiumModal();
    }
  }
  
  // Update event listener for outside clicks
  window.addEventListener('click', handleModalOutsideClick);
  
  // Clean up when popup is closed
  window.addEventListener('unload', () => {
    stopPeriodicUpdates();
  });
  
  // Initialize popup
  initPopup();
}); 