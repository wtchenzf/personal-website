import { useState } from 'react';
import SmartMoneyChart, { type ChipBar } from './SmartMoneyChart';
import StockReportPanel from './StockReportPanel';
import type { OHLCBar } from './MiniKLineChart';
import './FlowScanner.css';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SectorRow {
  name:       string;
  icon:       string;
  netFlow:    number;
  weekChg:    number;
  topStocks:  string[];
  hot:        boolean;
}

interface SmartMoneyStock {
  code:        string;
  name:        string;
  sector:      string;
  price:       number;
  changePct:   number;
  foreignDays: number;
  trustDays:   number;
  dealerDays:  number;
  netBuyK:     number;
  volRatio:    number;
  pricePct:    number;
  signal:      number;
  tags:        string[];
  note:        string;
}

// ══ OHLC + Chip data generator ════════════════════════════════════════════════

// 27 trading days: 03/24 → 04/30 (Taiwan market, verified against TWSE/鉅亨網)
// 03/28=Sat, 03/29=Sun → 03/30 Mon  |  04/04-06=Tomb Sweeping holidays
// 04/11=Sat, 04/12=Sun → 04/13 Mon  |  04/18=Sat, 04/19=Sun → 04/20 Mon ✓
// 04/25=Sat, 04/26=Sun → 04/27 Mon ✓  |  05/01=Labour Day (休市)
// Note: 04/20 and 04/27 are confirmed trading days per TWSE historical data
const FLOW_DATES = [
  '2026-03-24','2026-03-25','2026-03-26','2026-03-27',  // idx  0– 3
  '2026-03-30','2026-03-31',                              // idx  4– 5
  '2026-04-01','2026-04-02','2026-04-03',               // idx  6– 8
  '2026-04-07','2026-04-08','2026-04-09','2026-04-10',  // idx  9–12
  '2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17', // 13–17
  '2026-04-20',                                           // idx 18 ← restored
  '2026-04-21','2026-04-22','2026-04-23','2026-04-24',  // idx 19–22
  '2026-04-27',                                           // idx 23 ← restored
  '2026-04-28','2026-04-29','2026-04-30',               // idx 24–26
];

// Deterministic PRNG (mulberry32)
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build OHLC + volume + chip data for one stock.
 *
 * anchors    – [[dateIdx, price], …] target prices at those indices
 * volAnchor  – peak daily volume (in 1,000 shares)
 * buyStart   – date index from which institutional buying starts (positive chips)
 * chipScale  – base chip size in 張 (e.g., 500 = ±500 張 max)
 * priceVol   – daily price volatility (e.g., 0.022)
 * seed       – seed for PRNG
 */
function buildFlowData(
  anchors:   [number, number][],
  volAnchor: number,
  buyStart:  number,
  chipScale: number,
  priceVol:  number,
  seed:      number,
): { ohlc: (OHLCBar & { volume: number })[]; chips: ChipBar[] } {
  const rand  = mkRng(seed);
  const n     = FLOW_DATES.length;
  const closes: number[] = new Array(n);

  // Interpolate closes from anchors
  for (let a = 0; a < anchors.length - 1; a++) {
    const [i0, p0] = anchors[a];
    const [i1, p1] = anchors[a + 1];
    const steps = i1 - i0;
    for (let i = i0; i <= i1; i++) {
      const t     = steps === 0 ? 1 : (i - i0) / steps;
      const base  = p0 + (p1 - p0) * t;
      const noise = (i === i0 || i === i1) ? 0 : (rand() - 0.5) * priceVol * base * 1.8;
      closes[i]   = Math.max(base + noise, 1);
    }
  }

  const ohlc: (OHLCBar & { volume: number })[] = FLOW_DATES.map((time, i) => {
    const close    = +closes[i].toFixed(2);
    const prevC    = i > 0 ? closes[i - 1] : close;
    const open     = +(prevC * (1 + (rand() - 0.5) * priceVol * 0.35)).toFixed(2);
    const bodyH    = Math.max(open, close);
    const bodyL    = Math.min(open, close);
    const high     = +(bodyH * (1 + rand() * priceVol * 0.65)).toFixed(2);
    const low      = Math.max(+(bodyL * (1 - rand() * priceVol * 0.65)).toFixed(2), 0.1);
    // Volume: higher on rallying days, even more so in the "buying period"
    const buyBoost = i >= buyStart ? (1 + (i - buyStart) * 0.06) : 1;
    const priceChg = Math.abs(close - prevC) / prevC;
    const volume   = Math.round(
      volAnchor * (0.7 + rand() * 0.6) * (1 + priceChg * 8) * buyBoost * 1000
    );
    return { time, open, high, low, close, volume };
  });

  // Chip (主力買賣超)
  const chips: ChipBar[] = FLOW_DATES.map((time, i) => {
    let value: number;
    if (i < buyStart) {
      // Before institutional accumulation: mixed, slightly negative
      value = Math.round((rand() - 0.6) * chipScale);
    } else {
      // During accumulation: mostly positive, gradually increasing
      const boost = 1 + (i - buyStart) * 0.04;   // was 0.12 → runaway; 0.04 keeps peak ≈ 1.5× base
      value = Math.round((rand() * 0.75 + 0.25) * chipScale * boost);
      // Occasional single negative day to look realistic
      if (rand() < 0.12) value = -Math.round(rand() * chipScale * 0.3);
    }
    return { time, value, color: value >= 0 ? '#c0392b' : '#4a7c59' };
  });

  return { ohlc, chips };
}

