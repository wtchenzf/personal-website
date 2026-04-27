/**
 * stock-proxy — Cloudflare Worker
 * Proxies Yahoo Finance API requests with CORS headers so the
 * browser-side React app can fetch market data without being blocked.
 *
 * Endpoints
 *   GET /            → health check
 *   GET /quote?symbols=2330.TW,GC=F,...   → current price quotes
 *   GET /chart?symbol=2330.TW&range=3mo   → OHLC candlestick history
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const YAHOO = 'https://query1.finance.yahoo.com';
const UA    = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

// Cache quote responses for 60 s, chart responses for 5 min
const QUOTE_TTL = 60;
const CHART_TTL = 300;

function jsonResp(data, status = 200, ttl = 0) {
  const headers = {
    ...CORS,
    'Content-Type': 'application/json',
    ...(ttl ? { 'Cache-Control': `public, max-age=${ttl}` } : {}),
  };
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env, ctx) {
    // Pre-flight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'GET') {
      return jsonResp({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);

    // ── Health check ─────────────────────────────────────────────────────────
    if (url.pathname === '/') {
      return jsonResp({ status: 'ok', version: '1.1' });
    }

    // ── /quote?symbols=2330.TW,GC=F,SI=F ─────────────────────────────────────
    if (url.pathname === '/quote') {
      const symbols = url.searchParams.get('symbols') || '';
      if (!symbols) return jsonResp({ error: 'symbols required' }, 400);

      const fields = [
        'regularMarketPrice',
        'regularMarketChange',
        'regularMarketChangePercent',
        'regularMarketVolume',
        'regularMarketPreviousClose',
        'regularMarketOpen',
        'regularMarketDayHigh',
        'regularMarketDayLow',
        'shortName',
        'currency',
        'marketState',
      ].join(',');

      const yahooUrl =
        `${YAHOO}/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=${fields}`;

      try {
        const res = await fetch(yahooUrl, { headers: { 'User-Agent': UA } });
        if (!res.ok) return jsonResp({ error: `Yahoo returned ${res.status}` }, 502);
        const data = await res.json();
        return jsonResp(data, 200, QUOTE_TTL);
      } catch (e) {
        return jsonResp({ error: String(e) }, 502);
      }
    }

    // ── /chart?symbol=2330.TW&range=3mo&interval=1d ───────────────────────────
    if (url.pathname === '/chart') {
      const symbol   = url.searchParams.get('symbol')   || '2330.TW';
      const range    = url.searchParams.get('range')    || '3mo';
      const interval = url.searchParams.get('interval') || '1d';

      const yahooUrl =
        `${YAHOO}/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=${interval}&range=${range}&includePrePost=false`;

      try {
        const res = await fetch(yahooUrl, { headers: { 'User-Agent': UA } });
        if (!res.ok) return jsonResp({ error: `Yahoo returned ${res.status}` }, 502);
        const data = await res.json();
        return jsonResp(data, 200, CHART_TTL);
      } catch (e) {
        return jsonResp({ error: String(e) }, 502);
      }
    }

    return jsonResp({ error: 'Not found' }, 404);
  },
};
