// Default settings for the extension
const DEFAULT_SETTINGS = {
  isEnabled: true,
  mode: 'normal', // 'normal' or 'alternative'
  pressCount: 3,
  timeWindow: 200, // ms
  visualFeedback: true,
  domains: {
    whitelist: [],
    blacklist: [],
    mode: 'whitelist' // 'whitelist' or 'blacklist'
  },
  theme: 'light'
};

// Initialize extension settings
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // Set default settings on first install
    chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    
    // Open options page for initial setup
    chrome.runtime.openOptionsPage();
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    // Return current settings
    chrome.storage.local.get('settings', (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      sendResponse({ settings });
    });
    return true; // Indicates async response
  }
  
  if (message.action === 'updateSettings') {
    // Update settings
    chrome.storage.local.set({ settings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  }
  
  if (message.action === 'checkDomain') {
    // Check if current domain is enabled
    chrome.storage.local.get('settings', (data) => {
      const settings = data.settings || DEFAULT_SETTINGS;
      const { hostname } = new URL(sender.tab.url);
      
      let isEnabled = settings.isEnabled;
      
      // Check domain rules
      if (settings.domains.mode === 'whitelist') {
        isEnabled = isEnabled && settings.domains.whitelist.some(domain => 
          hostname === domain || hostname.endsWith('.' + domain));
      } else { // blacklist mode
        isEnabled = isEnabled && !settings.domains.blacklist.some(domain => 
          hostname === domain || hostname.endsWith('.' + domain));
      }
      
      // Get domain-specific settings
      const domainSettings = {
        isEnabled,
        mode: settings.mode,
        pressCount: settings.pressCount,
        timeWindow: settings.timeWindow,
        visualFeedback: settings.visualFeedback
      };
      
      sendResponse({ domainSettings });
    });
    return true; // Indicates async response
  }
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