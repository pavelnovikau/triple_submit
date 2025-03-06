// Key press handler for Chrome extension

// Logger module for better debugging
const Logger = {
  debug: function(message, data) {
    console.debug(`[Triple Submit] ${message}`, data || '');
  },
  info: function(message, data) {
    console.info(`[Triple Submit] ${message}`, data || '');
  },
  warn: function(message, data) {
    console.warn(`[Triple Submit] ${message}`, data || '');
  },
  error: function(message, data) {
    console.error(`[Triple Submit] ERROR: ${message}`, data || '');
  }
};

// Track Enter key presses
let enterPressCount = 0;
let lastEnterPressTime = 0;
let domainSettings = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 5;
let usageTracked = false; // Flag to track if usage was counted

// Array to store Enter key press times
let enterPresses = [];

// Detect browser type
function detectBrowser() {
  const userAgent = navigator.userAgent;
  
  // Enhanced detection for Arc browser
  try {
    // Check multiple Arc indicators
    const isArc = (
      // Check user agent
      (userAgent.includes('Chrome') && userAgent.includes('Arc/')) ||
      // Check for Arc class on HTML element
      document.documentElement.classList.contains('arc-window') ||
      // Check for Arc global object
      typeof window.arc !== 'undefined' ||
      // Check for Arc color scheme data attributes
      document.documentElement.hasAttribute('data-arc-stylesheets') ||
      // Check for specific Arc element in DOM
      !!document.querySelector('.arc-panel')
    );
    
    if (isArc) {
      Logger.info('Arc browser detected');
      return 'arc';
    }
  } catch (error) {
    Logger.error('Error detecting Arc browser:', error);
  }
  
  // Other Chromium-based browsers
  if (userAgent.includes('Chrome')) {
    return 'chrome';
  }
  
  // Firefox
  if (userAgent.includes('Firefox')) {
    return 'firefox';
  }
  
  return 'unknown';
}

const browserType = detectBrowser();
Logger.info(`Browser detected: ${browserType}`);

// Increment usage counter
function incrementUsage() {
  if (usageTracked) return; // Don't count repeatedly
  
  usageTracked = true; // Mark usage as counted
  
  try {
    chrome.runtime.sendMessage({ action: 'incrementUsage' }, (response) => {
      if (chrome.runtime.lastError) {
        Logger.error('Error incrementing usage:', chrome.runtime.lastError);
        return;
      }
      
      if (response && response.usageData) {
        Logger.info('Usage incremented, count:', response.usageData.count);
        
        // If limit is reached and user is not premium
        if (response.usageData.count >= 20 && 
            (!domainSettings.isPremium || domainSettings.isPremium === false)) {
          Logger.info('Usage limit reached, Premium upgrade recommended');
        }
      }
    });
  } catch (error) {
    Logger.error('Error sending usage data:', error);
  }
}

// Get settings for current domain
function getDomainSettings() {
  return new Promise((resolve, reject) => {
    try {
      // Get current domain
      const hostname = window.location.hostname;
      Logger.debug('Getting settings for domain:', hostname);
      
      // Request settings from background script
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        // Check for runtime error
        if (chrome.runtime.lastError) {
          Logger.error('Error getting settings:', chrome.runtime.lastError);
          useDefaultSettings(resolve);
          return;
        }
        
        // Check for valid response
        if (response && response.settings) {
          domainSettings = response.settings;
          Logger.info('Received settings:', domainSettings);
          
          // Check if domain is allowed
          chrome.runtime.sendMessage({ 
            action: 'checkDomain', 
            domain: hostname 
          }, (domainResponse) => {
            if (chrome.runtime.lastError) {
              Logger.error('Error checking domain:', chrome.runtime.lastError);
              resolve(domainSettings); // Use received settings, but without domain check
              return;
            }
            
            if (domainResponse && domainResponse.isEnabled !== undefined) {
              // Update domain enable status
              domainSettings.domainEnabled = domainResponse.isEnabled;
              Logger.info(`Domain ${hostname} enabled:`, domainSettings.domainEnabled);
              
              // By default, domain is disabled (isEnabled will be false)
              resolve(domainSettings);
            } else {
              Logger.error('Invalid domain response:', domainResponse);
              resolve(domainSettings);
            }
          });
        } else {
          Logger.error('Invalid settings response:', response);
          useDefaultSettings(resolve);
        }
      });
    } catch (error) {
      Logger.error('Error in getDomainSettings:', error);
      useDefaultSettings(resolve);
    }
  });
}

// Use default settings
function useDefaultSettings(resolve) {
  Logger.warn('Using default settings due to error');
  domainSettings = {
    domainEnabled: false, // Disabled by default
    pressCount: 3,
    showFeedback: true,
    isPremium: false,
    delay: 200,
    mode: 'normal' // Добавляем режим по умолчанию
  };
  resolve(domainSettings);
}

