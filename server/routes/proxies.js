const express = require('express');
const router = express.Router();
const Proxy = require('../models/Proxy');

// GET /api/proxies - Получить все прокси
router.get('/', async (req, res) => {
  try {
    const proxies = await Proxy.getAll();
    res.json({
      success: true,
      data: proxies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/proxies/groups - Получить все группы прокси
router.get('/groups', async (req, res) => {
  try {
    const groups = await Proxy.getGroups();
    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/proxies/group/:group - Получить прокси по группе
router.get('/group/:group', async (req, res) => {
  try {
    const { group } = req.params;
    const proxies = await Proxy.getByGroup(group);
    res.json({
      success: true,
      data: proxies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/proxies/:id - Получить прокси по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const proxy = await Proxy.getById(id);
    
    if (!proxy) {
      return res.status(404).json({
        success: false,
        error: 'Прокси не найден'
      });
    }
    
    res.json({
      success: true,
      data: proxy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/proxies - Создать новый прокси
router.post('/', async (req, res) => {
  try {
    const proxyData = req.body;
    const proxy = new Proxy(proxyData);
    
    const validation = proxy.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: validation.errors
      });
    }
    
    await proxy.save();
    
    res.status(201).json({
      success: true,
      data: proxy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/proxies/bulk - Создать несколько прокси из строк
router.post('/bulk', async (req, res) => {
  try {
    const { proxyStrings, group, type, ...otherOptions } = req.body;
    
    if (!Array.isArray(proxyStrings) || proxyStrings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо предоставить массив строк прокси'
      });
    }
    
    // Объединяем параметры в options
    const options = {
      group: group || 'default',
      type: type || 'http',
      ...otherOptions
    };
    
    const proxies = await Proxy.bulkCreate(proxyStrings, options);
    
    res.status(201).json({
      success: true,
      data: proxies,
      message: `Создано ${proxies.length} прокси`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PUT /api/proxies/:id - Обновить прокси
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const proxy = await Proxy.getById(id);
    if (!proxy) {
      return res.status(404).json({
        success: false,
        error: 'Прокси не найден'
      });
    }
    
    // Обновляем данные
    Object.assign(proxy, updateData);
    proxy.updatedAt = new Date().toISOString();
    
    const validation = proxy.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: validation.errors
      });
    }
    
    await proxy.save();
    
    res.json({
      success: true,
      data: proxy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/proxies/:id - Удалить прокси
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Proxy.deleteById(id);
    
    res.json({
      success: true,
      message: 'Прокси удален'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/proxies/group/:group - Удалить группу прокси
router.delete('/group/:group', async (req, res) => {
  try {
    const { group } = req.params;
    await Proxy.deleteByGroup(group);
    
    res.json({
      success: true,
      message: `Группа прокси "${group}" удалена`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
