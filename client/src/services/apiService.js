import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерцептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    
    if (error.response) {
      // Сервер ответил с кодом ошибки
      const message = error.response.data?.error || error.response.data?.message || 'Произошла ошибка сервера';
      return Promise.reject(new Error(message));
    } else if (error.request) {
      // Запрос был отправлен, но ответа не получено
      return Promise.reject(new Error('Сервер недоступен. Проверьте подключение.'));
    } else {
      // Что-то пошло не так при настройке запроса
      return Promise.reject(new Error('Ошибка настройки запроса'));
    }
  }
);

export const apiService = {
  // Forms API
  forms: {
    analyze: (formUrl) => api.post('/forms/analyze', { formUrl }),
    getConfigs: () => api.get('/forms/configs'),
    getConfig: (id) => api.get(`/forms/config/${id}`),
    saveConfig: (config) => api.post('/forms/config', config),
    updateConfig: (id, config) => api.put(`/forms/config/${id}`, config),
    deleteConfig: (id) => api.delete(`/forms/config/${id}`),
  },

  // Accounts API
  accounts: {
    getAll: () => api.get('/accounts'),
    getById: (id) => api.get(`/accounts/${id}`),
    upload: (accounts) => api.post('/accounts/upload', { accounts }),
    update: (id, data) => api.put(`/accounts/${id}`, data),
    delete: (id) => api.delete(`/accounts/${id}`),
  },

  // Automation API
  automation: {
    start: (formConfigId, accountIds, options) => 
      api.post('/automation/start', { formConfigId, accountIds, options }),
    getStatus: (jobId) => api.get(`/automation/status/${jobId}`),
    stop: (jobId) => api.post(`/automation/stop/${jobId}`),
    getResults: (jobId) => api.get(`/automation/results/${jobId}`),
    getAllJobs: () => api.get('/automation/jobs'),
  },

  // Общие методы
  get: (url) => api.get(url),
  post: (url, data) => api.post(url, data),
  put: (url, data) => api.put(url, data),
  delete: (url) => api.delete(url),
};

export default apiService;
