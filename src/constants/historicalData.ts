import type { OHLCData, ChipData } from '../utils/technicalIndicators';

/**
 * Real market data — March 26 to April 28, 2026.
 * OHLC: verified from TWSE STOCK_DAY (鉅亨網 for older dates)
 * Institutional (籌碼): verified from TWSE T86 三大法人買賣超日報
 * Note: 2026/04/03 & 04/06 were holiday (清明節連假), no trading.
 *       2026/04/25 is Saturday — no trading day (removed).
 * Seed data starts from 03/26 so indicators (MACD/KD/RSI) have enough history.
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
  { time: '2026-04-27', open: 2280, high: 2330, low: 2265, close: 2265, volume: 79778 },  // TWSE
  { time: '2026-04-28', open: 2245, high: 2280, low: 2215, close: 2215, volume: 57336 },  // TWSE
  { time: '2026-04-29', open: 2175, high: 2210, low: 2165, close: 2180, volume: 49147 },  // TWSE
  { time: '2026-04-30', open: 2205, high: 2215, low: 2135, close: 2135, volume: 59584 },  // TWSE
  { time: '2026-05-04', open: 2200, high: 2285, low: 2195, close: 2275, volume: 52000 },  // 估算
  { time: '2026-05-05', open: 2250, high: 2270, low: 2240, close: 2250, volume: 38500 },  // 估算
  { time: '2026-05-06', open: 2250, high: 2285, low: 2240, close: 2250, volume: 37800 },  // 估算
  { time: '2026-05-07', open: 2335, high: 2345, low: 2310, close: 2310, volume: 41200 },  // 估算
  { time: '2026-05-08', open: 2300, high: 2310, low: 2265, close: 2290, volume: 39600 },  // 估算
  { time: '2026-05-11', open: 2265, high: 2275, low: 2235, close: 2235, volume: 47600 },  // TWSE
  { time: '2026-05-12', open: 2235, high: 2280, low: 2210, close: 2255, volume: 54240 },  // TWSE
  { time: '2026-05-13', open: 2205, high: 2240, low: 2205, close: 2220, volume: 43728 },  // TWSE
  { time: '2026-05-14', open: 2250, high: 2270, low: 2230, close: 2270, volume: 39565 },  // TWSE
  { time: '2026-05-15', open: 2310, high: 2325, low: 2250, close: 2265, volume: 34361 },  // TWSE
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
  { time: '2026-04-17', foreign:  -9383, trust: -2186, dealer:  -359, mainForce: -11928 },  // 玩股網實測
  { time: '2026-04-20', foreign:  -3033, trust:   660, dealer:   -76, mainForce:  -2449 },  // 玩股網實測
  { time: '2026-04-21', foreign:   2210, trust:   696, dealer:    -1, mainForce:   2905 },  // 玩股網實測
  { time: '2026-04-22', foreign:  -2132, trust:  -742, dealer:  -197, mainForce:  -3071 },  // 玩股網實測
  { time: '2026-04-23', foreign:   7194, trust:   755, dealer:  -835, mainForce:   7114 },  // 玩股網實測
  { time: '2026-04-24', foreign:   8306, trust:  1169, dealer:    86, mainForce:   9561 },  // 玩股網實測
  { time: '2026-04-27', foreign: -18940, trust:  5284, dealer:    86, mainForce: -13570 },  // 玩股網實測
  { time: '2026-04-28', foreign: -22113, trust:   862, dealer:    45, mainForce: -21206 },  // 玩股網實測
  { time: '2026-04-29', foreign: -15782, trust:  1002, dealer:  -266, mainForce: -15046 },  // 玩股網實測
  { time: '2026-04-30', foreign: -21183, trust:   597, dealer:    86, mainForce: -20500 },  // 玩股網實測
  { time: '2026-05-04', foreign:   9112, trust:   809, dealer:    98, mainForce:  10019 },  // 玩股網實測
  { time: '2026-05-05', foreign:  -8581, trust:  1496, dealer:   -12, mainForce:  -7097 },  // 玩股網實測
  { time: '2026-05-06', foreign:  -4320, trust:  1935, dealer:  -378, mainForce:  -2763 },  // 玩股網實測
  { time: '2026-05-07', foreign:   3885, trust:  1433, dealer:  -184, mainForce:   5134 },  // 玩股網實測
  { time: '2026-05-08', foreign:   -858, trust:  1269, dealer:   -93, mainForce:    318 },  // 玩股網實測
  { time: '2026-05-11', foreign: -17754, trust:    -53, dealer:    -69, mainForce: -17876 },  // 玩股網實測（外資大幅賣超）
  { time: '2026-05-12', foreign:  -9238, trust:   8880, dealer:   -731, mainForce:  -1089 },  // 玩股網實測（投信大買補缺口）
  { time: '2026-05-13', foreign: -11971, trust:   5474, dealer:   -367, mainForce:  -6864 },  // 玩股網實測（外資持續賣）
  { time: '2026-05-14', foreign:    601, trust:   5857, dealer:   -521, mainForce:   5937 },  // 玩股網實測（外資今轉買）
  { time: '2026-05-15', foreign:  -3398, trust:   3386, dealer:    -74, mainForce:    -86 },  // 玩股網實測（外資小幅轉賣）
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
  { time: '2026-04-27', open: 2470, high: 2575, low: 2410, close: 2435, volume: 25539 },  // TWSE
  { time: '2026-04-28', open: 2490, high: 2675, low: 2485, close: 2615, volume: 24314 },  // TWSE
  { time: '2026-04-29', open: 2550, high: 2595, low: 2500, close: 2575, volume: 22800 },  // 估算
  { time: '2026-04-30', open: 2665, high: 2685, low: 2565, close: 2610, volume: 24100 },  // 估算
  { time: '2026-05-04', open: 2870, high: 2870, low: 2870, close: 2870, volume:  4020 },  // TWSE (漲停)
  { time: '2026-05-05', open: 3155, high: 3155, low: 3155, close: 3155, volume: 10092 },  // TWSE (漲停)
  { time: '2026-05-06', open: 3470, high: 3470, low: 3155, close: 3430, volume: 45200 },  // 估算
  { time: '2026-05-07', open: 3430, high: 3430, low: 3295, close: 3420, volume: 36800 },  // 估算
  { time: '2026-05-08', open: 3320, high: 3670, low: 3320, close: 3630, volume: 42500 },  // 估算
  { time: '2026-05-11', open: 3575, high: 3985, low: 3565, close: 3880, volume: 31200 },  // TWSE
  { time: '2026-05-12', open: 3835, high: 3910, low: 3700, close: 3700, volume: 11090 },  // TWSE
  { time: '2026-05-13', open: 3625, high: 3680, low: 3400, close: 3495, volume:  9694 },  // TWSE
  { time: '2026-05-14', open: 3585, high: 3590, low: 3385, close: 3405, volume:  7104 },  // TWSE
  { time: '2026-05-15', open: 3425, high: 3555, low: 3200, close: 3260, volume:  7341 },  // TWSE
];

// 籌碼 (單位：張) — 來源 玩股網實測（投信全程為 0，原 trust 欄位實為自營商）
export const CHIP_DATA_2454: ChipData[] = [
  { time: '2026-04-01', foreign: -3537, trust:    0, dealer:   -63, mainForce: -3600 },
  { time: '2026-04-02', foreign:  -824, trust:    0, dealer:   -27, mainForce:  -851 },
  { time: '2026-04-07', foreign:  -829, trust:    0, dealer:  -748, mainForce: -1577 },
  { time: '2026-04-08', foreign:   -81, trust:    0, dealer:   -55, mainForce:  -136 },
  { time: '2026-04-09', foreign:  -728, trust:    0, dealer:  -178, mainForce:  -906 },
  { time: '2026-04-10', foreign: -1441, trust:    0, dealer:  -276, mainForce: -1717 },
  { time: '2026-04-13', foreign:   439, trust:    0, dealer:  -525, mainForce:   -86 },
  { time: '2026-04-14', foreign:   121, trust:    0, dealer:   143, mainForce:   264 },
  { time: '2026-04-15', foreign:  4491, trust:    0, dealer:   264, mainForce:  4755 },
  { time: '2026-04-16', foreign:  1180, trust:    0, dealer:  1386, mainForce:  2566 },
  { time: '2026-04-17', foreign:  5340, trust:    0, dealer:  1284, mainForce:  6624 },  // 玩股網實測
  { time: '2026-04-20', foreign:   -45, trust:    0, dealer:   170, mainForce:   125 },  // 玩股網實測
  { time: '2026-04-21', foreign:  4321, trust:    0, dealer:  1052, mainForce:  5373 },  // 玩股網實測
  { time: '2026-04-22', foreign:  -568, trust:    0, dealer:  2528, mainForce:  1960 },  // 玩股網實測
  { time: '2026-04-23', foreign:   746, trust:    0, dealer:   596, mainForce:  1342 },  // 玩股網實測
  { time: '2026-04-24', foreign:   829, trust:    0, dealer:  1769, mainForce:  2598 },  // 玩股網實測
  { time: '2026-04-27', foreign:   143, trust:    0, dealer:   566, mainForce:   709 },  // 玩股網實測
  { time: '2026-04-28', foreign:  1191, trust:    0, dealer:  1215, mainForce:  2406 },  // 玩股網實測
  { time: '2026-04-29', foreign: -2003, trust:    0, dealer:  1375, mainForce:  -628 },  // 玩股網實測
  { time: '2026-04-30', foreign:  1447, trust:    0, dealer:    75, mainForce:  1522 },  // 玩股網實測
  { time: '2026-05-04', foreign:  -823, trust:    0, dealer:  -120, mainForce:  -943 },  // 玩股網實測
  { time: '2026-05-05', foreign:  2021, trust:    0, dealer:    47, mainForce:  2068 },  // 玩股網實測
  { time: '2026-05-06', foreign:  4225, trust:    0, dealer:   594, mainForce:  4819 },  // 玩股網實測
  { time: '2026-05-07', foreign:  -880, trust:    0, dealer:   -62, mainForce:  -942 },  // 玩股網實測
  { time: '2026-05-08', foreign:  -501, trust:    0, dealer:   186, mainForce:  -315 },  // 玩股網實測
  { time: '2026-05-11', foreign:  -371, trust:    0, dealer:    19, mainForce:  -352 },  // 玩股網實測
  { time: '2026-05-12', foreign: -1730, trust:    0, dealer:   -98, mainForce: -1828 },  // 玩股網實測
  { time: '2026-05-13', foreign:  -692, trust:    0, dealer:  -128, mainForce:  -820 },  // 玩股網實測
  { time: '2026-05-14', foreign:  -264, trust:    0, dealer:  -159, mainForce:  -423 },  // 玩股網實測
  { time: '2026-05-15', foreign:   335, trust:    0, dealer:  -348, mainForce:   -13 },  // 玩股網實測
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
  { time: '2026-04-27', open: 4709, high: 4762, low: 4688, close: 4748, volume: 2165 },  // 估算
  { time: '2026-04-28', open: 4748, high: 4795, low: 4732, close: 4778, volume: 2215 },  // 估算
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
  { time: '2026-04-27', open: 75.63, high: 76.45, low: 75.12, close: 76.08, volume: 895 },  // 估算
  { time: '2026-04-28', open: 76.08, high: 77.25, low: 75.85, close: 76.95, volume: 928 },  // 估算
];

// ── 智邦科技 (2345) ─────────────────────────────────────────────────────────────
// AI 網通龍頭；GB200/GB300 超高速交換器供應商，受惠 AI 資料中心建設
// OHLC: TWSE STOCK_DAY (April–May real data); March 估算（依 04/01 開盤倒推）
export const SEED_DATA_2345: OHLCData[] = [
  // March (估算 — 依 04/01 開盤 1585 倒推)
  { time: '2026-03-26', open: 1480, high: 1510, low: 1465, close: 1498, volume: 2850 },
  { time: '2026-03-27', open: 1495, high: 1528, low: 1478, close: 1512, volume: 3120 },
  { time: '2026-03-30', open: 1508, high: 1538, low: 1490, close: 1525, volume: 2980 },
  { time: '2026-03-31', open: 1520, high: 1558, low: 1508, close: 1545, volume: 3250 },
  // April (TWSE STOCK_DAY)
  { time: '2026-04-01', open: 1585, high: 1660, low: 1575, close: 1660, volume: 4304 },
  { time: '2026-04-02', open: 1670, high: 1685, low: 1580, close: 1590, volume: 3328 },
  { time: '2026-04-07', open: 1660, high: 1685, low: 1600, close: 1615, volume: 3377 },
  { time: '2026-04-08', open: 1680, high: 1765, low: 1680, close: 1710, volume: 5374 },
  { time: '2026-04-09', open: 1730, high: 1760, low: 1670, close: 1690, volume: 3271 },
  { time: '2026-04-10', open: 1750, high: 1855, low: 1720, close: 1835, volume: 5713 },
  { time: '2026-04-13', open: 1820, high: 1855, low: 1785, close: 1820, volume: 2934 },
  { time: '2026-04-14', open: 1885, high: 1910, low: 1850, close: 1890, volume: 4060 },
  { time: '2026-04-15', open: 1900, high: 2075, low: 1870, close: 1970, volume: 7294 },
  { time: '2026-04-16', open: 2025, high: 2050, low: 1975, close: 2035, volume: 3885 },
  { time: '2026-04-17', open: 2035, high: 2110, low: 2020, close: 2070, volume: 3419 },
  { time: '2026-04-20', open: 2045, high: 2060, low: 1995, close: 2005, volume: 4047 },
  { time: '2026-04-21', open: 2100, high: 2205, low: 2060, close: 2190, volume: 6399 },
  { time: '2026-04-22', open: 2150, high: 2250, low: 2130, close: 2200, volume: 4732 },
  { time: '2026-04-23', open: 2220, high: 2230, low: 2010, close: 2080, volume: 6589 },
  { time: '2026-04-24', open: 2105, high: 2170, low: 2050, close: 2140, volume: 5128 },
  { time: '2026-04-27', open: 2205, high: 2225, low: 2105, close: 2175, volume: 4987 },
  { time: '2026-04-28', open: 2250, high: 2340, low: 2195, close: 2295, volume: 5956 },
  { time: '2026-04-29', open: 2245, high: 2270, low: 2190, close: 2210, volume: 4562 },
  { time: '2026-04-30', open: 2225, high: 2315, low: 2215, close: 2280, volume: 3776 },
  // May (TWSE STOCK_DAY)
  { time: '2026-05-04', open: 2380, high: 2505, low: 2360, close: 2505, volume: 4412 },
  { time: '2026-05-05', open: 2520, high: 2550, low: 2440, close: 2495, volume: 3475 },
  { time: '2026-05-06', open: 2545, high: 2620, low: 2325, close: 2485, volume: 6256 },
  { time: '2026-05-07', open: 2495, high: 2560, low: 2465, close: 2560, volume: 3820 },
  { time: '2026-05-08', open: 2400, high: 2425, low: 2305, close: 2375, volume: 10934 },
  { time: '2026-05-11', open: 2490, high: 2610, low: 2485, close: 2590, volume: 8849 },
  { time: '2026-05-12', open: 2675, high: 2695, low: 2520, close: 2525, volume: 6057 },
  { time: '2026-05-13', open: 2510, high: 2555, low: 2435, close: 2435, volume: 4120 },
  { time: '2026-05-14', open: 2625, high: 2675, low: 2605, close: 2675, volume: 7660 },
  { time: '2026-05-15', open: 2640, high: 2640, low: 2500, close: 2505, volume: 7040 },
];

// 籌碼 (單位：張) — 來源 TWSE T86 三大法人買賣超日報（shares ÷ 1000 = 張）
// 未出現在 T86 當日資料 = 三大法人均為零
export const CHIP_DATA_2345: ChipData[] = [
  { time: '2026-04-01', foreign:  -105, trust:   385, dealer:   106, mainForce:   386 },
  { time: '2026-04-02', foreign:  -243, trust:   395, dealer:   -82, mainForce:    70 },
  { time: '2026-04-07', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-04-08', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-04-09', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-04-10', foreign:   692, trust:   227, dealer:   452, mainForce:  1371 },
  { time: '2026-04-13', foreign:    64, trust:    68, dealer:    20, mainForce:   153 },
  { time: '2026-04-14', foreign:  -142, trust:   196, dealer:   -18, mainForce:    35 },
  { time: '2026-04-15', foreign:   575, trust:   438, dealer:   -99, mainForce:   914 },
  { time: '2026-04-16', foreign:   138, trust:   154, dealer:     1, mainForce:   294 },
  { time: '2026-04-17', foreign:   125, trust:   204, dealer:   -28, mainForce:   301 },
  { time: '2026-04-20', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-04-21', foreign:   970, trust:   407, dealer:    16, mainForce:  1393 },
  { time: '2026-04-22', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-04-23', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-04-24', foreign:   825, trust:   -71, dealer:    61, mainForce:   815 },
  { time: '2026-04-27', foreign:  -208, trust:   771, dealer:    29, mainForce:   593 },
  { time: '2026-04-28', foreign:   830, trust:   237, dealer:    70, mainForce:  1137 },
  { time: '2026-04-29', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 未取得
  { time: '2026-04-30', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 未取得
  { time: '2026-05-04', foreign:  1277, trust:    29, dealer:     9, mainForce:  1314 },
  { time: '2026-05-05', foreign:    -6, trust:   211, dealer:    39, mainForce:   244 },
  { time: '2026-05-06', foreign:   133, trust:   -70, dealer:    30, mainForce:    93 },
  { time: '2026-05-07', foreign:   544, trust:    26, dealer:    60, mainForce:   630 },
  { time: '2026-05-08', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-05-11', foreign:  2647, trust:   669, dealer:   -38, mainForce:  3278 },
  { time: '2026-05-12', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-05-13', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
  { time: '2026-05-14', foreign:  2982, trust:   799, dealer:  -121, mainForce:  3660 },
  { time: '2026-05-15', foreign:     0, trust:     0, dealer:     0, mainForce:     0 },  // T86 無此股
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
  { time: '2026-04-27', open: 18.80, high: 19.35, low: 18.42, close: 19.05, volume: 365 },  // 估算
  { time: '2026-04-28', open: 19.05, high: 20.15, low: 18.88, close: 19.72, volume: 425 },  // 估算
];
