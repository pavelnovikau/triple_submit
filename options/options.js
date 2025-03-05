// Глобальные переменные
let currentLanguage = 'en'; // Текущий язык
let currentSettings = {}; // Текущие настройки
let hasChanges = false; // Флаг наличия изменений

// Применяет тему
function applyTheme() {
  console.log('applyTheme: Применение темы');
  
  // Получаем сохраненную тему или используем системную
  const savedTheme = localStorage.getItem('theme');
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  let theme = 'light';
  
  if (savedTheme) {
    // Если есть сохраненная тема, используем ее
    theme = savedTheme;
  } else if (prefersDarkMode) {
    // Если нет сохраненной темы, но система в темном режиме, используем темную тему
    theme = 'dark';
  }
  
  // Применяем тему
  document.body.setAttribute('data-theme', theme);
  console.log('applyTheme: Тема применена:', theme);
}

// Дополнительные функции для отладки

// Отображает текущие списки в консоли
function logDomainLists() {
  chrome.storage.sync.get('settings', (data) => {
    if (data.settings) {
      console.group('📋 Текущие списки доменов:');
      console.log('Режим:', data.settings.domainMode || 'whitelist');
      console.log('Белый список:', data.settings.whitelist || []);
      console.log('Черный список:', data.settings.blacklist || []);
      console.groupEnd();
    } else {
      console.warn('⚠️ Настройки не найдены в хранилище');
    }
  });
}

function initOptions() {
  console.log('%c[initOptions] Начало инициализации настроек', 'font-weight: bold; color: blue;');
  
  // Отладочная информация
  console.log('%c[DEBUG] DOM статус:', 'color: purple;');
  console.log('domain-list-container:', document.querySelector('.domain-list-container'));
  console.log('domain-list:', document.getElementById('domain-list'));
  console.log('domain-list-title:', document.getElementById('domain-list-title'));
  
  // Логируем текущие списки доменов
  logDomainLists();
  
  // Включаем режим тестовых данных для отладки
  localStorage.setItem('showTestData', 'true');
  
  // Устанавливаем обработчик изменений storage, чтобы обнаруживать изменения из других страниц
  chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('%c[Storage изменено]', 'color: orange;', changes);
    
    // Если изменились настройки, логируем изменения в доменах
    if (changes.settings && namespace === 'sync') {
      const oldSettings = changes.settings.oldValue || {};
      const newSettings = changes.settings.newValue || {};
      
      // Проверяем изменения в списках доменов
      if (JSON.stringify(oldSettings.whitelist) !== JSON.stringify(newSettings.whitelist) ||
          JSON.stringify(oldSettings.blacklist) !== JSON.stringify(newSettings.blacklist) ||
          oldSettings.domainMode !== newSettings.domainMode) {
        console.log('%c[Изменение в списках доменов]', 'color: green;');
        logDomainLists();
      }
      
      // Если изменился язык, обновляем UI
      if (newSettings.language && newSettings.language !== currentLanguage) {
        console.log('Обнаружено изменение языка:', newSettings.language);
        currentLanguage = newSettings.language;
        updateLanguageUI(currentLanguage);
      }
      
      // Обновляем настройки и UI
      currentSettings = newSettings;
      updateUI(currentSettings);
    }
    
    // Если изменился язык в отдельной записи, обновляем UI
    if (changes.language && namespace === 'sync') {
      const newLanguage = changes.language.newValue;
      console.log('Обнаружено изменение языка:', newLanguage);
      
      if (newLanguage && newLanguage !== currentLanguage) {
        currentLanguage = newLanguage;
        updateLanguageUI(currentLanguage);
      }
    }
  });
  
  // Загружаем и применяем тему
  applyTheme();
  
  // Форсируем отображение DOM элементов
  setTimeout(() => {
    const domainList = document.getElementById('domain-list');
    const domainListContainer = document.querySelector('.domain-list-container');
    
    if (domainList) {
      domainList.style.display = 'block';
      domainList.style.minHeight = '150px';
      domainList.style.border = '2px solid red'; // Временная рамка для отладки
      console.log('%c[Форсирую отображение списка доменов]', 'color: green;');
    }
    
    if (domainListContainer) {
      domainListContainer.style.display = 'block';
      domainListContainer.style.minHeight = '250px';
      console.log('%c[Форсирую отображение контейнера списка доменов]', 'color: green;');
    }
    
    // Принудительно добавим тестовый домен в список
    if (domainList && localStorage.getItem('showTestData') === 'true') {
      console.log('%c[Добавляю тестовый домен]', 'color: green;');
      
      const testDomains = ['example.com', 'test-domain.com'];
      populateDomainList(testDomains);
    }
  }, 500);
  
  // Получаем текущий язык напрямую из хранилища для обеспечения синхронизации
  chrome.storage.sync.get(['language', 'settings'], (data) => {
    console.log('initOptions: Получены данные из storage:', data);
    
    // Сначала проверяем отдельную запись language
    let detectedLanguage = null;
    
    if (data.language) {
      console.log('initOptions: Язык найден в отдельной записи:', data.language);
      detectedLanguage = data.language;
    } 
    // Затем проверяем в настройках
    else if (data.settings && data.settings.language) {
      console.log('initOptions: Язык найден в настройках:', data.settings.language);
      detectedLanguage = data.settings.language;
    }
    
    if (detectedLanguage) {
      currentLanguage = detectedLanguage;
      console.log('initOptions: Установлен язык из хранилища:', currentLanguage);
      
      // Обновляем интерфейс с учетом языка
      updateLanguageUI(currentLanguage);
      
      // Загружаем настройки после установки языка
      loadSettings();
    } else {
      // Если язык не найден в хранилище, используем конфигурацию
      TripleSubmitConfig.getLanguage().then(lang => {
        console.log('initOptions: Получен язык из конфигурации:', lang);
        currentLanguage = lang;
        
        // Обновляем интерфейс
        updateLanguageUI(currentLanguage);
        
        // Загружаем настройки после установки языка
        loadSettings();
      }).catch(error => {
        console.error('Ошибка при получении языка из конфигурации:', error);
        // В случае ошибки все равно загружаем настройки
        loadSettings();
      });
    }
  });
  
  // Обработчик кнопки выбора языка
  document.getElementById('language-button').addEventListener('click', showLanguageMenu);
  
  // Инициализируем список доменов
  initDomainList();
  
  // Инициализируем все обработчики событий
  attachEventListeners();
}

