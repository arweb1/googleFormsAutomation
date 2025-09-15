const fs = require('fs-extra');
const path = require('path');

class Proxy {
  constructor(proxyData) {
    this.id = proxyData.id || `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = proxyData.name || '';
    this.host = proxyData.host || '';
    this.port = proxyData.port || '';
    this.username = proxyData.username || '';
    this.password = proxyData.password || '';
    this.type = proxyData.type || 'http'; // 'http', 'https', 'socks4', 'socks5'
    this.status = proxyData.status || 'active'; // 'active', 'inactive', 'error'
    this.group = proxyData.group || 'default';
    this.lastUsed = proxyData.lastUsed || null;
    this.createdAt = proxyData.createdAt || new Date().toISOString();
    this.updatedAt = proxyData.updatedAt || new Date().toISOString();
    this.description = proxyData.description || '';
  }

  static getProxiesFile() {
    return path.join(__dirname, '../../data/proxies.json');
  }

  static async ensureDataDirectory() {
    const dataDir = path.dirname(this.getProxiesFile());
    await fs.ensureDir(dataDir);
  }

  // Парсинг прокси из строки формата "ip:port:username:password"
  static parseProxyString(proxyString) {
    const parts = proxyString.split(':');
    if (parts.length < 2) {
      throw new Error('Неверный формат прокси. Ожидается: ip:port:username:password');
    }

    return {
      host: parts[0],
      port: parseInt(parts[1]),
      username: parts[2] || '',
      password: parts[3] || ''
    };
  }

  // Создание прокси из строки
  static fromString(proxyString, options = {}) {
    const parsed = this.parseProxyString(proxyString);
    return new Proxy({
      name: options.name || `${parsed.host}:${parsed.port}`,
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      password: parsed.password,
      type: options.type || 'http',
      group: options.group || 'default',
      description: options.description || ''
    });
  }

  async save() {
    try {
      await Proxy.ensureDataDirectory();
      
      const proxies = await Proxy.getAll();
      const existingIndex = proxies.findIndex(proxy => proxy.id === this.id);
      
      if (existingIndex >= 0) {
        proxies[existingIndex] = this;
      } else {
        proxies.push(this);
      }
      
      await fs.writeFile(Proxy.getProxiesFile(), JSON.stringify(proxies, null, 2));
      return this;
      
    } catch (error) {
      console.error('Ошибка сохранения прокси:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      await Proxy.ensureDataDirectory();
      
      if (await fs.pathExists(Proxy.getProxiesFile())) {
        const data = await fs.readFile(Proxy.getProxiesFile(), 'utf8');
        return JSON.parse(data);
      }
      return [];
      
    } catch (error) {
      console.error('Ошибка загрузки прокси:', error);
      return [];
    }
  }

  static async getById(id) {
    const proxies = await Proxy.getAll();
    const proxyData = proxies.find(proxy => proxy.id === id);
    return proxyData ? new Proxy(proxyData) : null;
  }

  static async getByGroup(group) {
    const proxies = await Proxy.getAll();
    return proxies
      .filter(proxy => proxy.group === group)
      .map(proxyData => new Proxy(proxyData));
  }

  static async getGroups() {
    const proxies = await Proxy.getAll();
    const groups = [...new Set(proxies.map(proxy => proxy.group))];
    return groups;
  }

  static async deleteById(id) {
    try {
      const proxies = await Proxy.getAll();
      const filteredProxies = proxies.filter(proxy => proxy.id !== id);
      
      if (filteredProxies.length === proxies.length) {
        throw new Error('Прокси не найден');
      }
      
      await fs.writeFile(Proxy.getProxiesFile(), JSON.stringify(filteredProxies, null, 2));
      return true;
      
    } catch (error) {
      console.error('Ошибка удаления прокси:', error);
      throw error;
    }
  }

  static async deleteByGroup(group) {
    try {
      const proxies = await Proxy.getAll();
      const filteredProxies = proxies.filter(proxy => proxy.group !== group);
      
      await fs.writeFile(Proxy.getProxiesFile(), JSON.stringify(filteredProxies, null, 2));
      return true;
      
    } catch (error) {
      console.error('Ошибка удаления группы прокси:', error);
      throw error;
    }
  }

  static async bulkCreate(proxyStrings, options = {}) {
    const proxies = [];
    
    for (const proxyString of proxyStrings) {
      try {
        const proxy = Proxy.fromString(proxyString, options);
        await proxy.save();
        proxies.push(proxy);
      } catch (error) {
        console.error(`Ошибка создания прокси из строки "${proxyString}":`, error);
      }
    }
    
    return proxies;
  }

  // Получение URL прокси для использования в Puppeteer
  getProxyUrl() {
    let url = `${this.type}://`;
    
    if (this.username && this.password) {
      url += `${this.username}:${this.password}@`;
    }
    
    url += `${this.host}:${this.port}`;
    return url;
  }

  // Проверка валидности прокси
  validate() {
    const errors = [];
    
    if (!this.host || this.host.trim() === '') {
      errors.push('Хост прокси обязателен');
    }
    
    if (!this.port || isNaN(this.port) || this.port < 1 || this.port > 65535) {
      errors.push('Порт прокси должен быть числом от 1 до 65535');
    }
    
    if (!this.type || !['http', 'https', 'socks4', 'socks5'].includes(this.type)) {
      errors.push('Тип прокси должен быть: http, https, socks4 или socks5');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      type: this.type,
      status: this.status,
      group: this.group,
      lastUsed: this.lastUsed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      description: this.description
    };
  }

  // Обновление времени последнего использования
  async markAsUsed() {
    this.lastUsed = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    await this.save();
  }
}

module.exports = Proxy;
