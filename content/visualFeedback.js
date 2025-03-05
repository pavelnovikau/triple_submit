// Visual feedback for Triple Submit extension

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
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      transition: opacity 0.3s ease-in-out;
      display: flex;
      align-items: center;
      opacity: 0;
      pointer-events: none;
    }
    
    #triple-submit-feedback.visible {
      opacity: 1;
    }
    
    #triple-submit-progress {
      display: flex;
      margin-left: 10px;
    }
    
    .progress-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.3);
      margin: 0 3px;
    }
    
    .progress-dot.active {
      background-color: rgba(255, 255, 255, 1);
    }
    
    .progress-dot.complete {
      background-color: rgba(0, 255, 0, 1);
    }
  `;
  
  document.head.appendChild(style);
  
  // Create container element
  const container = document.createElement('div');
  container.id = 'triple-submit-feedback';
  
  // Create content
  const message = document.createElement('div');
  message.id = 'triple-submit-message';
  message.textContent = 'Press Enter again to submit';
  
  const progress = document.createElement('div');
  progress.id = 'triple-submit-progress';
  
  container.appendChild(message);
  container.appendChild(progress);
  
  document.body.appendChild(container);
}

// Update the feedback display
function updateFeedback(currentCount, requiredCount, isComplete) {
  const container = document.getElementById('triple-submit-feedback');
  if (!container) {
    createFeedbackContainer();
  }
  
  const progress = document.getElementById('triple-submit-progress');
  progress.innerHTML = '';
  
  // Create progress dots based on required count
  for (let i = 0; i < requiredCount; i++) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    
    if (i < currentCount) {
      dot.classList.add('active');
    }
    
    if (isComplete) {
      dot.classList.add('complete');
    }
    
    progress.appendChild(dot);
  }
  
  // Update message
  const message = document.getElementById('triple-submit-message');
  if (isComplete) {
    message.textContent = 'Form submitted';
  } else {
    const remaining = requiredCount - currentCount;
    message.textContent = `Press Enter ${remaining} more ${remaining === 1 ? 'time' : 'times'} to submit`;
  }
  
  // Show the feedback
  container.classList.add('visible');
  
  // Hide after a delay
  clearTimeout(window.feedbackTimeout);
  window.feedbackTimeout = setTimeout(() => {
    container.classList.remove('visible');
  }, 2000);
}

// Listen for feedback events from keyHandler.js
document.addEventListener('tripleSubmitFeedback', (event) => {
  const { currentCount, requiredCount, isComplete } = event.detail;
  updateFeedback(currentCount, requiredCount, isComplete);
});

// Initialize the feedback container when the script loads
document.addEventListener('DOMContentLoaded', createFeedbackContainer);

// Fallback initialization for pages that are already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  createFeedbackContainer();
} 