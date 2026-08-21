// Scraper untuk UN ILC Documentation (legal.un.org/ilc/documentation/)
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://legal.un.org';
const INDEX_URL = `${BASE_URL}/ilc/documentation/`;
const INDEX_BASE = `${BASE_URL}/ilc/documentation/`;
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'scripts', 'scraper');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'un_ilc_docs.json');

function resolveUrl(base, href) {
  try {
    return new URL(href, base).href;
  } catch {
    if (href.startsWith('http')) return href;
    if (href.startsWith('/')) return `${BASE_URL}${href}`;
    return `${BASE_URL}/${href}`;
  }
}

const DELAY_MS = 1500;
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LexIntegrityBot/1.0; +https://lex-integrity.example.com)'
        }
      });
      return res.data;
    } catch (err) {
      if (i === retries) throw err;
      console.warn(`Retry ${i + 1}/${retries} for ${url}: ${err.message}`);
      await sleep(2000 * (i + 1));
    }
  }
}

function parseSessionLinks(html) {
  const $ = cheerio.load(html);
  const sessions = [];

  // Cari semua link ke halaman docs.shtml
  $('a[href*="/sessions/"][href$="docs.shtml"]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    const match = text.match(/(\d{4}):\s*(\d+)(?:st|nd|rd|th)\s*session/i);
    if (match) {
      sessions.push({
        year: parseInt(match[1], 10),
        sessionNumber: parseInt(match[2], 10),
        url: resolveUrl(INDEX_BASE, href),
        label: text
      });
    }
  });

  // Dedup by URL
  const seen = new Set();
  return sessions.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

function parseDocuments(html, sessionInfo) {
  const $ = cheerio.load(html);
  const docs = [];

  // General Documents
  $('h3, h4').each((_, heading) => {
    const headingText = $(heading).text().trim().toLowerCase();
    if (!headingText.includes('general') && !headingText.includes('limited') && !headingText.includes('summary')) return;

    let currentTable = $(heading).nextUntil('h3, h4').filter('table').first();
    if (!currentTable.length) {
      // Coba cari table setelah heading
      currentTable = $(heading).nextAll('table').first();
    }

    currentTable.find('tr').each((_, row) => {
      const cells = $(row).find('td, th');
      if (cells.length < 2) return;

      const symbolCell = $(cells[0]);
      const titleCell = $(cells[1]);

      const symbolLink = symbolCell.find('a').first();
      const symbol = symbolLink.text().trim() || symbolCell.text().trim();
      const pdfUrl = symbolLink.attr('href');
      const fullPdfUrl = pdfUrl ? resolveUrl(sessionInfo.url, pdfUrl) : null;

      const title = titleCell.text().trim();
      const addLinks = [];
      titleCell.find('a').each((_, a) => {
        const href = $(a).attr('href');
        const txt = $(a).text().trim();
        if (href && txt) {
          addLinks.push({ symbol: txt, url: resolveUrl(sessionInfo.url, href) });
        }
      });

      if (symbol && title) {
        docs.push({
          session_year: sessionInfo.year,
          session_number: sessionInfo.sessionNumber,
          session_label: sessionInfo.label,
          doc_type: headingText.includes('general') ? 'General' : headingText.includes('limited') ? 'Limited' : 'SummaryRecord',
          symbol,
          title,
          pdf_url: fullPdfUrl,
          additional_docs: addLinks,
          source_url: sessionInfo.url,
          scraped_at: new Date().toISOString()
        });
      }
    });
  });

  return docs;
}

async function scrapeSession(sessionInfo) {
  console.log(`  Scraping ${sessionInfo.label} (${sessionInfo.year})...`);
  try {
    const html = await fetchWithRetry(sessionInfo.url);
    const docs = parseDocuments(html, sessionInfo);
    console.log(`    Found ${docs.length} documents`);
    return docs;
  } catch (err) {
    console.error(`    Error scraping ${sessionInfo.url}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('=== UN ILC Documentation Scraper ===');
  console.log(`Fetching index: ${INDEX_URL}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    const indexHtml = await fetchWithRetry(INDEX_URL);
    const sessions = parseSessionLinks(indexHtml);
    console.log(`Found ${sessions.length} sessions`);

    // Sort by year descending (newest first)
    sessions.sort((a, b) => b.year - a.year);

    const allDocs = [];
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const docs = await scrapeSession(session);
      allDocs.push(...docs);

      if (i < sessions.length - 1) await sleep(DELAY_MS);
    }

    // Save to JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allDocs, null, 2), 'utf-8');
    console.log(`\n=== Selesai ===`);
    console.log(`Total dokumen: ${allDocs.length}`);
    console.log(`Disimpan ke: ${OUTPUT_FILE}`);

    // Summary by type
    const byType = allDocs.reduce((acc, d) => {
      acc[d.doc_type] = (acc[d.doc_type] || 0) + 1;
      return acc;
    }, {});
    console.log('By type:', byType);

    // Summary by year
    const byYear = allDocs.reduce((acc, d) => {
      acc[d.session_year] = (acc[d.session_year] || 0) + 1;
      return acc;
    }, {});
    console.log('By year (top 10):', Object.entries(byYear).sort((a, b) => b[0] - a[0]).slice(0, 10));

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();