// Initialize with retry
function initializeWithRetry() {
  if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
    Logger.error('Maximum initialization attempts reached');
    return;
  }
  
  initializationAttempts++;
  Logger.info(`Initialization attempt ${initializationAttempts}`);
  
  // Устанавливаем базовые обработчики событий сразу, чтобы не пропустить нажатия клавиш
  if (initializationAttempts === 1) {
    // Временные настройки для первой инициализации
    const tempSettings = {
      domainEnabled: false, // Начинаем с выключенного состояния
      pressCount: 3,
      showFeedback: true,
      delay: 600
    };
    
    Logger.info('Setting up initial key listeners with default settings before getting actual settings');
    initKeyListeners(tempSettings);
  }
  
  // Получаем актуальные настройки
  getDomainSettings()
    .then((settings) => {
      // Обновляем глобальные настройки
      domainSettings = settings;
      Logger.info('Updated settings from background:', settings);
    })
    .catch((error) => {
      Logger.error('Error during initialization:', error);
      
      // Retry after a delay
      setTimeout(() => {
        initializeWithRetry();
      }, 500 * initializationAttempts); // Increasing delay with each attempt
    });
}

// Initialize key listeners
function initKeyListeners(settings) {
  // Reset press counter
  enterPressCount = 0;
  lastEnterPressTime = 0;
  enterPresses = [];
  
  // Save settings globally for immediate use
  domainSettings = settings;
  
  // Log the current state
  Logger.info(`Extension ${settings.domainEnabled ? 'enabled' : 'disabled'} for this domain with settings:`, settings);
  
  // We always add the listeners, but they will check domainSettings.domainEnabled before taking action
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  
  // Add handler for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated') {
      Logger.info('Settings updated:', message);
      
      // Update settings
      const oldEnabled = domainSettings ? domainSettings.domainEnabled : false;
      domainSettings = { ...domainSettings, ...message.settings };
      
      // Update domain enable status
      if (message.domainEnabled !== undefined) {
        domainSettings.domainEnabled = message.domainEnabled;
      }
      
      // Reset press counter
      enterPressCount = 0;
      lastEnterPressTime = 0;
      enterPresses = [];
      
      // Log the change for debugging
      Logger.info(`Domain enable status changed from ${oldEnabled} to ${domainSettings.domainEnabled}`);
      
      // Проверяем флаг принудительной активации
      if (message.forceActivation) {
        Logger.info(`Received forceActivation flag with timestamp ${message.timestamp}`);
        
        // Если расширение включено для этого домена, немедленно активируем все обработчики
        if (domainSettings.domainEnabled) {
          Logger.info('Force activating all handlers for immediate effect');
          
          // Принудительно активируем обработчики форм
          addFormSubmitHandlers();
          
          // Принудительно активируем обработчики Shadow DOM
          addShadowDomHandlers();
          
          // Принудительно проверяем все формы на странице
          const forms = document.querySelectorAll('form');
          Logger.info(`Found ${forms.length} forms on the page for force activation`);
          
          // Добавляем обработчики для всех форм с высоким приоритетом
          forms.forEach((form, index) => {
            // Удаляем предыдущий обработчик, если он был
            if (form.dataset.tripleSubmitHandled) {
              // Пытаемся удалить старый обработчик, чтобы избежать дублирования
              try {
                const oldHandler = form._tripleSubmitHandler;
                if (oldHandler) {
                  form.removeEventListener('submit', oldHandler, true);
                }
              } catch (e) {
                Logger.debug(`Could not remove old handler for form #${index}: ${e.message}`);
              }
            }
            
            Logger.debug(`Force adding submit handler for form #${index}`);
            
            // Создаем новый обработчик
            const submitHandler = (event) => {
              // Проверяем, включено ли расширение для этого домена
              if (domainSettings && domainSettings.domainEnabled) {
                // Проверяем режим работы
                if (domainSettings.mode === '3mode') {
                  // В режиме 3mode всегда предотвращаем отправку формы
                  Logger.info('Preventing form submission in 3mode (force handler)');
                  event.preventDefault();
                  event.stopPropagation();
                  
                  // Показываем визуальный отклик
                  if (domainSettings.showFeedback) {
                    const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
                      detail: {
                        currentCount: 1,
                        requiredCount: 1,
                        isComplete: false,
                        isFormSubmit: true,
                        is3Mode: true,
                        isForceActivated: true
                      }
                    });
                    document.dispatchEvent(feedbackEvent);
                  }
                  
                  return false;
                }
                
                // Если количество нажатий меньше требуемого, предотвращаем отправку
                if (enterPressCount < domainSettings.pressCount) {
                  Logger.info(`Preventing form submission (force handler): enterPressCount=${enterPressCount}, required=${domainSettings.pressCount}`);
                  event.preventDefault();
                  event.stopPropagation();
                  
                  // Показываем визуальный отклик
                  if (domainSettings.showFeedback) {
                    const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
                      detail: {
                        currentCount: enterPressCount,
                        requiredCount: domainSettings.pressCount,
                        isComplete: false,
                        isFormSubmit: true,
                        isForceActivated: true
                      }
                    });
                    document.dispatchEvent(feedbackEvent);
                  }
                  
                  return false;
                } else {
                  Logger.info(`Form submission allowed after ${enterPressCount} Enter presses (force handler)`);
                }
              }
              
              return true;
            };
            
            // Сохраняем ссылку на обработчик для возможного удаления в будущем
            form._tripleSubmitHandler = submitHandler;
            
            // Отмечаем форму как обработанную
            form.dataset.tripleSubmitHandled = 'true';
            form.dataset.tripleSubmitForceActivated = 'true';
            
            // Добавляем обработчик события submit с высоким приоритетом
            form.addEventListener('submit', submitHandler, true);
          });
          
          // Добавляем глобальный обработчик клавиш с высоким приоритетом
          const globalKeyHandler = (event) => {
            if (event.key === 'Enter' && domainSettings && domainSettings.domainEnabled) {
              Logger.debug('Global force-activated Enter key handler triggered');
              
              // Проверяем режим работы
              if (domainSettings.mode === '3mode') {
                // В режиме 3mode всегда вставляем новую строку
                Logger.info('3mode active in global handler: inserting line break');
                
                // Предотвращаем стандартное действие
                event.preventDefault();
                event.stopPropagation();
                
                // Проверяем, является ли элемент текстовым полем
                if (isTextInput(event.target)) {
                  // Вставляем перенос строки
                  alternativeAction(event);
                }
                
                // Показываем визуальный отклик
                if (domainSettings.showFeedback) {
                  const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
                    detail: {
                      currentCount: 1,
                      requiredCount: 1,
                      isComplete: true,
                      is3Mode: true
                    }
                  });
                  document.dispatchEvent(feedbackEvent);
                }
                
                return false;
              }
              
              // Для обычного режима используем стандартный обработчик
              handleKeyDown(event);
            }
          };
          
          // Добавляем глобальный обработчик с высоким приоритетом
          document.addEventListener('keydown', globalKeyHandler, true);
          
          // Добавляем обработчик для document.body, чтобы перехватить события до того, как они достигнут форм
          if (document.body) {
            document.body.addEventListener('keydown', globalKeyHandler, true);
          }
          
          // Добавляем обработчики для всех iframe на странице
          const iframes = document.querySelectorAll('iframe');
          Logger.info(`Found ${iframes.length} iframes on the page for force activation`);
          
          iframes.forEach((iframe, index) => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              if (iframeDoc) {
                Logger.debug(`Adding force handlers to iframe #${index}`);
                iframeDoc.addEventListener('keydown', globalKeyHandler, true);
                
                // Также добавляем обработчики для форм внутри iframe
                const iframeForms = iframeDoc.querySelectorAll('form');
                Logger.debug(`Found ${iframeForms.length} forms in iframe #${index}`);
                
                iframeForms.forEach((form, formIndex) => {
                  form.addEventListener('submit', submitHandler, true);
                });
              }
            } catch (e) {
              // Ошибка доступа к iframe из-за Same-Origin Policy
              Logger.debug(`Could not access iframe #${index}: ${e.message}`);
            }
          });
        }
      }
      
      // Если это приоритетное обновление (для активной вкладки)
      if (message.isPriorityUpdate) {
        Logger.info('This is a priority update for the active tab');
        
        // Если расширение было только что включено, добавляем дополнительную проверку
        if (!oldEnabled && domainSettings.domainEnabled) {
          Logger.info('Extension was just enabled for this domain, forcing immediate activation');
          
          // Принудительно проверяем все формы на странице
          const forms = document.querySelectorAll('form');
          Logger.info(`Found ${forms.length} forms on the page`);
          
          // Добавляем дополнительный обработчик для всех форм
          forms.forEach((form, index) => {
            Logger.debug(`Adding special form handler for form #${index}`);
            
            // Предотвращаем стандартную отправку формы
            form.addEventListener('submit', (event) => {
              if (domainSettings.domainEnabled && enterPressCount < domainSettings.pressCount) {
                Logger.info(`Preventing form submission: enterPressCount=${enterPressCount}, required=${domainSettings.pressCount}`);
                event.preventDefault();
                event.stopPropagation();
                return false;
              }
              return true;
            }, true);
          });
        }
      }
      
      sendResponse({ status: 'ok' });
    }
  });
}

