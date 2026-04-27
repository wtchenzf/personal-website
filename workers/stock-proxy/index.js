/**
 * stock-proxy — Cloudflare Worker v1.5
 * Proxies Yahoo Finance (quotes + OHLC) and TWSE (institutional chip data).
 *
 * Endpoints
 *   GET /                                   → health check
 *   GET /quote?symbols=2330.TW,GC=F,...     → Yahoo Finance quotes
 *   GET /chart?symbol=2330.TW&range=3mo     → Yahoo Finance OHLC
 *   GET /chips?symbol=2330                  → TWSE 三大法人 (last 20 trading days)
 *   GET /debug                              → crumb diagnostic
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const QUOTE_TTL = 60;
const CHART_TTL = 300;
const CHIP_TTL  = 3600; // TWSE updates at ~17:30 daily

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResp(data, status = 200, ttl = 0) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      ...(ttl ? { 'Cache-Control': `public, max-age=${ttl}` } : {}),
    },
  });
}

// ── Yahoo Finance helpers ─────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,' +
    'image/webp,image/apng,*/*;q=0.8',
  'Accept-Language':           'en-US,en;q=0.9',
  'Accept-Encoding':           'gzip, deflate, br',
  'Cache-Control':             'no-cache',
  'Sec-Fetch-Dest':            'document',
  'Sec-Fetch-Mode':            'navigate',
  'Sec-Fetch-Site':            'none',
  'Upgrade-Insecure-Requests': '1',
};
const API_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://finance.yahoo.com/',
  'Origin':          'https://finance.yahoo.com',
  'Sec-Fetch-Dest':  'empty',
  'Sec-Fetch-Mode':  'cors',
  'Sec-Fetch-Site':  'same-site',
};

let _crumb = null, _cookie = null, _crumbTs = 0;
const CRUMB_TTL_MS = 30 * 60 * 1000;

function extractCookies(res) {
  const raw = res.headers.get('set-cookie') || '';
  return raw.split(/,(?=[^ ])/).map(p => p.trim().split(';')[0].trim()).filter(Boolean).join('; ');
}
async function refreshCrumb() {
  try {
    const pageRes = await fetch('https://finance.yahoo.com/', { headers: BROWSER_HEADERS, redirect: 'follow' });
    const cookie  = extractCookies(pageRes);
    let crumb = '';
    for (const host of ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']) {
      const r = await fetch(`${host}/v1/test/getcrumb`, { headers: { ...API_HEADERS, Cookie: cookie } });
      if (r.ok) { const t = await r.text(); if (t && t !== 'null') { crumb = t.trim(); break; } }
    }
    if (cookie) _cookie = cookie;
    if (crumb)  { _crumb = crumb; _crumbTs = Date.now(); }
    return { crumb: _crumb, cookie: _cookie };
  } catch (e) { return { crumb: _crumb, cookie: _cookie }; }
}
async function getCrumb() {
  if (_crumb && _cookie && (Date.now() - _crumbTs) < CRUMB_TTL_MS) return { crumb: _crumb, cookie: _cookie };
  return refreshCrumb();
}
async function yahooFetch(baseUrl) {
  let { crumb, cookie } = await getCrumb();
  const doFetch = (c, k) => {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = c ? `${baseUrl}${sep}crumb=${encodeURIComponent(c)}` : baseUrl;
    return fetch(url, { headers: { ...API_HEADERS, ...(k ? { Cookie: k } : {}) } });
  };
  let res = await doFetch(crumb, cookie);
  if (res.status === 401 || res.status === 403) {
    const fresh = await refreshCrumb();
    if (fresh.crumb) res = await doFetch(fresh.crumb, fresh.cookie);
  }
  return res;
}

// ── TWSE chip data helpers ────────────────────────────────────────────────────

const TWSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept':     'application/json, text/plain, */*',
  'Referer':    'https://www.twse.com.tw/',
};

/** Parse TWSE number "1,234,567" → integer in 張 (÷1000 shares per lot) */
function parseShares(str) {
  if (!str) return 0;
  const n = parseInt(String(str).replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : Math.round(n / 1000);
}

/**
 * T86 field layout (三大法人買賣超日報):
 *  0  證券代號
 *  1  證券名稱
 *  2  外陸資買進股數(不含外資自營商)
 *  3  外陸資賣出股數(不含外資自營商)
 *  4  外陸資買賣超股數(不含外資自營商)   ← foreign
 *  5  外資自營商買進股數
 *  6  外資自營商賣出股數
 *  7  外資自營商買賣超股數
 *  8  投信買進股數
 *  9  投信賣出股數
 * 10  投信買賣超股數                      ← trust
 * 11  自營商買賣超股數                    ← dealer (合計 = 自行+避險)
 * 12..17  (自行買賣 / 避險 details)
 * 18  三大法人買賣超股數                  ← mainForce / total
 */
const T86_COL = { code: 0, foreign: 4, trust: 10, dealer: 11, mainForce: 18 };

/**
 * Fetch TWSE T86 for one trading day, extract the row for stockNo.
 * Returns a single chip record or null if no data.
 */
async function fetchT86Day(date, stockNo) {
  const url = `https://www.twse.com.tw/fund/T86?response=json&date=${date}&selectType=ALL`;
  try {
    const res = await fetch(url, { headers: TWSE_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.stat !== 'OK' || !Array.isArray(json.data)) return null;

    // Normalise stockNo for comparison (TWSE pads with spaces)
    const target = stockNo.trim().toUpperCase();
    const row = json.data.find(r => r[T86_COL.code]?.trim().toUpperCase() === target);
    if (!row) return null;

    return {
      time:      `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`,
      foreign:   parseShares(row[T86_COL.foreign]),
      trust:     parseShares(row[T86_COL.trust]),
      dealer:    parseShares(row[T86_COL.dealer]),
      mainForce: parseShares(row[T86_COL.mainForce]),
    };
  } catch (e) { return null; }
}

/**
 * Generate last N weekday dates as YYYYMMDD strings, starting from yesterday.
 * (Today's data is not available until ~17:30 CST)
 */
function lastNWeekdays(n) {
  const dates = [];
  // Start in Taiwan timezone — UTC+8
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 1); // start from yesterday
  while (dates.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) { // skip Sat/Sun
      const yyyy = d.getUTCFullYear();
      const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd   = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}${mm}${dd}`);
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return jsonResp({ error: 'Method not allowed' }, 405);

    const url = new URL(request.url);

    // ── Health ──────────────────────────────────────────────────────────────
    if (url.pathname === '/') return jsonResp({ status: 'ok', version: '1.5' });

    // ── Debug ───────────────────────────────────────────────────────────────
    if (url.pathname === '/debug') {
      const { crumb, cookie } = await refreshCrumb();
      return jsonResp({
        crumbLength:  crumb  ? crumb.length  : 0,
        cookieLength: cookie ? cookie.length : 0,
        crumbSnippet: crumb  ? crumb.slice(0, 20)  : null,
      });
    }

    // ── /quote ──────────────────────────────────────────────────────────────
    if (url.pathname === '/quote') {
      const symbols = url.searchParams.get('symbols') || '';
      if (!symbols) return jsonResp({ error: 'symbols required' }, 400);
      const fields = [
        'regularMarketPrice','regularMarketChange','regularMarketChangePercent',
        'regularMarketVolume','regularMarketPreviousClose','regularMarketOpen',
        'regularMarketDayHigh','regularMarketDayLow','shortName','currency','marketState',
      ].join(',');
      const yahooUrl =
        `https://query2.finance.yahoo.com/v7/finance/quote` +
        `?symbols=${encodeURIComponent(symbols)}&fields=${fields}`;
      try {
        const res = await yahooFetch(yahooUrl);
        if (!res.ok) { const t = await res.text().catch(()=>''); return jsonResp({ error: `Yahoo ${res.status}`, detail: t.slice(0,200) }, 502); }
        return jsonResp(await res.json(), 200, QUOTE_TTL);
      } catch (e) { return jsonResp({ error: String(e) }, 502); }
    }

    // ── /chart ──────────────────────────────────────────────────────────────
    if (url.pathname === '/chart') {
      const symbol   = url.searchParams.get('symbol')   || '2330.TW';
      const range    = url.searchParams.get('range')    || '3mo';
      const interval = url.searchParams.get('interval') || '1d';
      const yahooUrl =
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=${interval}&range=${range}&includePrePost=false`;
      try {
        const res = await yahooFetch(yahooUrl);
        if (!res.ok) { const t = await res.text().catch(()=>''); return jsonResp({ error: `Yahoo ${res.status}`, detail: t.slice(0,200) }, 502); }
        return jsonResp(await res.json(), 200, CHART_TTL);
      } catch (e) { return jsonResp({ error: String(e) }, 502); }
    }

    // ── /chips?symbol=2330 ───────────────────────────────────────────────────
    // Fetches last 20 trading days of 三大法人 from TWSE T86 in parallel.
    // Only works for TWSE-listed stocks (2330, 2454, etc.) — not futures/VIX.
    // Values in 張 (trading lots = 1000 shares).
    // Response: { chips: ChipRecord[], source: 'TWSE', days: number }
    if (url.pathname === '/chips') {
      const rawSymbol = url.searchParams.get('symbol') || '2330';
      // Strip exchange suffix, e.g. "2330.TW" → "2330"
      const stockNo = rawSymbol.replace(/\.[A-Z]+$/, '').replace(/[^0-9A-Za-z]/g, '');
      if (!stockNo) return jsonResp({ error: 'symbol required' }, 400);

      // How many trading days to fetch (max 40 to avoid timeout)
      const days = Math.min(parseInt(url.searchParams.get('days') || '40', 10), 40);

      try {
        const dates   = lastNWeekdays(days);
        const results = await Promise.all(dates.map(d => fetchT86Day(d, stockNo)));
        const chips   = results
          .filter(Boolean)
          .sort((a, b) => a.time.localeCompare(b.time));

        return jsonResp({ chips, source: 'TWSE', days: chips.length }, 200, CHIP_TTL);
      } catch (e) { return jsonResp({ error: String(e) }, 502); }
    }

    return jsonResp({ error: 'Not found' }, 404);
  },
};
