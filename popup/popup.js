// Popup script for Triple Submit extension

// Глобальные переменные
let currentSettings = {};
let currentDomain = '';
let translations = {}; // Объект для хранения переводов
let currentLanguage = 'en'; // По умолчанию - английский

// Переменные для отслеживания использования
let usageCount = 0;
let isPremium = false;

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
const premiumModalEl = document.getElementById('premium-modal');
const closeModalEl = document.querySelector('.close-modal');
const payButtonEl = document.getElementById('pay-button');

let currentTabUrl = '';
let currentTabId = null;

// Полностью переработанная функция для загрузки переводов
async function loadTranslations(lang) {
  try {
    console.log('Запуск загрузки переводов для языка:', lang);
    
    // Используем chrome.i18n API вместо прямой загрузки файла
    const messagesUrl = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    console.log('URL переводов:', messagesUrl);
    
    const response = await fetch(messagesUrl);
    if (!response.ok) {
      console.error(`HTTP ошибка при загрузке переводов: ${response.status}`);
      throw new Error(`Не удалось загрузить переводы для ${lang}`);
    }
    
    translations = await response.json();
    console.log('Переводы успешно загружены:', Object.keys(translations).length, 'ключей');
    return translations;
  } catch (error) {
    console.error('Ошибка загрузки переводов:', error);
    
    // Если не удалось загрузить указанный язык, пробуем английский
    if (lang !== 'en') {
      console.log('Пробуем загрузить английский язык в качестве резервного');
      return loadTranslations('en');
    }
    
    // Если даже английский не загружается, используем встроенные резервные переводы
    console.log('Используем встроенные резервные переводы');
    return {
      'language_label': { message: 'Language' },
      'enable_extension': { message: 'Enable Triple Submit' },
      'current_site': { message: 'Current site:' },
      'enable_for_site': { message: 'Enable for this site' },
      'mode_label': { message: 'Mode:' },
      'mode_normal': { message: 'Normal' },
      'mode_alternative': { message: 'Enhanced' },
      'mode_normal_description': { message: 'Submits form three times when Enter key is pressed' },
      'mode_alternative_description': { message: 'Submits form three times with Ctrl+Enter' },
      'enter_presses_label': { message: 'Number of Enter presses:' },
      'visual_feedback_label': { message: 'Visual feedback' },
      'advanced_options': { message: 'Advanced settings' },
      'upgrade_premium': { message: 'Upgrade to Premium' },
      'usage_remaining_label': { message: 'Free uses remaining:' }
    };
  }
}

// Улучшенная функция для получения перевода по ключу
function getTranslation(key) {
  if (!key) {
    console.error('getTranslation вызван с пустым ключом');
    return '[MISSING KEY]';
  }
  
  if (!translations) {
    console.error('Объект translations не инициализирован');
    return key;
  }
  
  if (translations[key] && translations[key].message) {
    return translations[key].message;
  }
  
  console.warn(`Перевод для ключа "${key}" не найден в языке "${currentLanguage}"`);
  return key; // Возвращаем ключ, если перевод не найден
}

