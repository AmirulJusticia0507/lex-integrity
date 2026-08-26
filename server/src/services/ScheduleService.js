/**
 * ScheduleService — penjadwal otomatis (node-cron) untuk:
 * - Scraping berkala per sumber (jogja / sleman / queue multi-sumber)
 * - Backup database terjadwal
 *
 * Konfigurasi: server/scrape-schedule.json (dibuat otomatis bila belum ada,
 * silakan edit tanpa mengubah kode). Matikan semuanya via env:
 *   SCRAPE_SCHEDULE_ENABLED=false
 *
 * Terintegrasi scrapeLock: bila endpoint sedang discraping manual,
 * jadwal akan dilewati (skip) — dan sebaliknya.
 */
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const scrapeLock = require('../utils/scrapeLock');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'scrape-schedule.json');
const DEFAULT_JOGJA_ENDPOINT = 'https://spl.jogjaprov.go.id/dev-jdih-etalase/public/produk-hukum/';

const DEFAULT_CONFIG = {
  timezone: 'Asia/Jakarta',
  jobs: [
    {
      id: 'jogja-harian',
      type: 'jogja',
      cron: '0 1 * * *',
      enabled: true,
      params: { start: 1, end: 10, noClear: true }
    },
    {
      id: 'sleman-mingguan',
      type: 'sleman',
      cron: '0 3 * * 1',
      enabled: true
    },
    {
      id: 'backup-harian',
      type: 'backup',
      cron: '0 2 * * *',
      enabled: true,
      params: { label: 'harian' }
    },
    {
      id: 'backup-mingguan',
      type: 'backup',
      cron: '0 2 * * 0',
      enabled: true,
      params: { label: 'mingguan' }
    },
    {
      id: 'backup-bulanan',
      type: 'backup',
      cron: '0 2 1 * *',
      enabled: true,
      params: { label: 'bulanan' }
    }
  ],
  backup_retention_days: 90
};

function execAsync(cmd, options) {
  return new Promise((resolve) => {
    exec(cmd, options, (err, stdout, stderr) => resolve({ err, stdout, stderr }));
  });
}

class ScheduleService {
  constructor() {
    this.tasks = [];
    this.lastRuns = {};
    this.config = null;
    this.enabled = process.env.SCRAPE_SCHEDULE_ENABLED !== 'false';
  }

  init() {
    if (!this.enabled) {
      console.log('[Scheduler] Dinonaktifkan lewat SCRAPE_SCHEDULE_ENABLED=false');
      return;
    }

    // Buat file konfigurasi default bila belum ada agar mudah diedit user
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
      console.log(`[Scheduler] Konfigurasi default dibuat di ${CONFIG_PATH}`);
    }

    try {
      this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
      console.error('[Scheduler] Konfigurasi tidak valid, scheduler tidak berjalan:', error.message);
      return;
    }

    const timezone = this.config.timezone || 'Asia/Jakarta';
    for (const job of this.config.jobs || []) {
      if (job.enabled === false) continue;
      if (!job.id || !job.type || !cron.validate(job.cron || '')) {
        console.warn('[Scheduler] Job dilewati (id/type/cron tidak valid):', JSON.stringify(job));
        continue;
      }
      const task = cron.schedule(job.cron, () => this._runJob(job), { timezone });
      this.tasks.push({ id: job.id, task });
      console.log(`[Scheduler] Terjadwal "${job.id}" (${job.type}) → ${job.cron} [${timezone}]`);
    }

