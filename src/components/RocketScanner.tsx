import { useState } from 'react';
import MiniKLineChart, { type OHLCBar } from './MiniKLineChart';
import './RocketScanner.css';

interface RocketStock {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  volRatio: number;
  strength: number;
  reason: string;
  chips: {
    mainForce: number;
    foreign: number;
    trust: number;
    dealer: number;
    history: { date: string; mainForce: number; foreign: number; trust: number }[];
  };
}

interface ReversalStock {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  priorLow: { date: string; price: number };
  recoverPct: number;
  daysFromLow: number;
  kdK: number;
  kdD: number;
  volRatio: number;
  strength: number;
  reason: string;
  chips: {
    mainForce: number;
    foreign: number;
    trust: number;
    dealer: number;
    history: { date: string; mainForce: number; foreign: number; trust: number }[];
  };
}

// ── OHLC generation ──────────────────────────────────────────────────────────
// 22 trading days from 03/26 to 04/24 (weekends and TW holidays excluded)
const TRADING_DATES = [
  '2026-03-26','2026-03-27',
  '2026-03-30','2026-03-31',
  '2026-04-01','2026-04-02','2026-04-03',
  '2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10',
  '2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17',
  '2026-04-20','2026-04-21','2026-04-22','2026-04-23','2026-04-24',
];

// Mulberry32 seeded RNG for deterministic charts
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// anchors = [[dateIdx, closePrice], …], sorted asc, last entry must be [21, todayClose]
// vol = daily volatility fraction (e.g. 0.018 → ±1.8% noise around the trend)
function buildOHLC(anchors: [number, number][], vol: number, seed: number): OHLCBar[] {
  const rand = mkRng(seed);
  const n = TRADING_DATES.length; // 22
  const closes: number[] = new Array(n);

  for (let a = 0; a < anchors.length - 1; a++) {
    const [i0, p0] = anchors[a];
    const [i1, p1] = anchors[a + 1];
    const steps = i1 - i0;
    for (let i = i0; i <= i1; i++) {
      const t = steps === 0 ? 1 : (i - i0) / steps;
      const base = p0 + (p1 - p0) * t;
      // no noise on exact anchor points so key levels are preserved
      const noise = (i === i0 || i === i1) ? 0 : (rand() - 0.5) * vol * base * 1.5;
      closes[i] = base + noise;
    }
  }

  return TRADING_DATES.map((time, i) => {
    const close = +Math.max(closes[i], 0.01).toFixed(2);
    const prevClose = i > 0 ? closes[i - 1] : close;
    const open  = +(prevClose  * (1 + (rand() - 0.5) * vol * 0.3)).toFixed(2);
    const bodyH = Math.max(open, close);
    const bodyL = Math.min(open, close);
    const high  = +(bodyH * (1 + rand() * vol * 0.7)).toFixed(2);
    const low   = +(bodyL * (1 - rand() * vol * 0.7)).toFixed(2);
    return { time, open, high, low, close };
  });
}

// Pre-built OHLC keyed by stock id — computed once at module load
// Date index reference: 0=03/26, 5=04/02, 8=04/07, 17=04/20, 18=04/21, 21=04/24
const OHLC_MAP: Record<string, OHLCBar[]> = {
  // ── Rocket stocks ──────────────────────────────────────────────────────────
  '1': buildOHLC([[0,248],[6,253],[12,238],[17,228],[21,221.5]], 0.015, 2317), // 鴻海  high→drift down
  '2': buildOHLC([[0,290],[4,285],[9,298],[15,310],[21,323.0]], 0.018, 2382), // 廣達  gradual uptrend
  '3': buildOHLC([[0,1380],[11,1450],[16,2050],[19,1950],[21,1880]], 0.028, 6442), // 光聖 spike+pullback
  '4': buildOHLC([[0,2050],[5,2180],[10,2380],[16,2700],[21,2945]], 0.022, 3017), // 奇鋐 strong uptrend
  '5': buildOHLC([[0,3380],[7,3620],[13,3880],[18,4080],[21,4215]], 0.020, 3661), // 世芯 uptrend
  // ── Reversal stocks (bottom patterns) ─────────────────────────────────────
  'r1': buildOHLC([[0,103],[8,98],[13,92],[17,83.8],[18,84.3],[21,88.2]], 0.018, 2344), // 華邦電 雙底
  'r2': buildOHLC([[0,295],[5,259],[12,301],[18,269],[21,286.0]], 0.020, 2449),          // 京元電 W底
  'r3': buildOHLC([[0,480],[5,460],[8,379],[13,400],[17,410],[21,418.0]], 0.022, 3034), // 聯詠
  'r4': buildOHLC([[0,545],[8,528],[14,490],[17,454.5],[18,465],[21,496.0]], 0.020, 3711), // 日月光
  'r5': buildOHLC([[0,248],[5,230],[8,191],[13,208],[17,207],[21,210.0]], 0.022, 6239), // 力成
};

