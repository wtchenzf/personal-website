/**
 * stock-proxy — Cloudflare Worker v1.3
 * Proxies Yahoo Finance API with CORS + crumb/cookie auth.
 *
 * Endpoints
 *   GET /                                  → health check
 *   GET /quote?symbols=2330.TW,GC=F,...    → current price quotes
 *   GET /chart?symbol=2330.TW&range=3mo    → OHLC history
 *   GET /debug                             → cookie/crumb diagnostic
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const QUOTE_TTL = 60;
const CHART_TTL = 300;

// Browser-like headers to avoid bot detection
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,' +
    'image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
  'Pragma':          'no-cache',
  'Sec-Fetch-Dest':  'document',
  'Sec-Fetch-Mode':  'navigate',
  'Sec-Fetch-Site':  'none',
  'Sec-Fetch-User':  '?1',
  'Upgrade-Insecure-Requests': '1',
};

const API_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer':         'https://finance.yahoo.com/',
  'Origin':          'https://finance.yahoo.com',
  'Sec-Fetch-Dest':  'empty',
  'Sec-Fetch-Mode':  'cors',
  'Sec-Fetch-Site':  'same-site',
};

// Module-level crumb/cookie cache (survives across requests in same isolate)
let _crumb  = null;
let _cookie = null;
let _crumbTs = 0; // timestamp when crumb was last fetched

const CRUMB_TTL_MS = 30 * 60 * 1000; // re-fetch crumb after 30 min

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

/** Extract all cookies from a response's set-cookie header */
function extractCookies(res) {
  const raw = res.headers.get('set-cookie') || '';
  // Cookie header may contain multiple cookies separated by comma
  // We want the key=value pairs before the first semicolon of each
  const parts = raw.split(/,(?=[^ ])/);
  return parts
    .map(p => p.trim().split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/** Fetch a fresh crumb + cookie from Yahoo Finance */
async function refreshCrumb() {
  try {
    // Step 1: GET finance.yahoo.com to get session cookie
    const pageRes = await fetch('https://finance.yahoo.com/', {
      headers:  BROWSER_HEADERS,
      redirect: 'follow',
    });
    const cookie = extractCookies(pageRes);

    // Step 2: GET crumb endpoint (try both query1 and query2)
    let crumb = '';
    for (const host of [
      'https://query2.finance.yahoo.com',
      'https://query1.finance.yahoo.com',
    ]) {
      const crumbRes = await fetch(`${host}/v1/test/getcrumb`, {
        headers: { ...API_HEADERS, Cookie: cookie },
      });
      if (crumbRes.ok) {
        const text = await crumbRes.text();
        if (text && text !== 'null') { crumb = text.trim(); break; }
      }
    }

    if (cookie) _cookie = cookie;
    if (crumb)  { _crumb = crumb; _crumbTs = Date.now(); }

    return { crumb: _crumb, cookie: _cookie };
  } catch (e) {
    return { crumb: _crumb, cookie: _cookie, error: String(e) };
  }
}

async function getCrumb() {
  if (_crumb && _cookie && (Date.now() - _crumbTs) < CRUMB_TTL_MS) {
    return { crumb: _crumb, cookie: _cookie };
  }
  return refreshCrumb();
}

/** Fetch Yahoo Finance with crumb auth, auto-retry once on 401/403 */
async function yahooFetch(baseUrl) {
  let { crumb, cookie } = await getCrumb();

  const doFetch = (c, k) => {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = c ? `${baseUrl}${sep}crumb=${encodeURIComponent(c)}` : baseUrl;
    return fetch(url, {
      headers: { ...API_HEADERS, ...(k ? { Cookie: k } : {}) },
    });
  };

  let res = await doFetch(crumb, cookie);

  if (res.status === 401 || res.status === 403) {
    const fresh = await refreshCrumb();
    if (fresh.crumb) {
      res = await doFetch(fresh.crumb, fresh.cookie);
    }
  }

  return res;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'GET') {
      return jsonResp({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);

    // ── Health ──────────────────────────────────────────────────────────────
    if (url.pathname === '/') {
      return jsonResp({ status: 'ok', version: '1.3' });
    }

    // ── Debug ───────────────────────────────────────────────────────────────
    if (url.pathname === '/debug') {
      const { crumb, cookie, error } = await refreshCrumb();
      return jsonResp({
        crumbLength:  crumb  ? crumb.length  : 0,
        cookieLength: cookie ? cookie.length : 0,
        crumbSnippet: crumb  ? crumb.slice(0, 20)  : null,
        cookieSnippet:cookie ? cookie.slice(0, 60) : null,
        error: error || null,
      });
    }

    // ── /quote ──────────────────────────────────────────────────────────────
    if (url.pathname === '/quote') {
      const symbols = url.searchParams.get('symbols') || '';
      if (!symbols) return jsonResp({ error: 'symbols required' }, 400);

      const fields = [
        'regularMarketPrice', 'regularMarketChange',
        'regularMarketChangePercent', 'regularMarketVolume',
        'regularMarketPreviousClose', 'regularMarketOpen',
        'regularMarketDayHigh', 'regularMarketDayLow',
        'shortName', 'currency', 'marketState',
      ].join(',');

      const yahooUrl =
        `https://query2.finance.yahoo.com/v7/finance/quote` +
        `?symbols=${encodeURIComponent(symbols)}&fields=${fields}`;

      try {
        const res = await yahooFetch(yahooUrl);
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          return jsonResp({ error: `Yahoo ${res.status}`, detail: txt.slice(0, 200) }, 502);
        }
        return jsonResp(await res.json(), 200, QUOTE_TTL);
      } catch (e) {
        return jsonResp({ error: String(e) }, 502);
      }
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
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          return jsonResp({ error: `Yahoo ${res.status}`, detail: txt.slice(0, 200) }, 502);
        }
        return jsonResp(await res.json(), 200, CHART_TTL);
      } catch (e) {
        return jsonResp({ error: String(e) }, 502);
      }
    }

    return jsonResp({ error: 'Not found' }, 404);
  },
};