// Функция для обновления всех текстов на странице
function updateUITexts() {
  // Обновляем все тексты интерфейса
  
  // Основные элементы
  document.getElementById('language-label').textContent = getTranslation('language_label');
  document.getElementById('enable-extension-label').textContent = getTranslation('enable_extension');
  document.getElementById('current-site-label').textContent = getTranslation('current_site');
  document.getElementById('enable-for-site-label').textContent = getTranslation('enable_for_site');
  document.getElementById('mode-label').textContent = getTranslation('mode_label');
  document.getElementById('enter-presses-label').textContent = getTranslation('enter_presses_label');
  document.getElementById('visual-feedback-label').textContent = getTranslation('visual_feedback_label');
  document.getElementById('options-button').textContent = getTranslation('advanced_options');
  
  // Premium элементы
  document.getElementById('premium-label').textContent = getTranslation('upgrade_premium');
  document.getElementById('usage-label').textContent = getTranslation('usage_remaining_label');
  
  // Режимы
  const modeNormalOption = document.getElementById('mode-normal');
  const modeAlternativeOption = document.getElementById('mode-alternative');
  
  if (modeNormalOption) modeNormalOption.textContent = getTranslation('mode_normal');
  if (modeAlternativeOption) modeAlternativeOption.textContent = getTranslation('mode_alternative');
  
  // Устанавливаем направление текста для языков с RTL (справа налево)
  document.documentElement.setAttribute('dir', 
    ['ar'].includes(currentLanguage) ? 'rtl' : 'ltr');
  
  // Модальное окно
  const premiumModal = document.getElementById('premium-modal');
  if (premiumModal) {
    const modalTitle = premiumModal.querySelector('h2');
    if (modalTitle) modalTitle.textContent = getTranslation('usage_limit_title');
    
    const modalMessage1 = premiumModal.querySelector('p:nth-of-type(1)');
    if (modalMessage1) modalMessage1.textContent = getTranslation('usage_limit_message');
    
    const modalMessage2 = premiumModal.querySelector('p:nth-of-type(2)');
    if (modalMessage2) modalMessage2.textContent = getTranslation('upgrade_message');
    
    const pricePeriod = premiumModal.querySelector('.price-period');
    if (pricePeriod) pricePeriod.textContent = getTranslation('price_period');
    
    const payButton = premiumModal.querySelector('#pay-button');
    if (payButton) payButton.textContent = getTranslation('pay_button');
  }
  
  // Также обновляем описание режима
  updateModeDescription();
}

// Улучшенная функция для обновления описания режима
function updateModeDescription() {
  const modeSelect = document.getElementById('mode-select');
  const modeDescription = document.getElementById('mode-description');
  
  if (!modeSelect || !modeDescription) {
    console.error('Элементы mode-select или mode-description не найдены!');
    return;
  }
  
  console.log('Обновляем описание режима. Выбранный режим:', modeSelect.value);
  
  if (modeSelect.value === 'normal') {
    const translation = getTranslation('mode_normal_description');
    console.log('Получен перевод для нормального режима:', translation);
    modeDescription.textContent = translation;
  } else {
    const translation = getTranslation('mode_alternative_description');
    console.log('Получен перевод для альтернативного режима:', translation);
    modeDescription.textContent = translation;
  }
  
  // Убедимся, что описание видимо
  modeDescription.style.display = 'block';
}

// Полностью переработанная функция изменения языка
async function changeLanguage(lang) {
  try {
    console.log('Начинаем смену языка на:', lang);
    
    // Защита от пустого значения
    if (!lang) {
      console.error('Получено пустое значение языка');
      return;
    }
    
    // Устанавливаем язык в переменной
    currentLanguage = lang;
    
    // Устанавливаем значение в селекторе
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.value = lang;
      console.log('Установлено значение в селекторе языка:', lang);
    } else {
      console.error('Элемент language-select не найден в DOM!');
    }
    
    // Сохраняем выбранный язык в локальном хранилище
    await chrome.storage.local.set({ selectedLanguage: lang });
    console.log('Язык сохранен в storage:', lang);
    
    // Загружаем переводы для выбранного языка
    const loadedTranslations = await loadTranslations(lang);
    console.log('Переводы загружены:', !!loadedTranslations, 'количество ключей:', Object.keys(loadedTranslations).length);
    
    // Обновляем тексты в интерфейсе
    updateUITexts();
    console.log('Тексты UI обновлены');
    
    // Дополнительно обновляем описание режима
    updateModeDescription();
    console.log('Описание режима обновлено');
    
    // Устанавливаем направление текста (RTL/LTR)
    if (['ar'].includes(lang)) {
      document.documentElement.setAttribute('dir', 'rtl');
      console.log('Установлено направление текста: RTL');
    } else {
      document.documentElement.setAttribute('dir', 'ltr');
      console.log('Установлено направление текста: LTR');
    }
    
    console.log('Язык успешно изменен на:', lang);
    
    // Принудительно обновляем все элементы страницы
    setTimeout(() => {
      // Дополнительное обновление через 100мс для гарантии
      updateUITexts();
      updateModeDescription();
      console.log('Выполнено дополнительное обновление текстов');
    }, 100);
    
  } catch (error) {
    console.error('Ошибка при изменении языка:', error);
  }
}