// Debug key events
function logKeyEvent(event, source) {
  if (event.key === 'Enter') {
    Logger.debug(`Enter key event from ${source} in ${browserType} browser:`, {
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      modifiers: {
        Control: event.getModifierState('Control'),
        Shift: event.getModifierState('Shift'),
        Alt: event.getModifierState('Alt'),
        Meta: event.getModifierState('Meta'),
        AltGraph: event.getModifierState('AltGraph')
      }
    });
  }
}

// Список специальных сайтов, требующих особой обработки
const specialSites = [
  { domain: 'chat.openai.com', selector: '.stretch' },
  { domain: 'chatgpt.com', selector: '[role="textbox"], [contenteditable], .text-input, [data-testid="text-input"]' },
  { domain: 'bard.google.com', selector: '.ql-editor' },
  { domain: 'claude.ai', selector: '[contenteditable]' },
  { domain: 'github.com', selector: '.comment-form-textarea' }
];

// Проверка, является ли текущий сайт специальным
function isSpecialSite() {
  const hostname = window.location.hostname;
  return specialSites.find(site => hostname.includes(site.domain));
}

// Получение специального селектора для текущего сайта
function getSpecialSelector() {
  const specialSite = isSpecialSite();
  return specialSite ? specialSite.selector : null;
}

