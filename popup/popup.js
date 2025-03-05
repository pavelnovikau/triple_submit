// Popup script for Triple Submit extension

// Текущий выбранный язык
let currentLanguage = 'ru';
// Объект с переводами (будем загружать из локальных файлов)
let translations = {};

// Функция для загрузки переводов для выбранного языка
async function loadTranslations(lang) {
  try {
    // Загружаем сообщения из расширения
    const response = await fetch(`../_locales/${lang}/messages.json`);
    if (!response.ok) {
      throw new Error(`Failed to load translations for ${lang}`);
    }
    translations = await response.json();
    return translations;
  } catch (error) {
    console.error('Error loading translations:', error);
    // Если не удалось загрузить язык, возвращаемся к английскому
    if (lang !== 'en') {
      return loadTranslations('en');
    }
    return {};
  }
}

// Функция для получения перевода по ключу
function getTranslation(key) {
  if (translations[key] && translations[key].message) {
    return translations[key].message;
  }
  return key; // Возвращаем ключ, если перевод не найден
}

// Функция для обновления всех текстов на странице
function updateUITexts() {
  // Обновляем тексты для всех элементов с ID
  document.getElementById('language-label').textContent = getTranslation('language_label');
  document.getElementById('enable-extension-label').textContent = getTranslation('enable_extension');
  document.getElementById('current-site-label').textContent = getTranslation('current_site');
  document.getElementById('enable-for-site-label').textContent = getTranslation('enable_for_site');
  document.getElementById('mode-label').textContent = getTranslation('mode');
  document.getElementById('mode-normal').textContent = getTranslation('mode_normal');
  document.getElementById('mode-alternative').textContent = getTranslation('mode_alternative');
  document.getElementById('enter-presses-label').textContent = getTranslation('enter_presses');
  document.getElementById('visual-feedback-label').textContent = getTranslation('visual_feedback');
  document.getElementById('options-button').textContent = getTranslation('advanced_options');
  document.getElementById('premium-label').textContent = getTranslation('upgrade_premium');
  document.getElementById('settings-note').textContent = getTranslation('settings_note');
  
  // Устанавливаем направление текста для языков с RTL (справа налево)
  document.documentElement.setAttribute('dir', 
    ['ar'].includes(currentLanguage) ? 'rtl' : 'ltr');
}

// Функция для изменения языка
async function changeLanguage(lang) {
  currentLanguage = lang;
  
  // Обновляем язык HTML-документа
  document.documentElement.setAttribute('lang', lang);
  
  // Загружаем переводы
  await loadTranslations(lang);
  
  // Обновляем интерфейс
  updateUITexts();
  
  // Сохраняем выбранный язык в настройках
  if (currentSettings) {
    await saveSettings({ language: lang });
  }
}

// DOM elements
// const themeSwitchEl = document.getElementById('theme-switch');
const lightThemeButtonEl = document.getElementById('light-theme-button');
const darkThemeButtonEl = document.getElementById('dark-theme-button');
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
const languageSelectEl = document.getElementById('language-select');

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
  
  // Загружаем язык из настроек
  if (currentSettings && currentSettings.language) {
    currentLanguage = currentSettings.language;
    languageSelectEl.value = currentLanguage;
  } else {
    // Используем язык браузера, если язык не указан в настройках
    const browserLang = navigator.language.split('-')[0];
    const availableLangs = ['en', 'es', 'zh', 'ru', 'ar', 'pt', 'fr', 'de', 'ja', 'it'];
    
    if (availableLangs.includes(browserLang)) {
      currentLanguage = browserLang;
      languageSelectEl.value = currentLanguage;
    }
  }
  
  // Загружаем переводы и обновляем интерфейс
  await loadTranslations(currentLanguage);
  updateUITexts();
  
  // Attach event listeners
  attachEventListeners();
}

// Load current settings
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get('settings');
    console.log('Loaded settings from storage:', data);
    
    // Если настройки не найдены, используем значения по умолчанию
    if (!data.settings) {
      currentSettings = {
        isEnabled: true,
        mode: 'normal',
        pressCount: 3,
        timeWindow: 200,
        visualFeedback: true,
        domains: {
          whitelist: [],
          blacklist: [],
          mode: 'whitelist'
        },
        theme: 'light',
        language: 'ru' // Языковая настройка по умолчанию
      };
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
    lightThemeButtonEl.classList.toggle('active', currentSettings.theme === 'light');
    darkThemeButtonEl.classList.toggle('active', currentSettings.theme === 'dark');
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Apply theme
function applyTheme() {
  if (currentSettings.theme === 'dark') {
    document.documentElement.classList.add('dark-theme');
    lightThemeButtonEl.classList.remove('active');
    darkThemeButtonEl.classList.add('active');
  } else {
    document.documentElement.classList.remove('dark-theme');
    lightThemeButtonEl.classList.add('active');
    darkThemeButtonEl.classList.remove('active');
  }
}

// Save settings
async function saveSettings(updates) {
  try {
    // Создаем глубокую копию текущих настроек
    const currentSettingsCopy = JSON.parse(JSON.stringify(currentSettings));
    
    // Если обновляем domains и это объект, обрабатываем его особо
    if (updates.domains) {
      const updatedSettings = { 
        ...currentSettingsCopy,
        domains: updates.domains  // Используем объект domains напрямую, т.к. он уже скопирован в updateDomainList
      };
      await chrome.storage.local.set({ settings: updatedSettings });
      currentSettings = updatedSettings;
    } else {
      // Для других обновлений используем обычное слияние объектов
      const updatedSettings = { ...currentSettingsCopy, ...updates };
      await chrome.storage.local.set({ settings: updatedSettings });
      currentSettings = updatedSettings;
    }
    
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
    
    console.log('Updating domain list for:', domain, 'Enabled:', isEnabled);
    console.log('Current settings before update:', JSON.stringify(currentSettings));
    
    // Создаем глубокую копию объекта domains
    const domains = {
      mode: currentSettings.domains.mode,
      whitelist: [...currentSettings.domains.whitelist],
      blacklist: [...currentSettings.domains.blacklist]
    };
    
    // Add or remove domain from the appropriate list
    if (domains.mode === 'whitelist') {
      if (isEnabled) {
        // Add to whitelist if not already present
        if (!domains.whitelist.includes(domain)) {
          domains.whitelist.push(domain);
          console.log('Added to whitelist:', domain);
        }
      } else {
        // Remove from whitelist
        domains.whitelist = domains.whitelist.filter(d => d !== domain);
        console.log('Removed from whitelist:', domain);
      }
    } else { // blacklist mode
      if (isEnabled) {
        // Remove from blacklist
        domains.blacklist = domains.blacklist.filter(d => d !== domain);
        console.log('Removed from blacklist:', domain);
      } else {
        // Add to blacklist if not already present
        if (!domains.blacklist.includes(domain)) {
          domains.blacklist.push(domain);
          console.log('Added to blacklist:', domain);
        }
      }
    }
    
    console.log('Updated domains object:', domains);
    await saveSettings({ domains });
    console.log('Current settings after update:', JSON.stringify(currentSettings));
    
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
  // Theme buttons
  lightThemeButtonEl.addEventListener('click', () => {
    saveSettings({ theme: 'light' });
    applyTheme();
  });
  
  darkThemeButtonEl.addEventListener('click', () => {
    saveSettings({ theme: 'dark' });
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
  
  // Language select
  languageSelectEl.addEventListener('change', () => {
    changeLanguage(languageSelectEl.value);
  });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initPopup); 