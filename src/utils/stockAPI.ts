/**
 * stockAPI — thin fetch layer for the stock-proxy Cloudflare Worker.
 *
 * Set VITE_STOCK_API_URL in .env.local (or Cloudflare Pages env vars)
 * to the worker URL, e.g.:
 *   VITE_STOCK_API_URL=https://stock-proxy.YOUR_ACCOUNT.workers.dev
 *
 * If the variable is absent every call returns an empty result and the
 * app falls back to mock/seed data automatically.
 */

import { type OHLCData, type ChipData } from './technicalIndicators';

const BASE = (import.meta.env.VITE_STOCK_API_URL as string | undefined) ?? '';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface QuoteResult {
  symbol:      string;
  price:       number;
  change:      number;
  changePct:   number;
  open:        number;
  dayHigh:     number;
  dayLow:      number;
  volume:      number;
  prevClose:   number;
  currency:    string;
  marketState: string;  // 'REGULAR' | 'PRE' | 'POST' | 'CLOSED'
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toYMD(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch current-price quotes for one or more Yahoo Finance symbols in one call. */
export async function fetchQuotes(symbols: string[]): Promise<QuoteResult[]> {
  if (!BASE || !symbols.length) return [];

  const res = await fetch(`${BASE}/quote?symbols=${symbols.join(',')}`);
  if (!res.ok) throw new Error(`Quote HTTP ${res.status}`);

  const json = await res.json();
  const results: any[] = json?.quoteResponse?.result ?? [];

  return results.map(r => ({
    symbol:      r.symbol                      ?? '',
    price:       r.regularMarketPrice          ?? 0,
    change:      r.regularMarketChange         ?? 0,
    changePct:   r.regularMarketChangePercent  ?? 0,
    open:        r.regularMarketOpen           ?? 0,
    dayHigh:     r.regularMarketDayHigh        ?? 0,
    dayLow:      r.regularMarketDayLow         ?? 0,
    volume:      r.regularMarketVolume         ?? 0,
    prevClose:   r.regularMarketPreviousClose  ?? 0,
    currency:    r.currency                    ?? 'TWD',
    marketState: r.marketState                 ?? 'CLOSED',
  }));
}

/**
 * Fetch OHLC daily bars for one symbol and convert to OHLCData[].
 * `range` accepts Yahoo Finance range tokens: '1mo' '3mo' '6mo' '1y' etc.
 */
export async function fetchOHLC(
  symbol: string,
  range: string = '3mo',
): Promise<OHLCData[]> {
  if (!BASE) return [];

  const url = `${BASE}/chart?symbol=${encodeURIComponent(symbol)}&range=${range}&interval=1d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chart HTTP ${res.status}`);

  const json   = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return [];

  const timestamps: number[]  = result.timestamp ?? [];
  const q                     = result.indicators?.quote?.[0] ?? {};
  const opens   = q.open   as (number | null)[];
  const highs   = q.high   as (number | null)[];
  const lows    = q.low    as (number | null)[];
  const closes  = q.close  as (number | null)[];
  const volumes = q.volume as (number | null)[];

  return timestamps
    .map((ts, i): OHLCData | null => {
      const close = closes?.[i];
      if (close == null) return null;
      return {
        time:   toYMD(ts),
        open:   opens?.[i]   ?? close,
        high:   highs?.[i]   ?? close,
        low:    lows?.[i]    ?? close,
        close,
        volume: volumes?.[i] ?? 0,
      };
    })
    .filter((d): d is OHLCData => d !== null)
    .sort((a, b) => a.time.localeCompare(b.time));
}

// ── Scanner result types ──────────────────────────────────────────────────────

export interface ScannedStock {
  code:       string;
  name:       string;
  price:      number;
  chg:        number;      // price change amount (NT$)
  changePct:  number;      // percentage change
  vol:        number;      // shares traded
  volRatio:   number;      // today vs 5-day avg
  recoverPct?: number;     // reversal only: bounce % from recent low
  tags:       string[];    // auto-generated signal tags
  scanDate:   string;      // 'MM/DD'
  strength:   number;      // 0–99 signal score
}

export interface ScanResult {
  rockets:   ScannedStock[];
  reversals: ScannedStock[];
  scanDate:  string;       // 'MM/DD' of the trading day scanned
  source:    'TWSE';
}

/** Run full-market scan (潛力飆股 + 破底翻) via Worker. */
export async function fetchScan(): Promise<ScanResult | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/scan`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.rockets || !json.reversals) return null;
    return json as ScanResult;
  } catch { return null; }
}

/**
 * Fetch last 40 trading days of 三大法人 chip data from TWSE via Worker.
 * Only works for TWSE-listed stocks (2330, 2454, etc.).
 * Values are in 張 (trading lots).
 */
export async function fetchChips(symbol: string): Promise<ChipData[]> {
  if (!BASE) return [];
  // Strip exchange suffix: "2330.TW" → "2330"
  const stockNo = symbol.replace(/\.[A-Z]+$/, '');
  const url = `${BASE}/chips?symbol=${encodeURIComponent(stockNo)}&days=40`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chips HTTP ${res.status}`);
  const json = await res.json();
  return (json?.chips ?? []) as ChipData[];
}