// Улучшенная функция для определения текстовых полей
function isTextInput(element) {
  if (!element) return false;
  
  // Стандартные текстовые поля
  if (element.matches('textarea, [contenteditable="true"], [contenteditable=""], input[type="text"], input:not([type])')) {
    return true;
  }
  
  // Проверка для специальных сайтов
  const specialSelector = getSpecialSelector();
  if (specialSelector && element.matches(specialSelector)) {
    return true;
  }
  
  // Проверка на родительские элементы для сложных UI
  let parent = element.parentElement;
  for (let i = 0; i < 5 && parent; i++) { // Проверяем до 5 уровней вверх
    if (specialSelector && parent.matches(specialSelector)) {
      return true;
    }
    parent = parent.parentElement;
  }
  
  return false;
}

// Key down handler
function handleKeyDown(event) {
  // Log key event for debugging
  logKeyEvent(event, 'keydown');
  
  // Check if extension is enabled for this domain with more explicit logging
  if (!domainSettings) {
    Logger.debug('No domain settings available, ignoring Enter key');
    return;
  }
  
  if (!domainSettings.domainEnabled) {
    Logger.debug('Extension disabled for this domain, ignoring Enter key');
    return;
  }
  
  // Проверяем, активирован ли режим "3mode" (всегда вставлять новую строку)
  if (domainSettings.mode === '3mode' && event.key === 'Enter') {
    Logger.info('3mode active: Enter key will insert line break instead of submitting form');
    
    // Prevent default action
    event.preventDefault();
    event.stopPropagation();
    
    // Insert line break
    if (isTextInput(event.target)) {
      alternativeAction(event);
    }
    
    // Show visual feedback
    if (domainSettings.showFeedback) {
      const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
        detail: {
          currentCount: 1,
          requiredCount: 1,
          isComplete: false,
          is3Mode: true,
          isLineBreakInserted: true
        }
      });
      document.dispatchEvent(feedbackEvent);
    }
    
    return;
  }
  
  // For enter key only - add extra logs
  if (event.key === 'Enter') {
    Logger.info(`Enter key detected with domain enabled=${domainSettings.domainEnabled}, pressCount=${domainSettings.pressCount}, mode=${domainSettings.mode || 'normal'}`);
  }
  
  // Ignore repeat events from key holding
  if (event.repeat) return;
  
  // Special handling for Arc browser
  if (browserType === 'arc') {
    // In Arc, we need more robust checking of modifier keys
    if (event.key === 'Enter' && (
        event.shiftKey || 
        event.ctrlKey || 
        event.altKey || 
        event.metaKey || 
        event.getModifierState('Control') || 
        event.getModifierState('Alt') || 
        event.getModifierState('Meta') || 
        event.getModifierState('Shift'))) {
      Logger.debug('Modifier key pressed with Enter in Arc browser, bypassing processing');
      return; // Skip processing, allowing standard action
    }
  } else {
    // Standard handling for other browsers
    // Allow any modifier + Enter to bypass processing (Shift, Ctrl, Alt, Meta/Command)
    if (event.key === 'Enter' && (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)) {
      Logger.debug('Modifier key pressed with Enter, bypassing processing');
      return; // Skip processing, allowing standard action
    }
  }
  
  if (event.key === 'Enter') {
    // Current time to track incoming presses
    const now = Date.now();
    
    // Check time interval between presses
    if (lastEnterPressTime > 0 && (now - lastEnterPressTime > domainSettings.delay)) {
      // Too much time passed, reset counter
      Logger.debug('Time between presses exceeded delay, resetting counter');
      enterPressCount = 0;
      enterPresses = [];
    }
    
    // Add current press to array
    enterPresses.push(now);
    
    // Update counter and last press time
    enterPressCount++;
    lastEnterPressTime = now;
    
    Logger.debug(`Enter key pressed. Count: ${enterPressCount}/${domainSettings.pressCount}. Current settings: `, { pressCount: domainSettings.pressCount, delay: domainSettings.delay });
    
    // Extended mode is always active - insert line break instead of form submission
    if (enterPressCount < domainSettings.pressCount) {
      event.preventDefault();
      event.stopPropagation();
      
      // Проверяем, является ли элемент текстовым полем с улучшенной функцией
      if (isTextInput(event.target)) {
        alternativeAction(event);
      }
      
      // Show visual feedback
      if (domainSettings.showFeedback) {
        // Send event to visualFeedback.js
        const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
          detail: {
            currentCount: enterPressCount,
            requiredCount: domainSettings.pressCount,
            isComplete: false,
            isLineBreakInserted: true
          }
        });
        document.dispatchEvent(feedbackEvent);
      }
    } else {
      // Enough Enter presses, allow form submission
      Logger.info(`Form submission allowed after ${enterPressCount} Enter presses`);
      
      // Show completion feedback
      if (domainSettings.showFeedback) {
        const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
          detail: {
            currentCount: enterPressCount,
            requiredCount: domainSettings.pressCount,
            isComplete: true
          }
        });
        document.dispatchEvent(feedbackEvent);
      }
      
      // Reset counter after successful submission
      enterPressCount = 0;
      enterPresses = [];
      
      // Track usage
      if (!usageTracked) {
        chrome.runtime.sendMessage({ action: 'incrementUsage' });
        usageTracked = true;
        
        // Reset usage tracking after a delay
        setTimeout(() => {
          usageTracked = false;
        }, 10000); // Reset after 10 seconds
      }
    }
  }
}