// Обновленная функция инициализации попапа с дополнительными проверками
async function initPopup() {
  try {
    console.log('Инициализация попапа начата...');
    
    // Проверка DOM-элементов
    const criticalElements = [
      { id: 'language-select', name: 'Селектор языка' },
      { id: 'mode-select', name: 'Селектор режима' },
      { id: 'mode-description', name: 'Описание режима' },
      { id: 'options-button', name: 'Кнопка настроек' }
    ];
    
    let allElementsFound = true;
    for (const elem of criticalElements) {
      if (!document.getElementById(elem.id)) {
        console.error(`Критический элемент не найден: ${elem.name} (id: ${elem.id})`);
        allElementsFound = false;
      }
    }
    
    if (!allElementsFound) {
      console.error('Инициализация продолжится, но некоторые функции могут не работать!');
    }
    
    // Получаем текущий домен из активной вкладки
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        const url = new URL(tabs[0].url);
        currentDomain = url.hostname;
        const domainElem = document.getElementById('current-domain-text');
        if (domainElem) {
          domainElem.textContent = currentDomain;
        }
      }
    } catch (tabError) {
      console.error('Ошибка при получении текущего домена:', tabError);
    }
    
    // Загружаем сохраненный язык
    try {
      const languageData = await chrome.storage.local.get('selectedLanguage');
      if (languageData.selectedLanguage) {
        currentLanguage = languageData.selectedLanguage;
        console.log('Загружен язык из storage:', currentLanguage);
        
        const langSelector = document.getElementById('language-select');
        if (langSelector) {
          langSelector.value = currentLanguage;
          console.log('Установлен селектор языка:', currentLanguage);
        }
      }
    } catch (langError) {
      console.error('Ошибка при загрузке языка из storage:', langError);
    }
    
    // Загружаем настройки темы
    try {
      const themeData = await chrome.storage.local.get('theme');
      if (themeData.theme === 'dark') {
        document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
      console.log('Тема установлена:', themeData.theme || 'light');
    } catch (themeError) {
      console.error('Ошибка при загрузке темы:', themeError);
    }
    
    // Загружаем переводы для текущего языка
    try {
      const loadedTranslations = await loadTranslations(currentLanguage);
      console.log('Переводы загружены для', currentLanguage, ':', !!loadedTranslations);
    } catch (transError) {
      console.error('Ошибка при загрузке переводов:', transError);
    }
    
    // Загружаем основные настройки
    try {
      await loadSettings();
      console.log('Настройки загружены');
    } catch (settingsError) {
      console.error('Ошибка при загрузке настроек:', settingsError);
    }
    
    // Загружаем данные об использовании
    try {
      await loadUsageData();
      console.log('Данные об использовании загружены');
    } catch (usageError) {
      console.error('Ошибка при загрузке данных об использовании:', usageError);
    }
    
    // Обновляем UI на основе настроек
    try {
      updateUI();
      console.log('UI обновлен на основе настроек');
    } catch (uiError) {
      console.error('Ошибка при обновлении UI:', uiError);
    }
    
    // Обновляем UI для Premium
    try {
      updatePremiumUI();
      console.log('Premium UI обновлен');
    } catch (premiumError) {
      console.error('Ошибка при обновлении Premium UI:', premiumError);
    }
    
    // Обновляем тексты интерфейса и описание режима
    try {
      updateUITexts();
      console.log('Тексты интерфейса обновлены');
      
      updateModeDescription();
      console.log('Описание режима обновлено');
    } catch (textsError) {
      console.error('Ошибка при обновлении текстов:', textsError);
    }
    
    // Прикрепляем обработчики событий
    try {
      attachEventListeners();
      console.log('Обработчики событий прикреплены');
    } catch (eventsError) {
      console.error('Ошибка при прикреплении обработчиков событий:', eventsError);
    }
    
    console.log('Инициализация попапа завершена успешно.');
  } catch (error) {
    console.error('Критическая ошибка при инициализации попапа:', error);
  }
}

