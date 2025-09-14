const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

puppeteer.use(StealthPlugin());

class FormAnalyzer {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async analyzeForm(formUrl) {
    try {
      logger.info(`Анализ формы: ${formUrl}`);
      
      await this.launchBrowser();
      await this.page.goto(formUrl, { waitUntil: 'networkidle2' });
      
      // Получаем HTML формы
      const formHtml = await this.page.content();
      const $ = cheerio.load(formHtml);
      
      // Анализируем поля формы
      const fields = await this.extractFields($);
      
      // Создаем конфигурацию формы
      const formConfig = {
        id: this.extractFormId(formUrl),
        url: formUrl,
        title: this.extractFormTitle($),
        description: this.extractFormDescription($),
        fields: fields,
        submit: this.extractSubmitConfig($),
        createdAt: new Date().toISOString()
      };

      logger.info(`Найдено ${fields.length} полей в форме`);
      
      return formConfig;
      
    } catch (error) {
      logger.error('Ошибка при анализе формы:', error);
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }

  async extractFields($) {
    const fields = [];
    
    // Ищем все input элементы
    $('input').each((index, element) => {
      const $el = $(element);
      const field = this.parseInputField($el);
      if (field) fields.push(field);
    });

    // Ищем все textarea элементы
    $('textarea').each((index, element) => {
      const $el = $(element);
      const field = this.parseTextareaField($el);
      if (field) fields.push(field);
    });

    // Ищем все select элементы
    $('select').each((index, element) => {
      const $el = $(element);
      const field = this.parseSelectField($el);
      if (field) fields.push(field);
    });

    // Ищем специальные поля Google Forms
    $('[role="radiogroup"]').each((index, element) => {
      const $el = $(element);
      const field = this.parseRadioGroupField($el);
      if (field) fields.push(field);
    });

    $('[role="checkbox"]').each((index, element) => {
      const $el = $(element);
      const field = this.parseCheckboxField($el);
      if (field) fields.push(field);
    });

    return fields;
  }

  parseInputField($el) {
    const type = $el.attr('type') || 'text';
    const name = $el.attr('name') || $el.attr('id') || `field_${Date.now()}`;
    const placeholder = $el.attr('placeholder') || '';
    const required = $el.attr('required') !== undefined;
    
    // Определяем селектор
    const selector = this.getElementSelector($el);

    return {
      type: this.mapInputType(type),
      name: name,
      label: this.getFieldLabel($el),
      selector: selector,
      placeholder: placeholder,
      required: required,
      value: this.getDefaultValue(type)
    };
  }

  parseTextareaField($el) {
    const name = $el.attr('name') || $el.attr('id') || `textarea_${Date.now()}`;
    const selector = this.getElementSelector($el);

    return {
      type: 'textarea',
      name: name,
      label: this.getFieldLabel($el),
      selector: selector,
      placeholder: $el.attr('placeholder') || '',
      required: $el.attr('required') !== undefined,
      value: ''
    };
  }

  parseSelectField($el) {
    const name = $el.attr('name') || $el.attr('id') || `select_${Date.now()}`;
    const selector = this.getElementSelector($el);
    const options = [];

    $el.find('option').each((index, option) => {
      const $option = $(option);
      options.push({
        value: $option.attr('value') || $option.text(),
        text: $option.text()
      });
    });

    return {
      type: 'select',
      name: name,
      label: this.getFieldLabel($el),
      selector: selector,
      options: options,
      required: $el.attr('required') !== undefined,
      value: options[0]?.value || ''
    };
  }

  parseRadioGroupField($el) {
    const name = $el.attr('aria-label') || `radio_${Date.now()}`;
    const selector = this.getElementSelector($el);
    const options = [];

    $el.find('[role="radio"]').each((index, radio) => {
      const $radio = $(radio);
      options.push({
        value: $radio.attr('data-value') || $radio.text().trim(),
        text: $radio.text().trim()
      });
    });

    return {
      type: 'radio',
      name: name,
      label: this.getFieldLabel($el),
      selector: selector,
      options: options,
      required: true,
      value: options[0]?.value || ''
    };
  }