// Alternative action - insert line break
function alternativeAction(event) {
  try {
    const element = event.target;
    const specialSite = isSpecialSite();
    
    // Специальная обработка для известных сайтов
    if (specialSite) {
      Logger.info(`Using special handling for ${specialSite.domain}`);
      
      // Для ChatGPT и подобных сайтов
      if (specialSite.domain.includes('chat.openai.com') || specialSite.domain.includes('chatgpt.com')) {
        return handleChatGPT(element);
      }
      
      // Для других специальных сайтов можно добавить специфичную обработку
    }
    
    // Стандартная обработка для обычных сайтов
    if (element.matches('textarea, [contenteditable="true"], [contenteditable=""]')) {
      // For textarea and contenteditable elements
      const doc = element.ownerDocument;
      
      // Special handling for Arc browser
      if (browserType === 'arc') {
        Logger.debug('Using Arc-specific line break insertion');
        
        if (element.matches('[contenteditable="true"], [contenteditable=""]')) {
          // Insert br element directly for Arc browser
          const selection = window.getSelection();
          const range = selection.getRangeAt(0);
          const br = document.createElement('br');
          range.deleteContents();
          range.insertNode(br);
          
          // Move cursor after the br
          range.setStartAfter(br);
          range.setEndAfter(br);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          // For textarea in Arc
          const start = element.selectionStart;
          const end = element.selectionEnd;
          element.value = element.value.substring(0, start) + '\n' + element.value.substring(end);
          element.selectionStart = element.selectionEnd = start + 1;
        }
      } else {
        // Универсальный метод вставки переноса строки
        insertLineBreak(element);
      }
    } else if (element.matches('input')) {
      // For standard input fields - can't add line breaks
      Logger.debug('Cannot add line break in standard input field');
    } else {
      // Для других элементов пробуем найти ближайший contenteditable
      const closestContentEditable = findClosestContentEditable(element);
      if (closestContentEditable) {
        Logger.debug('Found closest contenteditable element, inserting line break there');
        insertLineBreak(closestContentEditable);
      }
    }
  } catch (error) {
    Logger.error('Error in alternativeAction:', error);
  }
}

// Функция для поиска ближайшего contenteditable элемента
function findClosestContentEditable(element) {
  // Проверяем сам элемент
  if (element.isContentEditable) {
    return element;
  }
  
  // Проверяем специальный селектор
  const specialSelector = getSpecialSelector();
  if (specialSelector) {
    // Проверяем, соответствует ли элемент специальному селектору
    if (element.matches(specialSelector)) {
      return element;
    }
    
    // Ищем ближайший элемент, соответствующий специальному селектору
    const closest = element.closest(specialSelector);
    if (closest) {
      return closest;
    }
  }
  
  // Проверяем родителей
  let parent = element.parentElement;
  for (let i = 0; i < 5 && parent; i++) {
    if (parent.isContentEditable || 
        parent.matches('[contenteditable="true"], [contenteditable=""]') ||
        (specialSelector && parent.matches(specialSelector))) {
      return parent;
    }
    parent = parent.parentElement;
  }
  
  // Ищем внутри элемента
  const contentEditableChild = element.querySelector('[contenteditable="true"], [contenteditable=""]');
  if (contentEditableChild) {
    return contentEditableChild;
  }
  
  // Если специальный селектор задан, ищем по нему
  if (specialSelector) {
    const specialElement = element.querySelector(specialSelector);
    if (specialElement) {
      return specialElement;
    }
  }
  
  return null;
}

// Универсальная функция вставки переноса строки
function insertLineBreak(element) {
  try {
    // Для contenteditable элементов
    if (element.isContentEditable || element.matches('[contenteditable="true"], [contenteditable=""]')) {
      // Пробуем использовать execCommand
      try {
        element.ownerDocument.execCommand('insertLineBreak');
        return;
      } catch (e) {
        Logger.debug('execCommand failed, trying alternative method');
      }
      
      // Альтернативный метод - вставка <br> элемента
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const br = document.createElement('br');
        range.deleteContents();
        range.insertNode(br);
        
        // Перемещаем курсор после <br>
        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } 
    // Для textarea
    else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      element.value = element.value.substring(0, start) + '\n' + element.value.substring(end);
      element.selectionStart = element.selectionEnd = start + 1;
    }
  } catch (error) {
    Logger.error('Error in insertLineBreak:', error);
  }
}

