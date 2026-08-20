// Loader produk hukum dari JDIH Etalase DIY (spl.jogjaprov.go.id)
// API: https://spl.jogjaprov.go.id/dev-jdih-etalase/public/produk-hukum/
//   -> JSON: { success, paging:{page,size,total_item,total_page}, data:[...] }
//   -> 17813 dokumen, 10 per halaman, 1782 halaman. (per_page tidak support)
//
// Usage:
//   node src/scripts/loadJogjaJdih.js            # full import (clear + refetch)
//   node src/scripts/loadJogjaJdih.js --start 3 --end 5  # batch tertentu
//   node src/scripts/loadJogjaJdih.js --no-clear # jangan hapus data lama (upsert)
const { sequelize, Rule } = require('../models');
const { Op } = require('sequelize');

const SOURCE = 'jogja.prov.go.id';
const BASE_URL = 'https://spl.jogjaprov.go.id/dev-jdih-etalase/public/produk-hukum/';
const PAGE_SIZE = 10;
const CONCURRENCY = 5;

const argv = process.argv.slice(2);
const findArg = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const startFrom = parseInt(findArg('--start') || '1', 10);
const endAt = parseInt(findArg('--end') || '9999', 10);
const noClear = !!argv.includes('--no-clear');

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function makeRuleCode(rec) {
  // rec.id adalah primary key API → unik 100%.
  // Tetap beri konteks nomor/tahun bila ada.
  const core = rec.nomor && rec.tahun_terbit ? `${rec.nomor}-${rec.tahun_terbit}` : `id${rec.id}`;
  return `JOGJA-${core}-${rec.id}`;
}

function mapRecord(rec) {
  const regime = rec.kategori_hukam_name || 'Lain-lain';
  const theme = Array.isArray(rec.tema_produk_hukums) && rec.tema_produk_hukums.length
    ? rec.tema_produk_hukums.map(t => t.name).filter(Boolean).join(', ')
    : null;

  const meta = [];
  if (theme) meta.push(`Tema: ${theme}`);
  if (rec.download_count) meta.push(`Download: ${rec.download_count}`);
  if (rec.judul_lama) meta.push(`Judul lama: ${rec.judul_lama}`);
  const contentMeta = meta.length ? meta.join('\n') : null;

  return {
    rule_code: makeRuleCode(rec),
    title: (rec.judul_peraturan || '').slice(0, 497),
    regime,
    category: rec.kategori_hukam_name || 'Peraturan Daerah',
    content: contentMeta,
    is_active: String(rec.status_produk_hukam) === '1',
    publish_date: parseDate(rec.tanggal_pengundangan),
    source: SOURCE,
    pdf_url: rec.file_peraturan || null,
    slug: rec.slug || null,
    view_count: parseInt(rec.view_count, 10) || 0,
    download_count: parseInt(rec.download_count, 10) || 0,
    processed_at: new Date().toISOString(),
    processed_by: 'loader-jogja-jdih',
    processing_method: 'scrape'
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(pageNum) {
  const url = `${BASE_URL}?page=${pageNum}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${pageNum}`);
  return res.json();
}

async function run() {
  try {
    await sequelize.authenticate();
    await sequelize.query(`ALTER TABLE rules ADD COLUMN IF NOT EXISTS slug TEXT`);
    await sequelize.query(`ALTER TABLE rules ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0`);

    const first = await fetchPage(1);
    const totalPage = first.paging.total_page;
    const totalItem = first.paging.total_item;
    const endPage = Math.min(endAt, totalPage);
    console.log(`[${SOURCE}] Total dokumen: ${totalItem} | Halaman: ${totalPage}`);

    if (!noClear) {
      const del = await Rule.destroy({ where: { source: SOURCE } });
      console.log(`[${SOURCE}] Data lama dihapus: ${del} baris`);
    }

    const UPDATE_ON_DUP = ['title','regime','category','content','is_active','publish_date','pdf_url','slug','view_count','download_count','processed_at','processed_by','processing_method'];
    let totalInserted = 0;
    let fromPage = Math.max(startFrom, 1);

    for (let page = fromPage; page <= endPage; page += CONCURRENCY) {
      const batch = [];
      for (let p = page; p < page + CONCURRENCY && p <= endPage; p++) {
        batch.push(fetchPage(p));
      }
      const results = await Promise.allSettled(batch.map(p => p.catch(e => { console.error(e.message); return null; })));

      for (let i = 0; i < results.length; i++) {
        const res = results[i].status === 'fulfilled' ? results[i].value : null;
        const p = page + i;
        if (!res || !res.success || !Array.isArray(res.data)) {
          console.log(`[${SOURCE}] Page ${p}: kosong/gagal`);
          continue;
        }
        const mapped = res.data
          .filter(r => r && r.judul_peraturan)
          .map(mapRecord);
        if (mapped.length) {
          const created = await Rule.bulkCreate(mapped, { updateOnDuplicate: UPDATE_ON_DUP, validate: false });
          const inserted = created.filter(r => r === true || (r && r.isNewRecord === true)).length;
          totalInserted += mapped.length;
        }
        console.log(`[${SOURCE}] Page ${p} — processed ${res.data.length} records`);
      }
      await sleep(80);
    }

    const srcCount = await Rule.count({ where: { source: SOURCE } });
    console.log(`[${SOURCE}] SELESAI. Total di DB dari source ini: ${srcCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

run();
