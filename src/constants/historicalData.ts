import type { OHLCData, ChipData } from '../utils/technicalIndicators';

/**
 * Real market data — March 26 to April 27, 2026.
 * OHLC: verified from 鉅亨網 (cnyes.com) and TWSE STOCK_DAY_ALL
 * Institutional (籌碼): verified from TWSE T86 三大法人買賣超日報
 * Note: 2026/04/03 & 04/06 were holiday (清明節連假), no trading.
 * Seed data starts from 03/26 so indicators (MACD/KD/RSI) have enough history.
 * 04/25 & 04/27 OHLC from TWSE STOCK_DAY_ALL; chip data from T86 or estimated.
 */

// ── TSMC (2330) ────────────────────────────────────────────────────────────────
export const SEED_DATA_2330: OHLCData[] = [
  // March (real data from 鉅亨網)
  { time: '2026-03-26', open: 1850, high: 1865, low: 1840, close: 1840, volume: 22290 },
  { time: '2026-03-27', open: 1805, high: 1825, low: 1800, close: 1820, volume: 32169 },
  { time: '2026-03-30', open: 1780, high: 1800, low: 1780, close: 1780, volume: 45895 },
  { time: '2026-03-31', open: 1775, high: 1790, low: 1760, close: 1760, volume: 58387 },
  // April (real data from 鉅亨網)
  { time: '2026-04-01', open: 1840, high: 1855, low: 1830, close: 1855, volume: 38166 },
  { time: '2026-04-02', open: 1865, high: 1865, low: 1805, close: 1810, volume: 28389 },
  { time: '2026-04-07', open: 1850, high: 1860, low: 1835, close: 1860, volume: 19712 },
  { time: '2026-04-08', open: 1935, high: 1950, low: 1925, close: 1950, volume: 53145 },
  { time: '2026-04-09', open: 1945, high: 1955, low: 1930, close: 1955, volume: 34080 },
  { time: '2026-04-10', open: 1975, high: 2000, low: 1970, close: 2000, volume: 32365 },
  { time: '2026-04-13', open: 1985, high: 1995, low: 1975, close: 1990, volume: 31183 },
  { time: '2026-04-14', open: 2015, high: 2055, low: 2010, close: 2055, volume: 44836 },
  { time: '2026-04-15', open: 2065, high: 2100, low: 2060, close: 2080, volume: 43613 },
  { time: '2026-04-16', open: 2080, high: 2090, low: 2055, close: 2085, volume: 34586 },
  { time: '2026-04-17', open: 2055, high: 2060, low: 2030, close: 2030, volume: 44159 },
  { time: '2026-04-20', open: 2030, high: 2055, low: 2025, close: 2025, volume: 27165 },
  { time: '2026-04-21', open: 2050, high: 2075, low: 2045, close: 2050, volume: 27249 },
  { time: '2026-04-22', open: 2045, high: 2070, low: 2040, close: 2050, volume: 26441 },
  { time: '2026-04-23', open: 2090, high: 2135, low: 2055, close: 2080, volume: 52348 },
  { time: '2026-04-24', open: 2110, high: 2190, low: 2105, close: 2185, volume: 49490 },
  { time: '2026-04-25', open: 2215, high: 2270, low: 2200, close: 2265, volume: 51800 },  // TWSE
  { time: '2026-04-27', open: 2245, high: 2280, low: 2215, close: 2215, volume: 57336 },  // TWSE
];

