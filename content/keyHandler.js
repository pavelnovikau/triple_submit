// Key press handler for Chrome extension

// Track Enter key presses
let enterPressCount = 0;
let lastEnterPressTime = 0;
let domainSettings = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 5;

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

// Get settings from background script
function getSettings() {
  return new Promise((resolve, reject) => {
    try {
      // Проверка, доступен ли Chrome API
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        console.error('Triple Submit: Chrome runtime API not available');
        useDefaultSettings(resolve);
        return;
      }

      chrome.runtime.sendMessage({ action: 'checkDomain' }, (response) => {
        // Проверка на ошибку runtime
        if (chrome.runtime.lastError) {
          console.error('Triple Submit: Error getting settings:', chrome.runtime.lastError);
          useDefaultSettings(resolve);
          return;
        }
        
        // Проверка на валидность ответа
        if (response && response.domainSettings) {
          domainSettings = response.domainSettings;
          console.log('Triple Submit: Received settings:', domainSettings);
          resolve(domainSettings);
        } else {
          console.warn('Triple Submit: No settings received, using defaults');
          useDefaultSettings(resolve);
        }
      });
    } catch (error) {
      console.error('Triple Submit: Exception in getSettings:', error);
      useDefaultSettings(resolve);
    }
  });
}

// Use default settings as fallback
function useDefaultSettings(resolve) {
  // Default fallback settings if we can't get from background
  domainSettings = {
    isEnabled: true,
    mode: 'alternative',  // Используем alternative как безопасный режим по умолчанию
    pressCount: 3,
    timeWindow: 200,
    visualFeedback: true
  };
  
  if (browserType === 'arc') {
    // Специальные настройки для Arc браузера
    domainSettings.mode = 'alternative';
    console.log('Triple Submit: Using Arc-specific settings');
  }
  
  resolve(domainSettings);
}

// Initialize settings with retry mechanism
function initializeWithRetry() {
  initializationAttempts++;
  console.log(`Triple Submit: Initialization attempt ${initializationAttempts} for ${browserType} browser`);
  
  getSettings()
    .then(initKeyListeners)
    .catch(error => {
      console.error('Triple Submit: Failed to initialize:', error);
      
      if (initializationAttempts < MAX_INIT_ATTEMPTS) {
        // Retry initialization after delay with exponential backoff
        const delay = Math.min(1000 * Math.pow(1.5, initializationAttempts - 1), 10000);
        console.log(`Triple Submit: Retrying in ${delay}ms...`);
        setTimeout(initializeWithRetry, delay);
      } else {
        // Fall back to default settings after max attempts
        console.error('Triple Submit: Max initialization attempts reached, using defaults');
        initKeyListeners(domainSettings || {
          isEnabled: true,
          mode: 'alternative',
          pressCount: 3,
          timeWindow: 200,
          visualFeedback: true
        });
      }
    });
}

// Start initialization with delay for Arc browser
if (browserType === 'arc') {
  console.log('Triple Submit: Delaying initialization for Arc browser');
  setTimeout(initializeWithRetry, 500);
} else {
  initializeWithRetry();
}

// Handle key events
function initKeyListeners(settings) {
  if (!settings.isEnabled) {
    console.log('Triple Submit: Extension disabled for this domain');
    return; // Extension disabled for this domain
  }

  try {
    // Удаляем существующий обработчик, чтобы избежать дублирования
    document.removeEventListener('keydown', handleKeyDown, true);
    
    // Добавляем новый обработчик
    document.addEventListener('keydown', handleKeyDown, true);
    console.log('Triple Submit: Key listeners initialized with settings:', settings);
  } catch (error) {
    console.error('Triple Submit: Error initializing key listeners:', error);
  }
}

