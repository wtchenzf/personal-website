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
