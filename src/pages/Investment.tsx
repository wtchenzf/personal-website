import { useState, useMemo } from 'react';
import StockChart from '../components/StockChart';
import MarketPanel from '../components/MarketPanel';
import RocketScanner from '../components/RocketScanner';
import ETFChipTracker from '../components/ETFChipTracker';
import { useMarketData } from '../hooks/useMarketData';
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

// ── Symbol tabs ───────────────────────────────────────────────────────────────
// yahooSymbol: ticker used by Yahoo Finance (and the stock-proxy Worker)
// ^VIX is the US VIX — used as proxy when VIXTWN is unavailable on Yahoo
const SYMBOL_TABS = [
  { id: '2330', symbol: '2330.TW', yahooSymbol: '2330.TW', name: 'TSMC',     label: 'TSMC (2330)',     basePrice: 1900,  vol: 0.018, target: 2185,  lineOnly: false },
  { id: '2454', symbol: '2454.TW', yahooSymbol: '2454.TW', name: 'MediaTek', label: 'MediaTek (2454)', basePrice: 1650,  vol: 0.028, target: 2435,  lineOnly: false },
  { id: 'gold', symbol: 'GC=F',   yahooSymbol: 'GC=F',    name: 'Gold',      label: 'Gold (USD/oz)',   basePrice: 4100,  vol: 0.012, target: 4709,  lineOnly: false },
  { id: 'silv', symbol: 'SI=F',   yahooSymbol: 'SI=F',    name: 'Silver',    label: 'Silver (USD/oz)', basePrice: 58.0,  vol: 0.022, target: 75.63, lineOnly: false },
  { id: 'vix',  symbol: 'VIXTWN', yahooSymbol: '^VIX',    name: 'VIXTWN',   label: 'VIXTWN',          basePrice: 32.0,  vol: 0.05,  target: 18.8,  lineOnly: true  },
];

const SYMBOL_DEFS = SYMBOL_TABS.map(t => ({ id: t.id, yahooSymbol: t.yahooSymbol, lineOnly: t.lineOnly }));

// ── Status display helpers ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  mock:    { dot: 'dot-mock',    label: '模擬資料' },
  loading: { dot: 'dot-loading', label: '資料更新中…' },
  live:    { dot: 'dot-live',    label: '即時報價 (延遲 ≤ 15 分鐘)' },
  error:   { dot: 'dot-error',   label: '連線異常，顯示模擬資料' },
} as const;