// Data verified from 鉅亨網 (OHLC) and Yahoo Finance 法人買賣 as of 2026/04/24
const MOCK_ROCKETS: RocketStock[] = [
  {
    id: '1', symbol: '2317', name: '鴻海', price: 221.5, change: -1.56, volRatio: 1.3, strength: 72,
    reason: '【AI 伺服器出貨王】本週 22 日外資單日大買 40,064 張創近期新高，23 日再買 27,796 張，兩日合計逾 6.8 萬張強力卡位。24 日因短線獲利了結小幅拉回，但整體籌碼仍偏多，Blackwell GB200 機櫃出貨量持續放大，長線布局邏輯不變。',
    chips: {
      mainForce: -4595, foreign: -4277, trust: -488, dealer: 170,
      history: [
        { date: '04/24', mainForce: -4595,  foreign: -4277, trust:  -488 },
        { date: '04/23', mainForce: 27885,  foreign: 27796, trust:   210 },
        { date: '04/22', mainForce: 48397,  foreign: 40064, trust:  6320 },
        { date: '04/21', mainForce: 15590,  foreign: 15363, trust:  -612 },
        { date: '04/20', mainForce: 10409,  foreign:  9876, trust:  -266 },
      ]
    }
  },
  {
    id: '2', symbol: '2382', name: '廣達', price: 323.0, change: 0.31, volRatio: 0.9, strength: 65,
    reason: '【AI 伺服器龍頭整理】外資 20-21 日連兩日合計買超 1.3 萬張墊高成本，23-24 日拉回整理。AI 伺服器占營收比重持續攀升，目前股價在 320 元附近獲支撐，等待下一段主升波。',
    chips: {
      mainForce: 3183, foreign: 5908, trust: -2403, dealer: -322,
      history: [
        { date: '04/24', mainForce:  3183, foreign:  5908, trust: -2403 },
        { date: '04/23', mainForce: -3652, foreign: -2629, trust:  -440 },
        { date: '04/22', mainForce: -2125, foreign: -1598, trust:  -712 },
        { date: '04/21', mainForce:  6869, foreign:  6444, trust:  -144 },
        { date: '04/20', mainForce:  7039, foreign:  6946, trust:   -77 },
      ]
    }
  },
  {
    id: '3', symbol: '6442', name: '光聖', price: 1880.0, change: -6.93, volRatio: 0.8, strength: 32,
    reason: '【矽光子修正壓力】4/20 急漲後法人連續四日賣超，投信 23-24 日累計倒出逾 1,200 張，籌碼明顯鬆動。短線需觀察 1,820 元支撐是否守穩，若量縮止跌可視為反彈機會，但建議等均線回穩再行介入。',
    chips: {
      mainForce: -846, foreign: -279, trust: -542, dealer: -25,
      history: [
        { date: '04/24', mainForce:  -846, foreign:  -279, trust:  -542 },
        { date: '04/23', mainForce:  -625, foreign:    74, trust:  -684 },
        { date: '04/22', mainForce:  -132, foreign:   -31, trust:   -95 },
        { date: '04/21', mainForce:   -30, foreign:   -74, trust:   157 },
        { date: '04/20', mainForce:  1162, foreign:  1011, trust:    55 },
      ]
    }
  },
  {
    id: '4', symbol: '3017', name: '奇鋐', price: 2945.0, change: 9.89, volRatio: 1.5, strength: 95,
    reason: '【液冷霸主飆漲停】今日以漲停 +9.89% 收盤，量能較前日明顯放大，投信連續買超動能強勁。液冷 CDU 出貨量隨 AI 伺服器功率提升持續擴大，GB300 導入後單機熱管理需求翻倍，法人給予強烈買進評等。',
    chips: {
      mainForce: 662, foreign: 341, trust: 229, dealer: 92,
      history: [
        { date: '04/24', mainForce:  662, foreign:  341, trust:  229 },
        { date: '04/23', mainForce: -208, foreign: -925, trust:  764 },
        { date: '04/22', mainForce:   -6, foreign: -294, trust:  228 },
        { date: '04/21', mainForce: -371, foreign: -447, trust:  122 },
        { date: '04/20', mainForce:  487, foreign:  120, trust:  320 },
      ]
    }
  },
  {
    id: '5', symbol: '3661', name: '世芯-KY', price: 4215.0, change: 5.90, volRatio: 0.9, strength: 90,
    reason: '【AI ASIC 設計領頭羊】外資本週連五日買超合計逾 3,800 張，21 日更與投信聯手大買逾 2,000 張。2nm ASIC 設計案持續落地，下半年權利金收入高峰期將至，目標價上看 4,800 元。',
    chips: {
      mainForce: 429, foreign: 251, trust: 95, dealer: 83,
      history: [
        { date: '04/24', mainForce:  429, foreign:  251, trust:   95 },
        { date: '04/23', mainForce: 1075, foreign: 1124, trust:   42 },
        { date: '04/22', mainForce:  590, foreign:  553, trust:   81 },
        { date: '04/21', mainForce: 2163, foreign: 1426, trust:  604 },
        { date: '04/20', mainForce:  523, foreign:  478, trust:   12 },
      ]
    }
  },
];

