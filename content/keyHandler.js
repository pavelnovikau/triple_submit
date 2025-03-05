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
  
  // More complete check for Arc browser
  if ((userAgent.includes('Chrome') && userAgent.includes('Arc/')) || 
      document.documentElement.classList.contains('arc-window') ||
      typeof window.arc !== 'undefined') {
    Logger.info('Arc browser detected');
    return 'arc';
  }
  
  // Other Chromium-based browsers
  if (userAgent.includes('Chrome')) {
    return 'chrome';
  }
  
  return 'unknown';
}

const browserType = detectBrowser();
Logger.info('Running in browser type:', browserType);

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
              domainSettings.enabled = domainResponse.isEnabled;
              Logger.info(`Domain ${hostname} enabled:`, domainSettings.enabled);
              
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
    enabled: false, // Disabled by default
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
  
  // Check if extension is enabled
  if (!settings.enabled) {
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
        domainSettings.enabled = message.domainEnabled;
      }
      
      // Reset press counter
      enterPressCount = 0;
      lastEnterPressTime = 0;
      enterPresses = [];
      
      sendResponse({ status: 'ok' });
    }
  });
}

// Key down handler
function handleKeyDown(event) {
  // Check if extension is enabled
  if (!domainSettings || !domainSettings.enabled) {
    return;
  }
  
  // Ignore repeat events from key holding
  if (event.repeat) return;
  
  // Shift+Enter always works as regular Enter
  if (event.key === 'Enter' && event.shiftKey) {
    return; // Skip processing, allowing standard action
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
    
    Logger.debug(`Enter key pressed. Count: ${enterPressCount}/${domainSettings.pressCount}`);
    
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
            requiredCount: domainSettings.pressCount
          }
        });
        document.dispatchEvent(feedbackEvent);
      }
    } else {
      // Enough Enter presses, allow form submission
      Logger.info(`Form submission allowed after ${enterPressCount} Enter presses`);
      
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