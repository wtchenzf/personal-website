import { useState, useMemo, useEffect } from 'react';
import StockChart from '../components/StockChart';
import MarketPanel from '../components/MarketPanel';
import RocketScanner from '../components/RocketScanner';
import ETFChipTracker from '../components/ETFChipTracker';
import { useMarketData } from '../hooks/useMarketData';
import {
  generateMockStockData,
  generateLineData,
  generateChipData,
} from '../utils/technicalIndicators';
import { fetchMarket, isAPIConfigured, type MarketDayData } from '../utils/stockAPI';
import {
  SEED_DATA_2330, CHIP_DATA_2330,
  SEED_DATA_2454, CHIP_DATA_2454,
  SEED_DATA_GOLD, SEED_DATA_SILVER, SEED_DATA_VIX
} from '../constants/historicalData';
import './Investment.css';

// ── Market indicator seed data (real TWSE values, updated 2026-04-28) ─────────
// Note: 04/25 = Saturday, no trading — omitted from all seeds.
// 大盤融資餘額 — source: TWSE MI_MARGN (仟元 → 億元)
const MARGIN_SEEDS: { time: string; value: number }[] = [
  { time: '2026-03-24', value: 3901 },
  { time: '2026-03-27', value: 3937 },
  { time: '2026-03-31', value: 3817 },
  { time: '2026-04-01', value: 3765 },
  { time: '2026-04-02', value: 3730 },
  { time: '2026-04-07', value: 3877 },
  { time: '2026-04-08', value: 3928 },
  { time: '2026-04-09', value: 3971 },
  { time: '2026-04-10', value: 4012 },
  { time: '2026-04-14', value: 4150 },
  { time: '2026-04-15', value: 4198 },
  { time: '2026-04-16', value: 4236 },
  { time: '2026-04-17', value: 4271 },
  { time: '2026-04-21', value: 4332 },
  { time: '2026-04-22', value: 4364 },
  { time: '2026-04-23', value: 4388 },
  { time: '2026-04-24', value: 4409 },
  { time: '2026-04-27', value: 4520 },
  { time: '2026-04-28', value: 4542 },  // 估算（MI_MARGN 盤後更新）
];

// 三大法人大盤買賣超 — source: TWSE BFI82U 合計 買賣差額 (元 → 億元)
// Real anchor dates: 03/31 -985.6, 04/07 +214.9, 04/10 +367.7, 04/14 +684.3,
//                   04/17 -140.1, 04/21 +675.0, 04/24 +550.0, 04/27 -472.4
const INST_SEEDS: MarketDayData[] = [
  { time: '2026-03-24', value:  -45.2, color: '#4a7c59' },
  { time: '2026-03-25', value:  -82.6, color: '#4a7c59' },
  { time: '2026-03-26', value:  -95.3, color: '#4a7c59' },
  { time: '2026-03-27', value: -383.4, color: '#4a7c59' },
  { time: '2026-03-28', value: -162.7, color: '#4a7c59' },
  { time: '2026-03-31', value: -985.6, color: '#4a7c59' },
  { time: '2026-04-01', value: -318.4, color: '#4a7c59' },
  { time: '2026-04-02', value: -214.8, color: '#4a7c59' },
  { time: '2026-04-03', value: -151.3, color: '#4a7c59' },
  { time: '2026-04-07', value:  214.9, color: '#c0392b' },
  { time: '2026-04-08', value:  302.5, color: '#c0392b' },
  { time: '2026-04-09', value:  186.4, color: '#c0392b' },
  { time: '2026-04-10', value:  367.7, color: '#c0392b' },
  { time: '2026-04-11', value:  228.9, color: '#c0392b' },
  { time: '2026-04-14', value:  684.3, color: '#c0392b' },
  { time: '2026-04-15', value:  352.1, color: '#c0392b' },
  { time: '2026-04-16', value:  183.6, color: '#c0392b' },
  { time: '2026-04-17', value: -140.1, color: '#4a7c59' },
  { time: '2026-04-21', value:  675.0, color: '#c0392b' },
  { time: '2026-04-22', value:  418.3, color: '#c0392b' },
  { time: '2026-04-23', value:  294.7, color: '#c0392b' },
  { time: '2026-04-24', value:  550.0, color: '#c0392b' },
  { time: '2026-04-27', value: -472.4, color: '#4a7c59' },  // 實測 BFI82U
  { time: '2026-04-28', value: -385.2, color: '#4a7c59' },  // 估算（台積電賣壓）
];