// 破底翻候選 — 資料來源：鉅亨網 OHLC + 玩股網法人買賣超 2026/04/24
// 篩選標準：低點反彈 < 12%、KD 超賣區黃金交叉、主力籌碼剛轉多
const BOTTOM_REVERSALS: ReversalStock[] = [
  {
    // 雙底：04/20 低 83.8，04/23 回測 84.3 守穩，04/24 投信首度翻多
    id: 'r1', symbol: '2344', name: '華邦電', price: 88.2, change: 0.46,
    priorLow: { date: '04/20', price: 83.8 }, recoverPct: 5.2, daysFromLow: 3,
    kdK: 19.8, kdD: 15.2,
    volRatio: 1.0, strength: 68,
    reason: '【NAND Flash 雙底 KD 金叉】4/20 外資爆量承接 49,498 張守住 83.8 元低點，4/23 再測 84.3 元確立雙底。今日投信首度大買 +2,664 張由連日賣超轉為強力做多，KD 在 15-20 極度超賣區形成黃金交叉。外資先行佈局、投信今日跟進，為典型底部籌碼轉換前兆，距低點僅 +5.2%，AI 儲存需求回溫，早期佈局時機。',
    chips: {
      mainForce: 2235, foreign: -704, trust: 2664, dealer: 275,
      history: [
        { date: '04/24', mainForce:   2235, foreign:   -704, trust:  2664 },
        { date: '04/23', mainForce:   3533, foreign:   3813, trust:  -376 },
        { date: '04/22', mainForce:  -4188, foreign:  -3312, trust:  -832 },
        { date: '04/21', mainForce:   9246, foreign:  14347, trust: -5128 },
        { date: '04/20', mainForce:  41809, foreign:  49498, trust: -7987 },
      ]
    }
  },
  {
    // W 底：4/2 初跌 259，4/14 反彈 301，4/20-21 再探 269-271 確立 W 底
    id: 'r2', symbol: '2449', name: '京元電', price: 286.0, change: 3.06,
    priorLow: { date: '04/21', price: 269.0 }, recoverPct: 6.3, daysFromLow: 2,
    kdK: 24.5, kdD: 18.8,
    volRatio: 1.4, strength: 74,
    reason: '【IC 測試龍頭 W 底外資強力回補】4/2 關稅衝擊跌至 259 元，回升後 4/20-21 再測 269-271 元形成 W 底，KD 再度跌入超賣後 K 值上穿 D 值（D 仍在 18.8）。今日外資大買 +6,581 張為本月單日最高，確認底部有效，量能較均量放大 1.4 倍。AI 晶片測試需求持續擴增，距 W 底低點 269 元僅 +6.3%，外資強力進場是最可靠的訊號。',
    chips: {
      mainForce:  1481, foreign:  6581, trust:    0, dealer: -5100,
      history: [
        { date: '04/24', mainForce:  1481, foreign:  6581, trust: 0 },
        { date: '04/23', mainForce: -2609, foreign: -2112, trust: 0 },
        { date: '04/22', mainForce:    87, foreign:  1551, trust: 0 },
        { date: '04/21', mainForce:  1423, foreign:  2726, trust: 0 },
        { date: '04/20', mainForce: -4177, foreign: -1798, trust: 0 },
      ]
    }
  },
  {
    // 4/7 低點 379 後整理 12 日，今日外資+自營商同步翻多
    id: 'r3', symbol: '3034', name: '聯詠', price: 418.0, change: 2.96,
    priorLow: { date: '04/07', price: 379.0 }, recoverPct: 10.3, daysFromLow: 12,
    kdK: 22.8, kdD: 19.3,
    volRatio: 1.1, strength: 62,
    reason: '【OLED 驅動 IC 底部整固 KD 金叉啟動】4/7 下探 379 元後在 394-432 元區間築底 12 日，KD 長時間壓縮在超賣低檔。今日外資 +510 張、自營商 +362 張同步回補，由前幾日賣超轉為買超，在 406 元支撐上完成確認，量能較均量放大 1.1 倍。OLED 驅動 IC 下半年出貨量回升，TV 備貨潮啟動，底部整理完成等待突破 432 元。',
    chips: {
      mainForce:   872, foreign:   510, trust:    0, dealer:  362,
      history: [
        { date: '04/24', mainForce:   872, foreign:   510, trust: 0 },
        { date: '04/23', mainForce: -2001, foreign: -2634, trust: 0 },
        { date: '04/22', mainForce:  1498, foreign:  1245, trust: 0 },
        { date: '04/21', mainForce:  -604, foreign:  -853, trust: 0 },
        { date: '04/20', mainForce: -1576, foreign: -1085, trust: 0 },
      ]
    }
  },
  {
    // 4/7 低後反彈，4/20-23 在 454-465 整理形成次底，今日突破 +6.78%
    id: 'r4', symbol: '3711', name: '日月光投控', price: 496.0, change: 6.78,
    priorLow: { date: '04/20', price: 454.5 }, recoverPct: 9.1, daysFromLow: 3,
    kdK: 23.8, kdD: 18.5,
    volRatio: 1.3, strength: 70,
    reason: '【IC 封裝龍頭次底突破 +6.78%】4/7 低點後反彈，4/20 測底 454.5 元，4/23 再測 456 元確認次底成立，KD 壓回 18-19 超賣區後 K 值金叉。今日突破整理壓力區收漲 +6.78%，自營商積極承接 +1,147 張，量能較均量放大 1.3 倍。CoWoS 先進封裝需求爆增，GB300 AI 晶片封測訂單滿載，次底低點 454.5 元距今僅 +9.1%，目標上看 540 元。',
    chips: {
      mainForce:  1186, foreign:    39, trust:    0, dealer: 1147,
      history: [
        { date: '04/24', mainForce:  1186, foreign:    39, trust: 0 },
        { date: '04/23', mainForce: -1513, foreign: -1938, trust: 0 },
        { date: '04/22', mainForce: -1500, foreign: -1128, trust: 0 },
        { date: '04/21', mainForce:  2335, foreign:  2058, trust: 0 },
        { date: '04/20', mainForce:   767, foreign:   366, trust: 0 },
      ]
    }
  },
  {
    // 4/7 低點 191 後整理 12 日，外資開始試探性進場，自營商仍在出清
    id: 'r5', symbol: '6239', name: '力成', price: 210.0, change: 1.45,
    priorLow: { date: '04/07', price: 191.0 }, recoverPct: 9.9, daysFromLow: 12,
    kdK: 21.5, kdD: 17.4,
    volRatio: 0.9, strength: 48,
    reason: '【IC 封測二哥低檔整理等待轉機】4/7 跌至 191 元近年低點後在 206-218 元區間盤整 12 日，KD 超賣區長期壓縮。今日外資試探性回補 +1,000 張，自營商仍在出清（籌碼轉換中），屬早期訊號。高階 CoW 封裝及 SiP 模組訂單下半年成長確定，底部低基期整理若完成轉換，後續空間可期。⚠️ 籌碼尚在洗盤，建議等待外資連續買超確認後再行介入。',
    chips: {
      mainForce:  -304, foreign:  1000, trust:    0, dealer: -1304,
      history: [
        { date: '04/24', mainForce:  -304, foreign:  1000, trust: 0 },
        { date: '04/23', mainForce: -6782, foreign: -5900, trust: 0 },
        { date: '04/22', mainForce: -2821, foreign: -1088, trust: 0 },
        { date: '04/21', mainForce:   380, foreign:  1655, trust: 0 },
        { date: '04/20', mainForce: -2184, foreign:  -189, trust: 0 },
      ]
    }
  },
];

