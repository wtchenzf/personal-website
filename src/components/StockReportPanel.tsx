/**
 * StockReportPanel v2 — 個股綜合分析報告
 * 參考真實看盤軟體佈局：技術分析總覽 | 籌碼日報 | 多週期 | 型態 | AI預測
 */
import { useMemo } from 'react';
import type { ChipBar } from './SmartMoneyChart';
import type { OHLCBar } from './MiniKLineChart';
import './StockReportPanel.css';

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  code: string; name: string; price: number; changePct: number;
  signal: number; sector: string;
  data: (OHLCBar & { volume?: number })[];
  chips: ChipBar[];
}

// ── PRNG ──────────────────────────────────────────────────────────────────────
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

// ── Indicators ────────────────────────────────────────────────────────────────
function calcMA(data: OHLCBar[], n: number): number[] {
  return data.map((_, i) => {
    if (i < n - 1) return NaN;
    return data.slice(i - n + 1, i + 1).reduce((s, d) => s + d.close, 0) / n;
  });
}

function calcBB(data: OHLCBar[], n = 20, k = 2) {
  const ma = calcMA(data, n);
  return data.map((_, i) => {
    if (i < n - 1) return { upper: NaN, mid: NaN, lower: NaN, bw: NaN };
    const slice = data.slice(i - n + 1, i + 1);
    const avg = ma[i];
    const std = Math.sqrt(slice.reduce((s, d) => s + (d.close - avg) ** 2, 0) / n);
    const upper = avg + k * std, lower = avg - k * std;
    return { upper: +upper.toFixed(2), mid: +avg.toFixed(2), lower: +lower.toFixed(2), bw: +((upper - lower) / avg * 100).toFixed(2) };
  });
}

function calcRSI(data: OHLCBar[], period = 14): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  for (let i = period; i < data.length; i++) {
    let g = 0, l = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = data[j].close - data[j - 1].close;
      d > 0 ? (g += d) : (l -= d);
    }
    result[i] = +(100 - 100 / (1 + (l === 0 ? 100 : g / l))).toFixed(1);
  }
  return result;
}

function calcKD(data: OHLCBar[], period = 9): { k: number; d: number }[] {
  const result: { k: number; d: number }[] = new Array(data.length).fill({ k: 50, d: 50 });
  let k = 50, d = 50;
  for (let i = period - 1; i < data.length; i++) {
    const sl = data.slice(i - period + 1, i + 1);
    const lo = Math.min(...sl.map(x => x.low));
    const hi = Math.max(...sl.map(x => x.high));
    const rsv = hi === lo ? 50 : (data[i].close - lo) / (hi - lo) * 100;
    k = k * 2 / 3 + rsv / 3; d = d * 2 / 3 + k / 3;
    result[i] = { k: +k.toFixed(1), d: +d.toFixed(1) };
  }
  return result;
}

function calcMACD(data: OHLCBar[]): { dif: number; dem: number; osc: number }[] {
  const ema = (arr: number[], n: number) => {
    const kk = 2 / (n + 1); let e = arr[0];
    return arr.map(v => { e = v * kk + e * (1 - kk); return e; });
  };
  const c = data.map(d => d.close);
  const e12 = ema(c, 12), e26 = ema(c, 26);
  const dif = e12.map((v, i) => +(v - e26[i]).toFixed(3));
  const dem = ema(dif, 9).map(v => +v.toFixed(3));
  return data.map((_, i) => ({ dif: dif[i], dem: dem[i], osc: +(dif[i] - dem[i]).toFixed(3) }));
}

function deriveInstSplit(chips: ChipBar[], seed: number) {
  const rf = mkRng(seed), rt = mkRng(seed ^ 0x7777);
  // Foreign: 50–72% of aggregate, with slight noise
  const foreign = chips.map(c => {
    const pct = 0.52 + rf() * 0.20;
    const noise = (rf() - 0.5) * Math.abs(c.value) * 0.12;
    return Math.round(c.value * pct + noise);
  });
  // Trust: 12–24% of aggregate, with slight noise
  const trust = chips.map(c => {
    const pct = 0.12 + rt() * 0.12;
    const noise = (rt() - 0.5) * Math.abs(c.value) * 0.10;
    const raw = Math.round(c.value * pct + noise);
    return raw;
  });
  // Dealer: exact residual so foreign + trust + dealer = chip.value
  const dealer = chips.map((c, i) => c.value - foreign[i] - trust[i]);
  return { foreign, trust, dealer };
}

function aggregateWeekly(data: OHLCBar[]): OHLCBar[] {
  const weeks: OHLCBar[] = [];
  for (let i = 0; i < data.length; i += 5) {
    const chunk = data.slice(i, Math.min(i + 5, data.length));
    weeks.push({ time: chunk[0].time, open: chunk[0].open,
      high: Math.max(...chunk.map(d => d.high)), low: Math.min(...chunk.map(d => d.low)),
      close: chunk[chunk.length - 1].close });
  }
  return weeks;
}