// Функция для инициализации списка доменов
function initDomainList() {
  console.log('initDomainList: Инициализация списка доменов');
  
  // Устанавливаем минимальную высоту для контейнера списка доменов
  const domainListContainer = document.querySelector('.domain-list-container');
  if (domainListContainer) {
    domainListContainer.style.minHeight = '200px';
    console.log('initDomainList: Установлена минимальная высота контейнера');
  }
  
  const domainList = document.getElementById('domain-list');
  if (domainList) {
    // Убедимся, что список виден
    domainList.style.display = 'block';
    domainList.style.minHeight = '150px';
    domainList.style.maxHeight = '300px';
    domainList.style.overflowY = 'auto';
    console.log('initDomainList: Обновлены стили списка доменов');
    
    // Добавляем тестовый домен, просто чтобы проверить отображение
    chrome.storage.sync.get('domainList', (data) => {
      const domains = data.domainList || [];
      console.log('initDomainList: Получен список доменов из storage:', domains);
      
      // Если список пуст, добавим тестовый домен
      if (domains.length === 0) {
        console.log('initDomainList: Список пуст, добавляем тестовый домен');
        const testDomains = ['example.com', 'test-domain.com'];
        
        // Отображаем тестовые домены в UI
        populateDomainList(testDomains);
        
        // Сохраняем их в хранилище только если флаг тестовых данных установлен
        if (localStorage.getItem('showTestData') === 'true') {
          chrome.storage.sync.set({ domainList: testDomains });
        }
      } else {
        // Если есть домены, отображаем их
        populateDomainList(domains);
      }
    });
  }
}

