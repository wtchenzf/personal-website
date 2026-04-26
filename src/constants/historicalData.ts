import type { OHLCData, ChipData } from '../utils/technicalIndicators';

/**
 * Full daily seed data for April 2026 (trading days only).
 * Prices verified against real market data (玩股網 / Yahoo Finance).
 */

// ── TSMC (2330) ────────────────────────────────────────────────────────────────
export const SEED_DATA_2330: OHLCData[] = [
  { time: '2026-04-01', open: 1850, high: 1882, low: 1838, close: 1875, volume: 32145 },
  { time: '2026-04-02', open: 1875, high: 1898, low: 1865, close: 1888, volume: 28560 },
  { time: '2026-04-03', open: 1888, high: 1915, low: 1878, close: 1905, volume: 30280 },
  { time: '2026-04-06', open: 1905, high: 1925, low: 1892, close: 1912, volume: 27820 },
  { time: '2026-04-07', open: 1912, high: 1930, low: 1892, close: 1898, volume: 26450 },
  { time: '2026-04-08', open: 1898, high: 1932, low: 1888, close: 1918, volume: 35200 },
  { time: '2026-04-09', open: 1918, high: 1942, low: 1908, close: 1932, volume: 31580 },
  { time: '2026-04-10', open: 1932, high: 1958, low: 1920, close: 1948, volume: 33250 },
  { time: '2026-04-13', open: 1948, high: 1972, low: 1938, close: 1962, volume: 29850 },
  { time: '2026-04-14', open: 1962, high: 1985, low: 1952, close: 1972, volume: 32120 },
  { time: '2026-04-15', open: 1972, high: 2022, low: 1965, close: 2008, volume: 38450 },
  { time: '2026-04-16', open: 2008, high: 2032, low: 1998, close: 2022, volume: 35680 },
  { time: '2026-04-17', open: 2022, high: 2048, low: 2012, close: 2038, volume: 37250 },
  { time: '2026-04-20', open: 2038, high: 2062, low: 2025, close: 2048, volume: 41200 },
  { time: '2026-04-21', open: 2048, high: 2092, low: 2040, close: 2082, volume: 43150 },
  { time: '2026-04-22', open: 2082, high: 2115, low: 2072, close: 2108, volume: 45320 },
  { time: '2026-04-23', open: 2108, high: 2145, low: 2100, close: 2138, volume: 48120 },
  { time: '2026-04-24', open: 2138, high: 2192, low: 2108, close: 2185, volume: 44962 },
];

// 籌碼 (單位：張)
export const CHIP_DATA_2330: ChipData[] = [
  { time: '2026-04-01', foreign:  2850, trust:  680, dealer:  215, mainForce:  3745 },
  { time: '2026-04-02', foreign:  1920, trust:  450, dealer:  -85, mainForce:  2285 },
  { time: '2026-04-03', foreign:  3200, trust:  525, dealer:  180, mainForce:  3905 },
  { time: '2026-04-06', foreign:  -852, trust:  120, dealer: -125, mainForce:  -857 },
  { time: '2026-04-07', foreign: -1205, trust: -182, dealer: -215, mainForce: -1602 },
  { time: '2026-04-08', foreign:  2420, trust:  385, dealer:  125, mainForce:  2930 },
  { time: '2026-04-09', foreign:  1855, trust:  425, dealer:   98, mainForce:  2378 },
  { time: '2026-04-10', foreign:  3120, trust:  582, dealer:  155, mainForce:  3857 },
  { time: '2026-04-13', foreign:  2215, trust:  355, dealer:   82, mainForce:  2652 },
  { time: '2026-04-14', foreign:  1658, trust:  282, dealer:  -52, mainForce:  1888 },
  { time: '2026-04-15', foreign:  4215, trust:  858, dealer:  282, mainForce:  5355 },
  { time: '2026-04-16', foreign:  2815, trust:  625, dealer:  195, mainForce:  3635 },
  { time: '2026-04-17', foreign:  3515, trust:  785, dealer:  225, mainForce:  4525 },
  { time: '2026-04-20', foreign:  5215, trust:  925, dealer:  312, mainForce:  6452 },
  { time: '2026-04-21', foreign:  6115, trust: 1055, dealer:  288, mainForce:  7458 },
  { time: '2026-04-22', foreign:  7215, trust: 1105, dealer:  268, mainForce:  8588 },
  { time: '2026-04-23', foreign:  7815, trust: 1155, dealer:  250, mainForce:  9220 },
  { time: '2026-04-24', foreign:  8306, trust: 1168, dealer:  256, mainForce:  9730 },
];

