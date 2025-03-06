// Key Handler - Core component of Safe Enter AI-helper
// Prevents accidental form submissions by requiring multiple Enter key presses
// No line breaks are inserted, Enter key is fully intercepted

// Logger for debugging
const Logger = {
  debug: function(message, data) {
    console.debug(`[Safe Enter] ${message}`, data || '');
  },
  info: function(message, data) {
    console.info(`[Safe Enter] ${message}`, data || '');
  },
  warn: function(message, data) {
    console.warn(`[Safe Enter] ${message}`, data || '');
  },
  error: function(message, data) {
    console.error(`[Safe Enter] ERROR: ${message}`, data || '');
  }
};

// Track Enter key presses
let enterPressCount = 0;
let lastEnterPressTime = 0;

// Domain settings
let domainSettings = null;

// Browser detection
let browserType = '';

// Init
document.addEventListener('DOMContentLoaded', function() {
  initializeWithRetry();
});

// Detect browser type for compatibility
function detectBrowser() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('firefox')) {
    return 'firefox';
  } else if (userAgent.includes('edg/')) {
    return 'edge';
  } else if (userAgent.includes('chrome')) {
    // Arc browser uses Chrome's user agent but has specific identifiers
    if (userAgent.includes('arc/') || 
        navigator.userAgentData?.brands?.some(brand => brand.brand === 'Arc')) {
      return 'arc';
    }
    return 'chrome';
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    return 'safari';
  } else {
    return 'other';
  }
}

// Increment usage for premium tracking
function incrementUsage() {
  try {
    chrome.runtime.sendMessage({ action: 'incrementUsage' });
    
    // Track locally in case message fails
    const usageKey = 'safeEnterUsageCount';
    chrome.storage.local.get([usageKey], function(result) {
      let count = result[usageKey] || 0;
      count++;
      
      let data = {};
      data[usageKey] = count;
      chrome.storage.local.set(data);
    });
  } catch (error) {
    Logger.error('Error tracking usage:', error);
  }
}

// Get domain-specific settings
function getDomainSettings() {
  return new Promise((resolve) => {
    try {
      // Get current domain
      const hostname = window.location.hostname;
      
      if (!hostname) {
        Logger.warn('Could not determine hostname');
        useDefaultSettings(resolve);
        return;
      }
      
      // Request domain settings from storage
      chrome.runtime.sendMessage(
        { action: 'getDomainSettings', domain: hostname },
        function(response) {
          if (chrome.runtime.lastError) {
            Logger.warn('Error getting domain settings:', chrome.runtime.lastError);
            useDefaultSettings(resolve);
            return;
          }
          
          if (!response || !response.settings) {
            Logger.warn('No domain settings received from background');
            useDefaultSettings(resolve);
            return;
          }
          
          // Got valid settings
          Logger.info('Loaded domain settings:', response.settings);
          resolve(response.settings);
        }
      );
    } catch (error) {
      Logger.error('Error in getDomainSettings:', error);
      useDefaultSettings(resolve);
    }
  });
}

// Use default settings when domain settings are unavailable
function useDefaultSettings(resolve) {
  const defaultSettings = {
    domainEnabled: false,
    pressCount: 3,
    showFeedback: true,
    delay: 600
  };
  
  Logger.info('Using default settings:', defaultSettings);
  resolve(defaultSettings);
}

// Initialize with retry logic
function initializeWithRetry() {
  let retryCount = 0;
  const maxRetries = 3;
  
  function tryInit() {
    Logger.info('Initializing Safe Enter AI-helper...');
    
    // Detect browser type
    browserType = detectBrowser();
    Logger.info(`Detected browser type: ${browserType}`);
    
    // Get domain settings
    getDomainSettings().then(settings => {
      domainSettings = settings;
      
      // Initialize key listeners
      initKeyListeners(settings);
      
      Logger.info('Safe Enter AI-helper initialized successfully');
    }).catch(error => {
      Logger.error('Error during initialization:', error);
      
      // Retry initialization
      retryCount++;
      if (retryCount < maxRetries) {
        Logger.warn(`Retrying initialization (${retryCount}/${maxRetries})...`);
        setTimeout(tryInit, 1000);
      } else {
        Logger.error('Maximum retries reached, using default settings');
        domainSettings = {
          domainEnabled: false,
          pressCount: 3,
          showFeedback: true,
          delay: 600
        };
        initKeyListeners(domainSettings);
      }
    });
  }
  
  tryInit();
}

// Initialize key event listeners
function initKeyListeners(settings) {
  try {
    // Main event listeners
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    
    // Add form submit handlers
    addFormSubmitHandlers();
    
    // Setup observers for dynamically added forms
    setupFormObserver();
    
    // Setup shadow DOM support
    setupShadowDomObserver();
    addShadowDomHandlers();
    
    Logger.info('Key listeners initialized with settings:', settings);
  } catch (error) {
    Logger.error('Error setting up key listeners:', error);
  }
}

