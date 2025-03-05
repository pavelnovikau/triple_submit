// Key press handler for Chrome extension

// Track Enter key presses
let enterPressCount = 0;
let lastEnterPressTime = 0;
let domainSettings = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 5;
let usageTracked = false; // Флаг для отслеживания, было ли уже подсчитано использование

// Массив для хранения времени нажатий клавиши Enter
let enterPresses = [];

// Detect browser type
function detectBrowser() {
  const userAgent = navigator.userAgent;
  
  // Более полная проверка для Arc браузера
  if ((userAgent.includes('Chrome') && userAgent.includes('Arc/')) || 
      document.documentElement.classList.contains('arc-window') ||
      typeof window.arc !== 'undefined') {
    console.log('Triple Submit: Arc browser detected');
    return 'arc';
  }
  
  // Другие браузеры основанные на Chromium
  if (userAgent.includes('Chrome')) {
    return 'chrome';
  }
  
  return 'unknown';
}

const browserType = detectBrowser();
console.log('Triple Submit: Running in browser type:', browserType);

// Increment usage counter
function incrementUsage() {
  if (usageTracked) return; // Не считаем повторно
  
  usageTracked = true; // Отмечаем, что использование учтено
  
  try {
    chrome.runtime.sendMessage({ action: 'incrementUsage' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Triple Submit: Error incrementing usage:', chrome.runtime.lastError);
        return;
      }
      
      if (response && response.usageData) {
        console.log('Triple Submit: Usage incremented, count:', response.usageData.count);
        
        // Если достигнут лимит и пользователь не premium
        if (response.usageData.count >= 20 && 
            (!domainSettings.isPremium || domainSettings.isPremium === false)) {
          console.log('Triple Submit: Usage limit reached, Premium upgrade recommended');
        }
      }
    });
  } catch (error) {
    console.error('Triple Submit: Error sending usage data:', error);
  }
}

// Получаем настройки для текущего домена
function getDomainSettings() {
  return new Promise((resolve, reject) => {
    try {
      // Получаем текущий домен
      const hostname = window.location.hostname;
      
      // Запрашиваем настройки из background script
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        // Проверка на ошибку runtime
        if (chrome.runtime.lastError) {
          console.error('Triple Submit: Error getting settings:', chrome.runtime.lastError);
          useDefaultSettings(resolve);
          return;
        }
        
        // Проверка на валидность ответа
        if (response && response.settings) {
          domainSettings = response.settings;
          console.log('Triple Submit: Received settings:', domainSettings);
          
          // Проверяем, разрешен ли домен
          chrome.runtime.sendMessage({ 
            action: 'checkDomain', 
            domain: hostname 
          }, (domainResponse) => {
            if (chrome.runtime.lastError) {
              console.error('Triple Submit: Error checking domain:', chrome.runtime.lastError);
              resolve(domainSettings); // Используем полученные настройки, но без проверки домена
              return;
            }
            
            if (domainResponse && domainResponse.isEnabled !== undefined) {
              // Обновляем статус включения для домена
              domainSettings.enabled = domainResponse.isEnabled;
              console.log(`Triple Submit: Domain ${hostname} enabled:`, domainSettings.enabled);
              
              // По умолчанию, домен отключен (isEnabled будет false)
              resolve(domainSettings);
            } else {
              console.error('Triple Submit: Invalid domain response:', domainResponse);
              resolve(domainSettings);
            }
          });
        } else {
          console.error('Triple Submit: Invalid settings response:', response);
          useDefaultSettings(resolve);
        }
      });
    } catch (error) {
      console.error('Triple Submit: Error in getDomainSettings:', error);
      useDefaultSettings(resolve);
    }
  });
}

// Используем настройки по умолчанию
function useDefaultSettings(resolve) {
  console.log('Triple Submit: Using default settings');
  domainSettings = {
    enabled: false, // По умолчанию выключено
    pressCount: 3,
    showFeedback: true,
    isPremium: false,
    delay: 200
  };
  resolve(domainSettings);
}

// Инициализация с повторными попытками
function initializeWithRetry() {
  if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
    console.error('Triple Submit: Maximum initialization attempts reached');
    return;
  }
  
  initializationAttempts++;
  console.log(`Triple Submit: Initialization attempt ${initializationAttempts}`);
  
  getDomainSettings()
    .then((settings) => {
      initKeyListeners(settings);
    })
    .catch((error) => {
      console.error('Triple Submit: Error during initialization:', error);
      
      // Retry after a delay
      setTimeout(() => {
        initializeWithRetry();
      }, 500 * initializationAttempts); // Increasing delay with each attempt
    });
}

