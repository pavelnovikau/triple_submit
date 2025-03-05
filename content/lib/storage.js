// Storage utility for Triple Submit extension

// Default settings (same as in background.js)
const DEFAULT_SETTINGS = {
  isEnabled: true,
  mode: 'normal', // 'normal' or 'alternative'
  pressCount: 3,
  timeWindow: 2000, // ms
  visualFeedback: true,
  domains: {
    whitelist: [],
    blacklist: [],
    mode: 'whitelist' // 'whitelist' or 'blacklist'
  },
  theme: 'light'
};

/**
 * Get all extension settings
 * @returns {Promise<Object>} The settings object
 */
function getAllSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('settings', (data) => {
      resolve(data.settings || DEFAULT_SETTINGS);
    });
  });
}

/**
 * Update extension settings
 * @param {Object} newSettings - The new settings object or partial updates
 * @returns {Promise<Object>} The updated settings
 */
function updateSettings(newSettings) {
  return new Promise((resolve) => {
    getAllSettings().then((currentSettings) => {
      // Merge with current settings
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      // Deep merge for nested objects like domains
      if (newSettings.domains) {
        updatedSettings.domains = {
          ...currentSettings.domains,
          ...newSettings.domains
        };
      }
      
      // Save updated settings
      chrome.storage.local.set({ settings: updatedSettings }, () => {
        // Notify content scripts about the updated settings
        chrome.tabs.query({ active: true }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' });
          });
        });
        
        resolve(updatedSettings);
      });
    });
  });
}

/**
 * Add a domain to whitelist or blacklist
 * @param {string} domain - Domain to add
 * @param {string} listType - 'whitelist' or 'blacklist'
 * @returns {Promise<Object>} The updated settings
 */
function addDomainToList(domain, listType) {
  return new Promise((resolve) => {
    getAllSettings().then((settings) => {
      if (!settings.domains[listType].includes(domain)) {
        const domains = { ...settings.domains };
        domains[listType] = [...domains[listType], domain];
        
        updateSettings({ domains }).then(resolve);
      } else {
        resolve(settings);
      }
    });
  });
}

/**
 * Remove a domain from whitelist or blacklist
 * @param {string} domain - Domain to remove
 * @param {string} listType - 'whitelist' or 'blacklist'
 * @returns {Promise<Object>} The updated settings
 */
function removeDomainFromList(domain, listType) {
  return new Promise((resolve) => {
    getAllSettings().then((settings) => {
      const domains = { ...settings.domains };
      domains[listType] = domains[listType].filter(d => d !== domain);
      
      updateSettings({ domains }).then(resolve);
    });
  });
}

/**
 * Check if extension is enabled for current domain
 * @param {string} url - The URL to check
 * @returns {Promise<Object>} Object with isEnabled status and domain-specific settings
 */
function getDomainStatus(url) {
  return new Promise((resolve) => {
    getAllSettings().then((settings) => {
      const { hostname } = new URL(url);
      
      let isEnabled = settings.isEnabled;
      
      // Check domain rules
      if (settings.domains.mode === 'whitelist') {
        isEnabled = isEnabled && settings.domains.whitelist.some(domain => 
          hostname === domain || hostname.endsWith('.' + domain));
      } else { // blacklist mode
        isEnabled = isEnabled && !settings.domains.blacklist.some(domain => 
          hostname === domain || hostname.endsWith('.' + domain));
      }
      
      // Domain-specific settings
      const domainSettings = {
        isEnabled,
        mode: settings.mode,
        pressCount: settings.pressCount,
        timeWindow: settings.timeWindow,
        visualFeedback: settings.visualFeedback
      };
      
      resolve(domainSettings);
    });
  });
}

// Export functions for use in other scripts
window.tripleSubmitStorage = {
  getAllSettings,
  updateSettings,
  addDomainToList,
  removeDomainFromList,
  getDomainStatus
}; 