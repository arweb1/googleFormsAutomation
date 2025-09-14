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
  Divider
} from '@mui/material';
import {
  CheckCircle,
  Error,
  HourglassEmpty,
  PlayArrow,
  Stop
} from '@mui/icons-material';

const AutomationProgress = ({ job, logs = [] }) => {
  if (!job) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <PlayArrow color="primary" />;
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'paused':
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
      case 'paused':
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
      case 'paused':
        return 'Приостановлено';
      default:
        return 'Ожидает';
    }
  };

  const progress = job.totalAccounts > 0 ? (job.completedAccounts / job.totalAccounts) * 100 : 0;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="div">
            Прогресс автоматизации
          </Typography>
          <Chip
            icon={getStatusIcon(job.status)}
            label={getStatusText(job.status)}
            color={getStatusColor(job.status)}
            variant="outlined"
          />
        </Box>

        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Аккаунты: {job.completedAccounts} / {job.totalAccounts}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {job.startTime && (
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              Начато: {new Date(job.startTime).toLocaleString()}
            </Typography>
            {job.endTime && (
              <Typography variant="body2" color="text.secondary">
                Завершено: {new Date(job.endTime).toLocaleString()}
              </Typography>
            )}
          </Box>
        )}

        {job.error && (
          <Box mb={2}>
            <Typography variant="body2" color="error">
              Ошибка: {job.error}
            </Typography>
          </Box>
        )}

        {logs.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Логи выполнения:
            </Typography>
            <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
              {logs.slice(-10).map((log, index) => (
                <React.Fragment key={index}>
                  <ListItem sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {log.type === 'success' && <CheckCircle color="success" fontSize="small" />}
                      {log.type === 'error' && <Error color="error" fontSize="small" />}
                      {log.type === 'info' && <HourglassEmpty color="info" fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={log.message}
                      secondary={log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  {index < logs.slice(-10).length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AutomationProgress;