// Обновленная функция загрузки настроек
async function loadSettings() {
  try {
    console.log('Загрузка настроек...');
    
    // Получаем настройки из синхронизированного хранилища
    const data = await chrome.storage.sync.get('settings');
    
    // Используем настройки по умолчанию, если настройки не найдены
    const defaultSettings = {
      enabled: true,
      pressCount: 3,
      visualFeedback: true,
      mode: 'normal',
      timeWindow: 200,
      blacklist: [],
      whitelist: [],
      blacklistMode: true,
      isPremium: false
    };
    
    // Объединяем полученные настройки с настройками по умолчанию
    currentSettings = {...defaultSettings, ...(data.settings || {})};
    
    console.log('Загруженные настройки:', currentSettings);
    
    // Обновляем UI элементы в соответствии с настройками
    document.getElementById('extension-toggle').checked = currentSettings.enabled;
    document.getElementById('press-count').textContent = currentSettings.pressCount;
    document.getElementById('mode-select').value = currentSettings.mode;
    document.getElementById('feedback-toggle').checked = currentSettings.visualFeedback;
    
    // Проверяем, включено ли расширение для текущего домена
    const domain = document.getElementById('current-domain-text').textContent;
    
    // Проверяем, находится ли домен в черном или белом списке
    let domainEnabled = true;
    
    if (currentSettings.blacklistMode) {
      // В режиме черного списка: включено, если домен НЕ в черном списке
      domainEnabled = !currentSettings.blacklist.includes(domain);
    } else {
      // В режиме белого списка: включено, только если домен в белом списке
      domainEnabled = currentSettings.whitelist.includes(domain);
    }
    
    document.getElementById('domain-toggle').checked = domainEnabled;
    
    return currentSettings;
  } catch (error) {
    console.error('Ошибка при загрузке настроек:', error);
    return {};
  }
}

// Функция обновления интерфейса на основе настроек
function updateUI() {
  // Обновляем тексты
  updateUITexts();
  
  // Обновляем статус вкладок
  const extensionEnabled = currentSettings.enabled;
  document.getElementById('extension-toggle').checked = extensionEnabled;
  
  // Если расширение отключено, блокируем остальные настройки
  const sections = document.querySelectorAll('.domain-control, .settings-preview');
  sections.forEach(section => {
    section.style.opacity = extensionEnabled ? '1' : '0.5';
    section.style.pointerEvents = extensionEnabled ? 'auto' : 'none';
  });
}

// Обновление данных об использовании
async function loadUsageData() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getUsageData' });
    if (response && response.usageData) {
      updateUsageCounter(response.usageData);
      
      // Проверяем, нужно ли показать модальное окно
      if (response.usageData.count >= 10 && !currentSettings.isPremium) {
        console.log('Достигнут лимит использований, показываем модальное окно');
        showPremiumModal();
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке данных об использовании:', error);
  }
}