// NOTE on units:
//   volAnchor  = average daily volume in 千張 (K lots).
//                formula stores value in 張; SmartMoneyChart legend divides by 1000 → shows "XK 張".
//   chipScale  = base institutional net-buy in 張 on a peak buying day.
//                Realistic = ≲ 10 % of typical daily volume × stock-price weighting.

// ══ Per-stock OHLC + chip seed data ══════════════════════════════════════════
// anchors: [dateIdx, price]   (27-date array — see FLOW_DATES above)
// idx ref: 0=03/24, 4=03/30, 9=04/07, 12=04/10, 13=04/13, 17=04/17,
//          18=04/20, 19=04/21, 22=04/24, 23=04/27, 24=04/28, 26=04/30

const FLOW_DATA: Record<string, { ohlc: (OHLCBar & { volume: number })[]; chips: ChipBar[] }> = (() => {
  const d: Record<string, ReturnType<typeof buildFlowData>> = {};

  // 3661 世芯-KY — 外資連買14日，AI ASIC 龍頭
  // Real avg vol ~4,000 張/日；機構每日買超 ~200-500 張
  d['3661'] = buildFlowData(
    [[0,3520],[4,3380],[9,3080],[12,3280],[14,3620],[17,3920],[19,4050],[22,4180],[24,4290],[26,4420]],
    4, 11, 400, 0.026, 3661
  );
  // 3017 奇鋐 — 外資+投信連買11日，液冷散熱
  // Real avg vol ~15,000 張/日；機構每日買超 ~500-1,200 張
  d['3017'] = buildFlowData(
    [[0,2680],[4,2540],[9,2340],[12,2500],[14,2720],[17,2920],[19,3010],[22,3070],[24,3090],[26,3120]],
    14, 11, 600, 0.022, 3017
  );
  // 2330 台積電 — 外資連買10日
  // Real avg vol ~25,000 張/日；機構每日買超 ~1,000-4,000 張
  // 04/30: 2,135 ▼2.06% (Yahoo Finance 即時)
  d['2330'] = buildFlowData(
    [[0,1980],[4,1910],[9,1820],[12,1900],[14,2020],[17,2075],[19,2100],[22,2130],[24,2178],[26,2135]],
    25, 12, 2000, 0.014, 2330
  );
  // 6669 緯穎 — 外資連買9日，AI伺服器ODM
  // Real avg vol ~6,000 張/日；機構每日買超 ~200-600 張
  d['6669'] = buildFlowData(
    [[0,1840],[4,1760],[9,1640],[12,1780],[14,1960],[17,2060],[19,2110],[22,2145],[24,2165],[26,2180]],
    6, 13, 400, 0.024, 6669
  );
  // 5274 信驊 — 外資+投信連買8-9日，BMC龍頭
  // Real avg vol ~2,500 張/日；機構每日買超 ~80-250 張
  d['5274'] = buildFlowData(
    [[0,1460],[4,1390],[9,1300],[12,1400],[14,1590],[17,1740],[19,1820],[22,1860],[24,1880],[26,1895]],
    2, 13, 200, 0.028, 5274
  );
  // 2382 廣達 — 外資連買8日
  // Real avg vol ~45,000 張/日；機構每日買超 ~2,000-6,000 張
  d['2382'] = buildFlowData(
    [[0,308],[4,294],[9,274],[12,295],[14,318],[17,334],[19,340],[22,344],[24,348],[26,346]],
    45, 14, 3000, 0.018, 2382
  );
  // 6442 光聖 — 投信連買10日，矽光子
  // Real avg vol ~3,000 張/日；機構每日買超 ~100-350 張
  d['6442'] = buildFlowData(
    [[0,1460],[4,1390],[9,1260],[11,1360],[13,1680],[15,1840],[17,1940],[20,2050],[22,2100],[24,2130],[26,2160]],
    3, 12, 300, 0.034, 6442
  );
  // 3222 健策 — 投信連買8日，液冷散熱
  // Real avg vol ~6,000 張/日；機構每日買超 ~200-600 張
  d['3222'] = buildFlowData(
    [[0,682],[4,644],[9,591],[12,645],[14,722],[17,796],[19,840],[22,866],[24,882],[26,898]],
    6, 14, 400, 0.028, 3222
  );
  // 3037 欣興 — 外資連買7日，ABF載板
  // Real avg vol ~50,000 張/日；機構每日買超 ~2,000-7,000 張
  d['3037'] = buildFlowData(
    [[0,190],[4,182],[9,170],[12,183],[14,198],[17,208],[19,212],[22,215],[24,217],[26,219]],
    50, 15, 3500, 0.020, 3037
  );
  // 8996 高力 — 投信連買7日，液冷冷排
  // Real avg vol ~10,000 張/日；機構每日買超 ~300-900 張
  d['8996'] = buildFlowData(
    [[0,104],[4,97],[9,91],[11,100],[13,112],[15,124],[17,130],[20,135],[22,138],[24,140],[26,142]],
    9, 15, 500, 0.030, 8996
  );
  // 2454 聯發科 — 外資連買5日
  // Real avg vol ~35,000 張/日；機構每日買超 ~1,000-4,000 張
  d['2454'] = buildFlowData(
    [[0,2150],[4,2040],[9,1940],[12,2060],[14,2220],[16,2380],[19,2490],[21,2540],[24,2570],[26,2610]],
    35, 17, 2000, 0.020, 2454
  );
  // 3711 日月光投控 — 外資連買5日，先進封裝
  // Real avg vol ~45,000 張/日；機構每日買超 ~2,000-6,000 張
  d['3711'] = buildFlowData(
    [[0,158],[4,151],[9,141],[12,152],[14,162],[17,168],[19,171],[22,173],[24,176],[26,175]],
    45, 17, 3000, 0.018, 3711
  );

  return d;
})();

