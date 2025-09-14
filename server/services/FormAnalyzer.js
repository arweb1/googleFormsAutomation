const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class FormAnalyzer {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async analyzeForm(formUrl) {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      
      // Устанавливаем User-Agent для избежания блокировки
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(formUrl, { waitUntil: 'networkidle2' });
      
      // Ждем загрузки формы
      await page.waitForSelector('form', { timeout: 10000 });
      
      // Получаем HTML формы
      const formHtml = await page.evaluate(() => {
        const form = document.querySelector('form');
        return form ? form.outerHTML : null;
      });
      
      if (!formHtml) {
        throw new Error('Форма не найдена на странице');
      }
      
      // Анализируем форму с помощью Cheerio
      const $ = cheerio.load(formHtml);
      const formData = this.parseForm($);
      
      await page.close();
      
      return {
        url: formUrl,
        title: await this.getFormTitle(page),
        fields: formData.fields,
        submitAction: formData.submitAction,
        method: formData.method,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Ошибка анализа формы:', error);
      throw error;
    }
  }

  async getFormTitle(page) {
    try {
      const title = await page.evaluate(() => {
        const titleElement = document.querySelector('h1, .freebirdFormviewerViewHeaderTitle');
        return titleElement ? titleElement.textContent.trim() : 'Без названия';
      });
      return title;
    } catch (error) {
      return 'Без названия';
    }
  }

  parseForm($) {
    const fields = [];
    const form = $('form').first();
    
    // Получаем метод отправки
    const method = form.attr('method') || 'POST';
    
    // Получаем action для отправки
    const submitAction = form.attr('action') || '';
    
    // Анализируем все поля ввода
    $('input, textarea, select').each((index, element) => {
      const $element = $(element);
      const field = this.parseField($element);
      if (field) {
        fields.push(field);
      }
    });
    
    return {
      fields,
      method,
      submitAction
    };
  }

  parseField($element) {
    const tagName = $element.prop('tagName').toLowerCase();
    const type = $element.attr('type') || 'text';
    const name = $element.attr('name');
    const id = $element.attr('id');
    const required = $element.attr('required') !== undefined;
    const placeholder = $element.attr('placeholder') || '';
    
    if (!name && !id) {
      return null; // Пропускаем поля без имени
    }
    
    const field = {
      id: id || name,
      name: name || id,
      type: this.mapFieldType(tagName, type),
      required: required,
      placeholder: placeholder,
      options: []
    };
    
    // Для select и radio/checkbox групп получаем опции
    if (tagName === 'select') {
      field.options = this.parseSelectOptions($element);
    } else if (type === 'radio' || type === 'checkbox') {
      field.options = this.parseRadioCheckboxOptions($element);
    }
    
    return field;
  }

  mapFieldType(tagName, inputType) {
    if (tagName === 'textarea') return 'textarea';
    if (tagName === 'select') return 'select';
    
    switch (inputType) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return 'text';
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      case 'time':
        return 'time';
      case 'datetime-local':
        return 'datetime';
      case 'radio':
        return 'radio';
      case 'checkbox':
        return 'checkbox';
      case 'file':
        return 'file';
      default:
        return 'text';
    }
  }

  parseSelectOptions($select) {
    const options = [];
    $select.find('option').each((index, option) => {
      const $option = $(option);
      options.push({
        value: $option.attr('value') || $option.text(),
        label: $option.text(),
        selected: $option.attr('selected') !== undefined
      });
    });
    return options;
  }

  parseRadioCheckboxOptions($element) {
    // Для radio и checkbox нужно найти все элементы с одинаковым name
    const name = $element.attr('name');
    if (!name) return [];
    
    const options = [];
    $element.closest('form').find(`input[name="${name}"]`).each((index, input) => {
      const $input = $(input);
      const $label = $input.next('label').length ? $input.next('label') : 
                    $input.closest('label');
      
      options.push({
        value: $input.attr('value') || $input.attr('id'),
        label: $label.text().trim() || $input.attr('value') || $input.attr('id'),
        checked: $input.attr('checked') !== undefined
      });
    });
    
    return options;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = FormAnalyzer;
