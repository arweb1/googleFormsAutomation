const express = require('express');
const router = express.Router();

// Хранилище уведомлений (в реальном приложении это должно быть в базе данных)
let notifications = [];
let notificationId = 1;

// Получить все уведомления
router.get('/', (req, res) => {
  res.json({ notifications });
});

// Создать новое уведомление
router.post('/', (req, res) => {
  const { type, message, sound = true } = req.body;
  
  const notification = {
    id: notificationId++,
    type,
    message,
    sound,
    timestamp: new Date().toISOString(),
    read: false
  };
  
  notifications.push(notification);
  
  // Ограничиваем количество уведомлений (храним только последние 50)
  if (notifications.length > 50) {
    notifications = notifications.slice(-50);
  }
  
  res.json({ success: true, notification });
});

// Отметить уведомление как прочитанное
router.put('/:id/read', (req, res) => {
  const { id } = req.params;
  const notification = notifications.find(n => n.id === parseInt(id));
  
  if (notification) {
    notification.read = true;
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Уведомление не найдено' });
  }
});

// Удалить уведомление
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = notifications.findIndex(n => n.id === parseInt(id));
  
  if (index !== -1) {
    notifications.splice(index, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Уведомление не найдено' });
  }
});

// Очистить все уведомления
router.delete('/', (req, res) => {
  notifications = [];
  res.json({ success: true });
});

module.exports = router;
