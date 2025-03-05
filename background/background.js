// Background script for Triple Submit Chrome Extension

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

// Default settings for the extension
const DEFAULT_SETTINGS = {
  enabled: true,
  pressCount: 3,
  showFeedback: true,
  delay: 200, // ms
  isPremium: false // Premium status
};

// Default usage data
const DEFAULT_USAGE_DATA = {
  count: 0,
  lastUpdated: new Date().toISOString()
};

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    Logger.info('Extension installed for the first time');
    
    // Initialize default settings
    const defaultSettings = {
      enabled: true,      // Extension enabled by default
      pressCount: 3,      // Default required press count
      showFeedback: true, // Visual feedback enabled by default
      delay: 200          // Default delay between presses (ms)
    };
    
    // Save default settings
    chrome.storage.sync.set({
      settings: defaultSettings,
      domains: {},           // No domains enabled by default
      isPremium: false,      // Default to free version
      usageCount: 0,         // Initial usage count
      language: 'en'         // Default language
    })
    .then(() => {
      Logger.info('Default settings initialized');
    })
    .catch((error) => {
      Logger.error('Error initializing settings:', error);
    });
    
  } else if (details.reason === 'update') {
    // Extension updated
    Logger.info(`Extension updated from ${details.previousVersion}`);
    
    // Migrate settings from previous versions if needed
    migrateSettings();
  }
});

// Migrate settings from previous versions
function migrateSettings() {
  try {
    chrome.storage.sync.get(['settings', 'domains', 'isPremium', 'usageCount'], (data) => {
      if (chrome.runtime.lastError) {
        Logger.error('Error getting settings for migration:', chrome.runtime.lastError);
        return;
      }
      
      const needsMigration = data && data.settings && 
                            (data.settings.mode !== undefined || 
                             data.settings.delay === undefined);
      
      if (needsMigration) {
        Logger.info('Migrating settings from older version');
        
        const migratedSettings = {
          enabled: data.settings.enabled !== undefined ? data.settings.enabled : true,
          pressCount: data.settings.pressCount !== undefined ? data.settings.pressCount : 3,
          showFeedback: data.settings.showFeedback !== undefined ? data.settings.showFeedback : true,
          delay: data.settings.delay !== undefined ? data.settings.delay : 200
        };
        
        // Remove old fields
        if (migratedSettings.mode !== undefined) delete migratedSettings.mode;
        
        // Save migrated settings
        chrome.storage.sync.set({
          settings: migratedSettings,
          language: data.language || 'en'
        })
        .then(() => {
          Logger.info('Settings migrated successfully', migratedSettings);
        })
        .catch((error) => {
          Logger.error('Error saving migrated settings:', error);
        });
      }
    });
  } catch (error) {
    Logger.error('Error during settings migration:', error);
  }
}

// Функция для увеличения счетчика использования
function incrementUsageCount(usageData, callback) {
  try {
    // Проверяем статус Premium
    chrome.storage.sync.get('isPremium', (premiumData) => {
      if (premiumData.isPremium) {
        if (callback) callback({ usageData: { count: 0, isPremium: true } });
        return;
      }
      
      // Используем переданные данные или значения по умолчанию
      let currentUsage = usageData || DEFAULT_USAGE_DATA;
      
      // Увеличиваем счетчик
      currentUsage.count += 1;
      currentUsage.lastUpdated = new Date().toISOString();
      
      // Сохраняем обновленные данные
      chrome.storage.local.set({ usageData: currentUsage }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving usage data:', chrome.runtime.lastError);
          if (callback) callback({ error: chrome.runtime.lastError.message });
        } else {
          console.log('Usage count updated:', currentUsage.count);
          if (callback) callback({ usageData: currentUsage });
        }
      });
    });
  } catch (error) {
    console.error('Error incrementing usage count:', error);
    if (callback) callback({ error: error.message });
  }
}

// Message handling from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Log incoming message for debugging
  Logger.debug('Message received:', message);
  
  try {
    switch (message.action) {
      case 'getSettings':
        handleGetSettings(sendResponse);
        break;
        
      case 'saveSettings':
        handleSaveSettings(message.settings, sendResponse);
        break;
        
      case 'checkDomain':
        handleCheckDomain(message.domain, sendResponse);
        break;
        
      case 'incrementUsage':
        handleIncrementUsage(sendResponse);
        break;
        
      case 'setPremium':
        handleSetPremium(message.isPremium, sendResponse);
        break;
        
      default:
        Logger.warn(`Unknown action: ${message.action}`);
        sendResponse({ error: `Unknown action: ${message.action}` });
    }
  } catch (error) {
    Logger.error('Error processing message:', error);
    sendResponse({ error: error.message });
  }
  
  // Return true to indicate we'll respond asynchronously
  return true;
});

