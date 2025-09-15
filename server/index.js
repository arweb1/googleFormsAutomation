const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Routes
app.use('/api/forms', require('./routes/forms'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/automation', require('./routes/automation'));
app.use('/api/notifications', require('./routes/notifications'));

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Клиент доступен по адресу: http://localhost:${PORT}`);
});
