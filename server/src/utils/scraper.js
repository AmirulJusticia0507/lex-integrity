import * as cheerio from 'cheerio';
import crypto from 'crypto';
import Rule from '../models/Rule.js';

const SOURCE_META = {
  'https://peraturan.bpk.go.id/': {
    regime: 'Nasional',
    category: 'Peraturan BPK',
    source: 'peraturan.bpk.go.id',
  },
  'https://jdih.kpk.go.id/': {
    regime: 'Komisi Pemberantasan Korupsi',
    category: 'Peraturan KPK',
    source: 'jdih.kpk.go.id',
  },
};

const KPK_API = 'https://jdih.kpk.go.id/api';

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function codeFor(source, url) {
  const host = new URL(source).hostname.replace(/^www\./, '').split('.')[0].toUpperCase();
  return `${host}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}`;
}

function looksLikeRule(text, href) {
  const haystack = `${text} ${href}`.toLowerCase();
  return /(peraturan|putusan|undang|instruksi|surat-edaran|pdf|jdih|detail)/i.test(haystack);
}

async function scrapeSource(sourceUrl) {
  const baseUrl = sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`;
  if (baseUrl.includes('peraturan.bpk.go.id')) return scrapeBpk();
  if (baseUrl.includes('jdih.kpk.go.id')) return scrapeKpk();

  const meta = SOURCE_META[baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`] || {
    regime: 'Nasional',
    category: 'Peraturan',
    source: new URL(baseUrl).hostname.replace(/^www\./, ''),
  };

  const response = await fetch(baseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 LexIntegrityBot/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  if (!response.ok) throw new Error(`${baseUrl} HTTP ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();

  $('a[href]').each((_, element) => {
    const link = $(element);
    const href = link.attr('href');
    const title = clean(link.text() || link.attr('title') || href);
    if (!href || !title || title.length < 6 || !looksLikeRule(title, href)) return;

    const url = new URL(href, baseUrl).toString();
    if (seen.has(url)) return;
    seen.add(url);

    rows.push({
      rule_code: codeFor(baseUrl, url),
      title: title.slice(0, 500),
      regime: meta.regime,
      category: meta.category,
      content: title,
      is_active: true,
      source: meta.source,
      source_url: url,
      pdf_url: url.toLowerCase().includes('.pdf') ? url : null,
      processed_at: new Date(),
      processed_by: 'generic-web-scraper',
      processing_method: 'metadata-link-scrape',
    });
  });

  const limited = rows.slice(0, 100);
  if (limited.length > 0) {
    await Rule.bulkCreate(limited, {
      updateOnDuplicate: [
        'title', 'regime', 'category', 'content', 'is_active',
        'source', 'source_url', 'pdf_url', 'processed_at',
        'processed_by', 'processing_method', 'updated_at'
      ],
      validate: false,
    });
  }

  return { source: baseUrl, found: rows.length, imported: limited.length };
}

async function bulkInsert(rows) {
  let imported = 0;
  const batchSize = 1000;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await Rule.bulkCreate(batch, {
      updateOnDuplicate: [
        'title', 'regime', 'category', 'content', 'is_active',
        'publish_date', 'source', 'source_url', 'pdf_url', 'processed_at',
        'processed_by', 'processing_method', 'updated_at'
      ],
      validate: false,
    });
    imported += batch.length;
  }
  return imported;
}

async function scrapeBpk() {
  const baseUrl = 'https://peraturan.bpk.go.id/Search?jenis=27';
  const response = await fetch(baseUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Referer': 'https://peraturan.bpk.go.id/',
    },
  });
  if (!response.ok) throw new Error(`${baseUrl} HTTP ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();

  $('a[href*="/Details/"]').each((_, element) => {
    const link = $(element);
    const sourceUrl = new URL(link.attr('href'), 'https://peraturan.bpk.go.id/').toString();
    if (seen.has(sourceUrl)) return;
    seen.add(sourceUrl);

    const title = clean(link.text());
    if (!title || title.length < 6) return;
    const year = sourceUrl.match(/tahun-(\d{4})/)?.[1] || title.match(/Tahun\s+(\d{4})/i)?.[1] || null;

    rows.push({
      rule_code: codeFor('https://peraturan.bpk.go.id/', sourceUrl),
      title: title.slice(0, 500),
      regime: 'Nasional',
      category: 'Peraturan BPK',
      content: title,
      is_active: true,
      publish_date: year ? `${year}-01-01` : null,
      source: 'peraturan.bpk.go.id',
      source_url: sourceUrl,
      processed_at: new Date(),
      processed_by: 'bpk-search-scraper',
      processing_method: 'metadata-link-scrape',
    });
  });

  const imported = await bulkInsert(rows);
  return { source: baseUrl, found: rows.length, imported };
}

async function scrapeKpk() {
  const [produkResponse, jenisResponse] = await Promise.all([
    fetch(`${KPK_API}/produk-hukum-dt?`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),
    fetch(`${KPK_API}/jenis/`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),
  ]);
  if (!produkResponse.ok) throw new Error(`${KPK_API}/produk-hukum-dt HTTP ${produkResponse.status}`);

  const produkJson = await produkResponse.json();
  const jenisJson = jenisResponse.ok ? await jenisResponse.json() : { data: {} };
  const jenisById = Object.values(jenisJson.data || {}).reduce((acc, item) => {
    acc[item.id] = item.nama;
    return acc;
  }, {});

  const rows = (produkJson.data?.results || []).map((item) => {
    const title = clean(item.judul || item.tentang || `Produk Hukum KPK ${item.id}`);
    const year = item.tahun || String(item.tgl_ditetapkan || item.tgl_diundangkan || '').slice(0, 4);
    return {
      rule_code: `KPK-${item.id}`,
      title: title.slice(0, 500),
      regime: 'Komisi Pemberantasan Korupsi',
      category: jenisById[item.id_jenis] || 'Produk Hukum KPK',
      content: clean(item.tentang || title),
      is_active: true,
      publish_date: /^\d{4}$/.test(String(year)) ? `${year}-01-01` : null,
      source: 'jdih.kpk.go.id',
      source_url: `https://jdih.kpk.go.id/produk-hukum/${item.id}`,
      processed_at: new Date(),
      processed_by: 'kpk-api-scraper',
      processing_method: 'api-metadata-scrape',
    };
  });

  const imported = await bulkInsert(rows);
  return { source: `${KPK_API}/produk-hukum-dt`, found: rows.length, imported };
}

export async function runScraper(config = {}) {
  const sources = Array.isArray(config.sources) ? config.sources : [];
  const results = [];
  for (const source of sources) {
    results.push(await scrapeSource(source));
  }
  return results;
}
