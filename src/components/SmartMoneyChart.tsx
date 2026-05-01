/**
 * SmartMoneyChart — 大戶連買追蹤 K 線圖
 * 三欄：K 線（MA5/MA20/MA60）· 成交量 · 主力買賣超（累積線）
 * Crosshair hover 更新頂部 OHLC + MA legend
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';
import type { OHLCBar } from './MiniKLineChart';
import './SmartMoneyChart.css';

export interface ChipBar {
  time:  string;
  value: number;
  color: string;
}

interface Props {
  code:  string;
  name:  string;
  data:  OHLCBar[];
  chips: ChipBar[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcMA(data: OHLCBar[], n: number): { time: string; value: number }[] {
  return data.slice(n - 1).map((_, i) => ({
    time:  data[i + n - 1].time,
    value: +(data.slice(i, i + n).reduce((s, d) => s + d.close, 0) / n).toFixed(2),
  }));
}

interface HoveredBar {
  time: string;
  open: number; high: number; low: number; close: number;
  volume: number;
  chipVal: number;
  ma5?: number; ma20?: number; ma60?: number;
}

const LAYOUT = {
  background: { type: ColorType.Solid, color: 'transparent' },
  textColor: '#6b7280',
  fontFamily: "'Inter', 'Noto Sans TC', sans-serif",
  fontSize: 10,
};
const GRID = {
  vertLines: { color: '#f3f4f6' },
  horzLines: { color: '#f3f4f6' },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function SmartMoneyChart({ code, name, data, chips }: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef  = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  const [hovered, setHovered] = useState<HoveredBar | null>(null);

  // Pre-compute MAs
  const ma5Data  = useMemo(() => calcMA(data, 5),  [data]);
  const ma20Data = useMemo(() => calcMA(data, 20), [data]);
  const ma60Data = useMemo(() => calcMA(data, 60), [data]);

  // Derive per-day volume from chip-adjacent data (stored alongside OHLC)
  const volMap  = useMemo(() => new Map(data.map((d: any) => [d.time, d.volume ?? 0])), [data]);
  const chipMap = useMemo(() => new Map(chips.map(c => [c.time, c.value])), [chips]);
  const ma5Map  = useMemo(() => new Map(ma5Data.map(d  => [d.time, d.value])), [ma5Data]);
  const ma20Map = useMemo(() => new Map(ma20Data.map(d => [d.time, d.value])), [ma20Data]);
  const ma60Map = useMemo(() => new Map(ma60Data.map(d => [d.time, d.value])), [ma60Data]);

  // Legend: hovered or last bar
  const lastBar = data.at(-1);
  const display: HoveredBar = hovered ?? {
    time:    lastBar?.time    ?? '',
    open:    lastBar?.open    ?? 0,
    high:    lastBar?.high    ?? 0,
    low:     lastBar?.low     ?? 0,
    close:   lastBar?.close   ?? 0,
    volume:  volMap.get(lastBar?.time ?? '')  ?? 0,
    chipVal: chipMap.get(lastBar?.time ?? '') ?? 0,
    ma5:     ma5Data.at(-1)?.value,
    ma20:    ma20Data.at(-1)?.value,
    ma60:    ma60Data.at(-1)?.value,
  };
  const legendUp = display.close >= display.open;

  useEffect(() => {
    if (!mainRef.current || !volRef.current || !chipRef.current || !data.length) return;

    // ── 1. Main K-line chart ───────────────────────────────────────────────
    const main = createChart(mainRef.current, {
      layout: LAYOUT, grid: GRID,
      width: mainRef.current.clientWidth,
      height: 260,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#e5e7eb' },
      rightPriceScale: { borderColor: '#e5e7eb' },
      crosshair: {
        horzLine: { labelVisible: true },
        vertLine: { labelVisible: false },
      },
    });

    const candle = main.addSeries(CandlestickSeries, {
      upColor: '#c0392b', downColor: '#4a7c59',
      borderVisible: false,
      wickUpColor: '#c0392b', wickDownColor: '#4a7c59',
    });
    candle.setData(data as any);

    const ma5s  = main.addSeries(LineSeries, { color: '#f1c40f', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
    ma5s.setData(ma5Data as any);
    const ma20s = main.addSeries(LineSeries, { color: '#3498db', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
    ma20s.setData(ma20Data as any);
    const ma60s = main.addSeries(LineSeries, { color: '#e67e22', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
    ma60s.setData(ma60Data as any);

    // Crosshair → legend
    main.subscribeCrosshairMove(param => {
      if (!param.time || !param.point) { setHovered(null); return; }
      const t  = String(param.time);
      const cd = param.seriesData.get(candle) as any;
      if (!cd) { setHovered(null); return; }
      setHovered({
        time:    t,
        open:    cd.open,
        high:    cd.high,
        low:     cd.low,
        close:   cd.close,
        volume:  volMap.get(t)  ?? 0,
        chipVal: chipMap.get(t) ?? 0,
        ma5:     ma5Map.get(t),
        ma20:    ma20Map.get(t),
        ma60:    ma60Map.get(t),
      });
    });

    // ── 2. Volume chart ────────────────────────────────────────────────────
    const vol = createChart(volRef.current, {
      layout: LAYOUT, grid: GRID,
      width: volRef.current.clientWidth,
      height: 80,
      timeScale: { visible: false },
      rightPriceScale: { borderColor: '#e5e7eb' },
    });
    const volSeries = vol.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
    volSeries.setData(
      (data as any[]).map((d: any) => ({
        time:  d.time,
        value: d.volume ?? 0,
        color: d.close >= d.open ? '#c0392b' : '#4a7c59',
      })) as any
    );

    // ── 3. Chip (主力買賣超) chart ─────────────────────────────────────────
    const chipChart = createChart(chipRef.current, {
      layout: LAYOUT, grid: GRID,
      width: chipRef.current.clientWidth,
      height: 90,
      timeScale: { visible: false },
      rightPriceScale: { borderColor: '#e5e7eb' },
    });
    const chipHist = chipChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
    chipHist.setData(chips as any);

    // Cumulative chip line
    let cum = 0;
    const cumLine = chipChart.addSeries(LineSeries, {
      color: '#1a1a2e',
      lineWidth: 2,
      priceScaleId: 'right2',
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    cumLine.setData(
      chips.map(c => { cum += c.value; return { time: c.time, value: cum }; }) as any
    );

    // ── Sync time scale ────────────────────────────────────────────────────
    main.timeScale().subscribeVisibleTimeRangeChange(() => {
      const r = main.timeScale().getVisibleLogicalRange();
      if (r) { vol.timeScale().setVisibleLogicalRange(r); chipChart.timeScale().setVisibleLogicalRange(r); }
    });

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      if (mainRef.current) main.applyOptions({ width: mainRef.current.clientWidth });
      if (volRef.current)  vol.applyOptions({ width: volRef.current.clientWidth });
      if (chipRef.current) chipChart.applyOptions({ width: chipRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    main.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', onResize);
      main.remove(); vol.remove(); chipChart.remove();
    };
  }, [data, chips, ma5Data, ma20Data, ma60Data, volMap, chipMap, ma5Map, ma20Map, ma60Map]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const fmt = (n: number) => n >= 1000 ? n.toLocaleString() : n.toFixed(2);

  return (
    <div className="smc-wrapper">
      {/* ── OHLC + MA legend ── */}
      <div className="smc-legend">
        <span className="smc-leg-date">{display.time.slice(5).replace('-','/')}</span>
        <span className="smc-leg-item">開&thinsp;<span className="smc-leg-val">{fmt(display.open)}</span></span>
        <span className="smc-leg-item">高&thinsp;<span className={`smc-leg-val ${legendUp ? 'cl-up' : 'cl-down'}`}>{fmt(display.high)}</span></span>
        <span className="smc-leg-item">低&thinsp;<span className={`smc-leg-val ${legendUp ? 'cl-up' : 'cl-down'}`}>{fmt(display.low)}</span></span>
        <span className="smc-leg-item">收&thinsp;<span className={`smc-leg-val ${legendUp ? 'cl-up' : 'cl-down'}`}>{fmt(display.close)}</span></span>
        {display.ma5  !== undefined && <span className="smc-leg-item"><span className="smc-ma5" >MA5</span>&thinsp;<span className="smc-leg-val">{display.ma5.toFixed(2)}</span></span>}
        {display.ma20 !== undefined && <span className="smc-leg-item"><span className="smc-ma20">MA20</span>&thinsp;<span className="smc-leg-val">{display.ma20.toFixed(2)}</span></span>}
        {display.ma60 !== undefined && <span className="smc-leg-item"><span className="smc-ma60">MA60</span>&thinsp;<span className="smc-leg-val">{display.ma60.toFixed(2)}</span></span>}
      </div>

      {/* ── Candle chart ── */}
      <div ref={mainRef} className="smc-main" />

      {/* ── Volume ── */}
      <div className="smc-section-label">成交量</div>
      <div ref={volRef} className="smc-sub" />

      {/* ── Chip ── */}
      <div className="smc-section-label">
        主力買賣超
        <span className={`smc-chip-now ${display.chipVal >= 0 ? 'cl-up' : 'cl-down'}`}>
          &nbsp;{display.chipVal >= 0 ? '+' : ''}{display.chipVal.toLocaleString()} 張
        </span>
      </div>
      <div ref={chipRef} className="smc-sub" />

      <p className="smc-source">
        {code} {name} · 近25個交易日 (03/24–04/30) · 籌碼數據參考 TWSE T86
      </p>
    </div>
  );
}
