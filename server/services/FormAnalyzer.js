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
      
      // Ждем загрузки контента формы - используем более общий селектор для современных Google Forms
      await page.waitForSelector('input, textarea, select, [role="checkbox"], [role="radio"], [role="combobox"], .freebirdFormviewerViewItemsItemItem', { timeout: 15000 });
      
      // Дополнительное ожидание для полной загрузки
      await page.waitForTimeout(2000);
      
      // Добавляем отладочную информацию
      console.log('🔍 Анализируем структуру формы...');
      const debugInfo = await page.evaluate(() => {
        const info = {
          totalInputs: document.querySelectorAll('input').length,
          totalTextareas: document.querySelectorAll('textarea').length,
          totalSelects: document.querySelectorAll('select').length,
          totalCheckboxes: document.querySelectorAll('input[type="checkbox"]').length,
          totalRadios: document.querySelectorAll('input[type="radio"]').length,
          questionElements: document.querySelectorAll('.freebirdFormviewerViewItemsItemItem').length,
          modernQuestionElements: document.querySelectorAll('[data-item-id]').length,
          // Дополнительные селекторы для отладки
          allDivs: document.querySelectorAll('div').length,
          freebirdElements: document.querySelectorAll('[class*="freebird"]').length,
          checkboxElements: document.querySelectorAll('[role="checkbox"], input[type="checkbox"], .checkbox').length,
          // Ищем все элементы с текстом "Record my email"
          recordEmailElements: Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent && el.textContent.includes('Record my email')).length
        };
        return info;
      });
      
      console.log('📊 Отладочная информация:', debugInfo);
      
      // Дополнительная отладка - ищем все элементы с чекбоксами
      const checkboxDebug = await page.evaluate(() => {
        const checkboxes = [];
        
        // Ищем все элементы с role="checkbox"
        const roleCheckboxes = document.querySelectorAll('[role="checkbox"]');
        roleCheckboxes.forEach((el, index) => {
          checkboxes.push({
            type: 'role-checkbox',
            index: index,
            tagName: el.tagName,
            className: el.className,
            textContent: el.textContent.trim(),
            ariaLabel: el.getAttribute('aria-label'),
            innerHTML: el.innerHTML.substring(0, 200)
          });
        });
        
        // Ищем все input[type="checkbox"]
        const inputCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        inputCheckboxes.forEach((el, index) => {
          checkboxes.push({
            type: 'input-checkbox',
            index: index,
            tagName: el.tagName,
            className: el.className,
            name: el.name,
            value: el.value,
            checked: el.checked,
            innerHTML: el.outerHTML
          });
        });
        
        // Ищем все элементы с классом checkbox
        const classCheckboxes = document.querySelectorAll('.checkbox, [class*="checkbox"]');
        classCheckboxes.forEach((el, index) => {
          checkboxes.push({
            type: 'class-checkbox',
            index: index,
            tagName: el.tagName,
            className: el.className,
            textContent: el.textContent.trim(),
            innerHTML: el.innerHTML.substring(0, 200)
          });
        });
        
        return checkboxes;
      });
      
      console.log('🔍 Найденные чекбоксы:', checkboxDebug);
      
      // Получаем название формы ДО закрытия страницы
      const formTitle = await this.getFormTitle(page);
      
      // Получаем данные формы через JavaScript
      const formData = await page.evaluate(() => {
        const fields = [];
        
        // Ищем все элементы вопросов в современных Google Forms
        const questionElements = document.querySelectorAll('.freebirdFormviewerViewItemsItemItem, [data-item-id], .freebirdFormviewerViewItemsItemItemWrapper, .freebirdFormviewerViewItemsItemItem, .freebirdFormviewerViewItemsItemItemWrapper');
        
        console.log(`Найдено элементов вопросов: ${questionElements.length}`);
        
        questionElements.forEach((questionElement, index) => {
          try {
            // Ищем заголовок вопроса
            let title = '';
            const titleSelectors = [
              '.freebirdFormviewerViewItemsItemItemTitle',
              '.freebirdFormviewerViewItemsItemItemTitleText',
              '[data-params*="title"]',
              '.freebirdFormviewerViewItemsItemItemTitleContainer',
              'h2',
              'h3',
              '.question-title',
              '[role="heading"]'
            ];
            
            for (const selector of titleSelectors) {
              const titleEl = questionElement.querySelector(selector);
              if (titleEl && titleEl.textContent.trim()) {
                title = titleEl.textContent.trim();
                break;
              }
            }
            
            // Если заголовок не найден, ищем в общих элементах
            if (!title) {
              const textElements = questionElement.querySelectorAll('span, div, p');
              for (const textEl of textElements) {
                const text = textEl.textContent.trim();
                if (text && text.length > 3 && text.length < 200 && 
                    !text.includes('Your answer') && 
                    !text.includes('Required') &&
                    !text.includes('Optional') &&
                    !text.includes('Submit') &&
                    !text.includes('Clear form')) {
                  title = text;
                  break;
                }
              }
            }
            
            if (!title) {
              title = `Вопрос ${index + 1}`;
            }
            
            // Определяем тип поля и получаем опции
            let fieldType = 'text';
            let options = [];
            let required = false;
            
            // Проверяем на обязательность
            if (questionElement.querySelector('[aria-label*="Required"], .freebirdFormviewerViewItemsItemRequiredAsterisk')) {
              required = true;
            }
            
            // Ищем поля ввода
            const inputElements = questionElement.querySelectorAll('input, textarea, select, [role="checkbox"], [role="radio"], [role="combobox"]');
            
            if (inputElements.length > 0) {
              const firstInput = inputElements[0];
              
              // Определяем тип поля
              if (firstInput.type === 'radio' || firstInput.getAttribute('role') === 'radio') {
                fieldType = 'radio';
                // Получаем все радио-кнопки в группе
                const radioGroup = questionElement.querySelectorAll('input[type="radio"], [role="radio"]');
                radioGroup.forEach(radio => {
                  const label = radio.closest('label') || radio.parentElement;
                  const optionText = label ? label.textContent.trim() : radio.value || 'Опция';
                  options.push({
                    value: radio.value || optionText,
                    label: optionText,
                    checked: radio.checked || false
                  });
                });
              } else if (firstInput.type === 'checkbox' || firstInput.getAttribute('role') === 'checkbox') {
                fieldType = 'checkbox';
                // Получаем все чекбоксы в группе
                const checkboxGroup = questionElement.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
                checkboxGroup.forEach(checkbox => {
                  const label = checkbox.closest('label') || checkbox.parentElement;
                  const optionText = label ? label.textContent.trim() : checkbox.value || 'Опция';
                  options.push({
                    value: checkbox.value || optionText,
                    label: optionText,
                    checked: checkbox.checked || false
                  });
                });
              } else if (firstInput.tagName === 'SELECT' || firstInput.getAttribute('role') === 'combobox') {
                fieldType = 'select';
                const selectOptions = firstInput.querySelectorAll('option');
                selectOptions.forEach(option => {
                  options.push({
                    value: option.value,
                    label: option.textContent.trim(),
                    selected: option.selected || false
                  });
                });
              } else if (firstInput.tagName === 'TEXTAREA') {
                fieldType = 'textarea';
              } else if (firstInput.type === 'email') {
                fieldType = 'email';
              } else if (firstInput.type === 'number') {
                fieldType = 'number';
              } else if (firstInput.type === 'date') {
                fieldType = 'date';
              } else if (firstInput.type === 'time') {
                fieldType = 'time';
              } else if (firstInput.type === 'url') {
                fieldType = 'url';
              } else if (firstInput.type === 'tel') {
                fieldType = 'tel';
              } else {
                fieldType = 'text';
              }
            }
            
            // Создаем объект поля
            const field = {
              id: `field_${index + 1}`,
              name: `field_${index + 1}`,
              type: fieldType,
              required: required,
              placeholder: '',
              title: title,
              description: '',
              options: options
            };
            
            fields.push(field);
            console.log(`Обработан вопрос ${index + 1}: ${title} (тип: ${fieldType}, опций: ${options.length})`);
            
          } catch (error) {
            console.error(`Ошибка при обработке вопроса ${index + 1}:`, error);
          }
        });
        
        // Если не найдены элементы вопросов, пробуем старый метод
        if (fields.length === 0) {
          console.log('Не найдены элементы вопросов, используем старый метод...');
          
          const visibleInputs = Array.from(document.querySelectorAll('input, textarea, select')).filter(input => {
            if (input.type === 'hidden') return false;
            if (input.name === 'fvv' || input.name === 'partialResponse' || 
                input.name === 'pageHistory' || input.name === 'fbzx' || 
                input.name === 'submissionTimestamp') return false;
            return input.offsetParent !== null;
          });
          
          visibleInputs.forEach((input, index) => {
            const field = {
              id: `field_${index + 1}`,
              name: input.name || `field_${index + 1}`,
              type: input.type || 'text',
              required: input.hasAttribute('required'),
              placeholder: input.placeholder || '',
              title: `Поле ${index + 1}`,
              description: '',
              options: []
            };
            
            fields.push(field);
          });
        }
        
        // Дополнительно ищем чекбоксы с role="checkbox"
        const roleCheckboxes = document.querySelectorAll('[role="checkbox"]');
        roleCheckboxes.forEach((checkbox, index) => {
          const ariaLabel = checkbox.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.trim()) {
            // Определяем обязательность чекбокса
            let required = false;
            
            // Проверяем различные индикаторы обязательности
            if (checkbox.getAttribute('aria-required') === 'true') {
              required = true;
            } else if (checkbox.closest('[data-required="true"]')) {
              required = true;
            } else if (checkbox.closest('.required')) {
              required = true;
            } else if (checkbox.closest('[class*="required"]')) {
              required = true;
            } else {
              // Проверяем родительские элементы на наличие индикаторов обязательности
              let parent = checkbox.parentElement;
              while (parent && parent !== document.body) {
                if (parent.textContent && parent.textContent.includes('*')) {
                  required = true;
                  break;
                }
                parent = parent.parentElement;
              }
            }
            
            const field = {
              id: `checkbox_${fields.length + 1}`,
              name: `checkbox_${fields.length + 1}`,
              type: 'checkbox',
              required: required,
              placeholder: '',
              title: ariaLabel.trim(),
              description: '',
              options: [{
                value: 'true',
                label: ariaLabel.trim(),
                checked: checkbox.getAttribute('aria-checked') === 'true'
              }]
            };
            
            fields.push(field);
            console.log(`Добавлен чекбокс: ${ariaLabel.trim()} (обязательный: ${field.required})`);
          }
        });
        
        console.log(`Итого найдено полей: ${fields.length}`);
        return fields;
      });
      
      await page.close();
      
      return {
        url: formUrl,
        title: formTitle,
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
          // Современные селекторы Google Forms
          'h1[data-params*="title"]',
          '.freebirdFormviewerViewHeaderTitle',
          '.freebirdFormviewerViewHeaderTitleContainer',
          '.freebirdFormviewerViewHeaderTitleContainerTitle',
          '.freebirdFormviewerViewHeaderTitleContainerTitleText',
          '[data-params*="title"]',
          // Общие селекторы заголовков
          'h1',
          'h2',
          '.form-title',
          '.header-title',
          // Селекторы для новых версий Google Forms
          '[role="heading"]',
          '.M7eMe',
          '.aXBZVd',
          '.freebirdFormviewerViewHeaderTitleContainerTitleText',
          // Дополнительные селекторы
          'title',
          'meta[property="og:title"]'
        ];
        
        for (const selector of titleSelectors) {
          const titleElement = document.querySelector(selector);
          if (titleElement) {
            let titleText = '';
            
            // Для meta тегов получаем content
            if (titleElement.tagName === 'META') {
              titleText = titleElement.getAttribute('content') || '';
            } else {
              titleText = titleElement.textContent || titleElement.innerText || '';
            }
            
            titleText = titleText.trim();
            
            // Проверяем, что это не пустой текст и не технические элементы
            if (titleText && 
                titleText.length > 0 && 
                titleText.length < 200 &&
                !titleText.includes('Google Forms') &&
                !titleText.includes('Untitled form') &&
                !titleText.includes('Без названия') &&
                !titleText.includes('Submit') &&
                !titleText.includes('Clear form')) {
              return titleText;
            }
          }
        }
        
        // Если ничего не найдено, пробуем найти любой заголовок на странице
        const allHeadings = document.querySelectorAll('h1, h2, h3, [role="heading"]');
        for (const heading of allHeadings) {
          const text = heading.textContent.trim();
          if (text && text.length > 0 && text.length < 200 && 
              !text.includes('Google Forms') && 
              !text.includes('Untitled form')) {
            return text;
          }
        }
        
        return 'Без названия';
      });
      return title;
    } catch (error) {
      console.error('Ошибка при извлечении названия формы:', error);
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
