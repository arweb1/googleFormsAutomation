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
      
      // Ждем загрузки контента формы - используем более общий селектор
      await page.waitForSelector('input[type="text"], textarea, select, input[type="checkbox"], input[type="radio"]', { timeout: 15000 });
      
      // Дополнительное ожидание для полной загрузки
      await page.waitForTimeout(2000);
      
      // Получаем данные формы через JavaScript
      const formData = await page.evaluate(() => {
        const fields = [];
        
        // Ищем все видимые поля ввода
        const visibleInputs = Array.from(document.querySelectorAll('input, textarea, select')).filter(input => {
          // Пропускаем скрытые поля
          if (input.type === 'hidden') return false;
          if (input.name === 'fvv' || input.name === 'partialResponse' || 
              input.name === 'pageHistory' || input.name === 'fbzx' || 
              input.name === 'submissionTimestamp') return false;
          
          // Проверяем видимость
          return input.offsetParent !== null;
        });
        
        // Для чекбоксов и радио-кнопок группируем их по имени
        const groupedInputs = [];
        const processedNames = new Set();
        
        visibleInputs.forEach(input => {
          if (input.type === 'checkbox' || input.type === 'radio') {
            if (!processedNames.has(input.name)) {
              processedNames.add(input.name);
              groupedInputs.push(input);
            }
          } else {
            groupedInputs.push(input);
          }
        });
        
        groupedInputs.forEach((input, index) => {
          const field = {
            id: `field_${index + 1}`,
            name: input.name || `field_${index + 1}`,
            type: input.type || 'text',
            required: input.hasAttribute('required'),
            placeholder: input.placeholder || '',
            title: '',
            description: '',
            options: []
          };
          
          // Ищем заголовок поля - ищем в родительских элементах
          let currentElement = input.parentElement;
          let titleFound = false;
          
          // Поднимаемся по DOM дереву в поисках заголовка
          while (currentElement && !titleFound) {
            // Ищем текст в различных элементах
            const textElements = currentElement.querySelectorAll('span, div, label, p');
            for (const textEl of textElements) {
              const text = textEl.textContent.trim();
            // Пропускаем пустые тексты и технические элементы
            if (text && text.length > 0 && 
                !text.includes('Your answer') && 
                !text.includes('Ваша відповідь') &&
                !text.includes('Submit') &&
                !text.includes('Clear form') &&
                !text.includes('Sign in to Google') &&
                !text.includes('Learn more') &&
                text.length < 100 &&
                text.length > 3) {
                field.title = text;
                titleFound = true;
                break;
              }
            }
            currentElement = currentElement.parentElement;
          }
          
          // Если заголовок не найден, создаем общий
          if (!field.title) {
            field.title = `Поле ${index + 1}`;
          }
          
          // Для полей выбора получаем варианты
          if (field.type === 'radio' || field.type === 'checkbox') {
            const radioGroup = document.querySelectorAll(`input[name="${input.name}"]`);
            radioGroup.forEach(radio => {
              // Ищем текст опции в различных элементах
              let optionText = '';
              
              // Пробуем найти текст в label
              const label = radio.closest('label');
              if (label) {
                optionText = label.textContent.trim();
              } else {
                // Ищем текст в родительских элементах
                let currentEl = radio.parentElement;
                while (currentEl && !optionText) {
                  const textEl = currentEl.querySelector('span, div');
                  if (textEl && textEl.textContent.trim()) {
                    optionText = textEl.textContent.trim();
                    break;
                  }
                  currentEl = currentEl.parentElement;
                }
              }
              
              // Если текст не найден, используем value
              if (!optionText) {
                optionText = radio.value || 'Опция';
              }
              
              field.options.push({
                value: radio.value,
                label: optionText,
                checked: radio.checked
              });
            });
          } else if (field.type === 'select') {
            const options = input.querySelectorAll('option');
            options.forEach(option => {
              field.options.push({
                value: option.value,
                label: option.textContent.trim(),
                selected: option.selected
              });
            });
          }
          
          fields.push(field);
        });
        
        return fields;
      });
      
      await page.close();
      
      return {
        url: formUrl,
        title: await this.getFormTitle(page),
        fields: formData,
        submitAction: '',
        method: 'POST',
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
        const titleSelectors = [
          'h1',
          '.freebirdFormviewerViewHeaderTitle',
          '.freebirdFormviewerViewHeaderTitleContainer',
          '.freebirdFormviewerViewHeaderTitleContainerTitle',
          '[data-params*="title"]',
          '.freebirdFormviewerViewHeaderTitleContainerTitleText'
        ];
        
        for (const selector of titleSelectors) {
          const titleElement = document.querySelector(selector);
          if (titleElement && titleElement.textContent.trim()) {
            return titleElement.textContent.trim();
          }
        }
        
        return 'Без названия';
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
