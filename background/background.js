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

// Initialize extension when installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First time installation
    Logger.info('Extension installed for the first time');
    
    // Initialize default settings
    const defaultSettings = {
      domainEnabled: false,  // Each site should be enabled individually
      pressCount: 3,        // Default required press count
      showFeedback: true,   // Visual feedback enabled by default
      delay: 600           // Default delay between presses (ms) - Normal
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
                             data.settings.delay === undefined ||
                             data.settings.enabled !== undefined);
      
      if (needsMigration) {
        Logger.info('Migrating settings from older version');
        
        const migratedSettings = {
          domainEnabled: data.settings.domainEnabled !== undefined ? data.settings.domainEnabled : false,
          pressCount: data.settings.pressCount !== undefined ? data.settings.pressCount : 3,
          showFeedback: data.settings.showFeedback !== undefined ? data.settings.showFeedback : true,
          delay: data.settings.delay !== undefined ? data.settings.delay : 600
        };
        
        // Remove old fields
        if (migratedSettings.mode !== undefined) delete migratedSettings.mode;
        if (migratedSettings.enabled !== undefined) delete migratedSettings.enabled;
        
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
        
      case 'settings_updated':
        Logger.info('Received settings update notification from popup', message);
        
        // Если это переключение настроек, сначала обновляем активную вкладку
        if (message.isToggle) {
          Logger.info('This is a toggle update, prioritizing active tab');
          
          // Сначала обновляем активную вкладку
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs && tabs.length > 0) {
              const activeTab = tabs[0];
              
              // Получаем настройки для активной вкладки
              chrome.storage.sync.get(['settings', 'domains'], (data) => {
                if (chrome.runtime.lastError) {
                  Logger.error('Error getting settings for active tab:', chrome.runtime.lastError);
                  return;
                }
                
                const settings = data.settings || {
                  domainEnabled: false,
                  pressCount: 3,
                  showFeedback: true,
                  delay: 600,
                  mode: 'normal' // Добавляем режим по умолчанию
                };
                
                try {
                  if (activeTab.url && activeTab.url.startsWith('http')) {
                    const hostname = new URL(activeTab.url).hostname;
                    const domains = data.domains || {};
                    const domainEnabled = domains[hostname] === true;
                    
                    Logger.info(`Sending priority update to active tab (${hostname}), domainEnabled=${domainEnabled}`);
                    
                    // Отправляем обновленные настройки в активную вкладку с флагом forceActivation
                    chrome.tabs.sendMessage(activeTab.id, { 
                      action: 'settingsUpdated',
                      settings: settings,
                      domainEnabled: domainEnabled,
                      isPriorityUpdate: true,
                      forceActivation: true, // Новый флаг для принудительной активации
                      timestamp: Date.now() // Добавляем временную метку для отслеживания
                    }).then(() => {
                      Logger.info('Priority update sent to active tab');
                      
                      // Затем обновляем остальные вкладки
                      setTimeout(() => {
                        notifyAllTabsAboutSettingsUpdate(sendResponse);
                      }, 100);
                    }).catch((error) => {
                      Logger.error('Error sending priority update to active tab:', error);
                      // Если не удалось отправить в активную вкладку, обновляем все вкладки
                      notifyAllTabsAboutSettingsUpdate(sendResponse);
                    });
                  } else {
                    // Если активная вкладка не HTTP, обновляем все вкладки
                    notifyAllTabsAboutSettingsUpdate(sendResponse);
                  }
                } catch (error) {
                  Logger.error('Error processing active tab for priority update:', error);
                  notifyAllTabsAboutSettingsUpdate(sendResponse);
                }
              });
            } else {
              // Если нет активной вкладки, обновляем все вкладки
              notifyAllTabsAboutSettingsUpdate(sendResponse);
            }
          });
        } else {
          // Обычное обновление всех вкладок
          notifyAllTabsAboutSettingsUpdate(sendResponse);
        }
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
      domainEnabled: false,
      pressCount: 3,
      showFeedback: true,
      delay: 600,
      mode: 'normal' // Добавляем режим по умолчанию
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

// Улучшенная функция для отправки полных обновленных настроек во все вкладки
function notifyAllTabsAboutSettingsUpdate(sendResponse) {
  // Получаем текущие настройки перед отправкой
  chrome.storage.sync.get(['settings', 'domains'], (data) => {
    if (chrome.runtime.lastError) {
      Logger.error('Error getting settings for notification:', chrome.runtime.lastError);
      if (sendResponse) sendResponse({ error: chrome.runtime.lastError.message });
      return;
    }
    
    const settings = data.settings || {
      domainEnabled: false,
      pressCount: 3,
      showFeedback: true,
      delay: 600,
      mode: 'normal' // Добавляем режим по умолчанию
    };
    
    Logger.info('Sending updated settings to all tabs:', settings);
    
    // Отправляем обновленные настройки во все вкладки
    chrome.tabs.query({}, (tabs) => {
      let updatePromises = [];
      
      tabs.forEach((tab) => {
        if (tab.url && tab.url.startsWith('http')) {
          try {
            const hostname = new URL(tab.url).hostname;
            // Проверяем, включено ли расширение для данного домена
            const domains = data.domains || {};
            const domainEnabled = domains[hostname] === true;
            
            // Отправляем обновленные настройки и статус для домена
            updatePromises.push(
              chrome.tabs.sendMessage(tab.id, { 
                action: 'settingsUpdated',
                settings: settings,
                domainEnabled: domainEnabled,
                forceActivation: true, // Добавляем флаг для принудительной активации
                timestamp: Date.now() // Добавляем временную метку для отслеживания
              }).catch((error) => {
                Logger.warn(`Error sending settings update to tab ${tab.id}:`, error);
                // Игнорируем ошибки при отправке сообщений, поскольку не все вкладки могут быть готовы
              })
            );
          } catch (error) {
            Logger.warn(`Error processing tab ${tab.id} for settings update:`, error);
          }
        }
      });
      
      // Отвечаем, когда все сообщения отправлены (или попытались отправить)
      Promise.allSettled(updatePromises).then(() => {
        Logger.info('Finished sending settings updates to all tabs');
        if (sendResponse) sendResponse({ success: true });
      });
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
        let isEnabled = settings.domainEnabled;
        
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
          isEnabled = settings.domainEnabled && !isBlacklisted;
        }
        
        // Обновляем иконку
        updateIcon(isEnabled);
      });
    } catch (error) {
      console.error('Error processing tab update:', error);
    }
  }
}); 