// Изменить язык интерфейса
async function changeLanguage(lang) {
  try {
    console.log('changeLanguage: Установка языка:', lang);
    
    if (!lang || lang === currentLanguage) {
      console.log('changeLanguage: Язык не изменился или не указан');
      return;
    }
    
    // Сохраняем язык прямо в хранилище для немедленного эффекта
    await chrome.storage.sync.set({ language: lang });
    console.log('changeLanguage: Язык сохранен в отдельную запись');
    
    // Также устанавливаем язык через централизованную конфигурацию для синхронизации
    await TripleSubmitConfig.setLanguage(lang);
    console.log('changeLanguage: Язык установлен через конфигурацию');
    
    // Обновляем текущий язык в опциях
    currentLanguage = lang;
    
    // Устанавливаем атрибут lang у HTML
    document.documentElement.lang = lang;
    
    // Обновляем страницу для применения нового языка
    updateLanguageUI(lang);
    
    // Отображаем сообщение о смене языка
    updateStatusMessage(chrome.i18n.getMessage('language_changed') || 'Язык изменен', true);
    
    // Обновляем настройки, чтобы сохранить язык и там тоже
    try {
      const data = await chrome.storage.sync.get('settings');
      if (data.settings) {
        const updatedSettings = {...data.settings, language: lang};
        await chrome.storage.sync.set({ settings: updatedSettings });
        console.log('changeLanguage: Язык также обновлен в настройках');
        
        // Обновляем локальные настройки
        currentSettings = updatedSettings;
      }
    } catch (settingsError) {
      console.error('Ошибка при обновлении языка в настройках:', settingsError);
    }
    
    // Обновляем флаг наличия изменений
    hasChanges = true;
    updateSaveButton();
  } catch (error) {
    console.error('Ошибка при изменении языка:', error);
    updateStatusMessage('Ошибка при изменении языка', false);
  }
}

// Асинхронно загружает настройки и обновляет UI
async function loadSettings() {
  console.log('loadSettings: Загрузка настроек');
  try {
    const data = await chrome.storage.sync.get('settings');
    
    if (data.settings) {
      console.log('loadSettings: Настройки получены:', data.settings);
      currentSettings = data.settings;
      
      // Обновляем UI на основе настроек
      updateUI(currentSettings);
      
      // Обновляем список доменов из настроек
      loadDomainsFromSettings(currentSettings);
    } else {
      console.log('loadSettings: Настройки не найдены, используем значения по умолчанию');
      // Настройки не найдены, используем значения по умолчанию
      getDefaultSettings().then(defaults => {
        currentSettings = defaults;
        updateUI(currentSettings);
        loadDomainsFromSettings(currentSettings);
      });
    }
  } catch (error) {
    console.error('loadSettings: Ошибка при загрузке настроек:', error);
    updateStatusMessage('Ошибка при загрузке настроек', false);
  }
}

// Загружает домены из настроек в зависимости от режима (белый/черный список)
function loadDomainsFromSettings(settings) {
  console.log('loadDomainsFromSettings: Загрузка доменов из настроек');
  
  // Проверяем настройки
  if (!settings) {
    console.error('loadDomainsFromSettings: Настройки не определены');
    return;
  }
  
  let domains = [];
  
  // Режим белого или черного списка
  const domainMode = settings.domainMode || 'whitelist';
  
  // В зависимости от режима загружаем соответствующий список
  if (domainMode === 'whitelist') {
    if (settings.whitelist && Array.isArray(settings.whitelist)) {
      domains = settings.whitelist;
      console.log('loadDomainsFromSettings: Загружен белый список:', domains);
    } else if (settings.blacklistMode === false && Array.isArray(settings.whitelist)) {
      // Обратная совместимость со старым форматом
      domains = settings.whitelist;
      console.log('loadDomainsFromSettings: Загружен белый список (старый формат):', domains);
    }
  } else {
    if (settings.blacklist && Array.isArray(settings.blacklist)) {
      domains = settings.blacklist;
      console.log('loadDomainsFromSettings: Загружен черный список:', domains);
    } else if (settings.blacklistMode === true && Array.isArray(settings.blacklist)) {
      // Обратная совместимость со старым форматом
      domains = settings.blacklist;
      console.log('loadDomainsFromSettings: Загружен черный список (старый формат):', domains);
    }
  }
  
  // Обновляем UI
  populateDomainList(domains);
}

