# Google Forms Automator

🚀 **Универсальный веб-софт для автоматического заполнения Google Forms**

Современное React приложение с Express.js бэкендом для автоматизации заполнения любых Google Forms с поддержкой множественных аккаунтов.

## ✨ Возможности

- 🔍 **Автоматический анализ форм** - просто вставьте ссылку, система сама определит структуру
- 📊 **Красивый веб-интерфейс** - современный React UI с Ant Design
- 👥 **Управление аккаунтами** - поддержка множественных Google аккаунтов
- 📁 **Импорт данных** - загрузка CSV/JSON файлов с данными для заполнения
- 🤖 **Автоматизация** - планировщик задач и мониторинг в реальном времени
- 📈 **Статистика** - детальная аналитика и отчеты
- 🔄 **Ротация** - автоматическая смена User-Agent и прокси

## 🏗️ Архитектура

```
├── frontend/          # React приложение
│   ├── src/
│   │   ├── components/    # React компоненты
│   │   ├── pages/         # Страницы приложения
│   │   ├── services/      # API сервисы
│   │   └── utils/         # Утилиты
├── backend/           # Express.js сервер
│   ├── routes/        # API маршруты
│   ├── controllers/   # Контроллеры
│   ├── services/      # Бизнес-логика
│   └── utils/         # Утилиты
└── src/              # Общая логика (legacy)
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
# Установка всех зависимостей
npm run install-all
```

### 2. Настройка окружения

```bash
# Скопируйте файл окружения
cp env.example .env

# Отредактируйте настройки
nano .env
```

### 3. Запуск в режиме разработки

```bash
# Запуск frontend и backend одновременно
npm run dev
```

Приложение будет доступно по адресам:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### 4. Сборка для продакшена

```bash
# Сборка frontend
npm run build

# Запуск продакшен сервера
npm start
```

## 📖 Использование

### 1. Анализ формы
1. Перейдите в раздел "Формы"
2. Нажмите "Анализировать форму"
3. Вставьте ссылку на Google Form
4. Система автоматически определит все поля

### 2. Подготовка данных
1. Скачайте шаблон CSV
2. Заполните данными для заполнения
3. Загрузите файл обратно в систему

### 3. Настройка аккаунтов
1. Перейдите в "Аккаунты"
2. Добавьте Google аккаунты
3. Настройте cookies и User-Agent

### 4. Запуск автоматизации
1. Выберите форму и аккаунты
2. Настройте параметры
3. Запустите автоматизацию

## 🛠️ Технологии

### Frontend
- **React 18** - современный UI фреймворк
- **Ant Design** - компоненты интерфейса
- **React Router** - маршрутизация
- **Recharts** - графики и диаграммы
- **Axios** - HTTP клиент

### Backend
- **Express.js** - веб-сервер
- **Puppeteer** - автоматизация браузера
- **Socket.IO** - real-time обновления
- **Winston** - логирование
- **Multer** - загрузка файлов

## 📁 Структура проекта

```
googleForms/
├── frontend/                 # React приложение
│   ├── public/               # Статические файлы
│   ├── src/
│   │   ├── components/       # React компоненты
│   │   │   └── Layout/       # Основной макет
│   │   ├── pages/           # Страницы
│   │   │   ├── Dashboard/    # Главная страница
│   │   │   ├── Forms/       # Управление формами
│   │   │   ├── Accounts/    # Управление аккаунтами
│   │   │   └── Automation/  # Автоматизация
│   │   ├── services/        # API сервисы
│   │   └── utils/           # Утилиты
│   └── package.json
├── backend/                 # Express.js сервер
│   ├── routes/              # API маршруты
│   ├── controllers/         # Контроллеры
│   ├── services/            # Бизнес-логика
│   ├── middleware/          # Middleware
│   ├── utils/               # Утилиты
│   └── package.json
├── config/                  # Конфигурационные файлы
├── logs/                    # Логи
├── uploads/                 # Загруженные файлы
└── package.json             # Корневой package.json
```

## 🔧 API Endpoints

### Forms
- `POST /api/forms/analyze` - Анализ формы
- `GET /api/forms` - Список форм
- `POST /api/forms/save` - Сохранение формы
- `DELETE /api/forms/:id` - Удаление формы

### Accounts
- `GET /api/accounts` - Список аккаунтов
- `POST /api/accounts` - Добавление аккаунта
- `PUT /api/accounts/:id` - Обновление аккаунта
- `DELETE /api/accounts/:id` - Удаление аккаунта

### Automation
- `POST /api/automation/start` - Запуск автоматизации
- `GET /api/automation/status` - Статус автоматизации
- `POST /api/automation/stop` - Остановка автоматизации

## 🚀 Развертывание

### Docker (рекомендуется)

```bash
# Сборка образа
docker build -t google-forms-automator .

# Запуск контейнера
docker run -p 3000:3000 -p 3001:3001 google-forms-automator
```

### PM2

```bash
# Установка PM2
npm install -g pm2

# Запуск приложения
pm2 start ecosystem.config.js
```

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature ветку (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в ветку (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 🆘 Поддержка

Если у вас есть вопросы или проблемы:

1. Проверьте [Issues](https://github.com/your-repo/issues)
2. Создайте новый Issue
3. Опишите проблему подробно

## 🔮 Планы развития

- [ ] Поддержка других платформ форм (Typeform, JotForm)
- [ ] Интеграция с базами данных
- [ ] Расширенная аналитика
- [ ] API для интеграции с другими системами
- [ ] Мобильное приложение

---

**Сделано с ❤️ для автоматизации рутинных задач**