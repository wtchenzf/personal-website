/**
 * SmartMoneyChart — 大戶連買追蹤 K 線圖（5 分頁）
 * 頂部：K 線 (MA5/MA20/MA60) + OHLC legend (crosshair 即時更新)
 * 分頁：① 成交量·主力  ② KD·MACD·RSI  ③ 外資·投信
 *       ④ 大戶·散戶持股  ⑤ 融資·融券
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart, ColorType,
  CandlestickSeries, LineSeries, HistogramSeries,
} from 'lightweight-charts';
import type { OHLCBar } from './MiniKLineChart';
import './SmartMoneyChart.css';

// ── Public types ───────────────────────────────────────────────────────────────

export interface ChipBar { time: string; value: number; color: string; }

interface Props { code: string; name: string; data: OHLCBar[]; chips: ChipBar[]; }

// ── Chart tab config ───────────────────────────────────────────────────────────

type ChartTab = 'chip' | 'tech' | 'inst' | 'holder' | 'margin';

const TABS: { key: ChartTab; label: string }[] = [
  { key: 'chip',   label: '成交量・主力' },
  { key: 'tech',   label: 'KD・MACD・RSI' },
  { key: 'inst',   label: '外資・投信' },
  { key: 'holder', label: '大戶・散戶' },
  { key: 'margin', label: '融資・融券' },
];

// ── Shared chart layout ────────────────────────────────────────────────────────

const LAYOUT = {
  background: { type: ColorType.Solid, color: 'transparent' },
  textColor: '#6b7280',
  fontFamily: "'Inter', 'Noto Sans TC', sans-serif",
  fontSize: 10,
};
const GRID = { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } };

function subChart(el: HTMLDivElement, h: number, timeVisible = false) {
  return createChart(el, {
    layout: LAYOUT, grid: GRID,
    width: el.clientWidth, height: h,
    timeScale: { visible: timeVisible, borderColor: '#e5e7eb' },
    rightPriceScale: { borderColor: '#e5e7eb' },
  });
}

// ── Technical indicator helpers ────────────────────────────────────────────────

function calcMA(data: OHLCBar[], n: number) {
  return data.slice(n - 1).map((_, i) => ({
    time:  data[i + n - 1].time,
    value: +(data.slice(i, i + n).reduce((s, d) => s + d.close, 0) / n).toFixed(2),
  }));
}

function calcKD(data: OHLCBar[], period = 9) {
  const res: { time: string; k: number; d: number }[] = [];
  let k = 50, d = 50;
  for (let i = period - 1; i < data.length; i++) {
    const sl  = data.slice(i - period + 1, i + 1);
    const lo  = Math.min(...sl.map(x => x.low));
    const hi  = Math.max(...sl.map(x => x.high));
    const rsv = hi === lo ? 50 : (data[i].close - lo) / (hi - lo) * 100;
    k = k * 2 / 3 + rsv / 3;
    d = d * 2 / 3 + k   / 3;
    res.push({ time: data[i].time, k: +k.toFixed(2), d: +d.toFixed(2) });
  }
  return res;
}

function calcMACD(data: OHLCBar[]) {
  const ema = (arr: number[], n: number) => {
    const k = 2 / (n + 1); let e = arr[0];
    return arr.map(v => { e = v * k + e * (1 - k); return +e.toFixed(3); });
  };
  const c   = data.map(d => d.close);
  const e12 = ema(c, 12), e26 = ema(c, 26);
  const dif = e12.map((v, i) => +(v - e26[i]).toFixed(3));
  const dem = ema(dif, 9);
  const osc = dif.map((v, i) => +(v - dem[i]).toFixed(3));
  return data.map((d, i) => ({ time: d.time, dif: dif[i], dem: dem[i], osc: osc[i] }));
}

function calcRSI(data: OHLCBar[], period = 14) {
  const res: { time: string; value: number }[] = [];
  for (let i = period; i < data.length; i++) {
    let g = 0, l = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = data[j].close - data[j - 1].close;
      d > 0 ? g += d : l -= d;
    }
    const rs = l === 0 ? 100 : g / l;
    res.push({ time: data[i].time, value: +(100 - 100 / (1 + rs)).toFixed(2) });
  }
  return res;
}

// ── Synthetic derived data ─────────────────────────────────────────────────────

function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

/** Split chips into foreign / trust streams with independent daily noise */
function deriveInst(chips: ChipBar[], seed: number) {
  const rf = mkRng(seed);
  const rt = mkRng(seed ^ 0x7777);
  const foreign = chips.map(c => {
    // Foreign: 50-72% of chip signal + slight independent noise
    const base = c.value * (0.52 + rf() * 0.20);
    const noise = (rf() - 0.5) * Math.abs(c.value) * 0.15;
    const v = Math.round(base + noise);
    return { time: c.time, value: v, color: v >= 0 ? '#c0392b' : '#4a7c59' };
  });
  const trust = chips.map(c => {
    // Trust: 12-28% of chip signal + independent noise (can lag/diverge)
    const base = c.value * (0.12 + rt() * 0.16);
    const noise = (rt() - 0.5) * Math.abs(c.value) * 0.20;
    const v = Math.round(base + noise);
    return { time: c.time, value: v, color: v >= 0 ? '#c0392b' : '#4a7c59' };
  });
  return { foreign, trust };
}