// Log key events for debugging
function logKeyEvent(event, source) {
  // Only log in debug environments
  if (false) {
    const element = event.target;
    const tag = element.tagName;
    const id = element.id;
    const isTextInput = element.matches('input, textarea, [contenteditable]');
    
    Logger.debug(`${source}: key=${event.key}, code=${event.code}, ` +
                `element=${tag}#${id}, isTextInput=${isTextInput}`);
  }
}

// Check if element is a text input
function isTextInput(element) {
  if (!element) return false;
  
  // Standard text inputs
  if (element.matches('textarea, input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], input:not([type])')) {
    return true;
  }
  
  // Contenteditable elements
  if (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === '') {
    return true;
  }
  
  // Role-based accessibility
  if (element.getAttribute('role') === 'textbox') {
    return true;
  }
  
  return false;
}

// Key down event handler - intercepts Enter key presses
function handleKeyDown(event) {
  // Log key event for debugging
  logKeyEvent(event, 'keydown');
  
  // Only handle Enter key
  if (event.key !== 'Enter') {
    return;
  }
  
  // Ignore if extension is disabled or settings not loaded
  if (!domainSettings || !domainSettings.domainEnabled) {
    Logger.debug('Extension disabled for this domain, ignoring Enter key');
    return;
  }
  
  // Ignore Enter with modifiers (Shift, Ctrl, Alt, Meta/Command)
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
    Logger.debug('Modifier key pressed with Enter, bypassing processing');
    return;
  }
  
  // Ignore repeated key events from key holding
  if (event.repeat) return;
  
  // Current time to track timing between presses
  const now = Date.now();
  
  // Check if delay has been exceeded - reset counter if so
  if (lastEnterPressTime > 0 && (now - lastEnterPressTime > domainSettings.delay)) {
    Logger.debug('Time between presses exceeded delay, resetting counter');
    enterPressCount = 0;
  }
  
  // Always prevent default action to block form submission until enough Enter presses
  event.preventDefault();
  event.stopPropagation();
  
  // Increment counter
  enterPressCount++;
  lastEnterPressTime = now;
  
  Logger.debug(`Enter key pressed. Count: ${enterPressCount}/${domainSettings.pressCount}`);
  
  // Show visual feedback if enabled
  if (domainSettings.showFeedback) {
    // Send event to visualFeedback.js
    const feedbackEvent = new CustomEvent('tripleSubmitFeedback', {
      detail: {
        currentCount: enterPressCount,
        requiredCount: domainSettings.pressCount,
        isComplete: enterPressCount >= domainSettings.pressCount
      }
    });
    document.dispatchEvent(feedbackEvent);
  }
  
  // If we've reached the required count, allow the form submission by simulating a submit event
  if (enterPressCount >= domainSettings.pressCount) {
    Logger.info(`Required count reached (${enterPressCount}/${domainSettings.pressCount}), allowing form submission`);
    
    // Find the closest form element
    const form = event.target.closest('form');
    if (form) {
      // Reset the counter for next time
      enterPressCount = 0;
      
      // Increment usage counter for premium tracking
      incrementUsage();
      
      // Submit the form programmatically
      setTimeout(() => {
        try {
          form.requestSubmit();
        } catch (e) {
          try {
            form.submit();
          } catch (e2) {
            Logger.error('Failed to submit form', e2);
          }
        }
      }, 100);
    } else {
      Logger.warn('No form found to submit');
    }
  }
}