    if (this.tasks.length === 0) {
      console.log('[Scheduler] Tidak ada job aktif.');
    }
  }

  async _runJob(job) {
    const startedAt = new Date().toISOString();
    console.log(`[Scheduler] Menjalankan "${job.id}" ...`);
    let status = 'success';
    let message = '';
    try {
      switch (job.type) {
        case 'jogja':
          ({ message } = await this._runJogja(job));
          break;
        case 'sleman':
          ({ message } = await this._runSleman());
          break;
        case 'queue':
          ({ message } = await this._runQueue(job));
          break;
        case 'backup': {
          const BackupService = require('./BackupService');
          const result = await BackupService.createBackup(job.params?.label || 'terjadwal');
          BackupService.cleanupOld(this.config?.backup_retention_days);
          message = `Backup dibuat: ${result.filename}`;
          break;
        }
        default:
          status = 'skipped';
          message = `Tipe job tidak dikenal: ${job.type}`;
      }
    } catch (error) {
      status = 'failed';
      message = error.message;
      console.error(`[Scheduler] "${job.id}" gagal:`, error.message);
    }
    this.lastRuns[job.id] = { at: startedAt, finished_at: new Date().toISOString(), status, message };
    console.log(`[Scheduler] "${job.id}" selesai [${status}] ${message}`);
  }

  /** Scraping JDIH Jogja — sama seperti POST /api/actions/scrape-jogja. */
  async _runJogja(job) {
    const p = job.params || {};
    const endpoint = p.endpoint || DEFAULT_JOGJA_ENDPOINT;
    const start = parseInt(p.start) || 1;
    const end = parseInt(p.end) || 10;
    const noClear = p.noClear !== false;

    const lock = await scrapeLock.acquire(endpoint, 15 * 60);
    if (!lock.acquired) {
      return { skipped: true, message: `Endpoint sedang dipakai scraping lain, jadwal dilewati.` };
    }
    try {
      const cmd = `node "${path.join(__dirname, '..', 'scripts', 'loadJogjaJdih.js')}" --start ${start} --end ${end} ${noClear ? '--no-clear' : ''}`;
      const { err } = await execAsync(cmd, {
        maxBuffer: 1024 * 1024 * 10,
        timeout: 600000,
        env: { ...process.env, JOGJA_ENDPOINT: endpoint }
      });
      if (err) throw new Error(err.message);
      return { message: `Scraping halaman ${start}-${end} selesai` };
    } finally {
      await scrapeLock.release(endpoint);
    }
  }

  /** Scraping JDIH Sleman — sama seperti jalur sleman POST /api/actions/scrape. */
  async _runSleman() {
    const SLEMAN_ENDPOINT = 'jdih.slemankab.go.id';
    const outPath = path.join(__dirname, '..', '..', '..', 'scripts', 'scraper', 'sleman_rules_tmp.json');

    const lock = await scrapeLock.acquire(SLEMAN_ENDPOINT, 8 * 60);
    if (!lock.acquired) {
      return { skipped: true, message: `Endpoint sedang dipakai scraping lain, jadwal dilewati.` };
    }
    try {
      const cmd = `python "${path.join(process.cwd(), '..', '..', 'scripts', 'scraper', 'jdih_sleman_scraper.py')}" --no-pdf --output-json "${outPath}"`;
      const { err } = await execAsync(cmd, {
        maxBuffer: 1024 * 1024 * 5,
        cwd: path.join(__dirname, '..', '..'),
        timeout: 300000
      });
      if (err) throw new Error(err.message);
      return { message: 'Scraping Sleman selesai' };
    } finally {
      await scrapeLock.release(SLEMAN_ENDPOINT);
    }
  }

  /** Scraping multi-sumber via Bull queue — sama seperti jalur queue /actions/scrape. */
  async _runQueue(job) {
    const sources = Array.isArray(job.params?.sources) && job.params.sources.length > 0
      ? job.params.sources
      : ['jdih.slemankab.go.id'];

    const lockedSources = [];
    for (const src of sources) {
      const lock = await scrapeLock.acquire(src, 30 * 60);
      if (!lock.acquired) {
        for (const acquiredSrc of lockedSources) await scrapeLock.release(acquiredSrc);
        return { skipped: true, message: `Source "${src}" sedang dipakai scraping lain, jadwal dilewati.` };
      }
      lockedSources.push(src);
    }
    const CrawlerService = require('./CrawlerService');
    await CrawlerService.queueScheduledScrape(sources, `sched_${Date.now()}`);
    return { message: `Scraping dijadwalkan untuk: ${sources.join(', ')}` };
  }

  getStatus() {
    return {
      enabled: this.enabled,
      config_path: CONFIG_PATH,
      jobs: (this.config?.jobs || []).map((j) => ({
        id: j.id,
        type: j.type,
        cron: j.cron,
        enabled: j.enabled !== false,
        last_run: this.lastRuns[j.id] || null
      }))
    };
  }

  stopAll() {
    for (const { task } of this.tasks) task.stop();
    this.tasks = [];
  }
}

module.exports = new ScheduleService();