/** Returns true if a Worker URL has been configured. */
export function isAPIConfigured(): boolean {
  return BASE.length > 0;
}

// ── ETF Holdings (主動型ETF持股異動) ──────────────────────────────────────────

export interface ETFHoldingRow {
  rank:          number;
  code:          string;
  name:          string;
  prevShares:    number;
  shares:        number;
  weight:        number;
  weightChange?: number;
  status:        'new' | 'add' | 'reduce' | 'exit';
}

export interface ETFHoldingsResult {
  date:      string;           // 'MM/DD'
  prevDate:  string;           // 'MM/DD'
  stockNo:   string;
  holdings:  { rank: number; code: string; name: string; shares: number; weight: number }[];
  buys:      ETFHoldingRow[];
  sells:     ETFHoldingRow[];
  newCount:  number;
  addCount:  number;
  exitCount: number;
  source:    string;
}

/**
 * Fetch active ETF holdings diff (今日 vs 前日) from TWSE P60 via Worker.
 * Only works for 主動型ETF (00981A, 00991A, 00992A, …).
 */
export async function fetchETFHoldings(stockNo: string): Promise<ETFHoldingsResult | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/etf-holdings?stockNo=${encodeURIComponent(stockNo)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.buys) return null;
    return json as ETFHoldingsResult;
  } catch { return null; }
}

// ── News types + fetch ────────────────────────────────────────────────────────

export interface NewsItem {
  title:       string;
  link:        string;
  description: string;
  pubDate:     string;   // raw string from RSS (may be empty)
  source:      string;
}

export interface NewsResult {
  items:     NewsItem[];
  category:  'US' | 'TW';
  fetchedAt: string;     // ISO timestamp from Worker
}

/**
 * Fetch financial news for the given category via Worker.
 * Returns up to `count` items, sorted newest-first.
 * Worker caches RSS for 30 min on edge.
 */
export async function fetchNews(
  category: 'US' | 'TW',
  count = 25,
): Promise<NewsResult | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/news?category=${category}&count=${count}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!Array.isArray(json?.items)) return null;
    return json as NewsResult;
  } catch { return null; }
}

// ── Market indicator types ────────────────────────────────────────────────────

export interface MarketDayData {
  time:   string;   // 'YYYY-MM-DD'
  value:  number;   // 億元
  color?: string;   // for bar charts
}

export interface MarketData {
  margin: MarketDayData[];  // 大盤融資餘額 (億元)
  inst:   MarketDayData[];  // 三大法人大盤買賣超 (億元)
  source: 'TWSE';
}

/**
 * Fetch last N trading days of market indicators from Worker.
 * Returns: 融資餘額 (MI_MARGN) + 三大法人大盤買賣超 (BFI82U)
 */
export async function fetchMarket(days: number = 30): Promise<MarketData | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/market?days=${days}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.margin) return null;
    return json as MarketData;
  } catch { return null; }
}
