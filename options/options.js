// Options page script for Triple Submit extension

// DOM elements
const themeSwitchEl = document.getElementById('theme-switch');
const extensionToggleEl = document.getElementById('extension-toggle');
const modeSelectEl = document.getElementById('mode-select');
const pressCountEl = document.getElementById('press-count');
const decreaseCountEl = document.getElementById('decrease-count');
const increaseCountEl = document.getElementById('increase-count');
const timeWindowEl = document.getElementById('time-window');
const feedbackToggleEl = document.getElementById('feedback-toggle');
const domainModeSelectEl = document.getElementById('domain-mode-select');
const domainInputEl = document.getElementById('domain-input');
const addDomainButtonEl = document.getElementById('add-domain-button');
const domainListEl = document.getElementById('domain-list');
const domainListTitleEl = document.getElementById('domain-list-title');
const upgradeButtonEl = document.getElementById('upgrade-button');
const resetButtonEl = document.getElementById('reset-button');
const saveButtonEl = document.getElementById('save-button');
const statusMessageEl = document.getElementById('status-message');

// Default settings
const DEFAULT_SETTINGS = {
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

// Current settings
let currentSettings = { ...DEFAULT_SETTINGS };
let hasChanges = false;

// Initialize options page
async function initOptions() {
  await loadSettings();
  applyTheme();
  populateDomainList();
  attachEventListeners();
}

// Load current settings
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get('settings');
    currentSettings = data.settings || { ...DEFAULT_SETTINGS };
    
    // Apply settings to UI
    extensionToggleEl.checked = currentSettings.isEnabled;
    modeSelectEl.value = currentSettings.mode;
    pressCountEl.value = currentSettings.pressCount;
    timeWindowEl.value = currentSettings.timeWindow;
    feedbackToggleEl.checked = currentSettings.visualFeedback;
    domainModeSelectEl.value = currentSettings.domains.mode;
    themeSwitchEl.checked = currentSettings.theme === 'dark';
    
    domainListTitleEl.textContent = currentSettings.domains.mode === 'whitelist' ? 'Whitelist' : 'Blacklist';
    
    hasChanges = false;
    updateSaveButton();
    
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatusMessage('Error loading settings', 'error');
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

// Populate domain list
function populateDomainList() {
  domainListEl.innerHTML = '';
  
  const domainList = currentSettings.domains.mode === 'whitelist' 
    ? currentSettings.domains.whitelist 
    : currentSettings.domains.blacklist;
  
  if (domainList.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'domain-item empty';
    emptyMessage.textContent = `No domains in ${currentSettings.domains.mode}`;
    domainListEl.appendChild(emptyMessage);
    return;
  }
  
  domainList.forEach(domain => {
    const domainItem = document.createElement('div');
    domainItem.className = 'domain-item';
    
    const domainText = document.createElement('span');
    domainText.textContent = domain;
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-domain';
    removeButton.textContent = '✕';
    removeButton.setAttribute('data-domain', domain);
    removeButton.addEventListener('click', () => removeDomain(domain));
    
    domainItem.appendChild(domainText);
    domainItem.appendChild(removeButton);
    domainListEl.appendChild(domainItem);
  });
}

// Add domain to list
function addDomain() {
  const domain = domainInputEl.value.trim().toLowerCase();
  
  if (!domain) {
    showStatusMessage('Please enter a domain', 'error');
    return;
  }
  
  // Validate domain format
  if (!isValidDomain(domain)) {
    showStatusMessage('Please enter a valid domain', 'error');
    return;
  }
  
  const listType = currentSettings.domains.mode;
  const domainList = listType === 'whitelist' 
    ? currentSettings.domains.whitelist 
    : currentSettings.domains.blacklist;
  
  // Check if domain already exists
  if (domainList.includes(domain)) {
    showStatusMessage(`Domain already exists in ${listType}`, 'error');
    return;
  }
  
  // Add domain to the appropriate list
  if (listType === 'whitelist') {
    currentSettings.domains.whitelist.push(domain);
  } else {
    currentSettings.domains.blacklist.push(domain);
  }
  
  // Clear input
  domainInputEl.value = '';
  
  // Update UI
  populateDomainList();
  
  // Mark as changed
  hasChanges = true;
  updateSaveButton();
  
  showStatusMessage(`Domain added to ${listType}`, 'success');
}

// Remove domain from list
function removeDomain(domain) {
  const listType = currentSettings.domains.mode;
  
  if (listType === 'whitelist') {
    currentSettings.domains.whitelist = currentSettings.domains.whitelist.filter(d => d !== domain);
  } else {
    currentSettings.domains.blacklist = currentSettings.domains.blacklist.filter(d => d !== domain);
  }
  
  // Update UI
  populateDomainList();
  
  // Mark as changed
  hasChanges = true;
  updateSaveButton();
  
  showStatusMessage(`Domain removed from ${listType}`, 'success');
}

// Validate domain format
function isValidDomain(domain) {
  // Simple domain validation regex
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
  return domainRegex.test(domain);
}

// Save settings
async function saveSettings() {
  try {
    await chrome.storage.local.set({ settings: currentSettings });
    
    // Show success message
    showStatusMessage('Settings saved successfully', 'success');
    
    // Notify content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' });
      });
    });
    
    hasChanges = false;
    updateSaveButton();
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatusMessage('Error saving settings', 'error');
  }
}

