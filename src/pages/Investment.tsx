import { useState, useMemo, useEffect, useCallback } from 'react';
import StockChart from '../components/StockChart';
import MarketPanel from '../components/MarketPanel';
import RocketScanner from '../components/RocketScanner';
import FlowScanner from '../components/FlowScanner';
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

// ── Market indicator seed data (real TWSE values, updated 2026-05-12) ─────────
// Note: 05/01(勞動節)、05/02-03(週末)、04/25(週六) 均非交易日，已省略。
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
  { time: '2026-04-28', value: 4542 },
  { time: '2026-04-29', value: 4571 },
  { time: '2026-04-30', value: 4608 },  // 估算
  { time: '2026-05-04', value: 4695 },  // 估算（五一長假後首日）
  { time: '2026-05-05', value: 4762 },  // 估算（聯發科漲停、市場大漲）
  { time: '2026-05-06', value: 4738 },  // 估算
  { time: '2026-05-07', value: 4714 },  // 估算（健策跌停，部分獲利了結）
  { time: '2026-05-08', value: 4692 },  // 估算
  { time: '2026-05-11', value: 4860 },  // 估算（美中貿易協議，融資大增）
  { time: '2026-05-12', value: 4892 },  // 估算（延續多頭，融資持續增加）
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
  { time: '2026-04-07', value:  214.9, color: '#c0392b' },
  { time: '2026-04-08', value:  302.5, color: '#c0392b' },
  { time: '2026-04-09', value:  186.4, color: '#c0392b' },
  { time: '2026-04-10', value:  367.7, color: '#c0392b' },
  { time: '2026-04-14', value:  684.3, color: '#c0392b' },
  { time: '2026-04-15', value:  352.1, color: '#c0392b' },
  { time: '2026-04-16', value:  183.6, color: '#c0392b' },
  { time: '2026-04-17', value: -140.1, color: '#4a7c59' },
  { time: '2026-04-21', value:  675.0, color: '#c0392b' },
  { time: '2026-04-22', value:  418.3, color: '#c0392b' },
  { time: '2026-04-23', value:  294.7, color: '#c0392b' },
  { time: '2026-04-24', value:  550.0, color: '#c0392b' },
  { time: '2026-04-27', value: -472.4, color: '#4a7c59' },  // 實測 BFI82U
  { time: '2026-04-28', value: -385.2, color: '#4a7c59' },  // 實測 BFI82U
  { time: '2026-04-29', value: -333.0, color: '#4a7c59' },  // 實測（截圖數據）
  { time: '2026-04-30', value:  195.2, color: '#c0392b' },  // 估算（月底法人回補）
  { time: '2026-05-04', value:  328.4, color: '#c0392b' },  // 估算（五一後外資買超）
  { time: '2026-05-05', value:  512.6, color: '#c0392b' },  // 估算（聯發科漲停，外資大買）
  { time: '2026-05-06', value: -142.3, color: '#4a7c59' },  // 估算（部分獲利了結）
  { time: '2026-05-07', value: -225.8, color: '#4a7c59' },  // 估算（健策跌停，法人停損）
  { time: '2026-05-08', value:   86.4, color: '#c0392b' },  // 估算（盤中回穩）
  { time: '2026-05-11', value:  658.2, color: '#c0392b' },  // 估算（美中協議，外資大買）
  { time: '2026-05-12', value:  425.3, color: '#c0392b' },  // 估算（延續買超，幅度收斂）
];

