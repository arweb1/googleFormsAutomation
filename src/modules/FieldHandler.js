const logger = require('../utils/logger');

class FieldHandler {
  constructor() {
    this.handlers = {
      text: this.handleTextInput.bind(this),
      email: this.handleEmailInput.bind(this),
      number: this.handleNumberInput.bind(this),
      phone: this.handlePhoneInput.bind(this),
      textarea: this.handleTextareaInput.bind(this),
      select: this.handleSelectInput.bind(this),
      radio: this.handleRadioInput.bind(this),
      checkbox: this.handleCheckboxInput.bind(this),
      date: this.handleDateInput.bind(this),
      time: this.handleTimeInput.bind(this),
      file: this.handleFileInput.bind(this),
      rating: this.handleRatingInput.bind(this),
      scale: this.handleScaleInput.bind(this)
    };
  }

  async handleField(page, fieldConfig, accountConfig) {
    try {
      const { type, selector, name, value, options = {} } = fieldConfig;

      if (!this.handlers[type]) {
        throw new Error(`Неподдерживаемый тип поля: ${type}`);
      }

      // Ожидание появления поля
      await page.waitForSelector(selector, { timeout: 5000 });

      // Обработка поля
      await this.handlers[type](page, {
        selector,
        name,
        value: this.getValue(value, accountConfig, fieldConfig),
        options
      });

      logger.debug(`Поле "${name}" (${type}) обработано`);
      
    } catch (error) {
      logger.error(`Ошибка при обработке поля "${fieldConfig.name}":`, error);
      throw error;
    }
  }

  getValue(value, accountConfig, fieldConfig) {
    if (typeof value === 'function') {
      return value(accountConfig, fieldConfig);
    }
    
    if (typeof value === 'string' && value.startsWith('${')) {
      // Подстановка значений из аккаунта
      const key = value.slice(2, -1);
      return accountConfig[key] || value;
    }
    
    return value;
  }

  async handleTextInput(page, { selector, value }) {
    await page.type(selector, value, { delay: 100 });
  }

  async handleEmailInput(page, { selector, value }) {
    await page.type(selector, value, { delay: 100 });
  }

  async handleNumberInput(page, { selector, value }) {
    await page.type(selector, value.toString(), { delay: 100 });
  }

  async handlePhoneInput(page, { selector, value }) {
    await page.type(selector, value, { delay: 100 });
  }

  async handleTextareaInput(page, { selector, value }) {
    await page.type(selector, value, { delay: 100 });
  }

  async handleSelectInput(page, { selector, value, options }) {
    await page.select(selector, value);
  }

  async handleRadioInput(page, { selector, value, options }) {
    const radioSelector = `${selector}[value="${value}"]`;
    await page.click(radioSelector);
  }

  async handleCheckboxInput(page, { selector, value, options }) {
    if (Array.isArray(value)) {
      for (const val of value) {
        const checkboxSelector = `${selector}[value="${val}"]`;
        await page.click(checkboxSelector);
      }
    } else if (value) {
      await page.click(selector);
    }
  }

  async handleDateInput(page, { selector, value, options }) {
    // Для Google Forms дата обычно в формате YYYY-MM-DD
    const dateValue = this.formatDate(value);
    await page.type(selector, dateValue, { delay: 100 });
  }

  async handleTimeInput(page, { selector, value, options }) {
    // Для Google Forms время обычно в формате HH:MM
    const timeValue = this.formatTime(value);
    await page.type(selector, timeValue, { delay: 100 });
  }

  async handleFileInput(page, { selector, value, options }) {
    const filePath = this.resolveFilePath(value);
    const fileInput = await page.$(selector);
    await fileInput.uploadFile(filePath);
  }

  async handleRatingInput(page, { selector, value, options }) {
    const ratingSelector = `${selector} [data-value="${value}"]`;
    await page.click(ratingSelector);
  }

  async handleScaleInput(page, { selector, value, options }) {
    const scaleSelector = `${selector} [data-value="${value}"]`;
    await page.click(scaleSelector);
  }

  formatDate(date) {
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return date;
  }

  formatTime(time) {
    if (time instanceof Date) {
      return time.toTimeString().split(' ')[0].substring(0, 5);
    }
    return time;
  }

  resolveFilePath(filePath) {
    const path = require('path');
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(process.cwd(), filePath);
  }
}

module.exports = FieldHandler;
