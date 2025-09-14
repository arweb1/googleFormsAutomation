const fs = require('fs-extra');
const path = require('path');
const yaml = require('yaml');
const logger = require('../utils/logger');

class ConfigManager {
  constructor() {
    this.config = {
      forms: [],
      accounts: [],
      settings: {
        headless: true,
        timeout: 30000,
        retryAttempts: 3,
        delayBetweenRequests: 1000,
        userAgentRotation: true,
        proxyRotation: false
      }
    };
  }

  async loadConfig() {
    try {
      // Загрузка конфигурации форм
      const formsPath = path.join(process.cwd(), 'config', 'forms.json');
      if (await fs.pathExists(formsPath)) {
        const formsData = await fs.readJson(formsPath);
        this.config.forms = formsData.forms || [];
        logger.info(`Загружено ${this.config.forms.length} форм`);
      }

      // Загрузка конфигурации аккаунтов
      const accountsPath = path.join(process.cwd(), 'config', 'accounts.json');
      if (await fs.pathExists(accountsPath)) {
        const accountsData = await fs.readJson(accountsPath);
        this.config.accounts = accountsData.accounts || [];
        logger.info(`Загружено ${this.config.accounts.length} аккаунтов`);
      }

      // Загрузка настроек
      const settingsPath = path.join(process.cwd(), 'config', 'settings.json');
      if (await fs.pathExists(settingsPath)) {
        const settingsData = await fs.readJson(settingsPath);
        this.config.settings = { ...this.config.settings, ...settingsData };
      }

      return this.config;
    } catch (error) {
      logger.error('Ошибка при загрузке конфигурации:', error);
      throw error;
    }
  }

  async saveConfig() {
    try {
      await fs.ensureDir(path.join(process.cwd(), 'config'));

      // Сохранение конфигурации форм
      await fs.writeJson(
        path.join(process.cwd(), 'config', 'forms.json'),
        { forms: this.config.forms },
        { spaces: 2 }
      );

      // Сохранение конфигурации аккаунтов
      await fs.writeJson(
        path.join(process.cwd(), 'config', 'accounts.json'),
        { accounts: this.config.accounts },
        { spaces: 2 }
      );

      // Сохранение настроек
      await fs.writeJson(
        path.join(process.cwd(), 'config', 'settings.json'),
        this.config.settings,
        { spaces: 2 }
      );

      logger.info('Конфигурация сохранена');
    } catch (error) {
      logger.error('Ошибка при сохранении конфигурации:', error);
      throw error;
    }
  }

  getForm(formId) {
    return this.config.forms.find(form => form.id === formId);
  }

  getAccount(accountId) {
    return this.config.accounts.find(account => account.id === accountId);
  }

  getSettings() {
    return this.config.settings;
  }

  addForm(formConfig) {
    this.config.forms.push({
      id: Date.now().toString(),
      ...formConfig
    });
  }

  addAccount(accountConfig) {
    this.config.accounts.push({
      id: Date.now().toString(),
      ...accountConfig
    });
  }

  removeForm(formId) {
    this.config.forms = this.config.forms.filter(form => form.id !== formId);
  }

  removeAccount(accountId) {
    this.config.accounts = this.config.accounts.filter(account => account.id !== accountId);
  }
}

module.exports = ConfigManager;
