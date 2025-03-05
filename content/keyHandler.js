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
    delay: 200
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
  
  getDomainSettings()
    .then((settings) => {
      initKeyListeners(settings);
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
  
  // Check if extension is enabled for this domain
  if (!settings.domainEnabled) {
    Logger.info('Extension disabled for this domain');
    return;
  }
  
  Logger.info('Initializing key listeners with settings:', settings);
  
  // Add event listeners
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  
  // Add handler for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'settingsUpdated') {
      Logger.info('Settings updated:', message);
      
      // Update settings
      domainSettings = { ...domainSettings, ...message.settings };
      
      // Update domain enable status
      if (message.domainEnabled !== undefined) {
        domainSettings.domainEnabled = message.domainEnabled;
      }
      
      // Reset press counter
      enterPressCount = 0;
      lastEnterPressTime = 0;
      enterPresses = [];
      
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

// Key down handler
function handleKeyDown(event) {
  // Log key event for debugging
  logKeyEvent(event, 'keydown');
  
  // Check if extension is enabled for this domain
  if (!domainSettings || !domainSettings.domainEnabled) {
    return;
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
      
      // Add line break in text field
      if (event.target.matches('textarea, [contenteditable="true"], [contenteditable=""], input[type="text"], input:not([type])')) {
        alternativeAction(event);
      }
      
      // Show visual feedback
      if (domainSettings.showFeedback) {
        // Send event to visualFeedback.js
        const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
          detail: {
            currentCount: enterPressCount,
            requiredCount: domainSettings.pressCount,
            isComplete: false
          }
        });
        document.dispatchEvent(feedbackEvent);
      }
    } else {
      // Enough Enter presses, allow form submission
      Logger.info(`Form submission allowed after ${enterPressCount} Enter presses`);
      
      // Show final visual feedback if enabled
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
      
      // Count usage for analytics
      incrementUsage();
      
      // Reset counter after successful submission
      setTimeout(() => {
        enterPressCount = 0;
        enterPresses = [];
      }, 100);
    }
  }
}

// Alternative action - insert line break
function alternativeAction(event) {
  try {
    // Handle different input types
    if (event.target.matches('textarea, [contenteditable="true"], [contenteditable=""]')) {
      // For textarea and contenteditable elements
      const element = event.target;
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
        // Create and dispatch a keyboard event for a line break
        const keyEvent = new KeyboardEvent('keypress', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
          composed: true
        });
        
        // Special handling for contenteditable
        if (element.matches('[contenteditable="true"], [contenteditable=""]')) {
          // Insert line break
          doc.execCommand('insertLineBreak');
        }
      }
    } else if (event.target.matches('input')) {
      // For standard input fields - can't add line breaks
      Logger.debug('Cannot add line break in standard input field');
    }
  } catch (error) {
    Logger.error('Error in alternativeAction:', error);
  }
}

// Key up handler
function handleKeyUp(event) {
  // Log key event for debugging
  logKeyEvent(event, 'keyup');
  
  // Nothing special for now
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  Logger.info('DOM content loaded, initializing Triple Submit');
  initializeWithRetry();
});

// Alternative initialization for Chrome extensions on already loaded pages
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  Logger.info('Page already loaded, initializing Triple Submit');
  setTimeout(() => {
    initializeWithRetry();
  }, 100);
}

// Export functions for testing
if (typeof module !== 'undefined') {
  module.exports = {
    getDomainSettings,
    initKeyListeners,
    handleKeyDown
  };
}