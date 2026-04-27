import { useState, useEffect, useRef } from 'react';
import { fetchChips, isAPIConfigured } from '../utils/stockAPI';
import { type ChipData } from '../utils/technicalIndicators';
import './ETFChipTracker.css';

interface ETFHolding {
  rank: number;
  code: string;
  name: string;
  amount: number;   // 億元
  shares: number;   // 張
  tags: string[];
  weight: number;   // 持股權重 %
  status?: string;  // e.g. '刪除'
}

interface ETFDayData {
  date: string;
  buySummary: string;
  sellSummary: string;
  buys: ETFHolding[];
  sells: ETFHolding[];
}

interface ETFInfo {
  id: string;
  fullName: string;
  nav: number;
  data: ETFDayData;
}

// ── Mock data — 2026/04/24 ────────────────────────────────────────────────────
// 00981A buy list sourced from 籌碼小哥葛 community post; sells & other ETFs are
// high-fidelity mock data for display purposes.
const ETF_DATA: ETFInfo[] = [
  {
    id: '00981A',
    fullName: '富邦台灣AI人工智慧ETF',
    nav: 15.23,
    data: {
      date: '04/25',
      buySummary: 'AI 基礎建設與高階零組件持續擴大部位',
      sellSummary: '調節電池與部分非主線題材，釋放資金效率',
      buys: [
        { rank: 1, code: '2330', name: '台積電',   amount: 18.61, shares: 895,  tags: ['晶圓代工', '先進製程'], weight: 9.49 },
        { rank: 2, code: '2383', name: '台光電',   amount:  9.14, shares: 223,  tags: ['銅箔基板', 'AI伺服器'], weight: 8.02 },
        { rank: 3, code: '3653', name: '健策',     amount:  3.66, shares:  69,  tags: ['均熱片', '散熱'],       weight: 6.03 },
        { rank: 4, code: '2308', name: '台達電',   amount:  3.66, shares: 185,  tags: ['電源管理', 'AI伺服器'], weight: 5.97 },
        { rank: 5, code: '3665', name: '貿聯-KY', amount:  3.33, shares: 121,  tags: ['連接線束', '車用'],     weight: 5.43 },
        { rank: 6, code: '2345', name: '智邦',     amount:  3.22, shares: 155,  tags: ['網通', '白牌交換器'],   weight: 5.27 },
        { rank: 7, code: '3017', name: '奇鋐',     amount:  3.16, shares: 118,  tags: ['散熱模組', '水冷'],     weight: 5.16 },
        { rank: 8, code: '6223', name: '旺矽',     amount:  2.58, shares:  54,  tags: ['探針卡', '半導體測試'], weight: 4.26 },
      ],
      sells: [
        { rank: 1, code: '3211', name: '順達',   amount: 11.67, shares: 2964, tags: ['電池模組', 'BBU'],       weight: 0.18 },
        { rank: 2, code: '4979', name: '華星光', amount:  5.87, shares: 1036, tags: ['光通訊', 'CPO'],          weight: 0.01 },
        { rank: 3, code: '6187', name: '萬潤',   amount:  5.78, shares:  461, tags: ['半導體設備', 'CoWoS'],    weight: 0.00, status: '刪除' },
        { rank: 4, code: '1303', name: '南亞',   amount:  5.65, shares: 6642, tags: ['塑膠', '台塑集團'],       weight: 0.06 },
        { rank: 5, code: '6488', name: '環球晶', amount:  3.52, shares:  617, tags: ['矽晶圓', '半導體材料'],   weight: 0.10 },
        { rank: 6, code: '3008', name: '大立光', amount:  0.37, shares:   15, tags: ['光學鏡頭', '手機零組件'], weight: 0.02 },
      ],
    },
  },
  {
    id: '00991A',
    fullName: '國泰台灣半導體領航ETF',
    nav: 12.87,
    data: {
      date: '04/25',
      buySummary: '半導體設計龍頭強勢佈局，聚焦AI晶片與先進製程IP',
      sellSummary: '調節傳統封裝與記憶體，集中資金於高毛利IC設計',
      buys: [
        { rank: 1, code: '2454', name: '聯發科',  amount: 15.82, shares:  380, tags: ['SoC', 'AI晶片'],        weight: 8.95 },
        { rank: 2, code: '6415', name: '矽力-KY', amount:  8.45, shares:  192, tags: ['電源IC', '車用'],        weight: 7.23 },
        { rank: 3, code: '3034', name: '聯詠',    amount:  6.93, shares:  166, tags: ['驅動IC', 'OLED'],         weight: 6.15 },
        { rank: 4, code: '3533', name: '嘉澤',    amount:  4.22, shares:   98, tags: ['IC插槽', 'AI伺服器'],     weight: 5.84 },
        { rank: 5, code: '8299', name: '群聯',    amount:  3.98, shares:   87, tags: ['NAND控制', '企業儲存'],   weight: 5.62 },
        { rank: 6, code: '2379', name: '瑞昱',    amount:  3.75, shares:  145, tags: ['乙太網IC', 'AI伺服器'],   weight: 5.41 },
        { rank: 7, code: '3443', name: '創意',    amount:  3.44, shares:   77, tags: ['ASIC設計', 'CoWoS'],      weight: 5.18 },
        { rank: 8, code: '3529', name: '力旺',    amount:  2.87, shares:   55, tags: ['嵌入式記憶', 'IP授權'],   weight: 4.93 },
      ],
      sells: [
        { rank: 1, code: '2325', name: '矽品', amount: 9.32, shares: 3186, tags: ['晶片封裝', 'OSAT'],  weight: 0.22 },
        { rank: 2, code: '3005', name: '神基', amount: 4.65, shares:  823, tags: ['工業電腦', '軍用'],   weight: 0.15 },
        { rank: 3, code: '2337', name: '旺宏', amount: 4.18, shares: 1925, tags: ['NOR Flash', '車用'],  weight: 0.08 },
        { rank: 4, code: '3037', name: '欣興', amount: 3.86, shares:  490, tags: ['ABF基板', '載板'],    weight: 0.05 },
        { rank: 5, code: '8046', name: '南電', amount: 2.94, shares:  337, tags: ['載板', 'CoWoS'],      weight: 0.03, status: '刪除' },
      ],
    },
  },
  {
    id: '00992A',
    fullName: '元大台灣AI科技旗艦ETF',
    nav: 13.54,
    data: {
      date: '04/25',
      buySummary: 'AI伺服器組裝鏈加碼，散熱與電源管理雙主軸同步放大',
      sellSummary: '調節消費性電子與傳統IT，聚焦AI高成長標的',
      buys: [
        { rank: 1, code: '2330', name: '台積電', amount: 12.35, shares:  594, tags: ['晶圓代工', '先進製程'], weight: 10.25 },
        { rank: 2, code: '2317', name: '鴻海',   amount:  7.84, shares: 3543, tags: ['AI伺服器', '機器人'],   weight:  8.90 },
        { rank: 3, code: '2382', name: '廣達',   amount:  5.62, shares: 1740, tags: ['AI伺服器', '雲端'],     weight:  7.43 },
        { rank: 4, code: '3231', name: '緯創',   amount:  3.95, shares: 1892, tags: ['AI伺服器', '筆電'],     weight:  6.28 },
        { rank: 5, code: '2356', name: '英業達', amount:  3.28, shares: 2987, tags: ['伺服器', 'AI'],          weight:  5.76 },
        { rank: 6, code: '2308', name: '台達電', amount:  2.94, shares:  149, tags: ['電源管理', 'AI伺服器'], weight:  5.35 },
        { rank: 7, code: '3017', name: '奇鋐',   amount:  2.72, shares:  102, tags: ['散熱', '水冷'],          weight:  4.95 },
        { rank: 8, code: '3653', name: '健策',   amount:  2.45, shares:   46, tags: ['均熱片', '散熱'],        weight:  4.67 },
      ],
      sells: [
        { rank: 1, code: '5483', name: '中美晶', amount: 8.45, shares: 2345, tags: ['矽晶圓', '半導體材料'], weight: 0.31 },
        { rank: 2, code: '2357', name: '華碩',   amount: 5.23, shares:  285, tags: ['PC', '遊戲主機'],        weight: 0.18 },
        { rank: 3, code: '2324', name: '仁寶',   amount: 4.87, shares: 4567, tags: ['筆電', 'OEM'],           weight: 0.12 },
        { rank: 4, code: '2474', name: '可成',   amount: 3.95, shares:  428, tags: ['機殼', 'Apple供應'],     weight: 0.07 },
        { rank: 5, code: '6176', name: '瑞儀',   amount: 2.34, shares:  893, tags: ['背光模組', '面板'],      weight: 0.04, status: '刪除' },
      ],
    },
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ETFChipTracker() {
  const [activeETF,  setActiveETF]  = useState(ETF_DATA[0].id);
  const [section,    setSection]    = useState<'buy' | 'sell'>('buy');
  const [chipView,   setChipView]   = useState<'holdings' | 'institutional'>(
    isAPIConfigured() ? 'institutional' : 'holdings'
  );

  // Plan B: real T86 三大法人 for each ETF
  const [instData,   setInstData]   = useState<Record<string, ChipData[]>>({});
  const cacheRef = useRef<Record<string, ChipData[]>>({});
  const apiOn = isAPIConfigured();

  useEffect(() => {
    if (!apiOn) return;
    const etfCode = activeETF; // e.g. '00981A'
    if (cacheRef.current[etfCode]) {
      setInstData(prev => ({ ...prev, [etfCode]: cacheRef.current[etfCode] }));
      return;
    }
    fetchChips(etfCode).then(chips => {
      if (chips.length) {
        cacheRef.current[etfCode] = chips;
        setInstData(prev => ({ ...prev, [etfCode]: chips }));
      }
    }).catch(() => {/* silent */});
  }, [activeETF, apiOn]);

  const etf = ETF_DATA.find(e => e.id === activeETF) ?? ETF_DATA[0];
  const { data } = etf;
  const list = section === 'buy' ? data.buys : data.sells;
  const summary = section === 'buy' ? data.buySummary : data.sellSummary;

  const instChips   = instData[activeETF] ?? [];
  const latestChip  = instChips.length ? instChips[instChips.length - 1] : null;
  const recent5     = instChips.slice(-5).reverse();

  return (
    <div className="etf-tracker-container card">
      {/* Header */}
      <div className="etf-tracker-header">
        <div>
          <span className="etf-tracker-badge">ETF 籌碼</span>
          <h3 className="etf-tracker-title">ETF 每日進出追蹤</h3>
          <p className="etf-tracker-subtitle">主動型 AI ETF 持股異動 · 每日前十大買超 / 賣超標的</p>
        </div>
        <div className="etf-nav-group">
          <span className="etf-nav-label">淨值 (04/25)</span>
          <span className="etf-nav-value">{etf.nav.toFixed(2)}</span>
        </div>
      </div>

      {/* ETF selector */}
      <div className="etf-selector">
        {ETF_DATA.map(e => (
          <button
            key={e.id}
            className={`etf-tab ${activeETF === e.id ? 'active' : ''}`}
            onClick={() => setActiveETF(e.id)}
          >
            {e.id}
          </button>
        ))}
      </div>

      {/* ETF full name */}
      <div className="etf-fullname">{etf.fullName}</div>

      {/* View mode toggle: holdings vs institutional */}
      <div className="etf-view-toggle">
        <button
          className={`etf-view-btn ${chipView === 'holdings' ? 'active' : ''}`}
          onClick={() => setChipView('holdings')}
        >
          📋 持股異動
        </button>
        <button
          className={`etf-view-btn ${chipView === 'institutional' ? 'active' : ''}`}
          onClick={() => setChipView('institutional')}
        >
          {apiOn && instChips.length > 0
            ? <><span className="etf-live-dot" />法人動向（即時）</>
            : '🏦 法人動向'}
        </button>
      </div>

      {/* ── Institutional view (Plan B real T86 data) ── */}
      {chipView === 'institutional' && (
        <div className="etf-inst-view">
          {instChips.length === 0 ? (
            <p className="etf-inst-empty">
              {apiOn ? '資料載入中…' : '需設定 VITE_STOCK_API_URL 才能顯示即時資料'}
            </p>
          ) : (
            <>
              {/* Latest day summary cards */}
              {latestChip && (
                <div className="etf-inst-summary">
                  {[
                    { label: '外資', value: latestChip.foreign,   color: '#2962FF' },
                    { label: '投信', value: latestChip.trust,     color: '#FF6D00' },
                    { label: '自營商', value: latestChip.dealer,  color: '#7B1FA2' },
                    { label: '三大合計', value: latestChip.mainForce, color: latestChip.mainForce >= 0 ? '#c0392b' : '#4a7c59' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="etf-inst-card">
                      <span className="etf-inst-card-label">{label}</span>
                      <span className="etf-inst-card-val" style={{ color }}>
                        {value >= 0 ? '+' : ''}{value.toLocaleString()}
                      </span>
                      <span className="etf-inst-card-unit">張</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 5-day history table */}
              <div className="etf-inst-table">
                <div className="etf-inst-row etf-inst-header">
                  <span>日期</span><span>外資</span><span>投信</span><span>自營商</span><span>合計</span>
                </div>
                {recent5.map(d => (
                  <div key={d.time} className="etf-inst-row">
                    <span className="etf-inst-date">{d.time.slice(5)}</span>
                    <span className={d.foreign   >= 0 ? 'up' : 'down'}>{d.foreign   >= 0 ? '+' : ''}{d.foreign.toLocaleString()}</span>
                    <span className={d.trust     >= 0 ? 'up' : 'down'}>{d.trust     >= 0 ? '+' : ''}{d.trust.toLocaleString()}</span>
                    <span className={d.dealer    >= 0 ? 'up' : 'down'}>{d.dealer    >= 0 ? '+' : ''}{d.dealer.toLocaleString()}</span>
                    <span className={d.mainForce >= 0 ? 'up' : 'down'}>{d.mainForce >= 0 ? '+' : ''}{d.mainForce.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <p className="etf-inst-note">※ 三大法人資料來自 TWSE T86，每日 17:30 後更新（單位：張）</p>
            </>
          )}
        </div>
      )}

      {/* ── Holdings view (Plan A manual data) ── */}
      {chipView === 'holdings' && (
        <>
      {/* Buy / Sell toggle */}
      <div className="etf-section-toggle">
        <button
          className={`etf-toggle-btn buy ${section === 'buy' ? 'active' : ''}`}
          onClick={() => setSection('buy')}
        >
          ▲ 買超 Top {data.buys.length}
        </button>
        <button
          className={`etf-toggle-btn sell ${section === 'sell' ? 'active' : ''}`}
          onClick={() => setSection('sell')}
        >
          ▼ 賣超 Top {data.sells.length}
        </button>
      </div>

      {/* Section summary */}
      <div className={`etf-section-banner ${section}`}>
        <span className="etf-banner-etf">{activeETF}</span>
        <span className="etf-banner-dir">{section === 'buy' ? '買超' : '賣超'} Top {list.length}：</span>
        <span className="etf-banner-summary">{summary}</span>
      </div>

      {/* Stock list */}
      <div className="etf-stock-list">
        {list.map((h, idx) => (
          <div
            key={h.code}
            className={`etf-stock-row ${section}`}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* Rank */}
            <span className="etf-row-rank">{String(h.rank).padStart(2, '0')}</span>

            {/* Name group */}
            <div className="etf-row-name">
              <span className="etf-row-stockname">{h.name}</span>
              <span className="etf-row-code">({h.code})</span>
            </div>

            {/* Amount */}
            <div className="etf-row-amount">
              <span className={`etf-row-amt-val ${section}`}>
                {h.amount.toFixed(2)}億
              </span>
              <span className="etf-row-shares">({h.shares.toLocaleString()}張)</span>
            </div>

            {/* Tags */}
            <div className="etf-row-tags">
              {h.tags.map(tag => (
                <span key={tag} className="etf-tag">#{tag}</span>
              ))}
            </div>

            {/* Weight */}
            <div className="etf-row-weight">
              {h.status && <span className="etf-status-badge">{h.status}</span>}
              <span className="etf-weight-label">持股權重</span>
              <span className="etf-weight-val">{h.weight.toFixed(2)}%</span>
            </div>
          </div>
        ))}
      </div>

      <p className="etf-disclaimer">
        ※ 持股異動資料以 04/25 人工核對資料為基準，僅供介面參考，不代表實際 ETF 持股變化。
      </p>
        </>
      )}
    </div>
  );
}