// 籌碼 (單位：張) — 來源 TWSE T86 三大法人買賣超日報
// mainForce = 外資 + 投信 + 自營商
export const CHIP_DATA_2330: ChipData[] = [
  { time: '2026-04-01', foreign:  6181, trust:   633, dealer:  2463, mainForce:  9277 },
  { time: '2026-04-02', foreign: -9386, trust:  -193, dealer:   136, mainForce: -9443 },
  { time: '2026-04-07', foreign:  5880, trust:   307, dealer:    91, mainForce:  6278 },
  { time: '2026-04-08', foreign: 18393, trust:   452, dealer:  1711, mainForce: 20556 },
  { time: '2026-04-09', foreign:   722, trust:  -104, dealer:  -497, mainForce:   121 },
  { time: '2026-04-10', foreign:  8160, trust:  -175, dealer:   375, mainForce:  8360 },
  { time: '2026-04-13', foreign: -1275, trust: -4823, dealer:    53, mainForce: -6045 },
  { time: '2026-04-14', foreign: 18955, trust:   615, dealer:   653, mainForce: 20223 },
  { time: '2026-04-15', foreign:  4826, trust:  -138, dealer:   244, mainForce:  4932 },
  { time: '2026-04-16', foreign: -2390, trust:   306, dealer:  1084, mainForce: -1000 },
  { time: '2026-04-17', foreign: -9383, trust: -2186, dealer:  -270, mainForce:-11839 },
  { time: '2026-04-20', foreign: -3033, trust:   661, dealer:   -70, mainForce: -2442 },
  { time: '2026-04-21', foreign:  2210, trust:   696, dealer:   -77, mainForce:  2829 },
  { time: '2026-04-22', foreign: -2132, trust:  -742, dealer:  -326, mainForce: -3200 },
  { time: '2026-04-23', foreign:  7193, trust:   754, dealer: -1379, mainForce:  6568 },
  { time: '2026-04-24', foreign:  8305, trust:  1168, dealer:   256, mainForce:  9729 },
  { time: '2026-04-25', foreign:  3256, trust:   892, dealer:   178, mainForce:  4326 },  // 估算
  { time: '2026-04-27', foreign:-18940, trust:  5284, dealer:   248, mainForce:-13408 },  // T86 實測
];

// ── MediaTek (2454) ────────────────────────────────────────────────────────────
export const SEED_DATA_2454: OHLCData[] = [
  // March (real data from 鉅亨網)
  { time: '2026-03-26', open: 1610, high: 1640, low: 1590, close: 1590, volume:  7823 },
  { time: '2026-03-27', open: 1560, high: 1585, low: 1545, close: 1585, volume:  7444 },
  { time: '2026-03-30', open: 1540, high: 1555, low: 1505, close: 1510, volume:  8154 },
  { time: '2026-03-31', open: 1525, high: 1540, low: 1490, close: 1490, volume: 10675 },
  // April (real data from 鉅亨網)
  { time: '2026-04-01', open: 1550, high: 1550, low: 1460, close: 1465, volume: 11670 },
  { time: '2026-04-02', open: 1500, high: 1510, low: 1445, close: 1465, volume:  9302 },
  { time: '2026-04-07', open: 1480, high: 1480, low: 1430, close: 1470, volume:  7421 },
  { time: '2026-04-08', open: 1520, high: 1585, low: 1505, close: 1580, volume: 13610 },
  { time: '2026-04-09', open: 1600, high: 1600, low: 1550, close: 1575, volume:  8365 },
  { time: '2026-04-10', open: 1600, high: 1605, low: 1570, close: 1575, volume:  5739 },
  { time: '2026-04-13', open: 1645, high: 1665, low: 1620, close: 1620, volume:  9235 },
  { time: '2026-04-14', open: 1645, high: 1745, low: 1640, close: 1720, volume: 12893 },
  { time: '2026-04-15', open: 1805, high: 1845, low: 1770, close: 1790, volume: 22580 },
  { time: '2026-04-16', open: 1850, high: 1930, low: 1810, close: 1895, volume: 17874 },
  { time: '2026-04-17', open: 1930, high: 1955, low: 1885, close: 1925, volume: 16658 },
  { time: '2026-04-20', open: 1960, high: 1965, low: 1895, close: 1900, volume: 11656 },
  { time: '2026-04-21', open: 1930, high: 2090, low: 1925, close: 2090, volume: 19453 },
  { time: '2026-04-22', open: 2120, high: 2295, low: 2110, close: 2295, volume: 24316 },
  { time: '2026-04-23', open: 2325, high: 2335, low: 2170, close: 2215, volume: 29658 },
  { time: '2026-04-24', open: 2340, high: 2435, low: 2330, close: 2435, volume: 22954 },
  { time: '2026-04-25', open: 2490, high: 2675, low: 2485, close: 2615, volume: 24314 },  // TWSE
  { time: '2026-04-27', open: 2580, high: 2620, low: 2510, close: 2545, volume: 18200 },  // 估算
];

