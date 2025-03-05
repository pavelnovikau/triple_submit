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
function initOptions() {
  loadSettings().then(() => {
    applyTheme();
    populateDomainList();
    
    // Focus on domain input for better UX
    setTimeout(() => {
      domainInputEl.focus();
    }, 500);
  });
  
  // Add event listeners
  saveButtonEl.addEventListener('click', saveSettings);
  
  // Theme listener
  themeSwitchEl.addEventListener('change', () => {
    currentSettings.theme = themeSwitchEl.checked ? 'dark' : 'light';
    applyTheme();
    hasChanges = true;
    updateSaveButton();
  });
  
  // Extension toggle listener
  extensionToggleEl.addEventListener('change', () => {
    currentSettings.isEnabled = extensionToggleEl.checked;
    hasChanges = true;
    updateSaveButton();
  });
  
  // Mode select listener
  modeSelectEl.addEventListener('change', () => {
    currentSettings.mode = modeSelectEl.value;
    hasChanges = true;
    updateSaveButton();
  });
  
  // Press count listener
  pressCountEl.addEventListener('change', () => {
    const count = parseInt(pressCountEl.value);
    if (count >= 2 && count <= 10) {
      currentSettings.pressCount = count;
      hasChanges = true;
      updateSaveButton();
    }
  });
  
  // Time window listener
  timeWindowEl.addEventListener('change', () => {
    const time = parseInt(timeWindowEl.value);
    if (time >= 100 && time <= 5000) {
      currentSettings.timeWindow = time;
      hasChanges = true;
      updateSaveButton();
    }
  });
  
  // Visual feedback listener
  feedbackToggleEl.addEventListener('change', () => {
    currentSettings.visualFeedback = feedbackToggleEl.checked;
    hasChanges = true;
    updateSaveButton();
  });
  
  // Domain mode listener
  domainModeSelectEl.addEventListener('change', () => {
    console.log('Changing domain mode to:', domainModeSelectEl.value);
    console.log('Current settings before change:', JSON.stringify(currentSettings));
    
    // Make a deep copy of the settings
    const updatedSettings = JSON.parse(JSON.stringify(currentSettings));
    updatedSettings.domains.mode = domainModeSelectEl.value;
    
    // Update settings
    currentSettings = updatedSettings;
    console.log('Updated settings after mode change:', JSON.stringify(currentSettings));
    
    // Update the title
    domainListTitleEl.textContent = currentSettings.domains.mode === 'whitelist' ? 'Whitelist' : 'Blacklist';
    
    // Re-populate the list
    populateDomainList();
    
    hasChanges = true;
    updateSaveButton();
  });
  
  // Domain add listener
  addDomainButtonEl.addEventListener('click', addDomain);
  domainInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomain();
    }
  });
}

// Load current settings
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get('settings');
    console.log('Loaded settings from storage:', data);
    
    // Если настройки не найдены, используем значения по умолчанию
    if (!data.settings) {
      currentSettings = { ...DEFAULT_SETTINGS };
    } else {
      // Убедимся, что объект domains имеет правильную структуру
      const settings = data.settings;
      if (!settings.domains) {
        settings.domains = {
          whitelist: [],
          blacklist: [],
          mode: 'whitelist'
        };
      } else {
        // Убедимся, что все поля присутствуют
        settings.domains.whitelist = settings.domains.whitelist || [];
        settings.domains.blacklist = settings.domains.blacklist || [];
        settings.domains.mode = settings.domains.mode || 'whitelist';
      }
      
      currentSettings = settings;
    }
    
    console.log('Current settings after load:', currentSettings);
    console.log('Domain whitelist:', currentSettings.domains.whitelist);
    console.log('Domain blacklist:', currentSettings.domains.blacklist);
    
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
  
  const mode = currentSettings.domains.mode;
  const whiteList = currentSettings.domains.whitelist || [];
  const blackList = currentSettings.domains.blacklist || [];
  console.log('Domain list mode:', mode);
  console.log('Whitelist domains:', whiteList);
  console.log('Blacklist domains:', blackList);
  
  const list = mode === 'whitelist' ? whiteList : blackList;
  console.log('Current domain list:', list);
  
  if (list.length === 0) {
    const noDomainsEl = document.createElement('div');
    noDomainsEl.classList.add('no-domains');
    noDomainsEl.textContent = `No domains in the ${mode}`;
    domainListEl.appendChild(noDomainsEl);
    return;
  }
  
  list.forEach(domain => {
    const domainEl = document.createElement('div');
    domainEl.classList.add('domain-item');
    
    const domainNameEl = document.createElement('span');
    domainNameEl.textContent = domain;
    domainNameEl.classList.add('domain-name');
    
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.classList.add('remove-domain');
    removeButton.addEventListener('click', () => {
      removeDomain(domain);
    });
    
    domainEl.appendChild(domainNameEl);
    domainEl.appendChild(removeButton);
    domainListEl.appendChild(domainEl);
  });
}