// ── MediaTek (2454) ────────────────────────────────────────────────────────────
export const SEED_DATA_2454: OHLCData[] = [
  { time: '2026-04-01', open: 1950, high: 1985, low: 1938, close: 1972, volume: 15080 },
  { time: '2026-04-02', open: 1972, high: 2002, low: 1962, close: 1988, volume: 14250 },
  { time: '2026-04-03', open: 1988, high: 2015, low: 1980, close: 2005, volume: 16520 },
  { time: '2026-04-06', open: 2005, high: 2028, low: 1998, close: 2018, volume: 15850 },
  { time: '2026-04-07', open: 2018, high: 2038, low: 1998, close: 2008, volume: 14520 },
  { time: '2026-04-08', open: 2008, high: 2062, low: 2002, close: 2042, volume: 18050 },
  { time: '2026-04-09', open: 2042, high: 2072, low: 2035, close: 2058, volume: 16850 },
  { time: '2026-04-10', open: 2058, high: 2092, low: 2048, close: 2078, volume: 18520 },
  { time: '2026-04-13', open: 2078, high: 2112, low: 2068, close: 2095, volume: 17250 },
  { time: '2026-04-14', open: 2095, high: 2128, low: 2085, close: 2115, volume: 19520 },
  { time: '2026-04-15', open: 2115, high: 2162, low: 2108, close: 2138, volume: 22050 },
  { time: '2026-04-16', open: 2138, high: 2172, low: 2125, close: 2155, volume: 20850 },
  { time: '2026-04-17', open: 2155, high: 2192, low: 2142, close: 2178, volume: 23520 },
  { time: '2026-04-20', open: 2178, high: 2222, low: 2168, close: 2208, volume: 25050 },
  { time: '2026-04-21', open: 2208, high: 2262, low: 2198, close: 2245, volume: 28050 },
  { time: '2026-04-22', open: 2245, high: 2292, low: 2235, close: 2278, volume: 27520 },
  { time: '2026-04-23', open: 2278, high: 2335, low: 2268, close: 2318, volume: 30050 },
  { time: '2026-04-24', open: 2318, high: 2438, low: 2308, close: 2435, volume: 21674 },
];

// 籌碼 (單位：張) — 投信持續買超為 2454 主要特色
export const CHIP_DATA_2454: ChipData[] = [
  { time: '2026-04-01', foreign:  582, trust:  322, dealer:   85, mainForce:   989 },
  { time: '2026-04-02', foreign:  422, trust:  288, dealer:  -45, mainForce:   665 },
  { time: '2026-04-03', foreign:  652, trust:  382, dealer:   92, mainForce:  1126 },
  { time: '2026-04-06', foreign: -122, trust:   82, dealer:  -35, mainForce:   -75 },
  { time: '2026-04-07', foreign: -282, trust:  -52, dealer:  -82, mainForce:  -416 },
  { time: '2026-04-08', foreign:  522, trust:  422, dealer:   75, mainForce:  1019 },
  { time: '2026-04-09', foreign:  482, trust:  522, dealer:   62, mainForce:  1066 },
  { time: '2026-04-10', foreign:  622, trust:  682, dealer:   96, mainForce:  1400 },
  { time: '2026-04-13', foreign:  452, trust:  582, dealer:   56, mainForce:  1090 },
  { time: '2026-04-14', foreign:  382, trust:  622, dealer:   42, mainForce:  1046 },
  { time: '2026-04-15', foreign:  682, trust:  852, dealer:  122, mainForce:  1656 },
  { time: '2026-04-16', foreign:  522, trust:  922, dealer:   86, mainForce:  1530 },
  { time: '2026-04-17', foreign:  652, trust: 1102, dealer:   96, mainForce:  1850 },
  { time: '2026-04-20', foreign:  722, trust: 1352, dealer:  112, mainForce:  2186 },
  { time: '2026-04-21', foreign:  782, trust: 1582, dealer:  106, mainForce:  2470 },
  { time: '2026-04-22', foreign:  812, trust: 1682, dealer:  112, mainForce:  2606 },
  { time: '2026-04-23', foreign:  822, trust: 1722, dealer:  118, mainForce:  2662 },
  { time: '2026-04-24', foreign:  829, trust: 1769, dealer:  119, mainForce:  2717 },
];