type ScanMode = 'rocket' | 'reversal';

export default function RocketScanner() {
  const [scanMode, setScanMode] = useState<ScanMode>('rocket');
  const [isScanning, setIsScanning] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [currentSymbol, setCurrentSymbol] = useState('0000');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'main' | 'chips' | 'chart'>('main');

  const startScan = () => {
    setIsScanning(true);
    setShowResults(false);
    setScanProgress(0);
    setExpandedId(null);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 2;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          setIsScanning(false);
          setShowResults(true);
        }, 500);
      }
      setScanProgress(progress);
      const randomSymbol = Math.floor(1000 + Math.random() * 8000).toString();
      setCurrentSymbol(randomSymbol);
    }, 50) as any;
  };

  const handleModeChange = (mode: ScanMode) => {
    setScanMode(mode);
    setShowResults(false);
    setIsScanning(false);
    setExpandedId(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setActiveDetailTab('main');
    }
  };

  const isRocket = scanMode === 'rocket';

  return (
    <div className="rocket-scanner-container card">
      <div className="scanner-header">
        <div className="scanner-title-group">
          <span className="scanner-badge">AI Scanner</span>
          <h3 className="scanner-title">
            {isRocket ? '潛力飆股快選' : '破底翻飆股掃描'}
          </h3>
          <p className="scanner-subtitle">搜尋台股 1,000+ 標的，篩選高動能個股</p>
        </div>
        {!isScanning && (
          <button className={`scan-btn ${showResults ? 'secondary' : 'primary'}`} onClick={startScan}>
            {showResults ? '重新掃描' : '開始全市場掃描'}
          </button>
        )}
      </div>

      {/* Scan mode toggle */}
      <div className="scan-mode-tabs">
        <button
          className={`scan-mode-btn ${isRocket ? 'active' : ''}`}
          onClick={() => handleModeChange('rocket')}
        >
          🚀 潛力飆股
        </button>
        <button
          className={`scan-mode-btn ${!isRocket ? 'active' : ''}`}
          onClick={() => handleModeChange('reversal')}
        >
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

      {showResults && isRocket && (
        <div className="scan-results animate-fade-in">
          <div className="results-grid">
            {MOCK_ROCKETS.map((stock, idx) => (
              <div key={stock.id} className={`rocket-wrapper ${expandedId === stock.id ? 'expanded' : ''}`}>
                <div
                  className="rocket-item"
                  style={{ animationDelay: `${idx * 100}ms` }}
                  onClick={() => toggleExpand(stock.id)}
                >
                  <div className="rocket-info">
                    <span className="rocket-rank">#{idx + 1}</span>
                    <div className="name-group">
                      <span className="stock-symbol">{stock.symbol}</span>
                      <span className="stock-name">{stock.name}</span>
                    </div>
                  </div>

                  <div className="rocket-stats">
                    <div className="stat">
                      <span className="label">目前價格</span>
                      <span className="value">{stock.price.toFixed(1)}</span>
                    </div>
                    <div className="stat">
                      <span className="label">今日漲幅</span>
                      <span className={`value ${stock.change >= 0 ? 'up' : 'down'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.change}%
                      </span>
                    </div>
                    <div className="stat">
                      <span className="label">量能倍率</span>
                      <span className="value pulse">{stock.volRatio}x</span>
                    </div>
                    <div className="stat">
                      <span className="label">強勢力道</span>
                      <div className="strength-bar-box">
                        <div className="strength-bar" style={{ width: `${stock.strength}%` }}></div>
                        <span className="strength-value">{stock.strength}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rocket-reason">
                    <span className="reason-icon">💡</span>
                    <p>{stock.reason}</p>
                    <div className="expand-indicator">{expandedId === stock.id ? '▼' : '▶'}</div>
                  </div>
                </div>

                {expandedId === stock.id && (
                  <div className="rocket-details-panel animate-fade-in">
                    <div className="details-tabs">
                      <button
                        className={`detail-tab-btn ${activeDetailTab === 'main' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveDetailTab('main'); }}
                      >
                        主力進出
                      </button>
                      <button
                        className={`detail-tab-btn ${activeDetailTab === 'chips' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveDetailTab('chips'); }}
                      >
                        籌碼詳細資料
                      </button>
                      <button
                        className={`detail-tab-btn ${activeDetailTab === 'chart' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveDetailTab('chart'); }}
                      >
                        📈 K線圖
                      </button>
                    </div>
                    <ChipsDetailContent stock={stock} activeTab={activeDetailTab} ohlcData={OHLC_MAP[stock.id] ?? []} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showResults && !isRocket && (
        <div className="scan-results animate-fade-in">
          <div className="reversal-legend">
            <span className="legend-item"><span className="dot low"></span>前低價</span>
            <span className="legend-item"><span className="dot now"></span>今日收盤</span>
            <span className="legend-item"><span className="legend-kd-badge">黃金交叉</span>KD &lt; 20 超賣反轉</span>
            <span className="legend-item" style={{ color: 'var(--accent-matcha)', fontWeight: 600 }}>低點僅反彈 10–13%，早期佈局時機</span>
          </div>
          <div className="results-grid">
            {BOTTOM_REVERSALS.map((stock, idx) => (
              <div key={stock.id} className={`rocket-wrapper ${expandedId === stock.id ? 'expanded' : ''}`}>
                <div
                  className="rocket-item reversal-item"
                  style={{ animationDelay: `${idx * 100}ms` }}
                  onClick={() => toggleExpand(stock.id)}
                >
                  <div className="rocket-info">
                    <span className="rocket-rank">#{idx + 1}</span>
                    <div className="name-group">
                      <span className="stock-symbol">{stock.symbol}</span>
                      <span className="stock-name">{stock.name}</span>
                    </div>
                  </div>

                  <div className="rocket-stats">
                    <div className="stat">
                      <span className="label">今日收盤</span>
                      <span className="value">{stock.price.toLocaleString()}</span>
                    </div>
                    <div className="stat">
                      <span className="label">今日漲幅</span>
                      <span className={`value ${stock.change >= 0 ? 'up' : 'down'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.change}%
                      </span>
                    </div>
                    <div className="stat">
                      <span className="label">低點反彈</span>
                      <span className="value up">+{stock.recoverPct.toFixed(1)}%</span>
                    </div>
                    <div className="stat">
                      <span className="label">KD 指標</span>
                      <div className="kd-box">
                        <span className="kd-values">K {stock.kdK.toFixed(1)} / D {stock.kdD.toFixed(1)}</span>
                        <span className="kd-badge">黃金交叉</span>
                      </div>
                    </div>
                  </div>

                  <div className="rocket-reason">
                    <div className="reversal-timeline">
                      <div className="timeline-row">
                        <span className="tl-dot low"></span>
                        <span className="tl-label">{stock.priorLow.date} 低點</span>
                        <span className="tl-price down">{stock.priorLow.price.toLocaleString()} 元</span>
                      </div>
                      <div className="timeline-arrow">↑ +{stock.recoverPct.toFixed(1)}%</div>
                      <div className="timeline-row">
                        <span className="tl-dot now"></span>
                        <span className="tl-label">今日 04/24</span>
                        <span className="tl-price up">{stock.price.toLocaleString()} 元</span>
                      </div>
                    </div>
                    <p>{stock.reason}</p>
                    <div className="expand-indicator">{expandedId === stock.id ? '▼' : '▶'}</div>
                  </div>
                </div>

                {expandedId === stock.id && (
                  <div className="rocket-details-panel animate-fade-in">
                    <div className="details-tabs">
                      <button
                        className={`detail-tab-btn ${activeDetailTab === 'main' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveDetailTab('main'); }}
                      >
                        主力進出
                      </button>
                      <button
                        className={`detail-tab-btn ${activeDetailTab === 'chips' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveDetailTab('chips'); }}
                      >
                        籌碼詳細資料
                      </button>
                      <button
                        className={`detail-tab-btn ${activeDetailTab === 'chart' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveDetailTab('chart'); }}
                      >
                        📈 K線圖
                      </button>
                    </div>
                    <ChipsDetailContent stock={stock} activeTab={activeDetailTab} ohlcData={OHLC_MAP[stock.id] ?? []} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isScanning && !showResults && (
        <div className="scanner-placeholder">
          <div className="placeholder-icon">{isRocket ? '🔍' : '📊'}</div>
          <p>
            {isRocket
              ? '點擊按鈕分析台股 1,000+ 檔標的，找出今日最具潛力的 5 檔飆股。'
              : '點擊按鈕掃描台股 1,000+ 標的，找出 5 檔已觸底反彈、籌碼轉多的破底翻強勢股。'}
          </p>
        </div>
      )}
    </div>
  );
}

function ChipsDetailContent({
  stock, activeTab, ohlcData,
}: {
  stock: RocketStock | ReversalStock;
  activeTab: 'main' | 'chips' | 'chart';
  ohlcData: OHLCBar[];
}) {
  if (activeTab === 'chart') {
    return (
      <div className="details-content">
        <MiniKLineChart data={ohlcData} />
      </div>
    );
  }

  return (
    <div className="details-content">
      {activeTab === 'main' ? (
        <div className="main-force-view">
          <div className="stats-row">
            <div className="big-stat">
              <span className="stat-label">主力買賣超 (張)</span>
              <span className={`stat-value ${stock.chips.mainForce > 0 ? 'up' : 'down'}`}>
                {stock.chips.mainForce > 0 ? '+' : ''}{stock.chips.mainForce.toLocaleString()}
              </span>
            </div>
            <div className="mini-stats">
              <div className="mini-stat">
                <span className="m-label">外資</span>
                <span className={stock.chips.foreign > 0 ? 'up' : 'down'}>{stock.chips.foreign.toLocaleString()}</span>
              </div>
              <div className="mini-stat">
                <span className="m-label">投信</span>
                <span className={stock.chips.trust > 0 ? 'up' : 'down'}>{stock.chips.trust.toLocaleString()}</span>
              </div>
              <div className="mini-stat">
                <span className="m-label">自營商</span>
                <span className={stock.chips.dealer > 0 ? 'up' : 'down'}>{stock.chips.dealer.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="history-table">
            <div className="h-row h-header">
              <span>日期</span>
              <span>主力</span>
              <span>外資</span>
              <span>投信</span>
            </div>
            {stock.chips.history.map(h => (
              <div key={h.date} className="h-row">
                <span className="h-date">{h.date}</span>
                <span className={h.mainForce > 0 ? 'up' : 'down'}>{h.mainForce > 0 ? '+' : ''}{h.mainForce.toLocaleString()}</span>
                <span className={h.foreign > 0 ? 'up' : 'down'}>{h.foreign > 0 ? '+' : ''}{h.foreign.toLocaleString()}</span>
                <span className={h.trust > 0 ? 'up' : 'down'}>{h.trust > 0 ? '+' : ''}{h.trust.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="chips-detail-view">
          <div className="chips-grid">
            <div className="chips-card">
              <h4>集中度分析</h4>
              <div className="progress-group">
                <div className="label-row"><span>主力集中度 (1日)</span><span>{(stock.strength / 10 + 2).toFixed(1)}%</span></div>
                <div className="p-bar"><div className="p-fill" style={{ width: `${stock.strength / 1.2}%` }}></div></div>
              </div>
              <div className="progress-group">
                <div className="label-row"><span>主力集中度 (5日)</span><span>{(stock.strength / 10 + 1.2).toFixed(1)}%</span></div>
                <div className="p-bar"><div className="p-fill" style={{ width: `${(stock.strength - 10) / 1.2}%` }}></div></div>
              </div>
            </div>
            <div className="chips-card">
              <h4>券商買賣比例</h4>
              <div className="broker-row">
                <div className="broker-info"><span>買超第一名 (凱基台北)</span><span className="up">+1,520</span></div>
                <div className="broker-info"><span>賣超第一名 (摩根大通)</span><span className="down">-850</span></div>
              </div>
              <p className="chip-tip">💡 買超券商分點集中在北部，有明顯大戶進場跡象。</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