// Специальная обработка для ChatGPT
function handleChatGPT(element) {
  try {
    // Находим текстовое поле ChatGPT
    const chatInput = findChatGPTInput(element);
    if (!chatInput) {
      Logger.warn('Could not find ChatGPT input element');
      return;
    }
    
    Logger.info('Found ChatGPT input element, inserting line break');
    
    // Вставляем перенос строки
    if (chatInput.isContentEditable) {
      // Для contenteditable
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const br = document.createElement('br');
        range.deleteContents();
        range.insertNode(br);
        
        // Перемещаем курсор после <br>
        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Имитируем событие ввода для обновления UI
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      // Для textarea
      const start = chatInput.selectionStart;
      const end = chatInput.selectionEnd;
      chatInput.value = chatInput.value.substring(0, start) + '\n' + chatInput.value.substring(end);
      chatInput.selectionStart = chatInput.selectionEnd = start + 1;
      
      // Имитируем событие ввода для обновления UI
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    return true;
  } catch (error) {
    Logger.error('Error in handleChatGPT:', error);
    return false;
  }
}

// Функция для поиска текстового поля в ChatGPT
function findChatGPTInput(element) {
  // Известные селекторы для ChatGPT
  const chatGPTSelectors = [
    '.stretch',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '.ProseMirror',
    // Дополнительные селекторы для chatgpt.com
    '[data-testid="send-button"]',
    '[data-message-author-role]',
    '.text-input'
  ];
  
  // Проверяем сам элемент
  for (const selector of chatGPTSelectors) {
    if (element.matches(selector)) {
      return element;
    }
  }
  
  // Ищем по селекторам в документе
  for (const selector of chatGPTSelectors) {
    const input = document.querySelector(selector);
    if (input) {
      return input;
    }
  }
  
  // Ищем ближайший подходящий элемент
  for (const selector of chatGPTSelectors) {
    const closest = element.closest(selector);
    if (closest) {
      return closest;
    }
  }
  
  // Для chatgpt.com пробуем найти текстовое поле по атрибутам
  if (window.location.hostname === 'chatgpt.com') {
    // Ищем по роли
    const textboxByRole = document.querySelector('[role="textbox"]');
    if (textboxByRole) return textboxByRole;
    
    // Ищем по data-testid
    const textboxByTestId = document.querySelector('[data-testid="text-input"]');
    if (textboxByTestId) return textboxByTestId;
    
    // Ищем по классу
    const textboxByClass = document.querySelector('.text-input');
    if (textboxByClass) return textboxByClass;
    
    // Ищем любой contenteditable
    const anyContentEditable = document.querySelector('[contenteditable]');
    if (anyContentEditable) return anyContentEditable;
  }
  
  return null;
}

// Key up handler
function handleKeyUp(event) {
  // Log key event for debugging
  logKeyEvent(event, 'keyup');
  
  // Nothing special for now
}

// Функция для добавления обработчиков событий формы
function addFormSubmitHandlers() {
  // Находим все формы на странице
  const forms = document.querySelectorAll('form');
  Logger.info(`Found ${forms.length} forms on the page`);
  
  // Добавляем обработчик для каждой формы
  forms.forEach((form, index) => {
    // Проверяем, не добавлен ли уже обработчик
    if (form.dataset.tripleSubmitHandled) {
      return;
    }
    
    Logger.debug(`Adding submit handler for form #${index}`);
    
    // Отмечаем форму как обработанную
    form.dataset.tripleSubmitHandled = 'true';
    
    // Добавляем обработчик события submit
    form.addEventListener('submit', (event) => {
      // Проверяем, включено ли расширение для этого домена
      if (domainSettings && domainSettings.domainEnabled) {
        // Проверяем режим работы
        if (domainSettings.mode === '3mode') {
          // В режиме 3mode всегда предотвращаем отправку формы
          Logger.info('Preventing form submission in 3mode');
          event.preventDefault();
          event.stopPropagation();
          
          // Показываем визуальный отклик
          if (domainSettings.showFeedback) {
            const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
              detail: {
                currentCount: 1,
                requiredCount: 1,
                isComplete: false,
                isFormSubmit: true,
                is3Mode: true
              }
            });
            document.dispatchEvent(feedbackEvent);
          }
          
          return false;
        }
        
        // Если количество нажатий меньше требуемого, предотвращаем отправку
        if (enterPressCount < domainSettings.pressCount) {
          Logger.info(`Preventing form submission: enterPressCount=${enterPressCount}, required=${domainSettings.pressCount}`);
          event.preventDefault();
          event.stopPropagation();
          
          // Показываем визуальный отклик
          if (domainSettings.showFeedback) {
            const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
              detail: {
                currentCount: enterPressCount,
                requiredCount: domainSettings.pressCount,
                isComplete: false,
                isFormSubmit: true
              }
            });
            document.dispatchEvent(feedbackEvent);
          }
          
          return false;
        } else {
          Logger.info(`Form submission allowed after ${enterPressCount} Enter presses`);
        }
      }
      
      return true;
    }, true); // Используем capture phase для перехвата события до других обработчиков
  });
}