/**
 * 大戶/散戶持股比率 — TDCC weekly-cadence simulation
 * Every 5 bars: ±2–5 % swing driven by net chip signal
 * Daily: small noise ±0.3 % to avoid flat look
 */
function deriveHolder(chips: ChipBar[], baseBig: number, seed: number) {
  const r = mkRng(seed ^ 0x1234);
  let bigPct = baseBig;

  return chips.map((c, i) => {
    if (i % 5 === 4) {
      // Weekly update: look at net buying over past 5 days
      const slice  = chips.slice(Math.max(0, i - 4), i + 1);
      const netBuy = slice.reduce((s, b) => s + (b.value > 0 ? 1 : -1), 0);
      const trend  = netBuy / 5;                          // –1 … +1
      const delta  = trend * (2 + r() * 3) + (r() - 0.5) * 1.5;
      bigPct = Math.min(Math.max(bigPct + delta, baseBig - 10), Math.min(baseBig + 22, 88));
    } else {
      // Daily micro-drift
      bigPct += (r() - 0.48) * 0.6;   // slight upward bias for accumulation stocks
      bigPct = Math.min(Math.max(bigPct, baseBig - 10), Math.min(baseBig + 22, 88));
    }
    const small = Math.max(100 - bigPct - 16 - r() * 6, 4);
    return { time: c.time, big: +bigPct.toFixed(2), small: +small.toFixed(2) };
  });
}

/**
 * 融資/融券/券資比 — realistic daily swings
 * Margin follows price trend; short inverse; 券資比 reflects squeeze dynamics
 */
function deriveMargin(data: OHLCBar[], seed: number) {
  const r     = mkRng(seed ^ 0xabcd);
  // Scale base to data length so chart fills ~25–60% of y-range
  const base  = 2000 + r() * 5000;
  const sBase = 300  + r() * 900;
  let margin = base, short = sBase;

  return data.map(d => {
    const open  = d.open  || d.close;
    const pchg  = (d.close - open) / open;          // today's candle return
    const noise = (r() - 0.5) * 0.07;               // ±3.5 % daily noise

    // Margin increases on up days (retail piles in), falls on down days
    const mDelta = pchg * 1.2 + noise;
    margin = Math.max(margin * (1 + mDelta), base * 0.25);

    // Short shrinks on up days (short squeeze), grows on down days
    const sDelta = -pchg * 0.7 + (r() - 0.5) * 0.06;
    short  = Math.max(short  * (1 + sDelta), sBase * 0.15);

    const ratio = short / margin * 100;
    return {
      time:   d.time,
      margin: Math.round(margin),
      short:  Math.round(short),
      ratio:  +ratio.toFixed(2),
    };
  });
}

