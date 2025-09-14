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
      
      // Проверяем режим работы
      if (options.anonymousMode) {
        // Анонимный режим - создаем виртуальные аккаунты
        const count = options.submitCount || 1;
        accounts = this.generateAnonymousAccounts(count, formConfig);
      } else {
        // Обычный режим - получаем аккаунты из базы
        const accountManager = new AccountManager();
        accounts = await accountManager.getAccountsByIds(accountIds);
        if (accounts.length === 0) {
          throw new Error('Аккаунты не найдены');
        }
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
      // Устанавливаем User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Переходим на форму
      await page.goto(formConfig.url, { waitUntil: 'networkidle2' });
      
      // Ждем загрузки формы
      await page.waitForSelector('form', { timeout: 10000 });
      
      // Заполняем поля формы
      for (const field of formConfig.fields) {
        await this.fillField(page, field, account, options);
      }
      
      // Отправляем форму
      if (options.submit !== false) {
        await this.submitForm(page, formConfig);
      }
      
      // Ждем подтверждения отправки
      await this.waitForSubmission(page);
      
      return {
        success: true,
        submittedAt: new Date()
      };
      
    } finally {
      await page.close();
    }
  }

  async fillField(page, field, account, options) {
    try {
      const selector = `[name="${field.name}"], #${field.id}`;
      
      switch (field.type) {
        case 'text':
        case 'email':
        case 'tel':
        case 'url':
        case 'textarea':
          await this.fillTextField(page, selector, field, account);
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

  async fillTextField(page, selector, field, account) {
    const value = this.getValueForField(field, account);
    if (value) {
      await page.type(selector, value);
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
    // Ищем значение в данных аккаунта по имени поля
    let value = account.data[field.name];
    
    // Если значение не найдено, пробуем найти по ID
    if (value === undefined) {
      value = account.data[field.id];
    }
    
    // Если все еще не найдено, используем значение по умолчанию
    if (value === undefined && field.defaultValue) {
      value = field.defaultValue;
    }
    
    return value;
  }

  async submitForm(page, formConfig) {
    // Ищем кнопку отправки
    const submitSelectors = [
      'input[type="submit"]',
      'button[type="submit"]',
      'button:contains("Отправить")',
      'button:contains("Submit")',
      '.freebirdFormviewerViewNavigationSubmitButton'
    ];
    
    for (const selector of submitSelectors) {
      try {
        await page.click(selector);
        return;
      } catch (error) {
        // Пробуем следующий селектор
      }
    }
    
    // Если не нашли кнопку, пробуем отправить форму через Enter
    await page.keyboard.press('Enter');
  }

  async waitForSubmission(page) {
    try {
      // Ждем появления сообщения об успешной отправке
      await page.waitForSelector('.freebirdFormviewerViewResponseConfirmationMessage, .thank-you, .success', { 
        timeout: 10000 
      });
    } catch (error) {
      // Если не дождались подтверждения, это не критично
      console.log('Не удалось дождаться подтверждения отправки');
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
