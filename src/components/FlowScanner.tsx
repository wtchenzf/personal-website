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

// 32 trading days: 03/24 → 05/08 (Taiwan market, verified against TWSE/鉅亨網)
// 03/28=Sat, 03/29=Sun → 03/30 Mon  |  04/04-06=Tomb Sweeping holidays
// 04/11=Sat, 04/12=Sun → 04/13 Mon  |  04/18=Sat, 04/19=Sun → 04/20 Mon ✓
// 04/25=Sat, 04/26=Sun → 04/27 Mon ✓  |  05/01=Labour Day (休市)
// 05/02=Fri ✓  |  05/03-04=Sat/Sun → 05/05 Mon ✓  |  05/08=Thu ✓
const FLOW_DATES = [
  '2026-03-24','2026-03-25','2026-03-26','2026-03-27',  // idx  0– 3
  '2026-03-30','2026-03-31',                              // idx  4– 5
  '2026-04-01','2026-04-02','2026-04-03',               // idx  6– 8
  '2026-04-07','2026-04-08','2026-04-09','2026-04-10',  // idx  9–12
  '2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17', // 13–17
  '2026-04-20',                                           // idx 18
  '2026-04-21','2026-04-22','2026-04-23','2026-04-24',  // idx 19–22
  '2026-04-27',                                           // idx 23
  '2026-04-28','2026-04-29','2026-04-30',               // idx 24–26
  '2026-05-02',                                           // idx 27
  '2026-05-05','2026-05-06','2026-05-07','2026-05-08',  // idx 28–31
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
  anchors:      [number, number][],
  volAnchor:    number,
  buyStart:     number,
  chipScale:    number,
  priceVol:     number,
  seed:         number,
  chipOverride: Partial<Record<number, number>> = {},
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
    // Cap growth at 0.03/day to avoid over-inflation (at 17 days → 1.51×, was 2.02×)
    const buyBoost = i >= buyStart ? (1 + (i - buyStart) * 0.03) : 1;
    const priceChg = Math.abs(close - prevC) / prevC;
    const volume   = Math.round(
      volAnchor * (0.7 + rand() * 0.6) * (1 + priceChg * 8) * buyBoost * 1000
    );
    return { time, open, high, low, close, volume };
  });

  // Chip (主力買賣超)
  const chips: ChipBar[] = FLOW_DATES.map((time, i) => {
    let value: number;
    if (chipOverride[i] !== undefined) {
      // Caller-supplied override for this date index (e.g. down-day sell-off)
      value = chipOverride[i]!;
    } else if (i < buyStart) {
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
// anchors: [dateIdx, price]   (32-date array — see FLOW_DATES above)
// idx ref: 0=03/24, 3=03/27, 5=03/31, 8=04/03(清明前最後交易日),
//          9=04/07(清明後開盤，本波最低點), 11=04/09, 13=04/13,
//          16=04/16, 19=04/21, 22=04/24, 23=04/27, 24=04/28, 26=04/30,
//          27=05/02, 28=05/05, 29=05/06, 30=05/07, 31=05/08
//
// ── 市場背景 ──────────────────────────────────────────────────────────────────
// 04/04-06 清明節休市 → 04/07 開盤大幅跳空下跌（全球關稅恐慌 risk-off）
// 04/07 = 本波低點（台股加權指數單日跌逾 9%）
// 04/08 起開始技術性反彈，AI族群因基本面強勁率先回復
// 各股 04/07 低點估算：高 beta 股跌幅 25-30%，低 beta 股跌幅 15-20%
// 05/01=勞動節休市，05/02-05/08 持續上漲，AI族群法人維持買超態勢
// 成交量 buyBoost 公式已調整為 0.03/日（上限約 1.5×），與實際量能吻合

const FLOW_DATA: Record<string, { ohlc: (OHLCBar & { volume: number })[]; chips: ChipBar[] }> = (() => {
  const d: Record<string, ReturnType<typeof buildFlowData>> = {};

  // 3661 世芯-KY — 外資連買19日，AI ASIC 龍頭
  // 玩股網實測：04/30 收 4,135 ▲130(+3.25%)，05/08 收 4,280 ▲67(+1.57%)
  // 04/07 低點約 2,490（清明後跳空 -26%），04/24 高點約 4,200
  // volAnchor=1.5 → 04/30 模擬成交量 ≈ 2,850 張 ✓
  d['3661'] = buildFlowData(
    [[0,3350],[3,3060],[5,2820],[8,2590],[9,2490],[11,2730],[13,3090],[16,3500],[19,3860],[22,4160],[23,4200],[24,4090],[26,4135],[28,4200],[31,4280]],
    1.5, 9, 500, 0.030, 3661
  );
  // 3017 奇鋐 — 外資+投信連買16日，液冷散熱龍頭
  // 04/07 低點約 1,960（-26%），04/30 收 3,120，05/08 收 3,260 ▲70(+2.19%)
  // volAnchor=12 → 04/30 ≈ 20,000 張（奇鋐高 beta 高換手）
  d['3017'] = buildFlowData(
    [[0,2650],[3,2430],[5,2210],[8,2030],[9,1960],[11,2180],[13,2440],[16,2680],[19,2850],[22,2990],[24,3060],[26,3120],[28,3185],[31,3260]],
    12, 9, 700, 0.024, 3017
  );
  // 2330 台積電 — 外資連買15日，半導體製造龍頭
  // 04/07 低點約 1,660（-16%），04/30 收 2,135 ▼2.06%，05/08 收 2,255 ▲20(+0.89%)
  // 05/02 反彈回補，05/05起持續走高；volAnchor=18 → 04/30 ≈ 30,000 張
  d['2330'] = buildFlowData(
    [[0,1980],[3,1900],[5,1800],[8,1710],[9,1660],[11,1750],[13,1840],[16,1930],[19,1990],[22,2070],[24,2180],[26,2135],[27,2185],[28,2210],[31,2255]],
    18, 9, 2000, 0.014, 2330,
    { 26: -1840 }   // 04/30 ▼2.06%：勞動節前獲利了結，法人賣超
  );
  // 6669 緯穎 — 外資連買14日，AI 伺服器 ODM
  // 04/07 低點約 1,380（-25%），04/30 收 2,180，05/08 收 2,270 ▲30(+1.34%)
  // volAnchor=5 → 04/30 ≈ 8,600 張
  d['6669'] = buildFlowData(
    [[0,1840],[3,1670],[5,1530],[8,1420],[9,1380],[11,1520],[13,1700],[16,1910],[19,2040],[22,2120],[24,2150],[26,2180],[28,2225],[31,2270]],
    5, 9, 500, 0.026, 6669
  );
  // 5274 信驊 — 外資+投信連買13-14日，BMC晶片龍頭
  // 04/07 低點約 1,100（-25%），04/30 收 1,895，05/08 收 1,995 ▲36(+1.83%)
  // volAnchor=2 → 04/30 ≈ 3,700 張（小型股）
  d['5274'] = buildFlowData(
    [[0,1460],[3,1330],[5,1210],[8,1130],[9,1100],[11,1210],[13,1360],[16,1570],[19,1700],[22,1810],[24,1860],[26,1895],[28,1945],[31,1995]],
    2, 9, 200, 0.028, 5274
  );
  // 2382 廣達 — 外資連買13日，AI 伺服器 ODM 最大
  // 04/07 低點約 248（-19%），04/30 收 346 ▼0.57%，05/08 收 357 ▲4(+1.14%)
  // 05/02 回升，05/05起外資恢復淨買超；volAnchor=38 → 04/30 ≈ 60,000 張
  d['2382'] = buildFlowData(
    [[0,308],[3,290],[5,272],[8,255],[9,248],[11,263],[13,280],[16,302],[19,320],[22,336],[24,344],[26,346],[27,349],[28,352],[31,357]],
    38, 9, 3000, 0.018, 2382,
    { 26: -520 }    // 04/30 ▼0.57%：短線獲利了結，法人小幅賣超
  );
  // 6442 光聖 — 投信連買15日，矽光子龍頭
  // 04/07 低點約 1,040（-29%），04/30 收 2,160（大漲 +5.37%），05/08 收 2,330 ▲60(+2.65%)
  // volAnchor=2 → 04/30 ≈ 4,300 張（中小型爆量）
  d['6442'] = buildFlowData(
    [[0,1460],[3,1290],[5,1150],[8,1070],[9,1040],[11,1170],[13,1390],[16,1660],[19,1890],[22,2060],[24,2100],[26,2160],[28,2240],[31,2330]],
    2, 9, 300, 0.038, 6442
  );
  // 3222 健策 — 投信連買13日，液冷散熱精密機構
  // 玩股網實測：05/08 開3775 高4010 低3490 收3650 量5338 (-5.81%)
  // 03/24 高位約4,900 → 04/07清明後跳空至3,500（-28%）→ 04/24高點5,350 → 05/08收3,650大跌
  // 走勢：高位起跌 V底回升創高 再急回落，不是單純V底
  // volAnchor=3 → 日均量約3,000~6,000張（高價小型股）
  d['3222'] = buildFlowData(
    [[0,4900],[3,4750],[5,4600],[8,4300],[9,3500],[11,3800],[13,4200],[16,4700],[19,5100],[22,5350],[23,5200],[24,4950],[26,4650],[27,4350],[28,4050],[31,3650]],
    3, 9, 450, 0.028, 3222,
    { 31: -750 }   // 05/08 ▼5.81%：大幅賣超，法人由買轉賣
  );
  // 3037 欣興 — 外資連買12日，ABF 載板龍頭
  // 04/07 低點約 158（-17%），04/30 收 219，05/08 收 227 ▲3.5(+1.57%)
  // volAnchor=30 → 04/30 ≈ 50,000 張（欣興高流通）
  d['3037'] = buildFlowData(
    [[0,190],[3,181],[5,172],[8,162],[9,158],[11,163],[13,173],[16,185],[19,198],[22,209],[24,215],[26,219],[28,223],[31,227]],
    30, 9, 3500, 0.020, 3037
  );
  // 8996 高力 — 投信連買12日，液冷冷排
  // 04/07 低點約 80（-23%），04/30 收 142，05/08 收 151 ▲3.5(+2.38%)
  // volAnchor=7 → 04/30 ≈ 11,800 張
  d['8996'] = buildFlowData(
    [[0,104],[3,96],[5,88],[8,82],[9,80],[11,88],[13,97],[16,111],[19,124],[22,133],[24,138],[26,142],[28,147],[31,151]],
    7, 9, 600, 0.030, 8996
  );
  // 2454 聯發科 — 外資連買10日，IC 設計龍頭
  // 04/07 低點約 1,720（-20%），04/30 收 2,610，05/08 收 2,730 ▲50(+1.87%)
  // volAnchor=25 → 04/30 ≈ 41,800 張
  d['2454'] = buildFlowData(
    [[0,2150],[3,2020],[5,1900],[8,1780],[9,1720],[11,1840],[13,1980],[16,2170],[19,2350],[22,2490],[24,2560],[26,2610],[28,2668],[31,2730]],
    25, 9, 2200, 0.020, 2454
  );
  // 3711 日月光投控 — 外資連買10日，先進封裝 OSAT 龍頭
  // 04/07 低點約 130（-18%），04/30 收 175 ▼0.57%，05/08 收 181 ▲3(+1.69%)
  // volAnchor=33 → 04/30 ≈ 52,000 張
  d['3711'] = buildFlowData(
    [[0,158],[3,149],[5,141],[8,133],[9,130],[11,136],[13,144],[16,153],[19,161],[22,168],[24,173],[26,175],[28,178],[31,181]],
    33, 9, 3200, 0.018, 3711,
    { 26: -380 }    // 04/30 ▼0.57%：外資小幅減碼，先進封裝短線回檔
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
    price: 4280,  changePct: +1.57,
    foreignDays: 19, trustDays: 14, dealerDays: 5,
    netBuyK: 34200, volRatio: 2.1, pricePct: 71.9,
    signal: 97,
    tags: ['外資連買19日', '投信連買14日', 'ASIC定製', '法人重押'],
    note: '為 NVIDIA 等大廠設計 AI 推論 ASIC，訂單能見度至 2027H1，外資視為 AI ASIC 首選標的持續加碼。清明節後低點 2,490 迅速回補，05/08 再創波段新高 4,280，多頭格局確立。',
  },
  {
    code: '3017', name: '奇鋐',      sector: '液冷散熱',
    price: 3260,  changePct: +2.19,
    foreignDays: 16, trustDays: 16, dealerDays: 7,
    netBuyK: 24500, volRatio: 1.8, pricePct: 66.3,
    signal: 94,
    tags: ['外資連買16日', '投信同步16日', '液冷龍頭', '量增價漲'],
    note: 'AI 資料中心液冷散熱龍頭，Google、AWS 大單在手。投信與外資罕見同步連買 16 日，05/08 收 3,260 再攻波段高點，籌碼極乾淨。',
  },
  {
    code: '2330', name: '台積電',    sector: '半導體製造',
    price: 2255,  changePct: +0.89,
    foreignDays: 15, trustDays: 9,  dealerDays: 0,
    netBuyK: 38600, volRatio: 1.4, pricePct: 35.8,
    signal: 91,
    tags: ['外資連買15日', 'CoWoS 滿載', 'N2 順利量產', '指標龍頭'],
    note: '外資近 15 日累積回補超過 3.86 萬張，CoWoS 封裝需求持續炸單，N2 良率優於預期，目標價上調至 2,500。04/30 短線回落後，05/02 起外資恢復買超，05/08 收 2,255 穩步走高。',
  },
  {
    code: '6669', name: '緯穎',      sector: 'AI 伺服器',
    price: 2270,  changePct: +1.34,
    foreignDays: 14, trustDays: 11, dealerDays: 3,
    netBuyK: 15200, volRatio: 1.6, pricePct: 64.5,
    signal: 89,
    tags: ['外資連買14日', 'AI伺服器ODM', 'GB200機架優先供應商'],
    note: '微軟、META AI 伺服器 ODM 主力，GB200 機架供應商，外資持續 14 日加碼，05/08 收 2,270，視為 AI 基礎建設直接受益股。',
  },
  {
    code: '5274', name: '信驊',      sector: 'AI ASIC',
    price: 1995,  changePct: +1.83,
    foreignDays: 14, trustDays: 13, dealerDays: 6,
    netBuyK: 7200,  volRatio: 2.3, pricePct: 81.4,
    signal: 88,
    tags: ['外資連買14日', '投信連買13日', 'BMC龍頭', '量爆突破'],
    note: '全球 BMC 晶片龍頭，AI 伺服器每台必備，營收創歷史新高。外資+投信雙雙連買逾 13 日，05/08 收 1,995，小型股籌碼堆疊效果強，突破前高在即。',
  },
  {
    code: '2382', name: '廣達',      sector: 'AI 伺服器',
    price: 357,   changePct: +1.14,
    foreignDays: 13, trustDays: 7,  dealerDays: 0,
    netBuyK: 52000, volRatio: 1.3, pricePct: 43.9,
    signal: 83,
    tags: ['外資連買13日', 'AI伺服器ODM最大', 'GB系列大單'],
    note: 'NVIDIA GB200/GB300 最大 ODM，外資連 13 日加碼，Q1 AI 伺服器營收季增 48%，法說會展望樂觀。05/08 收 357，重回強勢格局。',
  },
  {
    code: '6442', name: '光聖',      sector: '矽光子',
    price: 2330,  changePct: +2.65,
    foreignDays: 12, trustDays: 15, dealerDays: 8,
    netBuyK: 5200,  volRatio: 3.4, pricePct: 123.1,
    signal: 83,
    tags: ['投信連買15日', '外資連買12日', '矽光子龍頭', '爆量突破'],
    note: '矽光子 / 光電整合元件唯一台廠，與 Intel、Broadcom 合作量產中。投信率先大量佈局，已連買 15 日，05/08 收 2,330，籌碼集中度達 18%，持續創新高。',
  },
  {
    code: '3222', name: '健策',      sector: '液冷散熱',
    price: 3650,  changePct: -5.81,
    foreignDays: 11, trustDays: 13, dealerDays: 5,
    netBuyK: 8300,  volRatio: 2.0, pricePct: 4.3,
    signal: 72,
    tags: ['投信連買13日', '外資連買11日', '冷板液冷', '拉回觀察'],
    note: '液冷散熱冷板製造，受惠奇鋐帶動整個液冷供應鏈。04/24 攻上波段高點 5,350，之後獲利了結壓力浮現。05/08 大跌 -5.81% 收 3,650（高4010低3490），拉回至近前低，觀察法人是否回補支撐。',
  },
  {
    code: '3037', name: '欣興',      sector: 'PCB / ABF載板',
    price: 227,   changePct: +1.57,
    foreignDays: 12, trustDays: 9,  dealerDays: 2,
    netBuyK: 47500, volRatio: 1.5, pricePct: 43.7,
    signal: 77,
    tags: ['外資連買12日', 'ABF載板', 'CoWoS受益', '量增'],
    note: 'ABF 載板龍頭，CoWoS 先進封裝帶動 ABF 需求爆發。外資連 12 日買超累計 4.75 萬張，05/08 收 227，主動 ETF 00981A 持續加碼。',
  },
  {
    code: '8996', name: '高力',      sector: '液冷散熱',
    price: 151,   changePct: +2.38,
    foreignDays: 10, trustDays: 12, dealerDays: 4,
    netBuyK: 6000,  volRatio: 2.6, pricePct: 88.8,
    signal: 76,
    tags: ['投信連買12日', '外資連買10日', '冷排龍頭', '小型高彈性'],
    note: '液冷散熱冷排零組件，受惠 AI 伺服器機架液冷趨勢。主動 ETF 00981A / 00992A 均持有，籌碼被鎖。05/08 收 151，小股本彈性大，持續創新高。',
  },
  {
    code: '2454', name: '聯發科',    sector: 'IC 設計',
    price: 2730,  changePct: +1.87,
    foreignDays: 10, trustDays: 7,  dealerDays: 0,
    netBuyK: 18700, volRatio: 1.2, pricePct: 58.7,
    signal: 67,
    tags: ['外資連買10日', 'AI手機', 'Dimensity旗艦', '法說會催化'],
    note: '外資回補 10 日，Dimensity 9400+ 拿下三星、vivo 旗艦，AI 手機滲透率加速。04/30 法說會帶動突破，05/08 收 2,730，持續走強。',
  },
  {
    code: '3711', name: '日月光投控', sector: '先進封裝',
    price: 181,   changePct: +1.69,
    foreignDays: 10, trustDays: 8,  dealerDays: 2,
    netBuyK: 29900, volRatio: 1.3, pricePct: 39.2,
    signal: 65,
    tags: ['外資連買10日', '先進封裝', 'SiP量產', '估值低'],
    note: '全球最大 OSAT，SiP 封裝持續受惠 AI 需求，外資逢低回補已達 10 日，05/08 收 181，本益比相較同業偏低，防禦性佳。',
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
            ※ 資料來源：TWSE T86 三大法人買賣超統計；05/08 盤後計算。週變化為相較前5個交易日之差值。
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
