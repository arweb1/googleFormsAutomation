#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class TemplateCreator {
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

  async createTemplate(analysisFile) {
    try {
      console.log('📋 Создание шаблона для генерации данных');
      console.log('='.repeat(45));
      
      // Загружаем анализ формы
      const analysis = await fs.readJson(analysisFile);
      
      console.log(`\n📝 Форма: ${analysis.title}`);
      console.log(`📊 Полей: ${analysis.fields.length}`);
      
      const template = {
        name: '',
        description: '',
        emailTemplate: {},
        passwordTemplate: {},
        fieldTemplates: {}
      };
      
      // Название шаблона
      template.name = await this.question('\n📋 Название шаблона: ');
      template.description = await this.question('📝 Описание: ');
      
      // Настройка email
      console.log('\n📧 Настройка генерации email:');
      console.log('1. Случайные email (user1@gmail.com, user2@yahoo.com, ...)');
      console.log('2. По шаблону (например: test{index}@gmail.com)');
      
      const emailChoice = await this.question('Выберите тип (1-2): ');
      
      if (emailChoice === '1') {
        template.emailTemplate = {
          type: 'random',
          domains: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']
        };
      } else if (emailChoice === '2') {
        const pattern = await this.question('Введите шаблон (используйте {index} для номера): ');
        template.emailTemplate = {
          type: 'pattern',
          pattern: pattern
        };
      } else {
        template.emailTemplate = { type: 'random' };
      }
      
      // Настройка пароля
      console.log('\n🔒 Настройка генерации пароля:');
      console.log('1. Случайные пароли');
      console.log('2. Фиксированный пароль');
      
      const passwordChoice = await this.question('Выберите тип (1-2): ');
      
      if (passwordChoice === '1') {
        const length = await this.question('Длина пароля (по умолчанию 8): ');
        template.passwordTemplate = {
          type: 'random',
          length: parseInt(length) || 8
        };
      } else if (passwordChoice === '2') {
        const password = await this.question('Введите пароль: ');
        template.passwordTemplate = {
          type: 'fixed',
          value: password
        };
      } else {
        template.passwordTemplate = { type: 'random', length: 8 };
      }
      
      // Настройка полей формы
      console.log('\n📝 Настройка полей формы:');
      console.log('-'.repeat(30));
      
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
          
          console.log('\nНастройка генерации:');
          console.log('1. Случайный выбор из вариантов');
          console.log('2. Фиксированный вариант');
          console.log('3. Пропустить поле');
          
          const choice = await this.question('Выберите тип (1-3): ');
          
          if (choice === '1') {
            template.fieldTemplates[fieldName] = {
              type: 'random'
            };
          } else if (choice === '2') {
            const optionIndex = await this.question('Выберите номер варианта: ');
            const index = parseInt(optionIndex) - 1;
            
            if (index >= 0 && index < field.options.length) {
              template.fieldTemplates[fieldName] = {
                type: 'fixed',
                value: field.options[index].value
              };
            } else {
              console.log('❌ Неверный выбор, пропускаю поле');
            }
          }
        } else {
          // Для текстовых полей
          console.log('\nНастройка генерации:');
          console.log('1. Случайные значения из списка');
          console.log('2. Значения по шаблону');
          console.log('3. Фиксированное значение');
          console.log('4. Пропустить поле');
          
          const choice = await this.question('Выберите тип (1-4): ');
          
          if (choice === '1') {
            const values = await this.question('Введите значения через запятую: ');
            template.fieldTemplates[fieldName] = {
              type: 'random',
              values: values.split(',').map(v => v.trim())
            };
          } else if (choice === '2') {
            const pattern = await this.question('Введите шаблон (используйте {index} для номера): ');
            template.fieldTemplates[fieldName] = {
              type: 'pattern',
              pattern: pattern
            };
          } else if (choice === '3') {
            const value = await this.question('Введите фиксированное значение: ');
            template.fieldTemplates[fieldName] = {
              type: 'fixed',
              value: value
            };
          }
        }
      }
      
      return template;
      
    } catch (error) {
      console.error('❌ Ошибка создания шаблона:', error.message);
      throw error;
    }
  }

  async saveTemplate(template, filename = null) {
    if (!filename) {
      filename = `${template.name.toLowerCase().replace(/\s+/g, '-')}-template.json`;
    }
    
    const filepath = path.join(__dirname, '../data/templates', filename);
    await fs.ensureDir(path.dirname(filepath));
    await fs.writeFile(filepath, JSON.stringify(template, null, 2));
    
    console.log(`\n💾 Шаблон сохранен в файл: ${filepath}`);
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
    console.log('📋 Создание шаблона для генерации данных');
    console.log('='.repeat(45));
    console.log('Использование: node create-template.js <analysis_file>');
    console.log('');
    console.log('Примеры:');
    console.log('  node create-template.js form-analysis.json');
    console.log('');
    process.exit(1);
  }

  const analysisFile = args[0];

  const creator = new TemplateCreator();
  
  try {
    const template = await creator.createTemplate(analysisFile);
    await creator.saveTemplate(template);
    
    console.log('\n✅ Шаблон создан успешно!');
    console.log('\n💡 Теперь вы можете использовать его для генерации данных:');
    console.log(`   node generate-data.js ${analysisFile} --template data/templates/${template.name.toLowerCase().replace(/\s+/g, '-')}-template.json`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  } finally {
    creator.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = TemplateCreator;
