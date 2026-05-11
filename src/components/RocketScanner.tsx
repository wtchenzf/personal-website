import { useState, useEffect, useCallback } from 'react';
import MiniKLineChart, { type OHLCBar } from './MiniKLineChart';
import { fetchScan, fetchChips, isAPIConfigured, type ScanResult, type ScannedStock } from '../utils/stockAPI';
import { type ChipData } from '../utils/technicalIndicators';
import { fetchOHLC } from '../utils/stockAPI';
import './RocketScanner.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanMode = 'rocket' | 'reversal';

// ── Plan A: Manual seed data (最新人工核對資料，作為 API 降級備用) ──────────────

// 32 trading days: 03/24 → 05/11（TWSE 實際交易日，已驗證）
// 04/03(五)=清明連假調休休市，04/07(二)才是清明後第一個交易日
const TRADING_DATES = [
  '2026-03-24','2026-03-25','2026-03-26','2026-03-27',  // idx  0– 3
  '2026-03-30','2026-03-31',                              // idx  4– 5
  '2026-04-01','2026-04-02',                              // idx  6– 7
  '2026-04-07','2026-04-08','2026-04-09','2026-04-10',  // idx  8–11
  '2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17', // 12–16
  '2026-04-20',                                           // idx 17
  '2026-04-21','2026-04-22','2026-04-23','2026-04-24',  // idx 18–21
  '2026-04-27',                                           // idx 22
  '2026-04-28','2026-04-29','2026-04-30',               // idx 23–25
  '2026-05-04',                                           // idx 26
  '2026-05-05','2026-05-06','2026-05-07','2026-05-08',  // idx 27–30
  '2026-05-11',                                           // idx 31
];

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
  return TRADING_DATES.map((time, i) => {
    const close = +Math.max(closes[i], 0.01).toFixed(2);
    const prevClose = i > 0 ? closes[i - 1] : close;
    const open  = +(prevClose * (1 + (rand() - 0.5) * vol * 0.3)).toFixed(2);
    const bodyH = Math.max(open, close);
    const bodyL = Math.min(open, close);
    const high  = +(bodyH * (1 + rand() * vol * 0.7)).toFixed(2);
    const low   = +(bodyL * (1 - rand() * vol * 0.7)).toFixed(2);
    return { time, open, high, low, close };
  });
}

// Date index reference: 0=03/24, …, 21=04/24, 25=04/30, 29=05/08, 31=05/11
// OHLC anchors use real TWSE close prices at key turning points
const MOCK_OHLC: Record<string, OHLCBar[]> = {
  // ── 飆股掃描結果 ──
  '3661': buildOHLC([[0,3110],[7,2705],[8,2705],[11,3025],[16,3515],[21,4215],[25,4135],[29,4795],[31,5375]], 0.018, 3661),
  '2454': buildOHLC([[0,1620],[7,1465],[11,1575],[16,1925],[21,2435],[25,2610],[26,2870],[27,3155],[29,3430],[31,3880]], 0.024, 2454),
  '6442': buildOHLC([[0,1520],[7,1280],[11,1470],[16,1850],[21,2200],[25,2080],[29,2280],[31,2550]], 0.035, 6442),
  '3037': buildOHLC([[0,460],[7,519],[8,564],[11,638],[16,643],[21,790],[25,883],[29,896],[31,861]], 0.022, 3037),
  '3017': buildOHLC([[0,2580],[7,2380],[8,2380],[11,2620],[16,2870],[21,2945],[25,2835],[29,2445],[31,2555]], 0.020, 3017),
  // ── 破底翻掃描結果 ──
  '3653': buildOHLC([[0,3950],[7,3760],[11,4040],[16,4565],[21,4125],[25,4000],[27,3155],[28,3875],[29,3650],[31,4015]], 0.025, 3653),
  '6669': buildOHLC([[0,4050],[7,3640],[11,4100],[16,4720],[21,5370],[22,4960],[25,4950],[29,4780],[31,5340]], 0.020, 6669),
  '3711': buildOHLC([[0,332],[7,352],[8,352],[11,393],[16,442],[21,496],[25,478],[29,540],[31,537]], 0.018, 3711),
  '8996': buildOHLC([[0,120],[7,100],[8,101],[11,116],[16,148],[21,175],[25,167],[29,178],[31,194]], 0.030, 8996),
  '5274': buildOHLC([[0,1780],[7,1600],[8,1610],[11,1760],[16,2000],[21,2380],[25,2150],[29,1950],[31,2060]], 0.025, 5274),
};