// Handle key down events
function handleKeyDown(event) {
  // Проверяем, что настройки инициализированы
  if (!domainSettings || !domainSettings.isEnabled) {
    console.log('Triple Submit: Event ignored, extension disabled or not initialized');
    return;
  }

  const isEnterKey = event.key === 'Enter';
  const isShiftEnterKey = event.key === 'Enter' && event.shiftKey;
  
  try {
    // Normal mode: No interference with keyboard behavior
    if (domainSettings.mode === 'normal') {
      // Do nothing, allow all keys to work as normal
      return;
    }
    // Alternative mode: Require multiple Enter, convert Shift+Enter to single Enter
    else if (domainSettings.mode === 'alternative') {
      if (isShiftEnterKey) {
        try {
          // Convert Shift+Enter to regular Enter
          let newEvent;
          
          // Специальный код для Arc браузера
          if (browserType === 'arc') {
            // Более простой подход для Arc, без лишних свойств
            newEvent = new KeyboardEvent('keydown', { 
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              bubbles: true
            });
            
            // Prevent original event
            event.preventDefault();
            event.stopPropagation();
            
            // В Arc просто запускаем стандартное поведение Enter
            if (event.target && typeof event.target.form !== 'undefined' && event.target.form) {
              console.log('Triple Submit: Arc - Submitting form directly');
              event.target.form.submit();
            } else {
              console.log('Triple Submit: Arc - Dispatching simple Enter event');
              event.target.dispatchEvent(newEvent);
            }
          } else {
            // Стандартный подход для других браузеров
            newEvent = new KeyboardEvent('keydown', { 
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
              composed: true,
              shiftKey: false // Remove the shift key modifier
            });
            
            // Prevent original event
            event.preventDefault();
            event.stopPropagation();
            
            // Dispatch new event without shift key
            event.target.dispatchEvent(newEvent);
          }
        } catch (error) {
          console.error('Triple Submit: Error handling Shift+Enter:', error);
          // В случае ошибки, не блокируем оригинальное событие
        }
        return;
      }
      else if (isEnterKey && !event.shiftKey) {
        // Handle regular Enter key - require multiple presses
        const currentTime = Date.now();
        
        // Check if this is a new sequence or continuing an existing one
        if (currentTime - lastEnterPressTime > domainSettings.timeWindow) {
          // Reset the counter for a new sequence
          enterPressCount = 1;
        } else {
          // Increment the counter for continuing sequence
          enterPressCount++;
        }
        
        // Update the last press time
        lastEnterPressTime = currentTime;
        
        // Trigger visual feedback if enabled
        if (domainSettings.visualFeedback) {
          triggerVisualFeedback(enterPressCount, domainSettings.pressCount);
        }
        
        // Log current press count
        console.log(`Triple Submit: Enter press ${enterPressCount}/${domainSettings.pressCount}`);
        
        // Check if we've reached the required number of presses
        if (enterPressCount >= domainSettings.pressCount) {
          console.log('Triple Submit: Required press count reached, allowing submission');
          // Reset counter after submission
          enterPressCount = 0;
          return; // Allow the event to proceed
        }
        
        // Haven't reached required count, prevent default submission
        console.log('Triple Submit: Blocking submission, inserting line break instead');
        event.preventDefault();
        event.stopPropagation();
        
        // Вставляем перевод строки вместо отправки формы
        try {
          // Определяем целевой элемент для вставки переноса строки
          const targetElement = event.target;
          
          // Проверяем, что это текстовое поле или элемент с contenteditable
          const isTextField = targetElement.tagName === 'TEXTAREA' || 
                             (targetElement.tagName === 'INPUT' && targetElement.type === 'text') ||
                             targetElement.isContentEditable;
                             
          if (isTextField) {
            // Для текстовых полей и редактируемых элементов вставляем перенос строки
            if (targetElement.isContentEditable) {
              // Для contenteditable элементов
              document.execCommand('insertLineBreak');
              console.log('Triple Submit: Inserted line break in contenteditable element');
            } else if (targetElement.tagName === 'TEXTAREA' || (targetElement.tagName === 'INPUT' && targetElement.type === 'text')) {
              // Для textarea и input элементов вставляем символ новой строки
              const start = targetElement.selectionStart;
              const end = targetElement.selectionEnd;
              const value = targetElement.value;
              
              targetElement.value = value.substring(0, start) + '\n' + value.substring(end);
              
              // Устанавливаем курсор после вставленного символа новой строки
              targetElement.selectionStart = targetElement.selectionEnd = start + 1;
              console.log('Triple Submit: Inserted line break in input/textarea element');
            }
          } else {
            console.log('Triple Submit: Target element is not a text field, cannot insert line break');
          }
        } catch (error) {
          console.error('Triple Submit: Error inserting line break:', error);
        }
        
        return false;
      }
    }
  } catch (error) {
    console.error('Triple Submit: Error in handleKeyDown:', error);
    // В случае ошибки, разрешаем стандартное поведение клавиш
    return true;
  }
}

// Function to trigger visual feedback
function triggerVisualFeedback(currentCount, requiredCount) {
  // This will be implemented in visualFeedback.js
  // Here we just dispatch a custom event for that script to handle
  const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
    detail: {
      currentCount,
      requiredCount,
      isComplete: currentCount >= requiredCount
    }
  });
  
  document.dispatchEvent(feedbackEvent);
}

// Listen for setting changes from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'settingsUpdated') {
    getSettings().then((settings) => {
      // Remove existing listeners to avoid duplicates
      document.removeEventListener('keydown', handleKeyDown, true);
      
      // Reinitialize with new settings
      initKeyListeners(settings);
    });
  }
}); 