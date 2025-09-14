const fs = require('fs-extra');
const path = require('path');

class FormConfig {
  constructor(configData) {
    this.id = configData.id || `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = configData.name || 'Без названия';
    this.url = configData.url || '';
    this.title = configData.title || '';
    this.fields = configData.fields || [];
    this.submitAction = configData.submitAction || '';
    this.method = configData.method || 'POST';
    this.createdAt = configData.createdAt || new Date().toISOString();
    this.updatedAt = configData.updatedAt || new Date().toISOString();
    this.description = configData.description || '';
    this.tags = configData.tags || [];
  }

  static getConfigsFile() {
    return path.join(__dirname, '../../data/form-configs.json');
  }

  static async ensureDataDirectory() {
    const dataDir = path.dirname(this.getConfigsFile());
    await fs.ensureDir(dataDir);
  }

  async save() {
    try {
      await FormConfig.ensureDataDirectory();
      
      const configs = await FormConfig.getAll();
      const existingIndex = configs.findIndex(config => config.id === this.id);
      
      if (existingIndex >= 0) {
        configs[existingIndex] = this;
      } else {
        configs.push(this);
      }
      
      await fs.writeFile(FormConfig.getConfigsFile(), JSON.stringify(configs, null, 2));
      return this;
      
    } catch (error) {
      console.error('Ошибка сохранения конфигурации:', error);
      throw error;
    }
  }

  static async getAll() {
    try {
      await FormConfig.ensureDataDirectory();
      
      if (await fs.pathExists(FormConfig.getConfigsFile())) {
        const data = await fs.readFile(FormConfig.getConfigsFile(), 'utf8');
        return JSON.parse(data);
      }
      return [];
      
    } catch (error) {
      console.error('Ошибка загрузки конфигураций:', error);
      return [];
    }
  }

  static async getById(id) {
    const configs = await FormConfig.getAll();
    return configs.find(config => config.id === id);
  }

  static async deleteById(id) {
    try {
      const configs = await FormConfig.getAll();
      const filteredConfigs = configs.filter(config => config.id !== id);
      
      if (filteredConfigs.length === configs.length) {
        throw new Error('Конфигурация не найдена');
      }
      
      await fs.writeFile(FormConfig.getConfigsFile(), JSON.stringify(filteredConfigs, null, 2));
      return true;
      
    } catch (error) {
      console.error('Ошибка удаления конфигурации:', error);
      throw error;
    }
  }

  static async search(query) {
    const configs = await FormConfig.getAll();
    
    if (!query) {
      return configs;
    }
    
    const searchTerm = query.toLowerCase();
    
    return configs.filter(config => 
      config.name.toLowerCase().includes(searchTerm) ||
      config.title.toLowerCase().includes(searchTerm) ||
      config.description.toLowerCase().includes(searchTerm) ||
      config.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  static async getByTags(tags) {
    const configs = await FormConfig.getAll();
    
    if (!tags || tags.length === 0) {
      return configs;
    }
    
    return configs.filter(config => 
      tags.some(tag => config.tags.includes(tag))
    );
  }

  validate() {
    const errors = [];
    
    if (!this.name || this.name.trim() === '') {
      errors.push('Название конфигурации обязательно');
    }
    
    if (!this.url || this.url.trim() === '') {
      errors.push('URL формы обязателен');
    } else if (!this.isValidUrl(this.url)) {
      errors.push('Некорректный URL формы');
    }
    
    if (!this.fields || this.fields.length === 0) {
      errors.push('Конфигурация должна содержать хотя бы одно поле');
    }
    
    // Валидация полей
    this.fields.forEach((field, index) => {
      if (!field.name && !field.id) {
        errors.push(`Поле ${index + 1}: имя или ID обязательны`);
      }
      
      if (!field.type) {
        errors.push(`Поле ${index + 1}: тип поля обязателен`);
      }
    });
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  getFieldByName(name) {
    return this.fields.find(field => field.name === name);
  }

  getFieldById(id) {
    return this.fields.find(field => field.id === id);
  }

  addField(fieldData) {
    const field = {
      id: fieldData.id || `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: fieldData.name || '',
      type: fieldData.type || 'text',
      required: fieldData.required || false,
      placeholder: fieldData.placeholder || '',
      options: fieldData.options || [],
      defaultValue: fieldData.defaultValue || null
    };
    
    this.fields.push(field);
    return field;
  }

  removeField(fieldId) {
    const fieldIndex = this.fields.findIndex(field => field.id === fieldId);
    if (fieldIndex >= 0) {
      this.fields.splice(fieldIndex, 1);
      return true;
    }
    return false;
  }

  updateField(fieldId, updateData) {
    const field = this.getFieldById(fieldId);
    if (field) {
      Object.assign(field, updateData);
      return field;
    }
    return null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
      title: this.title,
      fields: this.fields,
      submitAction: this.submitAction,
      method: this.method,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      description: this.description,
      tags: this.tags
    };
  }
}

module.exports = FormConfig;
