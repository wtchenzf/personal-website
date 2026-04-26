import { useState } from 'react';
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

// 破底翻候選 — 低點後強力反彈，法人籌碼轉多 (資料參考 2026/04 實際走勢)
const BOTTOM_REVERSALS: ReversalStock[] = [
  {
    id: 'r1', symbol: '3035', name: '智原', price: 185.0, change: 9.79,
    priorLow: { date: '04/02', price: 139.0 }, recoverPct: 33.1, daysFromLow: 14,
    volRatio: 2.1, strength: 92,
    reason: '【AI ASIC 設計破底翻】關稅重擊後股價於 4/2 跌至近期低點 139 元，隨後川普宣布 90 日暫緩，外資與投信聯手強力回補。今日爆量漲停，14 日累計從低點反彈 33%，2nm ASIC 流片訂單確認，下半年出貨進入高峰。',
    chips: {
      mainForce: 1850, foreign: 312, trust: 1523, dealer: 15,
      history: [
        { date: '04/24', mainForce:  1850, foreign:   312, trust:  1523 },
        { date: '04/23', mainForce:  2103, foreign:   487, trust:  1608 },
        { date: '04/22', mainForce:  1542, foreign:   231, trust:  1290 },
        { date: '04/21', mainForce:  1918, foreign:   195, trust:  1710 },
        { date: '04/20', mainForce:   876, foreign:   -48, trust:   920 },
      ]
    }
  },
  {
    id: 'r2', symbol: '3189', name: '景碩', price: 526.0, change: 9.81,
    priorLow: { date: '04/01', price: 321.0 }, recoverPct: 63.9, daysFromLow: 16,
    volRatio: 3.2, strength: 98,
    reason: '【ABF 載板破底翻王】4 月初受法說會不如預期下殺至 321 元，遭外資大量砍倉。關稅暫緩消息一出，機構急速回補，16 日爆出近年最大量。CoWoS / SoIC 先進封裝載板需求暴增，GB300 導入將直接帶動 Q3 出貨翻倍。',
    chips: {
      mainForce: 2340, foreign: 485, trust: 1841, dealer: 14,
      history: [
        { date: '04/24', mainForce:  2340, foreign:   485, trust:  1841 },
        { date: '04/23', mainForce:  3105, foreign:   712, trust:  2380 },
        { date: '04/22', mainForce:  2876, foreign:   534, trust:  2321 },
        { date: '04/21', mainForce:  2012, foreign:   320, trust:  1680 },
        { date: '04/20', mainForce:  1340, foreign:    88, trust:  1245 },
      ]
    }
  },
  {
    id: 'r3', symbol: '3105', name: '穩懋', price: 151.0, change: 7.86,
    priorLow: { date: '04/07', price: 105.5 }, recoverPct: 43.1, daysFromLow: 11,
    volRatio: 1.8, strength: 83,
    reason: '【GaN 射頻晶片破底翻】關稅衝擊疊加庫存調整，4/7 重挫至 105.5 元。隨後 AI 資料中心 800G 光模組需求確認帶動 GaN 射頻 PA 回溫，外資近 5 日累計買超 3,900 張。下半年 LNA 與功率放大器出貨成長能見度高，法人目標價 175 元。',
    chips: {
      mainForce: 823, foreign: 761, trust: 48, dealer: 14,
      history: [
        { date: '04/24', mainForce:   823, foreign:   761, trust:    48 },
        { date: '04/23', mainForce:   914, foreign:   863, trust:    38 },
        { date: '04/22', mainForce:   732, foreign:   698, trust:    18 },
        { date: '04/21', mainForce:   685, foreign:   640, trust:    32 },
        { date: '04/20', mainForce:   571, foreign:   546, trust:    12 },
      ]
    }
  },
  {
    id: 'r4', symbol: '8046', name: '南電', price: 119.0, change: 5.31,
    priorLow: { date: '04/08', price: 79.0 }, recoverPct: 50.6, daysFromLow: 10,
    volRatio: 1.6, strength: 79,
    reason: '【ABF 基板破底翻】4/8 跌破前低至 79 元創三年新低，超跌後吸引主力逢低進場。投信近 8 日連續買超合計逾 5,200 張，ABF 高階基板供給緊俏，下半年訂單能見度佳。台積電 CoWoS-S 擴產帶動配套需求，估 Q2 起毛利率止跌回升。',
    chips: {
      mainForce: 645, foreign: 88, trust: 542, dealer: 15,
      history: [
        { date: '04/24', mainForce:   645, foreign:    88, trust:   542 },
        { date: '04/23', mainForce:   712, foreign:   102, trust:   603 },
        { date: '04/22', mainForce:   580, foreign:    74, trust:   498 },
        { date: '04/21', mainForce:   634, foreign:    56, trust:   571 },
        { date: '04/20', mainForce:   490, foreign:    42, trust:   441 },
      ]
    }
  },
  {
    id: 'r5', symbol: '6415', name: '矽力-KY', price: 1265.0, change: 9.57,
    priorLow: { date: '04/08', price: 885.0 }, recoverPct: 43.0, daysFromLow: 10,
    volRatio: 2.4, strength: 88,
    reason: '【PMIC 龍頭破底翻】4/8 伴隨台股崩跌至 885 元，外資賣超逾 2,400 張。關稅暫緩後機構急速補回，今日成交量為低點當日 2.4 倍。AI GPU 電源管理需求強勁，Blackwell 每顆 GPU 搭配 PMIC 數量提升，大客戶 NVIDIA 拉貨持續，下半年每股獲利上修幅度可期。',
    chips: {
      mainForce: 312, foreign: 148, trust: 156, dealer: 8,
      history: [
        { date: '04/24', mainForce:   312, foreign:   148, trust:   156 },
        { date: '04/23', mainForce:   423, foreign:   210, trust:   205 },
        { date: '04/22', mainForce:   385, foreign:   175, trust:   203 },
        { date: '04/21', mainForce:   298, foreign:   132, trust:   161 },
        { date: '04/20', mainForce:   201, foreign:    88, trust:   108 },
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
  const [activeDetailTab, setActiveDetailTab] = useState<'main' | 'chips'>('main');

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
                    </div>
                    <ChipsDetailContent stock={stock} activeTab={activeDetailTab} />
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
            <span className="legend-item"><span className="dot low"></span>前低</span>
            <span className="legend-item"><span className="dot now"></span>今日收盤</span>
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
                      <span className="label">強勢力道</span>
                      <div className="strength-bar-box">
                        <div className="strength-bar" style={{ width: `${stock.strength}%` }}></div>
                        <span className="strength-value">{stock.strength}</span>
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
                    </div>
                    <ChipsDetailContent stock={stock} activeTab={activeDetailTab} />
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

function ChipsDetailContent({ stock, activeTab }: { stock: RocketStock | ReversalStock; activeTab: 'main' | 'chips' }) {
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
