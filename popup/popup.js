// Popup.js - основной скрипт для управления popup в Triple Submit

document.addEventListener('DOMContentLoaded', function() {
  // Основные UI элементы
  const extensionToggle = document.getElementById('extension-toggle');
  const domainToggle = document.getElementById('domain-toggle');
  const currentDomainText = document.getElementById('current-domain-text');
  const decreaseCountBtn = document.getElementById('decrease-count');
  const increaseCountBtn = document.getElementById('increase-count');
  const pressCountEl = document.getElementById('press-count');
  const feedbackToggle = document.getElementById('feedback-toggle');
  const usageCountEl = document.getElementById('usage-count');
  const premiumBanner = document.querySelector('.premium-banner');
  const premiumModal = document.getElementById('premium-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const payButton = document.getElementById('pay-button');
  const delaySlider = document.getElementById('delay-slider');
  const delayValue = document.getElementById('delay-value');
  
  // Текущие настройки и состояние
  let currentDomain = '';
  let currentSettings = {
    enabled: true,
    domainEnabled: false,
    pressCount: 3,
    showFeedback: true,
    delay: 200
  };
  
  let isPremium = false;
  let usageCount = 20;
  
  /**
   * Получение текущего домена вкладки
   */
  async function getCurrentTabDomain() {
    return new Promise(async (resolve) => {
      try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        if (tabs && tabs.length > 0) {
          const url = new URL(tabs[0].url);
          currentDomain = url.hostname;
          resolve(currentDomain);
        } else {
          console.error('Triple Submit: Error getting active tab');
          resolve('');
        }
      } catch (error) {
        console.error('Triple Submit: Error getting domain:', error);
        resolve('');
      }
    });
  }
  
  /**
   * Инициализация popup
   */
  async function initPopup() {
    try {
      // Получаем текущий домен
      await getCurrentTabDomain();
      
      // Отображаем текущий домен
      if (currentDomainText) {
        currentDomainText.textContent = currentDomain || 'unknown';
      }
      
      // Получаем общие настройки
      const data = await chrome.storage.sync.get('settings');
      if (data && data.settings) {
        currentSettings = { ...currentSettings, ...data.settings };
      }
      
      // Получаем статус Premium и использования
      const usageData = await chrome.storage.sync.get(['isPremium', 'usageCount']);
      if (usageData) {
        isPremium = usageData.isPremium || false;
        usageCount = (usageData.usageCount !== undefined) ? usageData.usageCount : 20;
      }
      
      // Проверяем статус домена
      if (currentDomain) {
        const domainData = await chrome.storage.sync.get(['domains']);
        if (domainData && domainData.domains) {
          // По умолчанию домен выключен
          currentSettings.domainEnabled = false;
          
          // Проверяем, есть ли домен в списке включенных
          if (domainData.domains[currentDomain]) {
            currentSettings.domainEnabled = true;
          }
        }
      }
      
      // Обновляем UI
      updateUI();
      
    } catch (error) {
      console.error('Triple Submit: Error initializing popup:', error);
    }
  }
  
  /**
   * Обновление UI на основе текущих настроек
   */
  function updateUI() {
    // Обновляем основные переключатели
    extensionToggle.checked = currentSettings.enabled;
    domainToggle.checked = currentSettings.domainEnabled;
    feedbackToggle.checked = currentSettings.showFeedback;
    
    // Обновляем счетчик нажатий
    pressCountEl.textContent = currentSettings.pressCount;
    
    // Обновляем значение слайдера задержки
    delaySlider.value = currentSettings.delay;
    delayValue.textContent = currentSettings.delay;
    
    // Обновляем счетчик использования
    if (isPremium) {
      usageCountEl.textContent = "∞";
      usageCountEl.style.color = "var(--accent-color)";
    } else {
      usageCountEl.textContent = (20 - usageCount);
      
      // Если осталось мало использований, меняем цвет
      if (usageCount >= 15) {
        usageCountEl.style.color = "#ff3b30";
      }
    }
    
    // Обновляем доступность UI в зависимости от статуса включения
    updateUIAvailability();
  }
  
  /**
   * Обновление доступности элементов UI
   */
  function updateUIAvailability() {
    const domainControlsDisabled = !currentSettings.enabled;
    
    // Отключаем/включаем контролы домена
    domainToggle.disabled = domainControlsDisabled;
    
    // Применяем визуальный стиль для отключенных элементов
    document.querySelectorAll('.domain-control, .domain-toggle').forEach(el => {
      if (domainControlsDisabled) {
        el.classList.add('disabled');
      } else {
        el.classList.remove('disabled');
      }
    });
    
    // Обновляем доступность настроек в зависимости от включения домена
    const settingsDisabled = !currentSettings.enabled || !currentSettings.domainEnabled;
    
    decreaseCountBtn.disabled = settingsDisabled;
    increaseCountBtn.disabled = settingsDisabled;
    feedbackToggle.disabled = settingsDisabled;
    delaySlider.disabled = settingsDisabled;
    
    // Применяем визуальный стиль для отключенных элементов
    document.querySelectorAll('.settings-preview').forEach(el => {
      if (settingsDisabled) {
        el.classList.add('disabled');
      } else {
        el.classList.remove('disabled');
      }
    });
  }
  
  /**
   * Сохранение настроек
   */
  async function saveSettings() {
    try {
      // Сохраняем общие настройки
      await chrome.storage.sync.set({ settings: currentSettings });
      
      // Сохраняем настройку домена
      if (currentDomain) {
        const domainData = await chrome.storage.sync.get(['domains']);
        let domains = domainData.domains || {};
        
        if (currentSettings.domainEnabled) {
          domains[currentDomain] = true;
        } else {
          delete domains[currentDomain];
        }
        
        await chrome.storage.sync.set({ domains: domains });
      }
      
      // Уведомляем content scripts об изменениях
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'settingsUpdated',
            settings: currentSettings,
            domainEnabled: currentSettings.domainEnabled
          }).catch(error => {
            console.log('Triple Submit: Не удалось отправить уведомление об обновлении настроек:', error);
          });
        }
      });
      
    } catch (error) {
      console.error('Triple Submit: Error saving settings:', error);
    }
  }
  
  /**
   * Изменение счетчика нажатий
   */
  function updatePressCount(change) {
    const newCount = currentSettings.pressCount + change;
    if (newCount >= 2 && newCount <= 5) {
      currentSettings.pressCount = newCount;
      pressCountEl.textContent = newCount;
      saveSettings();
    }
  }
  
  /**
   * Показать модальное окно Premium
   */
  function showPremiumModal() {
    premiumModal.style.display = 'block';
  }
  
  /**
   * Закрыть модальное окно Premium
   */
  function closePremiumModal() {
    premiumModal.style.display = 'none';
  }
  
  /**
   * Обработчик оплаты Premium
   */
  function handlePayment() {
    window.open('https://example.com/premium-payment', '_blank');
    closePremiumModal();
  }

  /**
   * Обработчики событий
   */
  
  // Toggle для включения/выключения расширения
  extensionToggle.addEventListener('change', function() {
    currentSettings.enabled = this.checked;
    updateUIAvailability();
    saveSettings();
  });
  
  // Toggle для включения/выключения для текущего домена
  domainToggle.addEventListener('change', function() {
    currentSettings.domainEnabled = this.checked;
    updateUIAvailability();
    saveSettings();
  });
  
  // Управление количеством нажатий
  decreaseCountBtn.addEventListener('click', function() {
    updatePressCount(-1);
  });
  
  increaseCountBtn.addEventListener('click', function() {
    updatePressCount(1);
  });
  
  // Toggle для визуального отклика
  feedbackToggle.addEventListener('change', function() {
    currentSettings.showFeedback = this.checked;
    saveSettings();
  });
  
  // Слайдер задержки
  delaySlider.addEventListener('input', function() {
    const value = parseInt(this.value);
    delayValue.textContent = value;
    currentSettings.delay = value;
  });
  
  delaySlider.addEventListener('change', function() {
    saveSettings();
  });
  
  // Обработчики для Premium модального окна
  premiumBanner.addEventListener('click', function() {
    showPremiumModal();
  });
  
  closeModalBtn.addEventListener('click', function() {
    closePremiumModal();
  });
  
  payButton.addEventListener('click', function() {
    handlePayment();
  });
  
  // Закрыть модальное окно при клике вне его содержимого
  window.addEventListener('click', function(event) {
    if (event.target === premiumModal) {
      closePremiumModal();
    }
  });
  
  // Инициализация popup
  initPopup();
}); 