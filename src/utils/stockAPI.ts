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

import { type OHLCData } from './technicalIndicators';

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

/** Returns true if a Worker URL has been configured. */
export function isAPIConfigured(): boolean {
  return BASE.length > 0;
}