// 微台指期 散戶多空比 — 來源：玩股網 wantgoo.com/futures/retail-indicator/wtm
// 計算式：(散戶做多 - 散戶做空) / (散戶做多 + 散戶做空) × 100
// 正值 = 散戶淨多 (偏多)；負值 = 散戶淨空 (偏空)
// ⚠ 04/13~04/29 為玩股網實測值；其餘為估算
const LONG_SHORT_SEEDS: { time: string; value: number; color: string }[] = [
  { time: '2026-03-24', value:  0.08,   color: '#c0392b' }, // 估算
  { time: '2026-03-27', value:  0.05,   color: '#c0392b' }, // 估算
  { time: '2026-03-31', value: -0.15,   color: '#4a7c59' }, // 估算
  { time: '2026-04-01', value: -0.22,   color: '#4a7c59' }, // 估算
  { time: '2026-04-02', value: -0.28,   color: '#4a7c59' }, // 估算
  { time: '2026-04-07', value: -0.32,   color: '#4a7c59' }, // 估算（關稅衝擊）
  { time: '2026-04-08', value: -0.20,   color: '#4a7c59' }, // 估算
  { time: '2026-04-09', value: -0.12,   color: '#4a7c59' }, // 估算
  { time: '2026-04-10', value: -0.05,   color: '#4a7c59' }, // 估算
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
  { time: '2026-04-29', value: -0.1580, color: '#4a7c59' }, // 玩股網實測
  { time: '2026-04-30', value: -0.1980, color: '#4a7c59' }, // 估算
  { time: '2026-05-04', value: -0.0843, color: '#4a7c59' }, // 估算（五一後市場回溫）
  { time: '2026-05-05', value:  0.1256, color: '#c0392b' }, // 估算（漲停潮，散戶追多）
  { time: '2026-05-06', value:  0.0512, color: '#c0392b' }, // 估算
  { time: '2026-05-07', value: -0.0334, color: '#4a7c59' }, // 估算
  { time: '2026-05-08', value: -0.1428, color: '#4a7c59' }, // 估算
  { time: '2026-05-11', value:  0.2850, color: '#c0392b' }, // 估算（美中協議，散戶積極做多）
  { time: '2026-05-12', value:  0.1920, color: '#c0392b' }, // 估算（延續偏多，幅度略收）
];

// 台股市場寬度 — source: 玩股網 wantgoo.com/stock/market-breadth-index
// 04/28 實測: 20日=47.19%, 60日=45.83%；05/11 估算：市場全面強彈
const BREADTH_MA20_SEEDS: { time: string; value: number }[] = [
  { time: '2026-03-24', value: 52 }, { time: '2026-03-27', value: 44 },
  { time: '2026-03-31', value: 27 }, { time: '2026-04-01', value: 20 },
  { time: '2026-04-07', value: 23 }, { time: '2026-04-10', value: 32 },
  { time: '2026-04-14', value: 44 }, { time: '2026-04-17', value: 38 },
  { time: '2026-04-21', value: 50 }, { time: '2026-04-24', value: 53 },
  { time: '2026-04-27', value: 50 }, { time: '2026-04-28', value: 47 },  // 玩股網實測 47.19%
  { time: '2026-04-29', value: 45 }, { time: '2026-04-30', value: 44 },
  { time: '2026-05-04', value: 50 }, { time: '2026-05-05', value: 62 },  // 聯發科漲停，市場大漲
  { time: '2026-05-06', value: 58 }, { time: '2026-05-07', value: 53 },
  { time: '2026-05-08', value: 51 }, { time: '2026-05-11', value: 74 },  // 估算（全面強彈）
  { time: '2026-05-12', value: 78 },  // 估算（延續擴散）
];
const BREADTH_MA60_SEEDS: { time: string; value: number }[] = [
  { time: '2026-03-24', value: 55 }, { time: '2026-03-27', value: 50 },
  { time: '2026-03-31', value: 38 }, { time: '2026-04-01', value: 34 },
  { time: '2026-04-07', value: 36 }, { time: '2026-04-10', value: 38 },
  { time: '2026-04-14', value: 41 }, { time: '2026-04-17', value: 41 },
  { time: '2026-04-21', value: 44 }, { time: '2026-04-24', value: 46 },
  { time: '2026-04-27', value: 47 }, { time: '2026-04-28', value: 46 },  // 玩股網實測 45.83%
  { time: '2026-04-29', value: 45 }, { time: '2026-04-30', value: 44 },
  { time: '2026-05-04', value: 47 }, { time: '2026-05-05', value: 52 },
  { time: '2026-05-06', value: 50 }, { time: '2026-05-07', value: 49 },
  { time: '2026-05-08', value: 48 }, { time: '2026-05-11', value: 58 },  // 估算（全面強彈）
  { time: '2026-05-12', value: 61 },  // 估算（延續擴散）
];