// Функция для наблюдения за изменениями в DOM и добавления обработчиков для новых форм
function setupFormObserver() {
  // Создаем наблюдатель за изменениями в DOM
  const observer = new MutationObserver((mutations) => {
    let shouldAddHandlers = false;
    
    // Проверяем, были ли добавлены новые формы
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Если добавлен элемент формы
            if (node.tagName === 'FORM') {
              shouldAddHandlers = true;
              break;
            }
            
            // Если внутри добавленного элемента есть формы
            if (node.querySelectorAll) {
              const forms = node.querySelectorAll('form');
              if (forms.length > 0) {
                shouldAddHandlers = true;
                break;
              }
            }
          }
        }
      }
      
      if (shouldAddHandlers) {
        break;
      }
    }
    
    // Если были добавлены новые формы, добавляем обработчики
    if (shouldAddHandlers) {
      Logger.debug('DOM changed, adding form submit handlers for new forms');
      addFormSubmitHandlers();
    }
  });
  
  // Начинаем наблюдение за всем документом
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

// Функция для поиска всех Shadow DOM на странице
function findAllShadowRoots() {
  const shadowHosts = [];
  const allElements = document.querySelectorAll('*');
  
  // Проверяем все элементы на наличие Shadow DOM
  allElements.forEach(element => {
    if (element.shadowRoot) {
      shadowHosts.push(element);
    }
  });
  
  return shadowHosts;
}

// Функция для добавления обработчиков событий в Shadow DOM
function addShadowDomHandlers() {
  const shadowHosts = findAllShadowRoots();
  Logger.info(`Found ${shadowHosts.length} Shadow DOM hosts on the page`);
  
  shadowHosts.forEach((host, index) => {
    const shadowRoot = host.shadowRoot;
    
    // Проверяем, не добавлен ли уже обработчик
    if (shadowRoot.dataset && shadowRoot.dataset.tripleSubmitHandled) {
      return;
    }
    
    Logger.debug(`Adding handlers for Shadow DOM #${index}`);
    
    // Отмечаем Shadow DOM как обработанный
    try {
      shadowRoot.dataset = shadowRoot.dataset || {};
      shadowRoot.dataset.tripleSubmitHandled = 'true';
    } catch (e) {
      // Некоторые Shadow DOM могут быть закрытыми и не позволять изменять dataset
      Logger.debug(`Could not mark Shadow DOM #${index} as handled: ${e.message}`);
    }
    
    // Добавляем обработчик клавиш
    shadowRoot.addEventListener('keydown', (event) => {
      // Если нажата клавиша Enter и расширение включено
      if (event.key === 'Enter' && domainSettings && domainSettings.domainEnabled) {
        // Логируем событие
        Logger.debug(`Enter key detected in Shadow DOM #${index}`);
        
        // Обрабатываем событие так же, как и в основном документе
        handleKeyDown(event);
      }
    }, true);
    
    // Находим все формы в Shadow DOM
    const forms = shadowRoot.querySelectorAll('form');
    Logger.debug(`Found ${forms.length} forms in Shadow DOM #${index}`);
    
    // Добавляем обработчики для форм
    forms.forEach((form, formIndex) => {
      // Проверяем, не добавлен ли уже обработчик
      if (form.dataset && form.dataset.tripleSubmitHandled) {
        return;
      }
      
      Logger.debug(`Adding submit handler for form #${formIndex} in Shadow DOM #${index}`);
      
      // Отмечаем форму как обработанную
      try {
        form.dataset = form.dataset || {};
        form.dataset.tripleSubmitHandled = 'true';
      } catch (e) {
        Logger.debug(`Could not mark form #${formIndex} in Shadow DOM #${index} as handled: ${e.message}`);
      }
      
      // Добавляем обработчик события submit
      form.addEventListener('submit', (event) => {
        // Проверяем, включено ли расширение для этого домена
        if (domainSettings && domainSettings.domainEnabled) {
          // Если количество нажатий меньше требуемого, предотвращаем отправку
          if (enterPressCount < domainSettings.pressCount) {
            Logger.info(`Preventing form submission in Shadow DOM: enterPressCount=${enterPressCount}, required=${domainSettings.pressCount}`);
            event.preventDefault();
            event.stopPropagation();
            
            // Показываем визуальный отклик
            if (domainSettings.showFeedback) {
              const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
                detail: {
                  currentCount: enterPressCount,
                  requiredCount: domainSettings.pressCount,
                  isComplete: false,
                  isFormSubmit: true,
                  isShadowDom: true
                }
              });
              document.dispatchEvent(feedbackEvent);
            }
            
            return false;
          } else {
            Logger.info(`Form submission in Shadow DOM allowed after ${enterPressCount} Enter presses`);
          }
        }
        
        return true;
      }, true);
    });
    
    // Рекурсивно ищем Shadow DOM внутри текущего Shadow DOM
    const nestedHosts = shadowRoot.querySelectorAll('*');
    nestedHosts.forEach(nestedElement => {
      if (nestedElement.shadowRoot) {
        // Рекурсивно добавляем обработчики для вложенного Shadow DOM
        addShadowDomHandlersRecursive(nestedElement.shadowRoot, `${index}.nested`);
      }
    });
  });
}