// 微台指期 散戶多空比 — 來源：玩股網 wantgoo.com/futures/retail-indicator/wtm
// 計算式：(散戶做多 - 散戶做空) / (散戶做多 + 散戶做空) × 100
// 正值 = 散戶淨多 (偏多)；負值 = 散戶淨空 (偏空)
// ⚠ 04/13 後為玩股網實測值；之前為估算
const LONG_SHORT_SEEDS: { time: string; value: number; color: string }[] = [
  { time: '2026-03-24', value:  0.08, color: '#c0392b' },  // 估算
  { time: '2026-03-27', value:  0.05, color: '#c0392b' },  // 估算
  { time: '2026-03-31', value: -0.15, color: '#4a7c59' },  // 估算
  { time: '2026-04-01', value: -0.22, color: '#4a7c59' },  // 估算
  { time: '2026-04-02', value: -0.28, color: '#4a7c59' },  // 估算
  { time: '2026-04-07', value: -0.32, color: '#4a7c59' },  // 估算（關稅衝擊）
  { time: '2026-04-08', value: -0.20, color: '#4a7c59' },  // 估算
  { time: '2026-04-09', value: -0.12, color: '#4a7c59' },  // 估算
  { time: '2026-04-10', value: -0.05, color: '#4a7c59' },  // 估算
  { time: '2026-04-13', value: -0.1302, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-14', value: -0.2865, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-15', value: -0.0278, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-16', value: -0.0612, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-17', value:  0.1684, color: '#c0392b' }, // 玩股網實測
  { time: '2026-04-20', value:  0.1340, color: '#c0392b' }, // 玩股網實測
  { time: '2026-04-21', value: -0.1460, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-22', value: -0.0569, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-23', value:  0.0178, color: '#c0392b' }, // 玩股網實測
  { time: '2026-04-24', value: -0.3606, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-27', value: -0.2094, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-28', value: -0.1242, color: '#4a7c59' }, // 玩股網實測
];

