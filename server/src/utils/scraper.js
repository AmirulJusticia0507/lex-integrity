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
  const meta = SOURCE_META[baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`] || {
    regime: 'Nasional',
    category: 'Peraturan',
    source: new URL(baseUrl).hostname.replace(/^www\./, ''),
  };

  const response = await fetch(baseUrl, {
    headers: {
      'User-Agent': 'LexIntegrityBot/1.0',
      'Accept': 'text/html,application/xhtml+xml',
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

export async function runScraper(config = {}) {
  const sources = Array.isArray(config.sources) ? config.sources : [];
  const results = [];
  for (const source of sources) {
    results.push(await scrapeSource(source));
  }
  return results;
}
