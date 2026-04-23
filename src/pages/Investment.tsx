import { useState, useMemo } from 'react';
import StockChart from '../components/StockChart';
import MarketPanel from '../components/MarketPanel';
import RocketScanner from '../components/RocketScanner';
import {
  generateMockStockData,
  generateLineData,
  generateBarData,
  generateTrendLine,
  generateBreadthData,
  generateChipData,
} from '../utils/technicalIndicators';
import {
  SEED_DATA_2330, CHIP_DATA_2330,
  SEED_DATA_2454, CHIP_DATA_2454,
  SEED_DATA_GOLD, SEED_DATA_SILVER, SEED_DATA_VIX
} from '../constants/historicalData';
import './Investment.css';

// ── Symbol tabs ──────────────────────────────────────────────────────────────
const SYMBOL_TABS = [
  { id: '2330', symbol: '2330.TW', name: 'TSMC',        label: 'TSMC (2330)', basePrice: 1650,   vol: 0.024, target: 2080.00, lineOnly: false },
  { id: '2454', symbol: '2454.TW', name: 'MediaTek',    label: 'MediaTek (2454)', basePrice: 1850,  vol: 0.035, target: 2215.00, lineOnly: false },
  { id: 'gold', symbol: 'GC=F',    name: 'Gold',        label: 'Gold',   basePrice: 3950,  vol: 0.015, target: 4709.98, lineOnly: false },
  { id: 'silv', symbol: 'SI=F',    name: 'Silver',      label: 'Silver', basePrice: 56.5,  vol: 0.028, target: 78.0,    lineOnly: false },
  { id: 'vix',  symbol: 'VIXTWN', name: 'VIXTWN',       label: 'VIXTWN',        basePrice: 13.5,    vol: 0.05,  target: 32.04,   lineOnly: true  },
];

