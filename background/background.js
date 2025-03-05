// Default settings for the extension
const DEFAULT_SETTINGS = {
  enabled: true,
  pressCount: 3,
  visualFeedback: true,
  mode: 'normal', // 'normal' or 'alternative'
  timeWindow: 200, // ms
  blacklist: [],
  whitelist: [],
  blacklistMode: true,
  isPremium: false // Premium status
};

// Default usage data
const DEFAULT_USAGE_DATA = {
  count: 0,
  lastUpdated: new Date().toISOString()
};

// Initialize extension settings
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    
    // Set default usage data
    await chrome.storage.local.set({ usageData: DEFAULT_USAGE_DATA });
    
    console.log('Extension installed. Default settings applied.');
  } else if (details.reason === 'update') {
    // При обновлении расширения можно обновить некоторые настройки
    const data = await chrome.storage.sync.get('settings');
    if (data.settings) {
      // Обновляем только те настройки, которые отсутствуют
      const updatedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
      await chrome.storage.sync.set({ settings: updatedSettings });
    }
    console.log('Extension updated. Settings preserved and extended.');
  }
});

// Function to increment usage count
async function incrementUsageCount() {
  try {
    // Получаем текущие настройки
    const settingsData = await chrome.storage.sync.get('settings');
    const settings = settingsData.settings || DEFAULT_SETTINGS;
    
    // Если пользователь Premium, не увеличиваем счетчик
    if (settings.isPremium) {
      return { usageData: { count: 0, lastUpdated: new Date().toISOString() } };
    }
    
    // Получаем текущие данные об использовании
    const usageData = await chrome.storage.local.get('usageData');
    let currentUsage = usageData.usageData || DEFAULT_USAGE_DATA;
    
    // Увеличиваем счетчик
    currentUsage.count += 1;
    currentUsage.lastUpdated = new Date().toISOString();
    
    // Сохраняем обновленные данные
    await chrome.storage.local.set({ usageData: currentUsage });
    
    return { usageData: currentUsage };
  } catch (error) {
    console.error('Error incrementing usage count:', error);
    return { error: 'Failed to increment usage count' };
  }
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'getSettings') {
        // Получаем настройки
        const data = await chrome.storage.sync.get('settings');
        const settings = data.settings || DEFAULT_SETTINGS;
        sendResponse({ settings });
      } else if (message.action === 'updateSettings') {
        // Обновляем настройки
        const data = await chrome.storage.sync.get('settings');
        const currentSettings = data.settings || DEFAULT_SETTINGS;
        const updatedSettings = { ...currentSettings, ...message.updates };
        
        await chrome.storage.sync.set({ settings: updatedSettings });
        
        // Обновляем иконку, если изменился статус enabled
        if (message.updates.hasOwnProperty('enabled')) {
          updateIcon(message.updates.enabled);
        }
        
        sendResponse({ success: true, settings: updatedSettings });
      } else if (message.action === 'checkDomain') {
        // Проверяем, находится ли домен в списке
        const domain = message.domain;
        const data = await chrome.storage.sync.get('settings');
        const settings = data.settings || DEFAULT_SETTINGS;
        
        let isEnabled = true;
        
        if (settings.blacklistMode) {
          // В режиме черного списка: включено, если домен НЕ в черном списке
          isEnabled = !settings.blacklist.includes(domain);
        } else {
          // В режиме белого списка: включено, только если домен в белом списке
          isEnabled = settings.whitelist.includes(domain);
        }
        
        sendResponse({ isEnabled });
      } else if (message.action === 'incrementUsage') {
        // Увеличиваем счетчик использования
        const result = await incrementUsageCount();
        sendResponse(result);
      } else if (message.action === 'getUsageData') {
        // Получаем данные об использовании
        const usageData = await chrome.storage.local.get('usageData');
        sendResponse({ usageData: usageData.usageData || DEFAULT_USAGE_DATA });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true; // Указываем, что ответ будет асинхронным
});

// Update extension icon based on enabled status
function updateIcon(isEnabled) {
  const iconPath = isEnabled ? 
    { 
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png'
    } : 
    {
      16: 'icons/icon16_disabled.png',
      48: 'icons/icon48_disabled.png',
      128: 'icons/icon128_disabled.png'
    };
  
  chrome.action.setIcon({ path: iconPath });
}

// Listen for tab updates to update icon
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.storage.local.get('settings', (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      const { hostname } = new URL(tab.url);
      
      let isEnabled = settings.isEnabled;
      
      // Check domain rules
      if (settings.domains.mode === 'whitelist') {
        isEnabled = isEnabled && settings.domains.whitelist.some(domain => 
          hostname === domain || hostname.endsWith('.' + domain));
      } else { // blacklist mode
        isEnabled = isEnabled && !settings.domains.blacklist.some(domain => 
          hostname === domain || hostname.endsWith('.' + domain));
      }
      
      updateIcon(isEnabled);
    });
  }
}); 