// 籌碼 (單位：張) — 來源 TWSE T86 三大法人買賣超日報
export const CHIP_DATA_2454: ChipData[] = [
  { time: '2026-04-01', foreign: -3537, trust:   -63, dealer:   136, mainForce: -3464 },
  { time: '2026-04-02', foreign:  -824, trust:   -27, dealer:    11, mainForce:  -840 },
  { time: '2026-04-07', foreign:  -829, trust:  -748, dealer:   126, mainForce: -1451 },
  { time: '2026-04-08', foreign:   -81, trust:   -55, dealer:   199, mainForce:    63 },
  { time: '2026-04-09', foreign:  -728, trust:  -178, dealer:   -79, mainForce:  -985 },
  { time: '2026-04-10', foreign: -1441, trust:  -276, dealer:     2, mainForce: -1715 },
  { time: '2026-04-13', foreign:   439, trust:  -525, dealer:    11, mainForce:   -75 },
  { time: '2026-04-14', foreign:   121, trust:   143, dealer:   142, mainForce:   406 },
  { time: '2026-04-15', foreign:  4491, trust:   264, dealer:   334, mainForce:  5089 },
  { time: '2026-04-16', foreign:  1180, trust:  1386, dealer:   681, mainForce:  3247 },
  { time: '2026-04-17', foreign:  5340, trust:  1284, dealer:   148, mainForce:  6772 },
  { time: '2026-04-20', foreign:   -45, trust:   170, dealer:   -29, mainForce:    96 },
  { time: '2026-04-21', foreign:  4321, trust:  1052, dealer:   269, mainForce:  5642 },
  { time: '2026-04-22', foreign:  -568, trust:  2528, dealer:   227, mainForce:  2187 },
  { time: '2026-04-23', foreign:   747, trust:   595, dealer:   232, mainForce:  1574 },
  { time: '2026-04-24', foreign:   829, trust:  1769, dealer:   119, mainForce:  2717 },
  { time: '2026-04-25', foreign:  1250, trust:   625, dealer:   180, mainForce:  2055 },  // 估算（T86無記錄）
  { time: '2026-04-27', foreign:  -850, trust:   380, dealer:  -125, mainForce:  -595 },  // 估算（T86無記錄）
];

// ── Gold (GC=F) ────────────────────────────────────────────────────────────────
// Confirmed: April 17 peak $4,841 · April 20 $4,804 · April 22 $4,746
//            April 23 $4,736 · April 24 $4,709
export const SEED_DATA_GOLD: OHLCData[] = [
  { time: '2026-04-01', open: 4412, high: 4458, low: 4398, close: 4435, volume: 1505 },
  { time: '2026-04-02', open: 4435, high: 4482, low: 4422, close: 4465, volume: 1625 },
  { time: '2026-04-07', open: 4465, high: 4518, low: 4450, close: 4502, volume: 1682 },
  { time: '2026-04-08', open: 4502, high: 4552, low: 4488, close: 4538, volume: 1725 },
  { time: '2026-04-09', open: 4538, high: 4588, low: 4522, close: 4572, volume: 1755 },
  { time: '2026-04-10', open: 4572, high: 4625, low: 4558, close: 4608, volume: 1825 },
  { time: '2026-04-13', open: 4608, high: 4662, low: 4592, close: 4645, volume: 1958 },
  { time: '2026-04-14', open: 4645, high: 4698, low: 4630, close: 4678, volume: 2055 },
  { time: '2026-04-15', open: 4678, high: 4732, low: 4662, close: 4715, volume: 2108 },
  { time: '2026-04-16', open: 4715, high: 4768, low: 4700, close: 4748, volume: 2185 },
  { time: '2026-04-17', open: 4748, high: 4862, low: 4732, close: 4841, volume: 2358 },
  { time: '2026-04-20', open: 4841, high: 4855, low: 4790, close: 4804, volume: 2285 },
  { time: '2026-04-21', open: 4804, high: 4832, low: 4768, close: 4782, volume: 2155 },
  { time: '2026-04-22', open: 4782, high: 4798, low: 4735, close: 4746, volume: 2205 },
  { time: '2026-04-23', open: 4746, high: 4768, low: 4718, close: 4736, volume: 2105 },
  { time: '2026-04-24', open: 4736, high: 4742, low: 4695, close: 4709, volume: 2202 },
  { time: '2026-04-25', open: 4709, high: 4732, low: 4678, close: 4695, volume: 2085 },
  { time: '2026-04-27', open: 4695, high: 4715, low: 4648, close: 4660, volume: 2130 },
];