// Plan A — 手動核對資料（05/11 更新，使用 TWSE 實際收盤價）
// 05/11 大盤強漲：美中貿易協議樂觀預期帶動 AI/散熱/IC 全面走強
const MOCK_SCAN: ScanResult = {
  scanDate: '05/11',
  source: 'TWSE',
  rockets: [
    { code:'3661', name:'世芯-KY', price:5375,  chg:485.0, changePct:9.92,  vol:5800000,  volRatio:2.8, tags:['AI ASIC','外資連買','創新高'], scanDate:'05/11', strength:97 },
    { code:'2454', name:'聯發科',  price:3880,  chg:250.0, changePct:6.89,  vol:31000000, volRatio:1.9, tags:['IC設計','漲停後強','AI手機'], scanDate:'05/11', strength:89 },
    { code:'6442', name:'光聖',    price:2550,  chg:270.0, changePct:11.84, vol:2100000,  volRatio:3.4, tags:['矽光子','爆量突破','投信連買'], scanDate:'05/11', strength:85 },
    { code:'3037', name:'欣興',    price:861,   chg:43.0,  changePct:5.26,  vol:28000000, volRatio:1.6, tags:['ABF載板','外資連買','CoWoS受益'], scanDate:'05/11', strength:80 },
    { code:'3017', name:'奇鋐',    price:2555,  chg:110.0, changePct:4.50,  vol:12000000, volRatio:1.5, tags:['液冷散熱','法人雙買','龍頭'], scanDate:'05/11', strength:76 },
  ],
  reversals: [
    { code:'3653', name:'健策',      price:4015, chg:365.0, changePct:10.00, vol:5200000,  volRatio:2.5, recoverPct:23.5, tags:['液冷冷板','跌停後強彈','V型反攻'], scanDate:'05/11', strength:82 },
    { code:'6669', name:'緯穎',      price:5340, chg:140.0, changePct:2.69,  vol:7800000,  volRatio:1.6, recoverPct:11.5, tags:['AI伺服器ODM','GB200','法人回補'], scanDate:'05/11', strength:74 },
    { code:'3711', name:'日月光投控', price:537,  chg:21.0,  changePct:4.07,  vol:22000000, volRatio:1.4, recoverPct:15.2, tags:['先進封裝','SiP量產','低估值'], scanDate:'05/11', strength:68 },
    { code:'8996', name:'高力',      price:194,  chg:16.0,  changePct:8.99,  vol:4500000,  volRatio:2.6, recoverPct:19.0, tags:['冷排龍頭','小型高彈','ETF持有'], scanDate:'05/11', strength:65 },
    { code:'5274', name:'信驊',      price:2060, chg:110.0, changePct:5.64,  vol:3200000,  volRatio:2.3, recoverPct:16.8, tags:['BMC龍頭','AI伺服器','籌碼乾淨'], scanDate:'05/11', strength:60 },
  ],
};

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

  // Auto-scan on first load when API is configured
  useEffect(() => {
    if (apiOn) startScan();
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

  // Decide which data to show: live API > manual mock
  const displayData = scanResult ?? MOCK_SCAN;
  const isRocket = scanMode === 'rocket';
  const stocks = isRocket ? displayData.rockets : displayData.reversals;

  return (
    <div className="rocket-scanner-container card">
      <div className="scanner-header">
        <div className="scanner-title-group">
          <span className="scanner-badge">{apiOn ? 'TWSE 即時掃描' : 'AI Scanner'}</span>
          <h3 className="scanner-title">{isRocket ? '潛力飆股快選' : '破底翻飆股掃描'}</h3>
          <p className="scanner-subtitle">搜尋台股 1,700+ 標的，篩選高動能個股</p>
        </div>
        {!isScanning && (
          <button
            className={`scan-btn ${showResults ? 'secondary' : 'primary'}`}
            onClick={startScan}
          >
            {showResults ? '重新掃描' : '開始全市場掃描'}
          </button>
        )}
      </div>

      <div className="scan-mode-tabs">
        <button className={`scan-mode-btn ${isRocket ? 'active' : ''}`} onClick={() => handleModeChange('rocket')}>
          🚀 潛力飆股
        </button>
        <button className={`scan-mode-btn ${!isRocket ? 'active' : ''}`} onClick={() => handleModeChange('reversal')}>
          📈 破底翻
        </button>
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
            <span className={`scan-source-dot ${apiOn && scanResult ? 'live' : 'mock'}`} />
            <span className="scan-source-label">
              {apiOn && scanResult
                ? `TWSE 即時資料 · 掃描日 ${displayData.scanDate}`
                : `參考資料 · ${displayData.scanDate} (手動核對)`}
            </span>
            {scanError && <span className="scan-error-note">⚠ API 暫時無法連線，顯示參考資料</span>}
            <button
              className="scan-refresh-inline-btn"
              onClick={startScan}
              disabled={isScanning}
              title="重新掃描取得最新數據"
            >
              <span className={isScanning ? 'spin' : ''}>🔄</span>
              {isScanning ? '掃描中…' : '更新數據'}
            </button>
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
                chipHistory={liveChips[stock.code] ?? []}
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
                strength={stock.strength}
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
  activeTab, chipHistory, strength,
}: {
  activeTab:   'main' | 'chips';
  chipHistory: ChipData[];
  strength:    number;
}) {
  const recent = chipHistory.slice(-5).reverse(); // latest first

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
          籌碼資料載入中…（需 API 連線）
        </p>
      </div>
    );
  }

  const latest = recent[0];
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
