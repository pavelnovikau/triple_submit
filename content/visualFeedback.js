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
      position: relative;
    }
    
    .progress-dot.active {
      background-color: rgba(255, 255, 255, 1);
      transform: scale(1.1);
    }
    
    .progress-dot.newline::after {
      content: "↵";
      position: absolute;
      top: -18px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 14px;
      color: #4CAF50;
    }
    
    .progress-dot.submit::after {
      content: "✓";
      position: absolute;
      top: -18px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 14px;
      color: #FF9800;
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
  
  const instruction = document.createElement('div');
  instruction.className = 'progress-instruction';
  instruction.textContent = '↵ = new line, ✓ = submit form';
  
  container.appendChild(message);
  container.appendChild(progress);
  container.appendChild(instruction);
  
  document.body.appendChild(container);
  
  // Store reference to container
  window.feedbackContainer = container;
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
  const is3Mode = detail.is3Mode || false;
  const isLineBreakInserted = detail.isLineBreakInserted || false;
  
  // Show container
  container.style.opacity = '1';
  container.style.display = 'flex';
  
  // Get progress element
  const progress = document.getElementById('triple-submit-progress');
  if (!progress) return;
  
  // Clear existing dots
  progress.innerHTML = '';
  
  // Если это режим 3mode, показываем специальный индикатор
  if (is3Mode) {
    // Create single dot for 3mode
    const dot = document.createElement('div');
    dot.className = 'progress-dot complete newline';
    progress.appendChild(dot);
    
    // Update message
    const message = document.getElementById('triple-submit-message');
    if (message) {
      message.textContent = 'Line break inserted!';
    }
    
    // Hide instruction for 3mode
    const instruction = container.querySelector('.progress-instruction');
    if (instruction) {
      instruction.style.display = 'none';
    }
    
    // Hide after delay
    setTimeout(() => {
      container.style.opacity = '0';
      setTimeout(() => {
        container.style.display = 'none';
      }, 300);
    }, 1500);
    
    return;
  }
  
  // Show instruction for multiple enter mode
  const instruction = container.querySelector('.progress-instruction');
  if (instruction) {
    instruction.style.display = 'block';
  }
  
  // Create dots based on required count
  for (let i = 0; i < requiredCount; i++) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    
    // Mark active dots
    if (i < currentCount) {
      dot.classList.add('active');
    }
    
    // Mark all dots as complete if submission is complete
    if (isComplete) {
      dot.classList.add('complete');
    }
    
    // Add newline indicator for all dots except the last one
    if (i < requiredCount - 1) {
      dot.classList.add('newline');
    } else {
      dot.classList.add('submit');
    }
    
    progress.appendChild(dot);
  }
  
  // Update message
  const message = document.getElementById('triple-submit-message');
  if (message) {
    if (isComplete) {
      message.textContent = 'Form submitted!';
    } else if (isLineBreakInserted) {
      message.textContent = 'Line break inserted!';
      
      // For line break, show briefly
      setTimeout(() => {
        container.style.opacity = '0';
        setTimeout(() => {
          container.style.display = 'none';
        }, 300);
      }, 1500);
      
      return;
    } else {
      const remaining = requiredCount - currentCount;
      message.textContent = `Press Enter ${remaining} more time${remaining !== 1 ? 's' : ''} to submit form`;
    }
  }
  
  // Hide after delay
  setTimeout(() => {
    container.style.opacity = '0';
    setTimeout(() => {
      container.style.display = 'none';
    }, 300);
  }, isComplete ? 3000 : 2000);
}

// Listen for feedback events from keyHandler.js
document.addEventListener('tripleSubmitFeedback', (event) => {
  updateFeedback(event.detail);
});

// Initialize the feedback container when the script loads
document.addEventListener('DOMContentLoaded', createFeedbackContainer);

// Fallback initialization for pages that are already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  createFeedbackContainer();
} 