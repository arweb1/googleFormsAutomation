import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Button,
  Alert,
  CircularProgress,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Results = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [error, setError] = useState(null);
  const [openDetails, setOpenDetails] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await apiService.automation.getAllJobs();
      setJobs(response.data.data || []);
    } catch (error) {
      setError('Ошибка загрузки задач: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadJobResults = async (jobId) => {
    try {
      const response = await apiService.automation.getResults(jobId);
      setResults(response.data.data || []);
    } catch (error) {
      setError('Ошибка загрузки результатов: ' + error.message);
    }
  };

  const handleViewResults = async (job) => {
    setSelectedJob(job);
    await loadJobResults(job.id);
    setOpenDetails(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'running': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'success': return 'Успешно';
      case 'failed': return 'Ошибка';
      case 'running': return 'Выполняется';
      default: return status;
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const exportResults = (jobId) => {
    // Здесь можно добавить экспорт результатов в CSV
    console.log('Экспорт результатов для задачи:', jobId);
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Результаты автоматизации
          </Typography>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadJobs}
          >
            Обновить
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Статистика */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {jobs.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Всего задач
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {jobs.filter(job => job.status === 'completed').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Завершено
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {jobs.filter(job => job.status === 'running').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Выполняется
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {jobs.filter(job => job.status === 'failed').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ошибки
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Список задач */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              История задач
            </Typography>

            {jobs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Нет выполненных задач
              </Typography>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID задачи</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Начата</TableCell>
                      <TableCell>Завершена</TableCell>
                      <TableCell>Прогресс</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {jobs
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            #{job.id.slice(-8)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusText(job.status)}
                            color={getStatusColor(job.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(job.startTime).toLocaleString('ru-RU')}
                        </TableCell>
                        <TableCell>
                          {job.endTime ? new Date(job.endTime).toLocaleString('ru-RU') : '-'}
                        </TableCell>
                        <TableCell>
                          {job.progress ? (
                            <Box>
                              <Typography variant="body2">
                                {job.progress.completed} / {job.progress.total}
                              </Typography>
                              {job.progress.failed > 0 && (
                                <Typography variant="caption" color="error">
                                  Ошибок: {job.progress.failed}
                                </Typography>
                              )}
                            </Box>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleViewResults(job)}
                            title="Просмотр результатов"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => exportResults(job.id)}
                            title="Экспорт результатов"
                          >
                            <ExportIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={jobs.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  labelRowsPerPage="Строк на странице:"
                  labelDisplayedRows={({ from, to, count }) => 
                    `${from}-${to} из ${count !== -1 ? count : `более ${to}`}`
                  }
                />
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Диалог просмотра результатов */}
      <Dialog 
        open={openDetails} 
        onClose={() => setOpenDetails(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Результаты задачи #{selectedJob?.id?.slice(-8)}
        </DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Статус: <Chip label={getStatusText(selectedJob.status)} color={getStatusColor(selectedJob.status)} size="small" />
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Начата: {new Date(selectedJob.startTime).toLocaleString('ru-RU')}
                  </Typography>
                </Grid>
                {selectedJob.endTime && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Завершена: {new Date(selectedJob.endTime).toLocaleString('ru-RU')}
                    </Typography>
                  </Grid>
                )}
                {selectedJob.progress && (
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Прогресс: {selectedJob.progress.completed} / {selectedJob.progress.total}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              <Typography variant="h6" gutterBottom>
                Результаты по аккаунтам
              </Typography>

              {results.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  Нет результатов
                </Typography>
              ) : (
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Email</TableCell>
                        <TableCell>Статус</TableCell>
                        <TableCell>Время</TableCell>
                        <TableCell>Детали</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>{result.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusText(result.status)}
                              color={getStatusColor(result.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(result.timestamp).toLocaleString('ru-RU')}
                          </TableCell>
                          <TableCell>
                            {result.error ? (
                              <Typography variant="caption" color="error">
                                {result.error}
                              </Typography>
                            ) : result.data ? (
                              <Typography variant="caption" color="success">
                                Успешно отправлено
                              </Typography>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetails(false)}>Закрыть</Button>
          {selectedJob && (
            <Button
              startIcon={<ExportIcon />}
              onClick={() => exportResults(selectedJob.id)}
              variant="contained"
            >
              Экспорт
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Results;
