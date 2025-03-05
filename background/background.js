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

// Initialize extension settings
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error setting default settings:', chrome.runtime.lastError);
        return;
      }
      
      // Set default usage data
      chrome.storage.local.set({ usageData: DEFAULT_USAGE_DATA }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error setting default usage data:', chrome.runtime.lastError);
          return;
        }
        
        // Создаем пустой объект для доменов
        chrome.storage.sync.set({ domains: {} }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error setting default domains:', chrome.runtime.lastError);
            return;
          }
          
          console.log('Extension installed. Default settings applied.');
        });
      });
    });
  } else if (details.reason === 'update') {
    // При обновлении расширения можно обновить некоторые настройки
    chrome.storage.sync.get('settings', (data) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting settings during update:', chrome.runtime.lastError);
        return;
      }
      
      if (data.settings) {
        // Обновляем только те настройки, которые отсутствуют
        const updatedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
        chrome.storage.sync.set({ settings: updatedSettings }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error updating settings during update:', chrome.runtime.lastError);
            return;
          }
          
          console.log('Extension updated. Settings preserved and extended.');
        });
      } else {
        // Если настройки отсутствуют, устанавливаем значения по умолчанию
        chrome.storage.sync.set({ settings: DEFAULT_SETTINGS }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error setting default settings during update:', chrome.runtime.lastError);
            return;
          }
          
          console.log('Extension updated. Default settings applied.');
        });
      }
      
      // Проверяем наличие объекта domains
      chrome.storage.sync.get('domains', (domainsData) => {
        if (!domainsData.domains) {
          chrome.storage.sync.set({ domains: {} }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error setting default domains during update:', chrome.runtime.lastError);
              return;
            }
            console.log('Created empty domains object during update.');
          });
        }
      });
    });
  }
});

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

// Обработчик сообщений от content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('Background received message:', message.action);
    
    switch (message.action) {
      case 'getSettings':
        // Получаем настройки для передачи в content script
        chrome.storage.sync.get(['settings', 'isPremium'], (data) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting settings:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          
          // Проверяем и возвращаем настройки
          const settings = data.settings || DEFAULT_SETTINGS;
          
          // Добавляем информацию о Premium статусе
          settings.isPremium = data.isPremium || false;
          
          sendResponse({ settings: settings });
        });
        
        // Необходимо вернуть true, чтобы sendResponse работал асинхронно
        return true;
        
      case 'checkDomain':
        // Проверяем, разрешен ли домен
        const domain = message.domain;
        if (!domain) {
          sendResponse({ error: 'No domain provided' });
          return;
        }
        
        chrome.storage.sync.get(['domains', 'settings'], (data) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting domain data:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          
          const domains = data.domains || {};
          const settings = data.settings || DEFAULT_SETTINGS;
          
          // По умолчанию домен выключен
          let isEnabled = false;
          
          // Проверяем, включен ли домен в списке доменов
          if (domains[domain]) {
            isEnabled = true;
          }
          
          sendResponse({ isEnabled: isEnabled });
        });
        
        // Необходимо вернуть true, чтобы sendResponse работал асинхронно
        return true;
        
      case 'updateSettings':
        // Обновляем настройки
        const newSettings = message.settings;
        if (!newSettings) {
          sendResponse({ error: 'No settings provided' });
          return;
        }
        
        chrome.storage.sync.get('settings', (data) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting settings for update:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          
          // Объединяем существующие настройки с новыми
          const updatedSettings = { ...(data.settings || DEFAULT_SETTINGS), ...newSettings };
          
          chrome.storage.sync.set({ settings: updatedSettings }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error updating settings:', chrome.runtime.lastError);
              sendResponse({ error: chrome.runtime.lastError.message });
              return;
            }
            
            // Обновляем иконку, если необходимо
            if (newSettings.enabled !== undefined) {
              updateIcon(newSettings.enabled);
            }
            
            // Уведомляем все вкладки об обновлении настроек
            notifyTabsAboutSettingsUpdate();
            
            sendResponse({ success: true, settings: updatedSettings });
          });
        });
        
        // Необходимо вернуть true, чтобы sendResponse работал асинхронно
        return true;
        
      case 'updateDomain':
        // Обновляем настройки домена
        const domainToUpdate = message.domain;
        const enabled = message.enabled;
        
        if (!domainToUpdate) {
          sendResponse({ error: 'No domain provided for update' });
          return;
        }
        
        chrome.storage.sync.get('domains', (data) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting domains for update:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          
          let domains = data.domains || {};
          
          if (enabled) {
            domains[domainToUpdate] = true;
          } else {
            delete domains[domainToUpdate];
          }
          
          chrome.storage.sync.set({ domains: domains }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error updating domain:', chrome.runtime.lastError);
              sendResponse({ error: chrome.runtime.lastError.message });
              return;
            }
            
            // Уведомляем вкладки об обновлении настроек
            notifyTabsAboutSettingsUpdate();
            
            sendResponse({ success: true });
          });
        });
        
        // Необходимо вернуть true, чтобы sendResponse работал асинхронно
        return true;
        
      case 'incrementUsage':
        // Увеличиваем счетчик использования
        chrome.storage.local.get('usageData', (data) => {
          incrementUsageCount(data.usageData, (result) => {
            sendResponse(result);
          });
        });
        
        // Необходимо вернуть true, чтобы sendResponse работал асинхронно
        return true;
        
      case 'checkPremiumStatus':
        // Проверяем статус Premium
        chrome.storage.sync.get(['isPremium', 'premiumExpiry'], (data) => {
          if (chrome.runtime.lastError) {
            console.error('Error checking premium status:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          
          let isPremium = data.isPremium || false;
          
          // Проверяем срок действия Premium
          if (isPremium && data.premiumExpiry) {
            const now = new Date();
            const expiry = new Date(data.premiumExpiry);
            
            if (now > expiry) {
              // Premium истек
              isPremium = false;
              chrome.storage.sync.set({ isPremium: false }, () => {
                if (chrome.runtime.lastError) {
                  console.error('Error updating expired premium status:', chrome.runtime.lastError);
                }
              });
            }
          }
          
          sendResponse({ isPremium: isPremium });
        });
        
        // Необходимо вернуть true, чтобы sendResponse работал асинхронно
        return true;
        
      case 'activatePremium':
        // Активируем Premium (используется при покупке)
        const months = message.months || 1;
        
        // Вычисляем дату истечения
        const now = new Date();
        const expiry = new Date(now.setMonth(now.getMonth() + months));
        
        chrome.storage.sync.set({ 
          isPremium: true,
          premiumExpiry: expiry.toISOString(),
          premiumActivated: new Date().toISOString()
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Error activating premium:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          
          // Сбрасываем счетчик использования
          chrome.storage.local.set({ usageData: DEFAULT_USAGE_DATA }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error resetting usage data:', chrome.runtime.lastError);
            }
          });
          
          sendResponse({ success: true, premiumExpiry: expiry.toISOString() });
        });
        
        // Необходимо вернуть true, чтобы sendResponse работал асинхронно
        return true;
        
      default:
        console.warn('Unknown message action:', message.action);
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
});

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