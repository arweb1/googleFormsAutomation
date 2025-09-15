import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CloudUpload as UploadIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Proxies = () => {
  const [proxies, setProxies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openBulkDialog, setOpenBulkDialog] = useState(false);
  const [editingProxy, setEditingProxy] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('all');
  
  // Форма для создания/редактирования прокси
  const [proxyForm, setProxyForm] = useState({
    name: '',
    host: '',
    port: '',
    username: '',
    password: '',
    type: 'http',
    group: 'default',
    description: ''
  });
  
  // Форма для массового добавления
  const [bulkForm, setBulkForm] = useState({
    proxyStrings: '',
    group: 'default',
    type: 'http'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [proxiesResponse, groupsResponse] = await Promise.all([
        apiService.proxies.getAll(),
        apiService.proxies.getGroups()
      ]);
      
      setProxies(proxiesResponse.data.data || []);
      setGroups(groupsResponse.data.data || []);
    } catch (error) {
      setError('Ошибка загрузки данных: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProxy = async () => {
    try {
      if (editingProxy) {
        await apiService.proxies.update(editingProxy.id, proxyForm);
      } else {
        await apiService.proxies.create(proxyForm);
      }
      
      setOpenDialog(false);
      setEditingProxy(null);
      resetForm();
      await loadData();
    } catch (error) {
      setError('Ошибка сохранения прокси: ' + error.message);
    }
  };

  const handleBulkCreate = async () => {
    try {
      const proxyStrings = bulkForm.proxyStrings
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      if (proxyStrings.length === 0) {
        setError('Введите хотя бы один прокси');
        return;
      }
      
      await apiService.proxies.bulkCreate({
        proxyStrings,
        group: bulkForm.group,
        type: bulkForm.type
      });
      
      setOpenBulkDialog(false);
      setBulkForm({ proxyStrings: '', group: 'default', type: 'http' });
      await loadData();
    } catch (error) {
      setError('Ошибка массового создания прокси: ' + error.message);
    }
  };

  const handleEditProxy = (proxy) => {
    setEditingProxy(proxy);
    setProxyForm({
      name: proxy.name,
      host: proxy.host,
      port: proxy.port.toString(),
      username: proxy.username,
      password: proxy.password,
      type: proxy.type,
      group: proxy.group,
      description: proxy.description
    });
    setOpenDialog(true);
  };

  const handleDeleteProxy = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить этот прокси?')) {
      try {
        await apiService.proxies.delete(id);
        await loadData();
      } catch (error) {
        setError('Ошибка удаления прокси: ' + error.message);
      }
    }
  };

  const handleDeleteGroup = async (group) => {
    if (window.confirm(`Вы уверены, что хотите удалить группу "${group}" и все прокси в ней?`)) {
      try {
        await apiService.proxies.deleteGroup(group);
        await loadData();
      } catch (error) {
        setError('Ошибка удаления группы: ' + error.message);
      }
    }
  };

  const resetForm = () => {
    setProxyForm({
      name: '',
      host: '',
      port: '',
      username: '',
      password: '',
      type: 'http',
      group: 'default',
      description: ''
    });
  };

  const filteredProxies = selectedGroup === 'all' 
    ? proxies 
    : proxies.filter(proxy => proxy.group === selectedGroup);

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
          Управление прокси-серверами
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Статистика */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Статистика
                </Typography>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {proxies.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Всего прокси
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', mt: 2 }}>
                  <Typography variant="h4" color="success.main">
                    {groups.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Групп
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Группы */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Группы прокси
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                      const group = prompt('Введите название группы для удаления:');
                      if (group) handleDeleteGroup(group);
                    }}
                  >
                    Удалить группу
                  </Button>
                </Box>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip
                    label="Все"
                    color={selectedGroup === 'all' ? 'primary' : 'default'}
                    onClick={() => setSelectedGroup('all')}
                  />
                  {groups.map(group => (
                    <Chip
                      key={group}
                      label={group}
                      color={selectedGroup === group ? 'primary' : 'default'}
                      onClick={() => setSelectedGroup(group)}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Кнопки действий */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setEditingProxy(null);
                      resetForm();
                      setOpenDialog(true);
                    }}
                  >
                    Добавить прокси
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<UploadIcon />}
                    onClick={() => setOpenBulkDialog(true)}
                  >
                    Массовое добавление
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Таблица прокси */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Прокси-серверы {selectedGroup !== 'all' && `(группа: ${selectedGroup})`}
                </Typography>
                
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Название</TableCell>
                        <TableCell>Хост:Порт</TableCell>
                        <TableCell>Тип</TableCell>
                        <TableCell>Группа</TableCell>
                        <TableCell>Статус</TableCell>
                        <TableCell>Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredProxies.map((proxy) => (
                        <TableRow key={proxy.id}>
                          <TableCell>
                            <Typography variant="body2">
                              {proxy.name || `${proxy.host}:${proxy.port}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {proxy.host}:{proxy.port}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={proxy.type.toUpperCase()} size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip label={proxy.group} size="small" color="secondary" />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={proxy.status} 
                              size="small" 
                              color={proxy.status === 'active' ? 'success' : 'default'} 
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Редактировать">
                              <IconButton
                                size="small"
                                onClick={() => handleEditProxy(proxy)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Удалить">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteProxy(proxy.id)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Диалог создания/редактирования прокси */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingProxy ? 'Редактировать прокси' : 'Добавить прокси'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название"
            fullWidth
            variant="outlined"
            value={proxyForm.name}
            onChange={(e) => setProxyForm({ ...proxyForm, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Хост"
            fullWidth
            variant="outlined"
            value={proxyForm.host}
            onChange={(e) => setProxyForm({ ...proxyForm, host: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Порт"
            type="number"
            fullWidth
            variant="outlined"
            value={proxyForm.port}
            onChange={(e) => setProxyForm({ ...proxyForm, port: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Имя пользователя"
            fullWidth
            variant="outlined"
            value={proxyForm.username}
            onChange={(e) => setProxyForm({ ...proxyForm, username: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Пароль"
            type="password"
            fullWidth
            variant="outlined"
            value={proxyForm.password}
            onChange={(e) => setProxyForm({ ...proxyForm, password: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Тип прокси</InputLabel>
            <Select
              value={proxyForm.type}
              onChange={(e) => setProxyForm({ ...proxyForm, type: e.target.value })}
              label="Тип прокси"
            >
              <MenuItem value="http">HTTP</MenuItem>
              <MenuItem value="https">HTTPS</MenuItem>
              <MenuItem value="socks4">SOCKS4</MenuItem>
              <MenuItem value="socks5">SOCKS5</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            margin="dense"
            label="Группа"
            fullWidth
            variant="outlined"
            value={proxyForm.group}
            onChange={(e) => setProxyForm({ ...proxyForm, group: e.target.value })}
            sx={{ mb: 2 }}
          />
          
          <TextField
            margin="dense"
            label="Описание"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={proxyForm.description}
            onChange={(e) => setProxyForm({ ...proxyForm, description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Отмена</Button>
          <Button onClick={handleCreateProxy} variant="contained">
            {editingProxy ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог массового добавления */}
      <Dialog open={openBulkDialog} onClose={() => setOpenBulkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Массовое добавление прокси</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Введите прокси в формате: ip:port:username:password (по одному на строку)
          </Alert>
          
          <TextField
            autoFocus
            margin="dense"
            label="Прокси (по одному на строку)"
            fullWidth
            variant="outlined"
            multiline
            rows={10}
            value={bulkForm.proxyStrings}
            onChange={(e) => setBulkForm({ ...bulkForm, proxyStrings: e.target.value })}
            placeholder="154.36.110.240:6894:yhsbhuxt:c6xnievi0v70&#10;192.168.1.1:8080:user:pass&#10;..."
            sx={{ mb: 2 }}
          />
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Тип прокси</InputLabel>
            <Select
              value={bulkForm.type}
              onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value })}
              label="Тип прокси"
            >
              <MenuItem value="http">HTTP</MenuItem>
              <MenuItem value="https">HTTPS</MenuItem>
              <MenuItem value="socks4">SOCKS4</MenuItem>
              <MenuItem value="socks5">SOCKS5</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            margin="dense"
            label="Группа"
            fullWidth
            variant="outlined"
            value={bulkForm.group}
            onChange={(e) => setBulkForm({ ...bulkForm, group: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkDialog(false)}>Отмена</Button>
          <Button onClick={handleBulkCreate} variant="contained">
            Создать прокси
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Proxies;