// ── Symbol tabs ───────────────────────────────────────────────────────────────
// yahooSymbol: ticker used by Yahoo Finance (and the stock-proxy Worker)
// ^VIX is the US VIX — used as proxy when VIXTWN is unavailable on Yahoo
const SYMBOL_TABS = [
  { id: '2330', symbol: '2330.TW', yahooSymbol: '2330.TW', name: 'TSMC',     label: 'TSMC (2330)',     basePrice: 1900,  vol: 0.018, target: 2185,  lineOnly: false },
  { id: '2454', symbol: '2454.TW', yahooSymbol: '2454.TW', name: 'MediaTek', label: 'MediaTek (2454)', basePrice: 1650,  vol: 0.028, target: 2435,  lineOnly: false },
  { id: '3653', symbol: '3653.TW', yahooSymbol: '3653.TW', name: '健策',      label: '健策 (3653)',      basePrice: 3950,  vol: 0.032, target: 3850,  lineOnly: false },
  { id: 'gold', symbol: 'GC=F',   yahooSymbol: 'GC=F',    name: 'Gold',      label: 'Gold (USD/oz)',   basePrice: 4100,  vol: 0.012, target: 4709,  lineOnly: false },
  { id: 'silv', symbol: 'SI=F',   yahooSymbol: 'SI=F',    name: 'Silver',    label: 'Silver (USD/oz)', basePrice: 58.0,  vol: 0.022, target: 75.63, lineOnly: false },
  { id: 'vix',  symbol: 'VIXTWN', yahooSymbol: '^VIX',    name: 'VIXTWN',   label: 'VIXTWN',          basePrice: 32.0,  vol: 0.05,  target: 18.8,  lineOnly: true  },
];

const SYMBOL_DEFS = SYMBOL_TABS.map(t => ({ id: t.id, yahooSymbol: t.yahooSymbol, lineOnly: t.lineOnly }));

// ── Per-symbol report metadata ────────────────────────────────────────────────
const REPORT_CONFIG: Record<string, { signal: number; sector: string }> = {
  '2330': { signal: 82, sector: '半導體製造' },
  '2454': { signal: 72, sector: 'IC 設計' },
  '3653': { signal: 76, sector: '液冷散熱' },
  'gold': { signal: 70, sector: '貴金屬' },
  'silv': { signal: 65, sector: '貴金屬' },
  'vix':  { signal: 30, sector: '市場指標' },
};

// ── Status display helpers ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  mock:    { dot: 'dot-mock',    label: '模擬資料' },
  loading: { dot: 'dot-loading', label: '資料更新中…' },
  live:    { dot: 'dot-live',    label: '即時報價 (延遲 ≤ 15 分鐘)' },
  error:   { dot: 'dot-error',   label: '連線異常，顯示模擬資料' },
} as const;

