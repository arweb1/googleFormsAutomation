const puppeteer = require('puppeteer');
const FormConfig = require('../models/FormConfig');
const AccountManager = require('./AccountManager');
const fs = require('fs-extra');
const path = require('path');

class FormAutomator {
  constructor() {
    this.jobs = new Map();
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: false, // Показываем браузер для отладки
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async startAutomation(formConfigId, accountIds, options = {}) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Получаем конфигурацию формы
      const formConfig = await FormConfig.getById(formConfigId);
      if (!formConfig) {
        throw new Error('Конфигурация формы не найдена');
      }

      let accounts = [];
      
      // Используем предоставленные данные аккаунтов
      accounts = options.accountData.map(accountData => ({
        id: accountData.id,
        name: accountData.name,
        email: `${accountData.name}@example.com`,
        fields: accountData.fields,
        loginMode: options.loginMode || 'anonymous'
      }));
      
      // Если режим с логином Google, добавляем информацию об аккаунтах
      if (options.loginMode === 'google' && accountIds && accountIds.length > 0) {
        const accountManager = new AccountManager();
        const googleAccounts = await accountManager.getAccountsByIds(accountIds);
        
        // Сопоставляем Google аккаунты с данными
        accounts.forEach((account, index) => {
          if (googleAccounts[index]) {
            account.googleAccount = googleAccounts[index];
            account.email = googleAccounts[index].email;
          }
        });
      }

      // Создаем задачу
      const job = {
        id: jobId,
        formConfigId,
        accountIds,
        status: 'running',
        startTime: new Date(),
        endTime: null,
        progress: {
          total: accounts.length,
          completed: 0,
          failed: 0
        },
        results: [],
        options
      };

      this.jobs.set(jobId, job);

      // Запускаем автоматизацию в фоне
      this.runAutomation(jobId, formConfig, accounts, options).catch(error => {
        console.error(`Ошибка в задаче ${jobId}:`, error);
        this.updateJobStatus(jobId, 'failed', error.message);
      });

      return jobId;

    } catch (error) {
      console.error('Ошибка запуска автоматизации:', error);
      throw error;
    }
  }

  async runAutomation(jobId, formConfig, accounts, options) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      const browser = await this.initBrowser();
      
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        
        try {
          console.log(`Обрабатываем аккаунт ${i + 1}/${accounts.length}: ${account.email}`);
          
          const result = await this.fillFormForAccount(browser, formConfig, account, options);
          
          job.results.push({
            accountId: account.id,
            email: account.email,
            status: 'success',
            timestamp: new Date(),
            data: result
          });
          
          job.progress.completed++;
          
        } catch (error) {
          console.error(`Ошибка для аккаунта ${account.email}:`, error);
          
          job.results.push({
            accountId: account.id,
            email: account.email,
            status: 'failed',
            timestamp: new Date(),
            error: error.message
          });
          
          job.progress.failed++;
        }
        
        // Обновляем статус задачи
        this.jobs.set(jobId, job);
        
        // Задержка между аккаунтами
        if (options.delay && options.delay > 0) {
          await this.sleep(options.delay);
        }
      }
      
      // Завершаем задачу
      this.updateJobStatus(jobId, 'completed');
      
    } catch (error) {
      console.error(`Критическая ошибка в задаче ${jobId}:`, error);
      this.updateJobStatus(jobId, 'failed', error.message);
    }
  }

  async fillFormForAccount(browser, formConfig, account, options) {
    const page = await browser.newPage();
    
    try {
      console.log(`\n🚀 Начинаем заполнение формы для аккаунта: ${account.name}`);
      console.log(`📝 URL формы: ${formConfig.url}`);
      console.log(`📊 Количество полей: ${formConfig.fields.length}`);
      
      // Устанавливаем User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Переходим на форму
      console.log('🌐 Переходим на страницу формы...');
      await page.goto(formConfig.url, { waitUntil: 'networkidle2' });
      
      // Ждем загрузки формы (современные Google Forms могут не иметь стандартной формы)
      console.log('⏳ Ждем загрузки формы...');
      try {
        await page.waitForSelector('form', { timeout: 5000 });
        console.log('✅ Стандартная форма найдена');
      } catch (error) {
        console.log('⚠️ Стандартная форма не найдена, ждем загрузки полей ввода...');
        await page.waitForSelector('input[type="text"], textarea, select', { timeout: 10000 });
        console.log('✅ Поля ввода найдены');
      }
      
      // Заполняем поля формы
      console.log('📝 Начинаем заполнение полей...');
      for (const field of formConfig.fields) {
        await this.fillField(page, field, account, options, formConfig);
      }
      
      // Отправляем форму
      if (options.submit !== false) {
        console.log('📤 Отправляем форму...');
        // Небольшая задержка перед отправкой
        await page.waitForTimeout(1000);
        await this.submitForm(page, formConfig);
      }
      
      // Ждем подтверждения отправки
      console.log('⏳ Ждем подтверждения отправки...');
      await this.waitForSubmission(page);
      
      console.log('✅ Форма успешно отправлена!');
      return {
        success: true,
        submittedAt: new Date()
      };
      
    } finally {
      await page.close();
    }
  }

  async fillField(page, field, account, options, formConfig) {
    try {
      const selector = `[name="${field.name}"], #${field.id}`;
      
      switch (field.type) {
        case 'text':
        case 'email':
        case 'tel':
        case 'url':
        case 'textarea':
          await this.fillTextField(page, selector, field, account, formConfig);
          break;
          
        case 'number':
          await this.fillNumberField(page, selector, field, account);
          break;
          
        case 'date':
        case 'time':
        case 'datetime':
          await this.fillDateTimeField(page, selector, field, account);
          break;
          
        case 'select':
          await this.fillSelectField(page, selector, field, account);
          break;
          
        case 'radio':
          await this.fillRadioField(page, field, account);
          break;
          
        case 'checkbox':
          await this.fillCheckboxField(page, field, account);
          break;
          
        case 'file':
          await this.fillFileField(page, selector, field, account);
          break;
      }
      
    } catch (error) {
      console.error(`Ошибка заполнения поля ${field.name}:`, error);
      throw error;
    }
  }

  async fillTextField(page, selector, field, account, formConfig) {
    const value = this.getValueForField(field, account);
    if (!value) {
      console.log(`Пропускаем поле ${field.title} - нет значения`);
      return;
    }

    console.log(`Заполняем поле ${field.title} значением: ${value}`);

    try {
      // Используем более точный подход для поиска поля
      let filled = false;
      
      // Сначала пробуем найти поле по индексу (порядку на странице)
      const allInputs = await page.$$('input[type="text"], textarea');
      const fieldIndex = formConfig.fields.indexOf(field);
      
      if (allInputs.length > fieldIndex) {
        try {
          await allInputs[fieldIndex].click();
          await allInputs[fieldIndex].type(value);
          console.log(`✅ Успешно заполнено поле ${field.title} по индексу ${fieldIndex}`);
          filled = true;
        } catch (error) {
          console.log(`❌ Не удалось заполнить поле ${field.title} по индексу: ${error.message}`);
        }
      }
      
      // Если не получилось по индексу, пробуем другие селекторы
      if (!filled) {
        const selectors = [
          selector, // Оригинальный селектор
          'input[aria-label*="' + field.title + '"]', // По aria-label
          'input[placeholder*="' + field.title + '"]', // По placeholder
          '.whsOnd.zHQkBf', // Класс для полей Google Forms
          'input[type="text"]' // Общий селектор для текстовых полей
        ];

        for (const sel of selectors) {
          try {
            const elements = await page.$$(sel);
            if (elements.length > 0) {
              // Берем первый доступный элемент
              await elements[0].click();
              await elements[0].type(value);
              console.log(`✅ Успешно заполнено поле ${field.title} селектором: ${sel}`);
              filled = true;
              break;
            }
          } catch (error) {
            console.log(`❌ Селектор ${sel} не сработал: ${error.message}`);
            continue;
          }
        }
      }

      if (!filled) {
        console.log(`❌ Не удалось заполнить поле ${field.title}`);
      }

    } catch (error) {
      console.error(`❌ Ошибка заполнения поля ${field.title}:`, error.message);
    }
  }

  async fillNumberField(page, selector, field, account) {
    const value = this.getValueForField(field, account);
    if (value) {
      await page.type(selector, value.toString());
    }
  }

  async fillDateTimeField(page, selector, field, account) {
    const value = this.getValueForField(field, account);
    if (value) {
      await page.type(selector, value);
    }
  }

  async fillSelectField(page, selector, field, account) {
    const value = this.getValueForField(field, account);
    if (value) {
      await page.select(selector, value);
    }
  }

  async fillRadioField(page, field, account) {
    const value = this.getValueForField(field, account);
    if (value) {
      const selector = `input[name="${field.name}"][value="${value}"]`;
      await page.click(selector);
    }
  }

  async fillCheckboxField(page, field, account) {
    const values = this.getValueForField(field, account);
    if (Array.isArray(values)) {
      for (const value of values) {
        const selector = `input[name="${field.name}"][value="${value}"]`;
        await page.click(selector);
      }
    } else if (values) {
      const selector = `input[name="${field.name}"][value="${values}"]`;
      await page.click(selector);
    }
  }

  async fillFileField(page, selector, field, account) {
    const filePath = this.getValueForField(field, account);
    if (filePath) {
      const fileInput = await page.$(selector);
      if (fileInput) {
        await fileInput.uploadFile(filePath);
      }
    }
  }

  getValueForField(field, account) {
    // Сначала проверяем пользовательские данные (если есть)
    if (account.fields && account.fields[field.id]) {
      return account.fields[field.id];
    }
    
    // Ищем значение в данных аккаунта по имени поля
    let value = account.data && account.data[field.name];
    
    // Если значение не найдено, пробуем найти по ID
    if (value === undefined) {
      value = account.data && account.data[field.id];
    }
    
    // Если все еще не найдено, используем значение по умолчанию
    if (value === undefined && field.defaultValue) {
      value = field.defaultValue;
    }
    
    return value;
  }

  async submitForm(page, formConfig) {
    console.log('Ищем кнопку отправки формы...');
    
    try {
      // Используем page.evaluate для поиска кнопки отправки
      const submitButton = await page.evaluate(() => {
        // Ищем кнопки с текстом Submit или Отправить
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], span'));
        
        for (const button of buttons) {
          const text = button.textContent?.toLowerCase() || '';
          const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
          
          if (text.includes('submit') || text.includes('отправить') || 
              ariaLabel.includes('submit') || ariaLabel.includes('отправить')) {
            return {
              tagName: button.tagName,
              className: button.className,
              id: button.id,
              text: button.textContent
            };
          }
        }
        
        // Ищем кнопки с определенными классами Google Forms
        const googleButtons = document.querySelectorAll('.freebirdFormviewerViewNavigationSubmitButton, [jsname="M2UYVd"], button[data-value="Submit"]');
        if (googleButtons.length > 0) {
          const button = googleButtons[0];
          return {
            tagName: button.tagName,
            className: button.className,
            id: button.id,
            text: button.textContent
          };
        }
        
        return null;
      });
      
      if (submitButton) {
        console.log(`Найдена кнопка отправки:`, submitButton);
        
        // Пробуем разные способы клика
        const clickMethods = [
          // Метод 1: Клик по селектору
          async () => {
            const selector = submitButton.id ? `#${submitButton.id}` : 
                           submitButton.className ? `.${submitButton.className.split(' ')[0]}` : 
                           submitButton.tagName.toLowerCase();
            await page.click(selector);
          },
          
          // Метод 2: Клик через evaluate
          async () => {
            await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], span'));
              for (const button of buttons) {
                const text = button.textContent?.toLowerCase() || '';
                if (text.includes('submit') || text.includes('отправить')) {
                  button.click();
                  return;
                }
              }
            });
          },
          
          // Метод 3: Клик по Google Forms кнопке
          async () => {
            await page.evaluate(() => {
              const googleButton = document.querySelector('.freebirdFormviewerViewNavigationSubmitButton, [jsname="M2UYVd"]');
              if (googleButton) {
                googleButton.click();
              }
            });
          }
        ];
        
        for (const clickMethod of clickMethods) {
          try {
            await clickMethod();
            console.log('✅ Кнопка отправки нажата успешно!');
            return;
          } catch (error) {
            console.log(`❌ Метод клика не сработал: ${error.message}`);
            continue;
          }
        }
      }
      
      // Если не нашли кнопку, пробуем отправить форму через Enter
      console.log('Кнопка отправки не найдена, пробуем Enter...');
      await page.keyboard.press('Enter');
      
    } catch (error) {
      console.error('Ошибка при поиске кнопки отправки:', error.message);
      // В крайнем случае пробуем Enter
      await page.keyboard.press('Enter');
    }
  }

  async waitForSubmission(page) {
    try {
      console.log('⏳ Ждем подтверждения отправки формы...');
      
      // Ждем изменения URL или появления сообщения об успешной отправке
      await Promise.race([
        // Ждем изменения URL (Google Forms перенаправляет после отправки)
        page.waitForFunction(() => {
          return window.location.href.includes('formResponse') || 
                 window.location.href.includes('thankyou') ||
                 window.location.href.includes('confirmation');
        }, { timeout: 15000 }),
        
        // Ждем появления сообщения об успешной отправке
        page.waitForSelector('.freebirdFormviewerViewResponseConfirmationMessage, .thank-you, .success, [data-response-id]', { 
          timeout: 15000 
        }),
        
        // Ждем исчезновения формы
        page.waitForFunction(() => {
          const form = document.querySelector('form');
          return !form || form.style.display === 'none';
        }, { timeout: 15000 })
      ]);
      
      console.log('✅ Форма успешно отправлена!');
      
    } catch (error) {
      // Проверяем, не изменился ли URL
      const currentUrl = page.url();
      if (currentUrl.includes('formResponse') || currentUrl.includes('thankyou')) {
        console.log('✅ Форма отправлена (определено по URL)');
        return;
      }
      
      console.log('⚠️ Не удалось дождаться подтверждения отправки, но форма могла быть отправлена');
    }
  }

  updateJobStatus(jobId, status, error = null) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.endTime = new Date();
      if (error) {
        job.error = error;
      }
      this.jobs.set(jobId, job);
    }
  }

  async getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }

  async stopJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'running') {
      job.status = 'stopped';
      job.endTime = new Date();
      this.jobs.set(jobId, job);
    }
  }

  async getJobResults(jobId) {
    const job = this.jobs.get(jobId);
    return job ? job.results : [];
  }

  async getAllJobs() {
    return Array.from(this.jobs.values());
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateAnonymousAccounts(count, formConfig) {
    const accounts = [];
    
    for (let i = 0; i < count; i++) {
      const account = {
        id: `anon_${Date.now()}_${i}`,
        email: `anonymous_${i + 1}`,
        password: '',
        data: this.generateAnonymousData(formConfig.fields, i)
      };
      accounts.push(account);
    }
    
    return accounts;
  }

  generateAnonymousData(fields, index) {
    const data = {};
    
    fields.forEach(field => {
      const fieldName = field.name || field.id;
      
      // Генерируем данные в зависимости от типа поля
      switch (field.type) {
        case 'text':
        case 'textarea':
          if (fieldName.toLowerCase().includes('email')) {
            data[fieldName] = `user${index + 1}@example.com`;
          } else if (fieldName.toLowerCase().includes('name')) {
            data[fieldName] = `Пользователь ${index + 1}`;
          } else if (fieldName.toLowerCase().includes('phone')) {
            data[fieldName] = `+7${Math.floor(Math.random() * 9000000000) + 1000000000}`;
          } else {
            data[fieldName] = `Ответ ${index + 1}`;
          }
          break;
          
        case 'number':
          data[fieldName] = Math.floor(Math.random() * 100) + 1;
          break;
          
        case 'select':
        case 'radio':
          if (field.options && field.options.length > 0) {
            const randomOption = field.options[Math.floor(Math.random() * field.options.length)];
            data[fieldName] = randomOption.value;
          }
          break;
          
        case 'checkbox':
          if (field.options && field.options.length > 0) {
            const selectedCount = Math.floor(Math.random() * field.options.length) + 1;
            const selected = [];
            for (let i = 0; i < selectedCount; i++) {
              const option = field.options[Math.floor(Math.random() * field.options.length)];
              if (!selected.includes(option.value)) {
                selected.push(option.value);
              }
            }
            data[fieldName] = selected;
          }
          break;
          
        case 'date':
          const date = new Date();
          date.setDate(date.getDate() + Math.floor(Math.random() * 365));
          data[fieldName] = date.toISOString().split('T')[0];
          break;
          
        default:
          data[fieldName] = `Значение ${index + 1}`;
      }
    });
    
    return data;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = FormAutomator;