// Заполняет список доменов
function populateDomainList(domains) {
  console.log('populateDomainList: Заполнение списка доменов:', domains);
  const domainList = document.getElementById('domain-list');
  
  if (!domainList) {
    console.error('populateDomainList: Элемент #domain-list не найден!');
    return;
  }
  
  // Убедимся, что список виден
  domainList.style.display = 'block';
  
  // Очищаем текущий список
  domainList.innerHTML = '';
  
  if (!domains || domains.length === 0) {
    // Если список пуст, показываем сообщение
    console.log('populateDomainList: Список пуст, показываем сообщение');
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-domain-message';
    emptyMessage.textContent = chrome.i18n.getMessage('domain_list_empty') || 'Список доменов пуст';
    domainList.appendChild(emptyMessage);
    
    // Добавим явно тестовый домен, чтобы показать, как будет выглядеть элемент списка
    if (localStorage.getItem('showTestData') === 'true') {
      console.log('populateDomainList: Добавляем тестовый домен для отображения');
      
      setTimeout(() => {
        const testItem = document.createElement('div');
        testItem.className = 'domain-item';
        testItem.innerHTML = `
          <span class="domain-text">example.com (тестовый, не сохранен)</span>
          <button class="remove-domain-button" title="Удалить домен">&times;</button>
        `;
        domainList.appendChild(testItem);
        
        testItem.querySelector('.remove-domain-button').addEventListener('click', () => {
          testItem.remove();
          // Показываем сообщение снова, если список теперь пуст
          if (domainList.children.length === 0) {
            domainList.appendChild(emptyMessage);
          }
        });
      }, 1000); // Добавляем с задержкой для наглядности
    }
    
    return;
  }
  
  // Заполняем список доменами
  domains.forEach(domain => {
    const domainItem = document.createElement('div');
    domainItem.className = 'domain-item';
    
    const domainText = document.createElement('span');
    domainText.className = 'domain-text';
    domainText.textContent = domain;
    
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-domain-button';
    removeButton.innerHTML = '&times;';
    removeButton.title = chrome.i18n.getMessage('remove_domain') || 'Удалить домен';
    
    removeButton.addEventListener('click', () => {
      removeDomain(domain);
    });
    
    domainItem.appendChild(domainText);
    domainItem.appendChild(removeButton);
    domainList.appendChild(domainItem);
  });
  
  // Обновляем заголовок списка
  const domainListTitle = document.getElementById('domain-list-title');
  if (domainListTitle) {
    const listMode = document.getElementById('domain-mode-select').value;
    domainListTitle.textContent = 
      listMode === 'whitelist' 
        ? (chrome.i18n.getMessage('whitelist') || 'Белый список') 
        : (chrome.i18n.getMessage('blacklist') || 'Черный список');
  }
}

// Функция для добавления домена
async function addDomain() {
  const domainInput = document.getElementById('domain-input');
  const domain = domainInput.value.trim();
  
  if (!domain) {
    updateStatusMessage(chrome.i18n.getMessage('empty_domain') || 'Введите домен', false);
    return;
  }
  
  try {
    // Определяем режим работы со списком
    const domainMode = document.getElementById('domain-mode-select').value;
    const currentList = domainMode === 'whitelist' ? 'whitelist' : 'blacklist';
    
    // Получаем текущие настройки
    const data = await chrome.storage.sync.get('settings');
    let settings = data.settings || await getDefaultSettings();
    
    // Убеждаемся, что список существует
    if (!Array.isArray(settings[currentList])) {
      settings[currentList] = [];
    }
    
    // Проверяем, существует ли уже такой домен
    if (settings[currentList].includes(domain)) {
      updateStatusMessage(chrome.i18n.getMessage('domain_exists') || 'Домен уже добавлен', false);
      return;
    }
    
    // Добавляем домен в список
    settings[currentList].push(domain);
    settings.domainMode = domainMode; // Сохраняем текущий режим
    
    // Сохраняем обновленные настройки
    await chrome.storage.sync.set({ settings });
    console.log(`Домен ${domain} добавлен в ${currentList}`);
    
    // Обновляем текущие настройки
    currentSettings = settings;
    
    // Очищаем поле ввода
    domainInput.value = '';
    
    // Обновляем UI
    loadDomainsFromSettings(settings);
    
    // Показываем сообщение об успехе
    updateStatusMessage(chrome.i18n.getMessage('domain_added') || 'Домен добавлен', true);
    
    // Обновляем флаг наличия изменений
    hasChanges = true;
    updateSaveButton();
  } catch (error) {
    console.error('addDomain: Ошибка при добавлении домена:', error);
    updateStatusMessage('Ошибка при добавлении домена', false);
  }
}