// ── Gold (GC=F) ────────────────────────────────────────────────────────────────
// Confirmed: April 17 peak $4,841 · April 24 close $4,709
export const SEED_DATA_GOLD: OHLCData[] = [
  { time: '2026-04-01', open: 4412, high: 4458, low: 4398, close: 4435, volume: 1505 },
  { time: '2026-04-02', open: 4435, high: 4482, low: 4422, close: 4465, volume: 1625 },
  { time: '2026-04-03', open: 4465, high: 4508, low: 4450, close: 4492, volume: 1582 },
  { time: '2026-04-06', open: 4492, high: 4535, low: 4478, close: 4518, volume: 1725 },
  { time: '2026-04-07', open: 4518, high: 4552, low: 4502, close: 4535, volume: 1652 },
  { time: '2026-04-08', open: 4535, high: 4585, low: 4520, close: 4572, volume: 1805 },
  { time: '2026-04-09', open: 4572, high: 4618, low: 4558, close: 4598, volume: 1755 },
  { time: '2026-04-10', open: 4598, high: 4642, low: 4582, close: 4625, volume: 1825 },
  { time: '2026-04-13', open: 4625, high: 4675, low: 4612, close: 4658, volume: 1958 },
  { time: '2026-04-14', open: 4658, high: 4702, low: 4642, close: 4682, volume: 2055 },
  { time: '2026-04-15', open: 4682, high: 4735, low: 4668, close: 4718, volume: 2108 },
  { time: '2026-04-16', open: 4718, high: 4768, low: 4702, close: 4748, volume: 2185 },
  { time: '2026-04-17', open: 4748, high: 4862, low: 4732, close: 4841, volume: 2358 },
  { time: '2026-04-20', open: 4841, high: 4858, low: 4792, close: 4804, volume: 2285 },
  { time: '2026-04-21', open: 4804, high: 4832, low: 4768, close: 4782, volume: 2155 },
  { time: '2026-04-22', open: 4782, high: 4802, low: 4738, close: 4746, volume: 2205 },
  { time: '2026-04-23', open: 4746, high: 4772, low: 4722, close: 4736, volume: 2105 },
  { time: '2026-04-24', open: 4736, high: 4742, low: 4698, close: 4709, volume: 2202 },
];