// Add domain
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
  
  console.log('Adding domain:', domain);
  console.log('Current settings before adding:', JSON.stringify(currentSettings));
  
  // Make a deep copy of current settings to avoid reference issues
  const updatedSettings = JSON.parse(JSON.stringify(currentSettings));
  
  const mode = currentSettings.domains.mode;
  const list = mode === 'whitelist' ? updatedSettings.domains.whitelist : updatedSettings.domains.blacklist;
  
  // Check if domain already exists
  if (list.includes(domain)) {
    showStatusMessage(`Domain already exists in the ${mode}`, 'error');
    return;
  }
  
  // Add domain
  list.push(domain);
  
  // Update settings
  currentSettings = updatedSettings;
  console.log('Updated settings after adding domain:', JSON.stringify(currentSettings));
  
  // Clear input
  domainInputEl.value = '';
  
  // Show success message
  showStatusMessage(`Domain added to the ${mode}`, 'success');
  
  // Re-populate domain list
  populateDomainList();
  
  // Mark as having changes
  hasChanges = true;
  updateSaveButton();
}

// Remove domain
function removeDomain(domain) {
  console.log('Removing domain:', domain);
  console.log('Current settings before removing:', JSON.stringify(currentSettings));
  
  // Make a deep copy of current settings to avoid reference issues
  const updatedSettings = JSON.parse(JSON.stringify(currentSettings));
  
  const mode = currentSettings.domains.mode;
  const list = mode === 'whitelist' ? updatedSettings.domains.whitelist : updatedSettings.domains.blacklist;
  
  // Find and remove domain
  const index = list.indexOf(domain);
  if (index > -1) {
    list.splice(index, 1);
  }
  
  // Update settings
  currentSettings = updatedSettings;
  console.log('Updated settings after removing domain:', JSON.stringify(currentSettings));
  
  // Show success message
  showStatusMessage(`Domain removed from the ${mode}`, 'success');
  
  // Re-populate domain list
  populateDomainList();
  
  // Mark as having changes
  hasChanges = true;
  updateSaveButton();
}

// Check if domain is valid
function isValidDomain(domain) {
  // Basic domain validation
  // Allows alphanumeric, dash, dot, and underscore
  // Must have at least one dot
  // Must not start or end with dot or dash
  const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,}$/;
  return domainRegex.test(domain);
}

// Save settings
async function saveSettings() {
  try {
    // Создаем глубокую копию настроек для сохранения
    const settingsToSave = JSON.parse(JSON.stringify(currentSettings));
    
    await chrome.storage.local.set({ settings: settingsToSave });
    
    hasChanges = false;
    updateSaveButton();
    
    showStatusMessage('Settings saved successfully', 'success');
    
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

// Initialize the options page
document.addEventListener('DOMContentLoaded', initOptions); 