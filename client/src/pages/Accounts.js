import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Box,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination
} from '@mui/material';
import {
  Add as AddIcon,
  Upload as UploadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  CloudUpload as CloudUploadIcon
} from '@mui/icons-material';
import { apiService } from '../services/apiService';

const Accounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [newAccount, setNewAccount] = useState({
    email: '',
    password: '',
    data: {}
  });
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openBulkDialog, setOpenBulkDialog] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiService.accounts.getAll();
      setAccounts(response.data.data || []);
    } catch (error) {
      setError('Ошибка загрузки аккаунтов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    try {
      setError(null);
      await apiService.accounts.upload([newAccount]);
      await loadAccounts();
      setOpenDialog(false);
      setNewAccount({ email: '', password: '', data: {} });
    } catch (error) {
      setError('Ошибка добавления аккаунта: ' + error.message);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (window.confirm('Вы уверены, что хотите удалить этот аккаунт?')) {
      try {
        await apiService.accounts.delete(id);
        await loadAccounts();
      } catch (error) {
        setError('Ошибка удаления аккаунта: ' + error.message);
      }
    }
  };

  const handleEditAccount = (account) => {
    setSelectedAccount(account);
    setNewAccount({
      email: account.email,
      password: account.password,
      data: account.data
    });
    setOpenDialog(true);
  };

  const handleUpdateAccount = async () => {
    try {
      setError(null);
      await apiService.accounts.update(selectedAccount.id, newAccount);
      await loadAccounts();
      setOpenDialog(false);
      setSelectedAccount(null);
      setNewAccount({ email: '', password: '', data: {} });
    } catch (error) {
      setError('Ошибка обновления аккаунта: ' + error.message);
    }
  };

  const parseBulkAccounts = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const accountsData = [];
    const errors = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Поддерживаем форматы: "почта;пароль" и "почта;пароль;резервная_почта"
      const parts = trimmedLine.split(';').map(part => part.trim());
      
      if (parts.length < 2) {
        errors.push(`Строка ${index + 1}: Недостаточно данных. Ожидается формат "почта;пароль" или "почта;пароль;резервная_почта"`);
        return;
      }

      const email = parts[0];
      const password = parts[1];
      const backupEmail = parts[2] || null;

      // Валидация email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Строка ${index + 1}: Неверный формат email: ${email}`);
        return;
      }

      if (!password) {
        errors.push(`Строка ${index + 1}: Пароль не может быть пустым`);
        return;
      }

      const account = {
        email: email,
        password: password,
        data: {}
      };

      // Добавляем резервную почту в дополнительные данные, если она есть
      if (backupEmail && emailRegex.test(backupEmail)) {
        account.data.backupEmail = backupEmail;
      } else if (backupEmail) {
        errors.push(`Строка ${index + 1}: Неверный формат резервной почты: ${backupEmail}`);
        return;
      }

      accountsData.push(account);
    });

    return { accountsData, errors };
  };

  const handleBulkAdd = async () => {
    try {
      setBulkLoading(true);
      setError(null);

      const { accountsData, errors } = parseBulkAccounts(bulkText);

      if (errors.length > 0) {
        setError(`Ошибки валидации:\n${errors.join('\n')}`);
        return;
      }

      if (accountsData.length === 0) {
        setError('Не найдено валидных аккаунтов для добавления');
        return;
      }

      await apiService.accounts.upload(accountsData);
      await loadAccounts();
      setOpenBulkDialog(false);
      setBulkText('');
      setError(null);
    } catch (error) {
      setError('Ошибка массового добавления аккаунтов: ' + error.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvText = e.target.result;
          const lines = csvText.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          const accountsData = [];

          for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = lines[i].split(',').map(v => v.trim());
              const account = {
                email: values[0] || '',
                password: values[1] || '',
                data: {}
              };

              // Добавляем дополнительные поля
              for (let j = 2; j < headers.length; j++) {
                if (values[j]) {
                  account.data[headers[j].toLowerCase()] = values[j];
                }
              }

              accountsData.push(account);
            }
          }

          await apiService.accounts.upload(accountsData);
          await loadAccounts();
          setError(null);
        } catch (error) {
          setError('Ошибка обработки CSV файла: ' + error.message);
        }
      };
      reader.readAsText(file);
    } else {
      setError('Пожалуйста, выберите CSV файл');
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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
            Управление аккаунтами
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              component="label"
            >
              Загрузить CSV
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={handleFileUpload}
              />
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => {
                setBulkText('');
                setOpenBulkDialog(true);
              }}
            >
              Массовое добавление
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedAccount(null);
                setNewAccount({ email: '', password: '', data: {} });
                setOpenDialog(true);
              }}
            >
              Добавить аккаунт
            </Button>
          </Box>
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
                placeholder="Поиск аккаунтов..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Пароль</TableCell>
                    <TableCell>Дополнительные данные</TableCell>
                    <TableCell>Создан</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAccounts
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>{account.email}</TableCell>
                      <TableCell>{'*'.repeat(account.password.length)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {Object.keys(account.data).map((key) => (
                            <Chip
                              key={key}
                              label={`${key}: ${account.data[key]}`}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {new Date(account.createdAt).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleEditAccount(account)}
                          title="Редактировать"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteAccount(account.id)}
                          title="Удалить"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={filteredAccounts.length}
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
          </CardContent>
        </Card>
      </Box>

      {/* Диалог добавления/редактирования аккаунта */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedAccount ? 'Редактировать аккаунт' : 'Добавить новый аккаунт'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email"
            fullWidth
            variant="outlined"
            value={newAccount.email}
            onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            label="Пароль"
            fullWidth
            variant="outlined"
            type="password"
            value={newAccount.password}
            onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
            Дополнительные данные (для заполнения полей формы):
          </Typography>
          <TextField
            margin="dense"
            label="Ключ"
            fullWidth
            variant="outlined"
            placeholder="например: имя"
            sx={{ mb: 1 }}
          />
          <TextField
            margin="dense"
            label="Значение"
            fullWidth
            variant="outlined"
            placeholder="например: Иван"
            sx={{ mb: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Отмена</Button>
          <Button
            onClick={selectedAccount ? handleUpdateAccount : handleAddAccount}
            variant="contained"
            startIcon={<AddIcon />}
          >
            {selectedAccount ? 'Обновить' : 'Добавить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог массового добавления аккаунтов */}
      <Dialog open={openBulkDialog} onClose={() => setOpenBulkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Массовое добавление Google аккаунтов
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Введите данные аккаунтов в формате:<br/>
            <strong>почта;пароль</strong> или <strong>почта;пароль;резервная_почта</strong><br/>
            Каждый аккаунт на новой строке.
          </Typography>
          <TextField
            autoFocus
            multiline
            rows={12}
            fullWidth
            variant="outlined"
            placeholder={`Пример:
attractcynthia70062@cccfd.cfd;AKA999aka;attractcynthia70062@gmail.com
user2@example.com;password123
user3@example.com;mypassword;backup@example.com`}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            sx={{ mt: 1 }}
          />
          {bulkText && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Найдено строк: {bulkText.split('\n').filter(line => line.trim()).length}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkDialog(false)}>Отмена</Button>
          <Button
            onClick={handleBulkAdd}
            variant="contained"
            startIcon={<CloudUploadIcon />}
            disabled={bulkLoading || !bulkText.trim()}
          >
            {bulkLoading ? <CircularProgress size={20} /> : 'Добавить аккаунты'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Accounts;