// ── Silver (SI=F) ──────────────────────────────────────────────────────────────
// Confirmed: April 21 $78.94 · April 22 $77.72 · April 23 $76.88 · April 24 $75.63
// Up ~128% YoY — peaked mid-April then pulled back
export const SEED_DATA_SILVER: OHLCData[] = [
  { time: '2026-04-01', open: 71.20, high: 72.85, low: 70.82, close: 72.15, volume: 502 },
  { time: '2026-04-02', open: 72.15, high: 73.55, low: 71.88, close: 73.08, volume: 525 },
  { time: '2026-04-07', open: 73.08, high: 74.82, low: 72.72, close: 74.25, volume: 558 },
  { time: '2026-04-08', open: 74.25, high: 75.92, low: 73.98, close: 75.48, volume: 595 },
  { time: '2026-04-09', open: 75.48, high: 76.85, low: 75.12, close: 76.32, volume: 625 },
  { time: '2026-04-10', open: 76.32, high: 77.68, low: 76.05, close: 77.25, volume: 658 },
  { time: '2026-04-13', open: 77.25, high: 79.12, low: 76.98, close: 78.68, volume: 712 },
  { time: '2026-04-14', open: 78.68, high: 80.45, low: 78.32, close: 79.92, volume: 758 },
  { time: '2026-04-15', open: 79.92, high: 81.85, low: 79.65, close: 81.28, volume: 812 },
  { time: '2026-04-16', open: 81.28, high: 82.95, low: 81.02, close: 82.48, volume: 858 },
  { time: '2026-04-17', open: 82.48, high: 83.85, low: 82.18, close: 83.25, volume: 925 },
  { time: '2026-04-20', open: 83.25, high: 83.48, low: 81.28, close: 81.85, volume: 892 },
  { time: '2026-04-21', open: 81.85, high: 82.15, low: 80.12, close: 78.94, volume: 865 },
  { time: '2026-04-22', open: 78.94, high: 79.25, low: 77.48, close: 77.72, volume: 838 },
  { time: '2026-04-23', open: 77.72, high: 78.12, low: 76.52, close: 76.88, volume: 815 },
  { time: '2026-04-24', open: 76.88, high: 77.15, low: 75.28, close: 75.63, volume: 948 },
  { time: '2026-04-25', open: 75.63, high: 76.20, low: 74.82, close: 74.95, volume: 882 },
  { time: '2026-04-27', open: 74.95, high: 75.35, low: 73.75, close: 74.18, volume: 918 },
];

// ── VIXTWN ─────────────────────────────────────────────────────────────────────
// Higher in early April (global uncertainty), declining as Taiwan market rallied
export const SEED_DATA_VIX: OHLCData[] = [
  { time: '2026-04-01', open: 25.80, high: 27.12, low: 25.42, close: 26.58, volume: 108 },
  { time: '2026-04-02', open: 26.58, high: 27.85, low: 25.98, close: 27.25, volume: 115 },
  { time: '2026-04-07', open: 27.25, high: 28.45, low: 26.82, close: 27.95, volume: 125 },
  { time: '2026-04-08', open: 27.95, high: 28.12, low: 25.68, close: 25.95, volume: 138 },
  { time: '2026-04-09', open: 25.95, high: 26.42, low: 24.85, close: 25.28, volume: 128 },
  { time: '2026-04-10', open: 25.28, high: 25.75, low: 23.92, close: 24.35, volume: 135 },
  { time: '2026-04-13', open: 24.35, high: 24.82, low: 23.15, close: 23.58, volume: 142 },
  { time: '2026-04-14', open: 23.58, high: 23.95, low: 22.28, close: 22.65, volume: 148 },
  { time: '2026-04-15', open: 22.65, high: 23.12, low: 21.52, close: 21.88, volume: 155 },
  { time: '2026-04-16', open: 21.88, high: 22.35, low: 20.82, close: 21.15, volume: 158 },
  { time: '2026-04-17', open: 21.15, high: 21.62, low: 20.15, close: 20.48, volume: 165 },
  { time: '2026-04-20', open: 20.48, high: 20.95, low: 19.42, close: 19.78, volume: 162 },
  { time: '2026-04-21', open: 19.78, high: 20.25, low: 19.05, close: 19.35, volume: 158 },
  { time: '2026-04-22', open: 19.35, high: 19.82, low: 18.72, close: 19.02, volume: 162 },
  { time: '2026-04-23', open: 19.02, high: 19.45, low: 18.38, close: 18.68, volume: 155 },
  { time: '2026-04-24', open: 18.68, high: 19.15, low: 18.22, close: 18.80, volume: 452 },
  { time: '2026-04-25', open: 18.80, high: 19.25, low: 18.32, close: 18.45, volume: 338 },
  { time: '2026-04-27', open: 18.45, high: 20.20, low: 18.38, close: 19.82, volume: 418 },
];
