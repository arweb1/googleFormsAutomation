const express = require('express');
const router = express.Router();
const FormAutomator = require('../services/FormAutomator');

// Запуск автоматического заполнения
router.post('/start', async (req, res) => {
  try {
    const { formConfigId, accountIds, options = {} } = req.body;
    
    // Проверяем режим работы
    if (!formConfigId) {
      return res.status(400).json({ 
        error: 'ID конфигурации формы обязателен' 
      });
    }
    
    if (!options.accountData || !Array.isArray(options.accountData) || options.accountData.length === 0) {
      return res.status(400).json({ 
        error: 'Данные аккаунтов обязательны' 
      });
    }
    
    if (options.loginMode === 'google' && (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0)) {
      return res.status(400).json({ 
        error: 'Для режима с логином Google необходимо выбрать аккаунты' 
      });
    }

    const automator = new FormAutomator();
    const jobId = await automator.startAutomation(formConfigId, accountIds, options);
    
    res.json({
      success: true,
      message: `Заполнение запущено (${options.accountData.length} аккаунтов, ${options.loginMode === 'google' ? 'с логином Google' : 'анонимно'})`,
      jobId: jobId
    });
  } catch (error) {
    console.error('Ошибка запуска автоматизации:', error);
    res.status(500).json({ 
      error: 'Ошибка при запуске автоматизации',
      details: error.message 
    });
  }
});

// Получение статуса задачи
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const automator = new FormAutomator();
    const status = await automator.getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Ошибка получения статуса:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении статуса задачи',
      details: error.message 
    });
  }
});

// Остановка задачи
router.post('/stop/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const automator = new FormAutomator();
    await automator.stopJob(jobId);
    
    res.json({
      success: true,
      message: 'Задача остановлена'
    });
  } catch (error) {
    console.error('Ошибка остановки задачи:', error);
    res.status(500).json({ 
      error: 'Ошибка при остановке задачи',
      details: error.message 
    });
  }
});

// Получение результатов
router.get('/results/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const automator = new FormAutomator();
    const results = await automator.getJobResults(jobId);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Ошибка получения результатов:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении результатов',
      details: error.message 
    });
  }
});

// Получение всех активных задач
router.get('/jobs', async (req, res) => {
  try {
    const automator = new FormAutomator();
    const jobs = await automator.getAllJobs();
    
    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    console.error('Ошибка получения задач:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении задач',
      details: error.message 
    });
  }
});

module.exports = router;
