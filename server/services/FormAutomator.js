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
    this.maxConcurrentBrowsers = 1; // Устаревший глобальный лимит (не используется для нескольких задач)
    this.activeBrowsers = new Set(); // Глобальный трекинг (сохраняем для совместимости логов)
    this.batchSize = 1; // Пакет из одного аккаунта
    this.batchDelay = 0; // Без задержки между пакетами
    this.cancellationTokens = new Map(); // jobId -> { cancelled: boolean }
    this.jobBrowsers = new Map(); // jobId -> Set(accountId)
    this.jobConcurrency = new Map(); // jobId -> number
  }

  async initBrowser(options = {}) {
    if (!this.browser) {
      try {
        const headless = options.headless !== undefined ? options.headless : false;ачио 
        console.log(`🌐 Запуск браузера Puppeteer... (headless: ${headless})`);
        
        const browserOptions = {
          headless: headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images'
          ],
          timeout: 60000
        };

        if (options.proxy) {
          browserOptions.args.push(`--proxy-server=${options.proxy}`);
          console.log(`🌐 Используем прокси: ${options.proxy}`);
        }

        this.browser = await puppeteer.launch(browserOptions);
        console.log(`✅ Браузер успешно запущен (headless: ${headless})`);

        // Обработчик закрытия браузера
        this.browser.on('disconnected', () => {
          console.log('⚠️ Браузер отключен');
          this.browser = null;
        });

        // Обработчик ошибок браузера
        this.browser.on('error', (error) => {
          console.error('❌ Ошибка браузера:', error);
          this.browser = null;
        });

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
    
    // Проверяем количество аккаунтов
    const accountCount = options.accountData?.length || 0;
    if (accountCount === 0) {
      throw new Error('Нет данных аккаунтов для обработки');
    }
    
    if (accountCount > 1000) {
      console.log(`⚠️ Большое количество аккаунтов (${accountCount}). Используем оптимизированную обработку.`);
    }
    
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

      // Инициализируем токен отмены
      this.cancellationTokens.set(jobId, { cancelled: false });

      // Настраиваем конкурренси
      const desiredConcurrency = Math.max(1, Math.min(8, Number(options.concurrency) || 1));
      this.jobConcurrency.set(jobId, desiredConcurrency);
      console.log(`🧵 Конкурентность для задачи ${jobId}: ${desiredConcurrency}`);

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

  // Явное ожидание появления экрана челенджа и возврат найденного контейнера
  async waitForChallenge(page, timeoutMs = 20000) {
    const start = Date.now();
    const selectors = [
      'div[id*="challenge"]',
      'div[data-challengetype]',
      'input[name="idvAnyPhonePin"]',
      'div[aria-label*="2-Step Verification" i]',
      'form[action*="challenge"]'
    ];
    while (Date.now() - start < timeoutMs) {
      for (const sel of selectors) {
        const el = await page.$(sel);
        if (el) {
          const visible = await page.evaluate(e => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
          }, el).catch(() => false);
          if (visible) return el;
        }
      }
      await page.waitForTimeout(500);
    }
    throw new Error('Экран верификации не появился вовремя');
  }

  async runAutomation(jobId, formConfig, accounts, options) {
    console.log(`🚀 Запуск автоматизации для задачи ${jobId}`);
    console.log(`📊 Количество аккаунтов: ${accounts.length}`);
    console.log(`📝 Конфигурация формы: ${formConfig.title}`);
    // Сводная информация по опциям, без огромных JSON
    console.log(`⚙️ Опции: loginMode=${options.loginMode}, headless=${options.headless !== false}, accounts=${accounts.length}`);
    
    const job = await this.jobModel.getById(jobId);
    if (!job) {
      console.error(`❌ Задача ${jobId} не найдена в базе данных`);
      return;
    }

    console.log(`✅ Задача найдена: ${job.status}`);
    const jobConc = this.jobConcurrency.get(jobId) || 1;

    try {
      // Если конкурренси больше 1 — запускаем пул воркеров с джиттером
      const jobConc = this.jobConcurrency.get(jobId) || 1;
      if (jobConc > 1) {
        console.log(`🧵 Запуск пула воркеров: ${jobConc}`);
        await this.runAutomationWithConcurrency(jobId, formConfig, accounts, options, jobConc);
        // После пула — те же завершающие действия
        const tokenEnd = this.cancellationTokens.get(jobId);
        const finalStatus = tokenEnd && tokenEnd.cancelled ? 'stopped' : 'completed';
        await this.updateJobStatus(jobId, finalStatus);
        await this.jobModel.addLog(jobId, {
          type: finalStatus === 'stopped' ? 'warning' : 'success',
          message: finalStatus === 'stopped' ? `Задача остановлена пользователем` : `Автоматизация завершена. Обработано: ${job.completedAccounts}, Ошибок: ${job.failedAccounts}`
        });
        this.usedProxies.delete(jobId);
        await this.closeJobBrowsers(jobId);
        return;
      }
      // Добавляем лог о начале обработки
      await this.jobModel.addLog(jobId, {
        type: 'info',
        message: 'Начинаем обработку аккаунтов'
      });
      
      // Адаптивный размер пакета в зависимости от количества аккаунтов
      let batchSize = this.batchSize;
      if (accounts.length > 500) {
        batchSize = 5; // Меньшие пакеты для больших объемов
      } else if (accounts.length > 100) {
        batchSize = 8;
      }
      
      const totalBatches = Math.ceil(accounts.length / batchSize);
      console.log(`📦 Обработка ${accounts.length} аккаунтов пакетами по ${batchSize} (всего пакетов: ${totalBatches})`);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Проверка отмены перед началом пакета
        const token = this.cancellationTokens.get(jobId);
        if (token && token.cancelled) {
          console.log(`🛑 Задача ${jobId} отменена перед началом пакета ${batchIndex + 1}`);
          await this.jobModel.addLog(jobId, { type: 'warning', message: `Задача отменена пользователем` });
          break;
        }
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, accounts.length);
        const batch = accounts.slice(startIndex, endIndex);
        
        console.log(`\n📦 === ПАКЕТ ${batchIndex + 1}/${totalBatches} ===`);
        console.log(`📊 Обрабатываем аккаунты ${startIndex + 1}-${endIndex} из ${accounts.length}`);
        console.log(`👥 Аккаунтов в пакете: ${batch.length}`);
        const jobActiveBefore = (this.jobBrowsers.get(jobId)?.size || 0);
        console.log(`🌐 Активных браузеров задачи перед пакетом: ${jobActiveBefore}/${jobConc}`);
        
        // Добавляем лог о начале пакета
        await this.jobModel.addLog(jobId, {
          type: 'info',
          message: `Начинаем обработку пакета ${batchIndex + 1}/${totalBatches} (аккаунты ${startIndex + 1}-${endIndex})`
        });
        
        // Обрабатываем аккаунты в текущем пакете
        for (let i = 0; i < batch.length; i++) {
          const tokenInner = this.cancellationTokens.get(jobId);
          if (tokenInner && tokenInner.cancelled) {
            console.log(`🛑 Задача ${jobId} отменена в процессе обработки пакета`);
            await this.jobModel.addLog(jobId, { type: 'warning', message: `Задача отменена пользователем (в процессе)` });
            break;
          }
          const account = batch[i];
          const globalIndex = startIndex + i;
          
          console.log(`\n🔄 === ИТЕРАЦИЯ ${globalIndex + 1}/${accounts.length} ===`);
          console.log(`👤 Аккаунт: ${account.email}`);
          console.log(`🆔 ID аккаунта: ${account.id}`);
          console.log(`📊 Прогресс: ${globalIndex}/${accounts.length} (${Math.round((globalIndex/accounts.length)*100)}%)`);
          console.log(`📦 Пакет: ${batchIndex + 1}/${totalBatches}, Позиция в пакете: ${i + 1}/${batch.length}`);
          
          console.log(`\n🚀 Начинаем обработку аккаунта ${globalIndex + 1}/${accounts.length}: ${account.email}`);
          console.log(`📊 Всего аккаунтов для обработки: ${accounts.length}`);
          
          // Проверяем количество активных браузеров ТОЛЬКО текущей задачи
          const activeBrowserCount = (this.jobBrowsers.get(jobId)?.size || 0);
          console.log(`🌐 Активных браузеров задачи: ${activeBrowserCount}/${jobConc}`);
          
          // Проверяем, не обрабатывается ли уже этот аккаунт
          if ((this.jobBrowsers.get(jobId)?.has(account.id)) === true) {
            console.log(`⚠️ Аккаунт ${account.id} уже обрабатывается! Пропускаем...`);
            await this.jobModel.addLog(jobId, {
              type: 'warning',
              message: `Аккаунт ${account.email} уже обрабатывается. Пропускаем.`,
              accountId: account.id
            });
            continue; // Переходим к следующему аккаунту
          }
          
          if (activeBrowserCount >= jobConc) {
            console.log(`⏳ Достигнуто максимальное количество браузеров. Ждем освобождения...`);
            await this.jobModel.addLog(jobId, {
              type: 'info',
              message: `Достигнуто максимальное количество браузеров (${jobConc}). Ждем освобождения...`,
              accountId: account.id
            });
            
            // Ждем освобождения браузеров без глобальной зачистки, с увеличивающимся интервалом
            let waitTime = 0;
            const maxWaitTime = 60000; // до 60 секунд
            let interval = 500; // стартовый интервал
            console.log(`⏳ Начинаем ожидание освобождения браузеров...`);
            console.log(`📋 Активные браузеры задачи:`, Array.from(this.jobBrowsers.get(jobId) || []));
            
            while ((this.jobBrowsers.get(jobId)?.size || 0) >= jobConc && waitTime < maxWaitTime) {
              const tokenWait = this.cancellationTokens.get(jobId);
              if (tokenWait && tokenWait.cancelled) {
                console.log(`🛑 Задача ${jobId} отменена во время ожидания слотов браузера`);
                break;
              }
              await this.sleep(interval);
              waitTime += interval;
              interval = Math.min(interval + 500, 3000); // плавное увеличение интервала
              const currentJobActive = (this.jobBrowsers.get(jobId)?.size || 0);
              console.log(`⏳ Ждем освобождения браузеров задачи... (${currentJobActive}/${jobConc}) - ${waitTime}мс`);
            }
            
            if (waitTime >= maxWaitTime) {
              console.log(`⚠️ Таймаут ожидания браузеров (${maxWaitTime}мс). Продолжаем без принудительной очистки.`);
            } else {
              console.log(`✅ Браузеры освободились за ${waitTime}мс`);
            }
          }
          
          // Добавляем лог о начале обработки аккаунта
          await this.jobModel.addLog(jobId, {
            type: 'info',
            message: `Обработка аккаунта ${globalIndex + 1}/${accounts.length}: ${account.email}`,
            accountId: account.id
          });
          
          const result = await this.fillFormForAccountWithProfile(formConfig, account, options, globalIndex, jobId);
          
          // Проверяем, что результат не undefined
          if (!result) {
            console.error(`❌ Метод fillFormForAccountWithProfile вернул undefined для аккаунта ${account.id}`);
            await this.jobModel.addResult(jobId, {
              accountId: account.id,
              accountName: account.name,
              accountEmail: account.email,
              success: false,
              error: 'Метод fillFormForAccountWithProfile вернул undefined',
              submittedAt: new Date().toISOString(),
              filledData: account.fields
            });
            
            // Обновляем счетчик неудачных аккаунтов
            const updatedJob = await this.jobModel.getById(jobId);
            await this.jobModel.update(jobId, {
              failedAccounts: updatedJob.failedAccounts + 1
            });
            
            continue; // Переходим к следующему аккаунту
          }
          
          // Добавляем результат обработки (универсальный для успеха и ошибки)
          await this.jobModel.addResult(jobId, {
            accountId: account.id,
            accountName: account.name,
            accountEmail: account.email,
            success: result.success,
            submittedAt: result.submittedAt || new Date().toISOString(),
            filledData: account.fields,
            skipped: result.skipped || false,
            message: result.message || (result.success ? 'Успешно заполнено' : 'Ошибка заполнения'),
            error: result.error || null
          });
          
          // Обновляем счетчики в зависимости от результата
          const updatedJob = await this.jobModel.getById(jobId);
          if (result.success) {
            await this.jobModel.update(jobId, {
              completedAccounts: updatedJob.completedAccounts + 1
            });
          } else {
            await this.jobModel.update(jobId, {
              failedAccounts: updatedJob.failedAccounts + 1
            });
            
            // Добавляем лог об ошибке
            await this.jobModel.addLog(jobId, {
              type: 'error',
              message: `Ошибка обработки аккаунта ${account.email}: ${result.error || 'Неизвестная ошибка'}`,
              accountId: account.id
            });
          }
          
          // Добавляем лог об успехе
          const logMessage = result.skipped 
            ? `Аккаунт ${account.email} пропущен (форма уже заполнена)`
            : `Аккаунт ${account.email} успешно обработан`;
            
          await this.jobModel.addLog(jobId, {
            type: result.skipped ? 'warning' : 'success',
            message: logMessage,
            accountId: account.id
          });
          
          console.log(`✅ ${logMessage} (${globalIndex + 1}/${accounts.length})`);
          
          // Добавляем лог о задержке между сабмитами
          if (options.delaySettings && options.delaySettings.enabled) {
            const submitDelay = this.calculateSubmitDelay(options.delaySettings, globalIndex);
            if (submitDelay > 0) {
              console.log(`⏳ Задержка между сабмитами: ${submitDelay}мс (${options.delaySettings.type})`);
              await this.jobModel.addLog(jobId, {
                type: 'info',
                message: `Задержка между сабмитами: ${submitDelay}мс (${options.delaySettings.type})`,
                accountId: account.id
              });
              await this.sleep(submitDelay);
              console.log(`✅ Задержка между сабмитами завершена`);
            }
          }

          // Задержка между аккаунтами (кроме последнего в пакете)
          if (i < batch.length - 1) {
            const accountDelay = options.delay || 1000;
            console.log(`⏳ Задержка между аккаунтами: ${accountDelay}мс`);
            await this.jobModel.addLog(jobId, {
              type: 'info',
              message: `Задержка между аккаунтами: ${accountDelay}мс`
            });
            await this.sleep(accountDelay);
            console.log(`✅ Задержка между аккаунтами завершена`);
          }
          
          console.log(`🔄 Завершена обработка аккаунта ${globalIndex + 1}/${accounts.length}. Переходим к следующему...`);
          
          // Принудительно обновляем статус задачи
          await this.jobModel.update(jobId, {
            completedAccounts: globalIndex + 1,
            status: 'running'
          });
          console.log(`📊 Обновлен статус задачи: ${globalIndex + 1}/${accounts.length} завершено`);
          
          console.log(`🔄 === ПЕРЕХОД К СЛЕДУЮЩЕМУ АККАУНТУ ===`);
          console.log(`📊 Текущий индекс: ${i}, Размер пакета: ${batch.length}`);
          console.log(`📊 Следующий аккаунт в пакете: ${i + 1 < batch.length ? 'Да' : 'Нет'}`);
          
          // Очистка памяти после каждого аккаунта (без принудительного закрытия браузеров)
          if (global.gc) {
            global.gc();
            console.log(`🧹 Очистка памяти выполнена`);
          }
          
        
        // Добавляем лог о завершении обработки аккаунта
        console.log(`🏁 Завершена обработка аккаунта ${globalIndex + 1}/${accounts.length}: ${account.email}`);
        console.log(`🔄 === КОНЕЦ ИТЕРАЦИИ ${globalIndex + 1}/${accounts.length} ===`);
      }
      
      console.log(`📦 === КОНЕЦ ПАКЕТА ${batchIndex + 1}/${totalBatches} ===`);
      console.log(`📊 Обработано аккаунтов в пакете: ${batch.length}`);
      
      // Принудительная очистка браузеров ТОЛЬКО текущей задачи
      console.log(`🧹 Очистка браузеров текущего пакета задачи ${jobId}...`);
      try {
        await this.closeJobBrowsers(jobId);
        console.log(`✅ Браузеры задачи ${jobId} закрыты после пакета`);
      } catch (cleanupError) {
        console.error(`❌ Ошибка при очистке браузеров задачи ${jobId}:`, cleanupError);
      }
      
      // Задержка между пакетами (кроме последнего)
      if (batchIndex < totalBatches - 1) {
        console.log(`⏳ Задержка между пакетами: ${this.batchDelay}мс`);
        await this.jobModel.addLog(jobId, {
          type: 'info',
          message: `Задержка между пакетами: ${this.batchDelay}мс`
        });
        await this.sleep(this.batchDelay);
        console.log(`✅ Задержка между пакетами завершена`);
      }
      
      console.log(`📦 Пакет ${batchIndex + 1}/${totalBatches} завершен`);
    }
    
    console.log(`🎉 Все пакеты обработаны! Завершаем задачу...`);
      
      // Определяем финальный статус с учетом отмены
      const tokenEnd = this.cancellationTokens.get(jobId);
      const finalStatus = tokenEnd && tokenEnd.cancelled ? 'stopped' : 'completed';
      await this.updateJobStatus(jobId, finalStatus);
      await this.jobModel.addLog(jobId, {
        type: finalStatus === 'stopped' ? 'warning' : 'success',
        message: finalStatus === 'stopped' ? `Задача остановлена пользователем` : `Автоматизация завершена. Обработано: ${job.completedAccounts}, Ошибок: ${job.failedAccounts}`
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
      
      // Закрываем браузеры только текущей задачи
      console.log(`🔒 Закрываем браузеры задачи ${jobId}...`);
      await this.closeJobBrowsers(jobId);
      console.log(`✅ Браузеры задачи ${jobId} закрыты`);
      
    } catch (error) {
      console.error(`Критическая ошибка в задаче ${jobId}:`, error);
      
      // Закрываем все браузеры в случае ошибки
      try {
        console.log(`🔒 Закрываем браузеры задачи ${jobId} из-за ошибки...`);
        await this.closeJobBrowsers(jobId);
        console.log(`✅ Браузеры задачи ${jobId} закрыты`);
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

  // Новый метод: конкурентная обработка аккаунтов пулом воркеров
  async runAutomationWithConcurrency(jobId, formConfig, accounts, options, concurrency) {
    const queue = accounts.map((account, index) => ({ account, index }));
    let current = 0;

    const worker = async (workerId) => {
      // Джиттер старта воркера, чтобы потоки шли не синхронно
      const startJitter = 500 + Math.floor(Math.random() * 2000);
      console.log(`🧵 Воркер ${workerId} стартует через ${startJitter}мс`);
      await this.sleep(startJitter);

      while (true) {
        // Получаем следующий элемент очереди
        let task;
        if (current < queue.length) {
          task = queue[current++];
        } else {
          break;
        }

        const { account, index } = task;
        const token = this.cancellationTokens.get(jobId);
        if (token && token.cancelled) {
          console.log(`🛑 Воркер ${workerId}: задача отменена, выходим`);
          break;
        }

        try {
          console.log(`🧵 Воркер ${workerId}: начинаю аккаунт ${index + 1}/${accounts.length} (${account.email})`);
          const result = await this.fillFormForAccountWithProfile(formConfig, account, options, index, jobId);

          await this.jobModel.addResult(jobId, {
            accountId: account.id,
            accountName: account.name,
            accountEmail: account.email,
            success: result?.success || false,
            submittedAt: result?.submittedAt || new Date().toISOString(),
            filledData: account.fields,
            skipped: result?.skipped || false,
            message: result?.message || (result?.success ? 'Успешно заполнено' : 'Ошибка заполнения'),
            error: result?.error || null
          });

          const job = await this.jobModel.getById(jobId);
          await this.jobModel.update(jobId, {
            completedAccounts: job.completedAccounts + (result?.success ? 1 : 0),
            failedAccounts: job.failedAccounts + (!result?.success ? 1 : 0)
          });

          const delaySettings = options.delaySettings;
          if (delaySettings && delaySettings.enabled) {
            const submitDelay = this.calculateSubmitDelay(delaySettings, index);
            if (submitDelay > 0) {
              console.log(`🧵 Воркер ${workerId}: задержка после аккаунта ${submitDelay}мс`);
              await this.sleep(submitDelay);
            }
          }

          // Небольшой джиттер между задачами у воркера
          const perWorkerJitter = 200 + Math.floor(Math.random() * 800);
          await this.sleep(perWorkerJitter);
        } catch (err) {
          console.error(`❌ Воркер ${workerId}: ошибка обработки аккаунта ${account.email}:`, err);
          await this.jobModel.addResult(jobId, {
            accountId: account.id,
            accountName: account.name,
            accountEmail: account.email,
            success: false,
            submittedAt: new Date().toISOString(),
            filledData: account.fields,
            skipped: false,
            message: 'Ошибка заполнения',
            error: err.message || String(err)
          });
        }
      }
    };

    // Запускаем воркеры
    const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
    await Promise.all(workers);
  }

  // Закрыть все браузеры, запущенные в рамках конкретной задачи
  async closeJobBrowsers(jobId) {
    try {
      const set = this.jobBrowsers.get(jobId);
      if (!set || set.size === 0) return;
      const ids = Array.from(set);
      for (const accountId of ids) {
        await this.profileManager.closeBrowserForAccount(accountId).catch(() => {});
      }
      set.clear();
    } catch (e) {
      console.log(`⚠️ Ошибка закрытия браузеров для задачи ${jobId}: ${e.message}`);
    }
  }

  async fillFormForAccountWithProfile(formConfig, account, options, accountIndex = 0, jobId = null) {
    let browser = null;
    let page = null;
    // Уникальный ключ профиля: для Google-логина используем реальный ID аккаунта, иначе jobId+локальный id
    const profileKey = (options.loginMode === 'google' && account.googleAccount && account.googleAccount.id)
      ? account.googleAccount.id
      : `${jobId}_${account.id}`;
    
    console.log(`\n🔧 === fillFormForAccountWithProfile START ===`);
    console.log(`👤 Аккаунт: ${account.email} (${account.id})`);
    console.log(`📊 Индекс аккаунта: ${accountIndex}`);
    console.log(`🔐 Режим входа: ${options.loginMode}`);
    
    // Устанавливаем общий таймаут для всей операции: используем Promise.race вместо throw в setTimeout
    const operationMs = 300000; // 5 минут
    let timeoutHandle;
    const withTimeout = (promise) => Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Таймаут операции для аккаунта ${account.email} (превышено ${operationMs}мс)`));
        }, operationMs);
      })
    ]);
    
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
              // Все прокси в группе уже использованы в рамках текущей задачи.
              // Разрешаем повторное использование: сбрасываем счетчик и берем первый доступный (round-robin).
              console.log(`⚠️ Все прокси в группе "${options.selectedProxyGroup}" уже использованы в этой задаче. Перезапускаем цикл использования (round-robin).`);
              usedProxiesForJob.clear();
              this.usedProxies.set(jobId, usedProxiesForJob);

              const fallbackProxy = proxies[0];
              proxySettings = {
                enabled: true,
                type: fallbackProxy.type,
                host: fallbackProxy.host,
                port: fallbackProxy.port,
                username: fallbackProxy.username,
                password: fallbackProxy.password
              };

              // Отмечаем выбранный прокси как использованный после сброса
              usedProxiesForJob.add(fallbackProxy.id);
              this.usedProxies.set(jobId, usedProxiesForJob);
              console.log(`🔁 Повторно используем прокси: ${fallbackProxy.host}:${fallbackProxy.port}`);
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
      console.log(`🌐 Запуск браузера с профилем для ключа: ${profileKey} (аккаунт ${account.id})`);
      // Логи без вывода огромного объекта options (который включает весь список аккаунтов)
      const optionsSummary = `headless=${options.headless !== undefined ? options.headless : false}, loginMode=${options.loginMode || 'anonymous'}, resetProfile=${options.resetProfile === true}, proxyGroup=${options.selectedProxyGroup || 'none'}`;
      console.log(`⚙️ Опции браузера: ${optionsSummary}`);
      console.log(`🔗 Настройки прокси:`, proxySettings ? 'Настроены' : 'Не настроены');
      
      try {
        browser = await withTimeout(this.profileManager.launchBrowserWithProfile(profileKey, options, proxySettings));
        console.log(`✅ Браузер успешно запущен для ключа профиля: ${profileKey}`);
        
        // Добавляем браузер в отслеживание (глобально и для задачи)
        const wasAdded = this.activeBrowsers.add(profileKey);
        const set = this.jobBrowsers.get(jobId) || new Set();
        set.add(profileKey);
        this.jobBrowsers.set(jobId, set);
        console.log(`✅ Браузер добавлен в отслеживание: ${profileKey} (задача ${jobId})`);
        
        // Проверяем соответствие с профиль менеджером
        const profileManagerBrowsers = Array.from(this.profileManager.activeBrowsers.keys());
        console.log(`🔧 Браузеры в профиль менеджере:`, profileManagerBrowsers);
        console.log(`🔍 Соответствие отслеживания: ${JSON.stringify(Array.from(this.activeBrowsers).sort()) === JSON.stringify(profileManagerBrowsers.sort())}`);
      } catch (browserError) {
        console.error(`❌ Ошибка запуска браузера для аккаунта ${account.id}:`, browserError);
        throw browserError;
      }
      
      // Если требуется вход в Google, авторизуемся прежде чем идти на форму
      if ((options.loginMode === 'google')) {
        const loginEmail = (account.googleAccount && account.googleAccount.email) || account.email;
        const loginPassword = (account.googleAccount && account.googleAccount.password) || account.password;
        const backupEmail =
          (account.googleAccount && account.googleAccount.data && account.googleAccount.data.backupEmail) ||
          (account.googleAccount && account.googleAccount.backupEmail) ||
          (account.data && account.data.backupEmail) ||
          account.backupEmail ||
          null;

        if (!loginEmail || !loginPassword) {
          throw new Error('У аккаунта отсутствуют email или пароль для входа в Google');
        }

        console.log(`🔐 Авторизация в Google для аккаунта: ${loginEmail}`);
        await this.ensureLoggedInGoogle(browser, loginEmail, loginPassword, backupEmail);
        console.log('✅ Авторизация в Google успешно выполнена');
      }

      // Заполняем форму
      const result = await withTimeout(this.fillFormForAccount(browser, formConfig, account, options, accountIndex, jobId));
      
      // Проверяем, что результат не undefined
      if (!result) {
        console.error(`❌ Метод fillFormForAccount вернул undefined для аккаунта ${account.id}`);
        return {
          success: false,
          error: 'Метод fillFormForAccount вернул undefined',
          submittedAt: new Date().toISOString()
        };
      }
      
      // Если форма уже была заполнена, браузер уже закрыт в fillFormForAccount
      if (result.skipped) {
        return result;
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Ошибка в fillFormForAccountWithProfile для аккаунта ${account.id}:`, error);
      
      // Возвращаем объект ошибки вместо проброса исключения
      return {
        success: false,
        error: error.message,
        submittedAt: new Date().toISOString()
      };
    } finally {
      // Очищаем таймаут операции
      if (timeoutHandle) clearTimeout(timeoutHandle);
      
      // Принудительно закрываем все браузеры для этого аккаунта
      console.log(`🔒 Принудительно закрываем все браузеры для профиля ${profileKey}...`);
      console.log(`📋 Активные браузеры перед закрытием:`, Array.from(this.activeBrowsers));
      
      try {
        // Закрываем через профиль менеджер
        console.log(`🔧 Закрываем браузер через профиль менеджер...`);
        await this.profileManager.closeBrowserForAccount(profileKey);
        console.log(`✅ Браузер через профиль менеджер закрыт для профиля ${profileKey}`);
        
        // Удаляем браузер из отслеживания
        const wasRemoved = this.activeBrowsers.delete(profileKey);
        const set = this.jobBrowsers.get(jobId);
        if (set) set.delete(profileKey);
        console.log(`🗑️ Браузер ${profileKey} удален из отслеживания (задача ${jobId}): ${wasRemoved}`);
        
        // Проверяем соответствие с профиль менеджером после удаления
        const profileManagerBrowsers = Array.from(this.profileManager.activeBrowsers.keys());
        console.log(`🔧 Браузеры в профиль менеджере после удаления:`, profileManagerBrowsers);
        console.log(`🔍 Соответствие отслеживания после удаления: ${JSON.stringify(Array.from(this.activeBrowsers).sort()) === JSON.stringify(profileManagerBrowsers.sort())}`);
      } catch (closeError) {
        console.error(`❌ Ошибка при закрытии браузера через профиль менеджер:`, closeError);
        // Принудительно удаляем из отслеживания даже при ошибке
        this.activeBrowsers.delete(account.id);
        console.log(`🧹 Принудительно удален браузер ${account.id} из отслеживания`);
      }
      
      // Убираем повторное закрытие: браузер уже закрыт через профиль менеджер
      
      // Принудительная очистка памяти
      if (global.gc) {
        global.gc();
        console.log(`🧹 Принудительная очистка памяти выполнена`);
      }
      
      console.log(`🔧 === fillFormForAccountWithProfile END ===\n`);
    }
  }

  async ensureLoggedInGoogle(browser, email, password, backupEmail = null) {
    const page = await browser.newPage();
    try {
      // Устанавливаем таймауты для страницы
      page.setDefaultTimeout(30000); // 30 секунд
      page.setDefaultNavigationTimeout(60000); // 60 секунд
      
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
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
        nextBtn2.click()
      ]);

      // Небольшая задержка, чтобы страница и фреймы инициализировались
      await page.waitForTimeout(500);
      // Проверяем наличие кнопки подтверждения #confirm сразу после ввода пароля
      await this.handleConfirmButton(page);

      // Даем странице стабилизироваться и ждем явного появления challenge перед попыткой клика
      await page.waitForTimeout(1500);
      const challengeAppeared = await this.waitForChallenge(page, 20000).catch(() => false);
      if (challengeAppeared) {
        console.log('🔒 Обнаружен экран верификации. Переходим к обработке...');
        try {
          await this.handleVerificationChallenges(page, backupEmail);
        } catch (verifErr) {
          console.log(`ℹ️ Не удалось обработать верификацию через резервную почту: ${verifErr.message}`);
        }
      } else {
        console.log('ℹ️ Экран верификации не обнаружен сразу после ввода пароля');
      }

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
        // Проверяем, не требуется ли доп. подтверждение личности (challenge)
        let needChallenge = await page.$('div[id*="challenge"], div[data-challengetype], input[name="idvAnyPhonePin"], div[aria-label*="2-Step Verification"], form[action*="challenge"]');
        if (needChallenge && backupEmail) {
          console.log('🔐 Обнаружен challenge после входа. Пытаемся пройти через резервный email...');
          try {
            await this.handleVerificationChallenges(page, backupEmail);
            // Переоцениваем успешность входа после попытки
            await page.waitForTimeout(1500);
            const stillOnChallenge = await page.$('div[id*="challenge"], div[data-challengetype], form[action*="challenge"]');
            if (!stillOnChallenge) {
              // повторная оценка успешности
              const recheckLoggedIn = await page.evaluate(() => {
                const indicators = [
                  'a[href*="SignOutOptions"]',
                  'a[href*="Logout"]', 
                  'img[alt*="Google Account"]',
                  'a[aria-label*="Google Account"]',
                  'div[aria-label*="Google Account"]',
                  'button[aria-label*="Google Account"]'
                ];
                for (const selector of indicators) {
                  if (document.querySelector(selector)) return true;
                }
                return window.location.href.includes('myaccount.google.com') || 
                       window.location.href.includes('accounts.google.com/b/0/ManageAccount');
              });
              if (recheckLoggedIn) {
                console.log('✅ Успешно прошли challenge через резервный email');
                return;
              }
            }
          } catch (challengeErr) {
            console.log(`⚠️ Не удалось пройти challenge через резервный email: ${challengeErr.message}`);
          }
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
        
        // Если остался challenge и резервной почты нет или не сработало — сообщаем понятнее
        needChallenge = await page.$('div[id*="challenge"], div[data-challengetype], input[name="idvAnyPhonePin"], div[aria-label*="2-Step Verification"]');
        if (needChallenge) {
          if (backupEmail) {
            throw new Error('Не удалось пройти дополнительную проверку личности через резервный email.');
          }
          throw new Error('Требуется дополнительная проверка личности (2FA/Challenge). Укажите резервную почту в аккаунте.');
        }

        throw new Error('Не удалось подтвердить вход в Google. Проверьте данные аккаунта.');
      }

      console.log(`✅ Успешный вход в Google аккаунт: ${email}`);

    } finally {
      await page.close().catch(() => {});
    }
  }

  async fillFormForAccount(browser, formConfig, account, options, accountIndex = 0, jobId = null) {
    const page = await browser.newPage();
    
    try {
      // Устанавливаем таймауты для страницы
      page.setDefaultTimeout(30000); // 30 секунд
      page.setDefaultNavigationTimeout(60000); // 60 секунд
      
      console.log(`\n🚀 Начинаем заполнение формы для аккаунта: ${account.name}`);
      console.log(`📝 URL формы: ${formConfig.url}`);
      
      // Устанавливаем User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Переходим на форму
      console.log('🌐 Переходим на страницу формы...');
      await page.goto(formConfig.url, { waitUntil: 'networkidle2' });
      
      // Проверяем, не заполнена ли уже форма
      console.log('🔍 Проверяем статус формы...');
      const formStatus = await page.evaluate(() => {
        // Проверяем различные индикаторы уже заполненной формы
        const indicators = [
          'div[data-response-id]', // Google Forms показывает ответ
          '.freebirdFormviewerViewResponseConfirmContentContainer', // Контейнер подтверждения
          'div[role="main"] div[data-response-id]', // Основной контент с ответом
          '.freebirdFormviewerViewResponsePageContainer', // Контейнер страницы ответа
          'div[aria-label*="Your response has been recorded"]', // Сообщение о записи ответа
          'div[aria-label*="Ваш ответ был записан"]' // Сообщение на русском
        ];
        
        for (const selector of indicators) {
          const element = document.querySelector(selector);
          if (element) {
            return { filled: true, selector, text: element.textContent?.trim() };
          }
        }
        
        // Проверяем наличие полей ввода
        const inputFields = document.querySelectorAll('input[type="text"], textarea, select, input[type="email"], input[type="number"]');
        return { filled: false, inputFields: inputFields.length };
      });
      
      console.log('📊 Статус формы:', formStatus);
      
      if (formStatus.filled) {
        console.log(`⚠️ Форма уже заполнена! Селектор: ${formStatus.selector}`);
        console.log(`📝 Текст: ${formStatus.text}`);
        
        // Добавляем лог о пропуске
        if (jobId) {
          await this.jobModel.addLog(jobId, {
            type: 'warning',
            message: `Форма уже заполнена для аккаунта ${account.email}. Пропускаем.`,
            accountId: account.id
          });
        }
        
        // Закрываем браузер для этого аккаунта, чтобы освободить ресурсы
        try {
          await browser.close();
          console.log(`🔒 Браузер закрыт для аккаунта ${account.id} (форма уже заполнена)`);
        } catch (closeError) {
          console.log(`⚠️ Ошибка закрытия браузера: ${closeError.message}`);
        }
        
        return {
          success: true,
          submittedAt: new Date().toISOString(),
          message: 'Форма уже была заполнена',
          skipped: true
        };
      }
      
      // Ждем загрузки формы (современные Google Forms могут не иметь стандартной формы)
      console.log('⏳ Ждем загрузки формы...');
      try {
        await page.waitForSelector('form', { timeout: 5000 });
        console.log('✅ Стандартная форма найдена');
      } catch (error) {
        console.log('⚠️ Стандартная форма не найдена, ждем загрузки полей ввода...');
        try {
          await page.waitForSelector('input[type="text"], textarea, select', { timeout: 10000 });
          console.log('✅ Поля ввода найдены');
        } catch (timeoutError) {
          console.log('❌ Таймаут ожидания полей ввода');
          
          // Проверяем, может быть форма уже заполнена
          const currentUrl = page.url();
          console.log(`📍 Текущий URL: ${currentUrl}`);
          
          if (currentUrl.includes('response') || currentUrl.includes('confirm')) {
            console.log('✅ Форма уже заполнена (определено по URL)');
            
            if (jobId) {
              await this.jobModel.addLog(jobId, {
                type: 'warning',
                message: `Форма уже заполнена для аккаунта ${account.email} (определено по URL). Пропускаем.`,
                accountId: account.id
              });
            }
            
            return {
              success: true,
              submittedAt: new Date().toISOString(),
              message: 'Форма уже была заполнена (определено по URL)',
              skipped: true
            };
          }
          
          throw new Error(`Не удалось найти поля ввода на странице формы. URL: ${currentUrl}`);
        }
      }
      
      // Заполняем поля формы
      console.log('📝 Начинаем заполнение полей...');
      for (const field of formConfig.fields) {
        await this.fillField(page, field, account, options, formConfig);
      }
      
      // Опционально: активируем чекбокс "указать мой email в ответе" если он есть
      try {
        if (options && options.loginMode === 'google') {
          const consentEmail = (account && account.email) || '';
          await this.ensureEmailConsentCheckbox(page, consentEmail);
        }
      } catch (consentErr) {
        console.log(`ℹ️ Чекбокс email-согласия не найден или клик не требуется: ${consentErr.message}`);
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
        submittedAt: new Date().toISOString()
      };
      
    } finally {
      try {
        await page.close();
      } catch (closeErr) {
        console.log(`⚠️ Страница уже закрыта или недоступна: ${closeErr.message}`);
      }
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
      
      // ПРОСТАЯ ЛОГИКА: Заполняем поля строго по порядку
      const textFieldsInConfig = formConfig.fields.filter(f => f.type === 'text' || f.type === 'textarea' || f.type === 'email');
      const currentFieldIndex = textFieldsInConfig.indexOf(field);
      
      console.log(`📊 Текстовых полей в конфигурации: ${textFieldsInConfig.length}`);
      console.log(`📊 Индекс текущего поля в текстовых полях: ${currentFieldIndex}`);
      
      // Сначала пробуем найти поле по индексу (самый надежный способ)
      if (currentFieldIndex >= 0) {
        try {
          const googleFormsInputs = await page.$$('input[type="text"], textarea, input[type="email"]');
          console.log(`🔍 Найдено ${googleFormsInputs.length} текстовых полей на странице`);
          
          if (googleFormsInputs.length > currentFieldIndex) {
            const targetInput = googleFormsInputs[currentFieldIndex];
            
            // Проверяем, что поле видимо и не заполнено
            const isVisible = await page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
            }, targetInput);
            
            const isEmpty = await page.evaluate(el => !el.value || el.value.trim() === '', targetInput);
            
            if (isVisible && isEmpty) {
              await targetInput.click();
              await page.waitForTimeout(100); // Небольшая пауза
              await targetInput.type(value, { delay: 50 });
              console.log(`✅ Успешно заполнено поле ${field.title} по индексу ${currentFieldIndex}`);
              filled = true;
            } else {
              console.log(`⚠️ Поле ${currentFieldIndex} не видимо или уже заполнено`);
            }
          }
        } catch (error) {
          console.log(`❌ Ошибка при заполнении по индексу: ${error.message}`);
        }
      }
      
      // Если не получилось по индексу, пробуем резервные селекторы
      if (!filled) {
        console.log(`⚠️ Поиск по индексу не сработал, пробуем резервные селекторы для поля ${field.title}`);
        
        const selectors = [
          selector, // Оригинальный селектор
          'input[aria-label*="' + field.title + '"]', // По aria-label
          'input[placeholder*="' + field.title + '"]', // По placeholder
        ];

        for (const sel of selectors) {
          try {
            const elements = await page.$$(sel);
            if (elements.length > 0) {
              const element = elements[0];
              const isEmpty = await page.evaluate(el => !el.value || el.value.trim() === '', element);
              
              if (isEmpty) {
                await element.click();
                await page.waitForTimeout(100);
                await element.type(value, { delay: 50 });
                console.log(`✅ Успешно заполнено поле ${field.title} селектором: ${sel}`);
                filled = true;
                break;
              }
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
        `input[type="radio"]`,
        // Дополнительные селекторы для современных Google Forms
        `[role="radio"][aria-label="${value}"]`,
        `[role="radio"][data-value="${value}"]`,
        `[role="radio"]`,
        // Селекторы по тексту в span элементах
        `[role="radio"]:has-text("${value}")`,
        `input[type="radio"]:has-text("${value}")`,
        // Селекторы для конкретной структуры Google Forms
        `div[jscontroller="D8e5bc"][role="radio"]`,
        `div.Od2TWd[role="radio"]`
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
              const dataValue = await page.evaluate(el => el.getAttribute('data-value'), element);
              const textContent = await page.evaluate(el => el.textContent, element);
              
              // Для современных Google Forms ищем текст в соседних span элементах
              let spanText = '';
              try {
                const parent = await page.evaluateHandle(el => el.closest('div'), element);
                if (parent) {
                  const textSpan = await parent.$('span.aDTYNe, span.snByac, span.OvPDhc, span.OIC90c, span[dir="auto"]');
                  if (textSpan) {
                    spanText = await page.evaluate(el => el.textContent.trim(), textSpan);
                  }
                }
              } catch (error) {
                // Игнорируем ошибки поиска span
              }
              
              // Проверяем совпадение по значению, aria-label, data-value, тексту или span тексту
              if (elementValue === value || 
                  ariaLabel === value || 
                  dataValue === value ||
                  textContent.trim() === value ||
                  spanText === value) {
                await element.click();
                console.log(`✅ Радио-кнопка "${value}" выбрана (найдена по: ${elementValue === value ? 'value' : ariaLabel === value ? 'aria-label' : dataValue === value ? 'data-value' : spanText === value ? 'span-text' : 'text-content'})`);
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
      
      // Если не удалось найти по селекторам, пробуем найти по тексту на странице
      if (!clicked) {
        try {
          // Ищем все элементы с role="radio" и проверяем их aria-label
          const radioElements = await page.$$('[role="radio"]');
          for (const element of radioElements) {
            const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), element);
            if (ariaLabel && ariaLabel.includes(value)) {
              await element.click();
              console.log(`✅ Радио-кнопка найдена по aria-label: "${ariaLabel}"`);
              clicked = true;
              break;
            }
          }
        } catch (error) {
          console.log(`❌ Поиск по aria-label не сработал: ${error.message}`);
        }
      }
      
      // Если все еще не найдено, пробуем найти по позиции (если есть только одна опция)
      if (!clicked && field.options && field.options.length === 1) {
        try {
          const radioElements = await page.$$('[role="radio"], input[type="radio"]');
          if (radioElements.length === 1) {
            await radioElements[0].click();
            console.log(`✅ Единственная радио-кнопка выбрана`);
            clicked = true;
          }
        } catch (error) {
          console.log(`❌ Поиск единственной радио-кнопки не сработал: ${error.message}`);
        }
      }
      
      if (!clicked) {
        console.log(`❌ Не удалось выбрать радио-кнопку "${value}"`);
        // Дополнительная отладка
        const allRadios = await page.$$('[role="radio"], input[type="radio"]');
        console.log(`Найдено радио-кнопок на странице: ${allRadios.length}`);
        for (let i = 0; i < allRadios.length; i++) {
          const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label'), allRadios[i]);
          const value = await page.evaluate(el => el.value, allRadios[i]);
          console.log(`  Радио-кнопка ${i + 1}: aria-label="${ariaLabel}", value="${value}"`);
        }
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
    console.log(`🔍 Получаем значение для поля: ${field.title} (ID: ${field.id}, Name: ${field.name})`);
    console.log(`📊 Данные аккаунта:`, account.data);
    console.log(`📊 Поля аккаунта:`, account.fields);
    
    // Сначала проверяем пользовательские данные (если есть)
    if (account.fields && account.fields[field.id] !== undefined) {
      console.log(`✅ Найдено значение в account.fields[${field.id}]:`, account.fields[field.id]);
      return account.fields[field.id];
    }
    
    // Ищем значение в данных аккаунта по имени поля
    let value = account.data && account.data[field.name];
    console.log(`🔍 Поиск по field.name (${field.name}):`, value);
    
    // Если значение не найдено, пробуем найти по ID
    if (value === undefined) {
      value = account.data && account.data[field.id];
      console.log(`🔍 Поиск по field.id (${field.id}):`, value);
    }
    
    // Если все еще не найдено, используем значение по умолчанию
    if (value === undefined && field.defaultValue) {
      value = field.defaultValue;
      console.log(`🔍 Используем defaultValue:`, value);
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

  // Включает чекбокс согласия на указание email в ответе, если он присутствует
  async ensureEmailConsentCheckbox(page, accountEmail) {
    // Ищем любой чекбокс, где текст/aria-label содержит подсказки про email/адрес почты
    const keywords = [
      'email', 'e-mail', 'почт', 'электронн', 'mail', 'адрес', 'response', 'ответ'
    ];

    // Ждём рендер чекбоксов чуть-чуть, но не обязательно
    await page.waitForTimeout(500);

    const checkboxHandle = await page.evaluateHandle((kw) => {
      const all = Array.from(document.querySelectorAll('[role="checkbox"], input[type="checkbox"]'));
      for (const el of all) {
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const parentText = (el.parentElement?.textContent || '').toLowerCase();
        const text = aria + ' ' + parentText;
        const hit = kw.some(k => text.includes(k));
        if (hit) {
          return el;
        }
      }
      return null;
    }, keywords);

    if (!checkboxHandle) {
      throw new Error('Чекбокс email-согласия не найден');
    }

    // Проверяем состояние и кликаем при необходимости
    const isChecked = await page.evaluate((el) => {
      const aria = el.getAttribute('aria-checked');
      if (aria === 'true') return true;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked === true;
      return false;
    }, checkboxHandle);

    if (!isChecked) {
      try {
        await checkboxHandle.asElement().click();
        await page.waitForTimeout(300);
        console.log('✅ Активирован чекбокс email-согласия');
      } catch (e) {
        // Фоллбек: попробовать кликнуть по контейнеру
        try {
          const container = await page.evaluateHandle((el) => el.closest('.bzfPab, .wFGF8, .uVccjd, .aiSeRd, .FXLARc, .wGQFbe, .oLlshd') || el, checkboxHandle);
          await container.asElement().click();
          await page.waitForTimeout(300);
          console.log('✅ Активирован чекбокс через контейнер');
        } catch {
          throw new Error('Не удалось кликнуть по чекбоксу email-согласия');
        }
      }
    } else {
      console.log('ℹ️ Чекбокс email-согласия уже активен');
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
      const token = this.cancellationTokens.get(jobId) || { cancelled: false };
      token.cancelled = true;
      this.cancellationTokens.set(jobId, token);
      await this.jobModel.addLog(jobId, {
        type: 'warning',
        message: 'Запрошена остановка задачи пользователем'
      });
      // Закрыть активные браузеры, чтобы быстрее освободить слоты
      try {
        await this.profileManager.closeAllBrowsers();
      } catch (_) {}
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
            // Для радиокнопок с одной опцией всегда выбираем эту опцию
            if (field.type === 'radio' && field.options.length === 1) {
              data[fieldName] = field.options[0].value;
            } else {
              // Для множественных опций выбираем случайную
              const randomOption = field.options[Math.floor(Math.random() * field.options.length)];
              data[fieldName] = randomOption.value;
            }
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

  // Универсальный метод для поиска и нажатия кнопки по тексту и классу
  async findAndClickButtonByText(page, possibleTexts, className = 'VfPpkd-vQzf8d', timeout = 5000) {
    try {
      console.log(`🔍 Ищем кнопку с текстом: ${possibleTexts.join(', ')}`);
      
      // Ждем немного для загрузки страницы
      await page.waitForTimeout(1000);
      
      // Ищем кнопку по тексту и классу
      const button = await page.evaluateHandle((texts, className) => {
        const elements = document.querySelectorAll(`span.${className}`);
        for (const element of elements) {
          const text = element.textContent.trim();
          if (texts.some(possibleText => text.includes(possibleText))) {
            return element;
          }
        }
        return null;
      }, possibleTexts, className);
      
      if (button && await button.asElement()) {
        const buttonText = await page.evaluate(el => el.textContent.trim(), button);
        console.log(`✅ Найдена кнопка: "${buttonText}"`);
        
        // Проверяем, что кнопка видима и кликабельна
        const isVisible = await page.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
        }, button);
        
        if (isVisible) {
          await button.asElement().click();
          await page.waitForTimeout(2000);
          console.log(`✅ Кнопка "${buttonText}" нажата`);
          return true;
        } else {
          console.log(`ℹ️ Кнопка "${buttonText}" найдена, но не видима`);
          return false;
        }
      } else {
        console.log(`ℹ️ Кнопка с текстом ${possibleTexts.join(', ')} не найдена`);
        return false;
      }
    } catch (error) {
      console.log(`ℹ️ Кнопка не найдена или недоступна: ${error.message}`);
      return false;
    }
  }

  // Универсальный метод для обработки кнопки подтверждения #confirm и дополнительных шагов
  async handleConfirmButton(page) {
    try {
      console.log(`🔍 Проверяем наличие кнопки подтверждения #confirm...`);
      
      // Ждем немного, чтобы страница полностью загрузилась
      await page.waitForTimeout(1000);
      
      const confirmButton = await page.$('#confirm');
      if (confirmButton) {
        console.log(`✅ Найдена кнопка подтверждения #confirm, кликаем...`);
        await confirmButton.click();
        await page.waitForTimeout(2000); // Ждем обработки клика
        console.log(`✅ Кнопка подтверждения нажата`);
        
        // Проверяем, не появилась ли кнопка снова (иногда может быть несколько окон)
        await page.waitForTimeout(1000);
        const confirmButtonAgain = await page.$('#confirm');
        if (confirmButtonAgain) {
          console.log(`🔄 Найдена еще одна кнопка подтверждения, кликаем повторно...`);
          await confirmButtonAgain.click();
          await page.waitForTimeout(2000);
          console.log(`✅ Вторая кнопка подтверждения нажата`);
        }
      } else {
        console.log(`ℹ️ Кнопка подтверждения #confirm не найдена`);
      }

      // Дополнительные шаги после ввода пароля (могут встречаться не всегда)
      console.log(`🔄 Проверяем дополнительные шаги авторизации (могут отсутствовать)...`);
      
      // Шаг 1: "Не сейчас" / "Not now" / "Later" (опционально)
      try {
        const notNowClicked = await this.findAndClickButtonByText(page, [
          'Не сейчас', 'Not now', 'Later', 'Позже', 'Не зараз', 'Not right now'
        ]);
        
        if (notNowClicked) {
          console.log(`✅ Шаг "Не сейчас" выполнен`);
          await page.waitForTimeout(2000);
          
          // Шаг 2: "Сохранить" / "Save" / "Сохранить пароль" (опционально)
          try {
            const saveClicked = await this.findAndClickButtonByText(page, [
              'Сохранить', 'Save', 'Сохранить пароль', 'Save password', 'Зберегти'
            ]);
            
            if (saveClicked) {
              console.log(`✅ Шаг "Сохранить" выполнен`);
              await page.waitForTimeout(2000);
              
              // Шаг 3: "Пропустить" / "Skip" / "Пропустить настройки" (опционально)
              try {
                const skipClicked = await this.findAndClickButtonByText(page, [
                  'Пропустить', 'Skip', 'Пропустить настройки', 'Skip setup', 'Пропустити', 'Skip settings'
                ]);
                
                if (skipClicked) {
                  console.log(`✅ Шаг "Пропустить" выполнен`);
                } else {
                  console.log(`ℹ️ Шаг "Пропустить" не найден - это нормально`);
                }
              } catch (skipError) {
                console.log(`ℹ️ Шаг "Пропустить" пропущен: ${skipError.message}`);
              }
            } else {
              console.log(`ℹ️ Шаг "Сохранить" не найден - это нормально`);
            }
          } catch (saveError) {
            console.log(`ℹ️ Шаг "Сохранить" пропущен: ${saveError.message}`);
          }
        } else {
          console.log(`ℹ️ Шаг "Не сейчас" не найден - это нормально`);
        }
      } catch (notNowError) {
        console.log(`ℹ️ Дополнительные шаги авторизации пропущены: ${notNowError.message}`);
      }
      
      console.log(`✅ Процесс авторизации завершен (дополнительные шаги обработаны)`);
      
    } catch (confirmError) {
      console.log(`⚠️ Ошибка при обработке кнопки подтверждения: ${confirmError.message}`);
    }
  }

  // Обработка челенджа верификации личности через резервную почту
  async handleVerificationChallenges(page, backupEmail) {
    // Если резервной почты нет — ничего не делаем
    if (!backupEmail) {
      throw new Error('Резервная почта не задана');
    }

    console.log('🔒 Проверяем необходимость дополнительной верификации...');
    // Ищем блоки challenge
    // Явно ждём появления одного из индикаторов challenge
    const challengeRoot = await this.waitForChallenge(page, 20000);
    if (!challengeRoot) {
      throw new Error('Челендж не обнаружен');
    }

    // Попробуем выбрать опцию проверки по резервному email
    // 1) Явно ищем нужные карточки/варианты: div.VV3oRb[data-action="selectchallenge"][data-challengetype] с дочерним .l5PPKe
    //    и div.l5PPKe[jsname="fmcmS"] во всех фреймах
    let methodChosen = false;
    try {
      const candidateSelectors = [
        'div.VV3oRb[data-action="selectchallenge"][data-challengetype] .l5PPKe',
        'div.VV3oRb[data-action="selectchallenge"][data-challengetype]',
        'div.l5PPKe[jsname="fmcmS"]',
        'div.l5PPKe'
      ];
      const keywordSubstrings = [
        // RU
        'резерв', 'восстанов', 'запасн', 'альтернатив', 'резервн',
        // EN
        'recovery', 'backup', 'alternate', 'alternative',
        // ES
        'respaldo', 'recuperación', 'correo de respaldo',
        // PT/BR
        'recupera', 'alternativo',
        // IT/DE/FR
        'di backup', 'sicherungs', 'sauvegarde', 'récupération',
        // Generic email tokens
        'email', 'e-mail', 'почт'
      ];
      const frames = page.frames();
      for (const frame of frames) {
        for (const sel of candidateSelectors) {
          const elements = await frame.$$(sel);
          for (const el of elements) {
            const text = (await frame.evaluate(e => e.textContent || '', el)).trim().toLowerCase();
            const match = keywordSubstrings.some(k => text.includes(k));
            if (match) {
              const visible = await frame.evaluate(e => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
              }, el).catch(() => false);
              if (visible) {
                // Скроллим в видимую область и кликаем через JS на всякий случай
                await frame.evaluate(e => { e.scrollIntoView({behavior:'auto', block:'center'}); }, el);
                await frame.evaluate(e => { if (e && typeof e.click === 'function') e.click(); }, el).catch(async () => {
                  try { await (await el.asElement()).click(); } catch {}
                });
                methodChosen = true;
                console.log(`✅ Выбран метод верификации по карточке: "${text}"`);
                await page.waitForTimeout(1000);
                break;
              }
            }
          }
          if (methodChosen) break;
        }
        if (methodChosen) break;
      }

      // XPath-фоллбек по подстрокам текста
      if (!methodChosen) {
        const xPaths = [
          "//div[contains(@class,'VV3oRb') and @data-action='selectchallenge']//div[contains(@class,'l5PPKe')]",
          "//div[contains(@class,'l5PPKe') and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'резерв')]",
          "//div[contains(@class,'l5PPKe') and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'backup')]",
          "//div[contains(@class,'l5PPKe') and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'recovery')]"
        ];
        for (const frame of frames) {
          for (const xp of xPaths) {
            const handles = await frame.$x(xp);
            if (handles && handles.length > 0) {
              const el = handles[0];
              try {
                await frame.evaluate(e => { e.scrollIntoView({behavior:'auto', block:'center'}); }, el);
                await frame.evaluate(e => { if (e && typeof e.click === 'function') e.click(); }, el);
                methodChosen = true;
                console.log('✅ Выбран метод верификации по XPath');
                await page.waitForTimeout(1000);
                break;
              } catch {}
            }
          }
          if (methodChosen) break;
        }
      }
    } catch {}

    // 2) Если карточка не найдена, пробуем клик по кнопкам/ссылкам с текстами
    if (!methodChosen) {
      try {
        const clickedMethod = await this.findAndClickButtonByText(page, [
          // RU
          'Подтвердите резервный адрес электронной почты', 'Подтвердить через резервную почту', 'Подтвердить по резервному email',
          // EN
          'Confirm your recovery email', 'Verify with backup email', 'Use your backup email', 'Use backup email', 'Confirm recovery email',
          // ES/IT/DE/FR variations (приблизительные)
          'Confirmar correo de respaldo', 'Correo de respaldo', 'E-mail di backup', 'E-mail alternativo', 'Sicherungs-E-Mail', 'E-mail de récupération'
        ], 'div.l5PPKe[jsname="fmcmS"], button, div[role="button"], .VfPpkd-LgbsSe, a');
        if (clickedMethod) {
          methodChosen = true;
          console.log('✅ Выбран метод верификации по резервной почте (через кнопки)');
          await page.waitForTimeout(1000);
        }
      } catch {}
    }

    // Иногда это радио-инпуты/чипы
    const possibleEmailMethodSelectors = [
      'input[type="radio"][value*="email"]',
      '[data-challengetype*="email"]',
      'div[role="radio"][data-value*="email"]',
      'div[role="button"][data-email-option]'
    ];
    for (const sel of possibleEmailMethodSelectors) {
      const el = await page.$(sel);
      if (el) {
        try { await el.click(); await page.waitForTimeout(800); } catch {}
      }
    }

    // Поле ввода резервной почты — ищем разные варианты
    const emailInputSelectors = [
      'input[type="email"]',
      'input[name*="email"]',
      'input[autocomplete="email"]',
      'input[aria-label*="email" i]',
      'input[aria-label*="почт" i]',
      'input', // на крайний случай
    ];
    let inputFound = null;
    for (const sel of emailInputSelectors) {
      const el = await page.$(sel);
      if (el) {
        const type = await page.evaluate(e => e.getAttribute('type') || '', el);
        const name = await page.evaluate(e => e.getAttribute('name') || '', el);
        const aria = await page.evaluate(e => e.getAttribute('aria-label') || '', el);
        if ((type.toLowerCase() === 'email') || /email|почт/i.test(name + ' ' + aria)) {
          inputFound = el;
          break;
        }
      }
    }

    if (!inputFound) {
      // иногда это поле типа text, попробуем дождаться видимого поля ввода
      try {
        await page.waitForSelector('input[type="email"], input[name*="email"], input[autocomplete="email"], input[type="text"]', { visible: true, timeout: 10000 });
        inputFound = await page.$('input[type="email"], input[name*="email"], input[autocomplete="email"], input[type="text"]');
      } catch {}
    }

    if (!inputFound) {
      throw new Error('Поле ввода резервной почты не найдено');
    }

    // Вводим резервную почту
    await inputFound.click({ clickCount: 3 });
    await page.type('input:focus', String(backupEmail), { delay: 80 });

    // Ищем кнопку Далее/Подтвердить
    const nextTexts = ['Далее', 'Next', 'Continue', 'Продолжить', 'Confirm', 'Подтвердить', 'Submit'];
    const clickedNext = await this.findAndClickButtonByText(page, nextTexts);
    if (!clickedNext) {
      // Пробуем стандартный селектор
      const nextBtn = await page.$('#next, #submit, button[type="submit"], #passwordNext, #idvPreregisteredEmailNext');
      if (nextBtn) {
        await nextBtn.click();
      } else {
        // Попробуем нажать Enter на поле
        try { await page.keyboard.press('Enter'); } catch {}
        await page.waitForTimeout(800);
        const stillHere = await page.$('input[type="email"], input[name*="email"], input[autocomplete="email"]').catch(() => null);
        if (stillHere) {
          throw new Error('Кнопка продолжения после ввода резервной почты не найдена');
        }
      }
    }

    // Ждем возможной навигации/перехода шага
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.waitForTimeout(1500)
    ]);

    // Возможен дополнительный подтверждающий шаг — снова попробуем нажать подтверждение
    await this.handleConfirmButton(page);

    console.log('✅ Попытка прохождения верификации через резервную почту завершена');
  }
}

module.exports = FormAutomator;
