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
  Settings as SettingsIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Automation = () => {
  const [forms, setForms] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [submitCount, setSubmitCount] = useState(1);
  const [options, setOptions] = useState({
    delay: 1000,
    submit: true,
    headless: false
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [openOptions, setOpenOptions] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadJobs, 5000); // Обновляем каждые 5 секунд
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [formsResponse, accountsResponse, jobsResponse] = await Promise.all([
        apiService.forms.getConfigs(),
        apiService.accounts.getAll(),
        apiService.automation.getAllJobs()
      ]);
      
      setForms(formsResponse.data.data || []);
      setAccounts(accountsResponse.data.data || []);
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

  const handleStartAutomation = async () => {
    if (!selectedForm) {
      setError('Выберите форму');
      return;
    }

    if (!anonymousMode && selectedAccounts.length === 0) {
      setError('Выберите аккаунты или включите анонимный режим');
      return;
    }

    if (anonymousMode && submitCount < 1) {
      setError('Количество отправок должно быть больше 0');
      return;
    }

    try {
      setRunning(true);
      setError(null);
      
      const automationOptions = {
        ...options,
        anonymousMode: anonymousMode,
        submitCount: anonymousMode ? submitCount : undefined
      };
      
      await apiService.automation.start(
        selectedForm,
        selectedAccounts,
        automationOptions
      );
      
      await loadJobs();
      
    } catch (error) {
      setError('Ошибка запуска автоматизации: ' + error.message);
    } finally {
      setRunning(false);
    }
  };

  const handleStopJob = async (jobId) => {
    try {
      await apiService.automation.stop(jobId);
      await loadJobs();
    } catch (error) {
      setError('Ошибка остановки задачи: ' + error.message);
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
                    onChange={(e) => setSelectedForm(e.target.value)}
                    label="Выберите форму"
                  >
                    {forms.map((form) => (
                      <MenuItem key={form.id} value={form.id}>
                        {form.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Переключатель анонимного режима */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={anonymousMode}
                      onChange={(e) => setAnonymousMode(e.target.checked)}
                    />
                  }
                  label="Анонимный режим (без аккаунтов)"
                  sx={{ mb: 2 }}
                />

                {anonymousMode ? (
                  <TextField
                    fullWidth
                    label="Количество отправок"
                    type="number"
                    value={submitCount}
                    onChange={(e) => setSubmitCount(parseInt(e.target.value) || 1)}
                    inputProps={{ min: 1, max: 100 }}
                    sx={{ mb: 2 }}
                    helperText="Сколько раз заполнить форму"
                  />
                ) : (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Выберите аккаунты</InputLabel>
                    <Select
                      multiple
                      value={selectedAccounts}
                      onChange={(e) => setSelectedAccounts(e.target.value)}
                      label="Выберите аккаунты"
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
                )}

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<PlayIcon />}
                    onClick={handleStartAutomation}
                    disabled={running || !selectedForm || (!anonymousMode && selectedAccounts.length === 0)}
                    fullWidth
                  >
                    {running ? 'Запуск...' : 
                     anonymousMode ? `Запустить анонимное заполнение (${submitCount} раз)` :
                     'Запустить автоматизацию'}
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
                  {anonymousMode ? 
                    `Анонимный режим: ${submitCount} отправок` :
                    `Выбрано аккаунтов: ${selectedAccounts.length}`
                  }
                </Typography>
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

          {/* Список задач */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Задачи автоматизации
                  </Typography>
                  <Button
                    startIcon={<RefreshIcon />}
                    onClick={loadJobs}
                    size="small"
                  >
                    Обновить
                  </Button>
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
                                Задача #{job.id.slice(-8)}
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
            sx={{ mb: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenOptions(false)}>Отмена</Button>
          <Button onClick={() => setOpenOptions(false)} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Automation;