// Обновление счетчика использования в UI
function updateUsageCounter(usageData) {
  const usageCountElement = document.getElementById('usage-count');
  const remainingUses = Math.max(0, 10 - usageData.count); // Максимум 10 бесплатных использований
  
  if (usageCountElement) {
    usageCountElement.textContent = remainingUses;
    
    // Если осталось мало использований, выделяем красным
    if (remainingUses <= 3) {
      usageCountElement.style.color = '#e74c3c'; // Красный для предупреждения
    } else {
      usageCountElement.style.color = ''; // Возврат к стандартному цвету
    }
    
    // Если лимит исчерпан и пользователь не premium, показываем модальное окно
    if (remainingUses === 0 && !currentSettings.isPremium) {
      console.log('Лимит использований исчерпан в updateUsageCounter');
      showPremiumModal();
    }
  }
  
  // Если пользователь - premium, скрываем счетчик
  const usageCounter = document.querySelector('.usage-counter');
  const premiumBanner = document.querySelector('.premium-banner');
  
  if (currentSettings.isPremium && usageCounter) {
    usageCounter.style.display = 'none';
    if (premiumBanner) {
      premiumBanner.innerHTML = '<span id="premium-status">Premium активирован</span><span class="crown-icon">👑</span>';
      premiumBanner.style.backgroundColor = 'var(--accent-color-hover)';
      premiumBanner.style.borderLeft = '3px solid var(--accent-color)';
      premiumBanner.style.cursor = 'default';
      premiumBanner.removeEventListener('click', showPremiumModal);
    }
  }
}

// Увеличение счетчика использования
async function incrementUsage() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'incrementUsage' });
    if (response && response.usageData) {
      updateUsageCounter(response.usageData);
      
      // Если достигнут лимит использований, показываем модальное окно
      if (response.usageData.count >= 10 && !currentSettings.isPremium) {
        console.log('Достигнут лимит использований в incrementUsage');
        showPremiumModal();
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении счетчика использований:', error);
  }
}

// Обновление премиум UI
function updatePremiumUI() {
  if (currentSettings.isPremium) {
    const premiumBanner = document.querySelector('.premium-banner');
    const usageCounter = document.querySelector('.usage-counter');
    
    if (premiumBanner) {
      // Используем стиль в соответствии с общей цветовой гаммой
      premiumBanner.innerHTML = '<span id="premium-status">Premium активирован</span><span class="crown-icon">👑</span>';
      
      // Вместо зеленого используем более темный оттенок основного акцентного цвета
      premiumBanner.style.backgroundColor = 'var(--accent-color-hover)';
      premiumBanner.style.borderLeft = '3px solid var(--accent-color)';
      premiumBanner.style.cursor = 'default';
      premiumBanner.removeEventListener('click', showPremiumModal);
    }
    
    if (usageCounter) {
      usageCounter.style.display = 'none';
    }
  } else {
    const premiumBanner = document.querySelector('.premium-banner');
    if (premiumBanner) {
      premiumBanner.addEventListener('click', showPremiumModal);
    }
  }
}

// Показать модальное окно премиум
function showPremiumModal() {
  console.log('Вызвана функция showPremiumModal');
  const modal = document.getElementById('premium-modal');
  if (modal) {
    console.log('Модальное окно найдено, отображаем');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Блокируем прокрутку
  } else {
    console.error('Модальное окно не найдено!');
  }
}

// Закрыть модальное окно
function closePremiumModal() {
  const modal = document.getElementById('premium-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Разблокируем прокрутку
  }
}

// Симуляция оплаты
function simulatePayment() {
  const payButton = document.getElementById('pay-button');
  if (payButton) {
    payButton.disabled = true;
    payButton.textContent = getTranslation('processing_payment');
    
    // Имитация процесса оплаты
    setTimeout(async () => {
      // Обновляем статус Premium
      await saveSettings({ isPremium: true });
      
      // Обновляем UI
      updatePremiumUI();
      
      // Закрываем модальное окно
      setTimeout(() => {
        closePremiumModal();
        payButton.disabled = false;
        payButton.textContent = getTranslation('pay_button');
      }, 500);
    }, 1500);
  }
}

// Обновленная функция применения темы
function applyTheme() {
  const isDarkTheme = document.documentElement.classList.contains('dark-theme');
  
  if (isDarkTheme) {
    document.documentElement.classList.remove('dark-theme');
    chrome.storage.local.set({ theme: 'light' });
  } else {
    document.documentElement.classList.add('dark-theme');
    chrome.storage.local.set({ theme: 'dark' });
  }
  
  // Обновление текстов интерфейса после смены темы
  updateUITexts();
}