// Удаление домена из списка
async function removeDomain(domain) {
  console.log('removeDomain: Удаление домена:', domain);
  try {
    // Определяем режим работы со списком
    const domainMode = document.getElementById('domain-mode-select').value;
    const currentList = domainMode === 'whitelist' ? 'whitelist' : 'blacklist';
    
    // Получаем текущие настройки
    const data = await chrome.storage.sync.get('settings');
    let settings = data.settings || await getDefaultSettings();
    
    // Убеждаемся, что список существует
    if (!Array.isArray(settings[currentList])) {
      settings[currentList] = [];
      console.warn(`Список ${currentList} не существует, создан пустой список`);
      return;
    }
    
    // Удаляем домен из списка
    settings[currentList] = settings[currentList].filter(d => d !== domain);
    
    // Сохраняем обновленные настройки
    await chrome.storage.sync.set({ settings });
    console.log(`Домен ${domain} удален из ${currentList}`);
    
    // Обновляем текущие настройки
    currentSettings = settings;
    
    // Обновляем UI
    loadDomainsFromSettings(settings);
    
    // Показываем сообщение об успехе
    updateStatusMessage(chrome.i18n.getMessage('domain_removed') || 'Домен удален', true);
    
    // Обновляем флаг наличия изменений
    hasChanges = true;
    updateSaveButton();
  } catch (error) {
    console.error('removeDomain: Ошибка при удалении домена:', error);
    updateStatusMessage('Ошибка при удалении домена', false);
  }
}

// Обновляет сообщение о статусе
function updateStatusMessage(message, isSuccess = true) {
  const statusMessageEl = document.getElementById('status-message');
  if (!statusMessageEl) return;
  
  console.log(`updateStatusMessage: ${isSuccess ? 'Успех' : 'Ошибка'}: ${message}`);
  
  statusMessageEl.textContent = message;
  statusMessageEl.className = `status-message ${isSuccess ? 'status-success' : 'status-error'}`;
  
  // Автоматически скрываем сообщение через 3 секунды
  setTimeout(() => {
    statusMessageEl.textContent = '';
    statusMessageEl.className = 'status-message';
  }, 3000);
}

// Обновляет состояние кнопки сохранения
function updateSaveButton() {
  const saveButton = document.getElementById('save-button');
  if (!saveButton) return;
  
  console.log('updateSaveButton: Обновление состояния кнопки сохранения, hasChanges:', hasChanges);
  
  if (hasChanges) {
    saveButton.classList.add('has-changes');
    saveButton.disabled = false;
  } else {
    saveButton.classList.remove('has-changes');
    saveButton.disabled = true;
  }
}

// Обновляет UI в соответствии с выбранным языком
function updateLanguageUI(lang) {
  console.log('updateLanguageUI: Обновление интерфейса для языка:', lang);
  
  // Устанавливаем атрибут lang у HTML
  document.documentElement.lang = lang;
  
  // Обновляем текст для всех переводимых элементов
  // Здесь мы можем использовать chrome.i18n для получения переводов
  
  // Заголовки
  document.querySelector('h1').textContent = chrome.i18n.getMessage('extName') || 'Triple Submit';
  document.querySelectorAll('h2').forEach(h2 => {
    const key = h2.textContent.toLowerCase().replace(/\s+/g, '_');
    const translation = chrome.i18n.getMessage(key);
    if (translation) h2.textContent = translation;
  });
  
  // Подсказки для кнопок
  document.getElementById('language-button').title = chrome.i18n.getMessage('language_select') || 'Выбор языка';
  document.getElementById('light-theme-button').title = chrome.i18n.getMessage('light_theme') || 'Светлая тема';
  document.getElementById('dark-theme-button').title = chrome.i18n.getMessage('dark_theme') || 'Темная тема';
  
  // Кнопки сохранения и сброса
  document.getElementById('save-button').textContent = chrome.i18n.getMessage('save_changes') || 'Сохранить изменения';
  document.getElementById('reset-button').textContent = chrome.i18n.getMessage('reset_settings') || 'Сбросить настройки';
  
  // Режимы списка доменов
  const domainModeSelect = document.getElementById('domain-mode-select');
  if (domainModeSelect) {
    const options = domainModeSelect.options;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      const key = option.value === 'whitelist' ? 'whitelist_description' : 'blacklist_description';
      const translation = chrome.i18n.getMessage(key);
      if (translation) option.textContent = translation;
    }
  }
  
  // Заголовок списка доменов
  const listMode = domainModeSelect ? domainModeSelect.value : 'whitelist';
  const domainListTitle = document.getElementById('domain-list-title');
  if (domainListTitle) {
    domainListTitle.textContent = 
      listMode === 'whitelist' 
        ? (chrome.i18n.getMessage('whitelist') || 'Белый список') 
        : (chrome.i18n.getMessage('blacklist') || 'Черный список');
  }
  
  // Плейсхолдер для ввода домена
  const domainInput = document.getElementById('domain-input');
  if (domainInput) {
    domainInput.placeholder = chrome.i18n.getMessage('domain_placeholder') || 'example.com';
  }
  
  // Кнопка добавления домена
  const addDomainButton = document.getElementById('add-domain-button');
  if (addDomainButton) {
    addDomainButton.textContent = chrome.i18n.getMessage('add_domain') || 'Добавить домен';
  }
  
  // Кнопка перехода на премиум
  const upgradeButton = document.getElementById('upgrade-button');
  if (upgradeButton) {
    upgradeButton.textContent = chrome.i18n.getMessage('upgrade_premium') || 'Перейти на Премиум';
  }
}