// Инициализация обработчиков клавиш
function initKeyListeners(settings) {
  // Сбрасываем счетчик нажатий
  enterPressCount = 0;
  lastEnterPressTime = 0;
  enterPresses = [];
  
  // Проверяем, включено ли расширение
  if (!settings.enabled) {
    console.log('Triple Submit: Extension disabled for this domain');
    return;
  }
  
  console.log('Triple Submit: Initializing key listeners with settings:', settings);
  
  // Добавляем обработчики событий
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  
  // Добавляем обработчик для обновления настроек
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated') {
      console.log('Triple Submit: Settings updated:', message);
      
      // Обновляем настройки
      domainSettings = { ...domainSettings, ...message.settings };
      
      // Обновляем статус включения для домена
      if (message.domainEnabled !== undefined) {
        domainSettings.enabled = message.domainEnabled;
      }
      
      // Сбрасываем счетчик нажатий
      enterPressCount = 0;
      lastEnterPressTime = 0;
      enterPresses = [];
      
      sendResponse({ status: 'ok' });
    }
  });
}

// Обработчик нажатия клавиш
function handleKeyDown(event) {
  // Проверяем, включено ли расширение
  if (!domainSettings || !domainSettings.enabled) {
    return;
  }
  
  // Игнорируем повторные события от удерживания клавиши
  if (event.repeat) return;
  
  // Shift+Enter всегда работает как обычный Enter
  if (event.key === 'Enter' && event.shiftKey) {
    return; // Пропускаем обработку, позволяя выполнить стандартное действие
  }
  
  if (event.key === 'Enter') {
    // Текущее время для отслеживания входящих нажатий
    const now = Date.now();
    
    // Проверяем временной интервал между нажатиями
    if (lastEnterPressTime > 0 && (now - lastEnterPressTime > domainSettings.delay)) {
      // Прошло слишком много времени, сбрасываем счетчик
      enterPressCount = 0;
      enterPresses = [];
    }
    
    // Добавляем текущее нажатие в массив
    enterPresses.push(now);
    
    // Обновляем счетчик и время последнего нажатия
    enterPressCount++;
    lastEnterPressTime = now;
    
    // Расширенный режим всегда активен - вставляем перенос строки вместо отправки формы
    if (enterPressCount < domainSettings.pressCount) {
      event.preventDefault();
      event.stopPropagation();
      
      // Добавляем перенос строки в текстовое поле
      if (event.target.matches('textarea, [contenteditable="true"], [contenteditable=""], input[type="text"], input:not([type])')) {
        alternativeAction(event);
      }
      
      // Показываем визуальный отклик
      if (domainSettings.showFeedback) {
        // Отправляем событие на visualFeedback.js
        const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
          detail: {
            currentCount: enterPressCount,
            requiredCount: domainSettings.pressCount
          }
        });
        document.dispatchEvent(feedbackEvent);
      }
    } else {
      // Достигнуто необходимое количество нажатий
      console.log('Triple Submit: Submit form');
      submitForm(event);
    }
  }
}

// Отправляем форму
function submitForm(event) {
  // Счетаем использование
  incrementUsage();
  
  // Сбрасываем счетчик
  enterPressCount = 0;
  enterPresses = [];
  
  // Показываем финальный визуальный отклик
  if (domainSettings.showFeedback) {
    const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
      detail: {
        currentCount: domainSettings.pressCount,
        requiredCount: domainSettings.pressCount
      }
    });
    document.dispatchEvent(feedbackEvent);
  }
}

// Альтернативное действие для текстовых полей (вставка переноса строки)
function alternativeAction(event) {
  if (event.target.setRangeText) {
    const start = event.target.selectionStart;
    const end = event.target.selectionEnd;
    event.target.setRangeText('\n', start, end, 'end');
    event.target.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (document.execCommand) {
    document.execCommand('insertText', false, '\n');
  }
}

// Обработчик отпускания клавиш
function handleKeyUp(event) {
  // Дополнительная логика при необходимости
}

// Запускаем инициализацию
initializeWithRetry(); 