  parseCheckboxField($el) {
    const name = $el.attr('aria-label') || `checkbox_${Date.now()}`;
    const selector = this.getElementSelector($el);
    const options = [];

    $el.find('[role="checkbox"]').each((index, checkbox) => {
      const $checkbox = $(checkbox);
      options.push({
        value: $checkbox.attr('data-value') || $checkbox.text().trim(),
        text: $checkbox.text().trim()
      });
    });

    return {
      type: 'checkbox',
      name: name,
      label: this.getFieldLabel($el),
      selector: selector,
      options: options,
      required: false,
      value: []
    };
  }

  mapInputType(type) {
    const typeMap = {
      'text': 'text',
      'email': 'email',
      'password': 'text',
      'number': 'number',
      'tel': 'phone',
      'url': 'text',
      'date': 'date',
      'time': 'time',
      'datetime-local': 'date',
      'file': 'file'
    };
    
    return typeMap[type] || 'text';
  }

  getFieldLabel($el) {
    // Пытаемся найти label
    const id = $el.attr('id');
    if (id) {
      const label = $(`label[for="${id}"]`).text().trim();
      if (label) return label;
    }

    // Ищем в родительских элементах
    const parentLabel = $el.closest('label').text().trim();
    if (parentLabel) return parentLabel;

    // Ищем aria-label
    const ariaLabel = $el.attr('aria-label');
    if (ariaLabel) return ariaLabel;

    // Ищем placeholder
    const placeholder = $el.attr('placeholder');
    if (placeholder) return placeholder;

    return $el.attr('name') || 'Неизвестное поле';
  }

  getElementSelector($el) {
    const id = $el.attr('id');
    if (id) return `#${id}`;

    const name = $el.attr('name');
    if (name) return `[name="${name}"]`;

    const type = $el.attr('type');
    const tagName = $el.prop('tagName').toLowerCase();
    
    return `${tagName}${type ? `[type="${type}"]` : ''}`;
  }

  getDefaultValue(type) {
    const defaults = {
      'email': 'example@email.com',
      'phone': '+7 (999) 123-45-67',
      'number': '1',
      'date': '2024-01-01',
      'time': '12:00',
      'text': 'Тестовый текст'
    };
    
    return defaults[type] || '';
  }

  extractFormId(url) {
    const match = url.match(/\/forms\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : Date.now().toString();
  }

  extractFormTitle($) {
    const title = $('h1').first().text().trim() || 
                  $('[role="heading"]').first().text().trim() ||
                  $('title').text().trim();
    return title || 'Google Form';
  }

  extractFormDescription($) {
    const desc = $('[role="main"] p').first().text().trim() ||
                 $('.freebirdFormviewerViewItemsItemItemTitle').first().text().trim();
    return desc || '';
  }

  extractSubmitConfig($) {
    const submitButton = $('button[type="submit"], input[type="submit"]').first();
    if (submitButton.length) {
      return {
        selector: this.getElementSelector(submitButton),
        buttonText: submitButton.text().trim() || submitButton.val()
      };
    }
    
    return {
      selector: 'button[type="submit"]',
      buttonText: 'Отправить'
    };
  }

  async generateDataTemplate(formConfig, outputPath) {
    try {
      const csvHeaders = ['id'];
      const csvData = {};

      // Добавляем заголовки для каждого поля
      formConfig.fields.forEach(field => {
        csvHeaders.push(field.name);
        csvData[field.name] = this.getSampleValue(field);
      });

      // Создаем CSV контент
      const csvContent = [
        csvHeaders.join(','),
        Object.values(csvData).join(',')
      ].join('\n');

      await fs.writeFile(outputPath, csvContent, 'utf8');
      logger.info(`Шаблон данных сохранен в ${outputPath}`);
      
      return outputPath;
    } catch (error) {
      logger.error('Ошибка при создании шаблона данных:', error);
      throw error;
    }
  }

  getSampleValue(field) {
    const samples = {
      'text': 'Пример текста',
      'email': 'example@email.com',
      'phone': '+7 (999) 123-45-67',
      'number': '123',
      'textarea': 'Пример длинного текста',
      'date': '2024-01-01',
      'time': '12:00',
      'select': field.options?.[0]?.value || 'Вариант 1',
      'radio': field.options?.[0]?.value || 'Вариант 1',
      'checkbox': field.options?.[0]?.value || 'Вариант 1'
    };
    
    return samples[field.type] || 'Значение';
  }

  async launchBrowser() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1366, height: 768 });
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = FormAnalyzer;
