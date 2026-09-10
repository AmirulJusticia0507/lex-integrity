export const CRAWLER_USER_AGENT = process.env.CRAWLER_USER_AGENT ||
    'LexIntegrityBot/1.0 (+https://lex-integrity.vercel.app; contact: amirulputra0507gmail.com)';

export const CRAWLER_DELAY_MS = parseInt(process.env.CRAWLER_DELAY_MS, 10) || 1500;

export function crawlerHeaders(extra = {}) {
    return {
        'User-Agent': CRAWLER_USER_AGENT,
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        ...extra,
    };
}

export function sleep(ms = CRAWLER_DELAY_MS) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function politeFetch(url, options = {}) {
    await sleep();
    return fetch(url, {
        ...options,
        headers: crawlerHeaders(options.headers || {}),
    });
}