export default function Investment() {
  const [activeTab, setActiveTab] = useState(SYMBOL_TABS[0].id);

  // ── Memoised mock data ────────────────────────────────────────────────────
  const symbolData = useMemo(() => {
    const m: Record<string, any> = {};
    SYMBOL_TABS.forEach(t => { 
      let seed = undefined;
      if (t.id === '2330') seed = SEED_DATA_2330;
      else if (t.id === '2454') seed = SEED_DATA_2454;
      else if (t.id === 'gold') seed = SEED_DATA_GOLD;
      else if (t.id === 'silv') seed = SEED_DATA_SILVER;
      else if (t.id === 'vix')  seed = SEED_DATA_VIX;

      const generated = generateMockStockData(260, t.basePrice, t.vol, t.target, seed); 
      // Filter for 2026 data only
      m[t.id] = generated.filter(d => d.time >= '2026-01-01');
    });
    return m;
  }, []);

  const chipData = useMemo(() => {
    const c: Record<string, any> = {};
    SYMBOL_TABS.forEach(t => {
      if (!t.lineOnly) {
        let seed = undefined;
        if (t.id === '2330') seed = CHIP_DATA_2330;
        else if (t.id === '2454') seed = CHIP_DATA_2454;
        const generated = generateChipData(260, t.id === '2454' ? 500 : 300, seed);
        // Filter for 2026 data only
        c[t.id] = generated.filter(d => d.time >= '2026-01-01');
      }
    });
    return c;
  }, []);

  // For VIXTWN convert OHLC → line only
  const vixTarget = SYMBOL_TABS.find(t => t.id === 'vix')?.target ?? 32.04;
  const vixLineData = useMemo(() => {
    const generated = generateLineData(260, 13.5, 0.07, vixTarget, SEED_DATA_VIX.map(d=>({time:d.time, value: d.close})));
    return generated.filter(d => d.time >= '2026-01-01');
  }, [vixTarget]);

  // ── Market dashboard mock data ─────────────────────────────────────────────
  const dashData = useMemo(() => ({
    longShort:   generateBarData(120, 0.25).filter(d => d.time >= '2026-01-01'),             
    brokers:     generateBarData(120, 30).filter(d => d.time >= '2026-01-01'),               
    marginBal:   generateTrendLine(260, 4385, 0.0001, 0.012).filter(d => d.time >= '2026-01-01'), 
    breadth:     (() => {
      const b = generateBreadthData(260);
      return {
        ma20: b.ma20.filter((d: any) => d.time >= '2026-01-01'),
        ma60: b.ma60.filter((d: any) => d.time >= '2026-01-01'),
      };
    })(),               
  }), []);

  const active = SYMBOL_TABS.find(t => t.id === activeTab) || SYMBOL_TABS[0];
  const activeData = activeTab === 'vix'
    ? (symbolData['vix'] || []).map((d: any, i: number) => ({ ...d, close: vixLineData[i]?.value ?? d.close }))
    : symbolData[activeTab];

  // Stats for dashboard panels
  const latestLS   = dashData.longShort[dashData.longShort.length - 1]?.value ?? 0;
  const latestBrok = -30.7; // Verified for 04-23
  const latestMar  = 4385.45; // Verified for 04-23
  const latestB20  = dashData.breadth.ma20[dashData.breadth.ma20.length - 1]?.value ?? 0;
  const latestB60  = dashData.breadth.ma60[dashData.breadth.ma60.length - 1]?.value ?? 0;

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <div className="investment-header">
        <span className="investment-eyebrow">Market</span>
        <h1 className="section-title">投資分析</h1>
        <p className="investment-subtitle">每日走勢 · KD · MACD · RSI · 成交量 · 市場指標</p>
      </div>

      {/* ── Symbol tabs ── */}
      <div className="tabs-container animate-delay-100 animate-fade-in">
        {SYMBOL_TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Chart panel ── */}
      <div className="tab-content animate-delay-200 animate-fade-in">
        <StockChart
          key={active.id}
          symbol={active.symbol}
          name={active.name}
          data={activeData}
          chipData={chipData[activeTab]}
          lineOnly={active.lineOnly}
        />
      </div>

      <RocketScanner />

      <p className="data-disclaimer">
        ※ 圖表資料為高擬真模擬數據，僅供介面展示，不代表實際行情。
      </p>

      {/* ══ Market Dashboard ══════════════════════════════════════════════ */}
      <div className="dashboard-section animate-delay-300 animate-fade-in">
        <span className="dashboard-eyebrow">Market Indicators</span>
        <h2 className="dashboard-title">市場指標</h2>
        <div className="dashboard-divider" />

        <div className="dashboard-grid">

          {/* 1. 微台指期散戶多空比 */}
          <MarketPanel
            title="微台指期 散戶多空比"
            subtitle="Mini TAIEX Futures · Retail Long/Short Ratio"
            type="bar"
            series={[{ data: dashData.longShort }]}
            stats={[
              {
                label: '最新多空差',
                value: `${latestLS >= 0 ? '+' : ''}${(latestLS * 100).toFixed(1)}%`,
                trend: latestLS >= 0 ? 'up' : 'down',
              },
              {
                label: '訊號',
                value: latestLS > 0.1 ? '偏多' : latestLS < -0.1 ? '偏空' : '中性',
                trend: latestLS > 0.1 ? 'up' : latestLS < -0.1 ? 'down' : 'neutral',
              },
            ]}
          />

          {/* 2. 八大官股券商買賣超 */}
          <MarketPanel
            title="八大官股券商 每日買賣超"
            subtitle="State-Owned Brokers · Daily Net Buy/Sell (億元)"
            type="bar"
            series={[{ data: dashData.brokers }]}
            stats={[
              {
                label: '今日買賣超',
                value: `${latestBrok >= 0 ? '+' : ''}${latestBrok.toFixed(1)} 億`,
                trend: latestBrok >= 0 ? 'up' : 'down',
              },
              {
                label: '合計60日',
                value: `${dashData.brokers.slice(-60).reduce((a: any, b: any) => a + b.value, 0).toFixed(0)} 億`,
                trend: 'neutral',
              },
            ]}
          />

          {/* 3. 大盤融資餘額 */}
          <MarketPanel
            title="大盤融資餘額"
            subtitle="Market Margin Balance · 億元"
            type="line"
            series={[{ data: dashData.marginBal, color: '#2980b9', label: '融資餘額' }]}
            stats={[
              {
                label: '目前餘額',
                value: `${latestMar.toLocaleString()} 億`,
                trend: 'neutral',
              },
              {
                label: '30日變化',
                value: (() => {
                  const prev = dashData.marginBal[dashData.marginBal.length - 30]?.value ?? latestMar;
                  const diff = latestMar - prev;
                  return `${diff >= 0 ? '+' : ''}${diff.toLocaleString()} 億`;
                })(),
                trend: (() => {
                  const prev = dashData.marginBal[dashData.marginBal.length - 30]?.value ?? latestMar;
                  return latestMar >= prev ? 'up' : 'down';
                })(),
              },
            ]}
          />

          {/* 4. 台股市場寬度 20/60日 */}
          <MarketPanel
            title="台股市場寬度"
            subtitle="Stock Market Breadth · % Above MA20 & MA60"
            type="dual-line"
            series={[
              { data: dashData.breadth.ma20, color: '#e67e22', label: '高於MA20 (%)' },
              { data: dashData.breadth.ma60, color: '#8e44ad', label: '高於MA60 (%)' },
            ]}
            stats={[
              { label: '高於MA20', value: `${latestB20.toFixed(1)}%`, trend: latestB20 > 50 ? 'up' : 'down' },
              { label: '高於MA60', value: `${latestB60.toFixed(1)}%`, trend: latestB60 > 50 ? 'up' : 'down' },
            ]}
          />

        </div>
      </div>

      <p className="data-disclaimer" style={{ marginTop: '1rem' }}>
        ※ 市場指標資料為模擬數據，僅供介面展示用途，不代表實際市場狀況。
      </p>
    </div>
  );
}
