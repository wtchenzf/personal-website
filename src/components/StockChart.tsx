import { useEffect, useRef, useState } from 'react';
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
  const mainRef   = useRef<HTMLDivElement>(null);
  const volRef    = useRef<HTMLDivElement>(null);
  const subRef    = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<IndicatorTab>('MACD');

  const last      = data.at(-1)?.close ?? 0;
  const prev      = data.at(-2)?.close ?? 0;
  const change    = last - prev;
  const changePct = prev !== 0 ? (change / prev) * 100 : 0;
  const isUp      = change >= 0;

  useEffect(() => {
    if (!mainRef.current || !volRef.current || !subRef.current || !data.length) return;

    // ── 1. Main price chart ────────────────────────────────────────────────
    const main = createChart(mainRef.current, {
      layout: COMMON_LAYOUT,
      grid: COMMON_GRID,
      width: mainRef.current.clientWidth,
      height: 320,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#e5e7eb' },
      rightPriceScale: { borderColor: '#e5e7eb' },
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

      const ma5  = main.addSeries(LineSeries, { color: '#f1c40f', lineWidth: 1 });
      ma5.setData(calculateMA(data, 5) as any);
      const ma10 = main.addSeries(LineSeries, { color: '#e67e22', lineWidth: 1 });
      ma10.setData(calculateMA(data, 10) as any);
      const ma20 = main.addSeries(LineSeries, { color: '#3498db', lineWidth: 1 });
      ma20.setData(calculateMA(data, 20) as any);
      const ma60 = main.addSeries(LineSeries, { color: '#8e44ad', lineWidth: 1 });
      ma60.setData(calculateMA(data, 60) as any);
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
        time: d.time,
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
      // Overbought / Oversold reference lines
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
  }, [data, tab, lineOnly]);

  return (
    <div className="chart-container">
      {/* ── Header ── */}
      <div className="chart-header">
        <div className="chart-info-group">
          <div className="chart-title-row">
            <h2 className="chart-title">{name} ({symbol})</h2>
            <span className="chart-date">{data.at(-1)?.time}</span>
          </div>
          <div className="price-summary-bar">
            <div className="price-main">
              <span className={`chart-price ${isUp ? 'price-up' : 'price-down'}`}>{last.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              <span className={`price-diff ${isUp ? 'price-up' : 'price-down'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
              </span>
            </div>
            <div className="price-details">
              <div className="detail-row">
                <span className="detail-item">開 <span className="detail-val">{(data.at(-1)?.open ?? 0).toFixed(1)}</span></span>
                <span className="detail-item">高 <span className="detail-val">{(data.at(-1)?.high ?? 0).toFixed(1)}</span></span>
              </div>
              <div className="detail-row">
                <span className="detail-item">低 <span className="detail-val">{(data.at(-1)?.low ?? 0).toFixed(1)}</span></span>
                <span className="detail-item">量 <span className="detail-val">{(data.at(-1)?.volume ?? 0).toLocaleString()}</span></span>
              </div>
            </div>
          </div>
        </div>
        <div className="chart-controls">
          {(['MACD', 'KD', 'RSI'] as IndicatorTab[]).map(t => (
            <button key={t} className={`chart-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── Main chart ── */}
      <span className="chart-label">{lineOnly ? '走勢圖' : 'K 線圖 · MA5 · MA10 · MA20 · MA60'}</span>
      <div ref={mainRef} className="main-chart" />

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
