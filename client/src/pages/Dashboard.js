import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Description as FormsIcon,
  People as AccountsIcon,
  PlayArrow as AutomationIcon,
  Assessment as ResultsIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    forms: 0,
    accounts: 0,
    activeJobs: 0,
    completedJobs: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [formsResponse, accountsResponse, jobsResponse] = await Promise.all([
        apiService.get('/forms/configs'),
        apiService.get('/accounts'),
        apiService.get('/automation/jobs')
      ]);

      const activeJobs = jobsResponse.data.filter(job => job.status === 'running').length;
      const completedJobs = jobsResponse.data.filter(job => job.status === 'completed').length;

      setStats({
        forms: formsResponse.data.length,
        accounts: accountsResponse.data.length,
        activeJobs,
        completedJobs
      });
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color, onClick }) => (
    <Card 
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { boxShadow: 4 } : {}
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ color: color, mr: 2 }}>
            {icon}
          </Box>
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );

  const QuickActionCard = ({ title, description, icon, onClick, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ textAlign: 'center', p: 3 }}>
        <Box sx={{ color: `${color}.main`, mb: 2 }}>
          {icon}
        </Box>
        <Typography variant="h6" component="div" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        <Button
          variant="contained"
          color={color}
          startIcon={<AddIcon />}
          onClick={onClick}
          fullWidth
        >
          Создать
        </Button>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4 }}>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
            Загрузка статистики...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Панель управления
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Управляйте формами, аккаунтами и автоматизацией
        </Typography>
      </Box>

      {/* Статистика */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Формы"
            value={stats.forms}
            icon={<FormsIcon sx={{ fontSize: 40 }} />}
            color="primary.main"
            onClick={() => navigate('/forms')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Аккаунты"
            value={stats.accounts}
            icon={<AccountsIcon sx={{ fontSize: 40 }} />}
            color="success.main"
            onClick={() => navigate('/accounts')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Активные задачи"
            value={stats.activeJobs}
            icon={<AutomationIcon sx={{ fontSize: 40 }} />}
            color="warning.main"
            onClick={() => navigate('/automation')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Завершенные"
            value={stats.completedJobs}
            icon={<ResultsIcon sx={{ fontSize: 40 }} />}
            color="info.main"
            onClick={() => navigate('/results')}
          />
        </Grid>
      </Grid>

      {/* Быстрые действия */}
      <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
        Быстрые действия
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard
            title="Новая форма"
            description="Добавить новую форму для автоматизации"
            icon={<FormsIcon sx={{ fontSize: 48 }} />}
            color="primary"
            onClick={() => navigate('/forms')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard
            title="Загрузить аккаунты"
            description="Импортировать аккаунты из CSV файла"
            icon={<AccountsIcon sx={{ fontSize: 48 }} />}
            color="success"
            onClick={() => navigate('/accounts')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard
            title="Запустить автоматизацию"
            description="Начать автоматическое заполнение форм"
            icon={<AutomationIcon sx={{ fontSize: 48 }} />}
            color="warning"
            onClick={() => navigate('/automation')}
          />
        </Grid>
      </Grid>

      {/* Последние активности */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Последние активности
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary">
              Здесь будут отображаться последние действия и результаты автоматизации
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default Dashboard;