// Показывает выпадающее меню выбора языка
function showLanguageMenu() {
  console.log('showLanguageMenu: Показ меню выбора языка');
  
  // Проверяем, существует ли уже меню
  let languageMenu = document.getElementById('language-menu');
  
  // Если меню уже существует, просто переключаем его видимость
  if (languageMenu) {
    languageMenu.style.display = languageMenu.style.display === 'none' ? 'block' : 'none';
    return;
  }
  
  // Создаем меню
  languageMenu = document.createElement('div');
  languageMenu.id = 'language-menu';
  languageMenu.className = 'language-menu';
  
  // Получаем список языков и их названий
  const supportedLanguages = TripleSubmitConfig.getSupportedLanguages();
  const languageNames = TripleSubmitConfig.getLanguageNames();
  
  // Добавляем пункты меню для каждого языка
  supportedLanguages.forEach(lang => {
    const menuItem = document.createElement('div');
    menuItem.className = `language-menu-item ${lang === currentLanguage ? 'active' : ''}`;
    menuItem.dataset.lang = lang;
    menuItem.textContent = languageNames[lang] || lang;
    
    // При клике на пункт меню меняем язык и скрываем меню
    menuItem.addEventListener('click', () => {
      if (lang !== currentLanguage) {
        changeLanguage(lang);
      }
      languageMenu.style.display = 'none';
    });
    
    languageMenu.appendChild(menuItem);
  });
  
  // Позиционируем меню рядом с кнопкой выбора языка
  const languageButton = document.getElementById('language-button');
  const rect = languageButton.getBoundingClientRect();
  
  // Добавляем меню в DOM
  document.body.appendChild(languageMenu);
  
  // Позиционируем меню
  languageMenu.style.position = 'absolute';
  languageMenu.style.top = `${rect.bottom + window.scrollY}px`;
  languageMenu.style.left = `${rect.left + window.scrollX}px`;
  languageMenu.style.zIndex = '1000';
  
  // Добавляем обработчик для закрытия меню при клике вне его
  document.addEventListener('click', function closeMenu(e) {
    if (!languageMenu.contains(e.target) && e.target !== languageButton) {
      languageMenu.style.display = 'none';
      document.removeEventListener('click', closeMenu);
    }
  });
}

