/**
 * Scrape Lock — mencegah scraping dobel dari endpoint yang sama.
 * Menggunakan Redis SET NX EX sebagai distributed lock:
 * - Request kedua dengan endpoint yang masih terkunci ditolak (409 di route).
 * - Lock otomatis lepas saat proses selesai (release eksplisit)
 *   atau kadaluarsa via TTL (jaring pengaman bila server mati mendadak).
 *
 * Fail-open: jika Redis tidak tersedia, scraping tetap diizinkan
 * agar fitur utama tidak mati hanya karena guard ini.
 */
import { createClient } from 'redis';

const KEY_PREFIX = 'lex:scrape_lock:';
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    reconnectStrategy: (options) => {
      if (options.total_retry_time > 1000 * 60 * 60) {
        return new Error('Redis reconnect time exceeded');
      }
      return options.errorCount > 10 ? new Error('Redis max retries reached') : null;
    }
  }
});

redis.on('error', (err) => console.error('[ScrapeLock] Redis error:', err.message));

let connectPromise = null;
function ensureConnected() {
  if (redis.isOpen) return Promise.resolve();
  if (!connectPromise) {
    connectPromise = redis.connect().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

const keyFor = (endpoint) => `${KEY_PREFIX}${encodeURIComponent(endpoint)}`;

/**
 * Coba kunci sebuah endpoint.
 * @param {string} endpoint Identitas endpoint/sumber scraping
 * @param {number} ttlSec Batas maksimal lock (detik), wajib lebih besar dari runtime terpanjang
 * @returns {Promise<{acquired: boolean, degraded?: boolean, started_at?: string, ttl?: number}>}
 */
export async function acquire(endpoint, ttlSec = 900) {
  try {
    await ensureConnected();
    const startedAt = new Date().toISOString();
    const result = await redis.set(keyFor(endpoint), JSON.stringify({ started_at: startedAt }), {
      NX: true,
      EX: Math.max(60, parseInt(ttlSec) || 900)
    });
    if (result === 'OK') return { acquired: true };
    const raw = await redis.get(keyFor(endpoint));
    let started_at = null;
    try { started_at = JSON.parse(raw)?.started_at || null; } catch { started_at = raw || null; }
    const ttl = await redis.ttl(keyFor(endpoint));
    return { acquired: false, started_at, ttl };
  } catch (error) {
    console.warn('[ScrapeLock] Tidak dapat menghubungi Redis, scraping diizinkan tanpa lock:', error.message);
    return { acquired: true, degraded: true };
  }
}

export async function release(endpoint) {
  if (endpoint == null) return;
  try {
    if (!redis.isOpen) return;
    await redis.del(keyFor(endpoint));
  } catch (error) {
    console.warn('[ScrapeLock] Gagal melepas lock:', error.message);
  }
}

export default { acquire, release };

