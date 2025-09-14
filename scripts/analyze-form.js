#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

class FormAnalyzerCLI {
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
      console.log('🔍 Анализирую форму...');
      
      const browser = await this.initBrowser();
      const page = await browser.newPage();
      
      // Устанавливаем User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('📡 Загружаю страницу формы...');
      await page.goto(formUrl, { waitUntil: 'networkidle2' });
      
      // Ждем загрузки формы
      await page.waitForSelector('form', { timeout: 10000 });
      
      console.log('📝 Извлекаю данные формы...');
      
      // Получаем HTML формы
      const formHtml = await page.evaluate(() => {
        const form = document.querySelector('form');
        return form ? form.outerHTML : null;
      });
      
      if (!formHtml) {
        throw new Error('Форма не найдена на странице');
      }
      
      // Получаем заголовок формы
      const title = await page.evaluate(() => {
        const titleElement = document.querySelector('h1, .freebirdFormviewerViewHeaderTitle');
        return titleElement ? titleElement.textContent.trim() : 'Без названия';
      });
      
      // Анализируем форму
      const $ = cheerio.load(formHtml);
      const formData = this.parseForm($);
      
      await page.close();
      
      const analysis = {
        url: formUrl,
        title: title,
        fields: formData.fields,
        submitAction: formData.submitAction,
        method: formData.method,
        timestamp: new Date().toISOString(),
        summary: this.generateSummary(formData.fields)
      };
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Ошибка анализа формы:', error.message);
      throw error;
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

  generateSummary(fields) {
    const summary = {
      totalFields: fields.length,
      requiredFields: fields.filter(f => f.required).length,
      fieldTypes: {},
      fieldsWithOptions: 0
    };

    fields.forEach(field => {
      summary.fieldTypes[field.type] = (summary.fieldTypes[field.type] || 0) + 1;
      if (field.options && field.options.length > 0) {
        summary.fieldsWithOptions++;
      }
    });

    return summary;
  }

  displayAnalysis(analysis) {
    console.log('\n📋 РЕЗУЛЬТАТ АНАЛИЗА ФОРМЫ');
    console.log('='.repeat(50));
    console.log(`📝 Название: ${analysis.title}`);
    console.log(`🔗 URL: ${analysis.url}`);
    console.log(`📊 Всего полей: ${analysis.summary.totalFields}`);
    console.log(`⚠️  Обязательных полей: ${analysis.summary.requiredFields}`);
    console.log(`🎯 Полей с вариантами: ${analysis.summary.fieldsWithOptions}`);
    
    console.log('\n📈 ТИПЫ ПОЛЕЙ:');
    Object.entries(analysis.summary.fieldTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    console.log('\n📝 ДЕТАЛЬНАЯ ИНФОРМАЦИЯ О ПОЛЯХ:');
    console.log('-'.repeat(50));
    
    analysis.fields.forEach((field, index) => {
      console.log(`\n${index + 1}. ${field.name || field.id}`);
      console.log(`   Тип: ${field.type}`);
      console.log(`   Обязательное: ${field.required ? 'Да' : 'Нет'}`);
      if (field.placeholder) {
        console.log(`   Подсказка: ${field.placeholder}`);
      }
      
      if (field.options && field.options.length > 0) {
        console.log(`   Варианты ответов:`);
        field.options.forEach(option => {
          console.log(`     - ${option.label} (${option.value})`);
        });
      }
    });

    console.log('\n💡 РЕКОМЕНДАЦИИ:');
    console.log('-'.repeat(50));
    
    if (analysis.summary.requiredFields > 0) {
      console.log(`⚠️  Обратите внимание на ${analysis.summary.requiredFields} обязательных полей`);
    }
    
    const textFields = analysis.summary.fieldTypes.text || 0;
    if (textFields > 0) {
      console.log(`📝 Подготовьте данные для ${textFields} текстовых полей`);
    }
    
    const selectFields = analysis.summary.fieldTypes.select || 0;
    if (selectFields > 0) {
      console.log(`🎯 Выберите варианты для ${selectFields} полей выбора`);
    }
  }

  async saveAnalysis(analysis, filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `form-analysis-${timestamp}.json`;
    }
    
    const filepath = path.join(__dirname, '../data', filename);
    await fs.ensureDir(path.dirname(filepath));
    await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
    
    console.log(`\n💾 Анализ сохранен в файл: ${filepath}`);
    return filepath;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// CLI интерфейс
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔍 Анализатор Google Forms');
    console.log('='.repeat(30));
    console.log('Использование: node analyze-form.js <URL_формы> [--save]');
    console.log('');
    console.log('Примеры:');
    console.log('  node analyze-form.js "https://docs.google.com/forms/d/..."');
    console.log('  node analyze-form.js "https://docs.google.com/forms/d/..." --save');
    console.log('');
    process.exit(1);
  }

  const formUrl = args[0];
  const shouldSave = args.includes('--save');

  const analyzer = new FormAnalyzerCLI();
  
  try {
    const analysis = await analyzer.analyzeForm(formUrl);
    analyzer.displayAnalysis(analysis);
    
    if (shouldSave) {
      await analyzer.saveAnalysis(analysis);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await analyzer.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = FormAnalyzerCLI;
