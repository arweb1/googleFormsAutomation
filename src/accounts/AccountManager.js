const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const ConfigManager = require('../core/ConfigManager');

class AccountManager {
  constructor() {
    this.accounts = [];
    this.forms = [];
    this.configManager = new ConfigManager();
  }

  async loadAccounts() {
    try {
      await this.configManager.loadConfig();
      this.accounts = this.configManager.config.accounts;
      this.forms = this.configManager.config.forms;
      logger.info(`Загружено ${this.accounts.length} аккаунтов и ${this.forms.length} форм`);
    } catch (error) {
      logger.error('Ошибка при загрузке аккаунтов:', error);
      throw error;
    }
  }

  getAccounts() {
    return this.accounts.map(account => ({
      id: account.id,
      name: account.name,
      email: account.email,
      status: account.status || 'active'
    }));
  }

  getAccount(accountId) {
    return this.accounts.find(account => account.id === accountId);
  }

  getFormConfig(formId) {
    return this.forms.find(form => form.id === formId);
  }

  async addAccount(accountData) {
    try {
      const newAccount = {
        id: Date.now().toString(),
        name: accountData.name || 'Новый аккаунт',
        email: accountData.email,
        password: accountData.password,
        userAgent: accountData.userAgent,
        userDataDir: accountData.userDataDir,
        cookies: accountData.cookies || [],
        status: 'active',
        createdAt: new Date().toISOString(),
        ...accountData
      };

      this.accounts.push(newAccount);
      this.configManager.config.accounts = this.accounts;
      await this.configManager.saveConfig();

      logger.info(`Аккаунт ${newAccount.email} добавлен`);
      return newAccount;
    } catch (error) {
      logger.error('Ошибка при добавлении аккаунта:', error);
      throw error;
    }
  }

  async removeAccount(accountId) {
    try {
      const accountIndex = this.accounts.findIndex(account => account.id === accountId);
      if (accountIndex === -1) {
        throw new Error(`Аккаунт с ID ${accountId} не найден`);
      }

      const removedAccount = this.accounts.splice(accountIndex, 1)[0];
      this.configManager.config.accounts = this.accounts;
      await this.configManager.saveConfig();

      logger.info(`Аккаунт ${removedAccount.email} удален`);
      return removedAccount;
    } catch (error) {
      logger.error('Ошибка при удалении аккаунта:', error);
      throw error;
    }
  }

  async updateAccount(accountId, updateData) {
    try {
      const account = this.getAccount(accountId);
      if (!account) {
        throw new Error(`Аккаунт с ID ${accountId} не найден`);
      }

      Object.assign(account, updateData, {
        updatedAt: new Date().toISOString()
      });

      this.configManager.config.accounts = this.accounts;
      await this.configManager.saveConfig();

      logger.info(`Аккаунт ${account.email} обновлен`);
      return account;
    } catch (error) {
      logger.error('Ошибка при обновлении аккаунта:', error);
      throw error;
    }
  }

  getRandomAccount() {
    const activeAccounts = this.accounts.filter(account => account.status === 'active');
    if (activeAccounts.length === 0) {
      throw new Error('Нет активных аккаунтов');
    }
    
    const randomIndex = Math.floor(Math.random() * activeAccounts.length);
    return activeAccounts[randomIndex];
  }

  async validateAccount(accountId) {
    try {
      const account = this.getAccount(accountId);
      if (!account) {
        throw new Error(`Аккаунт с ID ${accountId} не найден`);
      }

      // Здесь можно добавить логику проверки валидности аккаунта
      // Например, проверка cookies, тестовый запрос к Google и т.д.
      
      logger.info(`Аккаунт ${account.email} валиден`);
      return true;
    } catch (error) {
      logger.error(`Ошибка при валидации аккаунта ${accountId}:`, error);
      return false;
    }
  }

  async exportAccounts(filePath) {
    try {
      const exportData = {
        accounts: this.accounts.map(account => ({
          id: account.id,
          name: account.name,
          email: account.email,
          status: account.status,
          createdAt: account.createdAt
        })),
        exportedAt: new Date().toISOString()
      };

      await fs.writeJson(filePath, exportData, { spaces: 2 });
      logger.info(`Аккаунты экспортированы в ${filePath}`);
    } catch (error) {
      logger.error('Ошибка при экспорте аккаунтов:', error);
      throw error;
    }
  }
}

module.exports = AccountManager;
