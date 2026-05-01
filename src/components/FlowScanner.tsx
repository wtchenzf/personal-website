import { useState } from 'react';
import './FlowScanner.css';

// ── Types ──────────────────────────────────────────────────────────────────────

interface SectorRow {
  name:       string;       // 產業名
  icon:       string;
  netFlow:    number;       // 億元，+ = 淨買超
  weekChg:    number;       // 相較上週變化，億元
  topStocks:  string[];     // 代表股
  hot:        boolean;
}

interface SmartMoneyStock {
  code:        string;
  name:        string;
  sector:      string;
  price:       number;
  changePct:   number;
  foreignDays: number;   // 外資連買天數
  trustDays:   number;   // 投信連買天數
  dealerDays:  number;   // 自營連買天數
  netBuyK:     number;   // 累積淨買（張）
  volRatio:    number;   // 成交量/20日均量
  pricePct:    number;   // 距近30日低點漲幅 %
  signal:      number;   // 0–100 綜合訊號
  tags:        string[];
  note:        string;
}

// ── Seed data — 04/30 ─────────────────────────────────────────────────────────

const SCAN_DATE = '04/30';

// 產業資金流向（三大法人合計，最近5個交易日，億元）
const SECTORS: SectorRow[] = [
  { name: 'AI 伺服器 / 雲端',   icon: '🤖', netFlow:  +428.5, weekChg: +112.3, topStocks: ['廣達2382','緯穎6669','鴻海2317'],   hot: true  },
  { name: '半導體製造',         icon: '⚡', netFlow:  +384.2, weekChg:  +88.4, topStocks: ['台積電2330','聯電2303'],             hot: true  },
  { name: 'AI 晶片 / ASIC',    icon: '🧠', netFlow:  +316.7, weekChg:  +95.1, topStocks: ['世芯-KY3661','信驊5274'],            hot: true  },
  { name: '液冷散熱 / 散熱',    icon: '🌊', netFlow:  +278.4, weekChg:  +64.2, topStocks: ['奇鋐3017','健策3222','高力8996'],   hot: true  },
  { name: '矽光子 / 光纖',      icon: '💡', netFlow:  +198.3, weekChg:  +71.5, topStocks: ['光聖6442','仲琦2419'],              hot: true  },
  { name: 'IC 設計',            icon: '🔧', netFlow:  +143.6, weekChg:  +22.8, topStocks: ['聯發科2454','聯詠3034','群聯8299'],  hot: false },
  { name: 'PCB / 載板',        icon: '📋', netFlow:  +112.0, weekChg:  +31.6, topStocks: ['欣興3037','南電8046','華通2313'],   hot: false },
  { name: '先進封裝 / OSAT',   icon: '📦', netFlow:   +88.3, weekChg:   +8.4, topStocks: ['日月光投控3711','力成6239'],        hot: false },
  { name: '記憶體 / HBM',      icon: '💾', netFlow:   +34.7, weekChg:  +18.2, topStocks: ['南亞科2408','華邦電2344'],          hot: false },
  { name: '網通 / 交換器',      icon: '🌐', netFlow:   +21.4, weekChg:   +5.3, topStocks: ['智邦2345','合勤0'],                hot: false },
  { name: '電動車 / 動力',      icon: '🚗', netFlow:   -18.2, weekChg:  -22.4, topStocks: ['台達電2308','英業達2356'],          hot: false },
  { name: '金融 / 壽險',        icon: '🏦', netFlow:   -42.6, weekChg:  -15.8, topStocks: ['富邦金2881','國泰金2882'],          hot: false },
  { name: '傳產 / 鋼鐵',        icon: '🏭', netFlow:   -87.3, weekChg:  -34.1, topStocks: ['中鋼2002','台塑1301'],              hot: false },
];