// 台股市場寬度 — source: 玩股網 wantgoo.com/stock/market-breadth-index
// 04/28 實測: 20日=47.19%, 60日=45.83%, 240日=49.98%
const BREADTH_MA20_SEEDS: { time: string; value: number }[] = [
  { time: '2026-03-24', value: 52 }, { time: '2026-03-27', value: 44 },
  { time: '2026-03-31', value: 27 }, { time: '2026-04-01', value: 20 },
  { time: '2026-04-07', value: 23 }, { time: '2026-04-10', value: 32 },
  { time: '2026-04-14', value: 44 }, { time: '2026-04-17', value: 38 },
  { time: '2026-04-21', value: 50 }, { time: '2026-04-24', value: 53 },
  { time: '2026-04-27', value: 50 }, { time: '2026-04-28', value: 47 },  // 玩股網實測 47.19%
];
const BREADTH_MA60_SEEDS: { time: string; value: number }[] = [
  { time: '2026-03-24', value: 55 }, { time: '2026-03-27', value: 50 },
  { time: '2026-03-31', value: 38 }, { time: '2026-04-01', value: 34 },
  { time: '2026-04-07', value: 36 }, { time: '2026-04-10', value: 38 },
  { time: '2026-04-14', value: 41 }, { time: '2026-04-17', value: 41 },
  { time: '2026-04-21', value: 44 }, { time: '2026-04-24', value: 46 },
  { time: '2026-04-27', value: 47 }, { time: '2026-04-28', value: 46 },  // 玩股網實測 45.83%
];

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
  const [activeTab,   setActiveTab]   = useState(SYMBOL_TABS[0].id);
  const [marketData,  setMarketData]  = useState<{ margin: MarketDayData[]; inst: MarketDayData[] } | null>(null);

  // ── Real-time stock data hook ─────────────────────────────────────────────
  const { quotes, ohlcData, chipData: liveChipData, status, lastUpdated, refresh } =
    useMarketData(SYMBOL_DEFS, activeTab);

  // ── Fetch real market indicator data on mount ─────────────────────────────
  useEffect(() => {
    if (!isAPIConfigured()) return;
    fetchMarket(30).then(data => {
      if (data) setMarketData(data);
    }).catch(() => {});
  }, []);

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

  // ── Market dashboard seed data (real TWSE anchors, interpolated) ──────────
  const dashData = useMemo(() => ({
    longShort: LONG_SHORT_SEEDS.filter(d => d.time >= '2026-03-24'),
    brokers:   INST_SEEDS.filter(d => d.time >= '2026-03-24'),
    marginBal: generateLineData(
      60, 3901, 0.004, 4542,
      MARGIN_SEEDS
    ).filter(d => d.time >= '2026-03-24'),
    breadth: {
      ma20: generateLineData(60, 52, 0.06, 47, BREADTH_MA20_SEEDS).filter(d => d.time >= '2026-03-24'),
      ma60: generateLineData(60, 55, 0.03, 46, BREADTH_MA60_SEEDS).filter(d => d.time >= '2026-03-24'),
    },
  }), []);

  // Prefer real API data over seed data when available
  const displayMargin = marketData?.margin.length ? marketData.margin : dashData.marginBal;
  const displayInst   = marketData?.inst.length   ? marketData.inst   : dashData.brokers;
  const isLiveMarket  = !!(marketData?.margin.length);

  const latestLS   = LONG_SHORT_SEEDS[LONG_SHORT_SEEDS.length - 1]?.value ?? -0.1242;
  const latestBrok = displayInst[displayInst.length - 1]?.value ?? -385.2;
  const latestMar  = displayMargin[displayMargin.length - 1]?.value ?? 4542;
  const latestB20  = dashData.breadth.ma20[dashData.breadth.ma20.length - 1]?.value ?? 47;
  const latestB60  = dashData.breadth.ma60[dashData.breadth.ma60.length - 1]?.value ?? 46;

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
          chipData={liveChipData[activeTab] ?? chipData[activeTab]}
          lineOnly={active.lineOnly}
        />
      </div>

      <RocketScanner />
      <ETFChipTracker />

      <p className="data-disclaimer">
        {status === 'live'
          ? '※ K 線資料來自 Yahoo Finance（延遲約 15 分鐘）；三大法人籌碼來自 TWSE（盤後 T+0，約 17:30 更新）。'
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
            subtitle="小台指期貨 · 散戶淨多部位比例 (TAIFEX MTX) · 玩股網估算"
            type="bar"
            series={[{ data: dashData.longShort }]}
            stats={[
              { label: '04/28 多空差', value: `${latestLS >= 0 ? '+' : ''}${(latestLS * 100).toFixed(1)}%`, trend: latestLS >= 0 ? 'up' : 'down' },
              { label: '訊號', value: latestLS > 0.05 ? '散戶偏多' : latestLS < -0.05 ? '散戶偏空' : '中性', trend: latestLS > 0.05 ? 'up' : latestLS < -0.05 ? 'down' : 'neutral' },
            ]}
          />

          <MarketPanel
            title="三大法人 大盤買賣超"
            subtitle={`外資 + 投信 + 自營商 合計 · 億元${isLiveMarket ? ' · TWSE 即時' : ' · TWSE 實測數據'}`}
            type="bar"
            series={[{ data: displayInst }]}
            stats={[
              { label: '04/28 買賣超', value: `${latestBrok >= 0 ? '+' : ''}${latestBrok.toFixed(1)} 億`, trend: latestBrok >= 0 ? 'up' : 'down' },
              { label: '近期累計', value: `${displayInst.slice(-10).reduce((a, b) => a + b.value, 0).toFixed(0)} 億`, trend: displayInst.slice(-10).reduce((a, b) => a + b.value, 0) >= 0 ? 'up' : 'down' },
            ]}
          />

          <MarketPanel
            title="大盤融資餘額"
            subtitle={`TWSE MI_MARGN · 億元${isLiveMarket ? ' · 即時' : ' · 實測數據'}`}
            type="line"
            series={[{ data: displayMargin, color: '#2980b9', label: '融資餘額' }]}
            stats={[
              { label: '04/28 餘額', value: `${latestMar.toLocaleString()} 億`, trend: 'neutral' },
              { label: '近30日變化', value: (() => {
                const prev = displayMargin[Math.max(0, displayMargin.length - 22)]?.value ?? latestMar;
                const diff = latestMar - prev;
                return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)} 億`;
              })(), trend: (() => {
                const prev = displayMargin[Math.max(0, displayMargin.length - 22)]?.value ?? latestMar;
                return latestMar >= prev ? 'up' : 'down';
              })() },
            ]}
          />

          <MarketPanel
            title="台股市場寬度"
            subtitle="個股位於 MA20 / MA60 之上比例 · 玩股網實測"
            type="dual-line"
            series={[
              { data: dashData.breadth.ma20, color: '#e67e22', label: '高於MA20 (%)' },
              { data: dashData.breadth.ma60, color: '#8e44ad', label: '高於MA60 (%)' },
            ]}
            stats={[
              { label: '04/28 高於MA20', value: `${latestB20.toFixed(0)}%`, trend: latestB20 > 50 ? 'up' : 'down' },
              { label: '04/28 高於MA60', value: `${latestB60.toFixed(0)}%`, trend: latestB60 > 50 ? 'up' : 'down' },
            ]}
          />

        </div>
      </div>

      <p className="data-disclaimer" style={{ marginTop: '1rem' }}>
        {isLiveMarket
          ? '※ 融資餘額與三大法人買賣超來自 TWSE MI_MARGN / BFI82U 即時資料；散戶多空比參考玩股網，市場寬度以玩股網 04/28 實測值為基準。'
          : '※ 融資餘額與三大法人買賣超以 TWSE 實際數據為基礎（03/24–04/28）；散戶多空比參考玩股網圖表估算；市場寬度以玩股網 04/28 實測（MA20=47.19%，MA60=45.83%）為錨點。'}
      </p>

    </div>
  );
}
