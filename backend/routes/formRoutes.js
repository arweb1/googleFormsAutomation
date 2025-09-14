const express = require('express');
const router = express.Router();
const FormAnalyzer = require('../services/FormAnalyzer');
const FormController = require('../controllers/FormController');
const logger = require('../utils/logger');

// Анализ формы по URL
router.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL формы обязателен' });
    }

    logger.info(`Анализ формы: ${url}`);
    
    const analyzer = new FormAnalyzer();
    const formConfig = await analyzer.analyzeForm(url);
    
    // Отправляем обновление через WebSocket
    const io = req.app.get('io');
    io.emit('form-analyzed', { formConfig });
    
    res.json({
      success: true,
      formConfig,
      message: `Форма проанализирована. Найдено ${formConfig.fields.length} полей`
    });
    
  } catch (error) {
    logger.error('Ошибка при анализе формы:', error);
    res.status(500).json({ 
      error: 'Ошибка при анализе формы',
      message: error.message 
    });
  }
});

// Сохранение конфигурации формы
router.post('/save', async (req, res) => {
  try {
    const { formConfig } = req.body;
    
    if (!formConfig) {
      return res.status(400).json({ error: 'Конфигурация формы обязательна' });
    }

    const result = await FormController.saveForm(formConfig);
    
    res.json({
      success: true,
      form: result,
      message: 'Форма сохранена успешно'
    });
    
  } catch (error) {
    logger.error('Ошибка при сохранении формы:', error);
    res.status(500).json({ 
      error: 'Ошибка при сохранении формы',
      message: error.message 
    });
  }
});

// Получение списка форм
router.get('/', async (req, res) => {
  try {
    const forms = await FormController.getForms();
    res.json({ success: true, forms });
  } catch (error) {
    logger.error('Ошибка при получении форм:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении форм',
      message: error.message 
    });
  }
});

// Получение формы по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const form = await FormController.getForm(id);
    
    if (!form) {
      return res.status(404).json({ error: 'Форма не найдена' });
    }
    
    res.json({ success: true, form });
  } catch (error) {
    logger.error('Ошибка при получении формы:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении формы',
      message: error.message 
    });
  }
});

// Удаление формы
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await FormController.deleteForm(id);
    
    res.json({ 
      success: true, 
      message: 'Форма удалена успешно' 
    });
  } catch (error) {
    logger.error('Ошибка при удалении формы:', error);
    res.status(500).json({ 
      error: 'Ошибка при удалении формы',
      message: error.message 
    });
  }
});

// Генерация шаблона данных
router.post('/:id/template', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'csv' } = req.body;
    
    const form = await FormController.getForm(id);
    if (!form) {
      return res.status(404).json({ error: 'Форма не найдена' });
    }
    
    const templatePath = await FormController.generateDataTemplate(form, format);
    
    res.json({
      success: true,
      templatePath,
      message: 'Шаблон данных создан'
    });
    
  } catch (error) {
    logger.error('Ошибка при создании шаблона:', error);
    res.status(500).json({ 
      error: 'Ошибка при создании шаблона',
      message: error.message 
    });
  }
});

module.exports = router;
