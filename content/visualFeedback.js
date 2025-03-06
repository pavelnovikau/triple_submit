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
      transition: background-color 0.2s ease;
    }
    
    .progress-dot.active {
      background-color: rgba(255, 255, 255, 1);
    }
    
    .progress-dot.complete {
      background-color: #4CAF50;
      animation: pulse 1s infinite;
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
  
  container.appendChild(message);
  container.appendChild(progress);
  
  document.body.appendChild(container);
}

// Update the feedback display
function updateFeedback(detail) {
  if (!feedbackContainer) return;
  
  const currentCount = detail.currentCount || 0;
  const requiredCount = detail.requiredCount || 3;
  const isComplete = detail.isComplete || false;
  const is3Mode = detail.is3Mode || false; // Новый флаг для режима 3mode
  
  // Показываем контейнер
  feedbackContainer.style.display = 'flex';
  
  // Обновляем прогресс
  const progressDots = feedbackContainer.querySelectorAll('.progress-dot');
  
  // Если это режим 3mode, показываем специальный индикатор
  if (is3Mode) {
    // Скрываем все точки кроме первой
    progressDots.forEach((dot, index) => {
      if (index === 0) {
        dot.classList.add('complete');
        dot.classList.add('pulse');
      } else {
        dot.style.display = 'none';
      }
    });
    
    // Обновляем сообщение
    const messageElement = feedbackContainer.querySelector('.feedback-message');
    if (messageElement) {
      messageElement.textContent = 'Line break inserted!';
    }
    
    // Скрываем контейнер через короткое время
    setTimeout(() => {
      feedbackContainer.style.display = 'none';
    }, 1500);
    
    return;
  }
  
  // Стандартная логика для обычного режима
  progressDots.forEach((dot, index) => {
    // Показываем все точки
    dot.style.display = 'block';
    
    // Активируем точки в зависимости от текущего счетчика
    if (index < currentCount) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
    
    // Если отправка завершена, отмечаем все точки как завершенные
    if (isComplete) {
      dot.classList.add('complete');
      dot.classList.add('pulse');
    } else {
      dot.classList.remove('complete');
      dot.classList.remove('pulse');
    }
  });
  
  // Обновляем сообщение
  const messageElement = feedbackContainer.querySelector('.feedback-message');
  if (messageElement) {
    if (isComplete) {
      messageElement.textContent = 'Form submitted!';
    } else {
      const remaining = requiredCount - currentCount;
      messageElement.textContent = `Press Enter ${remaining} more time${remaining !== 1 ? 's' : ''} to submit`;
    }
  }
  
  // Скрываем контейнер через некоторое время
  setTimeout(() => {
    feedbackContainer.style.display = 'none';
  }, isComplete ? 3000 : 2000); // Показываем дольше при успешной отправке
}

// Listen for feedback events from keyHandler.js
document.addEventListener('tripleSubmitFeedback', (event) => {
  const { currentCount, requiredCount, isComplete } = event.detail;
  updateFeedback(event.detail);
});

// Initialize the feedback container when the script loads
document.addEventListener('DOMContentLoaded', createFeedbackContainer);

// Fallback initialization for pages that are already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  createFeedbackContainer();
} 