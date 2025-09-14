#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

class FormFiller {
  constructor() {
    this.browser = null;
  }

  async initBrowser(headless = false) {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async fillForm(formUrl, accountData, options = {}) {
    try {
      console.log(`🔍 Заполняю форму для аккаунта: ${accountData.email}`);
      
      const browser = await this.initBrowser(options.headless);
      const page = await browser.newPage();
      
      // Устанавливаем User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log('📡 Загружаю страницу формы...');
      await page.goto(formUrl, { waitUntil: 'networkidle2' });
      
      // Ждем загрузки формы
      await page.waitForSelector('form', { timeout: 10000 });
      
      console.log('📝 Заполняю поля формы...');
      
      // Заполняем поля
      for (const [fieldName, value] of Object.entries(accountData.data)) {
        try {
          await this.fillField(page, fieldName, value);
          console.log(`   ✅ ${fieldName}: ${value}`);
        } catch (error) {
          console.log(`   ❌ ${fieldName}: ${error.message}`);
        }
      }
      
      // Отправляем форму
      if (options.submit !== false) {
        console.log('📤 Отправляю форму...');
        await this.submitForm(page);
        
        // Ждем подтверждения
        await this.waitForSubmission(page);
        console.log('✅ Форма успешно отправлена!');
      }
      
      await page.close();
      
      return {
        success: true,
        account: accountData.email,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Ошибка заполнения формы:', error.message);
      throw error;
    }
  }

  async fillField(page, fieldName, value) {
    try {
      // Пробуем разные селекторы
      const selectors = [
        `[name="${fieldName}"]`,
        `#${fieldName}`,
        `input[name="${fieldName}"]`,
        `textarea[name="${fieldName}"]`,
        `select[name="${fieldName}"]`
      ];
      
      let element = null;
      for (const selector of selectors) {
        try {
          element = await page.$(selector);
          if (element) break;
        } catch (error) {
          // Пробуем следующий селектор
        }
      }
      
      if (!element) {
        throw new Error(`Поле ${fieldName} не найдено`);
      }
      
      // Определяем тип поля
      const tagName = await page.evaluate(el => el.tagName.toLowerCase(), element);
      const inputType = await page.evaluate(el => el.type, element);
      
      // Заполняем в зависимости от типа
      if (tagName === 'select') {
        await page.select(`[name="${fieldName}"]`, value);
      } else if (inputType === 'radio') {
        await page.click(`input[name="${fieldName}"][value="${value}"]`);
      } else if (inputType === 'checkbox') {
        if (Array.isArray(value)) {
          for (const val of value) {
            await page.click(`input[name="${fieldName}"][value="${val}"]`);
          }
        } else {
          await page.click(`input[name="${fieldName}"][value="${value}"]`);
        }
      } else {
        // Текстовые поля
        await page.focus(`[name="${fieldName}"]`);
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type(`[name="${fieldName}"]`, value);
      }
      
    } catch (error) {
      throw new Error(`Ошибка заполнения поля ${fieldName}: ${error.message}`);
    }
  }

  async submitForm(page) {
    try {
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
      
      // Если не нашли кнопку, пробуем отправить через Enter
      await page.keyboard.press('Enter');
      
    } catch (error) {
      throw new Error(`Ошибка отправки формы: ${error.message}`);
    }
  }

  async waitForSubmission(page) {
    try {
      // Ждем появления сообщения об успешной отправке
      await page.waitForSelector('.freebirdFormviewerViewResponseConfirmationMessage, .thank-you, .success', { 
        timeout: 10000 
      });
    } catch (error) {
      // Если не дождались подтверждения, это не критично
      console.log('⚠️  Не удалось дождаться подтверждения отправки');
    }
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
    console.log('📝 Заполнение Google Forms');
    console.log('='.repeat(30));
    console.log('Использование: node fill-form.js <form_url> <accounts_file> [options]');
    console.log('');
    console.log('Примеры:');
    console.log('  node fill-form.js "https://docs.google.com/forms/d/..." accounts.json');
    console.log('  node fill-form.js "https://docs.google.com/forms/d/..." accounts.json --headless');
    console.log('  node fill-form.js "https://docs.google.com/forms/d/..." accounts.json --no-submit');
    console.log('');
    process.exit(1);
  }

  const formUrl = args[0];
  const accountsFile = args[1];
  const headless = args.includes('--headless');
  const noSubmit = args.includes('--no-submit');

  const filler = new FormFiller();
  
  try {
    // Загружаем аккаунты
    const accounts = await fs.readJson(accountsFile);
    
    if (!Array.isArray(accounts)) {
      throw new Error('Файл аккаунтов должен содержать массив');
    }
    
    console.log(`📊 Найдено ${accounts.length} аккаунтов`);
    console.log(`🔗 URL формы: ${formUrl}`);
    console.log(`👁️  Режим браузера: ${headless ? 'скрытый' : 'видимый'}`);
    console.log(`📤 Отправка формы: ${noSubmit ? 'отключена' : 'включена'}`);
    
    const results = [];
    
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      
      console.log(`\n👤 Обрабатываю аккаунт ${i + 1}/${accounts.length}: ${account.email}`);
      
      try {
        const result = await filler.fillForm(formUrl, account, {
          headless: headless,
          submit: !noSubmit
        });
        
        results.push(result);
        
        // Задержка между аккаунтами
        if (i < accounts.length - 1) {
          console.log('⏳ Ожидание 2 секунды...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Ошибка для аккаунта ${account.email}:`, error.message);
        results.push({
          success: false,
          account: account.email,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Сохраняем результаты
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(__dirname, '../data', `results-${timestamp}.json`);
    await fs.ensureDir(path.dirname(resultsFile));
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`\n📊 РЕЗУЛЬТАТЫ:`);
    console.log(`✅ Успешно: ${results.filter(r => r.success).length}`);
    console.log(`❌ Ошибок: ${results.filter(r => !r.success).length}`);
    console.log(`💾 Результаты сохранены: ${resultsFile}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    await filler.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = FormFiller;
