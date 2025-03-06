// Visual feedback for Safe Enter AI-helper extension

// Create and inject the feedback container
function createFeedbackContainer() {
  // Check if container already exists
  if (document.getElementById('triple-submit-feedback')) {
    return;
  }

  // Create container styles
  const style = document.createElement('style');
  style.textContent = `
    #triple-submit-feedback {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      transition: opacity 0.3s ease-in-out;
      display: flex;
      flex-direction: column;
      align-items: center;
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      max-width: 300px;
    }
    
    #triple-submit-feedback.visible {
      opacity: 1;
    }
    
    #triple-submit-message {
      margin-bottom: 10px;
      text-align: center;
      font-size: 14px;
      line-height: 1.4;
    }
    
    #triple-submit-progress {
      display: flex;
      margin: 5px 0;
      align-items: center;
    }
    
    .progress-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.3);
      margin: 0 4px;
      transition: all 0.3s ease;
    }
    
    .progress-dot.active {
      background-color: rgba(255, 255, 255, 1);
      transform: scale(1.1);
    }
    
    .progress-dot.complete {
      background-color: #4CAF50;
      animation: pulse 1s infinite;
    }
    
    .progress-instruction {
      margin-top: 8px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
    }
    
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.8; }
      100% { transform: scale(1); opacity: 1; }
    }
  `;
  
  // Create container
  const container = document.createElement('div');
  container.id = 'triple-submit-feedback';
  
  // Add message
  const message = document.createElement('div');
  message.id = 'triple-submit-message';
  message.textContent = 'Press Enter to continue';
  container.appendChild(message);
  
  // Add progress indicator
  const progress = document.createElement('div');
  progress.id = 'triple-submit-progress';
  container.appendChild(progress);
  
  // Add instruction
  const instruction = document.createElement('div');
  instruction.className = 'progress-instruction';
  instruction.textContent = 'Multiple Enter presses required to submit';
  container.appendChild(instruction);
  
  // Add elements to the page
  document.body.appendChild(style);
  document.body.appendChild(container);
}

// Update the feedback display
function updateFeedback(detail) {
  const container = document.getElementById('triple-submit-feedback');
  if (!container) {
    createFeedbackContainer();
    return updateFeedback(detail);
  }
  
  const currentCount = detail.currentCount || 0;
  const requiredCount = detail.requiredCount || 3;
  const isComplete = detail.isComplete || false;
  
  // Show container
  container.style.opacity = '1';
  container.style.display = 'flex';
  
  // Get progress element
  const progress = document.getElementById('triple-submit-progress');
  if (!progress) return;
  
  // Clear existing dots
  progress.innerHTML = '';
  
  // Create dots based on required count
  for (let i = 0; i < requiredCount; i++) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    
    // Mark dots as complete based on current count
    if (i < currentCount) {
      dot.classList.add('complete');
    }
    
    progress.appendChild(dot);
  }
  
  // Update message
  const message = document.getElementById('triple-submit-message');
  if (message) {
    if (isComplete) {
      message.textContent = 'Form submission allowed!';
    } else {
      message.textContent = `Press Enter ${requiredCount - currentCount} more time${requiredCount - currentCount !== 1 ? 's' : ''}`;
    }
  }
  
  // Hide after delay
  const hideDelay = isComplete ? 2000 : 3000;
  setTimeout(() => {
    container.style.opacity = '0';
    setTimeout(() => {
      container.style.display = 'none';
    }, 300);
  }, hideDelay);
}

// Listen for events from keyHandler.js
document.addEventListener('tripleSubmitFeedback', function(event) {
  updateFeedback(event.detail);
});

// Initialize the feedback container when the script loads
document.addEventListener('DOMContentLoaded', createFeedbackContainer);

// Fallback initialization for pages that are already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  createFeedbackContainer();
} 