// Reset settings to default
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    currentSettings = { ...DEFAULT_SETTINGS };
    
    // Apply settings to UI
    extensionToggleEl.checked = currentSettings.isEnabled;
    modeSelectEl.value = currentSettings.mode;
    pressCountEl.value = currentSettings.pressCount;
    timeWindowEl.value = currentSettings.timeWindow;
    feedbackToggleEl.checked = currentSettings.visualFeedback;
    domainModeSelectEl.value = currentSettings.domains.mode;
    themeSwitchEl.checked = currentSettings.theme === 'dark';
    
    domainListTitleEl.textContent = 'Whitelist';
    
    applyTheme();
    populateDomainList();
    
    hasChanges = true;
    updateSaveButton();
    
    showStatusMessage('Settings reset to default', 'success');
  }
}

// Show status message
function showStatusMessage(message, type = 'success') {
  statusMessageEl.textContent = message;
  statusMessageEl.className = `status-message ${type}`;
  
  // Clear after 3 seconds
  setTimeout(() => {
    statusMessageEl.textContent = '';
    statusMessageEl.className = 'status-message';
  }, 3000);
}

// Update save button state
function updateSaveButton() {
  saveButtonEl.disabled = !hasChanges;
  saveButtonEl.style.opacity = hasChanges ? '1' : '0.5';
}

// Attach event listeners
function attachEventListeners() {
  // Theme toggle
  themeSwitchEl.addEventListener('change', () => {
    currentSettings.theme = themeSwitchEl.checked ? 'dark' : 'light';
    applyTheme();
    hasChanges = true;
    updateSaveButton();
  });
  
  // Extension toggle
  extensionToggleEl.addEventListener('change', () => {
    currentSettings.isEnabled = extensionToggleEl.checked;
    hasChanges = true;
    updateSaveButton();
  });
  
  // Mode select
  modeSelectEl.addEventListener('change', () => {
    currentSettings.mode = modeSelectEl.value;
    hasChanges = true;
    updateSaveButton();
  });
  
  // Press count
  pressCountEl.addEventListener('change', () => {
    let value = parseInt(pressCountEl.value);
    
    // Validate range
    if (value < 1) value = 1;
    if (value > 5) value = 5;
    
    pressCountEl.value = value;
    currentSettings.pressCount = value;
    hasChanges = true;
    updateSaveButton();
  });
  
  // Decrease press count
  decreaseCountEl.addEventListener('click', () => {
    let value = parseInt(pressCountEl.value);
    if (value > 1) {
      value--;
      pressCountEl.value = value;
      currentSettings.pressCount = value;
      hasChanges = true;
      updateSaveButton();
    }
  });
  
  // Increase press count
  increaseCountEl.addEventListener('click', () => {
    let value = parseInt(pressCountEl.value);
    if (value < 5) {
      value++;
      pressCountEl.value = value;
      currentSettings.pressCount = value;
      hasChanges = true;
      updateSaveButton();
    }
  });
  
  // Time window
  timeWindowEl.addEventListener('change', () => {
    let value = parseInt(timeWindowEl.value);
    
    // Validate range
    if (value < 500) value = 500;
    if (value > 5000) value = 5000;
    
    timeWindowEl.value = value;
    currentSettings.timeWindow = value;
    hasChanges = true;
    updateSaveButton();
  });
  
  // Visual feedback toggle
  feedbackToggleEl.addEventListener('change', () => {
    currentSettings.visualFeedback = feedbackToggleEl.checked;
    hasChanges = true;
    updateSaveButton();
  });
  
  // Domain mode select
  domainModeSelectEl.addEventListener('change', () => {
    currentSettings.domains.mode = domainModeSelectEl.value;
    domainListTitleEl.textContent = currentSettings.domains.mode === 'whitelist' ? 'Whitelist' : 'Blacklist';
    populateDomainList();
    hasChanges = true;
    updateSaveButton();
  });
  
  // Add domain button
  addDomainButtonEl.addEventListener('click', addDomain);
  
  // Domain input enter key
  domainInputEl.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      addDomain();
    }
  });
  
  // Upgrade button
  upgradeButtonEl.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://example.com/triple-submit-premium' });
  });
  
  // Reset button
  resetButtonEl.addEventListener('click', resetSettings);
  
  // Save button
  saveButtonEl.addEventListener('click', saveSettings);
}

// Initialize the options page
document.addEventListener('DOMContentLoaded', initOptions); 