#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const FormAutomator = require('./core/FormAutomator');
const AccountManager = require('./accounts/AccountManager');
const ConfigManager = require('./core/ConfigManager');
const logger = require('./utils/logger');

const program = new Command();

program
  .name('google-forms-automator')
  .description('Универсальный софт для автоматического заполнения Google Forms')
  .version('1.0.0');

program
  .command('start')
  .description('Запустить автоматическое заполнение форм')
  .option('-f, --form <formId>', 'ID формы для заполнения')
  .option('-a, --account <accountId>', 'ID аккаунта для использования')
  .option('-c, --count <number>', 'Количество заполнений', '1')
  .option('--headless', 'Запуск в headless режиме')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Запуск Google Forms Automator...'));
      
      const configManager = new ConfigManager();
      const accountManager = new AccountManager();
      const automator = new FormAutomator();

      // Загрузка конфигурации
      await configManager.loadConfig();
      
      // Инициализация аккаунтов
      await accountManager.loadAccounts();
      
      // Запуск автоматизации
      await automator.start({
        formId: options.form,
        accountId: options.account,
        count: parseInt(options.count),
        headless: options.headless
      });

    } catch (error) {
      logger.error('Ошибка при запуске:', error);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Настройка конфигурации')
  .action(async () => {
    try {
      console.log(chalk.yellow('⚙️ Настройка конфигурации...'));
      
      const questions = [
        {
          type: 'input',
          name: 'formsConfig',
          message: 'Путь к файлу конфигурации форм:',
          default: 'config/forms.json'
        },
        {
          type: 'input',
          name: 'accountsConfig',
          message: 'Путь к файлу конфигурации аккаунтов:',
          default: 'config/accounts.json'
        }
      ];

      const answers = await inquirer.prompt(questions);
      console.log(chalk.green('✅ Конфигурация сохранена!'));
      
    } catch (error) {
      logger.error('Ошибка при настройке:', error);
    }
  });

program
  .command('accounts')
  .description('Управление аккаунтами')
  .option('--list', 'Показать список аккаунтов')
  .option('--add', 'Добавить новый аккаунт')
  .option('--remove <accountId>', 'Удалить аккаунт')
  .action(async (options) => {
    try {
      const accountManager = new AccountManager();
      await accountManager.loadAccounts();

      if (options.list) {
        const accounts = accountManager.getAccounts();
        console.table(accounts);
      } else if (options.add) {
        await accountManager.addAccount();
      } else if (options.remove) {
        await accountManager.removeAccount(options.remove);
      }

    } catch (error) {
      logger.error('Ошибка при работе с аккаунтами:', error);
    }
  });

// Обработка необработанных исключений
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

program.parse();
