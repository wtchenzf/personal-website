/**
 * useMarketData
 *
 * Fetches live quotes (all tabs at once) and OHLC bars (per active tab,
 * cached in memory) from the stock-proxy Cloudflare Worker.
 *
 * - Quotes are polled every POLL_MS (default 5 min)
 * - OHLC is fetched on first render of each tab and cached for the session
 * - If VITE_STOCK_API_URL is not set everything is a no-op and the caller
 *   continues to use mock/seed data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchQuotes, fetchOHLC, isAPIConfigured, type QuoteResult } from '../utils/stockAPI';
import { type OHLCData } from '../utils/technicalIndicators';

const POLL_MS = 5 * 60 * 1000; // 5 minutes

export type DataStatus = 'mock' | 'loading' | 'live' | 'error';

export interface SymbolDef {
  id: string;          // internal tab id, e.g. '2330'
  yahooSymbol: string; // Yahoo Finance ticker, e.g. '2330.TW'
  lineOnly?: boolean;  // VIXTWN etc — keep as line chart
}

export interface MarketDataResult {
  quotes:      Record<string, QuoteResult>;   // keyed by SymbolDef.id
  ohlcData:    Record<string, OHLCData[]>;    // keyed by SymbolDef.id
  status:      DataStatus;
  lastUpdated: Date | null;
  refresh:     () => void;
}

export function useMarketData(
  symbols: SymbolDef[],
  activeId: string,
): MarketDataResult {
  const configured = isAPIConfigured();

  const [quotes,      setQuotes]      = useState<Record<string, QuoteResult>>({});
  const [ohlcData,    setOhlcData]    = useState<Record<string, OHLCData[]>>({});
  const [status,      setStatus]      = useState<DataStatus>(configured ? 'loading' : 'mock');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // In-session OHLC cache (avoids re-fetching the same tab)
  const ohlcCache = useRef<Record<string, OHLCData[]>>({});
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch all quotes ───────────────────────────────────────────────────────
  const fetchAllQuotes = useCallback(async () => {
    if (!configured) return;

    setStatus(prev => (prev === 'mock' ? 'loading' : prev));
    try {
      const yahooSymbols = symbols.map(s => s.yahooSymbol);
      const results      = await fetchQuotes(yahooSymbols);

      const map: Record<string, QuoteResult> = {};
      results.forEach(q => {
        const def = symbols.find(s => s.yahooSymbol === q.symbol);
        if (def) map[def.id] = q;
      });

      setQuotes(map);
      setStatus('live');
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('[useMarketData] quote fetch error:', err);
      setStatus('error');
    }
  }, [configured, symbols]);

  // ── Fetch OHLC for one tab ─────────────────────────────────────────────────
  const fetchChart = useCallback(async (def: SymbolDef) => {
    if (!configured) return;

    // Serve from cache first
    if (ohlcCache.current[def.id]) {
      setOhlcData(prev => ({ ...prev, [def.id]: ohlcCache.current[def.id] }));
      return;
    }

    try {
      const bars = await fetchOHLC(def.yahooSymbol, '3mo');
      if (bars.length) {
        ohlcCache.current[def.id] = bars;
        setOhlcData(prev => ({ ...prev, [def.id]: bars }));
      }
    } catch (err) {
      console.warn(`[useMarketData] OHLC fetch error for ${def.yahooSymbol}:`, err);
    }
  }, [configured]);

  // ── Initial load + polling ─────────────────────────────────────────────────
  useEffect(() => {
    if (!configured) return;

    fetchAllQuotes();
    pollTimer.current = setInterval(fetchAllQuotes, POLL_MS);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [configured, fetchAllQuotes]);

  // ── Fetch chart when active tab changes ───────────────────────────────────
  useEffect(() => {
    if (!configured) return;
    const def = symbols.find(s => s.id === activeId);
    if (def) fetchChart(def);
  }, [activeId, configured, fetchChart, symbols]);

  return {
    quotes,
    ohlcData,
    status,
    lastUpdated,
    refresh: fetchAllQuotes,
  };
}
