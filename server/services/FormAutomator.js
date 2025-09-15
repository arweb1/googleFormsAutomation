const puppeteer = require('puppeteer');
const FormConfig = require('../models/FormConfig');
const AccountManager = require('./AccountManager');
const AutomationJob = require('../models/AutomationJob');
const BrowserProfileManager = require('./BrowserProfileManager');
const Proxy = require('../models/Proxy');
const fs = require('fs-extra');
const path = require('path');

class FormAutomator {
  constructor() {
    this.jobs = new Map();
    this.browser = null;
    this.jobModel = new AutomationJob();
    this.profileManager = new BrowserProfileManager();
    this.usedProxies = new Map(); // Отслеживание использованных прокси для каждой задачи
  }

  async initBrowser(options = {}) {
    if (!this.browser) {
      try {
        const headless = options.headless !== undefined ? options.headless : false;
        console.log(`🌐 Запуск браузера Puppeteer... (headless: ${headless})`);
        this.browser = await puppeteer.launch({
          headless: headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ],
          timeout: 30000
        });
        console.log(`✅ Браузер успешно запущен (headless: ${headless})`);
      } catch (error) {
        console.error(`❌ Ошибка запуска браузера:`, error);
        throw error;
      }
    }
    return this.browser;
  }

  async startAutomation(formConfigId, accountIds, options = {}) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🎯 Создание новой задачи автоматизации: ${jobId}`);
    console.log(`📝 ID конфигурации формы: ${formConfigId}`);
    console.log(`👥 Количество аккаунтов: ${options.accountData?.length || 0}`);
    console.log(`🔐 Режим входа: ${options.loginMode || 'anonymous'}`);
    
    try {
      // Получаем конфигурацию формы
      console.log(`🔍 Поиск конфигурации формы...`);
      const formConfig = await FormConfig.getById(formConfigId);
      if (!formConfig) {
        throw new Error('Конфигурация формы не найдена');
      }
      console.log(`✅ Конфигурация формы найдена: ${formConfig.title}`);

      let accounts = [];
      
      // Используем предоставленные данные аккаунтов
      accounts = options.accountData.map(accountData => ({
        id: accountData.id,
        name: accountData.name,
        email: `${accountData.name}@example.com`,
        fields: accountData.fields,
        loginMode: options.loginMode || 'anonymous'
      }));
      
      // Если режим с логином Google, добавляем информацию об аккаунтах
      if (options.loginMode === 'google' && accountIds && accountIds.length > 0) {
        const accountManager = new AccountManager();
        const googleAccounts = await accountManager.getAccountsByIds(accountIds);
        
        // Сопоставляем Google аккаунты с данными
        accounts.forEach((account, index) => {
          if (googleAccounts[index]) {
            account.googleAccount = googleAccounts[index];
            account.email = googleAccounts[index].email;
          }
        });
      }

      // Создаем понятное название задачи
      const taskName = `${formConfig.title || 'Без названия'} - ${accounts.length} аккаунтов (${options.loginMode === 'google' ? 'с логином' : 'анонимно'})`;
      
      // Создаем задачу в базе данных
      console.log(`💾 Создание задачи в базе данных...`);
      const job = await this.jobModel.create({
        id: jobId,
        name: taskName,
        formConfigId,
        formTitle: formConfig.title,
        status: 'running',
        startTime: new Date().toISOString(),
        totalAccounts: accounts.length,
        completedAccounts: 0,
        failedAccounts: 0,
        loginMode: options.loginMode || 'anonymous'
      });
      console.log(`✅ Задача создана в базе данных`);

      // Инициализируем отслеживание прокси для этой задачи
      this.usedProxies.set(jobId, new Set());
      console.log(`📊 Инициализировано отслеживание прокси для задачи ${jobId}`);

      // Добавляем начальный лог
      console.log(`📝 Добавление начального лога...`);
      await this.jobModel.addLog(jobId, {
        type: 'info',
        message: `Запуск автоматизации для ${accounts.length} аккаунтов (${options.loginMode === 'google' ? 'с логином Google' : 'анонимно'})`
      });

      // Запускаем автоматизацию в фоне
      console.log(`🚀 Запуск автоматизации в фоновом режиме...`);
      this.runAutomation(jobId, formConfig, accounts, options).catch(error => {
        console.error(`❌ Ошибка в задаче ${jobId}:`, error);
        this.updateJobStatus(jobId, 'failed', error.message);
      });

      return jobId;

    } catch (error) {
      console.error('Ошибка запуска автоматизации:', error);
      throw error;
    }
  }

  async runAutomation(jobId, formConfig, accounts, options) {
    console.log(`🚀 Запуск автоматизации для задачи ${jobId}`);
    console.log(`📊 Количество аккаунтов: ${accounts.length}`);
    console.log(`📝 Конфигурация формы: ${formConfig.title}`);
    console.log(`⚙️ Опции:`, JSON.stringify(options, null, 2));
    
    const job = await this.jobModel.getById(jobId);
    if (!job) {
      console.error(`❌ Задача ${jobId} не найдена в базе данных`);
      return;
    }

    console.log(`✅ Задача найдена: ${job.status}`);

    try {
      // Добавляем лог о начале обработки
      await this.jobModel.addLog(jobId, {
        type: 'info',
        message: 'Начинаем обработку аккаунтов'
      });
      
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        
        console.log(`\n🔄 === ИТЕРАЦИЯ ${i + 1}/${accounts.length} ===`);
        console.log(`👤 Аккаунт: ${account.email}`);
        console.log(`🆔 ID аккаунта: ${account.id}`);
        
        try {
          console.log(`\n🚀 Начинаем обработку аккаунта ${i + 1}/${accounts.length}: ${account.email}`);
          console.log(`📊 Всего аккаунтов для обработки: ${accounts.length}`);
          
          // Добавляем лог о начале обработки аккаунта
          await this.jobModel.addLog(jobId, {
            type: 'info',
            message: `Обработка аккаунта ${i + 1}/${accounts.length}: ${account.email}`,
            accountId: account.id
          });
          
          const result = await this.fillFormForAccountWithProfile(formConfig, account, options, i, jobId);
          
          // Добавляем результат успешной обработки
          await this.jobModel.addResult(jobId, {
            accountId: account.id,
            accountName: account.name,
            accountEmail: account.email,
            success: true,
            submittedAt: result.submittedAt,
            filledData: account.fields // Данные, которыми заполнялась форма
          });
          
          // Обновляем счетчик завершенных аккаунтов
          const updatedJob = await this.jobModel.getById(jobId);
          await this.jobModel.update(jobId, {
            completedAccounts: updatedJob.completedAccounts + 1
          });
          
          // Добавляем лог об успехе
          await this.jobModel.addLog(jobId, {
            type: 'success',
            message: `Аккаунт ${account.email} успешно обработан`,
            accountId: account.id
          });
          
          console.log(`✅ Аккаунт ${account.email} успешно обработан (${i + 1}/${accounts.length})`);
          
          // Добавляем лог о задержке между сабмитами
          if (options.delaySettings && options.delaySettings.enabled) {
            const submitDelay = this.calculateSubmitDelay(options.delaySettings, i);
            if (submitDelay > 0) {
              await this.jobModel.addLog(jobId, {
                type: 'info',
                message: `Задержка между сабмитами: ${submitDelay}мс (${options.delaySettings.type})`,
                accountId: account.id
              });
            }
          }

          // Задержка между аккаунтами (кроме последнего)
          if (i < accounts.length - 1) {
            const accountDelay = options.delay || 1000;
            console.log(`⏳ Задержка между аккаунтами: ${accountDelay}мс`);
            await this.jobModel.addLog(jobId, {
              type: 'info',
              message: `Задержка между аккаунтами: ${accountDelay}мс`
            });
            await this.sleep(accountDelay);
            console.log(`✅ Задержка между аккаунтами завершена`);
          }
          
        } catch (error) {
          console.error(`❌ Ошибка для аккаунта ${account.email}:`, error);
          console.log(`📊 Продолжаем обработку остальных аккаунтов... (${i + 1}/${accounts.length})`);
          
          // Добавляем результат ошибки
          await this.jobModel.addResult(jobId, {
            accountId: account.id,
            accountName: account.name,
            accountEmail: account.email,
            success: false,
            error: error.message,
            filledData: account.fields // Данные, которыми пытались заполнить форму
          });
          
          // Обновляем счетчик неудачных аккаунтов
          const updatedJob = await this.jobModel.getById(jobId);
          await this.jobModel.update(jobId, {
            failedAccounts: updatedJob.failedAccounts + 1
          });
          
          // Добавляем лог об ошибке
          await this.jobModel.addLog(jobId, {
            type: 'error',
            message: `Ошибка обработки аккаунта ${account.email}: ${error.message}`,
            accountId: account.id
          });

          // Задержка между аккаунтами даже при ошибке (кроме последнего)
          if (i < accounts.length - 1) {
            const accountDelay = options.delay || 1000;
            console.log(`⏳ Задержка между аккаунтами после ошибки: ${accountDelay}мс`);
            await this.jobModel.addLog(jobId, {
              type: 'info',
              message: `Задержка между аккаунтами после ошибки: ${accountDelay}мс`
            });
            await this.sleep(accountDelay);
            console.log(`✅ Задержка между аккаунтами завершена`);
          }
        }
        
        // Добавляем лог о завершении обработки аккаунта
        console.log(`🏁 Завершена обработка аккаунта ${i + 1}/${accounts.length}: ${account.email}`);
      }
      
      // Завершаем задачу
      await this.updateJobStatus(jobId, 'completed');
      await this.jobModel.addLog(jobId, {
        type: 'success',
        message: `Автоматизация завершена. Обработано: ${job.completedAccounts}, Ошибок: ${job.failedAccounts}`
      });

      // Очищаем отслеживание прокси для этой задачи
      this.usedProxies.delete(jobId);
      console.log(`🧹 Очищено отслеживание прокси для задачи ${jobId}`);
      
      // Небольшая задержка перед отправкой уведомления
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Отправляем уведомление о завершении только если есть успешные аккаунты
      if (job.completedAccounts > 0) {
        const notificationType = job.failedAccounts === 0 ? 'success' : 'warning';
        const notificationMessage = job.failedAccounts === 0 
          ? `🎉 Задача "${formConfig.title}" завершена успешно! Обработано: ${job.completedAccounts}`
          : `⚠️ Задача "${formConfig.title}" завершена с ошибками! Успешно: ${job.completedAccounts}, Ошибок: ${job.failedAccounts}`;
        
        await this.sendNotification({
          type: notificationType,
          message: notificationMessage,
          sound: true
        });
      }
      
      // Закрываем все браузеры после завершения всех задач
      console.log('🔒 Закрываем все браузеры...');
      await this.profileManager.closeAllBrowsers();
      console.log('✅ Все браузеры закрыты');
      
    } catch (error) {
      console.error(`Критическая ошибка в задаче ${jobId}:`, error);
      
      // Закрываем все браузеры в случае ошибки
      try {
        console.log('🔒 Закрываем все браузеры из-за ошибки...');
        await this.profileManager.closeAllBrowsers();
        console.log('✅ Все браузеры закрыты');
      } catch (closeError) {
        console.error('Ошибка при закрытии браузеров:', closeError);
      }
      
      await this.updateJobStatus(jobId, 'failed', error.message);
      
      // Очищаем отслеживание прокси для этой задачи
      this.usedProxies.delete(jobId);
      console.log(`🧹 Очищено отслеживание прокси для задачи ${jobId} (ошибка)`);
      
      // Отправляем уведомление об ошибке
      await this.sendNotification({
        type: 'error',
        message: `❌ Задача "${formConfig?.title || 'Неизвестная'}" завершилась с ошибкой: ${error.message}`,
        sound: true
      });
    }
  }

  async fillFormForAccountWithProfile(formConfig, account, options, accountIndex = 0, jobId = null) {
    let browser = null;
    
    console.log(`\n🔧 === fillFormForAccountWithProfile START ===`);
    console.log(`👤 Аккаунт: ${account.email} (${account.id})`);
    console.log(`📊 Индекс аккаунта: ${accountIndex}`);
    console.log(`🔐 Режим входа: ${options.loginMode}`);
    
    try {
      // Настраиваем прокси для Google аккаунтов
      let proxySettings = null;
      if (options.loginMode === 'google' && options.selectedProxyGroup) {
        try {
          // Получаем прокси из выбранной группы
          const proxies = await Proxy.getByGroup(options.selectedProxyGroup);
          console.log(`📊 Найдено прокси в группе "${options.selectedProxyGroup}": ${proxies.length}`);
          
          if (proxies.length > 0) {
            // Получаем список использованных прокси для этой задачи
            const usedProxiesForJob = this.usedProxies.get(jobId) || new Set();
            console.log(`📊 Уже использовано прокси в этой задаче: ${usedProxiesForJob.size}`);
            
            // Находим первый неиспользованный прокси
            let selectedProxy = null;
            let selectedProxyIndex = -1;
            
            for (let i = 0; i < proxies.length; i++) {
              const proxyId = proxies[i].id;
              if (!usedProxiesForJob.has(proxyId)) {
                selectedProxy = proxies[i];
                selectedProxyIndex = i;
                break;
              }
            }
            
            if (selectedProxy) {
              console.log(`🔗 Выбираем неиспользованный прокси ${selectedProxyIndex + 1}/${proxies.length} для аккаунта ${account.id}: ${selectedProxy.host}:${selectedProxy.port}`);
              
              // Отмечаем прокси как использованный в рамках этой задачи
              usedProxiesForJob.add(selectedProxy.id);
              this.usedProxies.set(jobId, usedProxiesForJob);
              
              proxySettings = {
                enabled: true,
                type: selectedProxy.type,
                host: selectedProxy.host,
                port: selectedProxy.port,
                username: selectedProxy.username,
                password: selectedProxy.password
              };
              
              console.log(`✅ Прокси настроен для аккаунта ${account.id}: ${selectedProxy.host}:${selectedProxy.port}`);
              console.log(`📊 Теперь использовано прокси в этой задаче: ${usedProxiesForJob.size}/${proxies.length}`);
            } else {
              console.log(`⚠️ Все прокси в группе "${options.selectedProxyGroup}" уже использованы в этой задаче`);
              throw new Error(`Все прокси в группе "${options.selectedProxyGroup}" уже использованы в этой задаче`);
            }
          } else {
            console.log(`⚠️ В группе прокси "${options.selectedProxyGroup}" нет доступных прокси`);
            throw new Error(`В группе прокси "${options.selectedProxyGroup}" нет доступных прокси`);
          }
        } catch (proxyError) {
          console.error(`❌ Ошибка при работе с прокси:`, proxyError);
          throw proxyError; // Не запускаем без прокси, если прокси нужен
        }
      }
      
      // Запускаем браузер с профилем для этого аккаунта
      console.log(`🌐 Запуск браузера с профилем для аккаунта: ${account.id}`);
      browser = await this.profileManager.launchBrowserWithProfile(account.id, options, proxySettings);
      
      // Если требуется вход в Google, авторизуемся прежде чем идти на форму
      if ((options.loginMode === 'google')) {
        const loginEmail = (account.googleAccount && account.googleAccount.email) || account.email;
        const loginPassword = (account.googleAccount && account.googleAccount.password) || account.password;

        if (!loginEmail || !loginPassword) {
          throw new Error('У аккаунта отсутствуют email или пароль для входа в Google');
        }

        console.log(`🔐 Авторизация в Google для аккаунта: ${loginEmail}`);
        await this.ensureLoggedInGoogle(browser, loginEmail, loginPassword);
        console.log('✅ Авторизация в Google успешно выполнена');
      }

      // Заполняем форму
      const result = await this.fillFormForAccount(browser, formConfig, account, options, accountIndex);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Ошибка в fillFormForAccountWithProfile для аккаунта ${account.id}:`, error);
      throw error; // Не пробуем без прокси, если прокси нужен
    } finally {
      // Закрываем браузер для этого аккаунта
      console.log(`🔒 Закрываем браузер для аккаунта ${account.id}...`);
      if (browser) {
        try {
          await this.profileManager.closeBrowserForAccount(account.id);
          console.log(`✅ Браузер успешно закрыт для аккаунта ${account.id}`);
        } catch (closeError) {
          console.error(`❌ Ошибка при закрытии браузера для аккаунта ${account.id}:`, closeError);
        }
      } else {
        console.log(`ℹ️ Браузер не был запущен для аккаунта ${account.id}`);
      }
      console.log(`🔧 === fillFormForAccountWithProfile END ===\n`);
    }
  }

  async ensureLoggedInGoogle(browser, email, password) {
    const page = await browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.110 Safari/537.36');

      console.log(`🔐 Начинаем процесс входа в Google для: ${email}`);

      // Очищаем cookies через Chrome DevTools Protocol
      console.log(`🧹 Очищаем cookies и кэш...`);
      const client = await page.target().createCDPSession();
      await client.send('Network.clearBrowserCookies');
      await client.send('Network.clearBrowserCache');

      // Переходим на страницу входа Google
      console.log(`🌐 Переходим на страницу входа Google...`);
      await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 60000 });

      // Теперь очищаем localStorage и sessionStorage после загрузки страницы
      console.log(`🧹 Очищаем localStorage и sessionStorage...`);
      try {
        await page.evaluate(() => {
          try {
            // Очищаем localStorage
            if (typeof localStorage !== 'undefined') {
              localStorage.clear();
            }
            // Очищаем sessionStorage
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.clear();
            }
            // Очищаем IndexedDB
            if (window.indexedDB) {
              indexedDB.databases().then(databases => {
                databases.forEach(db => {
                  indexedDB.deleteDatabase(db.name);
                });
              }).catch(() => {
                // Игнорируем ошибки IndexedDB
              });
            }
          } catch (error) {
            console.log('Ошибка при очистке storage:', error.message);
          }
        });
      } catch (storageError) {
        console.log(`⚠️ Ошибка при очистке storage: ${storageError.message}`);
        // Продолжаем выполнение, так как это не критично
      }

      // Проверяем, не залогинен ли уже другой аккаунт
      const currentUrl = page.url();
      console.log(`📍 Текущий URL: ${currentUrl}`);

      // Если мы уже на странице аккаунта, нужно выйти
      if (currentUrl.includes('myaccount.google.com') || currentUrl.includes('accounts.google.com/b/0/ManageAccount')) {
        console.log(`🚪 Обнаружен вход в другой аккаунт, выходим...`);
        try {
          // Ищем кнопку выхода
          const signOutButton = await page.$('a[href*="Logout"], button[aria-label*="Sign out"], a[aria-label*="Sign out"]');
          if (signOutButton) {
            await signOutButton.click();
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
            console.log(`✅ Успешно вышли из предыдущего аккаунта`);
          } else {
            // Если кнопка выхода не найдена, переходим на страницу входа
            await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 60000 });
          }
        } catch (logoutError) {
          console.log(`⚠️ Ошибка при выходе, переходим на страницу входа: ${logoutError.message}`);
          await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 60000 });
        }
      }

      // Ждем загрузки страницы входа
      await page.waitForSelector('input[type="email"], input#identifierId', { timeout: 30000 });

      // Вводим email
      console.log(`📝 Вводим email: ${email}`);
      const emailSelectorCandidates = ['input#identifierId', 'input[type="email"]'];
      let emailSelector = null;
      for (const sel of emailSelectorCandidates) {
        const el = await page.$(sel);
        if (el) { 
          emailSelector = sel; 
          break; 
        }
      }
      
      if (!emailSelector) {
        throw new Error('Поле email на странице Google не найдено');
      }

      // Очищаем поле и вводим email
      await page.click(emailSelector, { clickCount: 3 });
      await page.type(emailSelector, String(email), { delay: 100 });
      
      // Нажимаем Next
      const nextBtn1 = await page.$('#identifierNext button, #identifierNext');
      if (!nextBtn1) throw new Error('Кнопка Next на шаге email не найдена');
      await nextBtn1.click();

      // Ждем поле пароля
      console.log(`🔑 Ждем поле пароля...`);
      await page.waitForSelector('input[name="Passwd"], input[type="password"]', { visible: true, timeout: 60000 });
      const passSelector = (await page.$('input[name="Passwd"]')) ? 'input[name="Passwd"]' : 'input[type="password"]';
      
      console.log(`🔑 Вводим пароль...`);
      await page.click(passSelector, { clickCount: 3 });
      await page.type(passSelector, String(password), { delay: 100 });
      
      // Нажимаем Next для пароля
      const nextBtn2 = await page.$('#passwordNext button, #passwordNext');
      if (!nextBtn2) throw new Error('Кнопка Next на шаге пароля не найдена');
      
      console.log(`⏳ Отправляем форму входа...`);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {}),
        nextBtn2.click()
      ]);

      // Проверяем успешный вход
      console.log(`🔍 Проверяем успешность входа...`);
      const finalUrl = page.url();
      console.log(`📍 Финальный URL: ${finalUrl}`);
      
      // Ждем немного для загрузки страницы
      await page.waitForTimeout(3000);
      
      // Проверяем различные индикаторы успешного входа
      const isLoggedIn = await page.evaluate(() => {
        // Проверяем наличие элементов, указывающих на успешный вход
        const indicators = [
          'a[href*="SignOutOptions"]',
          'a[href*="Logout"]', 
          'img[alt*="Google Account"]',
          'a[aria-label*="Google Account"]',
          'div[aria-label*="Google Account"]',
          'button[aria-label*="Google Account"]'
        ];
        
        for (const selector of indicators) {
          if (document.querySelector(selector)) {
            return true;
          }
        }
        
        // Проверяем URL
        return window.location.href.includes('myaccount.google.com') || 
               window.location.href.includes('accounts.google.com/b/0/ManageAccount');
      });

      if (!isLoggedIn) {
        // Проверяем, не требуется ли 2FA
        const need2fa = await page.$('div[id*="challenge"], div[data-challengetype], input[name="idvAnyPhonePin"], div[aria-label*="2-Step Verification"]');
        if (need2fa) {
          throw new Error('Требуется двухэтапная проверка (2FA) для входа в Google. Автоматизация 2FA не поддерживается.');
        }
        
        // Проверяем другие возможные проблемы
        const errorMessage = await page.evaluate(() => {
          const errorSelectors = [
            'div[role="alert"]',
            '.error-msg',
            '[data-error]',
            '.error'
          ];
          
          for (const selector of errorSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          return null;
        });
        
        if (errorMessage) {
          throw new Error(`Ошибка входа в Google: ${errorMessage}`);
        }
        
        throw new Error('Не удалось подтвердить вход в Google. Проверьте данные аккаунта.');
      }

      console.log(`✅ Успешный вход в Google аккаунт: ${email}`);

    } finally {
      await page.close().catch(() => {});
    }
  }

  async fillFormForAccount(browser, formConfig, account, options, accountIndex = 0) {
    const page = await browser.newPage();
    
    try {
      console.log(`\n🚀 Начинаем заполнение формы для аккаунта: ${account.name}`);
      console.log(`📝 URL формы: ${formConfig.url}`);
      
      // Устанавливаем User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Переходим на форму
      console.log('🌐 Переходим на страницу формы...');
      await page.goto(formConfig.url, { waitUntil: 'networkidle2' });
      
      // Ждем загрузки формы (современные Google Forms могут не иметь стандартной формы)
      console.log('⏳ Ждем загрузки формы...');
      try {
        await page.waitForSelector('form', { timeout: 5000 });
        console.log('✅ Стандартная форма найдена');
      } catch (error) {
        console.log('⚠️ Стандартная форма не найдена, ждем загрузки полей ввода...');
        await page.waitForSelector('input[type="text"], textarea, select', { timeout: 10000 });
        console.log('✅ Поля ввода найдены');
      }
      
      // Заполняем поля формы
      console.log('📝 Начинаем заполнение полей...');
      for (const field of formConfig.fields) {
        await this.fillField(page, field, account, options, formConfig);
      }
      
      // Отправляем форму
      if (options.submit !== false) {
        console.log('📤 Отправляем форму...');
        
        // Ждем полной загрузки формы перед отправкой
        console.log('⏳ Ждем полной загрузки формы...');
        await page.waitForTimeout(3000);
        
        // Проверяем, что все поля заполнены
        const formReady = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input, textarea, select');
          let filledCount = 0;
          let totalCount = 0;
          
          inputs.forEach(input => {
            if (input.type !== 'hidden' && input.type !== 'submit' && input.type !== 'button') {
              totalCount++;
              if (input.value && input.value.trim() !== '') {
                filledCount++;
              }
            }
          });
          
          console.log(`Заполнено полей: ${filledCount}/${totalCount}`);
          return filledCount > 0;
        });
        
        if (formReady) {
          console.log('✅ Форма готова к отправке');
        } else {
          console.log('⚠️ Форма может быть не готова, но продолжаем...');
        }
        
        await this.submitForm(page, formConfig);
      }
      
      // Ждем подтверждения отправки
      console.log('⏳ Ждем подтверждения отправки...');
      await this.waitForSubmission(page);
      
      console.log('✅ Форма успешно отправлена!');
      
      // Задержка между сабмитами форм
      if (options.delaySettings && options.delaySettings.enabled) {
        const submitDelay = this.calculateSubmitDelay(options.delaySettings, accountIndex);
        if (submitDelay > 0) {
          console.log(`⏳ Задержка между сабмитами: ${submitDelay}мс (${options.delaySettings.type})`);
          await this.sleep(submitDelay);
          console.log('✅ Задержка завершена');
        }
      }
      
      return {
        success: true,
        submittedAt: new Date()
      };
      
    } finally {
      await page.close();
    }
  }

  async fillField(page, field, account, options, formConfig) {
    try {
      const selector = `[name="${field.name}"], #${field.id}`;
      
      switch (field.type) {
        case 'text':
        case 'email':
        case 'tel':
        case 'url':
        case 'textarea':
          await this.fillTextField(page, selector, field, account, formConfig);
          break;
          
        case 'number':
          await this.fillNumberField(page, selector, field, account);
          break;
          
        case 'date':
        case 'time':
        case 'datetime':
          await this.fillDateTimeField(page, selector, field, account);
          break;
          
        case 'select':
          await this.fillSelectField(page, selector, field, account);
          break;
          
        case 'radio':
          await this.fillRadioField(page, field, account);
          break;
          
        case 'checkbox':
          await this.fillCheckboxField(page, field, account);
          break;
          
        case 'file':
          await this.fillFileField(page, selector, field, account);
          break;
      }
      
    } catch (error) {
      console.error(`Ошибка заполнения поля ${field.name}:`, error);
      throw error;
    }
  }

  async fillTextField(page, selector, field, account, formConfig) {
    const value = this.getValueForField(field, account);
    if (!value) {
      console.log(`Пропускаем поле ${field.title} - нет значения`);
      return;
    }

    console.log(`Заполняем поле ${field.title} значением: ${value}`);

    try {
      // Используем более точный подход для поиска поля
      let filled = false;
      
      // Сначала пробуем найти поле по индексу (порядку на странице)
      const allInputs = await page.$$('input[type="text"], textarea');
      const fieldIndex = formConfig.fields.indexOf(field);
      
      if (allInputs.length > fieldIndex) {
        try {
          await allInputs[fieldIndex].click();
          await allInputs[fieldIndex].type(value);
          console.log(`✅ Успешно заполнено поле ${field.title} по индексу ${fieldIndex}`);
          filled = true;
        } catch (error) {
          console.log(`❌ Не удалось заполнить поле ${field.title} по индексу: ${error.message}`);
        }
      }
      
      // Если не получилось по индексу, пробуем другие селекторы
      if (!filled) {
        const selectors = [
          selector, // Оригинальный селектор
          'input[aria-label*="' + field.title + '"]', // По aria-label
          'input[placeholder*="' + field.title + '"]', // По placeholder
          '.whsOnd.zHQkBf', // Класс для полей Google Forms
          'input[type="text"]' // Общий селектор для текстовых полей
        ];

        for (const sel of selectors) {
          try {
            const elements = await page.$$(sel);
            if (elements.length > 0) {
              // Берем первый доступный элемент
              await elements[0].click();
              await elements[0].type(value);
              console.log(`✅ Успешно заполнено поле ${field.title} селектором: ${sel}`);
              filled = true;
              break;
            }
          } catch (error) {
            console.log(`❌ Селектор ${sel} не сработал: ${error.message}`);
            continue;
          }
        }
      }

      if (!filled) {
        console.log(`❌ Не удалось заполнить поле ${field.title}`);
      }

    } catch (error) {
      console.error(`❌ Ошибка заполнения поля ${field.title}:`, error.message);
    }
  }

  async fillNumberField(page, selector, field, account) {
    const value = this.getValueForField(field, account);
    if (value) {
      await page.type(selector, value.toString());
    }
  }

  async fillDateTimeField(page, selector, field, account) {
    const value = this.getValueForField(field, account);
    if (value) {
      await page.type(selector, value);
    }
  }

  async fillSelectField(page, selector, field, account) {
    const value = this.getValueForField(field, account);
    if (value) {
      await page.select(selector, value);
    }
  }

  async fillRadioField(page, field, account) {
    const value = this.getValueForField(field, account);
    if (!value) {
      console.log(`Пропускаем радио-кнопку ${field.title} - нет значения`);
      return;
    }

    console.log(`Заполняем радио-кнопку ${field.title} значением: ${value}`);

    try {
      // Пробуем разные способы поиска радио-кнопки
      const selectors = [
        `input[name="${field.name}"][value="${value}"]`,
        `input[name="${field.name}"][type="radio"]`,
        `input[type="radio"]`
      ];
      
      let clicked = false;
      for (const selector of selectors) {
        try {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            // Ищем элемент с нужным значением
            for (const element of elements) {
              const elementValue = await page.evaluate(el => el.value, element);
              if (elementValue === value) {
                await element.click();
                console.log(`✅ Радио-кнопка "${value}" выбрана`);
                clicked = true;
                break;
              }
            }
            if (clicked) break;
          }
        } catch (error) {
          console.log(`❌ Селектор ${selector} не сработал: ${error.message}`);
          continue;
        }
      }
      
      if (!clicked) {
        console.log(`❌ Не удалось выбрать радио-кнопку "${value}"`);
      }
      
    } catch (error) {
      console.error(`❌ Ошибка заполнения радио-кнопки ${field.title}:`, error.message);
    }
  }

  async fillCheckboxField(page, field, account) {
    const values = this.getValueForField(field, account);
    
      // Для чекбоксов значение может быть false (не отмечен) или пустая строка, что является валидным
      if (values === undefined || values === null || values === '') {
        console.log(`Пропускаем чекбокс ${field.title} - нет значения (${values})`);
        return;
      }

    console.log(`Заполняем чекбокс ${field.title} значениями:`, values);

    try {
      // Если значение boolean (true/false), обрабатываем как простой чекбокс
      if (typeof values === 'boolean') {
        if (values === true) {
          console.log(`🔍 Ищем чекбокс для поля "${field.title}"...`);
          
          // Также попробуем найти все элементы с текстом, содержащим ключевые слова
          const textElements = await page.evaluate((searchText) => {
            const elements = [];
            const allElements = document.querySelectorAll('*');
            allElements.forEach((el, index) => {
              const text = el.textContent || el.innerText;
              if (text && text.toLowerCase().includes(searchText.toLowerCase())) {
                elements.push({
                  index,
                  tagName: el.tagName,
                  text: text.substring(0, 100),
                  className: el.className,
                  id: el.id,
                  ariaLabel: el.getAttribute('aria-label'),
                  outerHTML: el.outerHTML.substring(0, 200)
                });
              }
            });
            return elements;
          }, field.title);
          
          // Попробуем найти элементы по английским переводам
          const englishTranslations = await page.evaluate(() => {
            const elements = [];
            const allElements = document.querySelectorAll('*');
            
            // Словарь переводов для чекбоксов
            const translations = {
              'указати у відповіді мою електронну адресу': ['record', 'email', 'response', 'include'],
              'надіслати мені копію моїх відповідей': ['send', 'copy', 'responses', 'me']
            };
            
            allElements.forEach((el, index) => {
              const text = el.textContent || el.innerText;
              const ariaLabel = el.getAttribute('aria-label');
              const fullText = (text + ' ' + (ariaLabel || '')).toLowerCase();
              
              // Проверяем каждую пару переводов
              Object.entries(translations).forEach(([ukrainian, englishWords]) => {
                const matchedWords = englishWords.filter(word => fullText.includes(word));
                if (matchedWords.length >= 2) { // Если совпало минимум 2 слова
                  elements.push({
                    index,
                    tagName: el.tagName,
                    text: text.substring(0, 100),
                    className: el.className,
                    id: el.id,
                    ariaLabel: ariaLabel,
                    matchedWords,
                    ukrainianPhrase: ukrainian,
                    outerHTML: el.outerHTML.substring(0, 200)
                  });
                }
              });
            });
            return elements;
          });
          
          console.log(`📋 Элементы с текстом "${field.title}":`, JSON.stringify(textElements, null, 2));
          console.log(`📋 Элементы с английскими переводами:`, JSON.stringify(englishTranslations, null, 2));
          
          // Дополнительно попробуем найти элементы с похожими словами
          const similarElements = await page.evaluate((searchText) => {
            const elements = [];
            const keywords = searchText.toLowerCase().split(' ').filter(word => word.length > 3);
            const allElements = document.querySelectorAll('*');
            
            allElements.forEach((el, index) => {
              const text = el.textContent || el.innerText;
              if (text) {
                const textLower = text.toLowerCase();
                const matchedKeywords = keywords.filter(keyword => textLower.includes(keyword));
                if (matchedKeywords.length > 0) {
                  elements.push({
                    index,
                    tagName: el.tagName,
                    text: text.substring(0, 100),
                    className: el.className,
                    id: el.id,
                    ariaLabel: el.getAttribute('aria-label'),
                    matchedKeywords,
                    outerHTML: el.outerHTML.substring(0, 200)
                  });
                }
              }
            });
            return elements;
          }, field.title);
          
          
          // Ищем чекбокс по различным селекторам
          const selectors = [
            `[role="checkbox"]`,
            `[aria-label*="${field.title}"]`,
            `input[type="checkbox"]`,
            `input[name="${field.name}"]`,
            `input[name="${field.id}"]`
          ];
          
          let clicked = false;
          for (const selector of selectors) {
            try {
              const elements = await page.$$(selector);
              
              if (elements.length > 0) {
                // Ищем элемент с нужным aria-label или названием
                for (let i = 0; i < elements.length; i++) {
                  const element = elements[i];
                  const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), element);
                  const isChecked = await page.evaluate(el => el.getAttribute('aria-checked'), element);
                  const elementText = await page.evaluate(el => el.textContent || el.innerText, element);
                  
                  // Если элемент уже отмечен, пропускаем
                  if (isChecked === 'true') {
                    console.log(`✅ Чекбокс "${field.title}" уже отмечен`);
                    clicked = true;
                    break;
                  }
                  
                  // Проверяем aria-label (частичное совпадение)
                  if (ariaLabel && (
                    ariaLabel.toLowerCase().includes(field.title.toLowerCase()) ||
                    field.title.toLowerCase().includes(ariaLabel.toLowerCase())
                  )) {
                    await element.click();
                    console.log(`✅ Чекбокс "${field.title}" отмечен по aria-label`);
                    clicked = true;
                    break;
                  }
                  
                  // Проверяем текст элемента
                  if (elementText && (
                    elementText.toLowerCase().includes(field.title.toLowerCase()) ||
                    field.title.toLowerCase().includes(elementText.toLowerCase())
                  )) {
                    await element.click();
                    console.log(`✅ Чекбокс "${field.title}" отмечен по тексту`);
                    clicked = true;
                    break;
                  }
                }
                if (clicked) break;
              }
            } catch (error) {
              console.log(`❌ Селектор ${selector} не сработал: ${error.message}`);
              continue;
            }
          }
          
          if (!clicked) {
            console.log(`❌ Не удалось отметить чекбокс "${field.title}"`);
            
            // Попробуем найти чекбокс по английским переводам
            try {
              console.log(`🔍 Пробуем найти чекбокс по английским переводам...`);
              
              // Определяем английские ключевые слова для текущего поля
              let englishKeywords = [];
              if (field.title.toLowerCase().includes('указати') && field.title.toLowerCase().includes('електронну')) {
                englishKeywords = ['record', 'email', 'response', 'include'];
              } else if (field.title.toLowerCase().includes('надіслати') && field.title.toLowerCase().includes('копію')) {
                englishKeywords = ['send', 'copy', 'responses', 'me'];
              }
              
              console.log(`🔍 Английские ключевые слова для "${field.title}":`, englishKeywords);
              
              const foundByEnglish = await page.evaluate((keywords) => {
                // Ищем все элементы с role="checkbox" или input[type="checkbox"]
                const checkboxes = document.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
                
                for (let checkbox of checkboxes) {
                  const ariaLabel = checkbox.getAttribute('aria-label');
                  const parent = checkbox.parentElement;
                  const parentText = parent ? parent.textContent || parent.innerText : '';
                  const fullText = (ariaLabel + ' ' + parentText).toLowerCase();
                  
                  // Проверяем совпадение с английскими ключевыми словами
                  const matchedKeywords = keywords.filter(keyword => fullText.includes(keyword));
                  if (matchedKeywords.length >= 2) { // Если совпало минимум 2 слова
                    return {
                      found: true,
                      method: 'english-translation',
                      ariaLabel: ariaLabel,
                      parentText: parentText.substring(0, 100),
                      matchedKeywords: matchedKeywords,
                      isChecked: checkbox.getAttribute('aria-checked')
                    };
                  }
                }
                
                return { found: false };
              }, englishKeywords);
              
              if (foundByEnglish.found) {
                console.log(`✅ Найден чекбокс методом "${foundByEnglish.method}":`, foundByEnglish);
                
                // Кликаем по найденному чекбоксу
                const checkboxElement = await page.evaluateHandle((keywords) => {
                  const checkboxes = document.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
                  
                  for (let checkbox of checkboxes) {
                    const ariaLabel = checkbox.getAttribute('aria-label');
                    const parent = checkbox.parentElement;
                    const parentText = parent ? parent.textContent || parent.innerText : '';
                    const fullText = (ariaLabel + ' ' + parentText).toLowerCase();
                    
                    const matchedKeywords = keywords.filter(keyword => fullText.includes(keyword));
                    if (matchedKeywords.length >= 2) {
                      return checkbox;
                    }
                  }
                  return null;
                }, englishKeywords);
                
                if (checkboxElement && checkboxElement.asElement) {
                  await checkboxElement.asElement().click();
                  console.log(`✅ Чекбокс "${field.title}" отмечен по английскому переводу`);
                  clicked = true;
                }
              } else {
                console.log(`❌ Чекбокс не найден даже по английскому переводу`);
              }
            } catch (textSearchError) {
              console.log(`❌ Ошибка при поиске по тексту: ${textSearchError.message}`);
            }
            
            // Попробуем кликнуть по первому найденному чекбоксу как fallback
            if (!clicked) {
              try {
                const firstCheckbox = await page.$('[role="checkbox"], input[type="checkbox"]');
                if (firstCheckbox) {
                  await firstCheckbox.click();
                  console.log(`⚠️ Кликнули по первому найденному чекбоксу как fallback`);
                  clicked = true;
                }
              } catch (fallbackError) {
                console.log(`❌ Fallback тоже не сработал: ${fallbackError.message}`);
              }
            }
          }
        } else {
          console.log(`Чекбокс "${field.title}" не должен быть отмечен (значение: false)`);
        }
        return;
      }

      // Если значение массив или строка, обрабатываем как множественный выбор
      const valuesArray = Array.isArray(values) ? values : [values];
      
      for (const value of valuesArray) {
        // Пробуем разные способы поиска чекбокса
        const selectors = [
          `input[name="${field.name}"][value="${value}"]`,
          `input[name="${field.name}"][type="checkbox"]`,
          `input[type="checkbox"]`,
          `[role="checkbox"]`,
          `[aria-label*="${field.title}"]`
        ];
        
        let clicked = false;
        for (const selector of selectors) {
          try {
            const elements = await page.$$(selector);
            if (elements.length > 0) {
              // Ищем элемент с нужным значением
              for (const element of elements) {
                const elementValue = await page.evaluate(el => el.value, element);
                const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), element);
                
                // Для элементов с role="checkbox" проверяем aria-label
                if (selector.includes('role="checkbox"') || selector.includes('aria-label')) {
                  if (ariaLabel && ariaLabel.includes(field.title)) {
                    await element.click();
                    console.log(`✅ Чекбокс "${field.title}" отмечен`);
                    clicked = true;
                    break;
                  }
                } else if (elementValue === value || !value) {
                  await element.click();
                  console.log(`✅ Чекбокс "${value}" отмечен`);
                  clicked = true;
                  break;
                }
              }
              if (clicked) break;
            }
          } catch (error) {
            console.log(`❌ Селектор ${selector} не сработал: ${error.message}`);
            continue;
          }
        }
        
        if (!clicked) {
          console.log(`❌ Не удалось отметить чекбокс "${value}"`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Ошибка заполнения чекбокса ${field.title}:`, error.message);
    }
  }

  async fillFileField(page, selector, field, account) {
    const filePath = this.getValueForField(field, account);
    if (filePath) {
      const fileInput = await page.$(selector);
      if (fileInput) {
        await fileInput.uploadFile(filePath);
      }
    }
  }

  getValueForField(field, account) {
    // Сначала проверяем пользовательские данные (если есть)
    if (account.fields && account.fields[field.id] !== undefined) {
      return account.fields[field.id];
    }
    
    // Ищем значение в данных аккаунта по имени поля
    let value = account.data && account.data[field.name];
    
    // Если значение не найдено, пробуем найти по ID
    if (value === undefined) {
      value = account.data && account.data[field.id];
    }
    
    // Если все еще не найдено, используем значение по умолчанию
    if (value === undefined && field.defaultValue) {
      value = field.defaultValue;
    }
    
    console.log(`📋 Итоговое значение для поля ${field.title} (${field.id}):`, value, typeof value);
    return value;
  }

  async submitForm(page, formConfig) {
    console.log('Ищем кнопку отправки формы...');
    
    try {
      
      // Используем page.evaluate для поиска кнопки отправки
      const submitButton = await page.evaluate(() => {
        // Сначала ищем настоящие кнопки с определенными классами Google Forms
        const googleButtons = document.querySelectorAll('.freebirdFormviewerViewNavigationSubmitButton, [jsname="M2UYVd"], button[data-value="Submit"], .freebirdFormviewerViewNavigationSubmitButton, .appsMaterialWizButtonPaperbuttonLabel, .quantumWizButtonPaperbuttonLabel');
        if (googleButtons.length > 0) {
          const button = googleButtons[0];
          return {
            tagName: button.tagName,
            className: button.className,
            id: button.id,
            text: button.textContent,
            type: 'google-button'
          };
        }
        
        // Ищем кнопки с определенными атрибутами Google Forms
        const googleSubmitButtons = document.querySelectorAll('[data-value="Submit"], [aria-label*="Submit"], [aria-label*="Отправить"], button[jsname="M2UYVd"]');
        if (googleSubmitButtons.length > 0) {
          const button = googleSubmitButtons[0];
          return {
            tagName: button.tagName,
            className: button.className,
            id: button.id,
            text: button.textContent,
            type: 'google-submit-button'
          };
        }
        
        // Ищем кнопки с текстом Submit или Отправить, но исключаем длинные тексты с инструкциями
        // Исключаем span элементы, так как они часто содержат инструкции
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"]'));
        
        for (const button of buttons) {
          const text = button.textContent?.toLowerCase() || '';
          const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
          
          // Исключаем длинные тексты (больше 30 символов) - это скорее всего инструкции
          if (text.length > 30) continue;
          
          // Исключаем тексты с URL, ссылками, инструкциями
          if (text.includes('http') || text.includes('www') || text.includes('link') || 
              text.includes('retweet') || text.includes('event') || text.includes('post') ||
              text.includes('twitter') || text.includes('x.com')) {
            continue;
          }
          
          // Ищем только короткие тексты с "submit" или "отправить"
          if ((text.trim() === 'submit' || text.trim() === 'отправить' || 
               text.includes('submit') || text.includes('отправить')) && 
              text.length < 20) {
            return {
              tagName: button.tagName,
              className: button.className,
              id: button.id,
              text: button.textContent,
              type: 'text-button'
            };
          }
          
          if (ariaLabel.includes('submit') || ariaLabel.includes('отправить')) {
            return {
              tagName: button.tagName,
              className: button.className,
              id: button.id,
              text: button.textContent,
              type: 'aria-button'
            };
          }
        }
        
        // Ищем кнопки с определенными атрибутами
        const submitInputs = document.querySelectorAll('input[type="submit"], button[type="submit"]');
        if (submitInputs.length > 0) {
          const button = submitInputs[0];
          return {
            tagName: button.tagName,
            className: button.className,
            id: button.id,
            text: button.textContent || button.value,
            type: 'submit-input'
          };
        }
        
        // Если ничего не найдено, попробуем найти любую кнопку с коротким текстом
        const shortButtons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const button of shortButtons) {
          const text = button.textContent?.toLowerCase() || '';
          if (text.length > 0 && text.length < 15 && 
              !text.includes('http') && !text.includes('www') && 
              !text.includes('link') && !text.includes('retweet')) {
            return {
              tagName: button.tagName,
              className: button.className,
              id: button.id,
              text: button.textContent,
              type: 'short-button'
            };
          }
        }
        
        return null;
      });
      
      if (submitButton) {
        console.log(`Найдена кнопка отправки:`, submitButton);
        
        // Проверяем, что это действительно кнопка отправки, а не инструкция
        if (submitButton.text && submitButton.text.length > 50) {
          console.log('⚠️ Найденный элемент слишком длинный, возможно это инструкция. Пропускаем...');
          submitButton = null;
        } else if (submitButton.text && (submitButton.text.includes('http') || submitButton.text.includes('retweet'))) {
          console.log('⚠️ Найденный элемент содержит ссылку, возможно это инструкция. Пропускаем...');
          submitButton = null;
        }
      }
      
      if (submitButton) {
        // Ждем, пока кнопка полностью загрузится и станет кликабельной
        console.log('⏳ Ждем полной загрузки кнопки отправки...');
        await page.waitForTimeout(2000); // Даем время на загрузку
        
        // Проверяем, что кнопка действительно кликабельна
        const isClickable = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], span'));
          for (const button of buttons) {
            const text = button.textContent?.toLowerCase() || '';
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            
            if (text.includes('submit') || text.includes('отправить') || 
                ariaLabel.includes('submit') || ariaLabel.includes('отправить')) {
              const style = window.getComputedStyle(button);
              const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
              const isEnabled = !button.disabled && !button.hasAttribute('disabled');
              const hasClickHandler = button.onclick !== null || button.getAttribute('onclick') !== null;
              
              console.log('Кнопка найдена:', {
                text: button.textContent,
                isVisible,
                isEnabled,
                hasClickHandler,
                className: button.className
              });
              
              return isVisible && isEnabled;
            }
          }
          return false;
        });
        
        if (!isClickable) {
          console.log('⚠️ Кнопка отправки найдена, но не кликабельна. Ждем еще...');
          await page.waitForTimeout(3000); // Дополнительное ожидание
        }
        
        // Пробуем разные способы клика
        const clickMethods = [
            // Метод 1: Клик через evaluate с более точным поиском
            async () => {
              const clicked = await page.evaluate(() => {
                // Ищем кнопки с текстом Submit
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], span'));
                for (const button of buttons) {
                  const text = button.textContent?.toLowerCase() || '';
                  const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                  
                  if (text.includes('submit') || text.includes('отправить') || 
                      ariaLabel.includes('submit') || ariaLabel.includes('отправить')) {
                    
                    // Пробуем разные способы клика
                    try {
                      button.click();
                      return true;
                    } catch (e) {
                      try {
                        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        return true;
                      } catch (e2) {
                        try {
                          button.dispatchEvent(new Event('click', { bubbles: true }));
                          return true;
                        } catch (e3) {
                          return false;
                        }
                      }
                    }
                  }
                }
                return false;
              });
              
              if (!clicked) {
                throw new Error('Кнопка не найдена или клик не сработал');
              }
            },
          
            // Метод 2: Клик по Google Forms кнопке
            async () => {
              const clicked = await page.evaluate(() => {
                const googleButton = document.querySelector('.freebirdFormviewerViewNavigationSubmitButton, [jsname="M2UYVd"], .M7eMe');
                if (googleButton) {
                  // Пробуем разные способы клика
                  try {
                    googleButton.click();
                    return true;
                  } catch (e) {
                    try {
                      googleButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                      return true;
                    } catch (e2) {
                      try {
                        googleButton.dispatchEvent(new Event('click', { bubbles: true }));
                        return true;
                      } catch (e3) {
                        return false;
                      }
                    }
                  }
                }
                return false;
              });
              
              if (!clicked) {
                throw new Error('Google Forms кнопка не найдена или клик не сработал');
              }
            },
          
            // Метод 3: Клик по селектору
            async () => {
              const selector = submitButton.id ? `#${submitButton.id}` : 
                             submitButton.className ? `.${submitButton.className.split(' ')[0]}` : 
                             submitButton.tagName.toLowerCase();
              await page.click(selector);
            },
          
            // Метод 4: Клик по координатам
            async () => {
              const element = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], span'));
                for (const button of buttons) {
                  const text = button.textContent?.toLowerCase() || '';
                  if (text.includes('submit') || text.includes('отправить')) {
                    return button;
                  }
                }
                return null;
              });
              
              if (element && element.asElement) {
                const box = await element.asElement().boundingBox();
                if (box) {
                  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                }
              }
            },
          
            // Метод 5: Отправка формы через JavaScript
            async () => {
              await page.evaluate(() => {
                // Ищем форму
                const form = document.querySelector('form');
                if (form) {
                  form.submit();
                  return true;
                }
                
                // Если формы нет, ищем кнопку и симулируем отправку
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], div[role="button"], span'));
                for (const button of buttons) {
                  const text = button.textContent?.toLowerCase() || '';
                  if (text.includes('submit') || text.includes('отправить')) {
                    // Создаем событие submit
                    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                    button.dispatchEvent(submitEvent);
                    
                    // Также пробуем клик
                    button.click();
                    return true;
                  }
                }
                return false;
              });
            }
        ];
        
        let clickSuccess = false;
        for (let i = 0; i < clickMethods.length; i++) {
          try {
            // Небольшая задержка перед каждым методом клика
            if (i > 0) {
              await page.waitForTimeout(1000);
            }
            
            await clickMethods[i]();
            
            // Проверяем, действительно ли кнопка была нажата
            await page.waitForTimeout(500);
            
            // Проверяем, изменился ли URL или появились ли признаки отправки
            const urlChanged = await page.evaluate(() => {
              return window.location.href.includes('formResponse') || 
                     window.location.href.includes('thankyou') ||
                     window.location.href.includes('confirmation');
            });
            
            const successMessage = await page.evaluate(() => {
              const body = document.body;
              const text = body.textContent.toLowerCase();
              return text.includes('your response has been recorded') ||
                     text.includes('спасибо') ||
                     text.includes('ответ записан') ||
                     text.includes('форма отправлена');
            });
            
            if (urlChanged || successMessage) {
              console.log('✅ Кнопка отправки нажата успешно!');
              clickSuccess = true;
              return;
            }
          } catch (error) {
            continue;
          }
        }
      }
      
      // Если не нашли кнопку, пробуем отправить форму через Enter
      console.log('Кнопка отправки не найдена, пробуем Enter...');
      await page.keyboard.press('Enter');
      
    } catch (error) {
      console.error('Ошибка при поиске кнопки отправки:', error.message);
      // В крайнем случае пробуем Enter
      await page.keyboard.press('Enter');
    }
  }

  async waitForSubmission(page) {
    try {
      
      // Ждем изменения URL или появления сообщения об успешной отправке
      await Promise.race([
        // Ждем изменения URL (Google Forms перенаправляет после отправки)
        page.waitForFunction(() => {
          const url = window.location.href;
          console.log('Текущий URL:', url);
          return url.includes('formResponse') || 
                 url.includes('thankyou') ||
                 url.includes('confirmation') ||
                 url.includes('viewform?usp=pp_url&formkey=');
        }, { timeout: 20000 }),
        
        // Ждем появления сообщения об успешной отправке
        page.waitForSelector('.freebirdFormviewerViewResponseConfirmationMessage, .thank-you, .success, [data-response-id], .freebirdFormviewerViewResponseConfirmationMessage', { 
          timeout: 20000 
        }),
        
        // Ждем исчезновения формы
        page.waitForFunction(() => {
          const form = document.querySelector('form');
          const submitButton = document.querySelector('button, input[type="submit"], div[role="button"], span');
          return !form || form.style.display === 'none' || !submitButton;
        }, { timeout: 20000 }),
        
        // Ждем появления текста подтверждения
        page.waitForFunction(() => {
          const body = document.body;
          const text = body.textContent.toLowerCase();
          return text.includes('your response has been recorded') ||
                 text.includes('спасибо') ||
                 text.includes('ответ записан') ||
                 text.includes('форма отправлена');
        }, { timeout: 20000 })
      ]);
      
      console.log('✅ Форма успешно отправлена!');
      
    } catch (error) {
      console.log('Ошибка при ожидании подтверждения:', error.message);
      
      // Проверяем, не изменился ли URL
      const currentUrl = page.url();
      console.log('Текущий URL после попытки отправки:', currentUrl);
      
      if (currentUrl.includes('formResponse') || currentUrl.includes('thankyou')) {
        console.log('✅ Форма отправлена (определено по URL)');
        return;
      }
      
      // Проверяем, есть ли сообщение об успешной отправке
      const successMessage = await page.evaluate(() => {
        const body = document.body;
        const text = body.textContent.toLowerCase();
        return text.includes('your response has been recorded') ||
               text.includes('спасибо') ||
               text.includes('ответ записан') ||
               text.includes('форма отправлена');
      });
      
      if (successMessage) {
        console.log('✅ Форма отправлена (определено по тексту)');
        return;
      }
      
      console.log('⚠️ Не удалось дождаться подтверждения отправки, но форма могла быть отправлена');
    }
  }

  async updateJobStatus(jobId, status, error = null) {
    try {
      const updates = {
        status,
        endTime: new Date().toISOString()
      };
      
      if (error) {
        updates.error = error;
        await this.jobModel.addLog(jobId, {
          type: 'error',
          message: error
        });
      }
      
      await this.jobModel.update(jobId, updates);
    } catch (error) {
      console.error('Ошибка обновления статуса задачи:', error);
    }
  }

  async sendNotification(notification) {
    try {
      const response = await fetch('http://localhost:3001/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification)
      });
      
      if (!response.ok) {
        console.error('Ошибка при отправке уведомления:', response.statusText);
      }
    } catch (error) {
      console.error('Ошибка при отправке уведомления:', error);
    }
  }

  async getJobStatus(jobId) {
    return await this.jobModel.getById(jobId);
  }

  async stopJob(jobId) {
    const job = await this.jobModel.getById(jobId);
    if (job && job.status === 'running') {
      await this.jobModel.update(jobId, { 
        status: 'stopped',
        endTime: new Date().toISOString()
      });
      await this.jobModel.addLog(jobId, {
        type: 'info',
        message: 'Задача остановлена пользователем'
      });
    }
  }

  async getJobResults(jobId) {
    const job = await this.jobModel.getById(jobId);
    return job ? job.results : [];
  }

  async getAllJobs() {
    return await this.jobModel.getAll();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateAnonymousAccounts(count, formConfig) {
    const accounts = [];
    
    for (let i = 0; i < count; i++) {
      const account = {
        id: `anon_${Date.now()}_${i}`,
        email: `anonymous_${i + 1}`,
        password: '',
        data: this.generateAnonymousData(formConfig.fields, i)
      };
      accounts.push(account);
    }
    
    return accounts;
  }

  generateAnonymousData(fields, index) {
    const data = {};
    
    fields.forEach(field => {
      const fieldName = field.name || field.id;
      
      // Генерируем данные в зависимости от типа поля
      switch (field.type) {
        case 'text':
        case 'textarea':
          if (fieldName.toLowerCase().includes('email')) {
            data[fieldName] = `user${index + 1}@example.com`;
          } else if (fieldName.toLowerCase().includes('name')) {
            data[fieldName] = `Пользователь ${index + 1}`;
          } else if (fieldName.toLowerCase().includes('phone')) {
            data[fieldName] = `+7${Math.floor(Math.random() * 9000000000) + 1000000000}`;
          } else {
            data[fieldName] = `Ответ ${index + 1}`;
          }
          break;
          
        case 'number':
          data[fieldName] = Math.floor(Math.random() * 100) + 1;
          break;
          
        case 'select':
        case 'radio':
          if (field.options && field.options.length > 0) {
            const randomOption = field.options[Math.floor(Math.random() * field.options.length)];
            data[fieldName] = randomOption.value;
          }
          break;
          
        case 'checkbox':
          if (field.options && field.options.length > 0) {
            const selectedCount = Math.floor(Math.random() * field.options.length) + 1;
            const selected = [];
            for (let i = 0; i < selectedCount; i++) {
              const option = field.options[Math.floor(Math.random() * field.options.length)];
              if (!selected.includes(option.value)) {
                selected.push(option.value);
              }
            }
            data[fieldName] = selected;
          }
          break;
          
        case 'date':
          const date = new Date();
          date.setDate(date.getDate() + Math.floor(Math.random() * 365));
          data[fieldName] = date.toISOString().split('T')[0];
          break;
          
        default:
          data[fieldName] = `Значение ${index + 1}`;
      }
    });
    
    return data;
  }

  // Расчет задержки между сабмитами форм
  calculateSubmitDelay(delaySettings, accountIndex = 0) {
    if (!delaySettings || !delaySettings.enabled) {
      return 0;
    }

    const { type, minDelay, maxDelay, fixedDelay, progressiveMultiplier } = delaySettings;

    switch (type) {
      case 'fixed':
        return fixedDelay || 3000;
        
      case 'random':
        return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        
      case 'progressive':
        const progressiveDelay = minDelay * Math.pow(progressiveMultiplier, accountIndex);
        return Math.min(progressiveDelay, maxDelay);
        
      default:
        return 3000; // По умолчанию 3 секунды
    }
  }

  // Очистка истории задач
  async clearHistory() {
    try {
      await this.jobModel.clearAll();
      console.log('✅ История задач автоматизации очищена');
    } catch (error) {
      console.error('❌ Ошибка очистки истории задач:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    // Закрываем все профили браузера
    await this.profileManager.closeAllBrowsers();
  }
}

module.exports = FormAutomator;