// ── Date helpers ───────────────────────────────────────────────────────────────

// Dynamic: last date in FLOW_DATES (e.g. "04/30")
const LAST_FLOW_DATE = FLOW_DATES.at(-1)!;                             // '2026-04-30'
const SCAN_DATE      = LAST_FLOW_DATE.slice(5).replace('-', '/');      // '04/30'

const SECTORS: SectorRow[] = [
  { name: 'AI 伺服器 / 雲端',   icon: '🤖', netFlow:  +428.5, weekChg: +112.3, topStocks: ['廣達2382','緯穎6669','鴻海2317'],   hot: true  },
  { name: '半導體製造',         icon: '⚡', netFlow:  +384.2, weekChg:  +88.4, topStocks: ['台積電2330','聯電2303'],             hot: true  },
  { name: 'AI 晶片 / ASIC',    icon: '🧠', netFlow:  +316.7, weekChg:  +95.1, topStocks: ['世芯-KY3661','信驊5274'],            hot: true  },
  { name: '液冷散熱 / 散熱',    icon: '🌊', netFlow:  +278.4, weekChg:  +64.2, topStocks: ['奇鋐3017','健策3222','高力8996'],   hot: true  },
  { name: '矽光子 / 光纖',      icon: '💡', netFlow:  +198.3, weekChg:  +71.5, topStocks: ['光聖6442','仲琦2419'],              hot: true  },
  { name: 'IC 設計',            icon: '🔧', netFlow:  +143.6, weekChg:  +22.8, topStocks: ['聯發科2454','聯詠3034','群聯8299'],  hot: false },
  { name: 'PCB / 載板',        icon: '📋', netFlow:  +112.0, weekChg:  +31.6, topStocks: ['欣興3037','南電8046','華通2313'],   hot: false },
  { name: '先進封裝 / OSAT',   icon: '📦', netFlow:   +88.3, weekChg:   +8.4, topStocks: ['日月光投控3711','力成6239'],        hot: false },
  { name: '記憶體 / HBM',      icon: '💾', netFlow:   +34.7, weekChg:  +18.2, topStocks: ['南亞科2408','華邦電2344'],          hot: false },
  { name: '網通 / 交換器',      icon: '🌐', netFlow:   +21.4, weekChg:   +5.3, topStocks: ['智邦2345','合勤0'],                hot: false },
  { name: '電動車 / 動力',      icon: '🚗', netFlow:   -18.2, weekChg:  -22.4, topStocks: ['台達電2308','英業達2356'],          hot: false },
  { name: '金融 / 壽險',        icon: '🏦', netFlow:   -42.6, weekChg:  -15.8, topStocks: ['富邦金2881','國泰金2882'],          hot: false },
  { name: '傳產 / 鋼鐵',        icon: '🏭', netFlow:   -87.3, weekChg:  -34.1, topStocks: ['中鋼2002','台塑1301'],              hot: false },
];

