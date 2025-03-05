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

document.addEventListener('DOMContentLoaded', function() {
  // Main UI elements
  const extensionToggle = document.getElementById('extension-toggle');
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
  const delayValue = document.getElementById('delay-value');
  const languageSelect = document.getElementById('language-select');
  
  // Current settings and state
  let currentDomain = '';
  let currentSettings = {
    enabled: true,
    domainEnabled: false,
    pressCount: 3,
    showFeedback: true,
    delay: 200,
    language: 'en'
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
      
      // Update UI
      updateUI();
      
      // Set up language
      updateLanguage(currentSettings.language);
      
    } catch (error) {
      Logger.error('Error initializing popup:', error);
    }
  }
  
  /**
   * Update UI based on current settings
   */
  function updateUI() {
    // Update main toggles
    extensionToggle.checked = currentSettings.enabled;
    domainToggle.checked = currentSettings.domainEnabled;
    feedbackToggle.checked = currentSettings.showFeedback;
    
    // Update press count
    pressCountEl.textContent = currentSettings.pressCount;
    
    // Update delay slider
    delaySlider.value = currentSettings.delay;
    delayValue.textContent = currentSettings.delay;
    
    // Update language selector
    if (languageSelect) {
      languageSelect.value = currentSettings.language;
    }
    
    // Update usage counter
    if (isPremium) {
      usageCountEl.textContent = "∞";
      usageCountEl.style.color = "var(--accent-color)";
    } else {
      usageCountEl.textContent = (20 - usageCount);
      
      // If few uses left, change color
      if (usageCount >= 15) {
        usageCountEl.style.color = "#ff3b30";
      }
    }
    
    // Update UI availability based on status
    updateUIAvailability();
  }
  
  /**
   * Update UI elements availability
   */
  function updateUIAvailability() {
    const domainControlsDisabled = !currentSettings.enabled;
    
    // Enable/disable domain controls
    domainToggle.disabled = domainControlsDisabled;
    
    // Apply visual style for disabled elements
    document.querySelectorAll('.domain-control, .domain-toggle').forEach(el => {
      if (domainControlsDisabled) {
        el.classList.add('disabled');
      } else {
        el.classList.remove('disabled');
      }
    });
    
    // Update settings availability based on domain enabled
    const settingsDisabled = !currentSettings.enabled || !currentSettings.domainEnabled;
    
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
  function updateLanguage(langCode) {
    // Set HTML lang attribute for RTL languages
    document.documentElement.lang = langCode;
    
    // Special handling for RTL languages like Arabic
    if (langCode === 'ar') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
    
    // Update text content based on selected language
    try {
      chrome.i18n.getAcceptLanguages(function(languages) {
        Logger.info(`Browser languages: ${languages.join(', ')}`);
      });
      
      // Use i18n API to get localized strings
      const elements = {
        'language-label': chrome.i18n.getMessage('languageLabel') || 'Language:',
        'premium-label': chrome.i18n.getMessage('premiumLabel') || 'Upgrade to Premium',
        'usage-label': chrome.i18n.getMessage('usageLabel') || 'Free submissions left:',
        'enable-extension-label': chrome.i18n.getMessage('enableExtensionLabel') || 'Enable Triple Submit',
        'current-site-label': chrome.i18n.getMessage('currentSiteLabel') || 'Current site:',
        'enable-for-site-label': chrome.i18n.getMessage('enableForSiteLabel') || 'Enable for this site',
        'enter-presses-label': chrome.i18n.getMessage('enterPressesLabel') || 'Enter presses:',
        'delay-label': chrome.i18n.getMessage('delayLabel') || 'Delay (ms):',
        'visual-feedback-label': chrome.i18n.getMessage('visualFeedbackLabel') || 'Visual feedback:'
      };
      
      // Update all localized elements
      for (const [id, text] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = text;
        }
      }
      
      // Update modal texts
      const modalTitle = document.querySelector('.modal-content h2');
      if (modalTitle) {
        modalTitle.textContent = chrome.i18n.getMessage('limitReachedTitle') || 'Usage Limit Reached';
      }
      
      const modalParagraphs = document.querySelectorAll('.modal-content p');
      if (modalParagraphs && modalParagraphs.length >= 2) {
        modalParagraphs[0].textContent = chrome.i18n.getMessage('usageLimitText') || 
          'You have used the free version of Triple Submit 20 times.';
        
        modalParagraphs[1].textContent = chrome.i18n.getMessage('upgradeText') || 
          'To continue using, please upgrade to the Premium version.';
      }
      
      const periodSpan = document.querySelector('.price-period');
      if (periodSpan) {
        periodSpan.textContent = chrome.i18n.getMessage('perMonth') || '/ month';
      }
      
      const payButton = document.getElementById('pay-button');
      if (payButton) {
        payButton.textContent = chrome.i18n.getMessage('payNowButton') || 'Pay Now';
      }
      
    } catch (error) {
      Logger.error('Error updating language:', error);
    }
  }
  
  /**
   * Save settings
   */
  async function saveSettings() {
    try {
      // Save general settings
      await chrome.storage.sync.set({ 
        settings: currentSettings,
        language: currentSettings.language 
      });
      
      // Save domain setting
      if (currentDomain) {
        const domainData = await chrome.storage.sync.get(['domains']);
        let domains = domainData.domains || {};
        
        if (currentSettings.domainEnabled) {
          domains[currentDomain] = true;
        } else {
          delete domains[currentDomain];
        }
        
        await chrome.storage.sync.set({ domains: domains });
      }
      
      // Notify content scripts about changes
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'settingsUpdated',
            settings: currentSettings,
            domainEnabled: currentSettings.domainEnabled
          }).catch(error => {
            Logger.warn('Could not send settings update notification:', error);
          });
        }
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
  
  // Toggle for enabling/disabling extension
  extensionToggle.addEventListener('change', function() {
    currentSettings.enabled = this.checked;
    updateUIAvailability();
    saveSettings();
  });
  
  // Toggle for enabling/disabling for current domain
  domainToggle.addEventListener('change', function() {
    currentSettings.domainEnabled = this.checked;
    updateUIAvailability();
    saveSettings();
  });
  
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
    delayValue.textContent = value;
    currentSettings.delay = value;
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
  
  // Initialize popup
  initPopup();
}); 