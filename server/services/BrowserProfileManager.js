const puppeteer = require('puppeteer');
const proxyChain = require('proxy-chain');
const fs = require('fs-extra');
const path = require('path');

class BrowserProfileManager {
  constructor() {
    this.profilesDir = path.join(__dirname, '../../data/browser-profiles');
    this.activeBrowsers = new Map(); // Хранит активные браузеры по ID аккаунта
    this.anonymizedProxyByAccountId = new Map(); // Хранит анонимизированный прокси URL для каждого аккаунта
  }

  async ensureProfilesDirectory() {
    await fs.ensureDir(this.profilesDir);
  }

  getProfilePath(accountId) {
    return path.join(this.profilesDir, `profile_${accountId}`);
  }

  async createProfile(accountId, proxySettings = null) {
    await this.ensureProfilesDirectory();
    
    const profilePath = this.getProfilePath(accountId);
    
    // Создаем директорию профиля если её нет
    await fs.ensureDir(profilePath);
    
    console.log(`📁 Создан профиль браузера для аккаунта ${accountId}: ${profilePath}`);
    
    return profilePath;
  }

  async launchBrowserWithProfile(accountId, options = {}, proxySettings = null) {
    const profilePath = await this.createProfile(accountId, proxySettings);
    
        const launchOptions = {
          headless: options.headless !== undefined ? options.headless : false,
          userDataDir: profilePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-blink-features=AutomationControlled',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-default-browser-check',
            '--no-pings',
            '--proxy-bypass-list=<-loopback>',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
          ],
          timeout: 30000,
          ignoreHTTPSErrors: true,
          ignoreDefaultArgs: ['--enable-automation']
        };

    // Настраиваем прокси если он включен
    if (proxySettings && proxySettings.enabled && proxySettings.host && proxySettings.port) {
      try {
        const scheme = proxySettings.type && proxySettings.type.includes('socks') ? proxySettings.type : 'http';
        const hasAuth = !!(proxySettings.username && proxySettings.password);

        if (hasAuth) {
          // Создаём локальный анонимизированный прокси без аутентификации через proxy-chain
          const sourceProxyUrl = `${scheme}://${proxySettings.username}:${proxySettings.password}@${proxySettings.host}:${proxySettings.port}`;
          const anonymizedProxyUrl = await proxyChain.anonymizeProxy(sourceProxyUrl);
          // Пример: http://127.0.0.1:xxxxx
          launchOptions.args.push(`--proxy-server=${anonymizedProxyUrl}`);
          this.anonymizedProxyByAccountId.set(accountId, anonymizedProxyUrl);
          console.log(`🌐 Используем анонимизированный прокси для аккаунта ${accountId}: ${anonymizedProxyUrl}`);
        } else {
          // Без аутентификации можно передать напрямую
          const directProxyArg = scheme ? `${scheme}://${proxySettings.host}:${proxySettings.port}` : `${proxySettings.host}:${proxySettings.port}`;
          launchOptions.args.push(`--proxy-server=${directProxyArg}`);
          console.log(`🌐 Используем прокси для аккаунта ${accountId}: ${directProxyArg}`);
        }
      } catch (proxyError) {
        console.error(`❌ Ошибка настройки прокси для аккаунта ${accountId}:`, proxyError);
        throw proxyError; // Не запускаем без прокси, если прокси нужен
      }
    }