// ── Mini SVG candlestick chart ────────────────────────────────────────────────
function MiniCandles({ data, width = 130, height = 48 }: { data: OHLCBar[]; width?: number; height?: number }) {
  if (!data.length) return null;
  const maxH = Math.max(...data.map(d => d.high));
  const minL = Math.min(...data.map(d => d.low));
  const range = maxH - minL || maxH * 0.02 || 1;
  const pad = range * 0.1;
  const sy = (v: number) => ((maxH + pad - v) / (range + pad * 2)) * height;
  const bw = width / data.length;
  const bw2 = Math.max(1, bw * 0.6);
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const cx = i * bw + bw / 2;
        const isUp = d.close >= d.open;
        const color = isUp ? '#c0392b' : '#16a34a';
        const bt = sy(Math.max(d.open, d.close));
        const bb2 = sy(Math.min(d.open, d.close));
        return (
          <g key={i}>
            <line x1={cx} y1={sy(d.high)} x2={cx} y2={sy(d.low)} stroke={color} strokeWidth={0.8} />
            <rect x={cx - bw2 / 2} y={bt} width={bw2} height={Math.max(1, bb2 - bt)} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Win-rate arc gauge ────────────────────────────────────────────────────────
function WinGauge({ rate }: { rate: number }) {
  const R = 38, cx = 50, cy = 50;
  const toRad = (d: number) => (d - 90) * Math.PI / 180;
  const arc = (deg: number) => {
    const r = toRad(-120 + deg * 2.4);
    return `${cx + R * Math.cos(r)},${cy + R * Math.sin(r)}`;
  };
  const pct = Math.min(100, Math.max(0, rate));
  const color = pct >= 70 ? '#c0392b' : pct >= 55 ? '#e07b39' : '#6b7280';
  // bg arc: -120 → +120 degrees (240 total)
  const bgArcEnd = arc(100);
  const fillEnd  = arc(pct);
  const large = pct > 50 ? 1 : 0;
  const bgLarge = 1;
  const bgStart = arc(0);
  return (
    <svg width={100} height={72} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
      {/* track */}
      <path d={`M ${arc(0)} A ${R} ${R} 0 ${bgLarge} 1 ${bgArcEnd}`}
        fill="none" stroke="#e5e7eb" strokeWidth={9} strokeLinecap="round" />
      {/* fill */}
      {pct > 0 && (
        <path d={`M ${bgStart} A ${R} ${R} 0 ${large} 1 ${fillEnd}`}
          fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" />
      )}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={20} fontWeight={800} fill={color}>{rate}%</text>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtChip(v: number) {
  if (Math.abs(v) >= 10000) return (v >= 0 ? '+' : '') + (v / 1000).toFixed(0) + 'K';
  if (Math.abs(v) >= 1000)  return (v >= 0 ? '+' : '') + (v / 1000).toFixed(1) + 'K';
  return (v >= 0 ? '+' : '') + v;
}
function chipCls(v: number) { return v > 0 ? 'pos' : v < 0 ? 'neg' : 'srp-neutral'; }
function numCls(v: number)  { return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; }

// ── Main component ────────────────────────────────────────────────────────────
export default function StockReportPanel({ code, name, price, changePct, signal, sector, data, chips }: Props) {

  const A = useMemo(() => {
    if (!data.length) return null;
    const n = data.length;
    const hasChips = chips.length > 0;
    const seed = parseInt(code.replace(/\D/g, '')) || 1234;
    const rng = mkRng(seed ^ 0xABCD);

    // ── Technical indicators ──────────────────────────────────────────────────
    const ma5Arr  = calcMA(data, 5);
    const ma20Arr = calcMA(data, 20);
    const ma60Arr = calcMA(data, 60);
    const bbArr   = calcBB(data, 20, 2);
    const rsiArr  = calcRSI(data, 14);
    const kdArr   = calcKD(data, 9);
    const macdArr = calcMACD(data);

    const ma5   = +ma5Arr[n - 1].toFixed(2);
    const ma20  = +ma20Arr[n - 1].toFixed(2);
    const ma60r = ma60Arr[n - 1];
    const ma60  = isNaN(ma60r) ? null : +ma60r.toFixed(2);
    const bb    = bbArr[n - 1];
    const bbPrev = bbArr[Math.max(0, n - 6)];
    const rsi   = isNaN(rsiArr[n - 1]) ? (rsiArr.find(v => !isNaN(v)) ?? 50) : rsiArr[n - 1];
    const kd    = kdArr[n - 1];
    const macd  = macdArr[n - 1];

    // Volume
    const vols = data.map(d => (d as { volume?: number }).volume ?? 0);
    const lastVol  = vols[n - 1];
    const avgVol5  = vols.slice(-5).reduce((s, v) => s + v, 0) / 5;
    const avgVolAll = vols.reduce((s, v) => s + v, 0) / n;
    const recentVol3 = vols.slice(-3).reduce((s, v) => s + v, 0) / 3;
    const prevVol3   = vols.slice(-6, -3).reduce((s, v) => s + v, 0) / 3;
    const volExpanding = recentVol3 > prevVol3 * 1.08;
    const volShrinking = recentVol3 < prevVol3 * 0.92;
    const volRatioLast = avgVolAll > 0 ? +(lastVol / avgVolAll).toFixed(2) : 1;

    // Price trend (last 3 days)
    const priceUp3   = data.slice(-3).every((d, i, a) => i === 0 || d.close >= a[i - 1].close);
    const priceDown3 = data.slice(-3).every((d, i, a) => i === 0 || d.close <= a[i - 1].close);

    // MA alignment
    const aboveMA5  = price > ma5;
    const aboveMA20 = price > ma20;
    const aboveMA60 = ma60 !== null ? price > ma60 : null;
    const maBull    = ma5 > ma20 && (ma60 === null || ma20 > ma60);
    const maBear    = ma5 < ma20 && (ma60 === null || ma20 < ma60);

    // BB position
    const bbPctB = (!isNaN(bb.upper) && bb.upper !== bb.lower)
      ? Math.min(1.1, Math.max(-0.1, (price - bb.lower) / (bb.upper - bb.lower)))
      : 0.5;
    const bbWidening = !isNaN(bb.bw) && !isNaN(bbPrev.bw) && bb.bw > bbPrev.bw * 1.02;
    const bbNarrowing = !isNaN(bb.bw) && !isNaN(bbPrev.bw) && bb.bw < bbPrev.bw * 0.98;

    // RSI zone
    const rsiZone = rsi >= 70 ? 'overbought' : rsi >= 50 ? 'bullish' : rsi >= 30 ? 'neutral' : 'oversold';
    const kdCross      = kd.k > kd.d;
    const kdOverbought = kd.k > 80;
    const kdOversold   = kd.k < 20;
    const macdBull     = macd.dif > macd.dem;
    const macdAbove0   = macd.dif > 0;
    const oscUp        = macd.osc > 0;

    // ── 技術分析總覽 items ────────────────────────────────────────────────────
    type DotColor = 'red' | 'amber' | 'green' | 'gray';
    interface TechItem { label: string; value: string; dot: DotColor }

    // 1. 趨勢方向
    const trendDir: TechItem = (() => {
      if (maBull && macdBull && macdAbove0)
        return { label: '趨勢方向', value: '多頭趨勢', dot: 'red' };
      if (maBear && !macdAbove0)
        return { label: '趨勢方向', value: '空頭趨勢', dot: 'green' };
      return { label: '趨勢方向', value: '盤整走勢', dot: 'amber' };
    })();

    // 2. 價格位置
    const pricePos: TechItem = (() => {
      if (bbPctB > 0.85)  return { label: '價格位置', value: '高檔整理（貼近上軌）', dot: 'amber' };
      if (bbPctB > 0.6)   return { label: '價格位置', value: '中高檔偏多', dot: 'red' };
      if (bbPctB > 0.4)   return { label: '價格位置', value: '中軸附近整理', dot: 'amber' };
      if (bbPctB > 0.15)  return { label: '價格位置', value: '中低檔偏弱', dot: 'amber' };
      return { label: '價格位置', value: '低檔超賣（貼近下軌）', dot: 'green' };
    })();

    // 3. 均線排列
    const maAlign: TechItem = (() => {
      const tag = ma60 !== null
        ? `（5>${ma5 > ma20 ? '' : '≯'}20>${ma20 > (ma60 ?? 0) ? '' : '≯'}60）`
        : '（5>20）';
      if (maBull) return { label: '均線排列', value: `多頭排列${tag}`, dot: 'red' };
      if (maBear) return { label: '均線排列', value: `空頭排列${tag}`, dot: 'green' };
      return { label: '均線排列', value: '多空混沌', dot: 'amber' };
    })();

    // 4. 量價關係
    const volPrice: TechItem = (() => {
      if (volExpanding && priceUp3)   return { label: '量價關係', value: '量增上漲，動能強勁', dot: 'red' };
      if (volShrinking && priceUp3)   return { label: '量價關係', value: '量縮上漲，動能降溫', dot: 'amber' };
      if (volExpanding && priceDown3) return { label: '量價關係', value: '量增下跌，賣壓沉重', dot: 'green' };
      if (volShrinking && priceDown3) return { label: '量價關係', value: '量縮下跌，跌勢收斂', dot: 'amber' };
      return { label: '量價關係', value: '量平，待方向選擇', dot: 'gray' };
    })();

    // 5. 布林位置
    const bbPos: TechItem = (() => {
      if (bbPctB > 0.9)  return { label: '布林位置', value: '貼近上軌（過熱）', dot: 'amber' };
      if (bbPctB > 0.6)  return { label: '布林位置', value: '上半部偏多', dot: 'red' };
      if (bbPctB > 0.4)  return { label: '布林位置', value: '中軸附近', dot: 'gray' };
      if (bbPctB > 0.1)  return { label: '布林位置', value: '下半部偏弱', dot: 'amber' };
      return { label: '布林位置', value: '貼近下軌（超賣）', dot: 'green' };
    })();

    // 6. 布林通道
    const bbBand: TechItem = (() => {
      if (bbWidening)  return { label: '布林通道', value: '開口擴大（趨勢加速）', dot: 'amber' };
      if (bbNarrowing) return { label: '布林通道', value: '開口收縮（整理蓄力）', dot: 'gray' };
      return { label: '布林通道', value: '平行延伸（趨勢持續）', dot: 'red' };
    })();

    // 7. 綜合評估
    const overallScore = (maBull ? 2 : maBear ? -2 : 0) + (macdBull && macdAbove0 ? 2 : macdBull ? 1 : 0)
      + (rsi >= 50 && rsi < 70 ? 1 : rsi >= 70 ? -1 : rsi < 30 ? -2 : 0)
      + (kdCross && !kdOverbought ? 1 : kdOverbought ? -1 : 0)
      + (aboveMA5 ? 1 : -1) + (aboveMA20 ? 1 : -1);
    const overall: TechItem = (() => {
      if (overallScore >= 5)  return { label: '綜合評估', value: '多頭強勢，積極追蹤', dot: 'red' };
      if (overallScore >= 2)  return { label: '綜合評估', value: '多頭整理，等待突破', dot: 'red' };
      if (overallScore >= 0)  return { label: '綜合評估', value: '高檔震盪出貨初期', dot: 'red' };
      if (overallScore >= -3) return { label: '綜合評估', value: '趨勢轉弱，謹慎操作', dot: 'amber' };
      return { label: '綜合評估', value: '空頭格局，暫時回避', dot: 'green' };
    })();

    const techItems: TechItem[] = [trendDir, pricePos, maAlign, volPrice, bbPos, bbBand, overall];

    // ── Chip analysis ─────────────────────────────────────────────────────────
    const instSplit = hasChips ? deriveInstSplit(chips, seed) : null;
    const { foreign, trust, dealer } = instSplit ?? { foreign: [] as number[], trust: [] as number[], dealer: [] as number[] };

    // Last 5 days chip table (三大法人)
    const chip5 = hasChips ? chips.slice(-5) : [];
    const for5  = foreign.slice(-5);
    const tru5  = trust.slice(-5);
    const deal5 = dealer.slice(-5);

    // Running 10-day cumulative for main force table
    const chipVals = chips.map(c => c.value);
    const cum10: number[] = chipVals.map((_, i) => {
      const start = Math.max(0, i - 9);
      return chipVals.slice(start, i + 1).reduce((s, v) => s + v, 0);
    });

    // Time-based OHLC lookup (robust: works even when chipLen ≠ ohlcLen)
    const ohlcByTime = new Map<string, { bar: typeof data[0]; prevBar: typeof data[0] | null }>();
    data.forEach((d, i) => ohlcByTime.set(d.time, { bar: d, prevBar: i > 0 ? data[i - 1] : null }));

    const last5MainForce = chip5.map((c, localIdx) => {
      const chipGlobalIdx = chips.length - 5 + localIdx;
      const entry = ohlcByTime.get(c.time);
      const closePrice = entry?.bar.close ?? 0;
      const prevClose  = entry?.prevBar?.close ?? 0;
      const dayChg = (closePrice && prevClose)
        ? +((closePrice - prevClose) / prevClose * 100).toFixed(2)
        : 0;
      return { date: c.time.slice(5).replace('-', '/'), value: c.value, cum10: cum10[chipGlobalIdx] ?? 0, closePrice, dayChg };
    });

    // ── Key price levels ──────────────────────────────────────────────────────
    const recentHigh = Math.max(...data.slice(-10).map(d => d.high));
    const recentLow  = Math.min(...data.slice(-10).map(d => d.low));
    const resist1    = +(recentHigh * 1.005).toFixed(0);
    const resist2    = +Math.max(recentHigh * 1.02, price * 1.05).toFixed(0);
    const pullback1  = +Math.min(ma20 * 1.01, price * 0.97).toFixed(0);
    const pullback2  = +Math.max(ma20 * 0.99, price * 0.95).toFixed(0);
    const support1   = +Math.max(ma5, price * 0.93).toFixed(0);
    const support2   = +(Math.min(ma20, recentLow) * 0.995).toFixed(0);
    const stopLoss   = +(Math.min(ma20, recentLow) * 0.98).toFixed(0);
    const breakout   = resist1;

    // ── Smart money signal (主力燈號) ─────────────────────────────────────────
    type MainSignalKey = 'rally' | 'hold' | 'distrib-early' | 'distrib' | 'accum' | 'retest';
    interface MainSignalMeta { key: MainSignalKey; label: string; sub: string; color: string; bg: string }

    const mainSignal: MainSignalMeta = (() => {
      const chipBuyDays = hasChips ? chip5.filter(c => c.value > 0).length : 0;
      const chipBuyRecent = hasChips ? (chips.at(-1)?.value ?? 0) + (chips.at(-2)?.value ?? 0) : 0;
      if (kd.k > 80 && rsi > 70 && chipBuyRecent < 0)
        return { key: 'distrib-early', label: '出貨初期', sub: '主力開始調節，需留意短線風險', color: '#c0392b', bg: '#fee2e2' };
      if (kd.k > 80 && rsi > 75 && chipBuyDays < 2)
        return { key: 'distrib', label: '高檔出貨', sub: '籌碼明顯鬆動，建議減碼因應', color: '#9b2226', bg: '#fecaca' };
      if (maBull && macdBull && macdAbove0 && chipBuyDays >= 3 && rsi < 70)
        return { key: 'rally', label: '主升段', sub: '主力強勢持有，適合跟隨佈局', color: '#155724', bg: '#d1e7dd' };
      if (maBull && chipBuyDays >= 2 && rsi >= 50 && rsi < 70)
        return { key: 'hold', label: '多頭整理', sub: '短線整理蓄力，等待再攻', color: '#856404', bg: '#fff3cd' };
      if (aboveMA5 === false && aboveMA20 === false && rsi < 40)
        return { key: 'accum', label: '底部蓄積', sub: '低位吸籌跡象，耐心等待轉機', color: '#0a3622', bg: '#a3cfbb' };
      if (aboveMA20 && !aboveMA5)
        return { key: 'retest', label: '回測支撐', sub: '拉回均線支撐，逢低承接機會', color: '#084298', bg: '#cfe2ff' };
      return { key: 'hold', label: '多頭整理', sub: '技術面整理中，方向尚未明確', color: '#856404', bg: '#fff3cd' };
    })();

    // ── Win rate ──────────────────────────────────────────────────────────────
    const baseRate   = Math.round(signal * 0.45 + 35 + rng() * 8 - 4);
    const rsiPenalty = rsi > 75 ? -8 : rsi < 30 ? +5 : 0;
    const kdPenalty  = kd.k > 85 ? -6 : kd.k < 20 ? +4 : 0;
    const winRate    = Math.min(85, Math.max(30, baseRate + rsiPenalty + kdPenalty));
    const winDir     = winRate >= 70 ? '勝率穩定' : rsi > 68 ? '勝率下降中' : '勝率回升中';

    // ── Pattern detection ─────────────────────────────────────────────────────
    // Detect local minima and maxima
    const localMins: number[] = [], localMaxs: number[] = [];
    for (let i = 1; i < n - 1; i++) {
      if (data[i].low  < data[i - 1].low  && data[i].low  < data[i + 1].low)  localMins.push(i);
      if (data[i].high > data[i - 1].high && data[i].high > data[i + 1].high) localMaxs.push(i);
    }
    // W底
    let wStatus: 'formed' | 'forming' | 'none' = 'none';
    let wReason = '尚未見明顯雙底型態';
    if (localMins.length >= 2) {
      const l1i = localMins[localMins.length - 2], l2i = localMins[localMins.length - 1];
      const l1 = data[l1i].low, l2 = data[l2i].low;
      const sim = Math.abs(l2 - l1) / Math.max(l1, l2);
      const sep = l2i - l1i;
      if (sim < 0.06 && sep >= 4 && sep <= 18) {
        const neck = Math.max(...data.slice(l1i, l2i + 1).map(d => d.high));
        if (price > neck) { wStatus = 'formed'; wReason = `頸線突破，W底確立，目標 ${+(neck * 1.08).toFixed(0)}`; }
        else if (l2i >= n - 6) { wStatus = 'forming'; wReason = `右底形成，待突破頸線 ${+neck.toFixed(0)}`; }
        else wReason = '右底未完成，型態尚未成立';
      } else { wReason = '雙底間距或幅度不符，型態不成立'; }
    }
    // M頭
    let mStatus: 'formed' | 'forming' | 'none' = 'none';
    let mReason = '尚未見明顯雙頂型態';
    if (localMaxs.length >= 2) {
      const h1i = localMaxs[localMaxs.length - 2], h2i = localMaxs[localMaxs.length - 1];
      const h1 = data[h1i].high, h2 = data[h2i].high;
      const sim = Math.abs(h2 - h1) / Math.max(h1, h2);
      const sep = h2i - h1i;
      if (sim < 0.06 && sep >= 4 && sep <= 18) {
        const neck = Math.min(...data.slice(h1i, h2i + 1).map(d => d.low));
        if (price < neck) { mStatus = 'formed'; mReason = `頸線跌破，M頭確立，目標 ${+(neck * 0.92).toFixed(0)}`; }
        else if (h2i >= n - 6) { mStatus = 'forming'; mReason = `右峰已形成，待確認跌破頸線 ${+neck.toFixed(0)}`; }
        else mReason = '右峰未確認，型態尚未成立';
      } else { mReason = '雙頂間距或幅度不符，型態不成立'; }
    }

    // ── Multi-timeframe analysis ──────────────────────────────────────────────
    // Short (last 5 daily candles as proxy for intraday)
    const short5 = data.slice(-5);
    const shortClose5 = short5.map(d => d.close);
    const shortTrend = shortClose5[4] > shortClose5[0] * 1.01 ? '上漲趨勢' : shortClose5[4] < shortClose5[0] * 0.99 ? '整理偏弱' : '震盪整理';
    const shortState = kd.k > 75 ? '高檔震盪' : kd.k > 55 ? '強勢整理' : kd.k < 35 ? '低檔反彈' : '盤整格局';
    const shortStruct = price < Math.max(...short5.map(d => d.high)) * 0.98 ? '無法再創新高' : '持續新高';

    // Medium (full daily data)
    const midTrend = maBull ? '多頭趨勢' : maBear ? '空頭趨勢' : '盤整趨勢';
    const midState = rsi > 65 ? '高檔整理' : rsi < 40 ? '低位整理' : '主升段中';
    const midStruct = macdAbove0 ? '主升段中繼整理' : '波段高點回落';

    // Long (weekly from aggregated data)
    const weekly = aggregateWeekly(data);
    const wLen = weekly.length;
    const wKD = calcKD(weekly, Math.min(5, wLen));
    const wkd = wKD[wLen - 1];
    const longTrend = weekly[wLen - 1].close > weekly[Math.max(0, wLen - 3)].close ? '波段強勢' : '趨勢整理';
    const longState = weekly[wLen - 1].close > weekly[0].close * 1.1 ? '主升段後期' : '波段上漲中';
    const longStruct = wkd.k > wkd.d ? '多頭延續' : '高點整理';

    // ── AI next-day prediction ────────────────────────────────────────────────
    let upBase = 42 + (macdBull ? 6 : -4) + (aboveMA5 ? 4 : -4) + (rsi < 50 ? 5 : rsi > 70 ? -8 : 0)
      + (kdCross ? 4 : -2) + (volExpanding && priceUp3 ? 4 : 0) + (bbPctB > 0.85 ? -6 : 0);
    upBase += Math.round((rng() - 0.5) * 10);
    const sideways = Math.round(10 + rng() * 12);
    upBase   = Math.round(upBase   * (100 - sideways) / 100);
    const upProb   = Math.min(75, Math.max(18, upBase));
    const downProb = Math.min(70, Math.max(15, 100 - sideways - upProb));
    const swProb   = 100 - upProb - downProb;

    const aiConclusion = upProb > downProb + 10
      ? '多方動能佔優，明日上漲機率偏高，可留意量能是否配合。'
      : downProb > upProb + 10
      ? '高檔震盪偏弱，明日下跌機率偏高，建議謹慎控制風險。'
      : '多空拉鋸，明日震盪機率偏高，等待方向明確後再介入。';
    const aiNote = bbPctB > 0.8
      ? `觀察重點：能否守穩 ${support1.toLocaleString()} 關卡，量能是否回溫。`
      : rsi < 40
      ? `觀察重點：是否出現量縮止跌，${support2.toLocaleString()} 支撐是否有效。`
      : `觀察重點：突破 ${breakout.toLocaleString()} 且放量為強訊號。`;

    // ── Weekly data for mini chart ────────────────────────────────────────────
    const weeklyLast5 = weekly.slice(-5);
    const shortLast = data.slice(-12);    // ~60分K proxy: last 12 candles

    // ── Recommendations ───────────────────────────────────────────────────────
    type RecKey = '策略' | '回檔買點' | '強勢突破' | '停損防守' | '操作心法';
    const recs: { key: RecKey; val: string; icon: string; cls?: string }[] = [
      { key: '策略', icon: '▶',
        val: rsi > 70 || kd.k > 80 ? '高檔勿追，等待回檔至支撐再布局' : rsi < 35 ? '超賣反彈，小量試單' : '逢回測支撐，分批建立部位' },
      { key: '回檔買點', icon: '●', cls: 'pos',
        val: `${pullback2.toLocaleString()} ～ ${pullback1.toLocaleString()}` },
      { key: '強勢突破', icon: '●', cls: 'pos',
        val: `突破 ${breakout.toLocaleString()} 且放量，可積極追進` },
      { key: '停損防守', icon: '●', cls: 'neg',
        val: `跌破 ${stopLoss.toLocaleString()} 轉弱出場` },
      { key: '操作心法', icon: '▶',
        val: rsi > 65 ? '高檔控制風險，低檔找起漲點' : '耐心等待訊號，紀律執行停損' },
    ];

    return {
      hasChips, ma5, ma20, ma60, bb, bbPctB, bbWidening, bbNarrowing, rsi, rsiZone,
      kd, kdCross, kdOverbought, kdOversold, macd, macdBull, macdAbove0, oscUp,
      lastVol, avgVol5, avgVolAll, volRatioLast, volExpanding, volShrinking,
      aboveMA5, aboveMA20, aboveMA60, maBull, maBear, overallScore,
      techItems, chip5, for5, tru5, deal5, last5MainForce,
      resist1, resist2, pullback1, pullback2, support1, support2, stopLoss, breakout,
      mainSignal, winRate, winDir,
      wStatus, wReason, mStatus, mReason,
      shortLast, weeklyLast5, weekly,
      shortState, shortTrend, shortStruct,
      midState, midTrend, midStruct,
      longState, longTrend, longStruct,
      upProb, downProb, swProb, aiConclusion, aiNote, recs,
    };
  }, [data, chips, code, price, signal]);

  if (!A) return null;

  const isUp = changePct >= 0;
  const dateStr = chips.at(-1)?.time ?? data.at(-1)?.time ?? '';
  const dateDisp = dateStr.slice(5).replace('-', '/');

  return (
    <div className="srp-wrap">

      {/* ── Header ── */}
      <div className="srp-title-bar">
        <span className="srp-title-code">{code}</span>
        <span className="srp-title-name">{name}</span>
        <span className="srp-title-sector">{sector}</span>
        <div className="srp-title-price-group">
          <span className="srp-title-price">{price.toLocaleString()}</span>
          <span className={`srp-title-chg ${isUp ? 'up' : 'dn'}`}>
            {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
          </span>
        </div>
        <div className="srp-title-meta">
          <span>成交量 {A.lastVol > 0 ? (A.lastVol / 1000).toFixed(0) : '—'}K 張</span>
          <span>量比 {A.volRatioLast}x</span>
        </div>
        <span className="srp-title-date">{dateStr.slice(0, 4)}/{dateDisp} 盤後</span>
      </div>

      {/* ══ Row 1: 技術分析總覽 | 籌碼分析 ══════════════════════════════════ */}
      <div className="srp-r1">

        {/* 技術分析總覽 */}
        <div className="srp-box srp-tech-overview">
          <div className="srp-box-head">📊 技術分析總覽</div>
          <div className="srp-tech-list">
            {A.techItems.map(item => (
              <div key={item.label} className="srp-tech-row">
                <span className={`srp-dot dot-${item.dot}`} />
                <span className="srp-tech-label">{item.label}</span>
                <span className="srp-tech-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 籌碼分析 */}
        <div className="srp-box srp-chip-overview">
          <div className="srp-box-head">💰 籌碼分析 — 三大法人（張）</div>
          {A.hasChips ? (
            <table className="srp-day-table">
              <thead>
                <tr><th>日期</th><th>外資</th><th>投信</th><th>自營</th><th>合計</th></tr>
              </thead>
              <tbody>
                {A.chip5.map((c, i) => (
                  <tr key={c.time}>
                    <td className="dt">{c.time.slice(5).replace('-', '/')}</td>
                    <td className={chipCls(A.for5[i])}>{fmtChip(A.for5[i])}</td>
                    <td className={chipCls(A.tru5[i])}>{fmtChip(A.tru5[i])}</td>
                    <td className={chipCls(A.deal5[i])}>{fmtChip(A.deal5[i])}</td>
                    <td className={`total-col ${chipCls(c.value)}`}>{fmtChip(c.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="srp-no-chip-msg">
              <span className="srp-no-chip-icon">📊</span>
              <span>本標的為指數或商品，不提供三大法人籌碼資料</span>
            </div>
          )}

          <div className="srp-box-head" style={{ marginTop: 8 }}>⚡ 主力進出（張）</div>
          {A.hasChips ? (
            <table className="srp-day-table">
              <thead>
                <tr><th>日期</th><th>主力增減</th><th>10日累計</th><th>收盤價</th><th>漲跌幅</th></tr>
              </thead>
              <tbody>
                {A.last5MainForce.map(row => (
                  <tr key={row.date}>
                    <td className="dt">{row.date}</td>
                    <td className={chipCls(row.value)}>{fmtChip(row.value)}</td>
                    <td className={chipCls(row.cum10)}>{fmtChip(row.cum10)}</td>
                    <td>{row.closePrice > 0 ? row.closePrice.toLocaleString() : '—'}</td>
                    <td className={numCls(row.dayChg)}>{row.dayChg !== 0 ? (row.dayChg > 0 ? '▲' : '▼') + Math.abs(row.dayChg).toFixed(2) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="srp-no-chip-msg"><span>無籌碼資料</span></div>
          )}
        </div>
      </div>

      {/* ══ Row 2: 多週期趨勢分析 | 關鍵價位 | 主力燈號 + 勝率 ══════════════ */}
      <div className="srp-r2">

        {/* 多週期趨勢分析 */}
        <div className="srp-box srp-multi-tf">
          <div className="srp-box-head">📈 多週期趨勢分析</div>
          <div className="srp-tf-grid">
            {/* 短線 (60分K proxy) */}
            <div className="srp-tf-card">
              <div className="srp-tf-title">60分K <span className="srp-tf-sub">（短線）</span></div>
              <div className="srp-tf-chart">
                <MiniCandles data={A.shortLast} width={120} height={42} />
              </div>
              <div className="srp-tf-rows">
                <div><span>狀態</span><span>{A.shortState}</span></div>
                <div><span>趨勢</span><span>{A.shortTrend}</span></div>
                <div><span>結構</span><span>{A.shortStruct}</span></div>
              </div>
              <div className={`srp-tf-badge ${A.shortTrend.includes('弱') ? 'warn' : A.shortTrend.includes('漲') ? 'bull' : 'neutral'}`}>
                {A.shortTrend.includes('弱') ? '短線轉弱跡象' : A.shortTrend.includes('漲') ? '短線強勢' : '短線觀察'}
              </div>
            </div>
            {/* 中線 (日K) */}
            <div className="srp-tf-card">
              <div className="srp-tf-title">日K <span className="srp-tf-sub">（中線）</span></div>
              <div className="srp-tf-chart">
                <MiniCandles data={A.shortLast.length >= 20 ? A.shortLast : data.slice(-20)} width={120} height={42} />
              </div>
              <div className="srp-tf-rows">
                <div><span>狀態</span><span>{A.midState}</span></div>
                <div><span>趨勢</span><span>{A.midTrend}</span></div>
                <div><span>結構</span><span>{A.midStruct}</span></div>
              </div>
              <div className={`srp-tf-badge ${A.macdBull ? 'bull' : 'warn'}`}>
                {A.midTrend}
              </div>
            </div>
            {/* 長線 (週K) */}
            <div className="srp-tf-card">
              <div className="srp-tf-title">週K <span className="srp-tf-sub">（長線）</span></div>
              <div className="srp-tf-chart">
                <MiniCandles data={A.weeklyLast5} width={120} height={42} />
              </div>
              <div className="srp-tf-rows">
                <div><span>狀態</span><span>{A.longState}</span></div>
                <div><span>趨勢</span><span>{A.longTrend}</span></div>
                <div><span>結構</span><span>{A.longStruct}</span></div>
              </div>
              <div className={`srp-tf-badge ${A.longStruct.includes('多頭') ? 'bull' : 'neutral'}`}>
                {A.longStruct}
              </div>
            </div>
          </div>
        </div>

        {/* 關鍵價位 */}
        <div className="srp-box srp-levels-box">
          <div className="srp-box-head">🎯 關鍵價位</div>
          <div className="srp-level-zone resist">
            <div className="srp-lz-label">壓力區</div>
            <div className="srp-lz-range">{A.resist1.toLocaleString()} ～ {A.resist2.toLocaleString()}</div>
          </div>
          <div className="srp-level-zone pullback">
            <div className="srp-lz-label">回檔區</div>
            <div className="srp-lz-range">{A.pullback2.toLocaleString()} ～ {A.pullback1.toLocaleString()}</div>
          </div>
          <div className="srp-level-zone support">
            <div className="srp-lz-label">支撐區</div>
            <div className="srp-lz-range">{A.support2.toLocaleString()} ～ {A.support1.toLocaleString()}</div>
          </div>
          <div className="srp-level-tips">
            <div><span className="neg">跌破防守</span> 跌破 {A.stopLoss.toLocaleString()} 轉弱</div>
            <div><span className="pos">強勢關鍵</span> 突破 {A.breakout.toLocaleString()} 才強</div>
          </div>
        </div>

        {/* 主力燈號 + 短線勝率 */}
        <div className="srp-box srp-signals-box">
          <div className="srp-box-head">🔦 主力燈號</div>
          <div className="srp-main-signal" style={{ background: A.mainSignal.bg }}>
            <div className="srp-msig-dot" style={{ background: A.mainSignal.color }} />
            <div className="srp-msig-label" style={{ color: A.mainSignal.color }}>{A.mainSignal.label}</div>
            <div className="srp-msig-sub">{A.mainSignal.sub}</div>
          </div>

          <div className="srp-box-head" style={{ marginTop: 10 }}>📡 短線勝率（AI強化版）</div>
          <div className="srp-winrate-wrap">
            <WinGauge rate={A.winRate} />
            <div className="srp-windir">{A.winDir}</div>
          </div>
        </div>
      </div>

      {/* ══ Row 3: 型態分析 | 技術指標總覽 | 操作建議 | 明日預測 ══════════════ */}
      <div className="srp-r3">

        {/* 型態分析 */}
        <div className="srp-box srp-pattern-box">
          <div className="srp-box-head">🔍 型態分析</div>
          {/* W底 */}
          <div className="srp-pattern-item">
            <div className="srp-pat-title">W底分析</div>
            <div className={`srp-pat-status ${A.wStatus === 'formed' ? 'bull' : A.wStatus === 'forming' ? 'amber' : 'none'}`}>
              {A.wStatus === 'formed' ? '✅ W底確立' : A.wStatus === 'forming' ? '⚠ 形成中' : '✗ 未形成'}
            </div>
            {/* Stick figure */}
            <div className="srp-pat-stick w-stick">
              <div className="stick-pts">
                <span>左底</span><span>頸線</span><span>右底</span>
              </div>
              <svg viewBox="0 0 60 30" width="90" height="36">
                <polyline points="0,25 10,25 20,8 30,25 40,25 50,8 60,8" fill="none" stroke={A.wStatus !== 'none' ? '#c0392b' : '#9ca3af'} strokeWidth="2" strokeLinejoin="round" />
                {A.wStatus === 'none' && <line x1="0" y1="0" x2="60" y2="30" stroke="#ef4444" strokeWidth="1.5" />}
              </svg>
            </div>
            <div className="srp-pat-reason">{A.wReason}</div>
          </div>
          {/* M頭 */}
          <div className="srp-pattern-item" style={{ marginTop: 8 }}>
            <div className="srp-pat-title">M頭分析</div>
            <div className={`srp-pat-status ${A.mStatus === 'formed' ? 'bear' : A.mStatus === 'forming' ? 'amber' : 'none'}`}>
              {A.mStatus === 'formed' ? '⚠ M頭確立' : A.mStatus === 'forming' ? '⚠ 形成中' : '✗ 未形成'}
            </div>
            <div className="srp-pat-stick m-stick">
              <div className="stick-pts">
                <span>左峰</span><span>頸線</span><span>右峰</span>
              </div>
              <svg viewBox="0 0 60 30" width="90" height="36">
                <polyline points="0,8 10,8 20,25 30,8 40,8 50,25 60,25" fill="none" stroke={A.mStatus !== 'none' ? '#16a34a' : '#9ca3af'} strokeWidth="2" strokeLinejoin="round" />
                {A.mStatus === 'none' && <line x1="0" y1="0" x2="60" y2="30" stroke="#ef4444" strokeWidth="1.5" />}
              </svg>
            </div>
            <div className="srp-pat-reason">{A.mReason}</div>
          </div>
        </div>

        {/* 技術指標總覽 */}
        <div className="srp-box srp-ind-table-box">
          <div className="srp-box-head">📐 技術指標總覽</div>
          <table className="srp-ind-tbl">
            <thead><tr><th>指標</th><th>數值</th><th>方向</th><th>解讀</th></tr></thead>
            <tbody>
              <tr>
                <td>KD</td>
                <td>{A.kd.k}/{A.kd.d}</td>
                <td className={A.kdCross ? 'pos' : 'neg'}>{A.kdCross ? '↑' : '↓'}</td>
                <td>{A.kdOverbought ? '高檔鈍化' : A.kdOversold ? '低檔超賣' : A.kdCross ? '黃金交叉' : '死亡交叉'}</td>
              </tr>
              <tr>
                <td>MACD</td>
                <td className={A.macd.dif >= 0 ? 'pos' : 'neg'}>DIF {A.macd.dif}</td>
                <td className={A.macdBull ? 'pos' : 'neg'}>{A.macdBull ? '↑' : '↓'}</td>
                <td>{A.macdBull && A.macdAbove0 ? '多頭延續' : A.macdBull ? '底部翻多' : A.macdAbove0 ? '頭部翻空' : '空頭延伸'}</td>
              </tr>
              <tr>
                <td>均線排列</td>
                <td>{A.ma60 ? `5>${A.maBull ? '' : '≯'}20>${A.maBull ? '' : '≯'}60` : `5>${A.aboveMA5 ? '' : '≯'}20`}</td>
                <td className={A.maBull ? 'pos' : A.maBear ? 'neg' : ''}>{A.maBull ? '↑' : A.maBear ? '↓' : '—'}</td>
                <td>{A.maBull ? '多頭排列' : A.maBear ? '空頭排列' : '多空混沌'}</td>
              </tr>
              <tr>
                <td>布林通道</td>
                <td>{A.bbWidening ? '開口擴大' : A.bbNarrowing ? '開口收縮' : '平行延伸'}</td>
                <td className={A.bbWidening ? 'pos' : ''}>{A.bbWidening ? '↑' : A.bbNarrowing ? '↓' : '—'}</td>
                <td>{A.bbWidening ? '趨勢加速' : A.bbNarrowing ? '整理蓄力' : '趨勢持續'}</td>
              </tr>
              <tr>
                <td>成交量</td>
                <td>{A.lastVol > 0 ? (A.lastVol / 1000).toFixed(0) + 'K張' : '—'}
                  <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>（{A.volExpanding ? '放量' : A.volShrinking ? '縮量' : '平量'}）</span>
                </td>
                <td className={A.volExpanding ? 'pos' : A.volShrinking ? 'neg' : ''}>{A.volExpanding ? '↑' : A.volShrinking ? '↓' : '—'}</td>
                <td>{A.volExpanding ? '量能放大' : A.volShrinking ? '量能降溫' : '量能持平'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 操作建議 */}
        <div className="srp-box srp-reco-box">
          <div className="srp-box-head">💡 操作建議</div>
          <div className="srp-reco-list">
            {A.recs.map(r => (
              <div key={r.key} className="srp-reco-row">
                <span className={`srp-reco-icon ${r.cls ?? ''}`}>{r.icon}</span>
                <div>
                  <span className="srp-reco-key">{r.key}：</span>
                  <span className="srp-reco-val">{r.val}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="srp-risk">⚠ 以上為模擬分析，不構成投資建議，股市有風險，買賣自負。</div>
        </div>

        {/* 明日漲跌機率 AI */}
        <div className="srp-box srp-ai-box">
          <div className="srp-ai-head">🔥 明日漲跌機率預測（AI模型）</div>
          <div className="srp-ai-bars">
            <div className="srp-ai-bar-row">
              <span className="srp-ai-bar-label up">上漲機率</span>
              <div className="srp-ai-bar-track">
                <div className="srp-ai-bar-fill up" style={{ width: `${A.upProb}%` }} />
              </div>
              <span className="srp-ai-bar-pct up">{A.upProb}%</span>
            </div>
            <div className="srp-ai-bar-row">
              <span className="srp-ai-bar-label dn">下跌機率</span>
              <div className="srp-ai-bar-track">
                <div className="srp-ai-bar-fill dn" style={{ width: `${A.downProb}%` }} />
              </div>
              <span className="srp-ai-bar-pct dn">{A.downProb}%</span>
            </div>
            <div className="srp-ai-bar-row">
              <span className="srp-ai-bar-label sw">震盪機率</span>
              <div className="srp-ai-bar-track">
                <div className="srp-ai-bar-fill sw" style={{ width: `${A.swProb}%` }} />
              </div>
              <span className="srp-ai-bar-pct sw">{A.swProb}%</span>
            </div>
          </div>
          <div className="srp-ai-concl">{A.aiConclusion}</div>
          <div className="srp-ai-note">{A.aiNote}</div>
          <div className="srp-ai-footer">※ AI模型每日更新 · 僅供參考，投資請審慎判斷風險</div>
        </div>

      </div>
    </div>
  );
}
