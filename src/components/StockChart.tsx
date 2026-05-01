import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';
import {
  type OHLCData,
  type ChipData,
  calculateMA,
  calculateMACD,
  calculateKD,
  calculateRSI,
} from '../utils/technicalIndicators';
import ChipPanel from './ChipPanel';
import './StockChart.css';

type IndicatorTab = 'MACD' | 'KD' | 'RSI';

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

const COMMON_LAYOUT = {
  background: { type: ColorType.Solid, color: 'transparent' },
  textColor: '#6b7280',
  fontFamily: "'Inter', 'Noto Sans TC', sans-serif",
  fontSize: 11,
};
const COMMON_GRID = {
  vertLines: { color: '#f3f4f6' },
  horzLines: { color: '#f3f4f6' },
};

export default function StockChart({ data, chipData, symbol, name, lineOnly = false }: StockChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef  = useRef<HTMLDivElement>(null);
  const subRef  = useRef<HTMLDivElement>(null);
  const [tab, setTab]             = useState<IndicatorTab>('MACD');
  const [hoveredBar, setHoveredBar] = useState<HoveredBar | null>(null);

  // ── Pre-compute MAs (shared between chart series & legend) ────────────────
  const ma5Data  = useMemo(() => !lineOnly ? calculateMA(data, 5)  : [], [data, lineOnly]);
  const ma10Data = useMemo(() => !lineOnly ? calculateMA(data, 10) : [], [data, lineOnly]);
  const ma20Data = useMemo(() => !lineOnly ? calculateMA(data, 20) : [], [data, lineOnly]);
  const ma60Data = useMemo(() => !lineOnly ? calculateMA(data, 60) : [], [data, lineOnly]);

  // ── Header: latest price + change (always last bar) ──────────────────────
  const lastBar   = data.at(-1);
  const prev      = data.at(-2)?.close ?? 0;
  const last      = lastBar?.close ?? 0;
  const change    = last - prev;
  const changePct = prev !== 0 ? (change / prev) * 100 : 0;
  const isUp      = change >= 0;

  // ── Legend: hovered bar, or fall back to last bar ─────────────────────────
  const displayBar: HoveredBar = hoveredBar ?? {
    time:   lastBar?.time    ?? '',
    open:   lastBar?.open    ?? 0,
    high:   lastBar?.high    ?? 0,
    low:    lastBar?.low     ?? 0,
    close:  lastBar?.close   ?? 0,
    volume: lastBar?.volume  ?? 0,
    ma5:    ma5Data.at(-1)?.value,
    ma10:   ma10Data.at(-1)?.value,
    ma20:   ma20Data.at(-1)?.value,
    ma60:   ma60Data.at(-1)?.value,
  };
  const legendUp = displayBar.close >= displayBar.open;

  useEffect(() => {
    if (!mainRef.current || !volRef.current || !subRef.current || !data.length) return;

    // Fast lookup maps for crosshair handler
    const ma5Map  = new Map(ma5Data.map(d  => [String(d.time),  d.value]));
    const ma10Map = new Map(ma10Data.map(d => [String(d.time), d.value]));
    const ma20Map = new Map(ma20Data.map(d => [String(d.time), d.value]));
    const ma60Map = new Map(ma60Data.map(d => [String(d.time), d.value]));
    const volMap  = new Map(data.map(d => [String(d.time), d.volume]));

    // ── 1. Main price chart ────────────────────────────────────────────────
    const main = createChart(mainRef.current, {
      layout: COMMON_LAYOUT,
      grid: COMMON_GRID,
      width: mainRef.current.clientWidth,
      height: 320,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#e5e7eb' },
      rightPriceScale: { borderColor: '#e5e7eb' },
      crosshair: {
        // Snap horizontal line to close price of hovered candle
        horzLine: { labelVisible: true },
        vertLine: { labelVisible: false },
      },
    });

    if (lineOnly) {
      const line = main.addSeries(LineSeries, { color: '#1a1a2e', lineWidth: 2 });
      line.setData(data.map(d => ({ time: d.time, value: d.close })) as any);
    } else {
      const candle = main.addSeries(CandlestickSeries, {
        upColor: '#c0392b', downColor: '#4a7c59',
        borderVisible: false,
        wickUpColor: '#c0392b', wickDownColor: '#4a7c59',
      });
      candle.setData(data as any);

      const ma5Series  = main.addSeries(LineSeries, { color: '#f1c40f', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
      ma5Series.setData(ma5Data as any);
      const ma10Series = main.addSeries(LineSeries, { color: '#e67e22', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
      ma10Series.setData(ma10Data as any);
      const ma20Series = main.addSeries(LineSeries, { color: '#3498db', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
      ma20Series.setData(ma20Data as any);
      const ma60Series = main.addSeries(LineSeries, { color: '#8e44ad', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
      ma60Series.setData(ma60Data as any);

      // ── Crosshair → legend ──────────────────────────────────────────────
      main.subscribeCrosshairMove(param => {
        if (!param.time || !param.point) {
          setHoveredBar(null);
          return;
        }
        const t  = String(param.time);
        const cd = param.seriesData.get(candle) as any;
        if (!cd) { setHoveredBar(null); return; }
        setHoveredBar({
          time:   t,
          open:   cd.open,
          high:   cd.high,
          low:    cd.low,
          close:  cd.close,
          volume: volMap.get(t) ?? 0,
          ma5:    ma5Map.get(t),
          ma10:   ma10Map.get(t),
          ma20:   ma20Map.get(t),
          ma60:   ma60Map.get(t),
        });
      });
    }

    // ── 2. Volume chart ────────────────────────────────────────────────────
    const vol = createChart(volRef.current, {
      layout: COMMON_LAYOUT,
      grid: COMMON_GRID,
      width: volRef.current.clientWidth,
      height: 100,
      timeScale: { visible: false },
      rightPriceScale: { borderColor: '#e5e7eb' },
    });
    const volSeries = vol.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
    volSeries.setData(
      data.map(d => ({
        time:  d.time,
        value: d.volume,
        color: d.close >= d.open ? '#c0392b' : '#4a7c59',
      })) as any
    );

    // ── 3. Indicator chart ─────────────────────────────────────────────────
    const sub = createChart(subRef.current, {
      layout: COMMON_LAYOUT,
      grid: COMMON_GRID,
      width: subRef.current.clientWidth,
      height: 160,
      timeScale: { visible: false },
      rightPriceScale: { borderColor: '#e5e7eb' },
    });

    if (tab === 'MACD') {
      const macd = calculateMACD(data);
      const hist = sub.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
      hist.setData(
        macd.histogram.map(d => ({ ...d, color: d.value >= 0 ? '#c0392b' : '#4a7c59' })) as any
      );
      const dif = sub.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1 });
      dif.setData(macd.dif as any);
      const dem = sub.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1 });
      dem.setData(macd.dem as any);
    } else if (tab === 'KD') {
      const kd = calculateKD(data);
      const k = sub.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2 });
      k.setData(kd.map(d => ({ time: d.time, value: d.k })) as any);
      const d = sub.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2 });
      d.setData(kd.map(d => ({ time: d.time, value: d.d })) as any);
    } else {
      // RSI
      const rsi = calculateRSI(data, 14);
      const rsiLine = sub.addSeries(LineSeries, { color: '#8e44ad', lineWidth: 2 });
      rsiLine.setData(rsi as any);
      const ob = sub.addSeries(LineSeries, { color: '#e74c3c', lineWidth: 1 });
      ob.setData(rsi.map(d => ({ time: d.time, value: 70 })) as any);
      const os = sub.addSeries(LineSeries, { color: '#27ae60', lineWidth: 1 });
      os.setData(rsi.map(d => ({ time: d.time, value: 30 })) as any);
    }

    // ── Sync scroll ────────────────────────────────────────────────────────
    main.timeScale().subscribeVisibleTimeRangeChange(() => {
      const r = main.timeScale().getVisibleLogicalRange();
      if (r) { vol.timeScale().setVisibleLogicalRange(r); sub.timeScale().setVisibleLogicalRange(r); }
    });

    const onResize = () => {
      if (mainRef.current) main.applyOptions({ width: mainRef.current.clientWidth });
      if (volRef.current)  vol.applyOptions({ width: volRef.current.clientWidth });
      if (subRef.current)  sub.applyOptions({ width: subRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      main.remove(); vol.remove(); sub.remove();
    };
  }, [data, tab, lineOnly, ma5Data, ma10Data, ma20Data, ma60Data]);

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
                {last.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className={`price-diff ${isUp ? 'price-up' : 'price-down'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
        <div className="chart-controls">
          {(['MACD', 'KD', 'RSI'] as IndicatorTab[]).map(t => (
            <button key={t} className={`chart-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── Main chart + OHLC legend ── */}
      <div className="chart-section">
        {/* Legend row — updates on crosshair hover */}
        {!lineOnly && (
          <div className="chart-ohlc-legend">
            <span className="legend-date">{displayBar.time}</span>
            <span className="legend-item">
              開&thinsp;<span className="legend-val">{displayBar.open.toFixed(2)}</span>
            </span>
            <span className="legend-item">
              高&thinsp;<span className={`legend-val ${legendUp ? 'price-up' : 'price-down'}`}>{displayBar.high.toFixed(2)}</span>
            </span>
            <span className="legend-item">
              低&thinsp;<span className={`legend-val ${legendUp ? 'price-up' : 'price-down'}`}>{displayBar.low.toFixed(2)}</span>
            </span>
            <span className="legend-item">
              收&thinsp;<span className={`legend-val ${legendUp ? 'price-up' : 'price-down'}`}>{displayBar.close.toFixed(2)}</span>
            </span>
            <span className="legend-item">
              量&thinsp;<span className="legend-val">{displayBar.volume.toLocaleString()}</span>
            </span>
            {displayBar.ma5  !== undefined && (
              <span className="legend-item"><span className="legend-ma ma5-color">MA5</span>&thinsp;<span className="legend-val">{displayBar.ma5.toFixed(2)}</span></span>
            )}
            {displayBar.ma10 !== undefined && (
              <span className="legend-item"><span className="legend-ma ma10-color">MA10</span>&thinsp;<span className="legend-val">{displayBar.ma10.toFixed(2)}</span></span>
            )}
            {displayBar.ma20 !== undefined && (
              <span className="legend-item"><span className="legend-ma ma20-color">MA20</span>&thinsp;<span className="legend-val">{displayBar.ma20.toFixed(2)}</span></span>
            )}
            {displayBar.ma60 !== undefined && (
              <span className="legend-item"><span className="legend-ma ma60-color">MA60</span>&thinsp;<span className="legend-val">{displayBar.ma60.toFixed(2)}</span></span>
            )}
          </div>
        )}
        <div ref={mainRef} className="main-chart" />
      </div>

      {/* ── Volume ── */}
      <span className="chart-label" style={{ marginTop: '0.5rem' }}>成交量</span>
      <div ref={volRef} className="vol-chart" />

      {/* ── Indicator ── */}
      <span className="chart-label" style={{ marginTop: '0.5rem' }}>
        {tab === 'MACD' ? 'MACD (12,26,9) · DIF · DEM · OSC'
          : tab === 'KD' ? 'KD 隨機指標 (9) · K · D'
          : 'RSI (14) · 超買 70 · 超賣 30'}
      </span>
      <div ref={subRef} className="sub-chart" />

      {/* ── Chips (Institutional) ── */}
      {!lineOnly && chipData && <ChipPanel data={chipData} />}
    </div>
  );
}
