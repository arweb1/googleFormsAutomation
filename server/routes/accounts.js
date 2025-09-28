const express = require('express');
const router = express.Router();
const AccountManager = require('../services/AccountManager');

// Загрузка аккаунтов из CSV
router.post('/upload', async (req, res) => {
  try {
    const { accounts } = req.body;
    
    if (!accounts || !Array.isArray(accounts)) {
      return res.status(400).json({ error: 'Данные аккаунтов обязательны' });
    }

    const accountManager = new AccountManager();
    const result = await accountManager.uploadAccounts(accounts);
    
    res.json({
      success: true,
      message: `Загружено ${result.count} аккаунтов`,
      data: result
    });
  } catch (error) {
    console.error('Ошибка загрузки аккаунтов:', error);
    res.status(500).json({ 
      error: 'Ошибка при загрузке аккаунтов',
      details: error.message 
    });
  }
});

// Получение всех аккаунтов
router.get('/', async (req, res) => {
  try {
    const accountManager = new AccountManager();
    const accounts = await accountManager.getAllAccounts();
    
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Ошибка получения аккаунтов:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении аккаунтов',
      details: error.message 
    });
  }
});

// Удаление всех аккаунтов (важно объявлять ДО маршрута с :id)
router.delete('/all', async (req, res) => {
  try {
    const accountManager = new AccountManager();
    await accountManager.deleteAllAccounts();
    res.json({ success: true, message: 'Все аккаунты удалены' });
  } catch (error) {
    console.error('Ошибка удаления всех аккаунтов:', error);
    res.status(500).json({ 
      error: 'Ошибка при удалении всех аккаунтов',
      details: error.message 
    });
  }
});

// Получение аккаунта по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const accountManager = new AccountManager();
    const account = await accountManager.getAccountById(id);
    
    if (!account) {
      return res.status(404).json({ error: 'Аккаунт не найден' });
    }
    
    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    console.error('Ошибка получения аккаунта:', error);
    res.status(500).json({ 
      error: 'Ошибка при получении аккаунта',
      details: error.message 
    });
  }
});

// Обновление аккаунта
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const accountManager = new AccountManager();
    const account = await accountManager.updateAccount(id, updateData);
    
    res.json({
      success: true,
      message: 'Аккаунт обновлен',
      data: account
    });
  } catch (error) {
    console.error('Ошибка обновления аккаунта:', error);
    res.status(500).json({ 
      error: 'Ошибка при обновлении аккаунта',
      details: error.message 
    });
  }
});

// Удаление аккаунта
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const accountManager = new AccountManager();
    await accountManager.deleteAccount(id);
    
    res.json({
      success: true,
      message: 'Аккаунт удален'
    });
  } catch (error) {
    console.error('Ошибка удаления аккаунта:', error);
    res.status(500).json({ 
      error: 'Ошибка при удалении аккаунта',
      details: error.message 
    });
  }
});

module.exports = router;
