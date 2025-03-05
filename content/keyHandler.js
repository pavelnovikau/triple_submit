// Key press handler for Chrome extension

// Track Enter key presses
let enterPressCount = 0;
let lastEnterPressTime = 0;
let domainSettings = null;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Detect browser type
function detectBrowser() {
  const userAgent = navigator.userAgent;
  
  // Проверка Arc браузера (основан на Chromium)
  if (userAgent.includes('Chrome') && userAgent.includes('Arc/')) {
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
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ action: 'checkDomain' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Triple Submit: Error getting settings:', chrome.runtime.lastError);
          useDefaultSettings(resolve);
          return;
        }
        
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
  console.log(`Triple Submit: Initialization attempt ${initializationAttempts}`);
  
  getSettings()
    .then(initKeyListeners)
    .catch(error => {
      console.error('Triple Submit: Failed to initialize:', error);
      
      if (initializationAttempts < MAX_INIT_ATTEMPTS) {
        // Retry initialization after delay
        setTimeout(initializeWithRetry, 1000);
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

// Start initialization
initializeWithRetry();

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
  // Only handle if the extension is enabled for this domain
  if (!domainSettings || !domainSettings.isEnabled) {
    return;
  }

  const isEnterKey = event.key === 'Enter';
  const isShiftEnterKey = event.key === 'Enter' && event.shiftKey;
  
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
          // Используем более простой подход для Arc
          newEvent = new KeyboardEvent('keydown', { 
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
          });
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
        }
        
        // Prevent original event
        event.preventDefault();
        event.stopPropagation();
        
        // Dispatch new event without shift key
        event.target.dispatchEvent(newEvent);
      } catch (error) {
        console.error('Triple Submit: Error handling Shift+Enter:', error);
        // Позволяем оригинальному событию пройти в случае ошибки
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
      
      // If we haven't reached the required count, prevent the Enter key
      if (enterPressCount < domainSettings.pressCount) {
        try {
          event.preventDefault();
          event.stopPropagation();
        } catch (error) {
          console.error('Triple Submit: Error preventing Enter key:', error);
        }
      } else {
        // Reset counter after successful submission
        enterPressCount = 0;
      }
    }
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