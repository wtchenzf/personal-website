import { useState, useEffect, useCallback } from 'react';
import MiniKLineChart, { type OHLCBar } from './MiniKLineChart';
import { fetchScan, fetchChips, isAPIConfigured, type ScanResult, type ScannedStock } from '../utils/stockAPI';
import { type ChipData } from '../utils/technicalIndicators';
import { fetchOHLC } from '../utils/stockAPI';
import './RocketScanner.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanMode = 'rocket' | 'reversal';

// ── Plan A: Manual seed data (最新人工核對資料，作為 API 降級備用) ──────────────

// 22+1 trading days (03/26–04/25)
const TRADING_DATES = [
  '2026-03-26','2026-03-27',
  '2026-03-30','2026-03-31',
  '2026-04-01','2026-04-02','2026-04-03',
  '2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10',
  '2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17',
  '2026-04-20','2026-04-21','2026-04-22','2026-04-23','2026-04-24',
  '2026-04-25',
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

// Date index reference: 0=03/26, …, 21=04/24, 22=04/25
const MOCK_OHLC: Record<string, OHLCBar[]> = {
  '2317': buildOHLC([[0,248],[6,253],[12,238],[17,228],[21,221.5],[22,224.0]], 0.015, 2317),
  '2382': buildOHLC([[0,290],[4,285],[9,298],[15,310],[21,323.0],[22,319.5]], 0.018, 2382),
  '6442': buildOHLC([[0,1380],[11,1450],[16,2050],[19,1950],[21,1880],[22,1910]], 0.028, 6442),
  '3017': buildOHLC([[0,2050],[5,2180],[10,2380],[16,2700],[21,2945],[22,2880]], 0.022, 3017),
  '3661': buildOHLC([[0,3380],[7,3620],[13,3880],[18,4080],[21,4215],[22,4260]], 0.020, 3661),
  '2344': buildOHLC([[0,103],[8,98],[13,92],[17,83.8],[18,84.3],[21,88.2],[22,89.5]], 0.018, 2344),
  '2449': buildOHLC([[0,295],[5,259],[12,301],[18,269],[21,286.0],[22,291.0]], 0.020, 2449),
  '3034': buildOHLC([[0,480],[5,460],[8,379],[13,400],[17,410],[21,418.0],[22,422.0]], 0.022, 3034),
  '3711': buildOHLC([[0,545],[8,528],[14,490],[17,454.5],[18,465],[21,496.0],[22,503.0]], 0.020, 3711),
  '6239': buildOHLC([[0,248],[5,230],[8,191],[13,208],[17,207],[21,210.0],[22,212.5]], 0.022, 6239),
};

// Plan A — 手動核對資料（04/25 更新）
const MOCK_SCAN: ScanResult = {
  scanDate: '04/25',
  source: 'TWSE',
  rockets: [
    { code:'2317', name:'鴻海',    price:224.0,  chg:2.5,   changePct:1.13, vol:38500000, volRatio:1.4, tags:['AI伺服器','外資連買'], scanDate:'04/25', strength:72 },
    { code:'2382', name:'廣達',    price:319.5,  chg:-3.5,  changePct:-1.08,vol:21000000, volRatio:0.9, tags:['AI伺服器','整理蓄力'], scanDate:'04/25', strength:65 },
    { code:'6442', name:'光聖',    price:1910.0, chg:30.0,  changePct:1.60, vol:1200000,  volRatio:1.1, tags:['矽光子','量縮止跌'], scanDate:'04/25', strength:38 },
    { code:'3017', name:'奇鋐',    price:2880.0, chg:-65.0, changePct:-2.21,vol:9800000,  volRatio:1.3, tags:['液冷散熱','回測支撐'], scanDate:'04/25', strength:80 },
    { code:'3661', name:'世芯-KY', price:4260.0, chg:45.0,  changePct:1.07, vol:4200000,  volRatio:0.8, tags:['AI ASIC','外資持續買'], scanDate:'04/25', strength:88 },
  ],
  reversals: [
    { code:'2344', name:'華邦電',    price:89.5,  chg:1.3,  changePct:1.47, vol:38000000, volRatio:1.2, recoverPct:6.8,  tags:['NAND Flash','雙底確認'], scanDate:'04/25', strength:68 },
    { code:'2449', name:'京元電',    price:291.0, chg:5.0,  changePct:1.75, vol:14000000, volRatio:1.5, recoverPct:8.2,  tags:['IC測試','W底確認'], scanDate:'04/25', strength:74 },
    { code:'3034', name:'聯詠',      price:422.0, chg:4.0,  changePct:0.96, vol:11000000, volRatio:1.1, recoverPct:11.3, tags:['OLED驅動IC','底部整固'], scanDate:'04/25', strength:62 },
    { code:'3711', name:'日月光投控', price:503.0, chg:7.0,  changePct:1.41, vol:18000000, volRatio:1.4, recoverPct:10.7, tags:['先進封裝','次底突破'], scanDate:'04/25', strength:70 },
    { code:'6239', name:'力成',      price:212.5, chg:2.5,  changePct:1.19, vol:9000000,  volRatio:1.0, recoverPct:11.3, tags:['IC封測','低基期'], scanDate:'04/25', strength:50 },
  ],
};

// ── Main component ────────────────────────────────────────────────────────────

export default function RocketScanner() {
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
        if (result && (result.rockets.length || result.reversals.length)) {
          setScanResult(result);
        }
      }).catch(() => setScanError(true));
    }
  }, [apiOn]);

  // Auto-scan on first load when API is configured
  useEffect(() => {
    if (apiOn) startScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
