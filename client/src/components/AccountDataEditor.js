import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Select,
  MenuItem,
  InputLabel,
  Box,
  Typography,
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
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';

const AccountDataEditor = ({ 
  open, 
  onClose, 
  accountData, 
  setAccountData, 
  formFields, 
  selectedForm 
}) => {
  const [editingAccount, setEditingAccount] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Проверяем что formFields существует
  if (!formFields || !Array.isArray(formFields)) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>Редактирование данных аккаунтов</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="error">
            Ошибка: Не выбрана форма или форма не содержит полей
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    );
  }

  const handleEditAccount = (account) => {
    if (!account) return;
    
    // Инициализируем fields если его нет
    const accountWithFields = {
      ...account,
      fields: account.fields || {}
    };
    
    // Убеждаемся что все поля формы инициализированы
    formFields.forEach(field => {
      if (!field || !field.id) return;
      
      if (!(field.id in accountWithFields.fields)) {
        if (field.type === 'checkbox') {
          accountWithFields.fields[field.id] = false;
        } else if (field.type === 'radio') {
          accountWithFields.fields[field.id] = field.options?.[0]?.value || '';
        } else if (field.type === 'select') {
          accountWithFields.fields[field.id] = field.options?.[0]?.value || '';
        } else {
          accountWithFields.fields[field.id] = '';
        }
      }
    });
    
    setEditingAccount(accountWithFields);
  };

  const handleSaveAccount = () => {
    if (!editingAccount || !editingAccount.id || !editingAccount.fields) return;
    
    const newAccountData = accountData.map(acc => 
      acc.id === editingAccount.id ? editingAccount : acc
    );
    setAccountData(newAccountData);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (accountId) => {
    if (!accountId) return;
    
    if (window.confirm('Вы уверены, что хотите удалить этот аккаунт?')) {
      const newAccountData = accountData.filter(acc => acc.id !== accountId);
      setAccountData(newAccountData);
    }
  };

  const handleAddAccount = () => {
    if (!formFields || formFields.length === 0) return;
    
    const newAccount = {
      id: `account_${accountData.length + 1}`,
      name: `Аккаунт ${accountData.length + 1}`,
      fields: {}
    };
    
    // Инициализируем поля формы
    formFields.forEach(field => {
      if (!field || !field.id) return;
      
      if (field.type === 'checkbox') {
        newAccount.fields[field.id] = false;
      } else if (field.type === 'radio') {
        newAccount.fields[field.id] = field.options?.[0]?.value || '';
      } else if (field.type === 'select') {
        newAccount.fields[field.id] = field.options?.[0]?.value || '';
      } else {
        newAccount.fields[field.id] = '';
      }
    });
    
    setEditingAccount(newAccount);
  };

  const handleFieldChange = (fieldId, value) => {
    if (!editingAccount || !fieldId || !editingAccount.fields) return;
    
    setEditingAccount(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldId]: value
      }
    }));
  };

  const renderFieldEditor = (field) => {
    if (!field || !editingAccount || !field.id || !editingAccount.fields) return null;
    
    const value = editingAccount.fields[field.id] || '';
    
    switch (field.type) {
      case 'checkbox':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={value === true || value === 'true'}
                onChange={(e) => handleFieldChange(field.id, e.target.checked)}
              />
            }
            label={field.title}
          />
        );
        
      case 'radio':
        return (
          <FormControl component="fieldset">
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {field.title} {field.required && <Chip label="Обязательное" size="small" color="error" />}
            </Typography>
            <RadioGroup
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
            >
              {field.options.map((option, index) => (
                <FormControlLabel
                  key={index}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </FormControl>
        );
        
      case 'select':
        return (
          <FormControl fullWidth>
            <InputLabel>{field.title}</InputLabel>
            <Select
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              label={field.title}
            >
              {field.options.map((option, index) => (
                <MenuItem key={index} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
        
      case 'textarea':
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            label={field.title}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            helperText={field.required ? 'Обязательное поле' : ''}
          />
        );
        
      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={field.title}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            helperText={field.required ? 'Обязательное поле' : ''}
          />
        );
        
      case 'email':
        return (
          <TextField
            fullWidth
            type="email"
            label={field.title}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            helperText={field.required ? 'Обязательное поле' : ''}
          />
        );
        
      case 'date':
        return (
          <TextField
            fullWidth
            type="date"
            label={field.title}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            helperText={field.required ? 'Обязательное поле' : ''}
            InputLabelProps={{ shrink: true }}
          />
        );
        
      default:
        return (
          <TextField
            fullWidth
            label={field.title}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            required={field.required}
            helperText={field.required ? 'Обязательное поле' : ''}
          />
        );
    }
  };

  const getFieldDisplayValue = (field, value) => {
    if (!field || !field.id) return '-';
    
    switch (field.type) {
      case 'checkbox':
        return value === true || value === 'true' ? '✓' : '✗';
      case 'radio':
      case 'select':
        const option = field.options?.find(opt => opt.value === value);
        return option ? option.label : value;
      default:
        return value || '-';
    }
  };

  const handleChangePage = (event, newPage) => {
    if (newPage >= 0 && newPage !== null && newPage !== undefined && !isNaN(newPage)) {
      setPage(newPage);
    }
  };

  const handleChangeRowsPerPage = (event) => {
    if (!event || !event.target) return;
    
    const newRowsPerPage = parseInt(event.target.value, 10);
    if (newRowsPerPage > 0 && !isNaN(newRowsPerPage)) {
      setRowsPerPage(newRowsPerPage);
      setPage(0);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          Редактирование данных аккаунтов
          {selectedForm && (
            <Typography variant="subtitle2" color="text.secondary">
              Форма: {selectedForm.title}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddAccount}
              sx={{ mb: 2 }}
            >
              Добавить аккаунт
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Аккаунт</TableCell>
                  {formFields.map(field => (
                    <TableCell key={field.id}>
                      {field.title}
                      {field.required && <Chip label="*" size="small" color="error" sx={{ ml: 1 }} />}
                    </TableCell>
                  ))}
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accountData
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {account.name}
                        </Typography>
                      </TableCell>
                      {formFields.map(field => (
                        <TableCell key={field.id}>
                          <Typography variant="body2">
                            {getFieldDisplayValue(field, account.fields?.[field.id])}
                          </Typography>
                        </TableCell>
                      ))}
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
              count={accountData.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Строк на странице:"
            />
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования аккаунта */}
      <Dialog open={!!editingAccount} onClose={() => setEditingAccount(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Редактирование аккаунта: {editingAccount?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Название аккаунта"
              value={editingAccount?.name || ''}
              onChange={(e) => setEditingAccount(prev => ({ ...prev, name: e.target.value }))}
            />
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {formFields.map(field => (
              <Box key={field.id}>
                {renderFieldEditor(field)}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingAccount(null)}>Отмена</Button>
          <Button onClick={handleSaveAccount} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AccountDataEditor;
