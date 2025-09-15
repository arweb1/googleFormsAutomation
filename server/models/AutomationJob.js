const fs = require('fs-extra');
const path = require('path');

class AutomationJob {
  constructor() {
    this.jobsFile = path.join(__dirname, '../../data/automation-jobs.json');
    this.ensureDataDirectory();
  }

  async ensureDataDirectory() {
    const dataDir = path.dirname(this.jobsFile);
    await fs.ensureDir(dataDir);
  }

  async getAll() {
    try {
      if (await fs.pathExists(this.jobsFile)) {
        const data = await fs.readFile(this.jobsFile, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Ошибка чтения задач:', error);
      return [];
    }
  }

  async save(jobs) {
    try {
      await fs.ensureDir(path.dirname(this.jobsFile));
      await fs.writeFile(this.jobsFile, JSON.stringify(jobs, null, 2));
    } catch (error) {
      console.error('Ошибка сохранения задач:', error);
      throw error;
    }
  }

  async create(jobData) {
    const jobs = await this.getAll();
    const job = {
      id: jobData.id,
      name: jobData.name,
      formConfigId: jobData.formConfigId,
      formTitle: jobData.formTitle,
      status: jobData.status || 'pending',
      startTime: jobData.startTime || new Date().toISOString(),
      endTime: null,
      totalAccounts: jobData.totalAccounts || 0,
      completedAccounts: jobData.completedAccounts || 0,
      failedAccounts: jobData.failedAccounts || 0,
      loginMode: jobData.loginMode || 'anonymous',
      error: null,
      logs: [],
      results: []
    };
    
    jobs.push(job);
    await this.save(jobs);
    return job;
  }

  async update(jobId, updates) {
    const jobs = await this.getAll();
    const jobIndex = jobs.findIndex(job => job.id === jobId);
    
    if (jobIndex === -1) {
      throw new Error('Задача не найдена');
    }
    
    jobs[jobIndex] = { ...jobs[jobIndex], ...updates };
    await this.save(jobs);
    return jobs[jobIndex];
  }

  async getById(jobId) {
    const jobs = await this.getAll();
    return jobs.find(job => job.id === jobId);
  }

  async delete(jobId) {
    const jobs = await this.getAll();
    const filteredJobs = jobs.filter(job => job.id !== jobId);
    await this.save(filteredJobs);
    return true;
  }

  async addLog(jobId, logEntry) {
    const job = await this.getById(jobId);
    if (job) {
      job.logs.push({
        timestamp: new Date().toISOString(),
        type: logEntry.type || 'info',
        message: logEntry.message,
        accountId: logEntry.accountId || null
      });
      
      // Ограничиваем количество логов (последние 100)
      if (job.logs.length > 100) {
        job.logs = job.logs.slice(-100);
      }
      
      await this.update(jobId, { logs: job.logs });
    }
  }

  async addResult(jobId, result) {
    const job = await this.getById(jobId);
    if (job) {
      job.results.push({
        timestamp: new Date().toISOString(),
        accountId: result.accountId,
        accountName: result.accountName || null,
        accountEmail: result.accountEmail || null,
        success: result.success,
        error: result.error || null,
        submittedAt: result.submittedAt || null,
        filledData: result.filledData || null // Данные, которыми заполнялась форма
      });
      
      await this.update(jobId, { results: job.results });
    }
  }

  // Очистка всех задач
  async clearAll() {
    try {
      await fs.writeFile(this.jobsFile, JSON.stringify([], null, 2));
      console.log('✅ Все задачи автоматизации удалены');
    } catch (error) {
      console.error('❌ Ошибка очистки задач:', error);
      throw error;
    }
  }
}

module.exports = AutomationJob;
