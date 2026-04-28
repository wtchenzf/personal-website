/**
 * stock-proxy — Cloudflare Worker v1.8
 * Proxies Yahoo Finance (quotes + OHLC) and TWSE (chip data + stock scanner + market data).
 *
 * Endpoints
 *   GET /                                   → health check
 *   GET /quote?symbols=2330.TW,GC=F,...     → Yahoo Finance quotes
 *   GET /chart?symbol=2330.TW&range=3mo     → Yahoo Finance OHLC (3 months)
 *   GET /chips?symbol=2330&days=40          → TWSE T86 三大法人 (last N trading days)
 *   GET /scan                               → TWSE 全市場掃描：潛力飆股 + 破底翻
 *   GET /market?days=30                     → TWSE 融資餘額 (MI_MARGN) + 三大法人大盤買賣超 (BFI82U)
 *   GET /debug                              → crumb diagnostic
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const QUOTE_TTL  = 60;
const CHART_TTL  = 300;
const CHIP_TTL   = 3600;   // TWSE updates at ~17:30 daily
const SCAN_TTL   = 1800;   // 30 min cache for scan results
const MARKET_TTL = 3600;   // 1 hour cache for market indicators

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
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};
const API_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
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
    const u = c ? `${baseUrl}${sep}crumb=${encodeURIComponent(c)}` : baseUrl;
    return fetch(u, { headers: { ...API_HEADERS, ...(k ? { Cookie: k } : {}) } });
  };
  let res = await doFetch(crumb, cookie);
  if (res.status === 401 || res.status === 403) {
    const fresh = await refreshCrumb();
    if (fresh.crumb) res = await doFetch(fresh.crumb, fresh.cookie);
  }
  return res;
}

// ── TWSE helpers ──────────────────────────────────────────────────────────────

const TWSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.twse.com.tw/',
};

/** Parse TWSE number string and convert shares → 張 (÷1000) */
function parseShares(str) {
  if (!str) return 0;
  const n = parseInt(String(str).replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : Math.round(n / 1000);
}

/** Parse price string, returns null for "--" / missing */
function parsePrice(str) {
  if (!str || str === '--' || str === 'X') return null;
  const v = parseFloat(String(str).replace(/,/g, ''));
  return isNaN(v) ? null : v;
}

/** Parse volume/amount integer string */
function parseVol(str) {
  if (!str || str === '--') return 0;
  const v = parseInt(String(str).replace(/,/g, ''), 10);
  return isNaN(v) ? 0 : v;
}

/**
 * Generate last N weekday dates (Taiwan timezone UTC+8).
 * Starts from yesterday to avoid incomplete current-day data.
 */
function lastNWeekdays(n) {
  const dates = [];
  const now = new Date(Date.now() + 8 * 3600 * 1000); // shift to TW time
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 1);
  while (dates.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
      const yyyy = d.getUTCFullYear();
      const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd   = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}${mm}${dd}`);
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates;
}

// ── T86 三大法人 (chip data per stock) ───────────────────────────────────────

/** T86 column layout */
const T86 = { code: 0, foreign: 4, trust: 10, dealer: 11, mainForce: 18 };

async function fetchT86Day(date, stockNo) {
  const url = `https://www.twse.com.tw/fund/T86?response=json&date=${date}&selectType=ALL`;
  try {
    const res = await fetch(url, { headers: TWSE_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.stat !== 'OK' || !Array.isArray(json.data)) return null;

    const target = stockNo.trim().toUpperCase();
    const row = json.data.find(r => r[T86.code]?.trim().toUpperCase() === target);
    if (!row) return null;

    return {
      time:      `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`,
      foreign:   parseShares(row[T86.foreign]),
      trust:     parseShares(row[T86.trust]),
      dealer:    parseShares(row[T86.dealer]),
      mainForce: parseShares(row[T86.mainForce]),
    };
  } catch { return null; }
}

// ── STOCK_DAY_ALL (all-stocks daily data for scanner) ─────────────────────────

/** STOCK_DAY_ALL column layout */
const SDAY = { code: 0, name: 1, vol: 2, amt: 3, open: 4, high: 5, low: 6, close: 7, chg: 8 };

async function fetchStockDayAll(date) {
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json&date=${date}`;
  try {
    const res = await fetch(url, { headers: TWSE_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.stat !== 'OK' || !Array.isArray(json.data) || !json.data.length) return null;

    const map = new Map();
    for (const row of json.data) {
      const code = String(row[SDAY.code] ?? '').trim();
      // Only regular 4-digit TWSE listed stocks
      if (!/^\d{4}$/.test(code)) continue;
      const close = parsePrice(row[SDAY.close]);
      const vol   = parseVol(row[SDAY.vol]);
      if (!close || close <= 0 || vol <= 0) continue;
      map.set(code, {
        name:  String(row[SDAY.name] ?? '').trim().replace(/\s+/g, ''),
        close, vol,
        amt:   parseVol(row[SDAY.amt]),
        open:  parsePrice(row[SDAY.open]) ?? close,
        high:  parsePrice(row[SDAY.high]) ?? close,
        low:   parsePrice(row[SDAY.low])  ?? close,
        chg:   parsePrice(row[SDAY.chg])  ?? 0,
      });
    }
    return { date, map };
  } catch { return null; }
}

/**
 * Screen stocks for 潛力飆股 (momentum) and 破底翻 (reversal).
 * @param {Array<{date, map}>} days  Sorted ascending, latest last.
 */
function screenStocks(days) {
  const n = days.length;
  if (n < 2) return { rockets: [], reversals: [], scanDate: '' };

  const latest   = days[n - 1];
  const scanDate = `${latest.date.slice(4,6)}/${latest.date.slice(6,8)}`;
  const rockets  = [], reversals = [];

  for (const [code, td] of latest.map) {
    // ── Basic liquidity filters ──────────────────────────────────────────────
    if (td.close < 20)             continue; // skip penny stocks
    if (td.vol   < 500_000)        continue; // min 50 萬股
    if (td.amt   < 50_000_000)     continue; // min 0.5 億成交額

    // ── Build price/volume history ───────────────────────────────────────────
    const hist = days.slice(0, -1).map(d => d.map.get(code)).filter(Boolean);
    if (hist.length < 2) continue;

    const prev = hist[hist.length - 1]; // yesterday
    if (!prev.close) continue;

    const changePct = (td.close - prev.close) / prev.close * 100;

    // 5-day avg volume (use however many prior days we have, max 4)
    const prevVols = hist.slice(-4).map(h => h.vol).filter(v => v > 0);
    const avgVol   = prevVols.length ? prevVols.reduce((a,b) => a+b, 0) / prevVols.length : td.vol;
    const volRatio = td.vol / avgVol;

    // ── 潛力飆股: momentum breakout ─────────────────────────────────────────
    // Criteria: up 2-9.5%, volume ≥ 1.5×, bullish candle (close ≥ open)
    if (changePct >= 2 && changePct < 9.6 && volRatio >= 1.5 && td.close >= td.open) {
      const tags = [`量增${volRatio.toFixed(1)}×`, `漲幅+${changePct.toFixed(1)}%`];
      if (volRatio >= 3) tags.push('量創新高');
      if (changePct >= 6) tags.push('強勢突破');
      rockets.push({
        code, name: td.name,
        price: td.close, chg: td.chg, changePct: +changePct.toFixed(2),
        vol: td.vol, volRatio: +volRatio.toFixed(2), tags, scanDate,
        strength: Math.min(99, Math.round(changePct * 5 + volRatio * 10)),
      });
    }

    // ── 破底翻: reversal after recent weakness ───────────────────────────────
    // Criteria: recent 2 days had ≥1 down day (-1.5%), today bounces ≥2.5%
    const recentPcts = [];
    for (let i = hist.length - 2; i < hist.length - 0; i++) {
      if (i < 1) continue;
      const pct = (hist[i].close - hist[i-1].close) / hist[i-1].close * 100;
      recentPcts.push(pct);
    }
    const wasWeak = recentPcts.some(p => p < -1.5);

    if (wasWeak && changePct >= 2.5 && volRatio >= 1.3) {
      const priorLowClose = Math.min(...hist.slice(-3).map(h => h.low || h.close));
      const recoverPct = (td.close - priorLowClose) / priorLowClose * 100;
      reversals.push({
        code, name: td.name,
        price: td.close, chg: td.chg, changePct: +changePct.toFixed(2),
        vol: td.vol, volRatio: +volRatio.toFixed(2),
        recoverPct: +recoverPct.toFixed(1), tags: ['破底翻', `反彈+${recoverPct.toFixed(1)}%`, `量增${volRatio.toFixed(1)}×`],
        scanDate,
        strength: Math.min(99, Math.round(changePct * 4 + volRatio * 8 + recoverPct * 1.5)),
      });
    }
  }

  const score = s => s.changePct * s.volRatio;
  rockets.sort((a, b) => score(b) - score(a));
  reversals.sort((a, b) => score(b) - score(a));

  return {
    rockets:   rockets.slice(0, 8),
    reversals: reversals.slice(0, 8),
    scanDate,
    source: 'TWSE',
  };
}

// ── TWSE Market Indicator helpers ─────────────────────────────────────────────

/**
 * Fetch one day of 融資餘額 from TWSE MI_MARGN.
 * Returns { time:'YYYY-MM-DD', value: 億元 } or null.
 */
async function fetchMarginDay(date) {
  const url = `https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&date=${date}&selectType=ALL`;
  try {
    const res = await fetch(url, { headers: TWSE_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.stat !== 'OK') return null;

    // tables[0] = 信用交易統計
    // Columns: [項目, 買進, 賣出, 現金(券)償還, 前日餘額, 今日餘額]
    // Row "融資金額(仟元)" → today's balance in 千元
    const rows = json.tables?.[0]?.data ?? [];
    for (const row of rows) {
      if (/融資金額/.test(String(row[0] ?? ''))) {
        const raw = String(row[5] ?? '').replace(/,/g, '');
        const k = parseInt(raw, 10); // 千元
        if (!isNaN(k) && k > 1e8) {  // sanity: > 1,000億
          const time = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
          return { time, value: +(k / 100000).toFixed(1) }; // 千元 → 億元
        }
      }
    }
    return null;
  } catch { return null; }
}

/**
 * Fetch one day of 三大法人大盤買賣超 from TWSE BFI82U.
 * Returns { time:'YYYY-MM-DD', value: 億元, color } or null.
 */
async function fetchInstDay(date) {
  const url = `https://www.twse.com.tw/fund/BFI82U?response=json&dayDate=${date}&type=day`;
  try {
    const res = await fetch(url, { headers: TWSE_HEADERS });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.stat !== 'OK') return null;

    // Columns: [機構, 買進金額, 賣出金額, 買賣差額]; last row = 合計
    const data = json.data ?? [];
    let totalRow = data.find(r => String(r[0] ?? '').includes('合計'));
    if (!totalRow) totalRow = data[data.length - 1];
    if (!totalRow) return null;

    const raw = String(totalRow[3] ?? '').replace(/,/g, '');
    const nt = parseInt(raw, 10); // NT$
    if (isNaN(nt)) return null;

    const net = +(nt / 1e8).toFixed(1); // 元 → 億元
    const time = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;
    return { time, value: net, color: net >= 0 ? '#c0392b' : '#4a7c59' };
  } catch { return null; }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return jsonResp({ error: 'Method not allowed' }, 405);

    const url = new URL(request.url);

    // ── Health ──────────────────────────────────────────────────────────────
    if (url.pathname === '/') return jsonResp({ status: 'ok', version: '1.8' });

    // ── Debug ───────────────────────────────────────────────────────────────
    if (url.pathname === '/debug') {
      const { crumb, cookie } = await refreshCrumb();
      return jsonResp({ crumbLength: crumb?.length ?? 0, cookieLength: cookie?.length ?? 0, crumbSnippet: crumb?.slice(0, 20) ?? null });
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
      const yahooUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=${fields}`;
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
      const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
      try {
        const res = await yahooFetch(yahooUrl);
        if (!res.ok) { const t = await res.text().catch(()=>''); return jsonResp({ error: `Yahoo ${res.status}`, detail: t.slice(0,200) }, 502); }
        return jsonResp(await res.json(), 200, CHART_TTL);
      } catch (e) { return jsonResp({ error: String(e) }, 502); }
    }

    // ── /chips?symbol=2330&days=40 ───────────────────────────────────────────
    if (url.pathname === '/chips') {
      const rawSymbol = url.searchParams.get('symbol') || '2330';
      const stockNo   = rawSymbol.replace(/\.[A-Z]+$/, '').replace(/[^0-9A-Za-z]/g, '');
      if (!stockNo) return jsonResp({ error: 'symbol required' }, 400);
      const days = Math.min(parseInt(url.searchParams.get('days') || '40', 10), 40);
      try {
        const dates  = lastNWeekdays(days);
        const items  = await Promise.all(dates.map(d => fetchT86Day(d, stockNo)));
        const chips  = items.filter(Boolean).sort((a, b) => a.time.localeCompare(b.time));
        return jsonResp({ chips, source: 'TWSE', days: chips.length }, 200, CHIP_TTL);
      } catch (e) { return jsonResp({ error: String(e) }, 502); }
    }

    // ── /scan ────────────────────────────────────────────────────────────────
    // Full-market scanner using TWSE STOCK_DAY_ALL for the last 6 trading days.
    // Screens all TSE-listed 4-digit stocks for:
    //   潛力飆股: price up 2–9.5%, volume ≥ 1.5× 5-day avg, bullish candle
    //   破底翻:   prior 2-day weakness (-1.5%), today bounces ≥ 2.5% with volume ≥ 1.3×
    // Returns top 8 of each, sorted by changePct × volRatio score.
    if (url.pathname === '/scan') {
      try {
        const dates      = lastNWeekdays(6);
        const dayResults = await Promise.all(dates.map(fetchStockDayAll));
        const validDays  = dayResults
          .filter(Boolean)
          .sort((a, b) => a.date.localeCompare(b.date));

        if (validDays.length < 2) {
          return jsonResp({ rockets: [], reversals: [], scanDate: '', message: 'Not enough data' }, 200, 300);
        }

        const result = screenStocks(validDays);
        return jsonResp(result, 200, SCAN_TTL);
      } catch (e) { return jsonResp({ error: String(e) }, 502); }
    }

    // ── /market?days=30 ─────────────────────────────────────────────────────
    // Fetches last N trading days of:
    //   融資餘額     (TWSE MI_MARGN)  — margin balance in 億元
    //   三大法人買賣超 (TWSE BFI82U)  — institutional net buy/sell in 億元
    if (url.pathname === '/market') {
      try {
        const n     = Math.min(parseInt(url.searchParams.get('days') || '30', 10), 60);
        const dates = lastNWeekdays(n);

        const [marginItems, instItems] = await Promise.all([
          Promise.all(dates.map(fetchMarginDay)),
          Promise.all(dates.map(fetchInstDay)),
        ]);

        const margin = marginItems.filter(Boolean).sort((a, b) => a.time.localeCompare(b.time));
        const inst   = instItems.filter(Boolean).sort((a, b) => a.time.localeCompare(b.time));

        return jsonResp({ margin, inst, source: 'TWSE' }, 200, MARKET_TTL);
      } catch (e) { return jsonResp({ error: String(e) }, 502); }
    }

    return jsonResp({ error: 'Not found' }, 404);
  },
};