    // Запускаем браузер
    try {
      const browser = await puppeteer.launch(launchOptions);
      this.activeBrowsers.set(accountId, browser);
      console.log(`✅ Браузер запущен с профилем для аккаунта ${accountId}`);
      return browser;
    } catch (error) {
      console.error(`❌ Ошибка запуска браузера для аккаунта ${accountId}:`, error.message);
      throw error; // Не пробуем без прокси, если прокси нужен
    }

  }

  buildProxyUrl(proxySettings) {
    const { type, host, port, username, password } = proxySettings;
    
    let proxyUrl = `${type}://`;
    
    if (username && password) {
      proxyUrl += `${username}:${password}@`;
    }
    
    proxyUrl += `${host}:${port}`;
    
    return proxyUrl;
  }

  async testProxyConnection(proxySettings) {
    try {
      const proxyUrl = this.buildProxyUrl(proxySettings);
      console.log(`🔍 Тестируем подключение к прокси: ${proxyUrl}`);
      
      // Простой тест подключения к прокси
      const testOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--proxy-server=' + proxyUrl,
          '--proxy-bypass-list=<-loopback>'
        ],
        timeout: 10000
      };
      
      const browser = await puppeteer.launch(testOptions);
      const page = await browser.newPage();
      
      // Пробуем загрузить простую страницу
      await page.goto('https://httpbin.org/ip', { timeout: 10000 });
      await browser.close();
      
      console.log(`✅ Прокси работает: ${proxyUrl}`);
      return true;
    } catch (error) {
      console.log(`❌ Прокси не работает: ${error.message}`);
      return false;
    }
  }

  async getBrowserForAccount(accountId) {
    return this.activeBrowsers.get(accountId);
  }

  async closeBrowserForAccount(accountId) {
    const browser = this.activeBrowsers.get(accountId);
    if (browser) {
      try {
        await browser.close();
        this.activeBrowsers.delete(accountId);
        console.log(`🔒 Браузер закрыт для аккаунта ${accountId}`);
        // Закрываем локальный анонимизированный прокси, если он был создан
        const anonUrl = this.anonymizedProxyByAccountId.get(accountId);
        if (anonUrl) {
          try {
            await proxyChain.closeAnonymizedProxy(anonUrl);
            this.anonymizedProxyByAccountId.delete(accountId);
            console.log(`🛑 Анонимизированный прокси остановлен для аккаунта ${accountId}`);
          } catch (closeErr) {
            console.error(`❌ Ошибка остановки анонимизированного прокси для аккаунта ${accountId}:`, closeErr);
          }
        }
      } catch (error) {
        console.error(`❌ Ошибка закрытия браузера для аккаунта ${accountId}:`, error);
      }
    }
  }

  async closeAllBrowsers() {
    console.log(`🔒 Закрываем все активные браузеры...`);
    
    const closePromises = Array.from(this.activeBrowsers.entries()).map(async ([accountId, browser]) => {
      try {
        await browser.close();
        console.log(`✅ Браузер закрыт для аккаунта ${accountId}`);
      } catch (error) {
        console.error(`❌ Ошибка закрытия браузера для аккаунта ${accountId}:`, error);
      }
    });
    
    await Promise.all(closePromises);
    this.activeBrowsers.clear();
    // Останавливаем все анонимизированные прокси
    const stopProxyPromises = Array.from(this.anonymizedProxyByAccountId.entries()).map(async ([accountId, anonUrl]) => {
      try {
        await proxyChain.closeAnonymizedProxy(anonUrl);
        console.log(`🛑 Анонимизированный прокси остановлен для аккаунта ${accountId}`);
      } catch (error) {
        console.error(`❌ Ошибка остановки анонимизированного прокси для аккаунта ${accountId}:`, error);
      }
    });
    await Promise.all(stopProxyPromises);
    this.anonymizedProxyByAccountId.clear();
    
    console.log(`✅ Все браузеры закрыты`);
  }

  async cleanupProfile(accountId) {
    const profilePath = this.getProfilePath(accountId);
    
    try {
      if (await fs.pathExists(profilePath)) {
        await fs.remove(profilePath);
        console.log(`🗑️ Профиль удален для аккаунта ${accountId}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка удаления профиля для аккаунта ${accountId}:`, error);
    }
  }

  async cleanupAllProfiles() {
    try {
      if (await fs.pathExists(this.profilesDir)) {
        await fs.remove(this.profilesDir);
        console.log(`🗑️ Все профили браузера удалены`);
      }
    } catch (error) {
      console.error(`❌ Ошибка удаления профилей:`, error);
    }
  }

  getActiveBrowsersCount() {
    return this.activeBrowsers.size;
  }

  getActiveAccountIds() {
    return Array.from(this.activeBrowsers.keys());
  }
}

module.exports = BrowserProfileManager;