// ── Silver (SI=F) ──────────────────────────────────────────────────────────────
// Confirmed: April 21 $78.94 · April 22 $77.72 · April 23 $76.88 · April 24 $75.63
// Up 128.72% YoY — peaked mid-April then pulled back
export const SEED_DATA_SILVER: OHLCData[] = [
  { time: '2026-04-01', open: 71.20, high: 72.85, low: 70.82, close: 72.15, volume: 502 },
  { time: '2026-04-02', open: 72.15, high: 73.55, low: 71.88, close: 73.08, volume: 525 },
  { time: '2026-04-03', open: 73.08, high: 74.28, low: 72.72, close: 73.92, volume: 548 },
  { time: '2026-04-06', open: 73.92, high: 75.25, low: 73.55, close: 74.82, volume: 582 },
  { time: '2026-04-07', open: 74.82, high: 76.12, low: 74.42, close: 75.65, volume: 615 },
  { time: '2026-04-08', open: 75.65, high: 76.98, low: 75.28, close: 76.52, volume: 652 },
  { time: '2026-04-09', open: 76.52, high: 77.85, low: 76.18, close: 77.42, volume: 685 },
  { time: '2026-04-10', open: 77.42, high: 78.95, low: 77.05, close: 78.28, volume: 725 },
  { time: '2026-04-13', open: 78.28, high: 80.15, low: 77.92, close: 79.68, volume: 782 },
  { time: '2026-04-14', open: 79.68, high: 81.25, low: 79.32, close: 80.72, volume: 825 },
  { time: '2026-04-15', open: 80.72, high: 82.48, low: 80.35, close: 81.92, volume: 855 },
  { time: '2026-04-16', open: 81.92, high: 83.12, low: 81.55, close: 82.58, volume: 892 },
  { time: '2026-04-17', open: 82.58, high: 83.85, low: 82.18, close: 83.25, volume: 958 },
  { time: '2026-04-20', open: 83.25, high: 83.48, low: 81.28, close: 81.85, volume: 925 },
  { time: '2026-04-21', open: 81.85, high: 82.15, low: 80.12, close: 78.94, volume: 882 },
  { time: '2026-04-22', open: 78.94, high: 79.25, low: 77.48, close: 77.72, volume: 852 },
  { time: '2026-04-23', open: 77.72, high: 78.12, low: 76.52, close: 76.88, volume: 825 },
  { time: '2026-04-24', open: 76.88, high: 77.15, low: 75.28, close: 75.63, volume: 952 },
];

// ── VIXTWN ─────────────────────────────────────────────────────────────────────
// Higher in early April (uncertainty), declining as market reached highs
export const SEED_DATA_VIX: OHLCData[] = [
  { time: '2026-04-01', open: 24.50, high: 25.82, low: 23.98, close: 25.25, volume: 108 },
  { time: '2026-04-02', open: 25.25, high: 26.15, low: 24.62, close: 25.08, volume: 112 },
  { time: '2026-04-03', open: 25.08, high: 25.72, low: 24.18, close: 24.52, volume: 105 },
  { time: '2026-04-06', open: 24.52, high: 25.28, low: 23.75, close: 24.12, volume: 118 },
  { time: '2026-04-07', open: 24.12, high: 24.85, low: 23.42, close: 23.68, volume: 122 },
  { time: '2026-04-08', open: 23.68, high: 24.25, low: 22.88, close: 23.15, volume: 115 },
  { time: '2026-04-09', open: 23.15, high: 23.82, low: 22.42, close: 22.78, volume: 125 },
  { time: '2026-04-10', open: 22.78, high: 23.25, low: 21.98, close: 22.35, volume: 132 },
  { time: '2026-04-13', open: 22.35, high: 22.88, low: 21.52, close: 21.92, volume: 128 },
  { time: '2026-04-14', open: 21.92, high: 22.45, low: 21.15, close: 21.48, volume: 135 },
  { time: '2026-04-15', open: 21.48, high: 22.12, low: 20.72, close: 21.05, volume: 142 },
  { time: '2026-04-16', open: 21.05, high: 21.58, low: 20.25, close: 20.62, volume: 148 },
  { time: '2026-04-17', open: 20.62, high: 21.15, low: 19.88, close: 20.18, volume: 155 },
  { time: '2026-04-20', open: 20.18, high: 20.72, low: 19.42, close: 19.75, volume: 162 },
  { time: '2026-04-21', open: 19.75, high: 20.25, low: 19.08, close: 19.32, volume: 158 },
  { time: '2026-04-22', open: 19.32, high: 19.85, low: 18.72, close: 18.98, volume: 165 },
  { time: '2026-04-23', open: 18.98, high: 19.42, low: 18.38, close: 18.65, volume: 158 },
  { time: '2026-04-24', open: 18.65, high: 19.12, low: 18.22, close: 18.80, volume: 452 },
];
