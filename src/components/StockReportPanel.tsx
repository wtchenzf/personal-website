/**
 * StockReportPanel — 個股綜合分析報告
 * 3 欄: 技術面分析 | 籌碼面分析 | 操作建議
 */
import { useMemo } from 'react';
import type { ChipBar } from './SmartMoneyChart';
import type { OHLCBar } from './MiniKLineChart';
import './StockReportPanel.css';

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  code:      string;
  name:      string;
  price:     number;
  changePct: number;
  signal:    number;   // 0–100 from SMART_MONEY
  sector:    string;
  data:      (OHLCBar & { volume?: number })[];
  chips:     ChipBar[];
}

// ── PRNG (same variant as SmartMoneyChart) ─────────────────────────────────────

function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

// ── Technical indicators ───────────────────────────────────────────────────────

function calcMA(data: OHLCBar[], n: number): number[] {
  return data.map((_, i) => {
    if (i < n - 1) return NaN;
    return +(data.slice(i - n + 1, i + 1).reduce((s, d) => s + d.close, 0) / n).toFixed(2);
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
    const rs = l === 0 ? 100 : g / l;
    result[i] = +(100 - 100 / (1 + rs)).toFixed(1);
  }
  return result;
}

function calcKD(data: OHLCBar[], period = 9): { k: number; d: number }[] {
  const result: { k: number; d: number }[] = new Array(data.length).fill({ k: 50, d: 50 });
  let k = 50, d = 50;
  for (let i = period - 1; i < data.length; i++) {
    const sl  = data.slice(i - period + 1, i + 1);
    const lo  = Math.min(...sl.map(x => x.low));
    const hi  = Math.max(...sl.map(x => x.high));
    const rsv = hi === lo ? 50 : (data[i].close - lo) / (hi - lo) * 100;
    k = k * 2 / 3 + rsv / 3;
    d = d * 2 / 3 + k   / 3;
    result[i] = { k: +k.toFixed(1), d: +d.toFixed(1) };
  }
  return result;
}

function calcMACD(data: OHLCBar[]): { dif: number; dem: number; osc: number }[] {
  const ema = (arr: number[], n: number) => {
    const kk = 2 / (n + 1); let e = arr[0];
    return arr.map(v => { e = v * kk + e * (1 - kk); return +e.toFixed(3); });
  };
  const c   = data.map(d => d.close);
  const e12 = ema(c, 12), e26 = ema(c, 26);
  const dif = e12.map((v, i) => +(v - e26[i]).toFixed(3));
  const dem = ema(dif, 9);
  const osc = dif.map((v, i) => +(v - dem[i]).toFixed(3));
  return data.map((_, i) => ({ dif: dif[i], dem: dem[i], osc: osc[i] }));
}

/** Derive 外資 / 投信 / 自營商 split from aggregate chip stream */
function deriveInstSplit(chips: ChipBar[], seed: number) {
  const rf = mkRng(seed);
  const rt = mkRng(seed ^ 0x7777);
  const foreign = chips.map(c => {
    const base  = c.value * (0.52 + rf() * 0.20);
    const noise = (rf() - 0.5) * Math.abs(c.value) * 0.15;
    return Math.round(base + noise);
  });
  const trust = chips.map(c => {
    const base  = c.value * (0.12 + rt() * 0.16);
    const noise = (rt() - 0.5) * Math.abs(c.value) * 0.20;
    return Math.round(base + noise);
  });
  const dealer = chips.map((c, i) => Math.round((c.value - foreign[i] - trust[i]) * 0.38));
  return { foreign, trust, dealer };
}

// ── Signal type ────────────────────────────────────────────────────────────────

type SigType = 'strong-buy' | 'buy' | 'watch' | 'neutral' | 'sell';

function getSigType(signal: number): SigType {
  if (signal >= 90) return 'strong-buy';
  if (signal >= 80) return 'buy';
  if (signal >= 65) return 'watch';
  if (signal >= 50) return 'neutral';
  return 'sell';
}

const SIG_META: Record<SigType, { label: string; color: string; bg: string; advice: string }> = {
  'strong-buy': {
    label: '強力買進',
    color: '#fff',
    bg: 'linear-gradient(135deg,#c0392b,#e74c3c)',
    advice: '多項指標高度共振，法人籌碼持續堆疊，技術面突破確立。具備短中期追漲條件，可積極佈局分批買進，嚴設停損。',
  },
  'buy': {
    label: '積極買進',
    color: '#fff',
    bg: 'linear-gradient(135deg,#e07b39,#f39c12)',
    advice: '技術面走勢強勁，籌碼集中趨勢明確。建議逢低分批建立部位，若量能維持可持續加碼，注意壓力位。',
  },
  'watch': {
    label: '觀察佈局',
    color: '#7c5000',
    bg: 'linear-gradient(135deg,#f1c40f,#f9d71c)',
    advice: '股價趨勢偏多，但尚未出現明確突破訊號。可先小量佈局試水溫，待量能確認後再加碼，勿急於追高。',
  },
  'neutral': {
    label: '中性觀望',
    color: '#fff',
    bg: 'linear-gradient(135deg,#6b7280,#9ca3af)',
    advice: '多空訊號混沌，籌碼方向尚不明確，建議暫時觀望，等待明確的方向選擇後再行動。',
  },
  'sell': {
    label: '謹慎回避',
    color: '#fff',
    bg: 'linear-gradient(135deg,#374151,#4b5563)',
    advice: '技術面轉弱，籌碼鬆動跡象，不建議追高介入，持有部位可設停損保護，等待合理回檔整理。',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtChip(v: number): string {
  if (Math.abs(v) >= 1000) return (v >= 0 ? '+' : '') + (v / 1000).toFixed(1) + 'K';
  return (v >= 0 ? '+' : '') + v.toString();
}

function Stars({ n, max = 5, color = '#f59e0b' }: { n: number; max?: number; color?: string }) {
  return (
    <span className="srp-stars">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < n ? color : '#d1d5db', fontSize: '14px' }}>★</span>
      ))}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StockReportPanel({
  code, name, price, changePct, signal, sector, data, chips,
}: Props) {

  const A = useMemo(() => {
    if (!data.length || !chips.length) return null;

    // ── Technical indicators ──
    const n = data.length;
    const ma5Arr  = calcMA(data, 5);
    const ma20Arr = calcMA(data, 20);
    const ma60Arr = calcMA(data, 60);
    const rsiArr  = calcRSI(data, 14);
    const kdArr   = calcKD(data, 9);
    const macdArr = calcMACD(data);

    // Last valid values
    const ma5   = ma5Arr[n - 1];
    const ma20  = ma20Arr[n - 1];
    const ma60r = ma60Arr[n - 1];
    const ma60  = isNaN(ma60r) ? null : ma60r;   // null when < 60 bars
    const rsi   = isNaN(rsiArr[n - 1]) ? rsiArr.find(v => !isNaN(v)) ?? 50 : rsiArr[n - 1];
    const kd    = kdArr[n - 1];
    const macd  = macdArr[n - 1];

    // MA position signals
    const aboveMA5  = price > ma5;
    const aboveMA20 = price > ma20;
    const aboveMA60 = ma60 !== null ? price > ma60 : null;

    // RSI zone
    const rsiZone: 'overbought' | 'bullish' | 'neutral' | 'oversold' =
      rsi >= 70 ? 'overbought' : rsi >= 50 ? 'bullish' : rsi >= 30 ? 'neutral' : 'oversold';

    // KD
    const kdCross      = kd.k > kd.d;
    const kdOverbought = kd.k > 80;
    const kdOversold   = kd.k < 20;

    // MACD
    const macdBull   = macd.dif > macd.dem;
    const macdAbove0 = macd.dif > 0;

    // Technical star score (0–8)
    const techScore =
      (aboveMA5  ? 1 : 0) +
      (aboveMA20 ? 1 : 0) +
      (aboveMA60 === true ? 1 : 0) +
      (kdCross && !kdOverbought ? 2 : kdCross ? 1 : 0) +
      (macdBull && macdAbove0 ? 2 : macdBull ? 1 : 0) +
      (rsi >= 50 && rsi < 70 ? 1 : 0);
    const techStars = Math.min(5, Math.max(1, Math.round(techScore * 5 / 8)));

    // ── Chip analysis ──
    const seed = parseInt(code);
    const { foreign, trust, dealer } = deriveInstSplit(chips, seed);
    const window10 = Math.min(10, chips.length);

    const chipLast10    = chips.slice(-window10);
    const foreignLast10 = foreign.slice(-window10);
    const trustLast10   = trust.slice(-window10);
    const dealerLast10  = dealer.slice(-window10);

    // 5-day sums
    const chip5 = chips.slice(-5).reduce((s, c) => s + c.value, 0);
    const for5  = foreign.slice(-5).reduce((s, v) => s + v, 0);
    const tru5  = trust.slice(-5).reduce((s, v) => s + v, 0);
    const deal5 = dealer.slice(-5).reduce((s, v) => s + v, 0);

    // Cumulative
    const chipTotal = chips.reduce((s, c) => s + c.value, 0);
    const forTotal  = foreign.reduce((s, v) => s + v, 0);
    const truTotal  = trust.reduce((s, v) => s + v, 0);

    // Buy-day counts (last 10)
    const chipBuyDays = chipLast10.filter(c => c.value > 0).length;
    const forBuyDays  = foreignLast10.filter(v => v > 0).length;
    const truBuyDays  = trustLast10.filter(v => v > 0).length;

    // Chip stars
    const chipStars = Math.min(5, Math.max(1,
      chipBuyDays >= 8 ? 5 :
      chipBuyDays >= 6 ? 4 :
      chipBuyDays >= 4 ? 3 :
      chipBuyDays >= 2 ? 2 : 1
    ));

    // Bar chart scale
    const barMax = Math.max(...chipLast10.map(c => Math.abs(c.value)), 1);

    // ── Key price levels ──
    const support1 = +ma5.toFixed(1);
    const support2 = +ma20.toFixed(1);
    const recentHigh = Math.max(...data.slice(-5).map(d => d.high));
    const resist1    = +recentHigh.toFixed(1);
    const resist2    = +(price * 1.10).toFixed(1);

    // ── Summary stars ──
    const trendStars = Math.min(5, Math.max(1, Math.round(signal / 20)));
    const diffStars  = price > 2000 ? 5 : price > 1000 ? 4 : price > 300 ? 3 : 2;

    return {
      ma5, ma20, ma60,
      aboveMA5, aboveMA20, aboveMA60,
      rsi, rsiZone,
      kd, kdCross, kdOverbought, kdOversold,
      macd, macdBull, macdAbove0,
      techStars,
      chipLast10, foreignLast10, trustLast10, dealerLast10,
      chip5, for5, tru5, deal5,
      chipTotal, forTotal, truTotal,
      chipBuyDays, forBuyDays, truBuyDays,
      chipStars, barMax,
      support1, support2, resist1, resist2,
      trendStars, diffStars,
    };
  }, [data, chips, code, price, signal]);

  if (!A) return null;

  const sigType = getSigType(signal);
  const sigMeta = SIG_META[sigType];
  const isUp    = changePct >= 0;
  const dateEnd = chips.at(-1)?.time.slice(5).replace('-', '/') ?? '';

  return (
    <div className="srp-wrap">

      {/* ── Title bar ── */}
      <div className="srp-title-bar">
        <span className="srp-title-code">{code}</span>
        <span className="srp-title-name">{name}</span>
        <span className="srp-title-sector">{sector}</span>
        <span className="srp-title-price">
          {price.toLocaleString()}
          <span className={`srp-title-chg ${isUp ? 'up' : 'dn'}`}>
            &nbsp;{isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
          </span>
        </span>
        <span className="srp-title-date">截至 {dateEnd}</span>
      </div>

      <div className="srp-grid">

        {/* ════════════════════════════════════════
            LEFT — 技術面分析
            ════════════════════════════════════════ */}
        <div className="srp-col">
          <div className="srp-col-head">📐 技術面分析</div>

          {/* MA position */}
          <div className="srp-section">
            <div className="srp-section-lbl">均線位置</div>
            <table className="srp-table">
              <tbody>
                {([
                  ['MA5',  A.ma5,  A.aboveMA5],
                  ['MA20', A.ma20, A.aboveMA20],
                  ['MA60', A.ma60, A.aboveMA60],
                ] as [string, number | null, boolean | null][]).map(([label, val, above]) => (
                  <tr key={label}>
                    <td className="srt-lbl">{label}</td>
                    <td className="srt-val">{val !== null ? val.toLocaleString() : '—'}</td>
                    <td className={`srt-status ${above === true ? 'pos' : above === false ? 'neg' : 'neutral'}`}>
                      {above === null ? '資料不足' : above ? '▲ 站上' : '▼ 跌破'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* RSI gauge */}
          <div className="srp-section">
            <div className="srp-section-lbl">
              RSI (14)&nbsp;=&nbsp;
              <b style={{ color: A.rsi >= 70 ? '#c0392b' : A.rsi < 30 ? '#16a34a' : '#e07b39' }}>
                {A.rsi}
              </b>
              <span className="srp-rsi-zone-badge" data-zone={A.rsiZone}>
                {A.rsiZone === 'overbought' ? '超買' : A.rsiZone === 'bullish' ? '多頭' :
                 A.rsiZone === 'neutral' ? '中性' : '超賣'}
              </span>
            </div>
            <div className="srp-rsi-wrap">
              <div className="srp-rsi-track">
                <div className="srp-rsi-seg seg-oversold" />
                <div className="srp-rsi-seg seg-neutral"  />
                <div className="srp-rsi-seg seg-bullish"  />
                <div className="srp-rsi-seg seg-overbought" />
                <div className="srp-rsi-needle" style={{ left: `${Math.min(98, Math.max(2, A.rsi))}%` }} />
              </div>
              <div className="srp-rsi-axis">
                <span>0</span><span>30</span><span>50</span><span>70</span><span>100</span>
              </div>
            </div>
          </div>

          {/* KD */}
          <div className="srp-section">
            <div className="srp-section-lbl">KD (9, 3, 3)</div>
            <div className="srp-kd-row">
              <div className="srp-ind-pill">
                <span className="srp-ind-key">K</span>
                <span className="srp-ind-val">{A.kd.k}</span>
              </div>
              <div className="srp-ind-pill">
                <span className="srp-ind-key">D</span>
                <span className="srp-ind-val">{A.kd.d}</span>
              </div>
              <span className={`srp-cross-badge ${A.kdCross ? 'gold' : 'dead'}`}>
                {A.kdCross ? '黃金交叉' : '死亡交叉'}
              </span>
              {A.kdOverbought && <span className="srp-warn-badge">⚠ 過買</span>}
              {A.kdOversold   && <span className="srp-info-badge">◎ 超賣</span>}
            </div>
          </div>

          {/* MACD */}
          <div className="srp-section">
            <div className="srp-section-lbl">MACD (12, 26, 9)</div>
            <div className="srp-kd-row">
              <div className="srp-ind-pill">
                <span className="srp-ind-key">DIF</span>
                <span className={`srp-ind-val ${A.macd.dif >= 0 ? 'pos' : 'neg'}`}>{A.macd.dif}</span>
              </div>
              <div className="srp-ind-pill">
                <span className="srp-ind-key">DEA</span>
                <span className={`srp-ind-val ${A.macd.dem >= 0 ? 'pos' : 'neg'}`}>{A.macd.dem}</span>
              </div>
              <span className={`srp-cross-badge ${A.macdBull ? 'gold' : 'dead'}`}>
                {A.macdBull
                  ? (A.macdAbove0 ? '零軸上多頭' : '底部翻多')
                  : (A.macdAbove0 ? '頭部翻空'   : '零軸下空頭')}
              </span>
            </div>
          </div>

          {/* Technical conclusion */}
          <div className="srp-conclusion">
            <div className="srp-concl-lbl">技術面綜評</div>
            <div className="srp-concl-row">
              <Stars n={A.techStars} color="#e07b39" />
              <span className="srp-star-desc">
                {(['', '偏弱', '略弱', '中性', '偏強', '強勢'] as const)[A.techStars]}
              </span>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            MIDDLE — 籌碼面分析
            ════════════════════════════════════════ */}
        <div className="srp-col">
          <div className="srp-col-head">💰 籌碼面分析</div>

          {/* 10-day diverging bar chart */}
          <div className="srp-section">
            <div className="srp-section-lbl">近10日主力買賣超（張）</div>
            <div className="srp-chart">
              {A.chipLast10.map((c) => {
                const pct  = (Math.abs(c.value) / A.barMax) * 100;
                const isPos = c.value >= 0;
                return (
                  <div key={c.time} className="srp-bar-row">
                    <span className="srp-bar-date">{c.time.slice(5).replace('-', '/')}</span>
                    <div className="srp-bar-neg-half">
                      {!isPos && (
                        <div className="srp-bar-fill neg" style={{ width: `${pct}%` }} />
                      )}
                    </div>
                    <div className="srp-bar-axis" />
                    <div className="srp-bar-pos-half">
                      {isPos && (
                        <div className="srp-bar-fill pos" style={{ width: `${pct}%` }} />
                      )}
                    </div>
                    <span className={`srp-bar-val ${isPos ? 'pos' : 'neg'}`}>{fmtChip(c.value)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 三大法人 table */}
          <div className="srp-section">
            <div className="srp-section-lbl">三大法人買賣超（張）</div>
            <table className="srp-chip-table">
              <thead>
                <tr>
                  <th>法人</th>
                  <th>近5日</th>
                  <th>累計</th>
                  <th>買超日/10</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="srp-inst-lbl">🌐 外資</td>
                  <td className={A.for5  >= 0 ? 'pos' : 'neg'}>{fmtChip(A.for5)}</td>
                  <td className={A.forTotal >= 0 ? 'pos' : 'neg'}>{fmtChip(A.forTotal)}</td>
                  <td className="srp-days">{A.forBuyDays}<span>/10</span></td>
                </tr>
                <tr>
                  <td className="srp-inst-lbl">🏛 投信</td>
                  <td className={A.tru5  >= 0 ? 'pos' : 'neg'}>{fmtChip(A.tru5)}</td>
                  <td className={A.truTotal >= 0 ? 'pos' : 'neg'}>{fmtChip(A.truTotal)}</td>
                  <td className="srp-days">{A.truBuyDays}<span>/10</span></td>
                </tr>
                <tr>
                  <td className="srp-inst-lbl">🏢 自營商</td>
                  <td className={A.deal5 >= 0 ? 'pos' : 'neg'}>{fmtChip(A.deal5)}</td>
                  <td className="srp-neutral">—</td>
                  <td className="srp-neutral">—</td>
                </tr>
                <tr className="srp-total-row">
                  <td>合計</td>
                  <td className={A.chip5 >= 0 ? 'pos' : 'neg'}>{fmtChip(A.chip5)}</td>
                  <td className={A.chipTotal >= 0 ? 'pos' : 'neg'}>{fmtChip(A.chipTotal)}</td>
                  <td className="srp-days">{A.chipBuyDays}<span>/10</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Chip conclusion */}
          <div className="srp-conclusion">
            <div className="srp-concl-lbl">籌碼面綜評</div>
            <div className="srp-concl-row">
              <Stars n={A.chipStars} color="#3b82f6" />
              <span className="srp-star-desc">
                {(['', '籌碼鬆散', '略有集中', '籌碼穩定', '集中偏高', '高度集中'] as const)[A.chipStars]}
              </span>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            RIGHT — 操作建議
            ════════════════════════════════════════ */}
        <div className="srp-col">
          <div className="srp-col-head">🎯 操作建議</div>

          {/* Signal badge */}
          <div className="srp-sig-wrap">
            <div className="srp-sig-badge" style={{ background: sigMeta.bg, color: sigMeta.color }}>
              <div className="srp-sig-score">{signal}</div>
              <div className="srp-sig-label">{sigMeta.label}</div>
              <div className="srp-sig-sub">綜合訊號</div>
            </div>
          </div>

          {/* Advice */}
          <div className="srp-advice">{sigMeta.advice}</div>

          {/* Key price levels */}
          <div className="srp-section">
            <div className="srp-section-lbl">關鍵價位參考</div>
            <div className="srp-levels">
              <div className="srp-level-item support">
                <div className="srp-level-tag">🟢 支撐1</div>
                <div className="srp-level-val">{A.support1.toLocaleString()}</div>
                <div className="srp-level-sub">MA5</div>
              </div>
              <div className="srp-level-item support2">
                <div className="srp-level-tag">🟩 支撐2</div>
                <div className="srp-level-val">{A.support2.toLocaleString()}</div>
                <div className="srp-level-sub">MA20</div>
              </div>
              <div className="srp-level-item resist">
                <div className="srp-level-tag">🔴 壓力1</div>
                <div className="srp-level-val">{A.resist1.toLocaleString()}</div>
                <div className="srp-level-sub">近5日高點</div>
              </div>
              <div className="srp-level-item resist2">
                <div className="srp-level-tag">🟥 壓力2</div>
                <div className="srp-level-val">{A.resist2.toLocaleString()}</div>
                <div className="srp-level-sub">+10% 目標</div>
              </div>
            </div>
          </div>

          {/* Star ratings */}
          <div className="srp-section">
            <div className="srp-section-lbl">綜合評分</div>
            <div className="srp-ratings">
              {[
                { label: '技術面', n: A.techStars,   color: '#e07b39' },
                { label: '籌碼面', n: A.chipStars,   color: '#3b82f6' },
                { label: '股價趨勢', n: A.trendStars, color: '#8b5cf6' },
                { label: '操作難度', n: A.diffStars,  color: '#6b7280' },
              ].map(r => (
                <div key={r.label} className="srp-rating-row">
                  <span className="srp-rating-lbl">{r.label}</span>
                  <Stars n={r.n} color={r.color} />
                </div>
              ))}
            </div>
          </div>

          {/* Risk disclaimer */}
          <div className="srp-risk">
            ⚠ 本報告為高擬真模擬數據，僅供學習參考，不構成任何投資建議。股市有風險，買賣自負。
          </div>
        </div>

      </div>
    </div>
  );
}
