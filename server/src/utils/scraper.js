import * as cheerio from 'cheerio';
import crypto from 'crypto';
import Rule from '../models/Rule.js';
import { politeFetch, sleep } from './crawlerPolicy.js';

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
const MA_DOKUMEN_URL = 'https://jdih.mahkamahagung.go.id/dokumen';
const MKRI_ROOT_URL = 'https://jdih.mkri.id/';
const MKRI_PERATURAN_URL = 'https://jdih.mkri.id/produk-hukum/peraturan/pmk';
const MKRI_PUTUSAN_URL = 'https://jdih.mkri.id/produk-hukum/putusan';
const MKRI_MONTHS = {
  januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
  juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
};

function parseCompactNumber(value) {
  const match = clean(value).match(/([\d.]+)\s*([KM])?/i);
  if (!match) return 0;
  const number = parseFloat(match[1]);
  const multiplier = match[2]?.toUpperCase() === 'K' ? 1000 : match[2]?.toUpperCase() === 'M' ? 1000000 : 1;
  return Math.round(number * multiplier);
}

function parseYear(value) {
  return clean(value).match(/\b(19|20)\d{2}\b/)?.[0] || null;
}

function parseIndonesianDate(value) {
  const match = clean(value).match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/i);
  if (!match || !MKRI_MONTHS[match[2].toLowerCase()]) return null;
  return `${match[3]}-${MKRI_MONTHS[match[2].toLowerCase()]}-${match[1].padStart(2, '0')}`;
}

function withPage(baseUrl, page) {
  const url = new URL(baseUrl);
  if (page > 1) url.searchParams.set('page', String(page));
  else url.searchParams.delete('page');
  return url.toString();
}

function lastPageFromHtml($) {
  let lastPage = 1;
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href') || '';
    const match = href.match(/[?&]page=(\d+)/);
    if (match) lastPage = Math.max(lastPage, parseInt(match[1], 10));
  });
  if (lastPage > 1) return lastPage;

  const showing = clean($('body').text()).match(/(?:of|dari)\s+([\d.]+)\s+items/i);
  if (showing) return Math.ceil(parseFloat(showing[1].replace('.', '')) / 10);
  return 1;
}

async function fetchHtml(url) {
  const response = await politeFetch(url, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

function maRuleCode(url) {
  return `MA-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 20)}`;
}

async function scrapeMaDokumen() {
  const firstHtml = await fetchHtml(MA_DOKUMEN_URL);
  const first$ = cheerio.load(firstHtml);
  const lastPage = lastPageFromHtml(first$);
  const rows = [];
  const seen = new Set();

  for (let page = 1; page <= lastPage; page += 1) {
    const pageUrl = withPage(MA_DOKUMEN_URL, page);
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    $('.event-item-metal').each((_, item) => {
      const link = $(item).find('h3 a[href*="/legal-product/"]').first();
      const detailUrl = link.attr('href');
      if (!detailUrl || seen.has(detailUrl)) return;
      seen.add(detailUrl);

      const title = clean(link.text());
      const itemText = clean($(item).text());
      const infoText = clean($(item).find('.event-info-list-metal').text());
      const year = parseYear(infoText);
      const viewed = itemText.match(/([\d.]+)\s*([KM])?\s*x dilihat/i);
      const publisher = itemText.match(/Penerbit:\s*(.*?)(?:Lokasi:|$)/i)?.[1] || '';
      const location = itemText.match(/Lokasi:\s*(.*)$/i)?.[1] || '';

      rows.push({
        rule_code: maRuleCode(new URL(detailUrl, MA_DOKUMEN_URL).toString()),
        title: title.slice(0, 500),
        regime: 'Mahkamah Agung RI',
        category: 'Dokumen Mahkamah Agung',
        content: clean(`${title} ${publisher} ${location}`),
        is_active: true,
        publish_date: year ? `${year}-01-01` : null,
        source: 'jdih.mahkamahagung.go.id',
        source_url: new URL(detailUrl, MA_DOKUMEN_URL).toString(),
        view_count: parseCompactNumber(viewed?.[0]),
        processed_at: new Date(),
        processed_by: 'scraper-jdih-mahkamah-agung',
        processing_method: 'html-pagination-scrape',
      });
    });
  }

  const imported = await bulkInsert(rows);
  return {
    source: MA_DOKUMEN_URL,
    found: rows.length,
    imported,
    pages: lastPage,
    total: rows.length,
  };
}

function mkriRuleCode(type, url, title) {
  const fingerprint = crypto.createHash('sha1').update(`${url}:${title}`).digest('hex').slice(0, 16);
  return `MKRI-${type}-${fingerprint}`;
}

async function scrapeMkriListing(listingUrl, type) {
  const firstHtml = await fetchHtml(listingUrl);
  const first$ = cheerio.load(firstHtml);
  const lastPage = lastPageFromHtml(first$);
  const rows = [];
  const seen = new Set();

  for (let page = 1; page <= lastPage; page += 1) {
    const pageUrl = withPage(listingUrl, page);
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    $('.feature-box').each((_, item) => {
      const title = clean($(item).find('.feature-title').first().text());
      const itemText = clean($(item).text());
      const pdfHref = $(item).find('a[href*=".pdf" i]').first().attr('href');
      const pdfUrl = pdfHref ? new URL(pdfHref, listingUrl).toString() : null;
      const identity = pdfUrl || `${pageUrl}:${title}`;
      if (!title || seen.has(identity)) return;
      seen.add(identity);

      rows.push({
        rule_code: mkriRuleCode(type, identity, title),
        title: title.slice(0, 500),
        regime: 'Mahkamah Konstitusi RI',
        category: type === 'peraturan' ? 'Peraturan Mahkamah Konstitusi' : 'Putusan Mahkamah Konstitusi',
        content: itemText.slice(0, 20000),
        is_active: true,
        publish_date: parseIndonesianDate(itemText),
        source: 'jdih.mkri.id',
        source_url: pdfUrl || listingUrl,
        pdf_url: pdfUrl,
        processed_at: new Date(),
        processed_by: 'scraper-jdih-mkri',
        processing_method: 'html-pagination-scrape',
      });
    });
  }

  return { rows, pages: lastPage };
}

async function scrapeMkriProdukHukum() {
  const [peraturan, putusan] = await Promise.all([
    scrapeMkriListing(MKRI_PERATURAN_URL, 'peraturan'),
    scrapeMkriListing(MKRI_PUTUSAN_URL, 'putusan'),
  ]);
  const rows = [...peraturan.rows, ...putusan.rows];
  const imported = await bulkInsert(rows);
  return {
    source: MKRI_ROOT_URL,
    found: rows.length,
    imported,
    pages: peraturan.pages + putusan.pages,
    category_counts: {
      peraturan: peraturan.rows.length,
      putusan: putusan.rows.length,
    },
    total: rows.length,
  };
}

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

  const response = await politeFetch(baseUrl, {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
  const response = await politeFetch(baseUrl, {
    headers: {
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
  const produkResponse = await politeFetch(`${KPK_API}/produk-hukum-dt?`, { headers: { 'Accept': 'application/json' } });
  await sleep();
  const jenisResponse = await politeFetch(`${KPK_API}/jenis/`, { headers: { 'Accept': 'application/json' } });
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
