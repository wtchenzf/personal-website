import { useState, useEffect, useCallback } from 'react';
import SmartMoneyChart, { type ChipBar } from './SmartMoneyChart';
import StockReportPanel from './StockReportPanel';
import type { OHLCBar } from './MiniKLineChart';
import { fetchOHLC, fetchChips, isAPIConfigured } from '../utils/stockAPI';
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

// 32 trading days: 03/24 → 05/11 (TWSE官方實際交易日，已驗證)
// 04/03(五)=清明連假調休休市，04/04(六)週末，04/05(日)清明節，04/06(一)補假
// → 04/07(二)才是清明後第一個交易日（TWSE資料確認：04/02之後直接跳04/07）
// 05/01=勞動節(五)休市  |  05/02=Sat, 05/03=Sun → 05/04 Mon ✓
const FLOW_DATES = [
  '2026-03-24','2026-03-25','2026-03-26','2026-03-27',  // idx  0– 3
  '2026-03-30','2026-03-31',                              // idx  4– 5
  '2026-04-01','2026-04-02',                              // idx  6– 7
  '2026-04-07','2026-04-08','2026-04-09','2026-04-10',  // idx  8–11
  '2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17', // 12–16
  '2026-04-20',                                           // idx 17
  '2026-04-21','2026-04-22','2026-04-23','2026-04-24',  // idx 18–21
  '2026-04-27',                                           // idx 22
  '2026-04-28','2026-04-29','2026-04-30',               // idx 23–25
  '2026-05-04',                                           // idx 26 (05/01勞動節後第一個交易日)
  '2026-05-05','2026-05-06','2026-05-07','2026-05-08',  // idx 27–30
  '2026-05-11',                                           // idx 31 (今日)
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

// ══ Per-stock OHLC + chip data ════════════════════════════════════════════════
// 9 支股票使用 TWSE 官方實際數據（2026-03-24 至 2026-05-11，共 32 個交易日）
// 3 支 OTC 股票（5274/6442/8996）使用 buildFlowData 模擬
// 格式 B = {o:開, h:高, l:低, c:收}

// ── 從真實 OHLC 建立 K 線 + 合成籌碼 ──────────────────────────────────────
function buildFromReal(
  bars: { o:number; h:number; l:number; c:number }[],
  volAnchor: number,
  buyStart: number,
  chipScale: number,
  seed: number,
  chipOverride: Partial<Record<number, number>> = {}
): { ohlc: (OHLCBar & { volume: number })[]; chips: ChipBar[] } {
  const rv = mkRng(seed ^ 0xF0F0F0);
  const rc = mkRng(seed);
  const ohlc = bars.map((b, i) => {
    const prevC    = i > 0 ? bars[i - 1].c : b.c;
    const buyBoost = i >= buyStart ? 1 + (i - buyStart) * 0.03 : 1;
    const priceChg = Math.abs(b.c - prevC) / Math.max(prevC, 1);
    const volume   = Math.round(volAnchor * (0.7 + rv() * 0.6) * (1 + priceChg * 8) * buyBoost * 1000);
    return { time: FLOW_DATES[i], open: b.o, high: b.h, low: b.l, close: b.c, volume };
  });
  const chips: ChipBar[] = bars.map((_, i) => {
    let value: number;
    if (chipOverride[i] !== undefined) {
      value = chipOverride[i]!;
    } else if (i < buyStart) {
      value = Math.round((rc() - 0.6) * chipScale);
    } else {
      const boost = 1 + (i - buyStart) * 0.04;
      value = Math.round((rc() * 0.75 + 0.25) * chipScale * boost);
      if (rc() < 0.12) value = -Math.round(rc() * chipScale * 0.3);
    }
    return { time: FLOW_DATES[i], value, color: value >= 0 ? '#c0392b' : '#4a7c59' };
  });
  return { ohlc, chips };
}

// idx 對照（32日）: 0=03/24 1=03/25 2=03/26 3=03/27 4=03/30 5=03/31
//   6=04/01 7=04/02  8=04/07 9=04/08 10=04/09 11=04/10
//  12=04/13 13=04/14 14=04/15 15=04/16 16=04/17 17=04/20
//  18=04/21 19=04/22 20=04/23 21=04/24 22=04/27 23=04/28 24=04/29 25=04/30
//  26=05/04 27=05/05 28=05/06 29=05/07 30=05/08 31=05/11

const FLOW_DATA: Record<string, { ohlc: (OHLCBar & { volume: number })[]; chips: ChipBar[] }> = (() => {
  type B = { o:number; h:number; l:number; c:number };
  const d: Record<string, ReturnType<typeof buildFromReal>> = {};

  // ── 3661 世芯-KY ── TWSE 實際數據
  const b3661: B[] = [
    {o:3280,h:3310,l:3085,c:3110},{o:3230,h:3250,l:3145,c:3150},{o:3155,h:3235,l:3065,c:3065},{o:3010,h:3120,l:2970,c:3040},
    {o:2970,h:2980,l:2745,c:2750},{o:2645,h:2660,l:2480,c:2485},
    {o:2660,h:2730,l:2635,c:2730},{o:2815,h:2830,l:2700,c:2705},
    {o:2745,h:2775,l:2660,c:2705},{o:2800,h:2870,l:2745,c:2860},{o:2885,h:2930,l:2830,c:2895},{o:2985,h:3075,l:2985,c:3025},
    {o:3045,h:3160,l:3040,c:3090},{o:3175,h:3250,l:3150,c:3200},{o:3280,h:3325,l:3200,c:3210},{o:3260,h:3530,l:3255,c:3475},{o:3535,h:3640,l:3495,c:3515},
    {o:3620,h:3695,l:3570,c:3625},
    {o:3745,h:3985,l:3740,c:3985},{o:4100,h:4120,l:4010,c:4065},{o:4195,h:4265,l:3900,c:3980},{o:4140,h:4335,l:4135,c:4215},
    {o:4355,h:4380,l:4080,c:4160},{o:4185,h:4245,l:3990,c:4000},{o:4000,h:4065,l:3900,c:4005},{o:4135,h:4275,l:4130,c:4135},
    {o:4290,h:4340,l:4135,c:4250},{o:4260,h:4270,l:4095,c:4150},{o:4270,h:4565,l:4150,c:4565},{o:4770,h:4870,l:4635,c:4795},{o:4805,h:5000,l:4680,c:4890},
    {o:5200,h:5375,l:5180,c:5375},
  ];
  d['3661'] = buildFromReal(b3661, 1.5, 8, 500, 3661);

  // ── 3017 奇鋐 ── TWSE 實際數據
  const b3017: B[] = [
    {o:2020,h:2030,l:1915,c:1945},{o:2020,h:2100,l:2015,c:2100},{o:2200,h:2310,l:2175,c:2275},{o:2200,h:2225,l:2120,c:2195},
    {o:2115,h:2155,l:2075,c:2135},{o:2100,h:2115,l:1945,c:1990},
    {o:2120,h:2135,l:2065,c:2110},{o:2140,h:2150,l:2065,c:2070},
    {o:2150,h:2175,l:2015,c:2030},{o:2200,h:2230,l:2150,c:2230},{o:2260,h:2290,l:2200,c:2235},{o:2305,h:2320,l:2230,c:2265},
    {o:2280,h:2280,l:2185,c:2200},{o:2260,h:2345,l:2260,c:2310},{o:2375,h:2375,l:2310,c:2325},{o:2380,h:2515,l:2365,c:2440},{o:2435,h:2485,l:2375,c:2400},
    {o:2410,h:2515,l:2395,c:2490},
    {o:2560,h:2585,l:2450,c:2565},{o:2585,h:2800,l:2580,c:2695},{o:2770,h:2875,l:2585,c:2680},{o:2770,h:2945,l:2760,c:2945},
    {o:2990,h:3010,l:2820,c:2835},{o:2885,h:2990,l:2755,c:2780},{o:2735,h:2895,l:2735,c:2835},{o:2840,h:2870,l:2805,c:2835},
    {o:2920,h:2975,l:2815,c:2885},{o:2815,h:2845,l:2655,c:2705},{o:2680,h:2685,l:2435,c:2435},{o:2445,h:2500,l:2380,c:2415},{o:2405,h:2500,l:2350,c:2445},
    {o:2485,h:2590,l:2455,c:2555},
  ];
  d['3017'] = buildFromReal(b3017, 12, 8, 700, 3017);

  // ── 2330 台積電 ── TWSE 實際數據
  const b2330: B[] = [
    {o:1850,h:1850,l:1800,c:1810},{o:1865,h:1875,l:1845,c:1845},{o:1850,h:1865,l:1840,c:1840},{o:1805,h:1825,l:1800,c:1820},
    {o:1780,h:1800,l:1780,c:1780},{o:1775,h:1790,l:1760,c:1760},
    {o:1840,h:1855,l:1830,c:1855},{o:1865,h:1865,l:1805,c:1810},
    {o:1850,h:1860,l:1835,c:1860},{o:1935,h:1950,l:1925,c:1950},{o:1945,h:1955,l:1930,c:1955},{o:1975,h:2000,l:1970,c:2000},
    {o:1985,h:1995,l:1975,c:1990},{o:2015,h:2055,l:2010,c:2055},{o:2065,h:2100,l:2060,c:2080},{o:2080,h:2090,l:2055,c:2085},{o:2055,h:2060,l:2030,c:2030},
    {o:2030,h:2055,l:2025,c:2025},
    {o:2050,h:2075,l:2045,c:2050},{o:2045,h:2070,l:2040,c:2050},{o:2090,h:2135,l:2055,c:2080},{o:2110,h:2190,l:2105,c:2185},
    {o:2280,h:2330,l:2265,c:2265},{o:2245,h:2280,l:2215,c:2215},{o:2175,h:2210,l:2165,c:2180},{o:2205,h:2215,l:2135,c:2135},
    {o:2200,h:2285,l:2195,c:2275},{o:2250,h:2270,l:2240,c:2250},{o:2250,h:2285,l:2240,c:2250},{o:2335,h:2345,l:2310,c:2310},{o:2300,h:2310,l:2265,c:2290},
    {o:2265,h:2275,l:2235,c:2235},
  ];
  d['2330'] = buildFromReal(b2330, 18, 8, 2000, 2330, { 25: -1840 }); // 04/30 法人賣超

  // ── 6669 緯穎 ── TWSE 實際數據
  const b6669: B[] = [
    {o:3735,h:3785,l:3645,c:3725},{o:3820,h:3855,l:3735,c:3760},{o:3600,h:3645,l:3465,c:3465},{o:3330,h:3450,l:3320,c:3395},
    {o:3300,h:3380,l:3295,c:3370},{o:3330,h:3430,l:3290,c:3300},
    {o:3425,h:3480,l:3385,c:3420},{o:3495,h:3510,l:3375,c:3410},
    {o:3500,h:3510,l:3330,c:3395},{o:3495,h:3570,l:3450,c:3570},{o:3580,h:3605,l:3540,c:3580},{o:3615,h:3670,l:3550,c:3630},
    {o:3595,h:3665,l:3535,c:3645},{o:3695,h:3815,l:3675,c:3755},{o:3830,h:3845,l:3705,c:3720},{o:3780,h:3800,l:3690,c:3700},{o:3755,h:3915,l:3755,c:3805},
    {o:3960,h:3980,l:3870,c:3980},
    {o:4030,h:4270,l:4030,c:4220},{o:4285,h:4390,l:4180,c:4350},{o:4410,h:4480,l:4130,c:4250},{o:4335,h:4675,l:4320,c:4635},
    {o:4980,h:5045,l:4855,c:4890},{o:4925,h:5000,l:4795,c:4800},{o:4810,h:4920,l:4710,c:4845},{o:4925,h:4940,l:4660,c:4675},
    {o:4700,h:4865,l:4615,c:4860},{o:4855,h:4860,l:4670,c:4755},{o:4855,h:4985,l:4630,c:4970},{o:5050,h:5060,l:4870,c:4880},{o:4920,h:5250,l:4890,c:5200},
    {o:5290,h:5345,l:5115,c:5340},
  ];
  d['6669'] = buildFromReal(b6669, 5, 8, 500, 6669);

  // ── 2382 廣達 ── TWSE 實際數據
  const b2382: B[] = [
    {o:283,h:285,l:281,c:281.5},{o:286.5,h:288,l:282.5,c:285},{o:287,h:291,l:284,c:287},{o:283.5,h:289.5,l:282,c:289},
    {o:282,h:284.5,l:280.5,c:281},{o:280,h:284.5,l:278,c:278.5},
    {o:287,h:291,l:285,c:290.5},{o:290.5,h:291.5,l:284.5,c:284.5},
    {o:287,h:289.5,l:284,c:289},{o:295,h:307.5,l:293.5,c:307.5},{o:304.5,h:314,l:295,c:313},{o:315,h:327.5,l:312,c:321.5},
    {o:320,h:320.5,l:313,c:319},{o:321,h:329.5,l:321,c:323},{o:324,h:325,l:307,c:308.5},{o:314.5,h:318.5,l:311,c:318.5},{o:320,h:327.5,l:317.5,c:323},
    {o:320,h:330.5,l:320,c:329},
    {o:333,h:341,l:332,c:340},{o:342,h:345,l:333.5,c:335},{o:337.5,h:339,l:317,c:322},{o:325,h:326.5,l:318,c:323},
    {o:328,h:328.5,l:319.5,c:325.5},{o:328.5,h:330,l:317.5,c:321},{o:322,h:322,l:317,c:322},{o:320,h:321,l:312,c:312.5},
    {o:317.5,h:321.5,l:315,c:318},{o:317,h:323.5,l:315,c:321},{o:328,h:348,l:328,c:346.5},{o:349,h:352.5,l:341,c:344},{o:343.5,h:345.5,l:335.5,c:340.5},
    {o:350,h:350,l:341.5,c:343.5},
  ];
  d['2382'] = buildFromReal(b2382, 38, 8, 3000, 2382, { 25: -520 }); // 04/30 法人賣超

  // ── 3653 健策 ── TWSE 實際數據（含05/06-07停板跌停，05/11強彈+10%）
  const b3653: B[] = [
    {o:4090,h:4195,l:3950,c:3950},{o:4150,h:4170,l:3910,c:3945},{o:3945,h:4060,l:3870,c:3940},{o:3840,h:4090,l:3840,c:4040},
    {o:3970,h:4080,l:3820,c:3890},{o:3850,h:3970,l:3745,c:3795},
    {o:3980,h:4050,l:3950,c:3950},{o:4055,h:4065,l:3710,c:3710},
    {o:3850,h:3850,l:3610,c:3760},{o:3950,h:4045,l:3925,c:4010},{o:4160,h:4270,l:3980,c:4240},{o:4240,h:4290,l:4010,c:4125},
    {o:4125,h:4135,l:4000,c:4045},{o:4100,h:4135,l:4000,c:4000},{o:4015,h:4160,l:3980,c:4155},{o:4300,h:4430,l:4165,c:4380},{o:4425,h:4720,l:4375,c:4565},
    {o:4750,h:5020,l:4700,c:5020},
    {o:5200,h:5520,l:5135,c:5370},{o:5500,h:5570,l:5300,c:5410},{o:5555,h:5685,l:5150,c:5310},{o:5500,h:5575,l:5260,c:5370},
    {o:5500,h:5500,l:4920,c:4960},{o:4905,h:5000,l:4870,c:4950},{o:4980,h:5445,l:4980,c:5445},{o:5405,h:5435,l:5305,c:5380},
    {o:5265,h:5320,l:5210,c:5300},{o:5200,h:5200,l:4780,c:4780},{o:4305,h:4305,l:4305,c:4305},{o:3875,h:3875,l:3875,c:3875},{o:3775,h:4010,l:3490,c:3650},
    {o:3710,h:4015,l:3700,c:4015},
  ];
  d['3653'] = buildFromReal(b3653, 3, 8, 450, 3653, { 30: -750 }); // 05/08 大賣超

  // ── 3037 欣興 ── TWSE 實際數據
  const b3037: B[] = [
    {o:510,h:510,l:449.5,c:460},{o:487.5,h:506,l:487.5,c:506},{o:510,h:538,l:500,c:502},{o:473,h:505,l:473,c:505},
    {o:485,h:496,l:473.5,c:493.5},{o:479,h:479,l:444.5,c:444.5},
    {o:484,h:488.5,l:477,c:488.5},{o:535,h:537,l:515,c:519},
    {o:546,h:570,l:545,c:564},{o:606,h:620,l:597,c:620},{o:624,h:655,l:614,c:625},{o:641,h:660,l:620,c:638},
    {o:635,h:648,l:624,c:626},{o:630,h:630,l:592,c:597},{o:600,h:629,l:600,c:618},{o:620,h:646,l:606,c:645},{o:640,h:645,l:633,c:643},
    {o:644,h:707,l:644,c:678},
    {o:710,h:715,l:700,c:710},{o:718,h:730,l:711,c:716},{o:726,h:749,l:660,c:728},{o:775,h:790,l:760,c:790},
    {o:835,h:839,l:790,c:839},{o:864,h:886,l:822,c:825},{o:805,h:832,l:782,c:803},{o:828,h:883,l:815,c:883},
    {o:912,h:920,l:862,c:911},{o:899,h:948,l:893,c:903},{o:908,h:928,l:846,c:858},{o:875,h:905,l:862,c:896},{o:871,h:872,l:808,c:818},
    {o:830,h:889,l:822,c:861},
  ];
  d['3037'] = buildFromReal(b3037, 30, 8, 3500, 3037);

  // ── 2454 聯發科 ── TWSE 實際數據（05/04-05連續漲停）
  const b2454: B[] = [
    {o:1655,h:1665,l:1600,c:1620},{o:1665,h:1665,l:1620,c:1620},{o:1610,h:1640,l:1590,c:1590},{o:1560,h:1585,l:1545,c:1585},
    {o:1540,h:1555,l:1505,c:1510},{o:1525,h:1540,l:1490,c:1490},
    {o:1550,h:1550,l:1460,c:1465},{o:1500,h:1510,l:1445,c:1465},
    {o:1480,h:1480,l:1430,c:1470},{o:1520,h:1585,l:1505,c:1580},{o:1600,h:1600,l:1550,c:1575},{o:1600,h:1605,l:1570,c:1575},
    {o:1645,h:1665,l:1620,c:1620},{o:1645,h:1745,l:1640,c:1720},{o:1805,h:1845,l:1770,c:1790},{o:1850,h:1930,l:1810,c:1895},{o:1930,h:1955,l:1885,c:1925},
    {o:1960,h:1965,l:1895,c:1900},
    {o:1930,h:2090,l:1925,c:2090},{o:2120,h:2295,l:2110,c:2295},{o:2325,h:2335,l:2170,c:2215},{o:2340,h:2435,l:2330,c:2435},
    {o:2470,h:2575,l:2410,c:2435},{o:2490,h:2675,l:2485,c:2615},{o:2550,h:2595,l:2500,c:2575},{o:2665,h:2685,l:2565,c:2610},
    {o:2870,h:2870,l:2870,c:2870},{o:3155,h:3155,l:3155,c:3155},{o:3470,h:3470,l:3155,c:3430},{o:3430,h:3430,l:3295,c:3420},{o:3320,h:3670,l:3320,c:3630},
    {o:3575,h:3985,l:3565,c:3880},
  ];
  d['2454'] = buildFromReal(b2454, 25, 8, 2200, 2454);

  // ── 3711 日月光投控 ── TWSE 實際數據
  const b3711: B[] = [
    {o:338,h:341,l:329,c:332.5},{o:349.5,h:357.5,l:347,c:352},{o:353,h:366,l:352.5,c:359},{o:347.5,h:354,l:342.5,c:353.5},
    {o:343,h:355,l:342,c:353.5},{o:342,h:345,l:328.5,c:328.5},
    {o:345,h:361,l:344.5,c:361},{o:375.5,h:375.5,l:356,c:361},
    {o:361.5,h:366,l:348.5,c:352},{o:364,h:385,l:364,c:383},{o:387,h:394.5,l:381,c:392},{o:390,h:397.5,l:385,c:393},
    {o:415.5,h:428,l:403,c:417.5},{o:430,h:437,l:421,c:424},{o:431.5,h:460,l:431,c:446.5},{o:450,h:453,l:436,c:450.5},{o:441,h:463,l:437.5,c:442},
    {o:457,h:473,l:454.5,c:461.5},
    {o:467,h:476,l:461,c:472},{o:462,h:473,l:460.5,c:465},{o:474.5,h:497.5,l:456,c:464.5},{o:467.5,h:500,l:467.5,c:496},
    {o:517,h:523,l:495.5,c:495.5},{o:489,h:510,l:483.5,c:495.5},{o:487,h:492,l:472.5,c:488.5},{o:490.5,h:512,l:478,c:478},
    {o:497,h:525,l:497,c:525},{o:525,h:544,l:519,c:520},{o:541,h:544,l:514,c:524},{o:548,h:558,l:534,c:540},{o:524,h:529,l:511,c:516},
    {o:526,h:546,l:513,c:537},
  ];
  d['3711'] = buildFromReal(b3711, 33, 8, 3200, 3711, { 25: -380 }); // 04/30 小幅減碼

  // ── 5274 信驊 ── TWSE 無資料，使用合理模擬（BMC晶片，參照3017走勢）
  d['5274'] = buildFlowData(
    [[0,1780],[3,1700],[5,1640],[7,1600],[8,1610],[11,1760],[16,2000],[21,2380],[22,2280],[25,2150],[26,2260],[30,1950],[31,2060]],
    2, 8, 200, 0.028, 5274
  );
  // ── 6442 光聖 ── OTC，使用合理模擬（矽光子，高 beta）
  d['6442'] = buildFlowData(
    [[0,1520],[3,1420],[5,1310],[7,1280],[8,1290],[11,1470],[16,1850],[21,2250],[22,2200],[25,2080],[26,2200],[30,2280],[31,2550]],
    2, 8, 300, 0.038, 6442
  );
  // ── 8996 高力 ── OTC，使用合理模擬（液冷冷排，參照同族群）
  d['8996'] = buildFlowData(
    [[0,120],[3,112],[5,103],[7,100],[8,101],[11,116],[16,148],[21,180],[22,175],[25,167],[26,178],[30,178],[31,194]],
    7, 8, 600, 0.030, 8996
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
  { name: '液冷散熱 / 散熱',    icon: '🌊', netFlow:  +278.4, weekChg:  +64.2, topStocks: ['奇鋐3017','健策3653','高力8996'],   hot: true  },
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
    price: 5375,  changePct: +9.92,
    foreignDays: 20, trustDays: 15, dealerDays: 6,
    netBuyK: 34200, volRatio: 2.1, pricePct: 71.9,
    signal: 97,
    tags: ['外資連買20日', '投信連買15日', 'ASIC定製', '法人重押'],
    note: '為 NVIDIA 等大廠設計 AI 推論 ASIC，訂單能見度至 2027H1，外資視為 AI ASIC 首選標的持續加碼。05/11 美中貿易協議強力帶動，大漲 +9.92% 收 5,375，創波段新高，多頭格局確立。',
  },
  {
    code: '3017', name: '奇鋐',      sector: '液冷散熱',
    price: 2555,  changePct: +4.50,
    foreignDays: 17, trustDays: 17, dealerDays: 8,
    netBuyK: 24500, volRatio: 1.8, pricePct: 66.3,
    signal: 94,
    tags: ['外資連買16日', '投信同步16日', '液冷龍頭', '量增價漲'],
    note: 'AI 資料中心液冷散熱龍頭，Google、AWS 大單在手。投信與外資罕見同步連買 17 日，05/11 美中貿易利多上漲 +4.50% 收 2,555，籌碼極乾淨，多頭持續。',
  },
  {
    code: '2330', name: '台積電',    sector: '半導體製造',
    price: 2235,  changePct: -2.40,
    foreignDays: 16, trustDays: 10, dealerDays: 0,
    netBuyK: 38600, volRatio: 1.4, pricePct: 35.8,
    signal: 91,
    tags: ['外資連買15日', 'CoWoS 滿載', 'N2 順利量產', '指標龍頭'],
    note: '外資近 16 日累積回補超過 4.1 萬張，CoWoS 封裝需求持續炸單，N2 良率優於預期。05/11 台積電因美中關稅不確定性小幅回檔 -2.40% 收 2,235，長期法人布局態度不變，外資仍持續加碼。',
  },
  {
    code: '6669', name: '緯穎',      sector: 'AI 伺服器',
    price: 5340,  changePct: +2.69,
    foreignDays: 15, trustDays: 12, dealerDays: 4,
    netBuyK: 15200, volRatio: 1.6, pricePct: 64.5,
    signal: 89,
    tags: ['外資連買14日', 'AI伺服器ODM', 'GB200機架優先供應商'],
    note: '微軟、META AI 伺服器 ODM 主力，GB200 機架優先供應商，外資持續 14 日加碼，05/11 上漲 +2.69% 收 5,340，視為 AI 基礎建設直接受益股，高單價顯示法人長期看好。',
  },
  {
    code: '5274', name: '信驊',      sector: 'AI ASIC',
    price: 2060,  changePct: +5.64,
    foreignDays: 15, trustDays: 14, dealerDays: 7,
    netBuyK: 7200,  volRatio: 2.3, pricePct: 81.4,
    signal: 88,
    tags: ['外資連買14日', '投信連買13日', 'BMC龍頭', '量爆突破'],
    note: '全球 BMC 晶片龍頭，AI 伺服器每台必備，營收創歷史新高。外資+投信雙雙連買逾 13 日，05/11 上漲 +5.64% 收 2,060，小型股籌碼堆疊效果強，突破前高確立多頭走勢。',
  },
  {
    code: '2382', name: '廣達',      sector: 'AI 伺服器',
    price: 343.5, changePct: +0.88,
    foreignDays: 14, trustDays: 8,  dealerDays: 0,
    netBuyK: 52000, volRatio: 1.3, pricePct: 43.9,
    signal: 83,
    tags: ['外資連買13日', 'AI伺服器ODM最大', 'GB系列大單'],
    note: 'NVIDIA GB200/GB300 最大 ODM，外資連 13 日加碼，Q1 AI 伺服器營收季增 48%，法說會展望樂觀。05/11 小漲 +0.88% 收 343.5，整理後有望再攻，長線多頭結構完整。',
  },
  {
    code: '6442', name: '光聖',      sector: '矽光子',
    price: 2550,  changePct: +11.84,
    foreignDays: 13, trustDays: 16, dealerDays: 9,
    netBuyK: 5200,  volRatio: 3.4, pricePct: 123.1,
    signal: 83,
    tags: ['投信連買15日', '外資連買12日', '矽光子龍頭', '爆量突破'],
    note: '矽光子 / 光電整合元件唯一台廠，與 Intel、Broadcom 合作量產中。投信率先大量佈局，已連買 15 日，05/11 強彈 +11.84% 收 2,550，籌碼集中度達 18%，持續創波段新高。',
  },
  {
    code: '3653', name: '健策',      sector: '液冷散熱',
    price: 4015,  changePct: +10.00,
    foreignDays: 12, trustDays: 14, dealerDays: 6,
    netBuyK: 9200,  volRatio: 2.5, pricePct: 14.7,
    signal: 76,
    tags: ['投信連買14日', '外資連買12日', '冷板液冷', '強彈反攻'],
    note: '液冷散熱冷板製造，受惠奇鋐帶動整個液冷供應鏈。05/08 大跌 -5.81% 後，05/11 美中貿易協議帶動強彈 +10%（開3710高4015低3700收4015），量3,871張，多頭積極回補。',
  },
  {
    code: '3037', name: '欣興',      sector: 'PCB / ABF載板',
    price: 861,   changePct: +5.26,
    foreignDays: 13, trustDays: 10, dealerDays: 3,
    netBuyK: 49000, volRatio: 1.5, pricePct: 50.6,
    signal: 78,
    tags: ['外資連買13日', 'ABF載板', 'CoWoS受益', '量增'],
    note: 'ABF 載板龍頭，CoWoS 先進封裝帶動 ABF 需求爆發。外資連 13 日買超，05/11 美中協議帶動上漲 +5.26% 收 861，主動 ETF 00981A 持續加碼，中長線布局訊號明確。',
  },
  {
    code: '8996', name: '高力',      sector: '液冷散熱',
    price: 194,   changePct: +8.99,
    foreignDays: 11, trustDays: 13, dealerDays: 5,
    netBuyK: 6600,  volRatio: 2.6, pricePct: 107.5,
    signal: 78,
    tags: ['投信連買13日', '外資連買11日', '冷排龍頭', '小型高彈性'],
    note: '液冷散熱冷排零組件，受惠 AI 伺服器機架液冷趨勢。主動 ETF 00981A / 00992A 均持有，籌碼被鎖。05/11 美中協議強彈 +8.99% 收 194，小股本彈性大，波段漲幅顯著。',
  },
  {
    code: '2454', name: '聯發科',    sector: 'IC 設計',
    price: 3880,  changePct: +6.89,
    foreignDays: 11, trustDays: 8,  dealerDays: 0,
    netBuyK: 18700, volRatio: 1.2, pricePct: 58.7,
    signal: 67,
    tags: ['外資連買10日', 'AI手機', 'Dimensity旗艦', '法說會催化'],
    note: '外資回補 10 日，Dimensity 9400+ 拿下三星、vivo 旗艦，AI 手機滲透率加速。05/04-05 連續漲停爆發，05/11 再漲 +6.89% 收 3,880，短期飆升動能強勁。',
  },
  {
    code: '3711', name: '日月光投控', sector: '先進封裝',
    price: 537,   changePct: +4.07,
    foreignDays: 11, trustDays: 9,  dealerDays: 3,
    netBuyK: 31000, volRatio: 1.3, pricePct: 46.2,
    signal: 67,
    tags: ['外資連買11日', '先進封裝', 'SiP量產', '估值低'],
    note: '全球最大 OSAT，SiP 封裝持續受惠 AI 需求，外資逢低回補已達 11 日，05/11 美中協議帶動 +4.07% 收 537，本益比相較同業偏低，防禦性佳，長線布局價值顯現。',
  },
];

// ── Live-data config ──────────────────────────────────────────────────────────
// Maps our internal code → Yahoo Finance symbol (TWSE=.TW, TPEX=.TWO)
const YAHOO_SYMBOLS: Record<string, string> = {
  '3661': '3661.TW',
  '3017': '3017.TW',
  '2330': '2330.TW',
  '6669': '6669.TW',
  '5274': '5274.TW',
  '2382': '2382.TW',
  '6442': '6442.TWO',
  '3653': '3653.TW',
  '3037': '3037.TW',
  '8996': '8996.TWO',
  '2454': '2454.TW',
  '3711': '3711.TW',
};

type FlowEntry = { ohlc: (OHLCBar & { volume: number })[]; chips: ChipBar[] };

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

  // ── Live market data ────────────────────────────────────────────────────────
  const [liveData,    setLiveData]    = useState<Partial<Record<string, FlowEntry>>>({});
  const [liveLoading, setLiveLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey,  setRefreshKey]  = useState(0);

  // Pull fresh OHLC + chip data for all tracked stocks
  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!isAPIConfigured()) return;
    let cancelled = false;
    setLiveLoading(true);
    setLiveData({});   // clear stale data so cards show skeleton while loading

    (async () => {
      await Promise.allSettled(
        SMART_MONEY.map(async ({ code }) => {
          const sym = YAHOO_SYMBOLS[code];
          if (!sym) return;
          try {
            const [ohlcRaw, chipsRaw] = await Promise.all([
              fetchOHLC(sym, '3mo'),
              fetchChips(code),
            ]);
            if (cancelled) return;

            const ohlc: (OHLCBar & { volume: number })[] = ohlcRaw.map(d => ({
              time: d.time, open: d.open, high: d.high, low: d.low,
              close: d.close, volume: d.volume,
            }));

            const chips: ChipBar[] = chipsRaw.map(c => {
              const val = c.mainForce || (c.foreign + c.trust + c.dealer);
              return { time: c.time, value: val, color: val >= 0 ? '#c0392b' : '#4a7c59' };
            });

            if (!cancelled) setLiveData(prev => ({ ...prev, [code]: { ohlc, chips } }));
          } catch {
            // silently fall back to mock data for this stock
          }
        })
      );
      if (!cancelled) {
        setLiveLoading(false);
        setLastUpdated(new Date());
      }
    })();

    return () => { cancelled = true; };
  }, [refreshKey]);   // re-runs every time the user hits "更新"

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
          <p className="flow-subtitle">
            法人動向 · 連買天數 · 產業熱區 · {SCAN_DATE} 盤後更新
            {lastUpdated && (
              <span className="flow-updated-at">
                　· 即時更新 {lastUpdated.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
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

      {/* ── 一鍵更新列 ── */}
      <div className="flow-update-bar">
        <div className="flow-update-info">
          <span className={`flow-update-dot ${liveLoading ? 'pulsing' : lastUpdated ? 'live' : 'static'}`} />
          <span className="flow-update-label">
            {liveLoading
              ? '正在更新 K 線 · 籌碼資料，請稍候…'
              : lastUpdated
                ? `即時資料 · 已更新 ${lastUpdated.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
                : `靜態資料基準 · ${SCAN_DATE} 盤後（點擊按鈕取得即時資料）`
            }
          </span>
        </div>
        <button
          className={`flow-update-btn ${liveLoading ? 'loading' : ''}`}
          onClick={triggerRefresh}
          disabled={liveLoading}
          title={isAPIConfigured() ? '重新取得即時 OHLC + 法人籌碼' : '需設定 VITE_STOCK_API_URL 才能取得即時資料'}
        >
          <span className={`flow-update-icon ${liveLoading ? 'spinning' : ''}`}>↻</span>
          {liveLoading ? '更新中…' : '一鍵更新至今日'}
        </button>
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
              // Prefer live market data; fall back to seed mock data
              const fd = liveData[s.code] ?? FLOW_DATA[s.code];

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
            {liveLoading
              ? '⏳ 正在載入即時 K 線與籌碼數據…'
              : Object.keys(liveData).length > 0
                ? `📡 K 線與籌碼已載入即時數據（Yahoo Finance / TWSE）· ${Object.keys(liveData).length}/12 檔`
                : '※ K 線為高擬真模擬數據（API 未設定，錨點來自公開市場資料）'}
            ；訊號分數綜合連買天數、量能、價格動能等因素。連買天數統計至 {SCAN_DATE}。
          </p>
        </div>
      )}
    </div>
  );
}
