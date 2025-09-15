import React from 'react';
import {
  TextField,
  FormControl,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Box,
  Typography
} from '@mui/material';

const FieldRenderer = ({ 
  field, 
  value, 
  onChange, 
  size = "small",
  fullWidth = true 
}) => {
  if (!field) return null;

  const handleChange = (newValue) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  switch (field.type) {
    case 'checkbox':
      return (
        <FormControlLabel
          control={
            <Checkbox
              checked={value === true || value === 'true'}
              onChange={(e) => handleChange(e.target.checked)}
              size={size}
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">
                {field.title}
              </Typography>
              {field.required && (
                <Chip label="*" size="small" color="error" />
              )}
            </Box>
          }
        />
      );
      
    case 'radio':
      return (
        <FormControl component="fieldset" fullWidth={fullWidth}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {field.title}
            {field.required && (
              <Chip label="*" size="small" color="error" sx={{ ml: 1 }} />
            )}
          </Typography>
          <RadioGroup
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            size={size}
          >
            {field.options?.map((option, index) => (
              <FormControlLabel
                key={index}
                value={option.value}
                control={<Radio size={size} />}
                label={option.label}
              />
            ))}
          </RadioGroup>
        </FormControl>
      );
      
    case 'select':
      return (
        <FormControl fullWidth={fullWidth} size={size}>
          <InputLabel>{field.title}</InputLabel>
          <Select
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            label={field.title}
            size={size}
          >
            {field.options?.map((option, index) => (
              <MenuItem key={index} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          {field.required && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
              Обязательное поле
            </Typography>
          )}
        </FormControl>
      );
      
    case 'textarea':
      return (
        <TextField
          fullWidth={fullWidth}
          multiline
          rows={3}
          label={field.title}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Введите ${field.title.toLowerCase()}`}
          size={size}
          required={field.required}
          helperText={field.required ? 'Обязательное поле' : ''}
        />
      );
      
    case 'number':
      return (
        <TextField
          fullWidth={fullWidth}
          type="number"
          label={field.title}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Введите ${field.title.toLowerCase()}`}
          size={size}
          required={field.required}
          helperText={field.required ? 'Обязательное поле' : ''}
        />
      );
      
    case 'email':
      return (
        <TextField
          fullWidth={fullWidth}
          type="email"
          label={field.title}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Введите ${field.title.toLowerCase()}`}
          size={size}
          required={field.required}
          helperText={field.required ? 'Обязательное поле' : ''}
        />
      );
      
    case 'date':
      return (
        <TextField
          fullWidth={fullWidth}
          type="date"
          label={field.title}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          size={size}
          required={field.required}
          helperText={field.required ? 'Обязательное поле' : ''}
          InputLabelProps={{ shrink: true }}
        />
      );
      
    case 'time':
      return (
        <TextField
          fullWidth={fullWidth}
          type="time"
          label={field.title}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          size={size}
          required={field.required}
          helperText={field.required ? 'Обязательное поле' : ''}
          InputLabelProps={{ shrink: true }}
        />
      );
      
    case 'url':
      return (
        <TextField
          fullWidth={fullWidth}
          type="url"
          label={field.title}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Введите ${field.title.toLowerCase()}`}
          size={size}
          required={field.required}
          helperText={field.required ? 'Обязательное поле' : ''}
        />
      );
      
    case 'tel':
      return (
        <TextField
          fullWidth={fullWidth}
          type="tel"
          label={field.title}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Введите ${field.title.toLowerCase()}`}
          size={size}
          required={field.required}
          helperText={field.required ? 'Обязательное поле' : ''}
        />
      );
      
    default:
      return (
        <TextField
          fullWidth={fullWidth}
          label={field.title}
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Введите ${field.title.toLowerCase()}`}
          size={size}
          required={field.required}
          helperText={field.required ? 'Обязательное поле' : ''}
        />
      );
  }
};

export default FieldRenderer;