// 大戶連買追蹤（外資＋投信連買天數，截至 04/30）
const SMART_MONEY: SmartMoneyStock[] = [
  {
    code: '3661', name: '世芯-KY',   sector: 'AI ASIC',
    price: 4420,  changePct: +3.42,
    foreignDays: 14, trustDays: 9,  dealerDays: 3,
    netBuyK: 28450, volRatio: 2.1,  pricePct: 28.4,
    signal: 96,
    tags: ['外資連買14日', '投信連買9日', 'ASIC定製', '法人重押'],
    note: '為 NVIDIA 等大廠設計 AI 推論 ASIC，訂單能見度至 2027H1，外資視為 AI ASIC 首選標的持續加碼。',
  },
  {
    code: '3017', name: '奇鋐',      sector: '液冷散熱',
    price: 3120,  changePct: +2.88,
    foreignDays: 11, trustDays: 11, dealerDays: 5,
    netBuyK: 19820, volRatio: 1.8,  pricePct: 19.7,
    signal: 93,
    tags: ['外資連買11日', '投信同步11日', '液冷龍頭', '量增價漲'],
    note: 'AI 資料中心液冷散熱龍頭，Google、AWS 大單在手。投信與外資罕見同步連買 11 日，籌碼極乾淨。',
  },
  {
    code: '2330', name: '台積電',    sector: '半導體製造',
    price: 1055,  changePct: +1.63,
    foreignDays: 10, trustDays: 6,  dealerDays: 0,
    netBuyK: 31200, volRatio: 1.4,  pricePct: 14.2,
    signal: 90,
    tags: ['外資連買10日', 'CoWoS 滿載', 'N2 順利量產', '指標龍頭'],
    note: '外資近 10 日累積回補超過 3.1 萬張，CoWoS 封裝需求持續炸單，N2 良率優於預期，目標價上調至 1,250。',
  },
  {
    code: '6669', name: '緯穎',      sector: 'AI 伺服器',
    price: 2180,  changePct: +2.15,
    foreignDays: 9,  trustDays: 7,  dealerDays: 2,
    netBuyK: 12340, volRatio: 1.6,  pricePct: 22.1,
    signal: 88,
    tags: ['外資連買9日', 'AI伺服器ODM', 'GB200機架優先供應商'],
    note: '微軟、META AI 伺服器 ODM 主力，GB200 機架供應商，外資持續 9 日加碼，視為 AI 基礎建設直接受益股。',
  },
  {
    code: '5274', name: '信驊',      sector: 'AI ASIC',
    price: 1890,  changePct: +3.71,
    foreignDays: 9,  trustDays: 8,  dealerDays: 4,
    netBuyK: 5820,  volRatio: 2.3,  pricePct: 31.5,
    signal: 87,
    tags: ['外資連買9日', '投信連買8日', 'BMC龍頭', '量爆突破'],
    note: '全球 BMC 晶片龍頭，AI 伺服器每台必備，營收創歷史新高。外資+投信雙雙連買逾 8 日，小型股籌碼堆疊效果強。',
  },
  {
    code: '2382', name: '廣達',      sector: 'AI 伺服器',
    price: 348,   changePct: +1.17,
    foreignDays: 8,  trustDays: 4,  dealerDays: 0,
    netBuyK: 42100, volRatio: 1.3,  pricePct: 11.8,
    signal: 82,
    tags: ['外資連買8日', 'AI伺服器ODM最大', 'GB系列大單'],
    note: 'NVIDIA GB200/GB300 最大 ODM，外資連 8 日加碼，Q1 AI 伺服器營收季增 48%，法說會展望樂觀。',
  },
  {
    code: '6442', name: '光聖',      sector: '矽光子',
    price: 2150,  changePct: +5.40,
    foreignDays: 7,  trustDays: 10, dealerDays: 6,
    netBuyK: 4210,  volRatio: 3.4,  pricePct: 44.2,
    signal: 81,
    tags: ['投信連買10日', '外資連買7日', '矽光子龍頭', '爆量突破'],
    note: '矽光子 / 光電整合元件唯一台廠，與 Intel、Broadcom 合作量產中。投信率先大量佈局，已連買 10 日，籌碼集中度達 15%。',
  },
  {
    code: '3222', name: '健策',      sector: '液冷散熱',
    price: 895,   changePct: +3.94,
    foreignDays: 6,  trustDays: 8,  dealerDays: 3,
    netBuyK: 6740,  volRatio: 2.0,  pricePct: 26.4,
    signal: 78,
    tags: ['投信連買8日', '外資連買6日', '冷板液冷', '跟進奇鋐'],
    note: '液冷散熱冷板製造，受惠奇鋐帶動整個液冷供應鏈。投信連買 8 日，股本小、外資尚未大量介入，空間可觀。',
  },
  {
    code: '3037', name: '欣興',      sector: 'PCB / ABF載板',
    price: 218,   changePct: +1.86,
    foreignDays: 7,  trustDays: 5,  dealerDays: 1,
    netBuyK: 38500, volRatio: 1.5,  pricePct: 16.7,
    signal: 76,
    tags: ['外資連買7日', 'ABF載板', 'CoWoS受益', '量增'],
    note: 'ABF 載板龍頭，CoWoS 先進封裝帶動 ABF 需求爆發。外資連 7 日買超 3.85 萬張，主動 ETF 00981A 持續加碼。',
  },
  {
    code: '8996', name: '高力',      sector: '液冷散熱',
    price: 142,   changePct: +4.41,
    foreignDays: 5,  trustDays: 7,  dealerDays: 2,
    netBuyK: 4850,  volRatio: 2.6,  pricePct: 37.8,
    signal: 74,
    tags: ['投信連買7日', '外資連買5日', '冷排龍頭', '小型高彈性'],
    note: '液冷散熱冷排零組件，受惠 AI 伺服器機架液冷趨勢。主動 ETF 00981A / 00992A 均持有，籌碼被鎖。小股本，彈性大。',
  },
  {
    code: '2454', name: '聯發科',    sector: 'IC 設計',
    price: 1280,  changePct: +0.94,
    foreignDays: 5,  trustDays: 3,  dealerDays: 0,
    netBuyK: 15200, volRatio: 1.1,  pricePct: 8.4,
    signal: 65,
    tags: ['外資連買5日', 'AI手機', 'Dimensity旗艦', '築底完成'],
    note: '外資回補 5 日，Dimensity 9400+ 拿下三星、vivo 旗艦，AI 手機滲透率加速，下半年訂單能見度佳。',
  },
  {
    code: '3711', name: '日月光投控', sector: '先進封裝',
    price: 176,   changePct: +1.73,
    foreignDays: 5,  trustDays: 4,  dealerDays: 1,
    netBuyK: 24300, volRatio: 1.3,  pricePct: 12.9,
    signal: 63,
    tags: ['外資連買5日', '先進封裝', 'SiP量產', '估值低'],
    note: '全球最大 OSAT，SiP 封裝持續受惠 AI 需求，外資逢低回補。本益比相較同業偏低，防禦性佳。',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_FLOW = Math.max(...SECTORS.map(s => Math.abs(s.netFlow)));

function signalColor(score: number) {
  if (score >= 88) return '#c0392b';   // 強烈看多
  if (score >= 75) return '#e07b39';   // 積極看多
  if (score >= 60) return '#d4a017';   // 留意
  return '#6b7280';
}
function signalLabel(score: number) {
  if (score >= 88) return '強烈追蹤';
  if (score >= 75) return '積極佈局';
  if (score >= 60) return '觀察留意';
  return '參考';
}

function DayBadge({ days, label }: { days: number; label: string }) {
  if (!days) return null;
  const intensity = days >= 10 ? 'hot' : days >= 6 ? 'warm' : 'cool';
  return (
    <span className={`day-badge day-badge-${intensity}`}>
      {label}<br/><span className="day-num">{days}日</span>
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type FlowTab = 'sector' | 'smart';
type InstFilter = 'all' | 'foreign' | 'trust';

export default function FlowScanner() {
  const [activeTab, setActiveTab]     = useState<FlowTab>('sector');
  const [filter,    setFilter]        = useState<InstFilter>('all');
  const [expanded,  setExpanded]      = useState<string | null>(null);
  const [sortBy,    setSortBy]        = useState<'signal' | 'foreignDays' | 'trustDays'>('signal');

  // Sort + filter smart money list
  const sorted = [...SMART_MONEY]
    .filter(s => {
      if (filter === 'foreign') return s.foreignDays >= 5;
      if (filter === 'trust')   return s.trustDays   >= 5;
      return true;
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  // Sector totals for summary stats
  const totalInflow  = SECTORS.filter(s => s.netFlow > 0).reduce((a, s) => a + s.netFlow, 0);
  const totalOutflow = SECTORS.filter(s => s.netFlow < 0).reduce((a, s) => a + s.netFlow, 0);
  const hotCount     = SECTORS.filter(s => s.hot).length;

  return (
    <div className="flow-scanner-container card">

      {/* ── Header ── */}
      <div className="flow-header">
        <div className="flow-title-group">
          <span className="flow-badge">Smart Money Tracker</span>
          <h3 className="flow-title">資金流向 · 大戶連買追蹤</h3>
          <p className="flow-subtitle">法人動向 · 連買天數 · 產業熱區 · {SCAN_DATE} 盤後更新</p>
        </div>
        <div className="flow-summary-pills">
          <div className="summary-pill inflow">
            <span className="pill-label">5日淨流入</span>
            <span className="pill-val">+{totalInflow.toFixed(0)} 億</span>
          </div>
          <div className="summary-pill outflow">
            <span className="pill-label">5日淨流出</span>
            <span className="pill-val">{totalOutflow.toFixed(0)} 億</span>
          </div>
          <div className="summary-pill neutral">
            <span className="pill-label">熱門產業</span>
            <span className="pill-val">{hotCount} 個</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flow-tabs">
        <button
          className={`flow-tab-btn ${activeTab === 'sector' ? 'active' : ''}`}
          onClick={() => setActiveTab('sector')}
        >
          🔥 產業資金流向
        </button>
        <button
          className={`flow-tab-btn ${activeTab === 'smart' ? 'active' : ''}`}
          onClick={() => setActiveTab('smart')}
        >
          💎 大戶連買追蹤
        </button>
      </div>

      {/* ══ Tab: Sector Flow ══════════════════════════════════════════════════ */}
      {activeTab === 'sector' && (
        <div className="sector-flow-panel animate-fade-in">

          {/* Method note */}
          <div className="flow-method-note">
            📌 三大法人（外資＋投信＋自營商）近 5 個交易日合計買賣超，億元。正值 = 淨買超（資金流入）
          </div>

          {SECTORS.map((s, i) => {
            const isIn      = s.netFlow >= 0;
            const barWidth  = Math.abs(s.netFlow) / MAX_FLOW * 100;
            const weekUp    = s.weekChg >= 0;
            return (
              <div
                key={s.name}
                className={`sector-row ${i % 2 === 0 ? 'even' : ''} ${s.hot ? 'hot-sector' : ''}`}
              >
                {/* Rank + Icon + Name */}
                <div className="sector-left">
                  <span className="sector-rank">#{i + 1}</span>
                  <span className="sector-icon">{s.icon}</span>
                  <div className="sector-name-group">
                    <span className="sector-name">
                      {s.name}
                      {s.hot && <span className="hot-badge">🔥 HOT</span>}
                    </span>
                    <span className="sector-stocks">{s.topStocks.join(' · ')}</span>
                  </div>
                </div>

                {/* Bar */}
                <div className="sector-bar-wrap">
                  <div
                    className={`sector-bar ${isIn ? 'bar-in' : 'bar-out'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Flow value */}
                <div className="sector-right">
                  <span className={`sector-flow-val ${isIn ? 'price-up' : 'price-down'}`}>
                    {isIn ? '+' : ''}{s.netFlow.toFixed(1)} 億
                  </span>
                  <span className={`sector-week-chg ${weekUp ? 'price-up' : 'price-down'}`}>
                    {weekUp ? '▲' : '▼'} {Math.abs(s.weekChg).toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}

          <p className="flow-source-note">
            ※ 資料來源：TWSE T86 三大法人買賣超統計；04/30 盤後計算。周變化為相較前5個交易日之差值。
          </p>
        </div>
      )}

      {/* ══ Tab: Smart Money ══════════════════════════════════════════════════ */}
      {activeTab === 'smart' && (
        <div className="smart-money-panel animate-fade-in">

          {/* Filter + Sort toolbar */}
          <div className="sm-toolbar">
            <div className="sm-filter-group">
              <span className="toolbar-label">篩選：</span>
              {(['all', 'foreign', 'trust'] as InstFilter[]).map(f => (
                <button
                  key={f}
                  className={`sm-filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? '全部' : f === 'foreign' ? '外資連買5日↑' : '投信連買5日↑'}
                </button>
              ))}
            </div>
            <div className="sm-sort-group">
              <span className="toolbar-label">排序：</span>
              {([
                ['signal',      '綜合訊號'],
                ['foreignDays', '外資天數'],
                ['trustDays',   '投信天數'],
              ] as [typeof sortBy, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={`sm-filter-btn ${sortBy === key ? 'active' : ''}`}
                  onClick={() => setSortBy(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Signal legend */}
          <div className="sm-legend">
            <span className="legend-dot" style={{ background: '#c0392b' }}/>強烈追蹤 (88+)
            <span className="legend-dot" style={{ background: '#e07b39' }}/>積極佈局 (75+)
            <span className="legend-dot" style={{ background: '#d4a017' }}/>觀察留意 (60+)
          </div>

          {/* Stock cards */}
          <div className="sm-list">
            {sorted.map((s, idx) => {
              const isExp  = expanded === s.code;
              const isUp   = s.changePct >= 0;
              const color  = signalColor(s.signal);

              return (
                <div key={s.code} className={`sm-card ${isExp ? 'expanded' : ''}`}>
                  {/* ── Card header ── */}
                  <div
                    className="sm-card-header"
                    onClick={() => setExpanded(isExp ? null : s.code)}
                  >
                    {/* Left: rank + identity */}
                    <div className="sm-card-left">
                      <span className="sm-rank">#{idx + 1}</span>
                      <div className="sm-identity">
                        <div className="sm-name-row">
                          <span className="sm-code">{s.code}</span>
                          <span className="sm-name">{s.name}</span>
                          <span className="sm-sector-tag">{s.sector}</span>
                        </div>
                        <div className="sm-tags">
                          {s.tags.slice(0, 3).map(t => (
                            <span key={t} className="sm-tag">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Middle: consecutive days */}
                    <div className="sm-days-group">
                      <DayBadge days={s.foreignDays} label="外資" />
                      <DayBadge days={s.trustDays}   label="投信" />
                      <DayBadge days={s.dealerDays}  label="自營" />
                    </div>

                    {/* Right: price + signal */}
                    <div className="sm-card-right">
                      <div className="sm-price-group">
                        <span className="sm-price">{s.price.toLocaleString()}</span>
                        <span className={`sm-change ${isUp ? 'price-up' : 'price-down'}`}>
                          {isUp ? '▲' : '▼'} {Math.abs(s.changePct).toFixed(2)}%
                        </span>
                      </div>
                      <div className="sm-signal-box" style={{ borderColor: color }}>
                        <span className="sm-signal-num" style={{ color }}>{s.signal}</span>
                        <span className="sm-signal-label" style={{ color }}>{signalLabel(s.signal)}</span>
                      </div>
                      <span className="sm-expand-arrow">{isExp ? '▼' : '▶'}</span>
                    </div>
                  </div>

                  {/* ── Expanded detail ── */}
                  {isExp && (
                    <div className="sm-card-detail animate-fade-in">
                      <div className="detail-grid">
                        <div className="detail-stat">
                          <span className="ds-label">累積淨買（張）</span>
                          <span className="ds-val price-up">+{s.netBuyK.toLocaleString()}</span>
                        </div>
                        <div className="detail-stat">
                          <span className="ds-label">量能倍率</span>
                          <span className="ds-val">{s.volRatio.toFixed(1)}x</span>
                        </div>
                        <div className="detail-stat">
                          <span className="ds-label">距近30日低點</span>
                          <span className="ds-val price-up">+{s.pricePct.toFixed(1)}%</span>
                        </div>
                        <div className="detail-stat">
                          <span className="ds-label">訊號強度</span>
                          <div className="ds-signal-bar-wrap">
                            <div
                              className="ds-signal-bar"
                              style={{ width: `${s.signal}%`, background: color }}
                            />
                            <span className="ds-signal-num">{s.signal}/100</span>
                          </div>
                        </div>
                      </div>

                      {/* Analysis note */}
                      <div className="sm-note">
                        <span className="note-icon">📋</span>
                        <p>{s.note}</p>
                      </div>

                      {/* Warning */}
                      <div className="sm-warning">
                        ⚠ 以上分析僅供參考，股市有風險，買賣決策請自行判斷。法人連買不保證股價持續上漲。
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="flow-source-note">
            ※ 連買天數統計至 {SCAN_DATE}；累積淨買量以 TWSE T86 法人買賣超計算；訊號分數綜合連買天數、量能、價格動能等因素。
          </p>
        </div>
      )}
    </div>
  );
}
