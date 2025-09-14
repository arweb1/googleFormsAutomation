const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserDataDirPlugin = require('puppeteer-extra-plugin-user-data-dir');
const logger = require('../utils/logger');
const FieldHandler = require('../modules/FieldHandler');
const AccountManager = require('../accounts/AccountManager');

// Добавляем плагины
puppeteer.use(StealthPlugin());
puppeteer.use(UserDataDirPlugin());

class FormAutomator {
  constructor() {
    this.browser = null;
    this.page = null;
    this.fieldHandler = new FieldHandler();
    this.accountManager = new AccountManager();
  }

  async start(options = {}) {
    try {
      const { formId, accountId, count = 1, headless = true } = options;
      
      logger.info(`Запуск автоматизации для формы ${formId}, аккаунт ${accountId}, количество: ${count}`);

      // Загрузка конфигурации
      await this.accountManager.loadAccounts();
      
      // Получение конфигурации формы и аккаунта
      const formConfig = this.accountManager.getFormConfig(formId);
      const accountConfig = this.accountManager.getAccount(accountId);

      if (!formConfig) {
        throw new Error(`Форма с ID ${formId} не найдена`);
      }

      if (!accountConfig) {
        throw new Error(`Аккаунт с ID ${accountId} не найден`);
      }

      // Запуск браузера
      await this.launchBrowser(headless, accountConfig);

      // Заполнение форм
      for (let i = 0; i < count; i++) {
        try {
          logger.info(`Заполнение формы ${i + 1}/${count}`);
          await this.fillForm(formConfig, accountConfig);
          
          // Задержка между запросами
          if (i < count - 1) {
            const delay = formConfig.delay || 2000;
            logger.info(`Ожидание ${delay}ms перед следующим заполнением`);
            await this.sleep(delay);
          }
        } catch (error) {
          logger.error(`Ошибка при заполнении формы ${i + 1}:`, error);
          // Продолжаем с следующей формой
        }
      }

      logger.info('Автоматизация завершена успешно');
      
    } catch (error) {
      logger.error('Ошибка при запуске автоматизации:', error);
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }

  async launchBrowser(headless, accountConfig) {
    try {
      const userDataDir = accountConfig.userDataDir || `./user-data/${accountConfig.id}`;
      
      this.browser = await puppeteer.launch({
        headless,
        userDataDir,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Настройка User-Agent
      if (accountConfig.userAgent) {
        await this.page.setUserAgent(accountConfig.userAgent);
      }

      // Настройка viewport
      await this.page.setViewport({
        width: 1366,
        height: 768,
        deviceScaleFactor: 1
      });

      logger.info('Браузер запущен успешно');
      
    } catch (error) {
      logger.error('Ошибка при запуске браузера:', error);
      throw error;
    }
  }

  async fillForm(formConfig, accountConfig) {
    try {
      // Переход на форму
      logger.info(`Переход на форму: ${formConfig.url}`);
      await this.page.goto(formConfig.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Ожидание загрузки формы
      await this.page.waitForSelector('form', { timeout: 10000 });

      // Обработка полей формы
      for (const field of formConfig.fields) {
        try {
          await this.fieldHandler.handleField(this.page, field, accountConfig);
          logger.info(`Поле "${field.name}" обработано`);
        } catch (error) {
          logger.error(`Ошибка при обработке поля "${field.name}":`, error);
        }
      }

      // Отправка формы
      if (formConfig.submit) {
        await this.submitForm(formConfig.submit);
      }

      logger.info('Форма заполнена и отправлена');
      
    } catch (error) {
      logger.error('Ошибка при заполнении формы:', error);
      throw error;
    }
  }

  async submitForm(submitConfig) {
    try {
      if (submitConfig.selector) {
        await this.page.click(submitConfig.selector);
      } else if (submitConfig.buttonText) {
        const button = await this.page.$x(`//button[contains(text(), "${submitConfig.buttonText}")]`);
        if (button.length > 0) {
          await button[0].click();
        }
      }

      // Ожидание подтверждения отправки
      if (submitConfig.waitForSelector) {
        await this.page.waitForSelector(submitConfig.waitForSelector, { timeout: 10000 });
      }

      logger.info('Форма отправлена');
      
    } catch (error) {
      logger.error('Ошибка при отправке формы:', error);
      throw error;
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      logger.info('Браузер закрыт');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = FormAutomator;
