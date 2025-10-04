import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';
import AutomationProgress from '../components/AutomationProgress';
import AccountDataEditor from '../components/AccountDataEditor';
import FieldRenderer from '../components/FieldRenderer';

const Automation = () => {
  const [forms, setForms] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [proxyGroups, setProxyGroups] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [jobLogs, setJobLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [selectedProxyGroup, setSelectedProxyGroup] = useState('');
  const [loginMode, setLoginMode] = useState('anonymous'); // 'google' или 'anonymous'
  const [accountData, setAccountData] = useState([]);
  const [options, setOptions] = useState({
    delay: 1000,
    submit: true,
    headless: false,
    concurrency: 1
  });
  
  
  // Настройки задержки между сабмитами
  const [delaySettings, setDelaySettings] = useState({
    enabled: true,
    type: 'random', // 'fixed', 'random', 'progressive'
    minDelay: 2000, // минимальная задержка в мс
    maxDelay: 5000, // максимальная задержка в мс
    fixedDelay: 3000, // фиксированная задержка в мс
    progressiveMultiplier: 1.5 // множитель для прогрессивной задержки
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [openOptions, setOpenOptions] = useState(false);
  const [openAccountEditor, setOpenAccountEditor] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadJobs, 5000); // Обновляем каждые 5 секунд
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [formsResponse, accountsResponse, proxyGroupsResponse, jobsResponse] = await Promise.all([
        apiService.forms.getConfigs(),
        apiService.accounts.getAll(),
        apiService.proxies.getGroups(),
        apiService.automation.getAllJobs()
      ]);
      
      setForms(formsResponse.data.data || []);
      setAccounts(accountsResponse.data.data || []);
      setProxyGroups(proxyGroupsResponse.data.data || []);
      setJobs(jobsResponse.data.data || []);
    } catch (error) {
      setError('Ошибка загрузки данных: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      const response = await apiService.automation.getAllJobs();
      setJobs(response.data.data || []);
    } catch (error) {
      console.error('Ошибка загрузки задач:', error);
    }
  };

  const initializeAccountData = (formId, count = 1) => {
    const form = forms.find(f => f.id === formId);
    if (!form || !form.fields) return;

    const data = [];
    for (let i = 0; i < count; i++) {
      const accountDataItem = {
        id: `account_${i + 1}`,
        name: `Аккаунт ${i + 1}`,
        fields: {}
      };

      // Инициализируем поля формы
      form.fields.forEach(field => {
        accountDataItem.fields[field.id] = '';
      });

      data.push(accountDataItem);
    }

    setAccountData(data);
  };

  const updateAccountField = (accountIndex, fieldId, value) => {
    const newAccountData = [...accountData];
    
    // Находим поле для определения типа
    const form = forms.find(f => f.id === selectedForm);
    const field = form?.fields?.find(f => f.id === fieldId);
    
    // Обрабатываем значение в зависимости от типа поля
    let processedValue = value;
    if (field) {
      switch (field.type) {
        case 'checkbox':
          processedValue = Boolean(value);
          break;
        case 'number':
          processedValue = isNaN(Number(value)) ? value : Number(value);
          break;
        case 'radio':
        case 'select':
          processedValue = String(value);
          break;
        default:
          processedValue = String(value);
      }
    }
    
    newAccountData[accountIndex].fields[fieldId] = processedValue;
    setAccountData(newAccountData);
  };

  const generateCsvTemplate = () => {
    const form = forms.find(f => f.id === selectedForm);
    if (!form || !form.fields) {
      setError('Выберите форму для генерации шаблона');
      return;
    }

    // Создаем заголовки CSV на основе полей формы
    const headers = ['account_name', ...form.fields.map(field => field.title || field.id)];
    
    // Создаем примеры данных с учетом типов полей
    const exampleRows = [
      ['Аккаунт 1', ...form.fields.map(field => {
        switch (field.type) {
          case 'checkbox':
            return 'true'; // Чекбоксы: true/false
          case 'radio':
            return field.options[0]?.value || 'option1'; // Радиокнопки: значение опции
          case 'select':
            return field.options[0]?.value || 'option1'; // Выпадающие списки: значение опции
          case 'email':
            return 'example@email.com';
          case 'number':
            return '123';
          case 'date':
            return '2024-01-01';
          case 'textarea':
            return 'Пример текста';
          default:
            return `Пример_${field.title || field.id}`;
        }
      })],
      ['Аккаунт 2', ...form.fields.map(field => {
        switch (field.type) {
          case 'checkbox':
            return 'false';
          case 'radio':
            return field.options[1]?.value || 'option2';
          case 'select':
            return field.options[1]?.value || 'option2';
          case 'email':
            return 'example2@email.com';
          case 'number':
            return '456';
          case 'date':
            return '2024-01-02';
          case 'textarea':
            return 'Пример текста 2';
          default:
            return `Пример_${field.title || field.id}_2`;
        }
      })]
    ];

    // Генерируем CSV содержимое
    const csvContent = [
      headers.join(','),
      ...exampleRows.map(row => row.join(','))
    ].join('\n');

    // Создаем и скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `template_${form.title || 'form'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const lines = csvText.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            data.push(row);
          }
        }
        
        // Автоматически создаем аккаунты на основе CSV данных
        const form = forms.find(f => f.id === selectedForm);
        if (!form || !form.fields) {
          setError('Выберите форму перед импортом CSV');
          return;
        }

        const accountDataFromCsv = data.map((row, index) => {
          const account = {
            id: `account_${accountData.length + index + 1}`,
            name: row.account_name || `Аккаунт ${accountData.length + index + 1}`,
            fields: {}
          };
          
          // Сопоставляем CSV колонки с полями формы
          form.fields.forEach(field => {
            // Сначала ищем точное совпадение по названию поля
            let csvColumn = headers.find(header => 
              header.toLowerCase() === (field.title || field.id).toLowerCase()
            );
            
            // Если точного совпадения нет, ищем частичное совпадение
            if (!csvColumn) {
              csvColumn = headers.find(header => 
                header.toLowerCase().includes((field.title || field.id).toLowerCase()) ||
                (field.title || field.id).toLowerCase().includes(header.toLowerCase())
              );
            }
            
            if (csvColumn && row[csvColumn]) {
              // Обрабатываем значения в зависимости от типа поля
              let value = row[csvColumn];
              
              switch (field.type) {
                case 'checkbox':
                  // Чекбоксы: true/false, 1/0, да/нет
                  value = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'да';
                  break;
                case 'radio':
                case 'select':
                  // Радиокнопки и селекты: используем значение как есть
                  break;
                case 'number':
                  // Числа: преобразуем в число
                  value = isNaN(Number(value)) ? value : Number(value);
                  break;
                default:
                  // Текстовые поля: используем как есть
              }
              
              account.fields[field.id] = value;
            } else {
              // Устанавливаем значения по умолчанию в зависимости от типа поля
              switch (field.type) {
                case 'checkbox':
                  account.fields[field.id] = false;
                  break;
                case 'radio':
                case 'select':
                  account.fields[field.id] = field.options[0]?.value || '';
                  break;
                default:
                  account.fields[field.id] = '';
              }
            }
          });
          
          return account;
        });
        
        setAccountData([...accountData, ...accountDataFromCsv]);
        setError(null);
      } catch (error) {
        setError('Ошибка при обработке CSV файла: ' + error.message);
      }
    };
    
    reader.readAsText(file);
  };

  const handleLoginModeChange = (event) => {
    setLoginMode(event.target.value);
    if (event.target.value === 'anonymous') {
      setSelectedAccounts([]);
    }
  };

  const handleSelectAllAccounts = () => {
    if (selectedAccounts.length === accounts.length) {
      // Если все выбраны, снимаем выбор со всех
      setSelectedAccounts([]);
    } else {
      // Выбираем все аккаунты
      setSelectedAccounts(accounts.map(account => account.id));
    }
  };

  const handleFormChange = (event) => {
    setSelectedForm(event.target.value);
    // Инициализируем один аккаунт по умолчанию
    initializeAccountData(event.target.value, 1);
  };

  const hasBoundProxies = () => {
    if (loginMode === 'google' && selectedAccounts.length > 0) {
      // Проверяем, есть ли у выбранных аккаунтов привязанные прокси
      const accountsWithProxies = selectedAccounts.filter(accountId => {
        const account = accounts.find(acc => acc.id === accountId);
        return account && account.data && account.data.proxyId;
      });
      return accountsWithProxies.length > 0;
    }
    return false;
  };

  const handleStartAutomation = async () => {
    if (!selectedForm) {
      setError('Выберите форму');
      return;
    }

    if (loginMode === 'google' && selectedAccounts.length === 0) {
      setError('Выберите Google аккаунты для режима с логином');
      return;
    }

    // Проверяем прокси только если нет привязанных прокси у аккаунтов
    if (loginMode === 'google' && !selectedProxyGroup && !hasBoundProxies()) {
      setError('Выберите группу прокси для режима с логином или привяжите прокси к аккаунтам');
      return;
    }

    if (accountData.length === 0) {
      setError('Нет данных для заполнения');
      return;
    }

    try {
      setRunning(true);
      setError(null);
      
      const automationOptions = {
        ...options,
        loginMode: loginMode,
        accountData: accountData,
        delaySettings: delaySettings,
        selectedProxyGroup: selectedProxyGroup
      };
      
      const response = await apiService.automation.start(
        selectedForm,
        loginMode === 'google' ? selectedAccounts : [],
        automationOptions
      );
      
      // Начинаем отслеживание активной задачи
      if (response && response.jobId) {
        setActiveJob({ 
          id: response.jobId, 
          status: 'running', 
          totalAccounts: accountData.length, 
          completedAccounts: 0 
        });
        setJobLogs([]);
        startJobMonitoring(response.jobId);
      }
      
      await loadJobs();
      
    } catch (error) {
      setError('Ошибка запуска автоматизации: ' + error.message);
    } finally {
      setRunning(false);
    }
  };

  const startJobMonitoring = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const jobResponse = await apiService.automation.getStatus(jobId);
        if (jobResponse && jobResponse.success) {
          const job = jobResponse.data;
          setActiveJob(job);
          
          // Если задача завершена, останавливаем мониторинг
          if (job.status === 'completed' || job.status === 'failed' || job.status === 'stopped') {
            clearInterval(interval);
            await loadJobs(); // Обновляем список задач
          }
        }
      } catch (error) {
        console.error('Ошибка получения статуса задачи:', error);
      }
    }, 2000); // Проверяем каждые 2 секунды

    // Останавливаем мониторинг через 10 минут
    setTimeout(() => {
      clearInterval(interval);
    }, 600000);
  };

  const handleStopJob = async (jobId) => {
    try {
      await apiService.automation.stop(jobId);
      await loadJobs();
    } catch (error) {
      setError('Ошибка остановки задачи: ' + error.message);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Вы уверены, что хотите очистить всю историю задач? Это действие нельзя отменить.')) {
      try {
        await apiService.automation.clearHistory();
        await loadJobs();
        setError(null);
      } catch (error) {
        setError('Ошибка очистки истории: ' + error.message);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'warning';
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'stopped': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'running': return 'Выполняется';
      case 'completed': return 'Завершена';
      case 'failed': return 'Ошибка';
      case 'stopped': return 'Остановлена';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Автоматизация заполнения форм
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Настройка автоматизации */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Настройка автоматизации
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Выберите форму</InputLabel>
                  <Select
                    value={selectedForm}
                    onChange={handleFormChange}
                    label="Выберите форму"
                  >
                    {forms.map((form) => (
                      <MenuItem key={form.id} value={form.id}>
                        {form.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Выбор режима входа */}
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Режим входа</InputLabel>
                  <Select
                    value={loginMode}
                    onChange={handleLoginModeChange}
                    label="Режим входа"
                  >
                    <MenuItem value="anonymous">Без логина Google (анонимно)</MenuItem>
                    <MenuItem value="google">С логином Google</MenuItem>
                  </Select>
                </FormControl>

                {/* Выбор Google аккаунтов (только для режима с логином) */}
                {loginMode === 'google' && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <FormControl fullWidth>
                        <InputLabel>Выберите Google аккаунты</InputLabel>
                        <Select
                          multiple
                          value={selectedAccounts}
                          onChange={(e) => setSelectedAccounts(e.target.value)}
                          label="Выберите Google аккаунты"
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((value) => {
                                const account = accounts.find(acc => acc.id === value);
                                return (
                                  <Chip key={value} label={account?.email || value} size="small" />
                                );
                              })}
                            </Box>
                          )}
                        >
                          {accounts.map((account) => (
                            <MenuItem key={account.id} value={account.id}>
                              {account.email}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleSelectAllAccounts}
                        sx={{ minWidth: 'auto', px: 2 }}
                      >
                        {selectedAccounts.length === accounts.length ? 'Снять все' : 'Выбрать все'}
                      </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Выбрано: {selectedAccounts.length} из {accounts.length} аккаунтов
                    </Typography>
                  </Box>
                )}

                {/* Выбор группы прокси (только для режима с логином) */}
                {loginMode === 'google' && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Выберите группу прокси</InputLabel>
                    <Select
                      value={selectedProxyGroup}
                      onChange={(e) => setSelectedProxyGroup(e.target.value)}
                      label="Выберите группу прокси"
                    >
                      {proxyGroups.map((group) => (
                        <MenuItem key={group} value={group}>
                          {group}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Интерфейс для данных */}
                {selectedForm && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        Данные для заполнения
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          component="label"
                          startIcon={<SettingsIcon />}
                        >
                          Импорт CSV
                          <input
                            type="file"
                            accept=".csv"
                            hidden
                            onChange={handleCsvImport}
                          />
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={generateCsvTemplate}
                          startIcon={<DownloadIcon />}
                          disabled={!selectedForm}
                        >
                          Скачать шаблон
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            if (!selectedForm) {
                              setError('Сначала выберите форму');
                              return;
                            }
                            const form = forms.find(f => f.id === selectedForm);
                            if (!form || !form.fields || form.fields.length === 0) {
                              setError('Выбранная форма не содержит полей');
                              return;
                            }
                            setOpenAccountEditor(true);
                          }}
                          disabled={!selectedForm}
                        >
                          Редактировать данные
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => {
                            const form = forms.find(f => f.id === selectedForm);
                            if (!form || !form.fields) return;
                            
                            const newAccount = {
                              id: `account_${accountData.length + 1}`,
                              name: `Аккаунт ${accountData.length + 1}`,
                              fields: {}
                            };
                            
                            form.fields.forEach(field => {
                              // Инициализируем поля в зависимости от их типа
                              switch (field.type) {
                                case 'checkbox':
                                  newAccount.fields[field.id] = false;
                                  break;
                                case 'radio':
                                case 'select':
                                  newAccount.fields[field.id] = field.options?.[0]?.value || '';
                                  break;
                                case 'number':
                                  newAccount.fields[field.id] = 0;
                                  break;
                                default:
                                  newAccount.fields[field.id] = '';
                              }
                            });
                            
                            setAccountData([...accountData, newAccount]);
                          }}
                        >
                          + Добавить аккаунт
                        </Button>
                      </Box>
                    </Box>
                    
                    {accountData.map((account, accountIndex) => {
                      const form = forms.find(f => f.id === selectedForm);
                      if (!form || !form.fields) return null;
                      
                      return (
                        <Card key={account.id} sx={{ mb: 2 }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              <Typography variant="subtitle1">
                                {account.name}
                              </Typography>
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={() => {
                                  if (window.confirm(`Вы уверены, что хотите удалить аккаунт "${account.name}"?`)) {
                                    const newAccountData = accountData.filter((_, index) => index !== accountIndex);
                                    setAccountData(newAccountData);
                                  }
                                }}
                              >
                                Удалить
                              </Button>
                            </Box>
                            
                            <Grid container spacing={2}>
                              {form.fields.map((field) => (
                                <Grid item xs={12} sm={6} md={4} key={field.id}>
                                  <FieldRenderer
                                    field={field}
                                    value={account.fields[field.id]}
                                    onChange={(value) => updateAccountField(accountIndex, field.id, value)}
                                    size="small"
                                  />
                                </Grid>
                              ))}
                            </Grid>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={handleStartAutomation}
                    disabled={running || !selectedForm || accountData.length === 0 || (loginMode === 'google' && selectedAccounts.length === 0) || (loginMode === 'google' && !selectedProxyGroup && !hasBoundProxies())}
                    fullWidth
                  >
                    {running ? 'Запуск...' : 
                     `Запустить заполнение (${accountData.length} аккаунтов, ${loginMode === 'google' ? 'с логином' : 'анонимно'})`}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() => setOpenOptions(true)}
                  >
                    Настройки
                  </Button>
                </Box>

                <Typography variant="body2" color="text.secondary">
                  {loginMode === 'google' ? 
                    `Режим с логином Google: ${selectedAccounts.length} аккаунтов` :
                    `Анонимный режим: ${accountData.length} аккаунтов`
                  }
                </Typography>
                
                {loginMode === 'google' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {hasBoundProxies() ? 
                      '✅ Используются привязанные прокси аккаунтов' :
                      selectedProxyGroup ? 
                        `🌐 Используется группа прокси: ${selectedProxyGroup}` :
                        '⚠️ Нужно выбрать группу прокси или привязать прокси к аккаунтам'
                    }
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Статистика */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Статистика
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {forms.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Форм
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {accounts.length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Аккаунтов
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">
                        {jobs.filter(job => job.status === 'running').length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Активных задач
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="info.main">
                        {jobs.filter(job => job.status === 'completed').length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Завершено
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Прогресс активной задачи */}
          {activeJob && (
            <Grid item xs={12}>
              <AutomationProgress 
                job={activeJob} 
                logs={jobLogs} 
                onStop={() => handleStopJob(activeJob.id)}
              />
            </Grid>
          )}

          {/* Список задач */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Задачи автоматизации
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      startIcon={<RefreshIcon />}
                      onClick={loadJobs}
                      size="small"
                    >
                      Обновить
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleClearHistory}
                      size="small"
                      disabled={jobs.length === 0}
                    >
                      Очистить историю
                    </Button>
                  </Box>
                </Box>

                {jobs.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    Нет активных задач
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {jobs.map((job) => (
                      <Card key={job.id} variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle1">
                                {job.name || `Задача #${job.id.slice(-8)}`}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Начата: {new Date(job.startTime).toLocaleString('ru-RU')}
                              </Typography>
                              {job.progress && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    Прогресс: {job.progress.completed} / {job.progress.total}
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={(job.progress.completed / job.progress.total) * 100}
                                    sx={{ mt: 0.5 }}
                                  />
                                </Box>
                              )}
                            </Box>
                            
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                label={getStatusText(job.status)}
                                color={getStatusColor(job.status)}
                                size="small"
                              />
                              {job.status === 'running' && (
                                <Button
                                  size="small"
                                  startIcon={<StopIcon />}
                                  onClick={() => handleStopJob(job.id)}
                                  color="error"
                                >
                                  Остановить
                                </Button>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Диалог настроек */}
      <Dialog open={openOptions} onClose={() => setOpenOptions(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Настройки автоматизации</DialogTitle>
        <DialogContent>
          {/* Основные настройки */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Основные настройки
          </Typography>
          
          <TextField
            autoFocus
            margin="dense"
            label="Задержка между аккаунтами (мс)"
            type="number"
            fullWidth
            variant="outlined"
            value={options.delay}
            onChange={(e) => setOptions({ ...options, delay: parseInt(e.target.value) || 1000 })}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Количество потоков"
            type="number"
            fullWidth
            variant="outlined"
            value={options.concurrency}
            onChange={(e) => {
              const v = Math.max(1, Math.min(8, parseInt(e.target.value) || 1));
              setOptions({ ...options, concurrency: v });
            }}
            helperText="1-8 потоков. Бóльшее число может вызывать блокировки и нагрузку."
            sx={{ mb: 2 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={options.submit}
                onChange={(e) => setOptions({ ...options, submit: e.target.checked })}
              />
            }
            label="Автоматически отправлять форму"
            sx={{ mb: 1 }}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={options.headless}
                onChange={(e) => setOptions({ ...options, headless: e.target.checked })}
              />
            }
            label="Скрытый режим браузера"
            sx={{ mb: 3 }}
          />


          {/* Настройки задержки между сабмитами */}
          <Typography variant="h6" sx={{ mb: 2 }}>
            Задержка между сабмитами форм
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={delaySettings.enabled}
                onChange={(e) => setDelaySettings({ ...delaySettings, enabled: e.target.checked })}
              />
            }
            label="Включить задержку между сабмитами"
            sx={{ mb: 2 }}
          />
          
          {delaySettings.enabled && (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Тип задержки</InputLabel>
                <Select
                  value={delaySettings.type}
                  onChange={(e) => setDelaySettings({ ...delaySettings, type: e.target.value })}
                  label="Тип задержки"
                >
                  <MenuItem value="fixed">Фиксированная</MenuItem>
                  <MenuItem value="random">Случайная</MenuItem>
                  <MenuItem value="progressive">Прогрессивная</MenuItem>
                </Select>
              </FormControl>
              
              {delaySettings.type === 'fixed' && (
                <TextField
                  margin="dense"
                  label="Фиксированная задержка (мс)"
                  type="number"
                  fullWidth
                  variant="outlined"
                  value={delaySettings.fixedDelay}
                  onChange={(e) => setDelaySettings({ ...delaySettings, fixedDelay: parseInt(e.target.value) || 3000 })}
                  sx={{ mb: 2 }}
                />
              )}
              
              {delaySettings.type === 'random' && (
                <>
                  <TextField
                    margin="dense"
                    label="Минимальная задержка (мс)"
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={delaySettings.minDelay}
                    onChange={(e) => setDelaySettings({ ...delaySettings, minDelay: parseInt(e.target.value) || 2000 })}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    margin="dense"
                    label="Максимальная задержка (мс)"
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={delaySettings.maxDelay}
                    onChange={(e) => setDelaySettings({ ...delaySettings, maxDelay: parseInt(e.target.value) || 5000 })}
                    sx={{ mb: 2 }}
                  />
                </>
              )}
              
              {delaySettings.type === 'progressive' && (
                <>
                  <TextField
                    margin="dense"
                    label="Начальная задержка (мс)"
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={delaySettings.minDelay}
                    onChange={(e) => setDelaySettings({ ...delaySettings, minDelay: parseInt(e.target.value) || 2000 })}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    margin="dense"
                    label="Максимальная задержка (мс)"
                    type="number"
                    fullWidth
                    variant="outlined"
                    value={delaySettings.maxDelay}
                    onChange={(e) => setDelaySettings({ ...delaySettings, maxDelay: parseInt(e.target.value) || 5000 })}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    margin="dense"
                    label="Множитель прогрессии"
                    type="number"
                    step="0.1"
                    fullWidth
                    variant="outlined"
                    value={delaySettings.progressiveMultiplier}
                    onChange={(e) => setDelaySettings({ ...delaySettings, progressiveMultiplier: parseFloat(e.target.value) || 1.5 })}
                    sx={{ mb: 2 }}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenOptions(false)}>Отмена</Button>
          <Button onClick={() => setOpenOptions(false)} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Редактор данных аккаунтов */}
      <AccountDataEditor
        open={openAccountEditor}
        onClose={() => setOpenAccountEditor(false)}
        accountData={accountData}
        setAccountData={setAccountData}
        formFields={selectedForm ? forms.find(f => f.id === selectedForm)?.fields || [] : []}
        selectedForm={selectedForm ? forms.find(f => f.id === selectedForm) : null}
      />
    </Container>
  );
};

export default Automation;