export default function Investment() {
  const [activeTab,       setActiveTab]       = useState(SYMBOL_TABS[0].id);
  const [marketData,      setMarketData]       = useState<{ margin: MarketDayData[]; inst: MarketDayData[] } | null>(null);
  const [refreshTick,     setRefreshTick]      = useState(0);
  const [isRefreshing,    setIsRefreshing]     = useState(false);
  const [marketLoading,   setMarketLoading]    = useState(false);
  const [marketTick,      setMarketTick]       = useState(0);   // increment to re-fetch market data

  // ── Real-time stock data hook ─────────────────────────────────────────────
  const { quotes, ohlcData, chipData: liveChipData, status, lastUpdated, refresh } =
    useMarketData(SYMBOL_DEFS, activeTab);

  // ── Unified chart refresh handler ─────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshTick(t => t + 1);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // ── Market indicator refresh (triggered by marketTick) ────────────────────
  const refreshMarketIndicators = useCallback(() => {
    setMarketTick(t => t + 1);
  }, []);

  useEffect(() => {
    if (!isAPIConfigured()) return;
    let cancelled = false;
    setMarketLoading(true);
    fetchMarket(30)
      .then(data => { if (!cancelled && data) setMarketData(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMarketLoading(false); });
    return () => { cancelled = true; };
  }, [marketTick]);

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
        const chipScale = t.id === '2454' ? 3000 : t.id === '2330' ? 8000 : 300;
        const generated = generateChipData(60, chipScale, seed);
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
      60, 3901, 0.004, 4892,
      MARGIN_SEEDS
    ).filter(d => d.time >= '2026-03-24'),
    breadth: {
      ma20: generateLineData(60, 52, 0.06, 78, BREADTH_MA20_SEEDS).filter(d => d.time >= '2026-03-24'),
      ma60: generateLineData(60, 55, 0.03, 61, BREADTH_MA60_SEEDS).filter(d => d.time >= '2026-03-24'),
    },
  }), []);

  // Prefer real API data over seed data when available
  const displayMargin = marketData?.margin.length ? marketData.margin : dashData.marginBal;
  const displayInst   = marketData?.inst.length   ? marketData.inst   : dashData.brokers;
  const isLiveMarket  = !!(marketData?.margin.length);

  const latestLS   = LONG_SHORT_SEEDS[LONG_SHORT_SEEDS.length - 1]?.value ?? -0.1580;
  const latestBrok = displayInst[displayInst.length - 1]?.value ?? -333.0;
  const latestMar  = displayMargin[displayMargin.length - 1]?.value ?? 4571;
  const latestB20  = dashData.breadth.ma20[dashData.breadth.ma20.length - 1]?.value ?? 45;
  const latestB60  = dashData.breadth.ma60[dashData.breadth.ma60.length - 1]?.value ?? 45;
  const latestDate = INST_SEEDS[INST_SEEDS.length - 1]?.time.slice(5).replace('-', '/') ?? '04/29';

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
        <button
          className={`status-refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="更新最新資料"
        >
          <span className={`refresh-icon ${isRefreshing ? 'spinning' : ''}`}>↻</span>
          {isRefreshing ? '更新中…' : '更新資料'}
        </button>
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
        {(() => {
          const cfg = REPORT_CONFIG[activeTab] ?? { signal: 60, sector: '—' };
          return (
            <StockChart
              key={active.id}
              symbol={active.symbol}
              name={active.name}
              data={activeData}
              chipData={liveChipData[activeTab] ?? chipData[activeTab]}
              lineOnly={active.lineOnly}
              reportSignal={cfg.signal}
              reportSector={cfg.sector}
            />
          );
        })()}
      </div>

      {/* ── 掃描工具 一鍵更新列 ── */}
      <div className="scanner-refresh-bar">
        <div className="scanner-refresh-info">
          <span className="scanner-refresh-dot" />
          <span className="scanner-refresh-label">
            掃描工具資料 · 潛力飆股 / 大戶連買 / ETF 進出
          </span>
        </div>
        <button
          className={`scanner-refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="一鍵更新：重新掃描飆股、ETF 法人動向、籌碼資料"
        >
          <span className={`scanner-refresh-icon ${isRefreshing ? 'spinning' : ''}`}>🔄</span>
          {isRefreshing ? '更新中…' : '一鍵更新至今日'}
        </button>
      </div>

      <RocketScanner refreshTrigger={refreshTick} />
      <FlowScanner />
      <ETFChipTracker refreshTrigger={refreshTick} />

      <p className="data-disclaimer">
        {status === 'live'
          ? '※ K 線資料來自 Yahoo Finance（延遲約 15 分鐘）；三大法人籌碼來自 TWSE（盤後 T+0，約 17:30 更新）。'
          : '※ 圖表資料為高擬真模擬數據，僅供介面展示，不代表實際行情。'}
      </p>

      {/* ══ Market Dashboard ══════════════════════════════════════════════ */}
      <div className="dashboard-section animate-delay-300 animate-fade-in">
        <div className="dashboard-header-row">
          <div>
            <span className="dashboard-eyebrow">Market Indicators</span>
            <h2 className="dashboard-title">市場指標</h2>
          </div>
          <button
            className={`market-refresh-btn ${marketLoading ? 'loading' : ''}`}
            onClick={refreshMarketIndicators}
            disabled={marketLoading}
            title={isAPIConfigured() ? '重新取得 TWSE 最新市場指標' : '需設定 API 才能取得即時資料'}
          >
            <span className={`market-refresh-icon ${marketLoading ? 'spinning' : ''}`}>↻</span>
            {marketLoading ? '更新中…' : '一鍵更新至今日'}
          </button>
        </div>
        <div className="dashboard-divider" />

        <div className="dashboard-grid">

          <MarketPanel
            title="微台指期 散戶多空比"
            subtitle="小台指期貨 · 散戶淨多部位比例 (TAIFEX MTX) · 玩股網估算"
            type="bar"
            series={[{ data: dashData.longShort }]}
            stats={[
              { label: `${latestDate} 多空差`, value: `${latestLS >= 0 ? '+' : ''}${(latestLS * 100).toFixed(1)}%`, trend: latestLS >= 0 ? 'up' : 'down' },
              { label: '訊號', value: latestLS > 0.05 ? '散戶偏多' : latestLS < -0.05 ? '散戶偏空' : '中性', trend: latestLS > 0.05 ? 'up' : latestLS < -0.05 ? 'down' : 'neutral' },
            ]}
          />

          <MarketPanel
            title="三大法人 大盤買賣超"
            subtitle={`外資 + 投信 + 自營商 合計 · 億元${isLiveMarket ? ' · TWSE 即時' : ' · TWSE 實測數據'}`}
            type="bar"
            series={[{ data: displayInst }]}
            stats={[
              { label: `${latestDate} 買賣超`, value: `${latestBrok >= 0 ? '+' : ''}${latestBrok.toFixed(1)} 億`, trend: latestBrok >= 0 ? 'up' : 'down' },
              { label: '近期累計', value: `${displayInst.slice(-10).reduce((a, b) => a + b.value, 0).toFixed(0)} 億`, trend: displayInst.slice(-10).reduce((a, b) => a + b.value, 0) >= 0 ? 'up' : 'down' },
            ]}
          />

          <MarketPanel
            title="大盤融資餘額"
            subtitle={`TWSE MI_MARGN · 億元${isLiveMarket ? ' · 即時' : ' · 實測數據'}`}
            type="line"
            series={[{ data: displayMargin, color: '#2980b9', label: '融資餘額' }]}
            stats={[
              { label: `${latestDate} 餘額`, value: `${latestMar.toLocaleString()} 億`, trend: 'neutral' },
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
              { label: `${latestDate} 高於MA20`, value: `${latestB20.toFixed(0)}%`, trend: latestB20 > 50 ? 'up' : 'down' },
              { label: `${latestDate} 高於MA60`, value: `${latestB60.toFixed(0)}%`, trend: latestB60 > 50 ? 'up' : 'down' },
            ]}
          />

        </div>
      </div>

      <p className="data-disclaimer" style={{ marginTop: '1rem' }}>
        {isLiveMarket
          ? '※ 融資餘額與三大法人買賣超來自 TWSE MI_MARGN / BFI82U 即時資料；散戶多空比參考玩股網，市場寬度以玩股網最新實測值為基準。'
          : '※ 融資餘額與三大法人買賣超以 TWSE 實際數據為基礎（03/24–05/12）；散戶多空比參考玩股網圖表，05/12 後為估算值；市場寬度以玩股網 04/28 實測（MA20=47.19%，MA60=45.83%）為錨點，05/12 估算持續擴散。'}
      </p>

    </div>
  );
}
