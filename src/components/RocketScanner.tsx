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

const MOCK_ROCKETS: RocketStock[] = [
  { 
    id: '1', symbol: '2317', name: '鴻海', price: 225.0, change: 1.8, volRatio: 2.1, strength: 82, 
    reason: '【AI 整合亮點】隨著 Blackwell 伺服器機櫃進入密集出貨期，鴻海展現強大的系統整合實力。今日雖然大盤震盪，但鴻海表現相對穩健，吸引長線資金布局。',
    chips: {
      mainForce: 15000, foreign: 8500, trust: 3200, dealer: 1500,
      history: [
        { date: '04/23', mainForce: 15000, foreign: 8500, trust: 3200 },
        { date: '04/22', mainForce: -2000, foreign: -3500, trust: 1200 },
        { date: '04/21', mainForce: 4500, foreign: 3200, trust: 800 },
        { date: '04/20', mainForce: 6200, foreign: 4500, trust: 1100 },
        { date: '04/17', mainForce: 1500, foreign: 1000, trust: 300 },
      ]
    }
  },
  { 
    id: '2', symbol: '2382', name: '廣達', price: 322.0, change: -2.1, volRatio: 1.8, strength: 75, 
    reason: '【漲多拉回】AI 伺服器營收貢獻顯著，但近期股價漲幅已大，今日遭遇獲利了結賣壓。技術面觀察 315 元支撐位，法人籌碼雖有調節但長線展望不變。',
    chips: {
      mainForce: -8500, foreign: -6200, trust: 1200, dealer: -500,
      history: [
        { date: '04/23', mainForce: -8500, foreign: -6200, trust: 1200 },
        { date: '04/22', mainForce: 3200, foreign: 2100, trust: 850 },
        { date: '04/21', mainForce: 1500, foreign: 1100, trust: 400 },
        { date: '04/20', mainForce: 4500, foreign: 3200, trust: 1100 },
        { date: '04/17', mainForce: 2100, foreign: 1500, trust: 500 },
      ]
    }
  },
  { 
    id: '3', symbol: '6442', name: '光聖', price: 2020.0, change: 7.5, volRatio: 4.2, strength: 98, 
    reason: '【矽光子傳奇】CPO 訂單能見度直達 2027 年，光聖作為核心供應商，具備極高的獲利領先優勢。股價今日再次挑戰歷史新高，主力大戶瘋狂掃貨，籌碼極度集中。',
    chips: {
      mainForce: 12520, foreign: 8200, trust: 3200, dealer: 1120,
      history: [
        { date: '04/23', mainForce: 12520, foreign: 8200, trust: 3200 },
        { date: '04/22', mainForce: 4500, foreign: 3200, trust: 850 },
        { date: '04/21', mainForce: 1200, foreign: 800, trust: 300 },
        { date: '04/20', mainForce: 3500, foreign: 2500, trust: 650 },
        { date: '04/17', mainForce: 850, foreign: 500, trust: 250 },
      ]
    }
  },
  { 
    id: '4', symbol: '3017', name: '奇鋐', price: 2700.0, change: 5.2, volRatio: 2.5, strength: 94, 
    reason: '【冷卻之王】液冷技術進入全面商用，奇鋐的 CDU 與冷卻液出口全球第一。隨著伺服器功率攀升，熱管理需求無止盡增加。法人連續買超 15 日，強勢格局未變。',
    chips: {
      mainForce: 5100, foreign: 3200, trust: 1500, dealer: 400,
      history: [
        { date: '04/23', mainForce: 5100, foreign: 3200, trust: 1500 },
        { date: '04/22', mainForce: 2100, foreign: 1500, trust: 450 },
        { date: '04/21', mainForce: 800, foreign: 500, trust: 200 },
        { date: '04/20', mainForce: 1500, foreign: 1100, trust: 300 },
        { date: '04/17', mainForce: 600, foreign: 400, trust: 150 },
      ]
    }
  },
  { 
    id: '5', symbol: '3661', name: '世芯-KY', price: 3980.0, change: 2.1, volRatio: 1.5, strength: 88, 
    reason: '【AI ASIC 核心】雖然盤中遭遇小幅波動，但收盤仍展現強大韌性。2nm 設計案的權利金收入將在下半年進入認列高峰。券商報告一致給予強力買進評等，目標價直指 4500 元。',
    chips: {
      mainForce: 2150, foreign: 1450, trust: 450, dealer: 250,
      history: [
        { date: '04/23', mainForce: 2150, foreign: 1450, trust: 450 },
        { date: '04/22', mainForce: -200, foreign: -450, trust: 120 },
        { date: '04/21', mainForce: 850, foreign: 600, trust: 180 },
        { date: '04/20', mainForce: 1100, foreign: 800, trust: 250 },
        { date: '04/17', mainForce: 500, foreign: 350, trust: 100 },
      ]
    }
  },
];



export default function RocketScanner() {
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

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setActiveDetailTab('main');
    }
  };

  return (
    <div className="rocket-scanner-container card">
      <div className="scanner-header">
        <div className="scanner-title-group">
          <span className="scanner-badge">AI Scanner</span>
          <h3 className="scanner-title">潛力飆股快選</h3>
          <p className="scanner-subtitle">搜尋台股 1,000+ 標的，篩選高動能個股</p>
        </div>
        {!isScanning && !showResults && (
          <button className="scan-btn primary" onClick={startScan}>
            開始全市場掃描
          </button>
        )}
        {(isScanning || showResults) && (
          <button className="scan-btn secondary" onClick={startScan}>
            重新掃描
          </button>
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
                      <span className="value up">+{stock.change}%</span>
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

                    <div className="details-content">
                      {activeDetailTab === 'main' ? (
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
                                <span className={h.mainForce > 0 ? 'up' : 'down'}>{h.mainForce > 0 ? '+' : ''}{h.mainForce}</span>
                                <span className={h.foreign > 0 ? 'up' : 'down'}>{h.foreign > 0 ? '+' : ''}{h.foreign}</span>
                                <span className={h.trust > 0 ? 'up' : 'down'}>{h.trust > 0 ? '+' : ''}{h.trust}</span>
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
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isScanning && !showResults && (
        <div className="scanner-placeholder">
          <div className="placeholder-icon">🔍</div>
          <p>點擊按鈕分析台股 1,000+ 檔標的，找出今日最具潛力的 5 檔飆股。</p>
        </div>
      )}
    </div>
  );
}