// ── Hovered legend state ───────────────────────────────────────────────────────

interface HovBar {
  time: string;
  open: number; high: number; low: number; close: number;
  volume: number; chipVal: number;
  ma5?: number; ma20?: number; ma60?: number;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SmartMoneyChart({ code, name, data, chips }: Props) {
  // ── Refs ─────────────────────────────────────────────────────────────────────
  const mainRef = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<ReturnType<typeof createChart> | null>(null);

  // Tab 1 — chip
  const volRef   = useRef<HTMLDivElement>(null);
  const chipRef  = useRef<HTMLDivElement>(null);
  // Tab 2 — tech
  const kdRef    = useRef<HTMLDivElement>(null);
  const macdRef  = useRef<HTMLDivElement>(null);
  const rsiRef   = useRef<HTMLDivElement>(null);
  // Tab 3 — inst
  const fgnRef   = useRef<HTMLDivElement>(null);
  const trstRef  = useRef<HTMLDivElement>(null);
  // Tab 4 — holder
  const bigRef   = useRef<HTMLDivElement>(null);
  const smlRef   = useRef<HTMLDivElement>(null);
  // Tab 5 — margin
  const mrgnRef  = useRef<HTMLDivElement>(null);
  const shrtRef  = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────────────────────
  const [chartTab, setChartTab] = useState<ChartTab>('chip');
  const [hov, setHov] = useState<HovBar | null>(null);

  // ── Pre-computed indicators ────────────────────────────────────────────────────
  const ma5d  = useMemo(() => calcMA(data, 5),  [data]);
  const ma20d = useMemo(() => calcMA(data, 20), [data]);
  const ma60d = useMemo(() => calcMA(data, 60), [data]);
  const kdd   = useMemo(() => calcKD(data),   [data]);
  const macdd = useMemo(() => calcMACD(data), [data]);
  const rsid  = useMemo(() => calcRSI(data),  [data]);

  // ── Derived data (memoized) ────────────────────────────────────────────────────
  const codeSeed = useMemo(() => code.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7), [code]);
  const instd    = useMemo(() => deriveInst(chips, codeSeed),         [chips, codeSeed]);
  const holderd  = useMemo(() => {
    const baseBig = 55 + (codeSeed % 20);
    return deriveHolder(chips, baseBig, codeSeed);
  }, [chips, codeSeed]);
  const margind  = useMemo(() => deriveMargin(data, codeSeed), [data, codeSeed]);

  // ── Lookup maps ───────────────────────────────────────────────────────────────
  const volMap  = useMemo(() => new Map((data as any[]).map(d => [d.time, d.volume ?? 0])), [data]);
  const chipMap = useMemo(() => new Map(chips.map(c => [c.time, c.value])), [chips]);
  const ma5m    = useMemo(() => new Map(ma5d.map(d  => [d.time, d.value])), [ma5d]);
  const ma20m   = useMemo(() => new Map(ma20d.map(d => [d.time, d.value])), [ma20d]);
  const ma60m   = useMemo(() => new Map(ma60d.map(d => [d.time, d.value])), [ma60d]);

