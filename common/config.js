/**
 * Triple Submit Configuration
 * Централизованная конфигурация для расширения
 */

// Объект для экспорта функций
const TripleSubmitConfig = {};

// Список поддерживаемых языков
TripleSubmitConfig.SUPPORTED_LANGUAGES = ['en', 'ru', 'es', 'de', 'fr', 'it', 'ja', 'zh', 'pt', 'ar'];

// Названия языков для отображения в интерфейсе
TripleSubmitConfig.LANGUAGE_NAMES = {
  'en': 'English',
  'ru': 'Русский',
  'es': 'Español',
  'de': 'Deutsch',
  'fr': 'Français',
  'it': 'Italiano',
  'ja': '日本語',
  'zh': '中文',
  'pt': 'Português',
  'ar': 'العربية'
};

/**
 * Получить текущий язык расширения
 * @returns {Promise<string>} Код языка (en, ru, и т.д.)
 */
TripleSubmitConfig.getLanguage = async function() {
  try {
    console.log('TripleSubmitConfig: Получение языка...');
    
    // Сначала проверяем, есть ли язык в отдельной записи
    const data = await chrome.storage.sync.
    File
    ~/github/triple_submit
    Error
    Could not load icon 'icons/icon32.png' specified in 'icons'.
    Could not load manifest.get('language');
    
    if (data.language) {
      console.log('TripleSubmitConfig: Найден язык в отдельной записи:', data.language);
      return data.language;
    }
    
    // Если нет, проверяем в настройках
    const settings = await chrome.storage.sync.get('settings');
    if (settings && settings.settings && settings.settings.language) {
      console.log('TripleSubmitConfig: Найден язык в настройках:', settings.settings.language);
      
      // Сохраняем язык и в отдельную запись для будущего использования
      await chrome.storage.sync.set({ language: settings.settings.language });
      
      return settings.settings.language;
    }
    
    // Если нигде не найден язык, используем язык браузера или английский
    const browserLang = chrome.i18n.getUILanguage() || 'en';
    console.log('TripleSubmitConfig: Используем язык браузера:', browserLang);
    
    // Проверяем, поддерживается ли язык браузера
    const langCode = browserLang.split('-')[0]; // Берём основной код языка (en-US -> en)
    if (TripleSubmitConfig.SUPPORTED_LANGUAGES.includes(langCode)) {
      return langCode;
    }
    
    return 'en'; // Дефолтный язык - английский
  } catch (error) {
    console.error('TripleSubmitConfig: Ошибка при получении языка:', error);
    return 'en'; // В случае ошибки используем английский
  }
};

/**
 * Установить новый язык расширения
 * @param {string} lang - Код языка для установки
 * @returns {Promise<string>} Установленный код языка
 */
TripleSubmitConfig.setLanguage = async function(lang) {
  try {
    console.log('TripleSubmitConfig: Установка языка:', lang);
    
    if (!TripleSubmitConfig.SUPPORTED_LANGUAGES.includes(lang)) {
      console.error('TripleSubmitConfig: Неподдерживаемый язык:', lang);
      return TripleSubmitConfig.getLanguage();
    }
    
    // Сохраняем язык в отдельной записи
    await chrome.storage.sync.set({ language: lang });
    console.log('TripleSubmitConfig: Язык сохранен в отдельной записи');
    
    // Также обновляем язык в настройках для обратной совместимости
    try {
      const data = await chrome.storage.sync.get('settings');
      if (data.settings) {
        const updatedSettings = {...data.settings, language: lang};
        await chrome.storage.sync.set({ settings: updatedSettings });
        console.log('TripleSubmitConfig: Язык также обновлен в настройках');
      }
    } catch (settingsError) {
      console.error('TripleSubmitConfig: Ошибка при обновлении языка в настройках:', settingsError);
    }
    
    // И в локальном storage тоже для полной совместимости
    try {
      await chrome.storage.local.set({ selectedLanguage: lang });
      console.log('TripleSubmitConfig: Язык сохранен в локальном хранилище');
    } catch (localError) {
      console.error('TripleSubmitConfig: Ошибка при сохранении в локальном хранилище:', localError);
    }
    
    return lang;
  } catch (error) {
    console.error('TripleSubmitConfig: Ошибка при установке языка:', error);
    return TripleSubmitConfig.getLanguage();
  }
};

/**
 * Получить список всех поддерживаемых языков
 * @returns {Array} Массив кодов языков
 */
TripleSubmitConfig.getSupportedLanguages = function() {
  return TripleSubmitConfig.SUPPORTED_LANGUAGES;
};

/**
 * Получить список названий языков
 * @returns {Object} Объект с названиями языков
 */
TripleSubmitConfig.getLanguageNames = function() {
  return TripleSubmitConfig.LANGUAGE_NAMES;
}; 