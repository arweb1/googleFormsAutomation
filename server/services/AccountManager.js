const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class AccountManager {
  constructor() {
    this.accountsFile = path.join(__dirname, '../../data/accounts.json');
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.accountsFile);
    fs.ensureDirSync(dataDir);
  }

  async uploadAccounts(accountsData) {
    try {
      const accounts = [];
      
      for (const accountData of accountsData) {
        const account = {
          id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          email: accountData.email || '',
          password: accountData.password || '',
          data: accountData.data || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        accounts.push(account);
      }
      
      // Загружаем существующие аккаунты
      const existingAccounts = await this.loadAccounts();
      
      // Добавляем новые аккаунты
      const allAccounts = [...existingAccounts, ...accounts];
      
      // Сохраняем все аккаунты
      await this.saveAccounts(allAccounts);
      
      return {
        count: accounts.length,
        total: allAccounts.length,
        accounts: accounts
      };
      
    } catch (error) {
      console.error('Ошибка загрузки аккаунтов:', error);
      throw error;
    }
  }

  async loadAccounts() {
    try {
      if (await fs.pathExists(this.accountsFile)) {
        const data = await fs.readFile(this.accountsFile, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Ошибка загрузки аккаунтов:', error);
      return [];
    }
  }

  async saveAccounts(accounts) {
    try {
      await fs.writeFile(this.accountsFile, JSON.stringify(accounts, null, 2));
    } catch (error) {
      console.error('Ошибка сохранения аккаунтов:', error);
      throw error;
    }
  }

  async getAllAccounts() {
    return await this.loadAccounts();
  }

  async getAccountById(id) {
    const accounts = await this.loadAccounts();
    return accounts.find(account => account.id === id);
  }

  async getAccountsByIds(ids) {
    const accounts = await this.loadAccounts();
    return accounts.filter(account => ids.includes(account.id));
  }

  async updateAccount(id, updateData) {
    const accounts = await this.loadAccounts();
    const accountIndex = accounts.findIndex(account => account.id === id);
    
    if (accountIndex === -1) {
      throw new Error('Аккаунт не найден');
    }
    
    accounts[accountIndex] = {
      ...accounts[accountIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await this.saveAccounts(accounts);
    return accounts[accountIndex];
  }

  async deleteAccount(id) {
    const accounts = await this.loadAccounts();
    const filteredAccounts = accounts.filter(account => account.id !== id);
    
    if (filteredAccounts.length === accounts.length) {
      throw new Error('Аккаунт не найден');
    }
    
    await this.saveAccounts(filteredAccounts);
  }

  async exportAccounts(format = 'csv') {
    const accounts = await this.loadAccounts();
    
    if (format === 'csv') {
      const csvPath = path.join(__dirname, '../../data/accounts_export.csv');
      const csvWriter = createCsvWriter({
        path: csvPath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'email', title: 'Email' },
          { id: 'password', title: 'Password' },
          { id: 'createdAt', title: 'Created At' },
          { id: 'updatedAt', title: 'Updated At' }
        ]
      });
      
      await csvWriter.writeRecords(accounts);
      return csvPath;
    }
    
    return null;
  }

  async importFromCSV(csvPath) {
    try {
      const accounts = [];
      
      return new Promise((resolve, reject) => {
        fs.createReadStream(csvPath)
          .pipe(csv())
          .on('data', (row) => {
            const account = {
              email: row.email || row.Email || '',
              password: row.password || row.Password || '',
              data: {}
            };
            
            // Добавляем дополнительные поля из CSV
            Object.keys(row).forEach(key => {
              if (!['email', 'Email', 'password', 'Password'].includes(key)) {
                account.data[key.toLowerCase()] = row[key];
              }
            });
            
            accounts.push(account);
          })
          .on('end', async () => {
            try {
              const result = await this.uploadAccounts(accounts);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      });
      
    } catch (error) {
      console.error('Ошибка импорта из CSV:', error);
      throw error;
    }
  }

  async validateAccount(account) {
    const errors = [];
    
    if (!account.email) {
      errors.push('Email обязателен');
    } else if (!this.isValidEmail(account.email)) {
      errors.push('Некорректный email');
    }
    
    if (!account.password) {
      errors.push('Пароль обязателен');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async getAccountStats() {
    const accounts = await this.loadAccounts();
    
    return {
      total: accounts.length,
      withData: accounts.filter(acc => Object.keys(acc.data).length > 0).length,
      withoutData: accounts.filter(acc => Object.keys(acc.data).length === 0).length,
      recent: accounts.filter(acc => {
        const createdAt = new Date(acc.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdAt > weekAgo;
      }).length
    };
  }
}

module.exports = AccountManager;