// Рекурсивная функция для обработки вложенных Shadow DOM
function addShadowDomHandlersRecursive(shadowRoot, path) {
  // Проверяем, не добавлен ли уже обработчик
  if (shadowRoot.dataset && shadowRoot.dataset.tripleSubmitHandled) {
    return;
  }
  
  Logger.debug(`Adding handlers for nested Shadow DOM ${path}`);
  
  // Отмечаем Shadow DOM как обработанный
  try {
    shadowRoot.dataset = shadowRoot.dataset || {};
    shadowRoot.dataset.tripleSubmitHandled = 'true';
  } catch (e) {
    Logger.debug(`Could not mark nested Shadow DOM ${path} as handled: ${e.message}`);
  }
  
  // Добавляем обработчик клавиш
  shadowRoot.addEventListener('keydown', (event) => {
    // Если нажата клавиша Enter и расширение включено
    if (event.key === 'Enter' && domainSettings && domainSettings.domainEnabled) {
      // Логируем событие
      Logger.debug(`Enter key detected in nested Shadow DOM ${path}`);
      
      // Обрабатываем событие так же, как и в основном документе
      handleKeyDown(event);
    }
  }, true);
  
  // Находим все формы в Shadow DOM
  const forms = shadowRoot.querySelectorAll('form');
  Logger.debug(`Found ${forms.length} forms in nested Shadow DOM ${path}`);
  
  // Добавляем обработчики для форм
  forms.forEach((form, formIndex) => {
    // Аналогично основной функции addShadowDomHandlers
    // ...
  });
  
  // Рекурсивно ищем Shadow DOM внутри текущего Shadow DOM
  const nestedHosts = shadowRoot.querySelectorAll('*');
  nestedHosts.forEach(nestedElement => {
    if (nestedElement.shadowRoot) {
      // Рекурсивно добавляем обработчики для вложенного Shadow DOM
      addShadowDomHandlersRecursive(nestedElement.shadowRoot, `${path}.nested`);
    }
  });
}

// Функция для наблюдения за изменениями в DOM и поиска новых Shadow DOM
function setupShadowDomObserver() {
  // Создаем наблюдатель за изменениями в DOM
  const observer = new MutationObserver((mutations) => {
    let shouldCheckShadowDom = false;
    
    // Проверяем, были ли добавлены новые элементы
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldCheckShadowDom = true;
        break;
      }
    }
    
    // Если были добавлены новые элементы, проверяем наличие Shadow DOM
    if (shouldCheckShadowDom) {
      Logger.debug('DOM changed, checking for new Shadow DOM elements');
      addShadowDomHandlers();
    }
  });
  
  // Начинаем наблюдение за всем документом
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  Logger.info('DOM content loaded, initializing Safe Enter AI-helper');
  
  // Инициализация с задержкой для обеспечения стабильной загрузки расширения
  setTimeout(() => {
    initializeWithRetry();
    
    // Добавляем обработчики для форм
    addFormSubmitHandlers();
    
    // Настраиваем наблюдатель за изменениями в DOM
    const formObserver = setupFormObserver();
    
    // Добавляем обработчики для Shadow DOM
    addShadowDomHandlers();
    
    // Настраиваем наблюдатель за Shadow DOM
    const shadowDomObserver = setupShadowDomObserver();
    
    // Регистрируем глобального слушателя событий для перехвата всех нажатий Enter
    Logger.info('Adding global document-level event listeners for all Enter key presses');
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        Logger.debug('Global Enter key detected');
        // Immediate check if we have domain settings and if they're enabled
        if (domainSettings && domainSettings.domainEnabled) {
          Logger.debug(`Global listener: domainEnabled=${domainSettings.domainEnabled}`);
        }
      }
    }, true);
  }, 100);
});

// Alternative initialization for Chrome extensions on already loaded pages
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  Logger.info('Page already loaded, initializing Safe Enter AI-helper immediately');
  initializeWithRetry();
  
  // Добавляем обработчики для форм
  addFormSubmitHandlers();
  
  // Настраиваем наблюдатель за изменениями в DOM
  const formObserver = setupFormObserver();
  
  // Добавляем обработчики для Shadow DOM
  addShadowDomHandlers();
  
  // Настраиваем наблюдатель за Shadow DOM
  const shadowDomObserver = setupShadowDomObserver();
  
  // Add global listener here too
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      Logger.debug('Global Enter key detected (from already loaded page)');
      if (domainSettings && domainSettings.domainEnabled) {
        Logger.debug(`Global listener: domainEnabled=${domainSettings.domainEnabled}`);
      }
    }
  }, true);
}

// Export functions for testing
if (typeof module !== 'undefined') {
  module.exports = {
    getDomainSettings,
    initKeyListeners,
    handleKeyDown
  };
}