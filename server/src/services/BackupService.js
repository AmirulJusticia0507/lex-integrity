/**
 * BackupService — ekspor data inti (rules, users, roles) ke file JSON
 * di folder server/backups/. Dipakai oleh tombol manual di UI dan
 * jadwal otomatis (ScheduleService).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Rule from '../models/Rule.js';
import User from '../models/User.js';
import Role from '../models/Role.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
const DEFAULT_RETENTION_DAYS = 90;

function safeName(label) {
  const clean = String(label || 'manual').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return clean || 'manual';
}

export async function createBackup(label = 'manual') {
  const [rules, users, roles] = await Promise.all([
    Rule.findAll({ raw: true }),
    User.findAll({ raw: true }),
    Role.findAll({ raw: true })
  ]);

  // Jangan pernah menyimpan hash password dalam file backup
  const sanitizedUsers = users.map(({ password, ...rest }) => rest);

  const payload = {
    meta: {
      label: safeName(label),
      created_at: new Date().toISOString(),
      version: 1,
      counts: {
        rules: rules.length,
        users: sanitizedUsers.length,
        roles: roles.length
      }
    },
    rules,
    users: sanitizedUsers,
    roles
  };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(BACKUP_DIR, `${safeName(label)}_${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));

  return {
    file,
    filename: path.basename(file),
    size_bytes: fs.statSync(file).size,
    counts: payload.meta.counts
  };
}

/** Hapus backup lebih tua dari retentionDays. */
export function cleanupOld(retentionDays = DEFAULT_RETENTION_DAYS) {
  if (!fs.existsSync(BACKUP_DIR)) return { removed: 0 };
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    if (!f.endsWith('.json')) continue;
    const full = path.join(BACKUP_DIR, f);
    try {
      if (fs.statSync(full).mtimeMs < cutoff) {
        fs.unlinkSync(full);
        removed++;
      }
    } catch (error) {
      console.warn('[Backup] Gagal menghapus file lama:', f, error.message);
    }
  }
  return { removed };
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const full = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(full);
      return { filename: f, size_bytes: stat.size, created_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export default { createBackup, cleanupOld, listBackups, BACKUP_DIR };