// Прикрепляет обработчики событий к элементам UI
function attachEventListeners() {
  console.log('attachEventListeners: Прикрепление обработчиков событий');
  
  // Кнопки темы
  document.getElementById('light-theme-button').addEventListener('click', () => {
    document.body.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
  });
  
  document.getElementById('dark-theme-button').addEventListener('click', () => {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  });
  
  // Кнопка сохранения
  document.getElementById('save-button').addEventListener('click', saveSettings);
  
  // Кнопка сброса
  document.getElementById('reset-button').addEventListener('click', resetSettings);
  
  // Переключатель расширения
  document.getElementById('extension-toggle').addEventListener('change', function() {
    hasChanges = true;
    updateSaveButton();
  });
  
  // Выбор режима
  document.getElementById('mode-select').addEventListener('change', function() {
    const mode = this.value;
    
    // Показать соответствующее описание режима
    document.querySelectorAll('.mode-description').forEach(desc => {
      desc.style.display = 'none';
    });
    
    document.getElementById(`${mode}-mode-description`).style.display = 'block';
    
    hasChanges = true;
    updateSaveButton();
  });
  
  // Контроль количества нажатий
  document.getElementById('decrease-count').addEventListener('click', function() {
    const countInput = document.getElementById('press-count');
    const count = parseInt(countInput.value);
    if (count > 1) {
      countInput.value = count - 1;
      hasChanges = true;
      updateSaveButton();
    }
  });
  
  document.getElementById('increase-count').addEventListener('click', function() {
    const countInput = document.getElementById('press-count');
    const count = parseInt(countInput.value);
    if (count < 5) {
      countInput.value = count + 1;
      hasChanges = true;
      updateSaveButton();
    }
  });
  
  document.getElementById('press-count').addEventListener('change', function() {
    hasChanges = true;
    updateSaveButton();
  });
  
  // Контроль временного окна
  document.getElementById('time-window').addEventListener('change', function() {
    hasChanges = true;
    updateSaveButton();
  });
  
  // Переключатель визуальной обратной связи
  document.getElementById('feedback-toggle').addEventListener('change', function() {
    hasChanges = true;
    updateSaveButton();
  });
  
  // Выбор режима списка доменов
  document.getElementById('domain-mode-select').addEventListener('change', function() {
    const listMode = this.value;
    document.getElementById('domain-list-title').textContent = 
      listMode === 'whitelist' 
        ? (chrome.i18n.getMessage('whitelist') || 'Белый список') 
        : (chrome.i18n.getMessage('blacklist') || 'Черный список');
    
    hasChanges = true;
    updateSaveButton();
  });
  
  // Добавление домена
  document.getElementById('add-domain-button').addEventListener('click', addDomain);
  
  // Ввод домена с клавиатуры (Enter)
  document.getElementById('domain-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addDomain();
    }
  });
}

// Сбросить настройки
async function resetSettings() {
  console.log('resetSettings: Сброс настроек');
  
  if (confirm(chrome.i18n.getMessage('confirm_reset') || 'Вы уверены, что хотите сбросить все настройки?')) {
    try {
      // Получаем настройки по умолчанию
      const defaultSettings = await getDefaultSettings();
      
      // Сохраняем настройки по умолчанию
      await chrome.storage.sync.set({ settings: defaultSettings });
      
      // Сбрасываем список доменов
      await chrome.storage.sync.set({ domainList: [] });
      
      // Обновляем UI
      currentSettings = defaultSettings;
      updateUI(currentSettings);
      populateDomainList([]);
      
      // Показываем сообщение об успехе
      updateStatusMessage(chrome.i18n.getMessage('settings_reset') || 'Настройки сброшены', true);
      
      // Сбрасываем флаг наличия изменений
      hasChanges = false;
      updateSaveButton();
    } catch (error) {
      console.error('resetSettings: Ошибка при сбросе настроек:', error);
      updateStatusMessage('Ошибка при сбросе настроек', false);
    }
  }
}

// Получить настройки по умолчанию
async function getDefaultSettings() {
  console.log('getDefaultSettings: Получение настроек по умолчанию');
  
  const defaultSettings = {
    enabled: true,
    mode: 'normal',
    pressCount: 3,
    timeWindow: 200,
    visualFeedback: true,
    domainMode: 'whitelist',  // Режим списка доменов (whitelist или blacklist)
    whitelist: [],            // Белый список доменов
    blacklist: [],            // Черный список доменов
    language: await TripleSubmitConfig.getLanguage(),
    theme: 'light',
    isPremium: false
  };
  
  console.log('getDefaultSettings: Настройки по умолчанию:', defaultSettings);
  return defaultSettings;
}

