import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  PlayArrow,
  Stop,
  ExpandMore,
  AccountCircle,
  Schedule
} from '@mui/icons-material';

const AutomationProgress = ({ job, logs = [], onStop }) => {
  if (!job) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <PlayArrow color="primary" />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'stopped':
        return <Stop color="warning" />;
      default:
        return <HourglassEmpty color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'stopped':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'running':
        return 'Выполняется';
      case 'completed':
        return 'Завершено';
      case 'failed':
        return 'Ошибка';
      case 'stopped':
        return 'Остановлено';
      default:
        return 'Ожидает';
    }
  };

  const progress = job.totalAccounts > 0 ? ((job.completedAccounts + job.failedAccounts) / job.totalAccounts) * 100 : 0;
  const successRate = job.totalAccounts > 0 ? (job.completedAccounts / job.totalAccounts) * 100 : 0;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="div">
            {job.name || 'Прогресс автоматизации'}
          </Typography>
          <Chip
            icon={getStatusIcon(job.status)}
            label={getStatusText(job.status)}
            color={getStatusColor(job.status)}
            variant="outlined"
          />
        </Box>

        {/* Кнопка остановки активной задачи */}
        {job.status === 'running' && (
          <Box mb={2}>
            <Chip
              icon={<Stop />}
              label="Остановить задачу"
              color="error"
              onClick={onStop}
              variant="filled"
              sx={{ cursor: 'pointer' }}
            />
          </Box>
        )}

        {/* Основная информация о задаче */}
        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Форма: {job.formTitle || 'Неизвестная форма'}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Режим: {job.loginMode === 'google' ? 'С логином Google' : 'Анонимно'}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Начато: {new Date(job.startTime).toLocaleString('ru-RU')}
          </Typography>
          {job.endTime && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Завершено: {new Date(job.endTime).toLocaleString('ru-RU')}
            </Typography>
          )}
        </Box>

        {/* Статистика */}
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Обработано: {job.completedAccounts + job.failedAccounts} / {job.totalAccounts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4, mb: 1 }}
          />
          
          <Box display="flex" gap={2}>
            <Chip 
              icon={<CheckCircle />} 
              label={`Успешно: ${job.completedAccounts}`} 
              color="success" 
              size="small" 
            />
            <Chip 
              icon={<Error />} 
              label={`Ошибок: ${job.failedAccounts}`} 
              color="error" 
              size="small" 
            />
            <Chip 
              icon={<Schedule />} 
              label={`Успешность: ${Math.round(successRate)}%`} 
              color="info" 
              size="small" 
            />
          </Box>
        </Box>

        {job.error && (
          <Box mb={2}>
            <Typography variant="body2" color="error">
              Ошибка: {job.error}
            </Typography>
          </Box>
        )}

        {/* Детальная информация */}
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="subtitle2">Детальная информация</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Результаты по аккаунтам */}
            {job.results && job.results.length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Результаты по аккаунтам:
                </Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 200 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Аккаунт</TableCell>
                        <TableCell>Статус</TableCell>
                        <TableCell>Время</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {job.results.slice(-10).map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <AccountCircle fontSize="small" />
                              {result.accountId}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={result.success ? <CheckCircle /> : <Error />}
                              label={result.success ? 'Успех' : 'Ошибка'}
                              color={result.success ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(result.timestamp).toLocaleTimeString('ru-RU')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Логи */}
            {job.logs && job.logs.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Логи выполнения:
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {job.logs.slice(-10).map((log, index) => (
                    <React.Fragment key={index}>
                      <ListItem sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {log.type === 'success' && <CheckCircle color="success" fontSize="small" />}
                          {log.type === 'error' && <Error color="error" fontSize="small" />}
                          {log.type === 'info' && <HourglassEmpty color="info" fontSize="small" />}
                        </ListItemIcon>
                        <ListItemText
                          primary={log.message}
                          secondary={log.timestamp ? new Date(log.timestamp).toLocaleTimeString('ru-RU') : ''}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                      {index < job.logs.slice(-10).length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default AutomationProgress;
