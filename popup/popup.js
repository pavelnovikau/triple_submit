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
    language: 'en',
    mode: 'normal'
  };
  
  let isPremium = false;
  let usageCount = 20;
  
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
   * Initialize popup
   */
  async function initPopup() {
    try {
      // Get current domain
      await getCurrentTabDomain();
      
      // Display current domain
      if (currentDomainText) {
        currentDomainText.textContent = currentDomain || 'unknown';
      }
      
      // Get general settings
      const data = await chrome.storage.sync.get(['settings', 'language']);
      if (data && data.settings) {
        currentSettings = { ...currentSettings, ...data.settings };
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
      
      // Get Premium status and usage
      const usageData = await chrome.storage.sync.get(['isPremium', 'usageCount']);
      if (usageData) {
        isPremium = usageData.isPremium || false;
        usageCount = (usageData.usageCount !== undefined) ? usageData.usageCount : 20;
      }
      
      // Check domain status
      if (currentDomain) {
        const domainData = await chrome.storage.sync.get(['domains']);
        if (domainData && domainData.domains) {
          // Domain is disabled by default
          currentSettings.domainEnabled = false;
          
          // Check if domain is in enabled list
          if (domainData.domains[currentDomain]) {
            currentSettings.domainEnabled = true;
          }
        }
      }
      
      // Load localized strings first, then update UI
      await loadLocalizedStrings(currentSettings.language);
      
      // Update UI
      updateUI();
      
      // Apply language
      updateLanguage(currentSettings.language);
      
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
    
    // Update mode select
    const modeSelect = document.getElementById('mode-select');
    if (modeSelect) {
      modeSelect.value = currentSettings.mode || 'normal';
    }
    
    // Update usage count
    usageCountEl.textContent = usageCount;
    
    // Update UI availability based on domain enabled state
    updateUIAvailability();
  }
  
  /**
   * Update UI elements availability
   */
  function updateUIAvailability() {
    // Update settings availability based on domain enabled
    const settingsDisabled = !currentSettings.domainEnabled;
    
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
      updateElementText('usage-label', 'usageLabel', 'Free submissions left:');
      updateElementText('current-site-label', 'currentSiteLabel', 'Current site:');
      updateElementText('enable-for-site-label', 'enableForSiteLabel', 'Enable for this site');
      updateElementText('enter-presses-label', 'enterPressesLabel', 'Enter presses:');
      updateElementText('delay-label', 'delayLabel', 'Delay:');
      updateElementText('visual-feedback-label', 'visualFeedbackLabel', 'Visual feedback:');
      updateElementText('fast-label', 'fastLabel', 'Fast');
      updateElementText('normal-label', 'normalLabel', 'Normal');
      updateElementText('slow-label', 'slowLabel', 'Slow');
      
      // Обновляем тексты для режима
      updateElementText('mode-label', 'modeLabel', 'Mode:');
      
      // Обновляем опции селектора режима
      const modeNormalOption = document.getElementById('mode-normal-option');
      const mode3modeOption = document.getElementById('mode-3mode-option');
      
      if (modeNormalOption) {
        modeNormalOption.textContent = getLocalizedMessage('modeNormal', 'Multiple Enter');
      }
      
      if (mode3modeOption) {
        mode3modeOption.textContent = getLocalizedMessage('mode3mode', 'Always Line Break');
      }
      
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
      // Определяем, является ли это переключением домена
      const isDomainToggle = currentDomain && currentSettings.domainEnabled !== undefined;
      
      // Save general settings
      await chrome.storage.sync.set({
        settings: {
          pressCount: currentSettings.pressCount,
          showFeedback: currentSettings.showFeedback,
          delay: currentSettings.delay,
          mode: currentSettings.mode || 'normal'
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
  domainToggle.addEventListener('change', function() {
    const oldValue = currentSettings.domainEnabled;
    currentSettings.domainEnabled = this.checked;
    
    Logger.info(`Domain toggle changed from ${oldValue} to ${currentSettings.domainEnabled} for domain ${currentDomain}`);
    
    // Обновляем UI
    updateUIAvailability();
    
    // Сохраняем настройки с явным указанием, что это переключение домена
    saveSettingsWithDomainToggle();
  });
  
  // Функция для сохранения настроек с явным указанием, что это переключение домена
  async function saveSettingsWithDomainToggle() {
    try {
      // Save general settings
      await chrome.storage.sync.set({
        settings: {
          pressCount: currentSettings.pressCount,
          showFeedback: currentSettings.showFeedback,
          delay: currentSettings.delay,
          mode: currentSettings.mode || 'normal'
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
          isToggle: true, // Явно указываем, что это переключение домена
          isDomainToggle: true, // Дополнительный флаг для ясности
          forceActivation: true, // Принудительно активируем обработчики
          timestamp: Date.now(), // Временная метка для отслеживания
          domain: currentDomain, // Передаем текущий домен
          enabled: currentSettings.domainEnabled // Передаем новое состояние
        }, (response) => {
          Logger.info('Domain toggle update confirmed by background script:', response);
          Logger.info('Domain settings saved:', { domain: currentDomain, enabled: currentSettings.domainEnabled });
          resolve(response);
        });
      });
    } catch (error) {
      Logger.error('Error saving domain toggle settings:', error);
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
  
  // Mode select
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    modeSelect.addEventListener('change', function() {
      currentSettings.mode = this.value;
      Logger.info(`Mode changed to: ${currentSettings.mode}`);
      
      // Если выбран режим "3mode", скрываем настройку количества нажатий, так как она не используется
      const pressCountContainer = document.querySelector('.setting-item:has(#press-count)');
      if (pressCountContainer) {
        if (currentSettings.mode === '3mode') {
          pressCountContainer.style.display = 'none';
        } else {
          pressCountContainer.style.display = 'flex';
        }
      }
      
      saveSettings();
    });
  }
  
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
  
  // Initialize popup
  initPopup();
}); 