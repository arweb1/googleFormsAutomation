const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const formRoutes = require('./routes/formRoutes');
const accountRoutes = require('./routes/accountRoutes');
const automationRoutes = require('./routes/automationRoutes');
const dataRoutes = require('./routes/dataRoutes');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/forms', formRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/data', dataRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Socket.IO для real-time обновлений
io.on('connection', (socket) => {
  logger.info(`Клиент подключен: ${socket.id}`);
  
  socket.on('join-room', (room) => {
    socket.join(room);
    logger.info(`Клиент ${socket.id} присоединился к комнате ${room}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Клиент отключен: ${socket.id}`);
  });
});

// Глобальный объект для передачи io в роуты
app.set('io', io);

// Обработка ошибок
app.use((err, req, res, next) => {
  logger.error('Ошибка сервера:', err);
  res.status(500).json({ 
    error: 'Внутренняя ошибка сервера',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Что-то пошло не так'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Эндпоинт не найден' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  logger.info(`🚀 Сервер запущен на порту ${PORT}`);
  logger.info(`📱 Frontend: http://localhost:3000`);
  logger.info(`🔧 API: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Получен SIGTERM, завершение работы...');
  server.close(() => {
    logger.info('Сервер остановлен');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Получен SIGINT, завершение работы...');
  server.close(() => {
    logger.info('Сервер остановлен');
    process.exit(0);
  });
});

module.exports = { app, server, io };
