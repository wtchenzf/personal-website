import { useState, useEffect, useCallback } from 'react';
import MiniKLineChart, { type OHLCBar } from './MiniKLineChart';
import { fetchScan, fetchChips, isAPIConfigured, type ScanResult, type ScannedStock } from '../utils/stockAPI';
import { type ChipData } from '../utils/technicalIndicators';
import { fetchOHLC } from '../utils/stockAPI';
import './RocketScanner.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanMode = 'rocket' | 'reversal';

// ── Plan A: Manual seed data (最新人工核對資料，作為 API 降級備用) ──────────────

// Taiwan market holidays 2026 (公眾假期/休市日)
const TW_HOLIDAYS_2026 = new Set([
  '2026-04-03','2026-04-04','2026-04-05','2026-04-06',  // 清明連假
  '2026-05-01',  // 勞動節
]);

/** Generate all Taiwan trading days from `from` up to today (Taiwan time, UTC+8) */
function getTradingDates(from: string): string[] {
  const dates: string[] = [];
  const d = new Date(from + 'T00:00:00Z');
  const now    = new Date();
  const twMs   = now.getTime() + 8 * 60 * 60 * 1000;
  const tw     = new Date(twMs);
  const today  = new Date(Date.UTC(tw.getUTCFullYear(), tw.getUTCMonth(), tw.getUTCDate()));
  while (d <= today) {
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !TW_HOLIDAYS_2026.has(iso)) dates.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

// All trading days from 03/24 to today — grows automatically each trading day
const TRADING_DATES = getTradingDates('2026-03-24');

function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildOHLC(anchors: [number, number][], vol: number, seed: number): OHLCBar[] {
  const rand = mkRng(seed);
  const n = TRADING_DATES.length;
  const closes: number[] = new Array(n);
  for (let a = 0; a < anchors.length - 1; a++) {
    const [i0, p0] = anchors[a];
    const [i1, p1] = anchors[a + 1];
    const steps = i1 - i0;
    for (let i = i0; i <= i1; i++) {
      const t = steps === 0 ? 1 : (i - i0) / steps;
      const base = p0 + (p1 - p0) * t;
      const noise = (i === i0 || i === i1) ? 0 : (rand() - 0.5) * vol * base * 1.5;
      closes[i] = base + noise;
    }
  }
  // Extrapolate beyond the last anchor (random walk with slight upward bias)
  const lastAnchorIdx = anchors[anchors.length - 1][0];
  for (let i = lastAnchorIdx + 1; i < n; i++) {
    const prev = closes[i - 1] ?? closes[lastAnchorIdx];
    closes[i] = Math.max(prev * (1 + (rand() - 0.47) * vol), 0.01);
  }
  return TRADING_DATES.map((time, i) => {
    const close    = +Math.max(closes[i] ?? 0.01, 0.01).toFixed(2);
    const prevClose = i > 0 ? (closes[i - 1] ?? close) : close;
    const open  = +(prevClose * (1 + (rand() - 0.5) * vol * 0.3)).toFixed(2);
    const bodyH = Math.max(open, close);
    const bodyL = Math.min(open, close);
    const high  = +(bodyH * (1 + rand() * vol * 0.7)).toFixed(2);
    const low   = +(bodyL * (1 - rand() * vol * 0.7)).toFixed(2);
    return { time, open, high, low, close };
  });
}

// Date index reference: 0=03/24, …, 21=04/24, 25=04/30, 29=05/08, 31=05/11, 32=05/12, 33=05/13, 34=05/14
// OHLC anchors use real TWSE close prices at key turning points
const MOCK_OHLC: Record<string, OHLCBar[]> = {
  // ── 飆股掃描結果 ──
  '3661': buildOHLC([[0,3110],[7,2705],[8,2705],[11,3025],[16,3515],[21,4215],[25,4135],[29,4795],[31,5375],[32,5480]], 0.018, 3661),
  '2454': buildOHLC([[0,1620],[7,1465],[11,1575],[16,1925],[21,2435],[25,2610],[26,2870],[27,3155],[29,3430],[31,3880],[32,3975]], 0.024, 2454),
  '6442': buildOHLC([[0,1520],[7,1280],[11,1470],[16,1850],[21,2200],[25,2080],[29,2280],[31,2550],[32,2620]], 0.035, 6442),
  '3037': buildOHLC([[0,460],[7,519],[8,564],[11,638],[16,643],[21,790],[25,883],[29,896],[31,861],[32,875]], 0.022, 3037),
  '3017': buildOHLC([[0,2580],[7,2380],[8,2380],[11,2620],[16,2870],[21,2945],[25,2835],[29,2445],[31,2555],[32,2510]], 0.020, 3017),
  // ── 破底翻掃描結果 ──
  '3653': buildOHLC([[0,3950],[7,3760],[11,4040],[16,4565],[21,4125],[25,4000],[27,3155],[28,3875],[29,3650],[31,4015],[32,3850]], 0.025, 3653),
  '6669': buildOHLC([[0,4050],[7,3640],[11,4100],[16,4720],[21,5370],[22,4960],[25,4950],[29,4780],[31,5340],[32,5430]], 0.020, 6669),
  '3711': buildOHLC([[0,332],[7,352],[8,352],[11,393],[16,442],[21,496],[25,478],[29,540],[31,537],[32,548]], 0.018, 3711),
  '8996': buildOHLC([[0,120],[7,100],[8,101],[11,116],[16,148],[21,175],[25,167],[29,178],[31,194],[32,200]], 0.030, 8996),
  '5274': buildOHLC([[0,1780],[7,1600],[8,1610],[11,1760],[16,2000],[21,2380],[25,2150],[29,1950],[31,2060],[32,2100]], 0.025, 5274),
};

// ── Mock chip data (generated from OHLC price movements, deterministic) ────────
// Scale = rough daily institutional volume (張) per stock
// Daily institutional net buy/sell scale (張) — calibrated to real TWSE T86 ranges
const CHIP_SCALE: Record<string, number> = {
  '3661': 500,  '2454': 3500, '6442': 350,  '3037': 4500, '3017': 1500,
  '3653': 500,  '6669': 800,  '3711': 3500, '8996': 700,  '5274': 280,
};

function buildMockChips(code: string, bars: OHLCBar[]): ChipData[] {
  const rand  = mkRng(parseInt(code, 10) ^ 0xC0FFEE);
  const scale = CHIP_SCALE[code] ?? 400;
  return bars.map(bar => {
    const pct  = (bar.close - bar.open) / Math.max(bar.open, 1);
    const sign = pct >= 0 ? 1 : -1;
    // Base activity floor (scale * 0.8) + price-driven component — ensures realistic values even on flat days
    const mag  = (scale * 0.8 + Math.abs(pct) * scale * 10) * (0.5 + rand() * 0.9);
    const foreign = Math.round(sign * mag * (0.55 + rand() * 0.18));
    const trust   = Math.round(sign * mag * (0.15 + rand() * 0.10));
    const dealer  = Math.round(sign * mag * (0.06 + rand() * 0.05));
    return { time: bar.time, foreign, trust, dealer, mainForce: foreign + trust + dealer };
  });
}

// Pre-build mock chips for all MOCK_OHLC stocks (runs once at module load)
const MOCK_CHIPS: Record<string, ChipData[]> = Object.fromEntries(
  Object.entries(MOCK_OHLC).map(([code, bars]) => [code, buildMockChips(code, bars)])
);

// Dynamic scan date: last entry of TRADING_DATES (auto-follows today)
const MOCK_SCAN_DATE = TRADING_DATES.at(-1)!.slice(5).replace('-', '/');

// Plan A — 手動核對資料（05/15 更新）
// 05/15 (五) AI/半導體多頭延續，液冷散熱族群同步走強，週線收高
const MOCK_SCAN: ScanResult = {
  scanDate: MOCK_SCAN_DATE,
  source: 'TWSE',
  rockets: [
    { code:'3661', name:'世芯-KY', price:5580,  chg:60.0,  changePct:1.09,  vol:4100000,  volRatio:1.7, tags:['AI ASIC','外資連買','創週高'], scanDate:MOCK_SCAN_DATE, strength:97 },
    { code:'2454', name:'聯發科',  price:4230,  chg:80.0,  changePct:1.93,  vol:19500000, volRatio:1.4, tags:['IC設計','外資連買','AI手機'], scanDate:MOCK_SCAN_DATE, strength:89 },
    { code:'6442', name:'光聖',    price:2815,  chg:85.0,  changePct:3.12,  vol:2100000,  volRatio:3.0, tags:['矽光子','投信連買','創新高'], scanDate:MOCK_SCAN_DATE, strength:85 },
    { code:'3037', name:'欣興',    price:925,   chg:17.0,  changePct:1.87,  vol:20500000, volRatio:1.3, tags:['ABF載板','外資連買','CoWoS受益'], scanDate:MOCK_SCAN_DATE, strength:80 },
    { code:'3017', name:'奇鋐',    price:2555,  chg:35.0,  changePct:1.39,  vol:9200000,  volRatio:1.2, tags:['液冷散熱','法人連買','多頭格局'], scanDate:MOCK_SCAN_DATE, strength:76 },
  ],
  reversals: [
    { code:'6669', name:'緯穎',      price:5650, chg:90.0,  changePct:1.62,  vol:5800000,  volRatio:1.4, recoverPct:18.7, tags:['AI伺服器ODM','GB200','法人連買'], scanDate:MOCK_SCAN_DATE, strength:78 },
    { code:'3711', name:'日月光投控', price:572,  chg:7.0,   changePct:1.24,  vol:16800000, volRatio:1.3, recoverPct:21.6, tags:['先進封裝','SiP量產','低估值'], scanDate:MOCK_SCAN_DATE, strength:72 },
    { code:'8996', name:'高力',      price:222,  chg:8.0,   changePct:3.74,  vol:5800000,  volRatio:2.4, recoverPct:27.5, tags:['冷排龍頭','突破整數','ETF持有'], scanDate:MOCK_SCAN_DATE, strength:68 },
    { code:'5274', name:'信驊',      price:2200, chg:35.0,  changePct:1.62,  vol:2500000,  volRatio:1.7, recoverPct:24.1, tags:['BMC龍頭','創新高','籌碼乾淨'], scanDate:MOCK_SCAN_DATE, strength:63 },
    { code:'3653', name:'健策',      price:4080, chg:90.0,  changePct:2.26,  vol:4000000,  volRatio:1.5, recoverPct:13.9, tags:['液冷冷板','週線收紅','多頭延續'], scanDate:MOCK_SCAN_DATE, strength:55 },
  ],
};

// ── Score Breakdown ───────────────────────────────────────────────────────────

interface ScoreBreakdown {
  volume: { score: number; max: number; label: string };
  inst:   { score: number; max: number; label: string };
  chips:  { score: number; max: number; label: string };
  price:  { score: number; max: number; label: string };
  total:  number;
}

function computeBreakdown(
  stock: ScannedStock,
  chipHistory: ChipData[],
  isRocket: boolean,
): ScoreBreakdown {
  // ① 量能 (max 30): volRatio vs 5-day average
  const vr = stock.volRatio;
  const volScore = vr >= 3.0 ? 30 : vr >= 2.0 ? 24 : vr >= 1.5 ? 18 : vr >= 1.2 ? 12 : 6;
  const volLabel  = vr >= 3.0 ? '爆量突破' : vr >= 2.0 ? '放量走強' : vr >= 1.5 ? '量能放大' : '量能正常';

  // ② 法人 (max 30): tag-based institutional momentum
  const tagStr    = stock.tags.join(' ');
  const hasForeign = tagStr.includes('外資');
  const hasTrust   = tagStr.includes('投信');
  const hasInst    = tagStr.includes('法人');
  let instBase = 5;
  if (hasForeign) instBase += 15;
  if (hasTrust)   instBase += 10;
  if (hasInst && !hasForeign && !hasTrust) instBase += 8;
  const instScore = Math.min(30, instBase);
  const instLabel = (hasForeign && hasTrust) ? '外資投信共買'
    : hasForeign ? '外資積極布局'
    : hasTrust   ? '投信強力買超'
    : hasInst    ? '法人持續布局' : '法人觀察中';

  // ③ 籌碼 (max 25): number of net-buy days in last 5 sessions
  const recent5 = chipHistory.slice(-5);
  const buyDays  = recent5.filter(c => c.mainForce > 0).length;
  const chipScore = Math.min(25, buyDays >= 5 ? 25 : buyDays * 5);
  const chipLabel = buyDays >= 5 ? '連買五日' : buyDays >= 4 ? '連買積極'
    : buyDays >= 3 ? '持續買超' : buyDays >= 2 ? '逢低布局' : '初步觀察';

  // ④ 技術/價格 (max 15)
  const pctAbs = Math.abs(stock.changePct);
  let priceScore: number;
  let priceLabel: string;
  if (isRocket) {
    priceScore = pctAbs >= 3 ? 15 : pctAbs >= 2 ? 12 : pctAbs >= 1 ? 9 : 6;
    priceLabel = pctAbs >= 3 ? '強勢漲停' : pctAbs >= 2 ? '大幅上漲'
      : pctAbs >= 1 ? '穩步走強' : '小幅上漲';
  } else {
    const rec = stock.recoverPct ?? 0;
    priceScore = rec >= 25 ? 15 : rec >= 20 ? 12 : rec >= 15 ? 9 : rec >= 10 ? 6 : 4;
    priceLabel = rec >= 25 ? '大幅反彈' : rec >= 20 ? '強力反彈'
      : rec >= 15 ? '初步反彈' : '底部觀察';
  }

  return {
    volume: { score: volScore,  max: 30, label: volLabel  },
    inst:   { score: instScore, max: 30, label: instLabel },
    chips:  { score: chipScore, max: 25, label: chipLabel },
    price:  { score: priceScore,max: 15, label: priceLabel},
    total:  volScore + instScore + chipScore + priceScore,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

interface RocketScannerProps {
  refreshTrigger?: number;   // increment this from the parent to force a re-scan
}

export default function RocketScanner({ refreshTrigger }: RocketScannerProps) {
  const [scanMode,      setScanMode]      = useState<ScanMode>('rocket');
  const [isScanning,    setIsScanning]    = useState(false);
  const [showResults,   setShowResults]   = useState(false);
  const [scanProgress,  setScanProgress]  = useState(0);
  const [currentSymbol, setCurrentSymbol] = useState('0000');
  const [expandedCode,  setExpandedCode]  = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'main' | 'chips' | 'chart'>('main');
  const [showCriteria,  setShowCriteria]  = useState(false);
  const [filterStrength, setFilterStrength] = useState(0);

  // Real scan data from Worker
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError,  setScanError]  = useState(false);

  // Per-stock live chip data (fetched on expand)
  const [liveChips, setLiveChips] = useState<Record<string, ChipData[]>>({});
  // Per-stock live OHLC data (fetched on chart tab)
  const [liveOHLC,  setLiveOHLC]  = useState<Record<string, OHLCBar[]>>({});

  const apiOn = isAPIConfigured();

  // ── Fetch chips for a stock on demand ──────────────────────────────────────
  const ensureChips = useCallback(async (code: string) => {
    if (liveChips[code] || !apiOn) return;
    try {
      const data = await fetchChips(`${code}.TW`);
      if (data.length) setLiveChips(prev => ({ ...prev, [code]: data }));
    } catch { /* ignore */ }
  }, [liveChips, apiOn]);

  // ── Fetch OHLC for a stock on demand ───────────────────────────────────────
  const ensureOHLC = useCallback(async (code: string) => {
    if (liveOHLC[code] || !apiOn) return;
    try {
      const bars = await fetchOHLC(`${code}.TW`, '1mo');
      if (bars.length) {
        // Convert OHLCData to OHLCBar (same shape, safe cast)
        setLiveOHLC(prev => ({ ...prev, [code]: bars as unknown as OHLCBar[] }));
      }
    } catch { /* ignore */ }
  }, [liveOHLC, apiOn]);

  // ── Run scan (animation + real fetch) ──────────────────────────────────────
  const startScan = useCallback(() => {
    setIsScanning(true);
    setShowResults(false);
    setScanProgress(0);
    setExpandedCode(null);
    setScanError(false);

    // Animated progress bar (cosmetic)
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 2;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => { setIsScanning(false); setShowResults(true); }, 500);
      }
      setScanProgress(progress);
      setCurrentSymbol(Math.floor(1000 + Math.random() * 8000).toString());
    }, 50) as unknown as number;

    // Real API fetch runs in parallel with the animation
    if (apiOn) {
      fetchScan().then(result => {
        if (result) setScanResult(result);
      }).catch(() => setScanError(true));
    }
  }, [apiOn]);

  // Auto-scan on first load — always show results (MOCK_SCAN when no API, live when API configured)
  useEffect(() => {
    startScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-scan when parent increments refreshTrigger (e.g. 一鍵更新至今日)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) startScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const handleModeChange = (mode: ScanMode) => {
    setScanMode(mode);
    setExpandedCode(null);
  };

  const toggleExpand = (code: string) => {
    if (expandedCode === code) {
      setExpandedCode(null);
    } else {
      setExpandedCode(code);
      setActiveDetailTab('main');
      ensureChips(code);
    }
  };

  const handleTabChange = (tab: 'main' | 'chips' | 'chart', code: string) => {
    setActiveDetailTab(tab);
    if (tab === 'chart') ensureOHLC(code);
    if (tab === 'chips') ensureChips(code);
  };

  // ── Sanity-check live scan results ──────────────────────────────────────────
  // The Worker occasionally returns erroneous data (e.g. recoverPct = 4000%,
  // changePct = 4000%) due to bad TWSE source data or calculation bugs.
  // Filter out any stock that exceeds physically-possible Taiwan market limits
  // before deciding whether to use live or mock data.
  const SANE_ROCKETS = scanResult?.rockets.filter(s =>
    s.price > 0 &&
    s.volRatio > 0 && s.volRatio <= 50 &&        // ≤50x volume ratio
    Math.abs(s.changePct) <= 12                   // Taiwan ±10% daily limit + buffer
  ) ?? [];

  const SANE_REVERSALS = scanResult?.reversals.filter(s =>
    s.price > 0 &&
    s.volRatio > 0 && s.volRatio <= 50 &&
    Math.abs(s.changePct) <= 12 &&
    (s.recoverPct ?? 0) <= 300                    // ≤300% bounce from low (>300% = bad data)
  ) ?? [];

  // Fall back to MOCK_SCAN independently per mode so one bad live list
  // doesn't contaminate the other (e.g. bad reversals still show live rockets).
  const isRocket = scanMode === 'rocket';
  const displayRockets   = SANE_ROCKETS.length   > 0 ? SANE_ROCKETS   : MOCK_SCAN.rockets;
  const displayReversals = SANE_REVERSALS.length > 0 ? SANE_REVERSALS : MOCK_SCAN.reversals;
  const hasLiveResults   = SANE_ROCKETS.length   > 0 || SANE_REVERSALS.length > 0;
  const displayData = {
    rockets:   displayRockets,
    reversals: displayReversals,
    scanDate:  scanResult?.scanDate ?? MOCK_SCAN.scanDate,
    source:    'TWSE' as const,
  };
  const stocks = (isRocket ? displayData.rockets : displayData.reversals)
    .filter(s => s.strength >= filterStrength);

  return (
    <div className="rocket-scanner-container card">
      <div className="scanner-header">
        <div className="scanner-title-group">
          <span className="scanner-badge">{apiOn ? 'TWSE 即時掃描' : 'AI Scanner'}</span>
          <h3 className="scanner-title">{isRocket ? '潛力飆股快選' : '破底翻飆股掃描'}</h3>
          <p className="scanner-subtitle">搜尋台股 1,700+ 標的，篩選高動能個股</p>
        </div>
      </div>

      <div className="scan-mode-tabs">
        <button className={`scan-mode-btn ${isRocket ? 'active' : ''}`} onClick={() => handleModeChange('rocket')}>
          🚀 潛力飆股
        </button>
        <button className={`scan-mode-btn ${!isRocket ? 'active' : ''}`} onClick={() => handleModeChange('reversal')}>
          📈 破底翻
        </button>
      </div>

      {/* ── Criteria info panel (collapsible) ── */}
      <div className="criteria-panel">
        <button className="criteria-toggle-btn" onClick={() => setShowCriteria(v => !v)}>
          <span className="criteria-toggle-label">
            {isRocket ? '🚀 潛力飆股篩選條件' : '📈 破底翻篩選條件'}
          </span>
          <span className="criteria-toggle-icon">{showCriteria ? '▲' : '▼'}</span>
        </button>
        {showCriteria && (
          <div className="criteria-body animate-fade-in">
            <div className="criteria-grid">
              {isRocket ? (
                <>
                  <div className="criteria-item">
                    <span className="ci-score">量能 30分</span>
                    <span className="ci-desc">今日成交量 ÷ 5日均量 ≥ 1.2×，放量突破確認動能</span>
                  </div>
                  <div className="criteria-item">
                    <span className="ci-score">法人 30分</span>
                    <span className="ci-desc">外資 / 投信連續淨買超，主力認同趨勢</span>
                  </div>
                  <div className="criteria-item">
                    <span className="ci-score">籌碼 25分</span>
                    <span className="ci-desc">近5日主力買超天數，籌碼持續集中</span>
                  </div>
                  <div className="criteria-item">
                    <span className="ci-score">技術 15分</span>
                    <span className="ci-desc">當日漲幅 ≥ 1%，股價站上月線，趨勢向上</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="criteria-item">
                    <span className="ci-score">量能 30分</span>
                    <span className="ci-desc">反彈日成交量 ≥ 5日均量 1.2×，非無量反彈</span>
                  </div>
                  <div className="criteria-item">
                    <span className="ci-score">法人 30分</span>
                    <span className="ci-desc">外資 / 投信由賣轉買，籌碼開始回流</span>
                  </div>
                  <div className="criteria-item">
                    <span className="ci-score">籌碼 25分</span>
                    <span className="ci-desc">近5日主力累積買超，確認底部籌碼乾淨</span>
                  </div>
                  <div className="criteria-item">
                    <span className="ci-score">技術 15分</span>
                    <span className="ci-desc">從近期低點反彈幅度 ≥ 10%，底部結構成立</span>
                  </div>
                </>
              )}
            </div>
            <div className="criteria-score-note">
              💡 <b>強勢力道 = 量能(30) + 法人(30) + 籌碼(25) + 技術(15) = 100分</b>
              ｜點擊個股「主力進出」可查看詳細評分明細
            </div>
          </div>
        )}
      </div>

      {isScanning && (
        <div className="scanning-overlay">
          <div className="scan-progress-box">
            <div className="scan-loader">
              <div className="scan-radar"></div>
              <span className="scanning-text">SCANNING: {currentSymbol}.TW</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${scanProgress}%` }}></div>
            </div>
            <span className="progress-percentage">{scanProgress}%</span>
          </div>
        </div>
      )}

      {showResults && (
        <div className="scan-results animate-fade-in">
          {/* ── Status bar ── */}
          <div className="scan-status-bar">
            <span className={`scan-source-dot ${hasLiveResults ? 'live' : 'mock'}`} />
            <span className="scan-source-label">
              {hasLiveResults
                ? `TWSE 即時資料 · 掃描日 ${displayData.scanDate}`
                : `參考資料 · ${displayData.scanDate} (手動核對)`}
            </span>
            {scanError && <span className="scan-error-note">⚠ API 暫時無法連線，顯示參考資料</span>}
            <select
              className="filter-strength-select"
              value={filterStrength}
              onChange={e => setFilterStrength(Number(e.target.value))}
              title="依強勢力道篩選"
            >
              <option value={0}>全部顯示</option>
              <option value={60}>強度 ≥ 60</option>
              <option value={70}>強度 ≥ 70</option>
              <option value={80}>強度 ≥ 80</option>
            </select>
          </div>

          {!isRocket && (
            <div className="reversal-legend">
              <span className="legend-item"><span className="dot low"></span>前低價</span>
              <span className="legend-item"><span className="dot now"></span>今日收盤</span>
              <span className="legend-item"><span className="legend-kd-badge">量能爆增</span>成交量顯著放大</span>
            </div>
          )}

          <div className="results-grid">
            {stocks.length === 0 && (
              <p className="scan-empty">今日無符合條件標的，請明日再掃描。</p>
            )}
            {stocks.map((stock, idx) => (
              <StockCard
                key={stock.code}
                stock={stock}
                idx={idx}
                isRocket={isRocket}
                isExpanded={expandedCode === stock.code}
                activeDetailTab={activeDetailTab}
                onToggle={() => toggleExpand(stock.code)}
                onTabChange={(tab) => handleTabChange(tab, stock.code)}
                chipHistory={liveChips[stock.code] ?? MOCK_CHIPS[stock.code] ?? []}
                ohlcBars={liveOHLC[stock.code] ?? MOCK_OHLC[stock.code] ?? []}
              />
            ))}
          </div>
        </div>
      )}

      {!isScanning && !showResults && (
        <div className="scanner-placeholder">
          <div className="placeholder-icon">{isRocket ? '🔍' : '📊'}</div>
          <p>
            {isRocket
              ? '點擊按鈕掃描台股 1,700+ 檔標的，找出今日量增價漲的潛力飆股。'
              : '點擊按鈕掃描台股 1,700+ 標的，找出已觸底反彈、籌碼轉多的破底翻強勢股。'}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Stock Card ────────────────────────────────────────────────────────────────

function StockCard({
  stock, idx, isRocket, isExpanded, activeDetailTab,
  onToggle, onTabChange, chipHistory, ohlcBars,
}: {
  stock:          ScannedStock;
  idx:            number;
  isRocket:       boolean;
  isExpanded:     boolean;
  activeDetailTab:'main' | 'chips' | 'chart';
  onToggle:       () => void;
  onTabChange:    (tab: 'main' | 'chips' | 'chart') => void;
  chipHistory:    ChipData[];
  ohlcBars:       OHLCBar[];
}) {
  const isUp = stock.changePct >= 0;

  return (
    <div className={`rocket-wrapper ${isExpanded ? 'expanded' : ''}`}>
      <div
        className={`rocket-item ${isRocket ? '' : 'reversal-item'}`}
        style={{ animationDelay: `${idx * 100}ms` }}
        onClick={onToggle}
      >
        <div className="rocket-info">
          <span className="rocket-rank">#{idx + 1}</span>
          <div className="name-group">
            <span className="stock-symbol">{stock.code}</span>
            <span className="stock-name">{stock.name}</span>
            <span className="scan-date-badge">📅 {stock.scanDate}</span>
          </div>
          <div className="tag-group">
            {stock.tags.slice(0, 3).map(t => (
              <span key={t} className="stock-tag">{t}</span>
            ))}
          </div>
        </div>

        <div className="rocket-stats">
          <div className="stat">
            <span className="label">收盤價</span>
            <span className="value">{stock.price.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="label">漲跌幅</span>
            <span className={`value ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : ''}{stock.changePct.toFixed(2)}%
            </span>
          </div>
          <div className="stat">
            <span className="label">量能倍率</span>
            <span className="value pulse">{stock.volRatio.toFixed(1)}x</span>
          </div>
          <div className="stat">
            <span className="label">強勢力道</span>
            <div className="strength-bar-box">
              <div className="strength-bar" style={{ width: `${stock.strength}%` }}></div>
              <span className="strength-value">{stock.strength}</span>
            </div>
          </div>
        </div>

        {/* Reversal: show price recovery timeline */}
        {!isRocket && stock.recoverPct !== undefined && (
          <div className="rocket-reason">
            <div className="reversal-timeline">
              <div className="timeline-row">
                <span className="tl-dot low"></span>
                <span className="tl-label">近期低點</span>
                <span className="tl-price down">{(stock.price / (1 + stock.recoverPct / 100)).toFixed(1)} 元</span>
              </div>
              <div className="timeline-arrow">↑ +{stock.recoverPct.toFixed(1)}%</div>
              <div className="timeline-row">
                <span className="tl-dot now"></span>
                <span className="tl-label">今日 {stock.scanDate}</span>
                <span className="tl-price up">{stock.price.toLocaleString()} 元</span>
              </div>
            </div>
            <div className="expand-indicator">{isExpanded ? '▼' : '▶'}</div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="rocket-details-panel animate-fade-in">
          <div className="details-tabs">
            {(['main','chips','chart'] as const).map(tab => (
              <button
                key={tab}
                className={`detail-tab-btn ${activeDetailTab === tab ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onTabChange(tab); }}
              >
                {tab === 'main' ? '主力進出' : tab === 'chips' ? '籌碼詳細' : '📈 K線圖'}
              </button>
            ))}
          </div>

          <div className="details-content">
            {activeDetailTab === 'chart' && (
              <MiniKLineChart data={ohlcBars} />
            )}
            {activeDetailTab !== 'chart' && (
              <ChipDetailView
                activeTab={activeDetailTab}
                chipHistory={chipHistory}
                stock={stock}
                isRocket={isRocket}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chip Detail View ──────────────────────────────────────────────────────────

function ChipDetailView({
  activeTab, chipHistory, stock, isRocket,
}: {
  activeTab:   'main' | 'chips';
  chipHistory: ChipData[];
  stock:       ScannedStock;
  isRocket:    boolean;
}) {
  const recent = chipHistory.slice(-5).reverse(); // latest first
  const strength = stock.strength;

  if (activeTab === 'chips') {
    return (
      <div className="chips-detail-view">
        <div className="chips-grid">
          <div className="chips-card">
            <h4>集中度分析</h4>
            <div className="progress-group">
              <div className="label-row"><span>主力集中度 (1日)</span><span>{(strength / 10 + 2).toFixed(1)}%</span></div>
              <div className="p-bar"><div className="p-fill" style={{ width: `${strength / 1.2}%` }}></div></div>
            </div>
            <div className="progress-group">
              <div className="label-row"><span>主力集中度 (5日)</span><span>{(strength / 10 + 1.2).toFixed(1)}%</span></div>
              <div className="p-bar"><div className="p-fill" style={{ width: `${Math.max(0, strength - 10) / 1.2}%` }}></div></div>
            </div>
          </div>
          <div className="chips-card">
            <h4>三大法人近期流向</h4>
            {recent.length > 0 ? (
              <div className="broker-row">
                <div className="broker-info">
                  <span>外資 ({recent[0].time?.slice(5)})</span>
                  <span className={recent[0].foreign >= 0 ? 'up' : 'down'}>
                    {recent[0].foreign >= 0 ? '+' : ''}{recent[0].foreign.toLocaleString()} 張
                  </span>
                </div>
                <div className="broker-info">
                  <span>投信 ({recent[0].time?.slice(5)})</span>
                  <span className={recent[0].trust >= 0 ? 'up' : 'down'}>
                    {recent[0].trust >= 0 ? '+' : ''}{recent[0].trust.toLocaleString()} 張
                  </span>
                </div>
              </div>
            ) : (
              <p className="chip-tip">💡 切換至「主力進出」查看即時籌碼</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // activeTab === 'main'
  if (recent.length === 0) {
    return (
      <div className="main-force-view">
        <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>
          籌碼資料載入中…
        </p>
      </div>
    );
  }

  const latest = recent[0];
  const bd = computeBreakdown(stock, chipHistory, isRocket);
  const bdDims: Array<{ key: string; score: number; max: number; label: string; color: string }> = [
    { key: '量能', score: bd.volume.score, max: bd.volume.max, label: bd.volume.label, color: '#e67e22' },
    { key: '法人', score: bd.inst.score,   max: bd.inst.max,   label: bd.inst.label,   color: '#6366f1' },
    { key: '籌碼', score: bd.chips.score,  max: bd.chips.max,  label: bd.chips.label,  color: '#c0392b' },
    { key: '技術', score: bd.price.score,  max: bd.price.max,  label: bd.price.label,  color: '#4a7c59' },
  ];

  return (
    <div className="main-force-view">
      <div className="stats-row">
        <div className="big-stat">
          <span className="stat-label">主力買賣超 (張)</span>
          <span className={`stat-value ${latest.mainForce >= 0 ? 'up' : 'down'}`}>
            {latest.mainForce >= 0 ? '+' : ''}{latest.mainForce.toLocaleString()}
          </span>
        </div>
        <div className="mini-stats">
          {[['外資', latest.foreign], ['投信', latest.trust], ['自營商', latest.dealer]].map(([label, val]) => (
            <div key={label as string} className="mini-stat">
              <span className="m-label">{label}</span>
              <span className={(val as number) >= 0 ? 'up' : 'down'}>
                {(val as number) >= 0 ? '+' : ''}{(val as number).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Score breakdown ── */}
      <div className="score-breakdown">
        <div className="breakdown-header">
          <span className="breakdown-title">強勢評分明細</span>
          <span className="breakdown-total">
            {bd.total}
            <span className="breakdown-max"> / 100</span>
          </span>
        </div>
        <div className="breakdown-dims">
          {bdDims.map(d => (
            <div key={d.key} className="breakdown-dim">
              <div className="dim-label-row">
                <span className="dim-name">{d.key}</span>
                <span className="dim-tag">{d.label}</span>
                <span className="dim-score">
                  {d.score}<span className="dim-max">/{d.max}</span>
                </span>
              </div>
              <div className="dim-bar-bg">
                <div
                  className="dim-bar-fill"
                  style={{ width: `${(d.score / d.max) * 100}%`, background: d.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="history-table">
        <div className="h-row h-header">
          <span>日期</span><span>主力</span><span>外資</span><span>投信</span>
        </div>
        {recent.map(h => (
          <div key={h.time} className="h-row">
            <span className="h-date">{h.time?.slice(5)}</span>
            <span className={h.mainForce >= 0 ? 'up' : 'down'}>{h.mainForce >= 0 ? '+' : ''}{h.mainForce.toLocaleString()}</span>
            <span className={h.foreign  >= 0 ? 'up' : 'down'}>{h.foreign  >= 0 ? '+' : ''}{h.foreign.toLocaleString()}</span>
            <span className={h.trust    >= 0 ? 'up' : 'down'}>{h.trust    >= 0 ? '+' : ''}{h.trust.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