export default function Investment() {
  const [activeTab, setActiveTab] = useState(SYMBOL_TABS[0].id);

  // ── Real-time data hook ───────────────────────────────────────────────────
  const { quotes, ohlcData, status, lastUpdated, refresh } =
    useMarketData(SYMBOL_DEFS, activeTab);

  // ── Mock / seed data (fallback) ────────────────────────────────────────────
  const mockData = useMemo(() => {
    const m: Record<string, any> = {};
    SYMBOL_TABS.forEach(t => {
      let seed: any = undefined;
      if      (t.id === '2330') seed = SEED_DATA_2330;
      else if (t.id === '2454') seed = SEED_DATA_2454;
      else if (t.id === 'gold') seed = SEED_DATA_GOLD;
      else if (t.id === 'silv') seed = SEED_DATA_SILVER;
      else if (t.id === 'vix')  seed = SEED_DATA_VIX;
      m[t.id] = generateMockStockData(60, t.basePrice, t.vol, t.target, seed);
    });
    return m;
  }, []);

  const chipData = useMemo(() => {
    const c: Record<string, any> = {};
    SYMBOL_TABS.forEach(t => {
      if (!t.lineOnly) {
        let seed: any = undefined;
        if      (t.id === '2330') seed = CHIP_DATA_2330;
        else if (t.id === '2454') seed = CHIP_DATA_2454;
        const generated = generateChipData(60, t.id === '2454' ? 500 : 300, seed);
        c[t.id] = generated.filter((d: any) => d.time >= '2026-04-01');
      }
    });
    return c;
  }, []);

  const vixTarget = SYMBOL_TABS.find(t => t.id === 'vix')?.target ?? 18.8;
  const vixLineData = useMemo(() =>
    generateLineData(60, 32.0, 0.06, vixTarget,
      SEED_DATA_VIX.map(d => ({ time: d.time, value: d.close }))),
  [vixTarget]);

  // ── Resolve active chart data (real → mock fallback) ──────────────────────
  const active = SYMBOL_TABS.find(t => t.id === activeTab) ?? SYMBOL_TABS[0];

  const activeData = useMemo(() => {
    // Prefer real OHLC when available
    const real = ohlcData[activeTab];
    if (real?.length) return real;

    // Fallback to mock/seed
    if (activeTab === 'vix') {
      return (mockData['vix'] ?? []).map((d: any) => {
        const match = vixLineData.find((v: any) => v.time === d.time);
        return { ...d, close: match?.value ?? d.close };
      });
    }
    return mockData[activeTab];
  }, [activeTab, ohlcData, mockData, vixLineData]);

  // ── Market dashboard mock data ─────────────────────────────────────────────
  const dashData = useMemo(() => ({
    longShort: generateBarData(60, 0.25).filter(d => d.time >= '2026-04-01'),
    brokers:   generateBarData(60, 30).filter(d => d.time >= '2026-04-01'),
    marginBal: generateTrendLine(60, 4385, 0.0001, 0.012).filter(d => d.time >= '2026-04-01'),
    breadth: (() => {
      const b = generateBreadthData(60);
      return {
        ma20: b.ma20.filter((d: any) => d.time >= '2026-04-01'),
        ma60: b.ma60.filter((d: any) => d.time >= '2026-04-01'),
      };
    })(),
  }), []);

  const latestLS   = dashData.longShort[dashData.longShort.length - 1]?.value ?? 0;
  const latestBrok = 25.8;
  const latestMar  = 4528.60;
  const latestB20  = dashData.breadth.ma20[dashData.breadth.ma20.length - 1]?.value ?? 0;
  const latestB60  = dashData.breadth.ma60[dashData.breadth.ma60.length - 1]?.value ?? 0;

  const sc = STATUS_CONFIG[status];

  return (
    <div className="animate-fade-in">

      {/* ── Header ── */}
      <div className="investment-header">
        <span className="investment-eyebrow">Market</span>
        <h1 className="section-title">投資分析</h1>
        <p className="investment-subtitle">每日走勢 · KD · MACD · RSI · 成交量 · 市場指標</p>
      </div>

      {/* ── Data status bar ── */}
      <div className="data-status-bar">
        <span className={`status-dot ${sc.dot}`} />
        <span className="status-label">{sc.label}</span>
        {lastUpdated && (
          <span className="status-time">
            更新：{lastUpdated.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
        {status !== 'mock' && (
          <button className="status-refresh-btn" onClick={refresh} title="手動更新">
            ↻ 手動更新
          </button>
        )}
      </div>

      {/* ── Symbol tabs ── */}
      <div className="tabs-container animate-delay-100 animate-fade-in">
        {SYMBOL_TABS.map(tab => {
          const q = quotes[tab.id];
          const pct = q?.changePct ?? null;
          return (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-label">{tab.label}</span>
              {q && (
                <span className="tab-meta">
                  <span className="tab-price">
                    {tab.id === 'gold' || tab.id === 'silv'
                      ? q.price.toFixed(2)
                      : q.price.toLocaleString()}
                  </span>
                  <span className={`tab-change ${pct! >= 0 ? 'up' : 'down'}`}>
                    {pct! >= 0 ? '▲' : '▼'} {Math.abs(pct!).toFixed(2)}%
                  </span>
                </span>
              )}
            </button>
          );
        })}
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
      <ETFChipTracker />

      <p className="data-disclaimer">
        {status === 'live'
          ? '※ K 線資料來自 Yahoo Finance（延遲約 15 分鐘）；籌碼為盤後模擬資料。'
          : '※ 圖表資料為高擬真模擬數據，僅供介面展示，不代表實際行情。'}
      </p>

      {/* ══ Market Dashboard ══════════════════════════════════════════════ */}
      <div className="dashboard-section animate-delay-300 animate-fade-in">
        <span className="dashboard-eyebrow">Market Indicators</span>
        <h2 className="dashboard-title">市場指標</h2>
        <div className="dashboard-divider" />

        <div className="dashboard-grid">

          <MarketPanel
            title="微台指期 散戶多空比"
            subtitle="Mini TAIEX Futures · Retail Long/Short Ratio"
            type="bar"
            series={[{ data: dashData.longShort }]}
            stats={[
              { label: '最新多空差', value: `${latestLS >= 0 ? '+' : ''}${(latestLS * 100).toFixed(1)}%`, trend: latestLS >= 0 ? 'up' : 'down' },
              { label: '訊號', value: latestLS > 0.1 ? '偏多' : latestLS < -0.1 ? '偏空' : '中性', trend: latestLS > 0.1 ? 'up' : latestLS < -0.1 ? 'down' : 'neutral' },
            ]}
          />

          <MarketPanel
            title="八大官股券商 每日買賣超"
            subtitle="State-Owned Brokers · Daily Net Buy/Sell (億元)"
            type="bar"
            series={[{ data: dashData.brokers }]}
            stats={[
              { label: '今日買賣超', value: `${latestBrok >= 0 ? '+' : ''}${latestBrok.toFixed(1)} 億`, trend: latestBrok >= 0 ? 'up' : 'down' },
              { label: '合計60日', value: `${dashData.brokers.slice(-60).reduce((a: any, b: any) => a + b.value, 0).toFixed(0)} 億`, trend: 'neutral' },
            ]}
          />

          <MarketPanel
            title="大盤融資餘額"
            subtitle="Market Margin Balance · 億元"
            type="line"
            series={[{ data: dashData.marginBal, color: '#2980b9', label: '融資餘額' }]}
            stats={[
              { label: '目前餘額', value: `${latestMar.toLocaleString()} 億`, trend: 'neutral' },
              { label: '30日變化', value: (() => { const prev = dashData.marginBal[dashData.marginBal.length - 30]?.value ?? latestMar; const diff = latestMar - prev; return `${diff >= 0 ? '+' : ''}${diff.toLocaleString()} 億`; })(), trend: (() => { const prev = dashData.marginBal[dashData.marginBal.length - 30]?.value ?? latestMar; return latestMar >= prev ? 'up' : 'down'; })() },
            ]}
          />

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