const SMART_MONEY: SmartMoneyStock[] = [
  {
    code: '3661', name: '世芯-KY',   sector: 'AI ASIC',
    price: 4420,  changePct: +2.41,
    foreignDays: 14, trustDays: 9,  dealerDays: 3,
    netBuyK: 28450, volRatio: 2.1, pricePct: 28.4,
    signal: 96,
    tags: ['外資連買14日', '投信連買9日', 'ASIC定製', '法人重押'],
    note: '為 NVIDIA 等大廠設計 AI 推論 ASIC，訂單能見度至 2027H1，外資視為 AI ASIC 首選標的持續加碼。',
  },
  {
    code: '3017', name: '奇鋐',      sector: '液冷散熱',
    price: 3120,  changePct: +1.96,
    foreignDays: 11, trustDays: 11, dealerDays: 5,
    netBuyK: 19820, volRatio: 1.8, pricePct: 19.7,
    signal: 93,
    tags: ['外資連買11日', '投信同步11日', '液冷龍頭', '量增價漲'],
    note: 'AI 資料中心液冷散熱龍頭，Google、AWS 大單在手。投信與外資罕見同步連買 11 日，籌碼極乾淨。',
  },
  {
    code: '2330', name: '台積電',    sector: '半導體製造',
    price: 2135,  changePct: -2.06,
    foreignDays: 10, trustDays: 6,  dealerDays: 0,
    netBuyK: 31200, volRatio: 1.4, pricePct: 17.3,
    signal: 90,
    tags: ['外資連買10日', 'CoWoS 滿載', 'N2 順利量產', '指標龍頭'],
    note: '外資近 10 日累積回補超過 3.1 萬張，CoWoS 封裝需求持續炸單，N2 良率優於預期，目標價上調至 2,500。04/30 勞動節前獲利了結，短線小幅回落。',
  },
  {
    code: '6669', name: '緯穎',      sector: 'AI 伺服器',
    price: 2180,  changePct: +1.77,
    foreignDays: 9,  trustDays: 7,  dealerDays: 2,
    netBuyK: 12340, volRatio: 1.6, pricePct: 22.1,
    signal: 88,
    tags: ['外資連買9日', 'AI伺服器ODM', 'GB200機架優先供應商'],
    note: '微軟、META AI 伺服器 ODM 主力，GB200 機架供應商，外資持續 9 日加碼，視為 AI 基礎建設直接受益股。',
  },
  {
    code: '5274', name: '信驊',      sector: 'AI ASIC',
    price: 1895,  changePct: +3.01,
    foreignDays: 9,  trustDays: 8,  dealerDays: 4,
    netBuyK: 5820,  volRatio: 2.3, pricePct: 31.5,
    signal: 87,
    tags: ['外資連買9日', '投信連買8日', 'BMC龍頭', '量爆突破'],
    note: '全球 BMC 晶片龍頭，AI 伺服器每台必備，營收創歷史新高。外資+投信雙雙連買逾 8 日，小型股籌碼堆疊效果強。',
  },
  {
    code: '2382', name: '廣達',      sector: 'AI 伺服器',
    price: 346,   changePct: -0.57,
    foreignDays: 8,  trustDays: 4,  dealerDays: 0,
    netBuyK: 42100, volRatio: 1.3, pricePct: 11.8,
    signal: 82,
    tags: ['外資連買8日', 'AI伺服器ODM最大', 'GB系列大單'],
    note: 'NVIDIA GB200/GB300 最大 ODM，外資連 8 日加碼，Q1 AI 伺服器營收季增 48%，法說會展望樂觀。',
  },
  {
    code: '6442', name: '光聖',      sector: '矽光子',
    price: 2160,  changePct: +5.37,
    foreignDays: 7,  trustDays: 10, dealerDays: 6,
    netBuyK: 4210,  volRatio: 3.4, pricePct: 44.2,
    signal: 81,
    tags: ['投信連買10日', '外資連買7日', '矽光子龍頭', '爆量突破'],
    note: '矽光子 / 光電整合元件唯一台廠，與 Intel、Broadcom 合作量產中。投信率先大量佈局，已連買 10 日，籌碼集中度達 15%。',
  },
  {
    code: '3222', name: '健策',      sector: '液冷散熱',
    price: 898,   changePct: +2.42,
    foreignDays: 6,  trustDays: 8,  dealerDays: 3,
    netBuyK: 6740,  volRatio: 2.0, pricePct: 26.4,
    signal: 78,
    tags: ['投信連買8日', '外資連買6日', '冷板液冷', '跟進奇鋐'],
    note: '液冷散熱冷板製造，受惠奇鋐帶動整個液冷供應鏈。投信連買 8 日，股本小、外資尚未大量介入，空間可觀。',
  },
  {
    code: '3037', name: '欣興',      sector: 'PCB / ABF載板',
    price: 219,   changePct: +1.39,
    foreignDays: 7,  trustDays: 5,  dealerDays: 1,
    netBuyK: 38500, volRatio: 1.5, pricePct: 16.7,
    signal: 76,
    tags: ['外資連買7日', 'ABF載板', 'CoWoS受益', '量增'],
    note: 'ABF 載板龍頭，CoWoS 先進封裝帶動 ABF 需求爆發。外資連 7 日買超 3.85 萬張，主動 ETF 00981A 持續加碼。',
  },
  {
    code: '8996', name: '高力',      sector: '液冷散熱',
    price: 142,   changePct: +3.65,
    foreignDays: 5,  trustDays: 7,  dealerDays: 2,
    netBuyK: 4850,  volRatio: 2.6, pricePct: 37.8,
    signal: 74,
    tags: ['投信連買7日', '外資連買5日', '冷排龍頭', '小型高彈性'],
    note: '液冷散熱冷排零組件，受惠 AI 伺服器機架液冷趨勢。主動 ETF 00981A / 00992A 均持有，籌碼被鎖。小股本，彈性大。',
  },
  {
    code: '2454', name: '聯發科',    sector: 'IC 設計',
    price: 2610,  changePct: +1.36,
    foreignDays: 5,  trustDays: 3,  dealerDays: 0,
    netBuyK: 15200, volRatio: 1.2, pricePct: 8.4,
    signal: 65,
    tags: ['外資連買5日', 'AI手機', 'Dimensity旗艦', '法說會催化'],
    note: '外資回補 5 日，Dimensity 9400+ 拿下三星、vivo 旗艦，AI 手機滲透率加速。04/30 法說會帶動股價突破至 2,610。',
  },
  {
    code: '3711', name: '日月光投控', sector: '先進封裝',
    price: 175,   changePct: -0.57,
    foreignDays: 5,  trustDays: 4,  dealerDays: 1,
    netBuyK: 24300, volRatio: 1.3, pricePct: 12.9,
    signal: 63,
    tags: ['外資連買5日', '先進封裝', 'SiP量產', '估值低'],
    note: '全球最大 OSAT，SiP 封裝持續受惠 AI 需求，外資逢低回補。本益比相較同業偏低，防禦性佳。',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_FLOW = Math.max(...SECTORS.map(s => Math.abs(s.netFlow)));

function signalColor(score: number) {
  if (score >= 88) return '#c0392b';
  if (score >= 75) return '#e07b39';
  if (score >= 60) return '#d4a017';
  return '#6b7280';
}
function signalLabel(score: number) {
  if (score >= 88) return '強烈追蹤';
  if (score >= 75) return '積極佈局';
  if (score >= 60) return '觀察留意';
  return '參考';
}

function DayBadge({ days, label }: { days: number; label: string }) {
  if (!days) return null;
  const cls = days >= 10 ? 'hot' : days >= 6 ? 'warm' : 'cool';
  return (
    <span className={`day-badge day-badge-${cls}`}>
      {label}<br /><span className="day-num">{days}日</span>
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type FlowTab   = 'sector' | 'smart';
type InstFilter = 'all' | 'foreign' | 'trust';
type CardTab   = 'info' | 'chart' | 'report';

export default function FlowScanner() {
  const [activeTab, setActiveTab]   = useState<FlowTab>('sector');
  const [filter,    setFilter]      = useState<InstFilter>('all');
  const [sortBy,    setSortBy]      = useState<'signal' | 'foreignDays' | 'trustDays'>('signal');
  const [expanded,  setExpanded]    = useState<string | null>(null);
  const [cardTab,   setCardTab]     = useState<CardTab>('info');

  const sorted = [...SMART_MONEY]
    .filter(s => {
      if (filter === 'foreign') return s.foreignDays >= 5;
      if (filter === 'trust')   return s.trustDays   >= 5;
      return true;
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const totalInflow  = SECTORS.filter(s => s.netFlow > 0).reduce((a, s) => a + s.netFlow, 0);
  const totalOutflow = SECTORS.filter(s => s.netFlow < 0).reduce((a, s) => a + s.netFlow, 0);
  const hotCount     = SECTORS.filter(s => s.hot).length;

  const toggleExpand = (code: string) => {
    if (expanded === code) { setExpanded(null); return; }
    setExpanded(code);
    setCardTab('info');
  };

  return (
    <div className="flow-scanner-container card">

      {/* ── Header ── */}
      <div className="flow-header">
        <div className="flow-title-group">
          <span className="flow-badge">Smart Money Tracker</span>
          <h3 className="flow-title">資金流向 · 大戶連買追蹤</h3>
          <p className="flow-subtitle">法人動向 · 連買天數 · 產業熱區 · {SCAN_DATE} 盤後更新</p>
        </div>
        <div className="flow-summary-pills">
          <div className="summary-pill inflow">
            <span className="pill-label">5日淨流入</span>
            <span className="pill-val">+{totalInflow.toFixed(0)} 億</span>
          </div>
          <div className="summary-pill outflow">
            <span className="pill-label">5日淨流出</span>
            <span className="pill-val">{totalOutflow.toFixed(0)} 億</span>
          </div>
          <div className="summary-pill neutral">
            <span className="pill-label">熱門產業</span>
            <span className="pill-val">{hotCount} 個</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flow-tabs">
        <button className={`flow-tab-btn ${activeTab === 'sector' ? 'active' : ''}`} onClick={() => setActiveTab('sector')}>
          🔥 產業資金流向
        </button>
        <button className={`flow-tab-btn ${activeTab === 'smart' ? 'active' : ''}`} onClick={() => setActiveTab('smart')}>
          💎 大戶連買追蹤
        </button>
      </div>

      {/* ══ Sector Flow ══════════════════════════════════════════════════════ */}
      {activeTab === 'sector' && (
        <div className="sector-flow-panel animate-fade-in">
          <div className="flow-method-note">
            📌 三大法人（外資＋投信＋自營商）近 5 個交易日合計買賣超，億元。正值 = 淨買超（資金流入）
          </div>
          {SECTORS.map((s, i) => {
            const isIn     = s.netFlow >= 0;
            const barWidth = Math.abs(s.netFlow) / MAX_FLOW * 100;
            return (
              <div key={s.name} className={`sector-row ${i % 2 === 0 ? 'even' : ''} ${s.hot ? 'hot-sector' : ''}`}>
                <div className="sector-left">
                  <span className="sector-rank">#{i + 1}</span>
                  <span className="sector-icon">{s.icon}</span>
                  <div className="sector-name-group">
                    <span className="sector-name">
                      {s.name}
                      {s.hot && <span className="hot-badge">🔥 HOT</span>}
                    </span>
                    <span className="sector-stocks">{s.topStocks.join(' · ')}</span>
                  </div>
                </div>
                <div className="sector-bar-wrap">
                  <div className={`sector-bar ${isIn ? 'bar-in' : 'bar-out'}`} style={{ width: `${barWidth}%` }} />
                </div>
                <div className="sector-right">
                  <span className={`sector-flow-val ${isIn ? 'price-up' : 'price-down'}`}>
                    {isIn ? '+' : ''}{s.netFlow.toFixed(1)} 億
                  </span>
                  <span className={`sector-week-chg ${s.weekChg >= 0 ? 'price-up' : 'price-down'}`}>
                    {s.weekChg >= 0 ? '▲' : '▼'} {Math.abs(s.weekChg).toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
          <p className="flow-source-note">
            ※ 資料來源：TWSE T86 三大法人買賣超統計；04/30 盤後計算。週變化為相較前5個交易日之差值。
          </p>
        </div>
      )}

      {/* ══ Smart Money ══════════════════════════════════════════════════════ */}
      {activeTab === 'smart' && (
        <div className="smart-money-panel animate-fade-in">

          {/* Toolbar */}
          <div className="sm-toolbar">
            <div className="sm-filter-group">
              <span className="toolbar-label">篩選：</span>
              {(['all', 'foreign', 'trust'] as InstFilter[]).map(f => (
                <button key={f} className={`sm-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? '全部' : f === 'foreign' ? '外資連買5日↑' : '投信連買5日↑'}
                </button>
              ))}
            </div>
            <div className="sm-sort-group">
              <span className="toolbar-label">排序：</span>
              {([['signal', '綜合訊號'], ['foreignDays', '外資天數'], ['trustDays', '投信天數']] as [typeof sortBy, string][]).map(([k, l]) => (
                <button key={k} className={`sm-filter-btn ${sortBy === k ? 'active' : ''}`} onClick={() => setSortBy(k)}>{l}</button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="sm-legend">
            <span className="legend-dot" style={{ background: '#c0392b' }} />強烈追蹤 (88+)
            <span className="legend-dot" style={{ background: '#e07b39' }} />積極佈局 (75+)
            <span className="legend-dot" style={{ background: '#d4a017' }} />觀察留意 (60+)
          </div>

          {/* Cards */}
          <div className="sm-list">
            {sorted.map((s, idx) => {
              const isExp  = expanded === s.code;
              const isUp   = s.changePct >= 0;
              const color  = signalColor(s.signal);
              const fd     = FLOW_DATA[s.code];

              return (
                <div key={s.code} className={`sm-card ${isExp ? 'expanded' : ''}`}>
                  {/* Header row */}
                  <div className="sm-card-header" onClick={() => toggleExpand(s.code)}>
                    <div className="sm-card-left">
                      <span className="sm-rank">#{idx + 1}</span>
                      <div className="sm-identity">
                        <div className="sm-name-row">
                          <span className="sm-code">{s.code}</span>
                          <span className="sm-name">{s.name}</span>
                          <span className="sm-sector-tag">{s.sector}</span>
                        </div>
                        <div className="sm-tags">
                          {s.tags.slice(0, 3).map(t => <span key={t} className="sm-tag">{t}</span>)}
                        </div>
                      </div>
                    </div>

                    <div className="sm-days-group">
                      <DayBadge days={s.foreignDays} label="外資" />
                      <DayBadge days={s.trustDays}   label="投信" />
                      <DayBadge days={s.dealerDays}  label="自營" />
                    </div>

                    <div className="sm-card-right">
                      <div className="sm-price-group">
                        <span className="sm-price">{s.price.toLocaleString()}</span>
                        <span className={`sm-change ${isUp ? 'price-up' : 'price-down'}`}>
                          {isUp ? '▲' : '▼'} {Math.abs(s.changePct).toFixed(2)}%
                        </span>
                      </div>
                      <div className="sm-signal-box" style={{ borderColor: color }}>
                        <span className="sm-signal-num"  style={{ color }}>{s.signal}</span>
                        <span className="sm-signal-label" style={{ color }}>{signalLabel(s.signal)}</span>
                      </div>
                      <span className="sm-expand-arrow">{isExp ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp && (
                    <div className="sm-card-detail animate-fade-in">
                      {/* Detail sub-tabs */}
                      <div className="sm-detail-tabs">
                        <button
                          className={`sm-dtab ${cardTab === 'info' ? 'active' : ''}`}
                          onClick={() => setCardTab('info')}
                        >
                          📊 分析
                        </button>
                        <button
                          className={`sm-dtab ${cardTab === 'chart' ? 'active' : ''}`}
                          onClick={() => setCardTab('chart')}
                        >
                          📈 K線圖
                        </button>
                        <button
                          className={`sm-dtab ${cardTab === 'report' ? 'active' : ''}`}
                          onClick={() => setCardTab('report')}
                        >
                          📋 個股報告
                        </button>
                      </div>

                      {/* ── Info tab ── */}
                      {cardTab === 'info' && (
                        <>
                          <div className="detail-grid">
                            <div className="detail-stat">
                              <span className="ds-label">累積淨買（張）</span>
                              <span className="ds-val price-up">+{s.netBuyK.toLocaleString()}</span>
                            </div>
                            <div className="detail-stat">
                              <span className="ds-label">量能倍率</span>
                              <span className="ds-val">{s.volRatio.toFixed(1)}x</span>
                            </div>
                            <div className="detail-stat">
                              <span className="ds-label">距近30日低點</span>
                              <span className="ds-val price-up">+{s.pricePct.toFixed(1)}%</span>
                            </div>
                            <div className="detail-stat">
                              <span className="ds-label">訊號強度</span>
                              <div className="ds-signal-bar-wrap">
                                <div className="ds-signal-bar" style={{ width: `${s.signal}%`, background: color }} />
                                <span className="ds-signal-num">{s.signal}/100</span>
                              </div>
                            </div>
                          </div>
                          <div className="sm-note">
                            <span className="note-icon">📋</span>
                            <p>{s.note}</p>
                          </div>
                          <div className="sm-warning">
                            ⚠ 以上分析僅供參考，股市有風險，買賣決策請自行判斷。法人連買不保證股價持續上漲。
                          </div>
                        </>
                      )}

                      {/* ── Chart tab ── */}
                      {cardTab === 'chart' && fd && (
                        <SmartMoneyChart
                          code={s.code}
                          name={s.name}
                          data={fd.ohlc}
                          chips={fd.chips}
                        />
                      )}

                      {/* ── Report tab ── */}
                      {cardTab === 'report' && fd && (
                        <StockReportPanel
                          code={s.code}
                          name={s.name}
                          price={s.price}
                          changePct={s.changePct}
                          signal={s.signal}
                          sector={s.sector}
                          data={fd.ohlc}
                          chips={fd.chips}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="flow-source-note">
            ※ 連買天數統計至 {SCAN_DATE}；K 線為高擬真模擬數據（錨點來自公開市場資料）；訊號分數綜合連買天數、量能、價格動能等因素。
          </p>
        </div>
      )}
    </div>
  );
}
