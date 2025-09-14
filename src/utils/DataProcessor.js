const fs = require('fs-extra');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const logger = require('./logger');

class DataProcessor {
  constructor() {
    this.data = [];
  }

  async loadDataFromCSV(filePath) {
    try {
      logger.info(`Загрузка данных из CSV: ${filePath}`);
      
      return new Promise((resolve, reject) => {
        const results = [];
        
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => {
            this.data = results;
            logger.info(`Загружено ${results.length} записей`);
            resolve(results);
          })
          .on('error', reject);
      });
    } catch (error) {
      logger.error('Ошибка при загрузке CSV:', error);
      throw error;
    }
  }

  async loadDataFromJSON(filePath) {
    try {
      logger.info(`Загрузка данных из JSON: ${filePath}`);
      const data = await fs.readJson(filePath);
      this.data = Array.isArray(data) ? data : [data];
      logger.info(`Загружено ${this.data.length} записей`);
      return this.data;
    } catch (error) {
      logger.error('Ошибка при загрузке JSON:', error);
      throw error;
    }
  }

  async saveDataToCSV(filePath, data = this.data) {
    try {
      if (data.length === 0) {
        throw new Error('Нет данных для сохранения');
      }

      const headers = Object.keys(data[0]).map(key => ({
        id: key,
        title: key
      }));

      const csvWriter = createCsvWriter({
        path: filePath,
        header: headers
      });

      await csvWriter.writeRecords(data);
      logger.info(`Данные сохранены в CSV: ${filePath}`);
    } catch (error) {
      logger.error('Ошибка при сохранении CSV:', error);
      throw error;
    }
  }

  async saveDataToJSON(filePath, data = this.data) {
    try {
      await fs.writeJson(filePath, data, { spaces: 2 });
      logger.info(`Данные сохранены в JSON: ${filePath}`);
    } catch (error) {
      logger.error('Ошибка при сохранении JSON:', error);
      throw error;
    }
  }

  validateDataAgainstForm(data, formConfig) {
    const errors = [];
    const requiredFields = formConfig.fields.filter(field => field.required);

    data.forEach((record, index) => {
      requiredFields.forEach(field => {
        if (!record[field.name] || record[field.name].toString().trim() === '') {
          errors.push(`Строка ${index + 1}: Поле "${field.name}" обязательно для заполнения`);
        }
      });

      // Проверка типов данных
      formConfig.fields.forEach(field => {
        const value = record[field.name];
        if (value && !this.validateFieldValue(value, field)) {
          errors.push(`Строка ${index + 1}: Неверный формат поля "${field.name}"`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  validateFieldValue(value, field) {
    switch (field.type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      
      case 'phone':
        return /^[\+]?[0-9\s\-\(\)]+$/.test(value);
      
      case 'number':
        return !isNaN(Number(value));
      
      case 'date':
        return !isNaN(Date.parse(value));
      
      case 'time':
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      
      case 'select':
      case 'radio':
        return field.options.some(option => option.value === value);
      
      case 'checkbox':
        if (Array.isArray(value)) {
          return value.every(v => field.options.some(option => option.value === v));
        }
        return field.options.some(option => option.value === value);
      
      default:
        return true;
    }
  }

  generateSampleData(formConfig, count = 5) {
    const sampleData = [];

    for (let i = 0; i < count; i++) {
      const record = { id: i + 1 };
      
      formConfig.fields.forEach(field => {
        record[field.name] = this.generateSampleValue(field, i);
      });
      
      sampleData.push(record);
    }

    return sampleData;
  }

  generateSampleValue(field, index) {
    const samples = {
      'text': [`Имя ${index + 1}`, `Фамилия ${index + 1}`, `Компания ${index + 1}`],
      'email': [`user${index + 1}@example.com`, `test${index + 1}@gmail.com`],
      'phone': [`+7 (999) ${100 + index}-${10 + index}-${20 + index}`, `8 (999) ${200 + index}-${30 + index}-${40 + index}`],
      'number': [index + 1, (index + 1) * 10, (index + 1) * 100],
      'textarea': [`Это пример текста номер ${index + 1}`, `Длинный текст для поля ${index + 1}`],
      'date': ['2024-01-01', '2024-02-15', '2024-03-30'],
      'time': ['09:00', '14:30', '18:45'],
      'select': field.options?.map(option => option.value) || ['Вариант 1'],
      'radio': field.options?.map(option => option.value) || ['Вариант 1'],
      'checkbox': field.options?.map(option => option.value) || ['Вариант 1']
    };

    const fieldSamples = samples[field.type] || ['Значение'];
    return fieldSamples[index % fieldSamples.length];
  }

  async mergeDataWithFormConfig(data, formConfig) {
    const mergedData = data.map(record => {
      const mergedRecord = { ...record };
      
      formConfig.fields.forEach(field => {
        if (!mergedRecord[field.name]) {
          mergedRecord[field.name] = field.value || this.getDefaultValue(field);
        }
      });
      
      return mergedRecord;
    });

    return mergedData;
  }

  getDefaultValue(field) {
    const defaults = {
      'text': '',
      'email': '',
      'phone': '',
      'number': 0,
      'textarea': '',
      'date': new Date().toISOString().split('T')[0],
      'time': '12:00',
      'select': field.options?.[0]?.value || '',
      'radio': field.options?.[0]?.value || '',
      'checkbox': []
    };
    
    return defaults[field.type] || '';
  }

  async createDataTemplate(formConfig, outputPath, format = 'csv') {
    try {
      const sampleData = this.generateSampleData(formConfig, 1);
      
      if (format === 'csv') {
        await this.saveDataToCSV(outputPath, sampleData);
      } else {
        await this.saveDataToJSON(outputPath, sampleData);
      }
      
      logger.info(`Шаблон данных создан: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Ошибка при создании шаблона:', error);
      throw error;
    }
  }
}

module.exports = DataProcessor;
