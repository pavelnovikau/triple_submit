// Key press handler for Chrome extension

// Track Enter key presses
let enterPressCount = 0;
let lastEnterPressTime = 0;
let domainSettings = null;

// Get settings from background script
function getSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'checkDomain' }, (response) => {
      if (response && response.domainSettings) {
        domainSettings = response.domainSettings;
        resolve(domainSettings);
      } else {
        // Default fallback settings if we can't get from background
        domainSettings = {
          isEnabled: true,
          mode: 'normal',
          pressCount: 3,
          timeWindow: 2000,
          visualFeedback: true
        };
        resolve(domainSettings);
      }
    });
  });
}

// Initialize settings
getSettings().then(initKeyListeners);

// Handle key events
function initKeyListeners(settings) {
  if (!settings.isEnabled) {
    return; // Extension disabled for this domain
  }

  document.addEventListener('keydown', handleKeyDown, true);
}

// Handle key down events
function handleKeyDown(event) {
  // Only handle if the extension is enabled for this domain
  if (!domainSettings || !domainSettings.isEnabled) {
    return;
  }

  const isEnterKey = event.key === 'Enter';
  const isShiftEnterKey = event.key === 'Enter' && event.shiftKey;
  
  // Normal mode: Multiple Enter presses required, Shift+Enter acts as Enter
  if (domainSettings.mode === 'normal') {
    // Handle Shift+Enter - convert to regular Enter
    if (isShiftEnterKey) {
      // Let the event pass through as normal Enter
      const newEvent = new KeyboardEvent('keydown', { 
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      
      // Prevent original event
      event.preventDefault();
      event.stopPropagation();
      
      // Dispatch new event without shift key
      event.target.dispatchEvent(newEvent);
      return;
    }
    
    // Handle regular Enter key - require multiple presses
    if (isEnterKey && !isShiftEnterKey) {
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
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }
  // Alternative mode: No special handling for Enter, but may have other features
  else if (domainSettings.mode === 'alternative') {
    // Currently just uses default browser behavior
    return;
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