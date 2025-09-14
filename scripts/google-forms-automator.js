#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

const FormAnalyzerCLI = require('./analyze-form');
const DataGenerator = require('./generate-data');
const TemplateCreator = require('./create-template');
const FormFiller = require('./fill-form');

class GoogleFormsAutomator {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async showMenu() {
    console.log('\n🚀 Google Forms Automator');
    console.log('='.repeat(30));
    console.log('1. 📊 Анализировать форму');
    console.log('2. 📋 Создать шаблон данных');
    console.log('3. 👥 Сгенерировать данные аккаунтов');
    console.log('4. 📝 Заполнить форму');
    console.log('5. 🔄 Полный цикл (анализ → данные → заполнение)');
    console.log('6. 📁 Просмотр файлов');
    console.log('0. ❌ Выход');
    console.log('');
  }

  async analyzeForm() {
    console.log('\n📊 АНАЛИЗ ФОРМЫ');
    console.log('='.repeat(20));
    
    const formUrl = await this.question('🔗 Введите URL Google формы: ');
    
    if (!formUrl.trim()) {
      console.log('❌ URL не может быть пустым');
      return;
    }
    
    const analyzer = new FormAnalyzerCLI();
    
    try {
      const analysis = await analyzer.analyzeForm(formUrl);
      analyzer.displayAnalysis(analysis);
      
      const save = await this.question('\n💾 Сохранить анализ? (y/n): ');
      if (save.toLowerCase() === 'y') {
        const filename = await analyzer.saveAnalysis(analysis);
        console.log(`✅ Анализ сохранен: ${filename}`);
      }
      
    } catch (error) {
      console.error('❌ Ошибка анализа:', error.message);
    } finally {
      await analyzer.close();
    }
  }

  async createTemplate() {
    console.log('\n📋 СОЗДАНИЕ ШАБЛОНА');
    console.log('='.repeat(25));
    
    const analysisFile = await this.question('📄 Путь к файлу анализа: ');
    
    if (!await fs.pathExists(analysisFile)) {
      console.log('❌ Файл анализа не найден');
      return;
    }
    
    const creator = new TemplateCreator();
    
    try {
      const template = await creator.createTemplate(analysisFile);
      const filename = await creator.saveTemplate(template);
      console.log(`✅ Шаблон создан: ${filename}`);
    } catch (error) {
      console.error('❌ Ошибка создания шаблона:', error.message);
    } finally {
      creator.close();
    }
  }

  async generateData() {
    console.log('\n👥 ГЕНЕРАЦИЯ ДАННЫХ');
    console.log('='.repeat(25));
    
    const analysisFile = await this.question('📄 Путь к файлу анализа: ');
    
    if (!await fs.pathExists(analysisFile)) {
      console.log('❌ Файл анализа не найден');
      return;
    }
    
    const useTemplate = await this.question('📋 Использовать шаблон? (y/n): ');
    let templateFile = null;
    
    if (useTemplate.toLowerCase() === 'y') {
      templateFile = await this.question('📄 Путь к файлу шаблона: ');
      
      if (!await fs.pathExists(templateFile)) {
        console.log('❌ Файл шаблона не найден');
        return;
      }
    }
    
    const generator = new DataGenerator();
    
    try {
      let accounts;
      
      if (templateFile) {
        accounts = await generator.generateFromTemplate(analysisFile, templateFile);
      } else {
        accounts = await generator.generateDataForForm(analysisFile);
      }
      
      await generator.saveAccounts(accounts);
      
      const saveCSV = await this.question('📊 Сохранить в CSV? (y/n): ');
      if (saveCSV.toLowerCase() === 'y') {
        await generator.saveAsCSV(accounts);
      }
      
      console.log(`✅ Создано ${accounts.length} аккаунтов`);
      
    } catch (error) {
      console.error('❌ Ошибка генерации данных:', error.message);
    } finally {
      generator.close();
    }
  }

