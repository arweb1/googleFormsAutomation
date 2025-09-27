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
      
      // Ждем загрузки контента формы
      await page.waitForSelector('input, textarea, select, [role="checkbox"], [role="radio"], [role="combobox"]', { timeout: 15000 });
      
      // Дополнительное ожидание для полной загрузки
      await page.waitForTimeout(2000);
      
      console.log('🔍 Анализируем структуру формы...');
      
      // Получаем название формы
      const formTitle = await this.getFormTitle(page);
      
      // Получаем данные формы через JavaScript
      const formData = await page.evaluate(() => {
        const fields = [];
        
        console.log('🔍 Начинаем анализ формы...');
        
        // Сначала ищем все радиокнопки
        const radioButtons = document.querySelectorAll('input[type="radio"], [role="radio"]');
        const radioGroups = new Map();
        
        radioButtons.forEach(radio => {
          let groupKey = radio.name || radio.getAttribute('data-name');
          
          if (!groupKey) {
            const parent = radio.closest('[role="group"], .freebirdFormviewerViewItemsItemItem, [data-item-id]') || 
                         radio.closest('div').parentElement;
            if (parent) {
              groupKey = parent.getAttribute('data-item-id') || 
                        parent.className || 
                        'radio_group_' + fields.length;
            } else {
              groupKey = 'radio_group_' + fields.length;
            }
          }
          
          if (!radioGroups.has(groupKey)) {
            radioGroups.set(groupKey, []);
          }
          radioGroups.get(groupKey).push(radio);
        });
        
        // Создаем поля для каждой группы радиокнопок
        radioGroups.forEach((radios, groupName) => {
          const firstRadio = radios[0];
          const questionContainer = firstRadio.closest('[role="group"], .freebirdFormviewerViewItemsItemItem, [data-item-id]') || 
                                  firstRadio.closest('div').parentElement;
          
          let title = '';
          if (questionContainer) {
            const titleEl = questionContainer.querySelector('h2, h3, [role="heading"], .freebirdFormviewerViewItemsItemItemTitle, .freebirdFormviewerViewItemsItemItemTitleText');
            if (titleEl) {
              title = titleEl.textContent.trim();
            }
          }
          
          if (!title) {
            // Ищем заголовок в родительских элементах
            let currentElement = firstRadio.parentElement;
            while (currentElement && currentElement !== document.body) {
              const textElements = currentElement.querySelectorAll('span, div, p, label, h1, h2, h3, h4, h5, h6');
              for (const textEl of textElements) {
                const text = textEl.textContent.trim();
                if (text && text.length > 1 && text.length < 200 && 
                    !text.includes('Your answer') && 
                    !text.includes('Required') &&
                    !text.includes('Optional') &&
                    !text.includes('Submit') &&
                    !text.includes('Clear form') &&
                    !text.includes('Record my email') &&
                    !text.includes('Ваша відповідь') &&
                    !text.includes('Answer') &&
                    !text.includes('Ответ') &&
                    !text.includes('Скасувати вибір') &&
                    !text.includes('Clear selection') &&
                    !text.includes('Отменить выбор') &&
                    !text.includes('Cancel selection') &&
                    textEl.offsetParent !== null) {
                  title = text;
                  break;
                }
              }
              if (title) break;
              currentElement = currentElement.parentElement;
            }
          }
          
          if (!title) {
            title = `Радиокнопки ${fields.length + 1}`;
          }
          
          const options = [];
          radios.forEach(radio => {
            let optionText = '';
            let optionValue = '';
            
            if (radio.getAttribute('role') === 'radio') {
              let optionText = radio.getAttribute('aria-label');
              
              if (!optionText) {
                const parent = radio.closest('div');
                if (parent) {
                  const textSpan = parent.querySelector('span.aDTYNe, span.snByac, span.OvPDhc, span.OIC90c, span[dir="auto"]');
                  if (textSpan) {
                    optionText = textSpan.textContent.trim();
                  }
                }
              }
              
              if (!optionText) {
                optionText = radio.getAttribute('data-value') || radio.textContent.trim() || 'Опция';
              }
              
              optionValue = optionText;
            } else {
              const label = radio.closest('label') || 
                           radio.parentElement.querySelector('label') ||
                           radio.parentElement;
              optionText = label ? label.textContent.trim() : radio.value || 'Опция';
              optionValue = radio.value || optionText;
            }
            
            options.push({
              value: optionValue,
              label: optionText,
              checked: radio.checked || radio.getAttribute('aria-checked') === 'true'
            });
          });
          
          fields.push({
            id: `radio_${fields.length + 1}`,
            name: groupName,
            type: 'radio',
            required: firstRadio.hasAttribute('required') || 
                    firstRadio.getAttribute('aria-required') === 'true' ||
                    questionContainer && questionContainer.textContent.includes('*'),
            placeholder: '',
            title: title,
            description: '',
            options: options
          });
          
          console.log(`Добавлена группа радиокнопок: ${title} (${options.length} опций)`);
        });
        
        // Теперь ищем текстовые поля
        const textInputs = Array.from(document.querySelectorAll('input[type="text"], textarea')).filter(input => {
          if (input.type === 'hidden') return false;
          if (input.name === 'fvv' || input.name === 'partialResponse' || 
              input.name === 'pageHistory' || input.name === 'fbzx' || 
              input.name === 'submissionTimestamp') return false;
          return input.offsetParent !== null;
        });
        
        console.log(`Найдено текстовых полей: ${textInputs.length}`);
        
        textInputs.forEach((input, index) => {
          // Ищем заголовок для этого поля
          let title = '';
          const questionContainer = input.closest('[role="group"], .freebirdFormviewerViewItemsItemItem, [data-item-id]') || 
                                 input.closest('div').parentElement;
          
          if (questionContainer) {
            const titleEl = questionContainer.querySelector('h2, h3, [role="heading"], .freebirdFormviewerViewItemsItemItemTitle, .freebirdFormviewerViewItemsItemItemTitleText');
            if (titleEl) {
              title = titleEl.textContent.trim();
            }
          }
          
          if (!title) {
            // Ищем заголовок в родительских элементах
            let currentElement = input.parentElement;
            while (currentElement && currentElement !== document.body) {
              const textElements = currentElement.querySelectorAll('span, div, p, label, h1, h2, h3, h4, h5, h6');
              for (const textEl of textElements) {
                const text = textEl.textContent.trim();
                if (text && text.length > 1 && text.length < 200 && 
                    !text.includes('Your answer') && 
                    !text.includes('Required') &&
                    !text.includes('Optional') &&
                    !text.includes('Submit') &&
                    !text.includes('Clear form') &&
                    !text.includes('Record my email') &&
                    !text.includes('Ваша відповідь') &&
                    !text.includes('Answer') &&
                    !text.includes('Ответ') &&
                    !text.includes('Скасувати вибір') &&
                    !text.includes('Clear selection') &&
                    !text.includes('Отменить выбор') &&
                    !text.includes('Cancel selection') &&
                    textEl.offsetParent !== null) {
                  title = text;
                  break;
                }
              }
              if (title) break;
              currentElement = currentElement.parentElement;
            }
          }
          
          if (!title) {
            title = `Текстовое поле ${index + 1}`;
          }
          
          fields.push({
            id: `text_${fields.length + 1}`,
            name: input.name || `text_${fields.length + 1}`,
            type: input.tagName === 'TEXTAREA' ? 'textarea' : 'text',
            required: input.hasAttribute('required'),
            placeholder: input.placeholder || '',
            title: title,
            description: '',
            options: []
          });
          
          console.log(`Добавлено текстовое поле: ${title}`);
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
          'h1[data-params*="title"]',
          '.freebirdFormviewerViewHeaderTitle',
          '.freebirdFormviewerViewHeaderTitleContainer',
          '.freebirdFormviewerViewHeaderTitleContainerTitle',
          '.freebirdFormviewerViewHeaderTitleContainerTitleText',
          '[data-params*="title"]',
          'h1',
          'h2',
          '.form-title',
          '.header-title',
          '[role="heading"]',
          '.M7eMe',
          '.aXBZVd',
          '.freebirdFormviewerViewHeaderTitleContainerTitleText',
          'title',
          'meta[property="og:title"]'
        ];
        
        for (const selector of titleSelectors) {
          const titleElement = document.querySelector(selector);
          if (titleElement) {
            let titleText = '';
            
            if (titleElement.tagName === 'META') {
              titleText = titleElement.getAttribute('content') || '';
            } else {
              titleText = titleElement.textContent || titleElement.innerText || '';
            }
            
            titleText = titleText.trim();
            
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

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = FormAnalyzer;
