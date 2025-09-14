const express = require('express');
const router = express.Router();
const FormAnalyzer = require('../services/FormAnalyzer');
const FormConfig = require('../models/FormConfig');

// Анализ формы по URL
router.post('/analyze', async (req, res) => {
  try {
    const { formUrl } = req.body;
    
    if (!formUrl) {
      return res.status(400).json({ error: 'URL формы обязателен' });
    }

    const analyzer = new FormAnalyzer();
    const formData = await analyzer.analyzeForm(formUrl);
    
    res.json({
      success: true,
      data: formData
    });
  } catch (error) {
    console.error('Ошибка анализа формы:', error);
    res.status(500).json({ 
      error: 'Ошибка при анализе формы',
      details: error.message 
    });
  }
});

// Сохранение конфигурации формы
router.post('/config', async (req, res) => {
  try {
    const configData = req.body;
    const config = new FormConfig(configData);
    await config.save();
    
    res.json({
      success: true,
      message: 'Конфигурация формы сохранена',
      configId: config.id
    });
  } catch (error) {
    console.error('Ошибка сохранения конфигурации:', error);
    res.status(500).json({ 
      error: 'Ошибка при сохранении конфигурации',
      details: error.message 
    });
  }
});

// Получение всех конфигураций
router.get('/configs', async (req, res) => {
  try {
    const configs = await FormConfig.getAll();
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Ошибка получения конфигураций:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении конфигураций',
      details: error.message 
    });
  }
});

// Получение конфигурации по ID
router.get('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const config = await FormConfig.getById(id);
    
    if (!config) {
      return res.status(404).json({ error: 'Конфигурация не найдена' });
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Ошибка получения конфигурации:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении конфигурации',
      details: error.message 
    });
  }
});

// Удаление конфигурации по ID
router.delete('/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await FormConfig.deleteById(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Конфигурация не найдена' });
    }
    
    res.json({
      success: true,
      message: 'Конфигурация удалена'
    });
  } catch (error) {
    console.error('Ошибка удаления конфигурации:', error);
    res.status(500).json({ 
      error: 'Ошибка при удалении конфигурации',
      details: error.message 
    });
  }
});

module.exports = router;