// Обновляет UI на основе настроек
function updateUI(settings) {
  console.log('updateUI: Обновление интерфейса на основе настроек:', settings);
  
  if (!settings) {
    console.error('updateUI: Настройки не определены');
    return;
  }
  
  // Переключатель расширения
  const extensionToggle = document.getElementById('extension-toggle');
  if (extensionToggle) {
    extensionToggle.checked = settings.enabled !== false; // По умолчанию включено
  }
  
  // Режим работы
  const modeSelect = document.getElementById('mode-select');
  if (modeSelect) {
    modeSelect.value = settings.mode || 'normal';
    
    // Показать соответствующее описание режима
    document.querySelectorAll('.mode-description').forEach(desc => {
      desc.style.display = 'none';
    });
    
    const modeDescription = document.getElementById(`${settings.mode || 'normal'}-mode-description`);
    if (modeDescription) {
      modeDescription.style.display = 'block';
    }
  }
  
  // Количество нажатий
  const pressCount = document.getElementById('press-count');
  if (pressCount) {
    pressCount.value = settings.pressCount || 3;
  }
  
  // Временное окно
  const timeWindow = document.getElementById('time-window');
  if (timeWindow) {
    timeWindow.value = settings.timeWindow || 200;
  }
  
  // Визуальная обратная связь
  const feedbackToggle = document.getElementById('feedback-toggle');
  if (feedbackToggle) {
    feedbackToggle.checked = settings.visualFeedback !== false; // По умолчанию включено
  }
  
  // Режим списка доменов
  const domainModeSelect = document.getElementById('domain-mode-select');
  if (domainModeSelect) {
    // Поддержка как нового (domainMode), так и старого (blacklistMode) формата
    let domainMode = 'whitelist';
    
    if (settings.domainMode) {
      // Новый формат
      domainMode = settings.domainMode;
    } else if (settings.blacklistMode !== undefined) {
      // Старый формат
      domainMode = settings.blacklistMode ? 'blacklist' : 'whitelist';
    }
    
    domainModeSelect.value = domainMode;
    
    // Обновляем заголовок списка доменов
    const domainListTitle = document.getElementById('domain-list-title');
    if (domainListTitle) {
      domainListTitle.textContent = 
        domainMode === 'whitelist' 
          ? (chrome.i18n.getMessage('whitelist') || 'Белый список') 
          : (chrome.i18n.getMessage('blacklist') || 'Черный список');
    }
    
    // Загружаем соответствующий список доменов
    loadDomainsFromSettings(settings);
  }
  
  // Статус Premium
  updatePremiumUI(settings.isPremium);
  
  // Сбрасываем флаг наличия изменений
  hasChanges = false;
  updateSaveButton();
}

// Обновляет UI для Premium
function updatePremiumUI(isPremium) {
  console.log('updatePremiumUI: Обновление Premium UI, isPremium:', isPremium);
  
  const premiumCard = document.querySelector('.premium-card');
  const upgradeButton = document.getElementById('upgrade-button');
  
  if (isPremium) {
    if (premiumCard) {
      premiumCard.classList.add('is-premium');
    }
    
    if (upgradeButton) {
      upgradeButton.textContent = chrome.i18n.getMessage('premium_status') || 'Premium активирован';
      upgradeButton.disabled = true;
    }
  } else {
    if (premiumCard) {
      premiumCard.classList.remove('is-premium');
    }
    
    if (upgradeButton) {
      upgradeButton.textContent = chrome.i18n.getMessage('upgrade_premium') || 'Перейти на Premium';
      upgradeButton.disabled = false;
    }
  }
}

// Сохранить настройки
async function saveSettings() {
  console.log('saveSettings: Сохранение настроек');
  
  try {
    // Получаем текущие настройки, чтобы не потерять другие поля
    const data = await chrome.storage.sync.get('settings');
    let settings = data.settings || await getDefaultSettings();
    
    // Собираем настройки из UI
    const newSettings = {
      enabled: document.getElementById('extension-toggle').checked,
      mode: document.getElementById('mode-select').value,
      pressCount: parseInt(document.getElementById('press-count').value),
      timeWindow: parseInt(document.getElementById('time-window').value),
      visualFeedback: document.getElementById('feedback-toggle').checked,
      domainMode: document.getElementById('domain-mode-select').value,
      language: currentLanguage,
      isPremium: settings.isPremium || false
    };
    
    // Сохраняем списки доменов и другие поля, которых нет в форме
    if (settings.whitelist) newSettings.whitelist = settings.whitelist;
    if (settings.blacklist) newSettings.blacklist = settings.blacklist;
    
    // Если списков нет, создаем пустые
    if (!Array.isArray(newSettings.whitelist)) newSettings.whitelist = [];
    if (!Array.isArray(newSettings.blacklist)) newSettings.blacklist = [];
    
    console.log('saveSettings: Новые настройки:', newSettings);
    
    // Сохраняем настройки
    await chrome.storage.sync.set({ settings: newSettings });
    
    // Обновляем текущие настройки
    currentSettings = newSettings;
    
    // Показываем сообщение об успехе
    updateStatusMessage(chrome.i18n.getMessage('settings_saved') || 'Настройки сохранены', true);
    
    // Сбрасываем флаг наличия изменений
    hasChanges = false;
    updateSaveButton();
  } catch (error) {
    console.error('saveSettings: Ошибка при сохранении настроек:', error);
    updateStatusMessage('Ошибка при сохранении настроек', false);
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initOptions);