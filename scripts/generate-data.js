#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class DataGenerator {
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

  async generateDataForForm(analysisFile) {
    try {
      console.log('📊 Генератор данных для заполнения форм');
      console.log('='.repeat(40));
      
      // Загружаем анализ формы
      const analysis = await fs.readJson(analysisFile);
      
      console.log(`\n📝 Форма: ${analysis.title}`);
      console.log(`🔗 URL: ${analysis.url}`);
      console.log(`📊 Полей: ${analysis.fields.length}`);
      
      const accounts = [];
      const count = await this.question('\n👥 Сколько аккаунтов создать? ');
      const accountCount = parseInt(count) || 1;
      
      console.log(`\n📋 Создаю данные для ${accountCount} аккаунтов...\n`);
      
      for (let i = 0; i < accountCount; i++) {
        console.log(`\n👤 Аккаунт ${i + 1}/${accountCount}:`);
        console.log('-'.repeat(30));
        
        const account = {
          email: '',
          password: '',
          data: {}
        };
        
        // Генерируем email и пароль
        account.email = await this.question('📧 Email: ');
        account.password = await this.question('🔒 Пароль: ');
        
        // Заполняем данные для полей формы
        for (const field of analysis.fields) {
          const fieldName = field.name || field.id;
          const fieldType = field.type;
          
          console.log(`\n📝 Поле: ${fieldName} (${fieldType})`);
          if (field.required) {
            console.log('⚠️  Обязательное поле');
          }
          
          if (field.options && field.options.length > 0) {
            console.log('🎯 Доступные варианты:');
            field.options.forEach((option, index) => {
              console.log(`   ${index + 1}. ${option.label}`);
            });
            
            const choice = await this.question('Выберите вариант (номер): ');
            const choiceIndex = parseInt(choice) - 1;
            
            if (choiceIndex >= 0 && choiceIndex < field.options.length) {
              account.data[fieldName] = field.options[choiceIndex].value;
            } else {
              console.log('❌ Неверный выбор, пропускаю поле');
            }
          } else {
            // Для текстовых полей
            const value = await this.question(`Введите значение: `);
            if (value.trim()) {
              account.data[fieldName] = value.trim();
            }
          }
        }
        
        accounts.push(account);
      }
      
      return accounts;
      
    } catch (error) {
      console.error('❌ Ошибка генерации данных:', error.message);
      throw error;
    }
  }

  async generateFromTemplate(analysisFile, templateFile) {
    try {
      console.log('📊 Генерация данных из шаблона');
      console.log('='.repeat(35));
      
      // Загружаем анализ формы
      const analysis = await fs.readJson(analysisFile);
      
      // Загружаем шаблон
      const template = await fs.readJson(templateFile);
      
      console.log(`\n📝 Форма: ${analysis.title}`);
      console.log(`📋 Шаблон: ${template.name}`);
      
      const accounts = [];
      const count = await this.question('\n👥 Сколько аккаунтов создать? ');
      const accountCount = parseInt(count) || 1;
      
      console.log(`\n🔄 Генерирую ${accountCount} аккаунтов...\n`);
      
      for (let i = 0; i < accountCount; i++) {
        const account = {
          email: this.generateEmail(template.emailTemplate, i),
          password: this.generatePassword(template.passwordTemplate),
          data: {}
        };
        
        // Генерируем данные для полей
        for (const field of analysis.fields) {
          const fieldName = field.name || field.id;
          const templateData = template.fieldTemplates[fieldName];
          
          if (templateData) {
            account.data[fieldName] = this.generateFieldValue(field, templateData, i);
          }
        }
        
        accounts.push(account);
      }
      
      return accounts;
      
    } catch (error) {
      console.error('❌ Ошибка генерации из шаблона:', error.message);
      throw error;
    }
  }

  generateEmail(template, index) {
    if (template.type === 'random') {
      const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const username = `user${index + 1}${Math.floor(Math.random() * 1000)}`;
      return `${username}@${domain}`;
    } else if (template.type === 'pattern') {
      return template.pattern.replace('{index}', index + 1);
    }
    return `user${index + 1}@example.com`;
  }

  generatePassword(template) {
    if (template.type === 'random') {
      const length = template.length || 8;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let password = '';
      for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    } else if (template.type === 'fixed') {
      return template.value;
    }
    return 'password123';
  }

  generateFieldValue(field, templateData, index) {
    if (field.type === 'text' || field.type === 'textarea') {
      if (templateData.type === 'random') {
        return this.getRandomValue(templateData.values);
      } else if (templateData.type === 'pattern') {
        return templateData.pattern.replace('{index}', index + 1);
      } else if (templateData.type === 'fixed') {
        return templateData.value;
      }
    } else if (field.type === 'select' || field.type === 'radio') {
      if (templateData.type === 'random') {
        const options = field.options.map(opt => opt.value);
        return options[Math.floor(Math.random() * options.length)];
      } else if (templateData.type === 'fixed') {
        return templateData.value;
      }
    } else if (field.type === 'checkbox') {
      if (templateData.type === 'random') {
        const options = field.options.map(opt => opt.value);
        const count = Math.floor(Math.random() * options.length) + 1;
        const selected = [];
        for (let i = 0; i < count; i++) {
          const option = options[Math.floor(Math.random() * options.length)];
          if (!selected.includes(option)) {
            selected.push(option);
          }
        }
        return selected;
      }
    }
    
    return '';
  }

  getRandomValue(values) {
    return values[Math.floor(Math.random() * values.length)];
  }

  async saveAccounts(accounts, filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `accounts-${timestamp}.json`;
    }
    
    const filepath = path.join(__dirname, '../data', filename);
    await fs.ensureDir(path.dirname(filepath));
    await fs.writeFile(filepath, JSON.stringify(accounts, null, 2));
    
    console.log(`\n💾 Аккаунты сохранены в файл: ${filepath}`);
    return filepath;
  }

  async saveAsCSV(accounts, filename = null) {
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filename = `accounts-${timestamp}.csv`;
    }
    
    const filepath = path.join(__dirname, '../data', filename);
    await fs.ensureDir(path.dirname(filepath));
    
    // Создаем CSV
    const headers = ['email', 'password'];
    const allFieldNames = new Set();
    
    accounts.forEach(account => {
      Object.keys(account.data).forEach(fieldName => {
        allFieldNames.add(fieldName);
      });
    });
    
    headers.push(...Array.from(allFieldNames));
    
    const csvContent = [
      headers.join(','),
      ...accounts.map(account => {
        const row = [account.email, account.password];
        allFieldNames.forEach(fieldName => {
          const value = account.data[fieldName] || '';
          row.push(`"${value}"`);
        });
        return row.join(',');
      })
    ].join('\n');
    
    await fs.writeFile(filepath, csvContent);
    
    console.log(`\n📊 CSV файл сохранен: ${filepath}`);
    return filepath;
  }

  close() {
    this.rl.close();
  }
}

// CLI интерфейс
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📊 Генератор данных для Google Forms');
    console.log('='.repeat(40));
    console.log('Использование:');
    console.log('  node generate-data.js <analysis_file> [--template <template_file>] [--csv]');
    console.log('');
    console.log('Примеры:');
    console.log('  node generate-data.js form-analysis.json');
    console.log('  node generate-data.js form-analysis.json --template template.json');
    console.log('  node generate-data.js form-analysis.json --csv');
    console.log('');
    process.exit(1);
  }

  const analysisFile = args[0];
  const templateFile = args.includes('--template') ? args[args.indexOf('--template') + 1] : null;
  const saveAsCSV = args.includes('--csv');

  const generator = new DataGenerator();
  
  try {
    let accounts;
    
    if (templateFile) {
      accounts = await generator.generateFromTemplate(analysisFile, templateFile);
    } else {
      accounts = await generator.generateDataForForm(analysisFile);
    }
    
    // Сохраняем результаты
    await generator.saveAccounts(accounts);
    
    if (saveAsCSV) {
      await generator.saveAsCSV(accounts);
    }
    
    console.log(`\n✅ Создано ${accounts.length} аккаунтов`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    generator.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = DataGenerator;
