/**
 * StockChart — 個股 K 線圖（5 分頁）
 * 頂部：K 線 (MA5/MA10/MA20/MA60) + OHLC legend (crosshair 即時更新)
 * 分頁：① 成交量・主力  ② KD・MACD・RSI  ③ 外資・投信
 *       ④ 大戶・散戶持股  ⑤ 融資・融券
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart, ColorType,
  CandlestickSeries, LineSeries, HistogramSeries,
} from 'lightweight-charts';
import {
  type OHLCData,
  type ChipData,
  calculateMA,
  calculateMACD,
  calculateKD,
  calculateRSI,
} from '../utils/technicalIndicators';
import './StockChart.css';
import './SmartMoneyChart.css';

// ── Tab config ─────────────────────────────────────────────────────────────────

type ChartTab = 'chip' | 'tech' | 'inst' | 'holder' | 'margin';

const ALL_TABS: { key: ChartTab; label: string }[] = [
  { key: 'chip',   label: '成交量・主力' },
  { key: 'tech',   label: 'KD・MACD・RSI' },
  { key: 'inst',   label: '外資・投信' },
  { key: 'holder', label: '大戶・散戶' },
  { key: 'margin', label: '融資・融券' },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface StockChartProps {
  data: OHLCData[];
  chipData?: ChipData[];
  symbol: string;
  name: string;
  /** Pass true for VIXTWN or any line-only series */
  lineOnly?: boolean;
}

interface HoveredBar {
  time: string;
  open: number; high: number; low: number; close: number;
  volume: number;
  ma5?: number; ma10?: number; ma20?: number; ma60?: number;
}

// ── Shared chart layout ────────────────────────────────────────────────────────

const LAYOUT = {
  background: { type: ColorType.Solid, color: 'transparent' },
  textColor: '#6b7280',
  fontFamily: "'Inter', 'Noto Sans TC', sans-serif",
  fontSize: 11,
};
const GRID = { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } };

function subChart(el: HTMLDivElement, h: number, timeVisible = false) {
  return createChart(el, {
    layout: LAYOUT, grid: GRID,
    width: el.clientWidth, height: h,
    timeScale: { visible: timeVisible, borderColor: '#e5e7eb' },
    rightPriceScale: { borderColor: '#e5e7eb' },
    crosshair: {
      horzLine: { visible: false, labelVisible: false },
      vertLine: { style: 0, color: '#9ca3af', labelVisible: false },
    },
  });
}

// ── Synthetic data helpers ─────────────────────────────────────────────────────

function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

/**
 * 大戶/散戶持股比率 — TDCC weekly-cadence simulation
 * Every 5 bars: ±2–5 % swing driven by weekly price trend
 * Daily: small noise ±0.3 % to avoid flat look
 */
function deriveHolder(data: OHLCData[], baseBig: number, seed: number) {
  const r = mkRng(seed ^ 0x1234);
  let bigPct = baseBig;

  return data.map((d, i) => {
    if (i % 5 === 4) {
      // Weekly update: net price return over past 5 bars
      const weekOpen  = data[Math.max(0, i - 4)].open || data[Math.max(0, i - 4)].close;
      const weekClose = d.close;
      const weekRet   = (weekClose - weekOpen) / (weekOpen || weekClose);
      const delta     = weekRet * 5 + (r() - 0.5) * 2.5;
      bigPct = Math.min(Math.max(bigPct + delta, baseBig - 12), Math.min(baseBig + 20, 88));
    } else {
      // Daily micro-drift ±0.3 %
      bigPct += (r() - 0.5) * 0.6;
      bigPct = Math.min(Math.max(bigPct, baseBig - 12), Math.min(baseBig + 20, 88));
    }
    const small = Math.max(100 - bigPct - 18 - r() * 5, 4);
    return { time: d.time, big: +bigPct.toFixed(2), small: +small.toFixed(2) };
  });
}

/**
 * 融資/融券/券資比 — realistic daily swings
 * Margin rises on up days (retail piles in); short shrinks on up days (squeeze)
 */
