// Popup script for Triple Submit extension

// DOM elements
const themeSwitchEl = document.getElementById('theme-switch');
const extensionToggleEl = document.getElementById('extension-toggle');
const domainToggleEl = document.getElementById('domain-toggle');
const currentDomainTextEl = document.getElementById('current-domain-text');
const modeSelectEl = document.getElementById('mode-select');
const decreaseCountEl = document.getElementById('decrease-count');
const increaseCountEl = document.getElementById('increase-count');
const pressCountEl = document.getElementById('press-count');
const feedbackToggleEl = document.getElementById('feedback-toggle');
const optionsButtonEl = document.getElementById('options-button');
const premiumBannerEl = document.querySelector('.premium-banner');

let currentSettings = null;
let currentTabUrl = '';
let currentTabId = null;
let currentDomain = '';

// Initialize popup
async function initPopup() {
  // Get current tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return;
  
  const activeTab = tabs[0];
  currentTabUrl = activeTab.url;
  currentTabId = activeTab.id;
  
  try {
    // Extract domain from URL
    const url = new URL(currentTabUrl);
    currentDomain = url.hostname;
    currentDomainTextEl.textContent = currentDomain;
  } catch (error) {
    console.error('Error parsing URL:', error);
    currentDomain = '';
    currentDomainTextEl.textContent = 'N/A';
  }
  
  // Load settings
  await loadSettings();
  
  // Apply theme
  applyTheme();
  
  // Attach event listeners
  attachEventListeners();
}

// Load current settings
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get('settings');
    currentSettings = data.settings || {
      isEnabled: true,
      mode: 'normal',
      pressCount: 3,
      timeWindow: 2000,
      visualFeedback: true,
      domains: {
        whitelist: [],
        blacklist: [],
        mode: 'whitelist'
      },
      theme: 'light'
    };
    
    // Check domain status
    let isDomainEnabled = currentSettings.isEnabled;
    
    if (currentDomain) {
      if (currentSettings.domains.mode === 'whitelist') {
        isDomainEnabled = isDomainEnabled && currentSettings.domains.whitelist.some(domain => 
          currentDomain === domain || currentDomain.endsWith('.' + domain));
      } else { // blacklist mode
        isDomainEnabled = isDomainEnabled && !currentSettings.domains.blacklist.some(domain => 
          currentDomain === domain || currentDomain.endsWith('.' + domain));
      }
    }
    
    // Apply settings to UI
    extensionToggleEl.checked = currentSettings.isEnabled;
    domainToggleEl.checked = isDomainEnabled;
    modeSelectEl.value = currentSettings.mode;
    pressCountEl.textContent = currentSettings.pressCount;
    feedbackToggleEl.checked = currentSettings.visualFeedback;
    themeSwitchEl.checked = currentSettings.theme === 'dark';
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Apply theme
function applyTheme() {
  if (currentSettings.theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// Save settings
async function saveSettings(updates) {
  try {
    const updatedSettings = { ...currentSettings, ...updates };
    
    await chrome.storage.local.set({ settings: updatedSettings });
    currentSettings = updatedSettings;
    
    // Notify content script to update
    if (currentTabId) {
      await chrome.tabs.sendMessage(currentTabId, { action: 'settingsUpdated' });
    }
    
    // Update extension icon
    updateIcon();
    
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Update domain whitelist/blacklist
async function updateDomainList(domain, isEnabled) {
  try {
    // Don't proceed if no domain
    if (!domain) return;
    
    const domains = { ...currentSettings.domains };
    
    // Add or remove domain from the appropriate list
    if (domains.mode === 'whitelist') {
      if (isEnabled) {
        // Add to whitelist if not already present
        if (!domains.whitelist.includes(domain)) {
          domains.whitelist = [...domains.whitelist, domain];
        }
      } else {
        // Remove from whitelist
        domains.whitelist = domains.whitelist.filter(d => d !== domain);
      }
    } else { // blacklist mode
      if (isEnabled) {
        // Remove from blacklist
        domains.blacklist = domains.blacklist.filter(d => d !== domain);
      } else {
        // Add to blacklist if not already present
        if (!domains.blacklist.includes(domain)) {
          domains.blacklist = [...domains.blacklist, domain];
        }
      }
    }
    
    await saveSettings({ domains });
    
  } catch (error) {
    console.error('Error updating domain list:', error);
  }
}

// Update extension icon based on settings
async function updateIcon() {
  let isEnabled = currentSettings.isEnabled;
  
  if (currentDomain) {
    if (currentSettings.domains.mode === 'whitelist') {
      isEnabled = isEnabled && currentSettings.domains.whitelist.some(domain => 
        currentDomain === domain || currentDomain.endsWith('.' + domain));
    } else { // blacklist mode
      isEnabled = isEnabled && !currentSettings.domains.blacklist.some(domain => 
        currentDomain === domain || currentDomain.endsWith('.' + domain));
    }
  }
  
  // Use action API to update icon
  const iconPath = isEnabled ? 
    {
      16: '../icons/icon16.png',
      48: '../icons/icon48.png',
      128: '../icons/icon128.png'
    } : 
    {
      16: '../icons/icon16_disabled.png',
      48: '../icons/icon48_disabled.png',
      128: '../icons/icon128_disabled.png'
    };
  
  await chrome.action.setIcon({ path: iconPath });
}

// Attach event listeners
function attachEventListeners() {
  // Theme toggle
  themeSwitchEl.addEventListener('change', () => {
    const theme = themeSwitchEl.checked ? 'dark' : 'light';
    saveSettings({ theme });
    applyTheme();
  });
  
  // Extension toggle
  extensionToggleEl.addEventListener('change', () => {
    saveSettings({ isEnabled: extensionToggleEl.checked });
  });
  
  // Domain toggle
  domainToggleEl.addEventListener('change', () => {
    updateDomainList(currentDomain, domainToggleEl.checked);
  });
  
  // Mode select
  modeSelectEl.addEventListener('change', () => {
    saveSettings({ mode: modeSelectEl.value });
  });
  
  // Press count
  decreaseCountEl.addEventListener('click', () => {
    const currentCount = parseInt(pressCountEl.textContent);
    if (currentCount > 1) {
      const newCount = currentCount - 1;
      pressCountEl.textContent = newCount;
      saveSettings({ pressCount: newCount });
    }
  });
  
  increaseCountEl.addEventListener('click', () => {
    const currentCount = parseInt(pressCountEl.textContent);
    if (currentCount < 5) {
      const newCount = currentCount + 1;
      pressCountEl.textContent = newCount;
      saveSettings({ pressCount: newCount });
    }
  });
  
  // Visual feedback toggle
  feedbackToggleEl.addEventListener('change', () => {
    saveSettings({ visualFeedback: feedbackToggleEl.checked });
  });
  
  // Options button
  optionsButtonEl.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Premium banner
  premiumBannerEl.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://example.com/triple-submit-premium' });
  });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initPopup); 