// Обновленная функция сохранения настроек
async function saveSettings(updates) {
  try {
    console.log('Сохранение настроек, обновления:', updates);
    
    // Обновляем текущие настройки
    currentSettings = { ...currentSettings, ...updates };
    
    // Сохраняем настройки в синхронизированное хранилище
    await chrome.storage.sync.set({ settings: currentSettings });
    
    console.log('Настройки сохранены:', currentSettings);
    
    // Если обновился статус включения, обновляем иконку
    if (updates.hasOwnProperty('enabled')) {
      await updateIcon();
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка при сохранении настроек:', error);
    return false;
  }
}

// Обновленная функция обновления доменного списка
async function updateDomainList(domain, isEnabled) {
  if (!domain) {
    console.error('Не указан домен для обновления');
    return;
  }
  
  try {
    console.log(`Обновление статуса домена ${domain}: ${isEnabled}`);
    
    if (currentSettings.blacklistMode) {
      // В режиме черного списка: добавляем в blacklist если выключено, удаляем если включено
      if (isEnabled) {
        // Удаляем домен из черного списка
        currentSettings.blacklist = currentSettings.blacklist.filter(d => d !== domain);
      } else {
        // Добавляем домен в черный список, если его там еще нет
        if (!currentSettings.blacklist.includes(domain)) {
          currentSettings.blacklist.push(domain);
        }
      }
    } else {
      // В режиме белого списка: добавляем в whitelist если включено, удаляем если выключено
      if (isEnabled) {
        // Добавляем домен в белый список, если его там еще нет
        if (!currentSettings.whitelist.includes(domain)) {
          currentSettings.whitelist.push(domain);
        }
      } else {
        // Удаляем домен из белого списка
        currentSettings.whitelist = currentSettings.whitelist.filter(d => d !== domain);
      }
    }
    
    // Сохраняем обновленные настройки
    await saveSettings({
      blacklist: currentSettings.blacklist,
      whitelist: currentSettings.whitelist
    });
    
    console.log('Списки доменов обновлены:', {
      blacklist: currentSettings.blacklist,
      whitelist: currentSettings.whitelist
    });
    
    return true;
  } catch (error) {
    console.error('Ошибка при обновлении списка доменов:', error);
    return false;
  }
}

// Обновленная функция обновления иконки
async function updateIcon() {
  try {
    console.log('Обновление иконки расширения');
    
    // Отправляем сообщение фоновому скрипту для обновления иконки
    await chrome.runtime.sendMessage({ 
      action: 'updateIcon',
      isEnabled: currentSettings.enabled
    });
    
    return true;
  } catch (error) {
    console.error('Ошибка при обновлении иконки:', error);
    return false;
  }
}

// Обновленная функция для прикрепления обработчиков событий
function attachEventListeners() {
  // Обработчик переключения языка
  const languageSelect = document.getElementById('language-select');
  if (languageSelect) {
    console.log('Прикрепляем обработчик для события изменения языка');
    
    // Удаляем существующие обработчики, если они есть
    languageSelect.removeEventListener('change', handleLanguageChange);
    
    // Определяем функцию обработчика для более простого управления
    function handleLanguageChange(event) {
      const newLang = event.target.value;
      console.log('Выбран новый язык через селектор:', newLang);
      
      if (newLang && newLang !== currentLanguage) {
        console.log('Запускаем функцию changeLanguage с языком:', newLang);
        changeLanguage(newLang);
      } else {
        console.log('Язык не изменился или пустой:', newLang);
      }
    }
    
    // Добавляем новый обработчик
    languageSelect.addEventListener('change', handleLanguageChange);
    console.log('Обработчик события изменения языка прикреплен');
  } else {
    console.error('Элемент language-select не найден в DOM!');
  }
  
  // Обработчики для кнопок темы
  const lightThemeButton = document.getElementById('light-theme-button');
  const darkThemeButton = document.getElementById('dark-theme-button');
  
  if (lightThemeButton) {
    lightThemeButton.addEventListener('click', applyTheme);
  }
  
  if (darkThemeButton) {
    darkThemeButton.addEventListener('click', applyTheme);
  }
  
  // Обработчик кнопки настроек
  const optionsButton = document.getElementById('options-button');
  if (optionsButton) {
    optionsButton.addEventListener('click', function() {
      console.log('Нажата кнопка настроек');
      
      try {
        // Проверка наличия метода openOptionsPage
        if (chrome.runtime && chrome.runtime.openOptionsPage) {
          console.log('Используем chrome.runtime.openOptionsPage()');
          chrome.runtime.openOptionsPage();
        } else if (chrome.extension && chrome.extension.getURL) {
          // Запасной вариант - открываем через URL
          console.log('Используем прямой URL к странице настроек');
          const optionsUrl = chrome.extension.getURL('options/options.html');
          console.log('URL страницы настроек:', optionsUrl);
          window.open(optionsUrl);
        } else {
          // Совсем запасной вариант
          console.log('Используем chrome.runtime.getURL()');
          window.open(chrome.runtime.getURL('options/options.html'));
        }
      } catch (error) {
        // Если произошла ошибка, логируем её и пробуем самый простой вариант
        console.error('Ошибка при открытии страницы настроек:', error);
        try {
          window.open('options/options.html');
        } catch (finalError) {
          console.error('Не удалось открыть страницу настроек:', finalError);
          alert('Не удалось открыть страницу настроек. Пожалуйста, проверьте консоль разработчика.');
        }
      }
    });
  } else {
    console.error('Кнопка настроек не найдена в DOM!');
  }
  
  // Обработчики для основных настроек
  const extensionToggle = document.getElementById('extension-toggle');
  if (extensionToggle) {
    extensionToggle.addEventListener('change', async (event) => {
      await saveSettings({ enabled: event.target.checked });
      updateIcon();
    });
  }
  
  const domainToggle = document.getElementById('domain-toggle');
  if (domainToggle) {
    domainToggle.addEventListener('change', async (event) => {
      const domain = document.getElementById('current-domain-text').textContent;
      await updateDomainList(domain, event.target.checked);
    });
  }
  
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    modeSelect.addEventListener('change', async (event) => {
      await saveSettings({ mode: event.target.value });
      updateModeDescription();
    });
  }
  
  const decreaseCountButton = document.getElementById('decrease-count');
  const increaseCountButton = document.getElementById('increase-count');
  const pressCountElement = document.getElementById('press-count');
  
  if (decreaseCountButton && pressCountElement) {
    decreaseCountButton.addEventListener('click', async () => {
      let count = parseInt(pressCountElement.textContent);
      if (count > 2) {
        count--;
        pressCountElement.textContent = count;
        await saveSettings({ pressCount: count });
      }
    });
  }
  
  if (increaseCountButton && pressCountElement) {
    increaseCountButton.addEventListener('click', async () => {
      let count = parseInt(pressCountElement.textContent);
      if (count < 10) {
        count++;
        pressCountElement.textContent = count;
        await saveSettings({ pressCount: count });
      }
    });
  }
  
  const feedbackToggle = document.getElementById('feedback-toggle');
  if (feedbackToggle) {
    feedbackToggle.addEventListener('change', async (event) => {
      await saveSettings({ visualFeedback: event.target.checked });
    });
  }
  
  // Premium модальное окно
  const premiumBanner = document.querySelector('.premium-banner');
  const closeModalButton = document.querySelector('.close-modal');
  const payButton = document.getElementById('pay-button');
  
  if (premiumBanner && !currentSettings.isPremium) {
    premiumBanner.addEventListener('click', showPremiumModal);
  }
  
  if (closeModalButton) {
    closeModalButton.addEventListener('click', closePremiumModal);
  }
  
  if (payButton) {
    payButton.addEventListener('click', simulatePayment);
  }
  
  // Закрытие модального окна при клике вне его содержимого
  const modal = document.getElementById('premium-modal');
  if (modal) {
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        closePremiumModal();
      }
    });
  }
  
  // Закрытие по ESC
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePremiumModal();
    }
  });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initPopup); 