// Find closest contenteditable parent
function findClosestContentEditable(element) {
  while (element && element !== document.body) {
    if (element.isContentEditable || 
        element.getAttribute('contenteditable') === 'true' || 
        element.getAttribute('contenteditable') === '') {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

// Key up handler
function handleKeyUp(event) {
  // Log key event for debugging
  logKeyEvent(event, 'keyup');
}

// Add event handlers to forms
function addFormSubmitHandlers() {
  // Find all forms in the document
  const forms = document.forms;
  Logger.debug(`Found ${forms.length} forms in document`);
  
  // Add handlers to each form
  Array.from(forms).forEach((form, index) => {
    // Skip if already handled
    if (form.dataset.tripleSubmitHandled === 'true') {
      return;
    }
    
    // Mark form as handled
    form.dataset.tripleSubmitHandled = 'true';
    
    // Add submit event handler
    form.addEventListener('submit', (event) => {
      // Check if extension is enabled for this domain
      if (domainSettings && domainSettings.domainEnabled) {
        // Check if enough Enter presses have been made
        if (enterPressCount < domainSettings.pressCount) {
          // Prevent form submission if not enough Enter presses
          Logger.info(`Preventing form submission: ${enterPressCount} < ${domainSettings.pressCount}`);
          event.preventDefault();
          event.stopPropagation();
          
          // Show visual feedback
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
    }, true); // Use capture phase to intercept event before other handlers
  });
}

// MutationObserver to watch for new forms added to the DOM
function setupFormObserver() {
  // Create MutationObserver
  const observer = new MutationObserver((mutations) => {
    let shouldAddHandlers = false;
    
    // Check if new forms were added
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // If a form was added
            if (node.tagName === 'FORM') {
              shouldAddHandlers = true;
              break;
            }
            
            // Or if an element containing forms was added
            if (node.querySelectorAll) {
              const forms = node.querySelectorAll('form');
              if (forms.length > 0) {
                shouldAddHandlers = true;
                break;
              }
            }
          }
        }
        
        if (shouldAddHandlers) {
          break;
        }
      }
    }
    
    // Add handlers to new forms if needed
    if (shouldAddHandlers) {
      Logger.debug('New forms detected, adding handlers');
      addFormSubmitHandlers();
    }
  });
  
  // Start observing
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  Logger.debug('Form observer set up');
}

// Find all shadow roots in the document
function findAllShadowRoots() {
  const shadowRoots = [];
  
  function findShadowRootsRecursive(node, path = '') {
    if (!node) return;
    
    // Check if the node has a shadow root
    if (node.shadowRoot) {
      const newPath = path ? `${path}>${node.tagName.toLowerCase()}` : node.tagName.toLowerCase();
      shadowRoots.push({
        host: node,
        root: node.shadowRoot,
        path: newPath
      });
      
      // Search inside the shadow root
      findShadowRootsRecursive(node.shadowRoot, newPath);
    }
    
    // Check for elements that can have shadow roots
    if (node.querySelectorAll) {
      const elements = node.querySelectorAll('*');
      for (const element of elements) {
        if (element.shadowRoot) {
          const newPath = path ? `${path}>${element.tagName.toLowerCase()}` : element.tagName.toLowerCase();
          shadowRoots.push({
            host: element,
            root: element.shadowRoot,
            path: newPath
          });
          
          // Search inside this shadow root
          findShadowRootsRecursive(element.shadowRoot, newPath);
        }
      }
    }
  }
  
  // Start from document root
  findShadowRootsRecursive(document.documentElement);
  
  return shadowRoots;
}

// Add event handlers to elements in shadow DOM
function addShadowDomHandlers() {
  try {
    const shadowRoots = findAllShadowRoots();
    Logger.debug(`Found ${shadowRoots.length} shadow roots`);
    
    // Add handlers to each shadow root
    shadowRoots.forEach(({root, path}) => {
      addShadowDomHandlersRecursive(root, path);
    });
  } catch (error) {
    Logger.error('Error in addShadowDomHandlers:', error);
  }
}

// Add handlers to shadow DOM elements recursively
function addShadowDomHandlersRecursive(shadowRoot, path) {
  if (!shadowRoot) return;
  
  try {
    // Add key event listeners to the shadow root
    shadowRoot.addEventListener('keydown', handleKeyDown, true);
    shadowRoot.addEventListener('keyup', handleKeyUp, true);
    
    // Find and handle forms in the shadow root
    const forms = shadowRoot.querySelectorAll('form');
    Logger.debug(`Found ${forms.length} forms in shadow DOM: ${path}`);
    
    // Add handlers to each form
    Array.from(forms).forEach((form, index) => {
      // Skip if already handled
      if (form.dataset.tripleSubmitHandled === 'true') {
        return;
      }
      
      // Mark form as handled
      form.dataset.tripleSubmitHandled = 'true';
      
      // Add submit event handler
      form.addEventListener('submit', (event) => {
        // Check if extension is enabled for this domain
        if (domainSettings && domainSettings.domainEnabled) {
          // Check if enough Enter presses have been made
          if (enterPressCount < domainSettings.pressCount) {
            // Prevent form submission if not enough Enter presses
            Logger.info(`Preventing shadow DOM form submission: ${enterPressCount} < ${domainSettings.pressCount}`);
            event.preventDefault();
            event.stopPropagation();
            
            // Show visual feedback
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
            Logger.info(`Shadow DOM form submission allowed after ${enterPressCount} Enter presses`);
          }
        }
        
        return true;
      }, true);
    });
    
    // Handle nested shadow roots
    const elements = shadowRoot.querySelectorAll('*');
    for (const element of elements) {
      if (element.shadowRoot) {
        const newPath = `${path}>${element.tagName.toLowerCase()}`;
        addShadowDomHandlersRecursive(element.shadowRoot, newPath);
      }
    }
  } catch (error) {
    Logger.error(`Error in addShadowDomHandlersRecursive for ${path}:`, error);
  }
}

// MutationObserver for shadow DOM
function setupShadowDomObserver() {
  // Create MutationObserver
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    
    // Check if new elements were added
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldCheck = true;
        break;
      }
    }
    
    // Re-check for shadow roots if needed
    if (shouldCheck) {
      setTimeout(() => {
        addShadowDomHandlers();
      }, 500);
    }
  });
  
  // Start observing
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  Logger.debug('Shadow DOM observer set up');
}