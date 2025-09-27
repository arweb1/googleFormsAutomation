import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Chip,
  IconButton,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Link as LinkIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { apiService } from '../services/apiService';

const Forms = () => {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formUrl, setFormUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      setLoading(true);
      const response = await apiService.forms.getConfigs();
      setForms(response.data.data || []);
    } catch (error) {
      setError('Ошибка загрузки форм: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeForm = async () => {
    if (!formUrl.trim()) {
      setError('Введите URL формы');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);
      
      const response = await apiService.forms.analyze(formUrl);
      const formData = response.data.data; // Исправляем парсинг ответа
      
      // Отладочная информация
      console.log('Ответ от API:', response);
      console.log('Данные формы:', formData);
      console.log('Количество полей:', formData.fields ? formData.fields.length : 0);
      
      // Сохраняем конфигурацию
      const configData = {
        name: formData.title || 'Новая форма',
        url: formUrl,
        title: formData.title,
        fields: formData.fields || [],
        submitAction: formData.submitAction,
        method: formData.method,
        description: `Автоматически создана из ${formUrl}`,
        tags: ['автоматически']
      };
      
      console.log('Данные для сохранения:', configData);
      
      await apiService.forms.saveConfig(configData);
      await loadForms();
      
      setOpenDialog(false);
      setFormUrl('');
      
    } catch (error) {
      setError('Ошибка анализа формы: ' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteForm = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить эту форму?')) {
      try {
        await apiService.forms.deleteConfig(id);
        await loadForms();
      } catch (error) {
        setError('Ошибка удаления формы: ' + error.message);
      }
    }
  };

  const filteredForms = forms.filter(form =>
    form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    form.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    {
      field: 'name',
      headerName: 'Название',
      width: 200,
      renderCell: (params) => (
        <Box>
          <Typography variant="subtitle2" noWrap>
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {params.row.title}
          </Typography>
        </Box>
      )
    },
    {
      field: 'url',
      headerName: 'URL',
      width: 300,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon fontSize="small" />
          <Typography variant="body2" noWrap>
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'fields',
      headerName: 'Поля',
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={`${params.value.length} полей`} 
          size="small" 
          color="primary" 
        />
      )
    },
    {
      field: 'createdAt',
      headerName: 'Создана',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleDateString('ru-RU')}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Действия',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => setSelectedForm(params.row)}
            title="Просмотр"
          >
            <ViewIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setSelectedForm(params.row)}
            title="Редактировать"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeleteForm(params.row.id)}
            title="Удалить"
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      )
    }
  ];

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
            Управление формами
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Добавить форму
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                placeholder="Поиск форм..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Box>

            <Box sx={{ height: 400, width: '100%' }}>
              <DataGrid
                rows={filteredForms}
                columns={columns}
                pageSize={10}
                rowsPerPageOptions={[10, 25, 50]}
                disableSelectionOnClick
                autoHeight
              />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Диалог добавления формы */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить новую форму</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="URL формы Google"
            fullWidth
            variant="outlined"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="https://docs.google.com/forms/d/..."
            sx={{ mt: 2 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Вставьте ссылку на Google форму. Система автоматически проанализирует поля формы.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Отмена</Button>
          <Button
            onClick={handleAnalyzeForm}
            variant="contained"
            disabled={analyzing || !formUrl.trim()}
            startIcon={analyzing ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {analyzing ? 'Анализ...' : 'Добавить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог просмотра/редактирования формы */}
      <Dialog 
        open={!!selectedForm} 
        onClose={() => setSelectedForm(null)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          {selectedForm?.name}
        </DialogTitle>
        <DialogContent>
          {selectedForm && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>URL:</strong> {selectedForm.url}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Поля формы:</strong>
              </Typography>
              <Grid container spacing={1}>
                {selectedForm.fields.map((field, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Card variant="outlined">
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="subtitle2" noWrap>
                            {field.title || field.name || field.id}
                          </Typography>
                          {field.required && (
                            <Chip label="Обязательное" size="small" color="error" />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          Тип: {field.type}
                        </Typography>
                        
                        {/* Отображение опций для радиокнопок, чекбоксов и select */}
                        {(field.type === 'radio' || field.type === 'checkbox' || field.type === 'select') && field.options && field.options.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              Опции ({field.options.length}):
                            </Typography>
                            {field.options.map((option, optIndex) => (
                              <Chip
                                key={optIndex}
                                label={option.label}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                        )}
                        
                        {/* Специальная информация для радиокнопок с одной опцией */}
                        {field.type === 'radio' && field.options && field.options.length === 1 && (
                          <Chip
                            label="Одна опция - всегда выбирается"
                            size="small"
                            color="info"
                            sx={{ mt: 1, fontSize: '0.7rem' }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedForm(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Forms;