function deriveMargin(data: OHLCData[], seed: number) {
  const r     = mkRng(seed ^ 0xabcd);
  const base  = 3000 + r() * 6000;
  const sBase = 400  + r() * 1000;
  let margin = base, short = sBase;

  return data.map(d => {
    const open  = d.open || d.close;
    const pchg  = (d.close - open) / open;
    const noise = (r() - 0.5) * 0.07;

    // Margin follows price with amplification + noise
    margin = Math.max(margin * (1 + pchg * 1.2 + noise), base * 0.25);
    // Short inversely follows (short squeeze on up days)
    short  = Math.max(short  * (1 - pchg * 0.7 + (r() - 0.5) * 0.06), sBase * 0.15);

    const ratio = short / margin * 100;
    return {
      time:   d.time,
      margin: Math.round(margin),
      short:  Math.round(short),
      ratio:  +ratio.toFixed(2),
    };
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function StockChart({ data, chipData, symbol, name, lineOnly = false }: StockChartProps) {
  // ── Refs ─────────────────────────────────────────────────────────────────────
  const mainRef      = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<ReturnType<typeof createChart> | null>(null);
  // Tab 1 — chip
  const volRef  = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  // Tab 2 — tech
  const kdRef   = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const rsiRef  = useRef<HTMLDivElement>(null);
  // Tab 3 — inst
  const fgnRef  = useRef<HTMLDivElement>(null);
  const trstRef = useRef<HTMLDivElement>(null);
  // Tab 4 — holder
  const bigRef  = useRef<HTMLDivElement>(null);
  const smlRef  = useRef<HTMLDivElement>(null);
  // Tab 5 — margin
  const mrgnRef = useRef<HTMLDivElement>(null);
  const shrtRef = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────────────────────
  // lineOnly (VIXTWN) only gets vol + tech tabs
  const tabs = lineOnly ? ALL_TABS.slice(0, 2) : ALL_TABS;
  const [chartTab, setChartTab] = useState<ChartTab>('chip');
  const [hoveredBar, setHoveredBar] = useState<HoveredBar | null>(null);

  // ── Pre-computed MAs ──────────────────────────────────────────────────────────
  const ma5Data  = useMemo(() => !lineOnly ? calculateMA(data, 5)  : [], [data, lineOnly]);
  const ma10Data = useMemo(() => !lineOnly ? calculateMA(data, 10) : [], [data, lineOnly]);
  const ma20Data = useMemo(() => !lineOnly ? calculateMA(data, 20) : [], [data, lineOnly]);
  const ma60Data = useMemo(() => !lineOnly ? calculateMA(data, 60) : [], [data, lineOnly]);

  // ── Technical indicators ──────────────────────────────────────────────────────
  const kdd   = useMemo(() => calculateKD(data),      [data]);
  const macdd = useMemo(() => calculateMACD(data),    [data]);
  const rsid  = useMemo(() => calculateRSI(data, 14), [data]);

  // ── Seed from symbol for synthetic data ───────────────────────────────────────
  const symbolSeed = useMemo(
    () => symbol.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7),
    [symbol],
  );

  // ── Synthetic holder / margin ─────────────────────────────────────────────────
  const holderd = useMemo(() => {
    const baseBig = 55 + (symbolSeed % 20);
    return deriveHolder(data, baseBig, symbolSeed);
  }, [data, symbolSeed]);
  const margind = useMemo(() => deriveMargin(data, symbolSeed), [data, symbolSeed]);

  // ── Real chip data → coloured histogram bars, date-aligned to OHLC ───────────
  // Key chip rows by date so every OHLC bar gets a matching entry (0 if absent).
  // This guarantees the sub-chart series share exactly the same time axis as the
  // main K-line, preventing the left-shift / date-mismatch the user reported.
  const chipByDate = useMemo(
    () => new Map((chipData ?? []).map(c => [c.time, c])),
    [chipData],
  );
  const mainForceChips = useMemo(() => data.map(d => {
    const v = chipByDate.get(d.time)?.mainForce ?? 0;
    return { time: d.time, value: v, color: v >= 0 ? '#c0392b' : '#4a7c59' };
  }), [data, chipByDate]);
  const fgnChips = useMemo(() => data.map(d => {
    const v = chipByDate.get(d.time)?.foreign ?? 0;
    return { time: d.time, value: v, color: v >= 0 ? '#c0392b' : '#4a7c59' };
  }), [data, chipByDate]);
  const trstChips = useMemo(() => data.map(d => {
    const v = chipByDate.get(d.time)?.trust ?? 0;
    return { time: d.time, value: v, color: v >= 0 ? '#c0392b' : '#4a7c59' };
  }), [data, chipByDate]);

  // ── Lookup maps (crosshair) ────────────────────────────────────────────────────
  const ma5Map  = useMemo(() => new Map(ma5Data.map(d  => [d.time, d.value])), [ma5Data]);
  const ma10Map = useMemo(() => new Map(ma10Data.map(d => [d.time, d.value])), [ma10Data]);
  const ma20Map = useMemo(() => new Map(ma20Data.map(d => [d.time, d.value])), [ma20Data]);
  const ma60Map = useMemo(() => new Map(ma60Data.map(d => [d.time, d.value])), [ma60Data]);
  const volMap  = useMemo(() => new Map(data.map(d => [d.time, d.volume])),   [data]);

  // ── Header values ─────────────────────────────────────────────────────────────
  const lastBar   = data.at(-1);
  const prev      = data.at(-2)?.close ?? 0;
  const lastClose = lastBar?.close ?? 0;
  const change    = lastClose - prev;
  const changePct = prev !== 0 ? (change / prev) * 100 : 0;
  const isUp      = change >= 0;

  // ── Legend display bar (hovered or last) ──────────────────────────────────────
  const displayBar: HoveredBar = hoveredBar ?? {
    time:   lastBar?.time   ?? '',
    open:   lastBar?.open   ?? 0,
    high:   lastBar?.high   ?? 0,
    low:    lastBar?.low    ?? 0,
    close:  lastBar?.close  ?? 0,
    volume: lastBar?.volume ?? 0,
    ma5:    ma5Data.at(-1)?.value,
    ma10:   ma10Data.at(-1)?.value,
    ma20:   ma20Data.at(-1)?.value,
    ma60:   ma60Data.at(-1)?.value,
  };
  const legendUp = displayBar.close >= displayBar.open;

  // ── Latest values for sub-panel label stats ────────────────────────────────────
  const latestKD     = kdd.at(-1);
  const latestDIF    = macdd.dif.at(-1);
  const latestDEM    = macdd.dem.at(-1);
  const latestRSI    = rsid.at(-1)?.value;
  const latestChip   = mainForceChips.at(-1);
  const latestFgn    = fgnChips.at(-1);
  const latestTrst   = trstChips.at(-1);
  const latestHolder = holderd.at(-1);
  const latestMargin = margind.at(-1);

  // ════════════════════════════════════════════════════════════════════════
  // EFFECT 1 — Main K-line (stable, rebuilds only when data changes)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mainRef.current || !data.length) return;

    const main = createChart(mainRef.current, {
      layout: LAYOUT, grid: GRID,
      width: mainRef.current.clientWidth, height: 320,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#e5e7eb' },
      rightPriceScale: { borderColor: '#e5e7eb' },
      crosshair: { horzLine: { labelVisible: true }, vertLine: { labelVisible: false } },
    });
    mainChartRef.current = main;

    if (lineOnly) {
      const line = main.addSeries(LineSeries, { color: '#1a1a2e', lineWidth: 2 });
      line.setData(data.map(d => ({ time: d.time, value: d.close })) as any);
    } else {
      const candle = main.addSeries(CandlestickSeries, {
        upColor: '#c0392b', downColor: '#4a7c59',
        borderVisible: false, wickUpColor: '#c0392b', wickDownColor: '#4a7c59',
      });
      candle.setData(data as any);

      const lnOpts = { lineWidth: 1 as const, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false };
      main.addSeries(LineSeries, { ...lnOpts, color: '#f1c40f' }).setData(ma5Data  as any);
      main.addSeries(LineSeries, { ...lnOpts, color: '#e67e22' }).setData(ma10Data as any);
      main.addSeries(LineSeries, { ...lnOpts, color: '#3498db' }).setData(ma20Data as any);
      main.addSeries(LineSeries, { ...lnOpts, color: '#8e44ad' }).setData(ma60Data as any);

      main.subscribeCrosshairMove(param => {
        if (!param.time || !param.point) { setHoveredBar(null); return; }
        const t  = String(param.time);
        const cd = param.seriesData.get(candle) as any;
        if (!cd) { setHoveredBar(null); return; }
        setHoveredBar({
          time: t, open: cd.open, high: cd.high, low: cd.low, close: cd.close,
          volume: volMap.get(t)  ?? 0,
          ma5:    ma5Map.get(t),
          ma10:   ma10Map.get(t),
          ma20:   ma20Map.get(t),
          ma60:   ma60Map.get(t),
        });
      });
    }

    const onResize = () => { if (mainRef.current) main.applyOptions({ width: mainRef.current.clientWidth }); };
    window.addEventListener('resize', onResize);
    main.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', onResize);
      main.remove();
      mainChartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lineOnly, ma5Data, ma10Data, ma20Data, ma60Data]);

  // ════════════════════════════════════════════════════════════════════════
  // EFFECT 2 — Sub-panels (rebuilt when chartTab changes)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const main = mainChartRef.current;
    const subs: ReturnType<typeof createChart>[] = [];
    // [subChart, firstSeries] — used for crosshair sync
    const syncPairs: [ReturnType<typeof createChart>, any][] = [];

    const cumLine = (chart: ReturnType<typeof createChart>, bars: { time: string; value: number }[], color: string) => {
      let cum = 0;
      chart.addSeries(LineSeries, {
        color, lineWidth: 2, priceScaleId: 'left',
        crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
      }).setData(bars.map(b => { cum += b.value; return { time: b.time, value: cum }; }) as any);
    };

    // ── Tab 1: 成交量 + 主力買賣超 ──────────────────────────────────────────
    if (chartTab === 'chip' && volRef.current) {
      const vol = subChart(volRef.current, 80);
      const volS = vol.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
      volS.setData(data.map(d => ({
        time: d.time, value: d.volume,
        color: d.close >= d.open ? '#c0392b' : '#4a7c59',
      })) as any);
      subs.push(vol); syncPairs.push([vol, volS]);

      if (chipRef.current && mainForceChips.length > 0) {
        const chipChart = subChart(chipRef.current, 110, true);
        const chipS = chipChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
        chipS.setData(mainForceChips as any);
        cumLine(chipChart, mainForceChips.map(c => ({ time: c.time, value: c.value })), '#1a1a2e');
        subs.push(chipChart); syncPairs.push([chipChart, chipS]);
      }
    }

    // ── Tab 2: KD + MACD + RSI ──────────────────────────────────────────────
    if (chartTab === 'tech' && kdRef.current && macdRef.current && rsiRef.current) {
      const kdChart = subChart(kdRef.current, 90);
      const kdS = kdChart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      kdS.setData(kdd.map(d => ({ time: d.time, value: d.k })) as any);
      kdChart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
        .setData(kdd.map(d => ({ time: d.time, value: d.d })) as any);
      subs.push(kdChart); syncPairs.push([kdChart, kdS]);

      const macdChart = subChart(macdRef.current, 80);
      const macdS = macdChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
      macdS.setData(macdd.histogram.map(d => ({ ...d, color: d.value >= 0 ? '#c0392b' : '#4a7c59' })) as any);
      macdChart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        .setData(macdd.dif as any);
      macdChart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        .setData(macdd.dem as any);
      subs.push(macdChart); syncPairs.push([macdChart, macdS]);

      const rsiChart = subChart(rsiRef.current, 90, true);
      const rsiS = rsiChart.addSeries(LineSeries, { color: '#8e44ad', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      rsiS.setData(rsid as any);
      [[70, '#e74c3c'], [30, '#27ae60']].forEach(([v, c]) =>
        rsiChart.addSeries(LineSeries, { color: c as string, lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
        }).setData(rsid.map(d => ({ time: d.time, value: v as number })) as any)
      );
      subs.push(rsiChart); syncPairs.push([rsiChart, rsiS]);
    }

    // ── Tab 3: 外資 + 投信 ──────────────────────────────────────────────────
    if (chartTab === 'inst' && fgnRef.current && trstRef.current) {
      const fgnChart = subChart(fgnRef.current, 90);
      const fgnS = fgnChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
      fgnS.setData(fgnChips as any);
      cumLine(fgnChart, fgnChips.map(d => ({ time: d.time, value: d.value })), '#c0392b');
      subs.push(fgnChart); syncPairs.push([fgnChart, fgnS]);

      const trstChart = subChart(trstRef.current, 110, true);
      const trstS = trstChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
      trstS.setData(trstChips as any);
      cumLine(trstChart, trstChips.map(d => ({ time: d.time, value: d.value })), '#2980b9');
      subs.push(trstChart); syncPairs.push([trstChart, trstS]);
    }

    // ── Tab 4: 大戶持股 + 散戶持股 ──────────────────────────────────────────
    if (chartTab === 'holder' && bigRef.current && smlRef.current) {
      const bigChart = subChart(bigRef.current, 100);
      const bigS = bigChart.addSeries(HistogramSeries, {
        color: 'rgba(231,76,60,0.25)', priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      bigS.setData(holderd.map(d => ({ time: d.time, value: d.big })) as any);
      bigChart.addSeries(LineSeries, {
        color: '#c0392b', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
      }).setData(holderd.map(d => ({ time: d.time, value: d.big })) as any);
      subs.push(bigChart); syncPairs.push([bigChart, bigS]);

      const smlChart = subChart(smlRef.current, 110, true);
      const smlS = smlChart.addSeries(HistogramSeries, {
        color: 'rgba(52,152,219,0.2)', priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      smlS.setData(holderd.map(d => ({ time: d.time, value: d.small })) as any);
      smlChart.addSeries(LineSeries, {
        color: '#2980b9', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
      }).setData(holderd.map(d => ({ time: d.time, value: d.small })) as any);
      subs.push(smlChart); syncPairs.push([smlChart, smlS]);
    }

    // ── Tab 5: 融資 + 融券 + 券資比 ─────────────────────────────────────────
    if (chartTab === 'margin' && mrgnRef.current && shrtRef.current) {
      const mrgnChart = subChart(mrgnRef.current, 90);
      const mrgnS = mrgnChart.addSeries(HistogramSeries, {
        color: 'rgba(41,128,185,0.7)', priceFormat: { type: 'volume' },
      });
      mrgnS.setData(margind.map(d => ({ time: d.time, value: d.margin, color: 'rgba(41,128,185,0.7)' })) as any);
      mrgnChart.addSeries(LineSeries, {
        color: '#1a5276', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      }).setData(margind.map(d => ({ time: d.time, value: d.margin })) as any);
      subs.push(mrgnChart); syncPairs.push([mrgnChart, mrgnS]);

      const shrtChart = subChart(shrtRef.current, 110, true);
      const shrtS = shrtChart.addSeries(HistogramSeries, {
        color: 'rgba(142,68,173,0.7)', priceFormat: { type: 'volume' },
      });
      shrtS.setData(margind.map(d => ({ time: d.time, value: d.short, color: 'rgba(142,68,173,0.7)' })) as any);
      shrtChart.addSeries(LineSeries, {
        color: '#e74c3c', lineWidth: 2, priceScaleId: 'left',
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      }).setData(margind.map(d => ({ time: d.time, value: d.ratio })) as any);
      subs.push(shrtChart); syncPairs.push([shrtChart, shrtS]);
    }

    // ── Time-range sync (time-based → no index drift on scroll/zoom) ─────────
    const scrollHandler = (range: any) => {
      if (!range) return;
      subs.forEach(s => { try { s.timeScale().setVisibleRange(range); } catch (_) {} });
    };
    if (main) {
      main.timeScale().subscribeVisibleTimeRangeChange(scrollHandler);
      // Immediately match current view
      const cur = main.timeScale().getVisibleRange();
      if (cur) subs.forEach(s => { try { s.timeScale().setVisibleRange(cur); } catch (_) {} });
    }

    // ── Crosshair sync ────────────────────────────────────────────────────────
    const crosshairHandler = (param: any) => {
      if (!param.time) {
        syncPairs.forEach(([c]) => { try { c.clearCrosshairPosition(); } catch (_) {} });
        return;
      }
      syncPairs.forEach(([c, s]) => {
        try { c.setCrosshairPosition(0, param.time, s); } catch (_) {}
      });
    };
    if (main) main.subscribeCrosshairMove(crosshairHandler);

    // ── Resize handler ────────────────────────────────────────────────────────
    const allSubRefs = [volRef, chipRef, kdRef, macdRef, rsiRef, fgnRef, trstRef, bigRef, smlRef, mrgnRef, shrtRef];
    const onResize = () => {
      subs.forEach((ch, i) => {
        const el = allSubRefs[i]?.current;
        if (el) ch.applyOptions({ width: el.clientWidth });
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (main) {
        main.timeScale().unsubscribeVisibleTimeRangeChange(scrollHandler);
        main.unsubscribeCrosshairMove(crosshairHandler);
      }
      subs.forEach(c => c.remove());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartTab, data, lineOnly, mainForceChips, fgnChips, trstChips, kdd, macdd, rsid, holderd, margind]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="chart-container">
      {/* ── Header: name + latest price ── */}
      <div className="chart-header">
        <div className="chart-info-group">
          <div className="chart-title-row">
            <h2 className="chart-title">{name} ({symbol})</h2>
            <span className="chart-date">{lastBar?.time}</span>
          </div>
          <div className="price-summary-bar">
            <div className="price-main">
              <span className={`chart-price ${isUp ? 'price-up' : 'price-down'}`}>
                {lastClose.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className={`price-diff ${isUp ? 'price-up' : 'price-down'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5 chart tabs ── */}
      <div className="smc-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`smc-tab ${chartTab === t.key ? 'active' : ''}`}
            onClick={() => setChartTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OHLC + MA legend (crosshair hover) ── */}
      {!lineOnly && (
        <div className="chart-ohlc-legend">
          <span className="legend-date">{displayBar.time}</span>
          <span className="legend-item">開&thinsp;<span className="legend-val">{displayBar.open.toFixed(2)}</span></span>
          <span className="legend-item">高&thinsp;<span className={`legend-val ${legendUp ? 'price-up' : 'price-down'}`}>{displayBar.high.toFixed(2)}</span></span>
          <span className="legend-item">低&thinsp;<span className={`legend-val ${legendUp ? 'price-up' : 'price-down'}`}>{displayBar.low.toFixed(2)}</span></span>
          <span className="legend-item">收&thinsp;<span className={`legend-val ${legendUp ? 'price-up' : 'price-down'}`}>{displayBar.close.toFixed(2)}</span></span>
          <span className="legend-item">量&thinsp;<span className="legend-val">{displayBar.volume.toLocaleString()}</span></span>
          {displayBar.ma5  !== undefined && <span className="legend-item"><span className="legend-ma ma5-color">MA5</span>&thinsp;<span className="legend-val">{displayBar.ma5.toFixed(2)}</span></span>}
          {displayBar.ma10 !== undefined && <span className="legend-item"><span className="legend-ma ma10-color">MA10</span>&thinsp;<span className="legend-val">{displayBar.ma10.toFixed(2)}</span></span>}
          {displayBar.ma20 !== undefined && <span className="legend-item"><span className="legend-ma ma20-color">MA20</span>&thinsp;<span className="legend-val">{displayBar.ma20.toFixed(2)}</span></span>}
          {displayBar.ma60 !== undefined && <span className="legend-item"><span className="legend-ma ma60-color">MA60</span>&thinsp;<span className="legend-val">{displayBar.ma60.toFixed(2)}</span></span>}
        </div>
      )}

      {/* ── Main K-line (always visible) ── */}
      <div className="chart-section">
        <div ref={mainRef} className="main-chart" />
      </div>

      {/* ══ Tab 1: 成交量 + 主力買賣超 ══ */}
      {chartTab === 'chip' && (
        <>
          <div className="smc-sub-label">
            成交量
            <span className="smc-sub-stat">{displayBar.volume.toLocaleString()} 張</span>
          </div>
          <div ref={volRef} className="smc-sub h80" />

          {mainForceChips.length > 0 && (
            <>
              <div className="smc-sub-label">
                主力買賣超
                {latestChip && (
                  <span className={`smc-sub-stat ${latestChip.value >= 0 ? 'cl-up' : 'cl-down'}`}>
                    {latestChip.value >= 0 ? '+' : ''}{latestChip.value.toLocaleString()} 張
                  </span>
                )}
                <span className="smc-sub-stat smc-cum">累積線</span>
              </div>
              <div ref={chipRef} className="smc-sub h110" />
            </>
          )}
        </>
      )}

      {/* ══ Tab 2: KD + MACD + RSI ══ */}
      {chartTab === 'tech' && (
        <>
          <div className="smc-sub-label">
            KD (9)
            {latestKD && (
              <>
                <span className="smc-sub-stat smc-kd-k">K {latestKD.k.toFixed(2)}</span>
                <span className="smc-sub-stat smc-kd-d">D {latestKD.d.toFixed(2)}</span>
              </>
            )}
          </div>
          <div ref={kdRef} className="smc-sub h90" />

          <div className="smc-sub-label">
            MACD (12,26,9)
            {latestDIF && latestDEM && (
              <>
                <span className="smc-sub-stat smc-dif">DIF {latestDIF.value.toFixed(2)}</span>
                <span className="smc-sub-stat smc-dem">DEM {latestDEM.value.toFixed(2)}</span>
              </>
            )}
          </div>
          <div ref={macdRef} className="smc-sub h80" />

          <div className="smc-sub-label">
            RSI (14)
            {latestRSI !== undefined && (
              <span className="smc-sub-stat smc-rsi">{latestRSI.toFixed(2)}</span>
            )}
          </div>
          <div ref={rsiRef} className="smc-sub h90" />
        </>
      )}

      {/* ══ Tab 3: 外資 + 投信 ══ */}
      {chartTab === 'inst' && (
        <>
          <div className="smc-sub-label">
            外資買賣超
            {latestFgn && (
              <span className={`smc-sub-stat ${latestFgn.value >= 0 ? 'cl-up' : 'cl-down'}`}>
                {latestFgn.value >= 0 ? '+' : ''}{latestFgn.value.toLocaleString()} 張
              </span>
            )}
            <span className="smc-sub-stat smc-cum">累積線</span>
          </div>
          <div ref={fgnRef} className="smc-sub h90" />

          <div className="smc-sub-label">
            投信買賣超
            {latestTrst && (
              <span className={`smc-sub-stat ${latestTrst.value >= 0 ? 'cl-up' : 'cl-down'}`}>
                {latestTrst.value >= 0 ? '+' : ''}{latestTrst.value.toLocaleString()} 張
              </span>
            )}
            <span className="smc-sub-stat smc-cum">累積線</span>
          </div>
          <div ref={trstRef} className="smc-sub h110" />
        </>
      )}

      {/* ══ Tab 4: 大戶持股 + 散戶持股 ══ */}
      {chartTab === 'holder' && (
        <>
          <div className="smc-sub-label">
            大戶持股比率
            {latestHolder && (
              <span className="smc-sub-stat cl-up">{latestHolder.big.toFixed(2)}%</span>
            )}
          </div>
          <div ref={bigRef} className="smc-sub h100" />

          <div className="smc-sub-label">
            散戶持股比率
            {latestHolder && (
              <span className="smc-sub-stat cl-down">{latestHolder.small.toFixed(2)}%</span>
            )}
          </div>
          <div ref={smlRef} className="smc-sub h110" />
        </>
      )}

      {/* ══ Tab 5: 融資 + 融券 + 券資比 ══ */}
      {chartTab === 'margin' && (
        <>
          <div className="smc-sub-label">
            融資餘額
            {latestMargin && (
              <span className="smc-sub-stat" style={{ color: '#2980b9' }}>
                {latestMargin.margin.toLocaleString()} 張
              </span>
            )}
          </div>
          <div ref={mrgnRef} className="smc-sub h90" />

          <div className="smc-sub-label">
            融券餘額
            {latestMargin && (
              <>
                <span className="smc-sub-stat" style={{ color: '#8e44ad' }}>
                  {latestMargin.short.toLocaleString()} 張
                </span>
                <span className="smc-sub-stat" style={{ color: '#e74c3c' }}>
                  券資比 {latestMargin.ratio.toFixed(1)}%
                </span>
              </>
            )}
          </div>
          <div ref={shrtRef} className="smc-sub h110" />
        </>
      )}
    </div>
  );
}