// Handle getSettings request
function handleGetSettings(sendResponse) {
  chrome.storage.sync.get(['settings', 'isPremium'], (data) => {
    if (chrome.runtime.lastError) {
      Logger.error('Error getting settings:', chrome.runtime.lastError);
      sendResponse({ error: chrome.runtime.lastError.message });
      return;
    }
    
    // If settings don't exist yet, use defaults
    const settings = data.settings || {
      enabled: true,
      pressCount: 3,
      showFeedback: true,
      delay: 200
    };
    
    // Add premium status
    settings.isPremium = data.isPremium || false;
    
    Logger.info('Retrieved settings:', settings);
    sendResponse({ settings: settings });
  });
}

// Handle saveSettings request
function handleSaveSettings(newSettings, sendResponse) {
  Logger.info('Saving settings:', newSettings);
  
  chrome.storage.sync.set({ settings: newSettings })
    .then(() => {
      Logger.info('Settings saved successfully');
      sendResponse({ success: true });
    })
    .catch((error) => {
      Logger.error('Error saving settings:', error);
      sendResponse({ error: error.message });
    });
}

// Handle checkDomain request
function handleCheckDomain(domain, sendResponse) {
  if (!domain) {
    Logger.warn('Empty domain in checkDomain request');
    sendResponse({ isEnabled: false });
    return;
  }
  
  chrome.storage.sync.get(['domains'], (data) => {
    if (chrome.runtime.lastError) {
      Logger.error('Error checking domain:', chrome.runtime.lastError);
      sendResponse({ isEnabled: false });
      return;
    }
    
    // Check if domain is in enabled list
    const domains = data.domains || {};
    const isEnabled = domains[domain] === true;
    
    Logger.info(`Domain ${domain} enabled: ${isEnabled}`);
    sendResponse({ isEnabled: isEnabled });
  });
}

// Handle incrementUsage request
function handleIncrementUsage(sendResponse) {
  chrome.storage.sync.get(['usageCount', 'isPremium'], (data) => {
    if (chrome.runtime.lastError) {
      Logger.error('Error getting usage count:', chrome.runtime.lastError);
      sendResponse({ error: chrome.runtime.lastError.message });
      return;
    }
    
    // Bypass counting for premium users
    if (data.isPremium) {
      Logger.info('Premium user, not incrementing usage');
      sendResponse({ usageData: { count: 0, isPremium: true }});
      return;
    }
    
    // Increment usage count
    let count = data.usageCount || 0;
    count++;
    
    Logger.info(`Incrementing usage count to ${count}`);
    
    chrome.storage.sync.set({ usageCount: count })
      .then(() => {
        Logger.info('Usage count updated successfully');
        sendResponse({ 
          usageData: { 
            count: count, 
            isPremium: false 
          }
        });
      })
      .catch((error) => {
        Logger.error('Error saving usage count:', error);
        sendResponse({ error: error.message });
      });
  });
}

// Handle setPremium request
function handleSetPremium(isPremium, sendResponse) {
  Logger.info(`Setting premium status to: ${isPremium}`);
  
  chrome.storage.sync.set({ isPremium: isPremium })
    .then(() => {
      Logger.info('Premium status updated successfully');
      sendResponse({ success: true });
    })
    .catch((error) => {
      Logger.error('Error setting premium status:', error);
      sendResponse({ error: error.message });
    });
}

// Функция для обновления иконки расширения
function updateIcon(enabled) {
  const path = enabled ? {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png'
  } : {
    16: 'icons/icon16_disabled.png',
    48: 'icons/icon48_disabled.png',
    128: 'icons/icon128_disabled.png'
  };
  
  chrome.action.setIcon({ path: path });
}

// Функция для уведомления вкладок об обновлении настроек
function notifyTabsAboutSettingsUpdate() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url && tab.url.startsWith('http')) {
        chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' })
          .catch((error) => {
            console.log(`Error sending message to tab ${tab.id}:`, error);
          });
      }
    });
  });
}

// Listen for tab updates to update icon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Получаем текущие настройки
      chrome.storage.sync.get('settings', (data) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting settings:', chrome.runtime.lastError);
          return;
        }
        
        const settings = data.settings || DEFAULT_SETTINGS;
        const hostname = new URL(tab.url).hostname;
        
        // Проверяем правила доменов
        let isEnabled = settings.enabled;
        
        if (settings.domainMode === 'whitelist') {
          // В режиме белого списка: включено только если домен в списке
          isEnabled = settings.whitelist.some(whitelistedDomain => 
            hostname.includes(whitelistedDomain)
          );
        } else if (settings.domainMode === 'blacklist') {
          // В режиме черного списка: выключено если домен в списке
          const isBlacklisted = settings.blacklist.some(blacklistedDomain => 
            hostname.includes(blacklistedDomain)
          );
          isEnabled = settings.enabled && !isBlacklisted;
        }
        
        // Обновляем иконку
        updateIcon(isEnabled);
      });
    } catch (error) {
      console.error('Error processing tab update:', error);
    }
  }
}); 