  // ── Legend data (hovered or last bar) ──────────────────────────────────────────
  const last = data.at(-1);
  const disp: HovBar = hov ?? {
    time:    last?.time  ?? '',
    open:    last?.open  ?? 0, high: last?.high ?? 0,
    low:     last?.low   ?? 0, close: last?.close ?? 0,
    volume:  volMap.get(last?.time ?? '')  ?? 0,
    chipVal: chipMap.get(last?.time ?? '') ?? 0,
    ma5:  ma5d.at(-1)?.value,
    ma20: ma20d.at(-1)?.value,
    ma60: ma60d.at(-1)?.value,
  };
  const legUp = disp.close >= disp.open;
  const fmt   = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: n < 100 ? 2 : 0, maximumFractionDigits: 2 });

  // ════════════════════════════════════════════════════════════════════════
  // EFFECT 1 — Main K-line chart (stable, only rebuilds when data changes)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!mainRef.current || !data.length) return;

    const main = createChart(mainRef.current, {
      layout: LAYOUT, grid: GRID,
      width: mainRef.current.clientWidth, height: 260,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#e5e7eb' },
      rightPriceScale: { borderColor: '#e5e7eb' },
      crosshair: { horzLine: { labelVisible: true }, vertLine: { labelVisible: false } },
    });
    mainChartRef.current = main;

    const candle = main.addSeries(CandlestickSeries, {
      upColor: '#c0392b', downColor: '#4a7c59',
      borderVisible: false, wickUpColor: '#c0392b', wickDownColor: '#4a7c59',
    });
    candle.setData(data as any);

    const lnOpts = { lineWidth: 1 as const, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false };
    main.addSeries(LineSeries, { ...lnOpts, color: '#f1c40f' }).setData(ma5d  as any);
    main.addSeries(LineSeries, { ...lnOpts, color: '#3498db' }).setData(ma20d as any);
    main.addSeries(LineSeries, { ...lnOpts, color: '#e67e22' }).setData(ma60d as any);

    main.subscribeCrosshairMove(param => {
      if (!param.time || !param.point) { setHov(null); return; }
      const t  = String(param.time);
      const cd = param.seriesData.get(candle) as any;
      if (!cd) { setHov(null); return; }
      setHov({ time: t, open: cd.open, high: cd.high, low: cd.low, close: cd.close,
        volume: volMap.get(t) ?? 0, chipVal: chipMap.get(t) ?? 0,
        ma5: ma5m.get(t), ma20: ma20m.get(t), ma60: ma60m.get(t),
      });
    });

    const onResize = () => { if (mainRef.current) main.applyOptions({ width: mainRef.current.clientWidth }); };
    window.addEventListener('resize', onResize);
    main.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', onResize);
      main.remove();
      mainChartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ma5d, ma20d, ma60d]);

  // ════════════════════════════════════════════════════════════════════════
  // EFFECT 2 — Sub-panel charts (rebuilt when chartTab changes)
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const main = mainChartRef.current;
    const subs: ReturnType<typeof createChart>[] = [];

    const syncToMain = (sub: ReturnType<typeof createChart>) => {
      if (!main) return;
      main.timeScale().subscribeVisibleTimeRangeChange(() => {
        const r = main.timeScale().getVisibleLogicalRange();
        if (r) sub.timeScale().setVisibleLogicalRange(r);
      });
    };

    const cumLine = (chart: ReturnType<typeof createChart>, bars: { time: string; value: number }[], color: string) => {
      let cum = 0;
      chart.addSeries(LineSeries, { color, lineWidth: 2, priceScaleId: 'left',
        crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
      }).setData(bars.map(b => { cum += b.value; return { time: b.time, value: cum }; }) as any);
    };

    // ── Tab 1: 成交量 + 主力買賣超 ──────────────────────────────────────────
    if (chartTab === 'chip' && volRef.current && chipRef.current) {
      const vol = subChart(volRef.current, 80);
      vol.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } })
        .setData((data as any[]).map((d: any) => ({
          time: d.time, value: d.volume ?? 0,
          color: d.close >= d.open ? '#c0392b' : '#4a7c59',
        })) as any);
      syncToMain(vol); subs.push(vol);

      const chpChart = subChart(chipRef.current, 110, true);
      chpChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }).setData(chips as any);
      cumLine(chpChart, chips.map(c => ({ time: c.time, value: c.value })), '#1a1a2e');
      syncToMain(chpChart); subs.push(chpChart);
    }

    // ── Tab 2: KD + MACD + RSI ──────────────────────────────────────────────
    if (chartTab === 'tech' && kdRef.current && macdRef.current && rsiRef.current) {
      const kdChart = subChart(kdRef.current, 90);
      kdChart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
        .setData(kdd.map(d => ({ time: d.time, value: d.k })) as any);
      kdChart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
        .setData(kdd.map(d => ({ time: d.time, value: d.d })) as any);
      syncToMain(kdChart); subs.push(kdChart);

      const macdChart = subChart(macdRef.current, 80);
      macdChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } })
        .setData(macdd.map(d => ({ time: d.time, value: d.osc, color: d.osc >= 0 ? '#c0392b' : '#4a7c59' })) as any);
      macdChart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        .setData(macdd.map(d => ({ time: d.time, value: d.dif })) as any);
      macdChart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
        .setData(macdd.map(d => ({ time: d.time, value: d.dem })) as any);
      syncToMain(macdChart); subs.push(macdChart);

      const rsiChart = subChart(rsiRef.current, 90, true);
      rsiChart.addSeries(LineSeries, { color: '#8e44ad', lineWidth: 2, priceLineVisible: false, lastValueVisible: false })
        .setData(rsid as any);
      [[70, '#e74c3c'], [30, '#27ae60']].forEach(([v, c]) =>
        rsiChart.addSeries(LineSeries, { color: c as string, lineWidth: 1,
          priceLineVisible: false, lastValueVisible: false,
          crosshairMarkerVisible: false,
        }).setData(rsid.map(d => ({ time: d.time, value: v as number })) as any)
      );
      syncToMain(rsiChart); subs.push(rsiChart);
    }

    // ── Tab 3: 外資 + 投信 ──────────────────────────────────────────────────
    if (chartTab === 'inst' && fgnRef.current && trstRef.current) {
      const fgnChart = subChart(fgnRef.current, 90);
      fgnChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }).setData(instd.foreign as any);
      cumLine(fgnChart, instd.foreign.map(d => ({ time: d.time, value: d.value })), '#c0392b');
      syncToMain(fgnChart); subs.push(fgnChart);

      const trstChart = subChart(trstRef.current, 110, true);
      trstChart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } }).setData(instd.trust as any);
      cumLine(trstChart, instd.trust.map(d => ({ time: d.time, value: d.value })), '#2980b9');
      syncToMain(trstChart); subs.push(trstChart);
    }

    // ── Tab 4: 大戶持股 + 散戶持股 ──────────────────────────────────────────
    if (chartTab === 'holder' && bigRef.current && smlRef.current) {
      const bigChart = subChart(bigRef.current, 100);
      // Filled area via histogram (always positive values)
      bigChart.addSeries(HistogramSeries, {
        color: 'rgba(231,76,60,0.25)', priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      }).setData(holderd.map(d => ({ time: d.time, value: d.big })) as any);
      bigChart.addSeries(LineSeries, { color: '#c0392b', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true,
        crosshairMarkerVisible: false,
      }).setData(holderd.map(d => ({ time: d.time, value: d.big })) as any);
      syncToMain(bigChart); subs.push(bigChart);

      const smlChart = subChart(smlRef.current, 110, true);
      smlChart.addSeries(HistogramSeries, {
        color: 'rgba(52,152,219,0.2)', priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      }).setData(holderd.map(d => ({ time: d.time, value: d.small })) as any);
      smlChart.addSeries(LineSeries, { color: '#2980b9', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true,
        crosshairMarkerVisible: false,
      }).setData(holderd.map(d => ({ time: d.time, value: d.small })) as any);
      syncToMain(smlChart); subs.push(smlChart);
    }

    // ── Tab 5: 融資 + 融券 + 券資比 ─────────────────────────────────────────
    if (chartTab === 'margin' && mrgnRef.current && shrtRef.current) {
      const mrgnChart = subChart(mrgnRef.current, 90);
      mrgnChart.addSeries(HistogramSeries, {
        color: 'rgba(41,128,185,0.7)', priceFormat: { type: 'volume' },
      }).setData(margind.map(d => ({ time: d.time, value: d.margin, color: 'rgba(41,128,185,0.7)' })) as any);
      mrgnChart.addSeries(LineSeries, { color: '#1a5276', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      }).setData(margind.map(d => ({ time: d.time, value: d.margin })) as any);
      syncToMain(mrgnChart); subs.push(mrgnChart);

      const shrtChart = subChart(shrtRef.current, 110, true);
      shrtChart.addSeries(HistogramSeries, {
        color: 'rgba(142,68,173,0.7)', priceFormat: { type: 'volume' },
      }).setData(margind.map(d => ({ time: d.time, value: d.short, color: 'rgba(142,68,173,0.7)' })) as any);
      // 券資比 as line on secondary scale
      shrtChart.addSeries(LineSeries, { color: '#e74c3c', lineWidth: 2, priceScaleId: 'left',
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      }).setData(margind.map(d => ({ time: d.time, value: d.ratio })) as any);
      syncToMain(shrtChart); subs.push(shrtChart);
    }

    // Resize handler for sub-charts
    const allSubRefs = [volRef, chipRef, kdRef, macdRef, rsiRef, fgnRef, trstRef, bigRef, smlRef, mrgnRef, shrtRef];
    const onResize = () => {
      subs.forEach((ch, i) => {
        const el = allSubRefs[i]?.current ?? allSubRefs.find(r => r.current)?.current;
        if (el) ch.applyOptions({ width: el.clientWidth });
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      subs.forEach(c => c.remove());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartTab, data, chips, kdd, macdd, rsid, instd, holderd, margind]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const latestKD     = kdd.at(-1);
  const latestMACD   = macdd.at(-1);
  const latestRSI5   = rsid.at(-1)?.value;
  const latestFgn    = instd.foreign.at(-1);
  const latestTrst   = instd.trust.at(-1);
  const latestHolder = holderd.at(-1);
  const latestMargin = margind.at(-1);

  return (
    <div className="smc-wrapper">
      {/* ── 5 chart tabs ── */}
      <div className="smc-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`smc-tab ${chartTab === t.key ? 'active' : ''}`}
            onClick={() => setChartTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OHLC + MA legend (crosshair hover) ── */}
      <div className="smc-legend">
        <span className="smc-leg-date">{disp.time.slice(5).replace('-','/')}</span>
        <span className="smc-leg-item">開&thinsp;<span className="smc-leg-val">{fmt(disp.open)}</span></span>
        <span className="smc-leg-item">高&thinsp;<span className={`smc-leg-val ${legUp ? 'cl-up':'cl-down'}`}>{fmt(disp.high)}</span></span>
        <span className="smc-leg-item">低&thinsp;<span className={`smc-leg-val ${legUp ? 'cl-up':'cl-down'}`}>{fmt(disp.low)}</span></span>
        <span className="smc-leg-item">收&thinsp;<span className={`smc-leg-val ${legUp ? 'cl-up':'cl-down'}`}>{fmt(disp.close)}</span></span>
        {disp.ma5  !== undefined && <span className="smc-leg-item"><span className="smc-ma5" >MA5</span>&thinsp;<span className="smc-leg-val">{disp.ma5.toFixed(2)}</span></span>}
        {disp.ma20 !== undefined && <span className="smc-leg-item"><span className="smc-ma20">MA20</span>&thinsp;<span className="smc-leg-val">{disp.ma20.toFixed(2)}</span></span>}
        {disp.ma60 !== undefined && <span className="smc-leg-item"><span className="smc-ma60">MA60</span>&thinsp;<span className="smc-leg-val">{disp.ma60.toFixed(2)}</span></span>}
      </div>

      {/* ── Main K-line (always visible) ── */}
      <div ref={mainRef} className="smc-main" />

      {/* ══ Tab 1: 成交量 + 主力買賣超 ══ */}
      {chartTab === 'chip' && (
        <>
          <div className="smc-sub-label">
            成交量
            <span className="smc-sub-stat">{(disp.volume / 1000).toFixed(1)}K 張</span>
          </div>
          <div ref={volRef} className="smc-sub h80" />
          <div className="smc-sub-label">
            主力買賣超
            <span className={`smc-sub-stat ${disp.chipVal >= 0 ? 'cl-up':'cl-down'}`}>
              {disp.chipVal >= 0 ? '+' : ''}{disp.chipVal.toLocaleString()} 張
            </span>
          </div>
          <div ref={chipRef} className="smc-sub h110" />
        </>
      )}

      {/* ══ Tab 2: KD + MACD + RSI ══ */}
      {chartTab === 'tech' && (
        <>
          <div className="smc-sub-label">
            KD (9)
            {latestKD && <>
              <span className="smc-sub-stat smc-kd-k">K {latestKD.k.toFixed(2)}</span>
              <span className="smc-sub-stat smc-kd-d">D {latestKD.d.toFixed(2)}</span>
            </>}
          </div>
          <div ref={kdRef} className="smc-sub h90" />
          <div className="smc-sub-label">
            MACD (12,26,9)
            {latestMACD && <>
              <span className="smc-sub-stat smc-dif">DIF {latestMACD.dif.toFixed(2)}</span>
              <span className="smc-sub-stat smc-dem">DEM {latestMACD.dem.toFixed(2)}</span>
            </>}
          </div>
          <div ref={macdRef} className="smc-sub h80" />
          <div className="smc-sub-label">
            RSI (14)
            {latestRSI5 !== undefined && <span className="smc-sub-stat smc-rsi">{latestRSI5.toFixed(2)}</span>}
          </div>
          <div ref={rsiRef} className="smc-sub h90" />
        </>
      )}

      {/* ══ Tab 3: 外資 + 投信 ══ */}
      {chartTab === 'inst' && (
        <>
          <div className="smc-sub-label">
            外資買賣超
            {latestFgn && <span className={`smc-sub-stat ${latestFgn.value >= 0 ? 'cl-up':'cl-down'}`}>
              {latestFgn.value >= 0 ? '+' : ''}{latestFgn.value.toLocaleString()} 張
            </span>}
            <span className="smc-sub-stat smc-cum">累積線</span>
          </div>
          <div ref={fgnRef} className="smc-sub h90" />
          <div className="smc-sub-label">
            投信買賣超
            {latestTrst && <span className={`smc-sub-stat ${latestTrst.value >= 0 ? 'cl-up':'cl-down'}`}>
              {latestTrst.value >= 0 ? '+' : ''}{latestTrst.value.toLocaleString()} 張
            </span>}
            <span className="smc-sub-stat smc-cum">累積線</span>
          </div>
          <div ref={trstRef} className="smc-sub h110" />
        </>
      )}

      {/* ══ Tab 4: 大戶持股 + 散戶持股 ══ */}
      {chartTab === 'holder' && (
        <>
          <div className="smc-sub-label">
            大戶持股比率
            {latestHolder && <span className="smc-sub-stat cl-up">{latestHolder.big.toFixed(2)}%</span>}
          </div>
          <div ref={bigRef} className="smc-sub h100" />
          <div className="smc-sub-label">
            散戶持股比率
            {latestHolder && <span className="smc-sub-stat cl-down">{latestHolder.small.toFixed(2)}%</span>}
          </div>
          <div ref={smlRef} className="smc-sub h110" />
        </>
      )}

      {/* ══ Tab 5: 融資 + 融券 + 券資比 ══ */}
      {chartTab === 'margin' && (
        <>
          <div className="smc-sub-label">
            融資餘額
            {latestMargin && <span className="smc-sub-stat" style={{ color: '#2980b9' }}>{latestMargin.margin.toLocaleString()} 張</span>}
          </div>
          <div ref={mrgnRef} className="smc-sub h90" />
          <div className="smc-sub-label">
            融券餘額
            {latestMargin && <>
              <span className="smc-sub-stat" style={{ color: '#8e44ad' }}>{latestMargin.short.toLocaleString()} 張</span>
              <span className="smc-sub-stat" style={{ color: '#e74c3c' }}>券資比 {latestMargin.ratio.toFixed(1)}%</span>
            </>}
          </div>
          <div ref={shrtRef} className="smc-sub h110" />
        </>
      )}

      <p className="smc-source">
        {code} {name} · 近25個交易日 (03/24–04/30) · 資料為高擬真模擬，僅供參考
      </p>
    </div>
  );
}