  async fillForm() {
    console.log('\n📝 ЗАПОЛНЕНИЕ ФОРМЫ');
    console.log('='.repeat(25));
    
    const formUrl = await this.question('🔗 URL формы: ');
    const accountsFile = await this.question('👥 Файл аккаунтов: ');
    
    if (!await fs.pathExists(accountsFile)) {
      console.log('❌ Файл аккаунтов не найден');
      return;
    }
    
    const headless = await this.question('👁️  Скрытый режим браузера? (y/n): ');
    const noSubmit = await this.question('📤 Отключить отправку формы? (y/n): ');
    
    const filler = new FormFiller();
    
    try {
      const accounts = await fs.readJson(accountsFile);
      
      if (!Array.isArray(accounts)) {
        throw new Error('Файл аккаунтов должен содержать массив');
      }
      
      console.log(`📊 Найдено ${accounts.length} аккаунтов`);
      
      const results = [];
      
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        
        console.log(`\n👤 Обрабатываю аккаунт ${i + 1}/${accounts.length}: ${account.email}`);
        
        try {
          const result = await filler.fillForm(formUrl, account, {
            headless: headless.toLowerCase() === 'y',
            submit: noSubmit.toLowerCase() !== 'y'
          });
          
          results.push(result);
          
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
      console.error('❌ Ошибка заполнения формы:', error.message);
    } finally {
      await filler.close();
    }
  }

  async fullCycle() {
    console.log('\n🔄 ПОЛНЫЙ ЦИКЛ АВТОМАТИЗАЦИИ');
    console.log('='.repeat(35));
    
    const formUrl = await this.question('🔗 Введите URL Google формы: ');
    
    if (!formUrl.trim()) {
      console.log('❌ URL не может быть пустым');
      return;
    }
    
    // 1. Анализируем форму
    console.log('\n📊 Шаг 1: Анализ формы...');
    const analyzer = new FormAnalyzerCLI();
    
    try {
      const analysis = await analyzer.analyzeForm(formUrl);
      analyzer.displayAnalysis(analysis);
      
      const analysisFile = await analyzer.saveAnalysis(analysis);
      console.log(`✅ Анализ сохранен: ${analysisFile}`);
      
      await analyzer.close();
      
      // 2. Создаем шаблон
      console.log('\n📋 Шаг 2: Создание шаблона...');
      const creator = new TemplateCreator();
      const template = await creator.createTemplate(analysisFile);
      const templateFile = await creator.saveTemplate(template);
      console.log(`✅ Шаблон создан: ${templateFile}`);
      creator.close();
      
      // 3. Генерируем данные
      console.log('\n👥 Шаг 3: Генерация данных...');
      const generator = new DataGenerator();
      const accounts = await generator.generateFromTemplate(analysisFile, templateFile);
      const accountsFile = await generator.saveAccounts(accounts);
      console.log(`✅ Данные созданы: ${accountsFile}`);
      generator.close();
      
      // 4. Заполняем форму
      console.log('\n📝 Шаг 4: Заполнение формы...');
      const filler = new FormFiller();
      
      const results = [];
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        
        console.log(`\n👤 Обрабатываю аккаунт ${i + 1}/${accounts.length}: ${account.email}`);
        
        try {
          const result = await filler.fillForm(formUrl, account, {
            headless: false,
            submit: true
          });
          
          results.push(result);
          
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
      
      await filler.close();
      
      // Сохраняем результаты
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultsFile = path.join(__dirname, '../data', `results-${timestamp}.json`);
      await fs.ensureDir(path.dirname(resultsFile));
      await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
      
      console.log(`\n🎉 ПОЛНЫЙ ЦИКЛ ЗАВЕРШЕН!`);
      console.log(`✅ Успешно: ${results.filter(r => r.success).length}`);
      console.log(`❌ Ошибок: ${results.filter(r => !r.success).length}`);
      console.log(`💾 Результаты сохранены: ${resultsFile}`);
      
    } catch (error) {
      console.error('❌ Ошибка в полном цикле:', error.message);
    }
  }

  async listFiles() {
    console.log('\n📁 ФАЙЛЫ ПРОЕКТА');
    console.log('='.repeat(20));
    
    const dataDir = path.join(__dirname, '../data');
    await fs.ensureDir(dataDir);
    
    const files = await fs.readdir(dataDir, { withFileTypes: true });
    
    if (files.length === 0) {
      console.log('📂 Папка data пуста');
      return;
    }
    
    console.log('📄 Файлы в папке data:');
    files.forEach(file => {
      const filePath = path.join(dataDir, file.name);
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(2);
      const date = stats.mtime.toLocaleDateString('ru-RU');
      
      console.log(`   ${file.isDirectory() ? '📁' : '📄'} ${file.name} (${size} KB, ${date})`);
    });
  }

  async run() {
    while (true) {
      await this.showMenu();
      
      const choice = await this.question('Выберите действие (0-6): ');
      
      switch (choice) {
        case '1':
          await this.analyzeForm();
          break;
        case '2':
          await this.createTemplate();
          break;
        case '3':
          await this.generateData();
          break;
        case '4':
          await this.fillForm();
          break;
        case '5':
          await this.fullCycle();
          break;
        case '6':
          await this.listFiles();
          break;
        case '0':
          console.log('👋 До свидания!');
          this.rl.close();
          return;
        default:
          console.log('❌ Неверный выбор');
      }
      
      await this.question('\n⏎ Нажмите Enter для продолжения...');
    }
  }

  close() {
    this.rl.close();
  }
}

// CLI интерфейс
async function main() {
  const automator = new GoogleFormsAutomator();
  
  try {
    await automator.run();
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    automator.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = GoogleFormsAutomator;
