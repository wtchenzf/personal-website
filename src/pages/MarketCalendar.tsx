import { useState, useMemo } from 'react';
import './MarketCalendar.css';

// ── Types ─────────────────────────────────────────────────────────────────────
type Country    = 'US' | 'JP' | 'TW';
type Category   = 'macro' | 'earnings' | 'central-bank' | 'corporate';
type Importance = 'high' | 'medium' | 'low';
type ViewMode   = 'calendar' | 'list';
type Filter     = 'all' | Country;

interface CalEvent {
  id: string;
  date: string;       // 'YYYY-MM-DD'
  time?: string;      // e.g. '14:00 ET'
  title: string;
  country: Country;
  category: Category;
  importance: Importance;
  description: string;
  forecast?: string;
  previous?: string;
  actual?: string;    // if already released
}

// ── Event data (Apr–Jun 2026) ─────────────────────────────────────────────────
const EVENTS: CalEvent[] = [
  // ─── April 2026 — past ───────────────────────────────────────────────────
  { id:'us-nfp-mar',      date:'2026-04-03', time:'08:30 ET',
    title:'非農就業 NFP (3月)', country:'US', category:'macro', importance:'high',
    description:'3月非農就業人數，衡量美國就業市場強弱，影響聯準會利率決策走向。',
    forecast:'+20.5萬', previous:'+15.1萬', actual:'+17.7萬' },

  { id:'us-cpi-mar',      date:'2026-04-10', time:'08:30 ET',
    title:'CPI 通膨 (3月)', country:'US', category:'macro', importance:'high',
    description:'消費者物價指數年增率，聯準會最重視的通膨指標之一。',
    forecast:'+2.6% YoY', previous:'+2.8% YoY', actual:'+2.4% YoY' },

  { id:'us-ppi-mar',      date:'2026-04-11', time:'08:30 ET',
    title:'PPI 生產者物價 (3月)', country:'US', category:'macro', importance:'medium',
    description:'生產者物價指數，CPI 的領先通膨前瞻指標。',
    forecast:'+2.1% YoY', previous:'+2.3% YoY', actual:'+2.0% YoY' },

  { id:'us-meta-q1',      date:'2026-04-23', time:'盤後',
    title:'Meta Q1 2026 財報', country:'US', category:'earnings', importance:'high',
    description:'Meta Platforms Q1 財報，廣告收入與 AI Capex 指引。',
    actual:'EPS $6.43，Q2 展望優於預期，盤後 +7%' },

  { id:'us-alphabet-q1',  date:'2026-04-24', time:'盤後',
    title:'Alphabet Q1 2026 財報', country:'US', category:'earnings', importance:'high',
    description:'Google 母公司 Q1 財報，雲端 GCP 與搜尋廣告成長關鍵。',
    actual:'EPS $2.81，Google Cloud +28%，首季現金股利' },

  { id:'us-msft-q1',      date:'2026-04-24', time:'盤後',
    title:'Microsoft FY26 Q3 財報', country:'US', category:'earnings', importance:'high',
    description:'Azure 成長率與 Copilot 商業化進展是市場焦點。',
    actual:'EPS $3.45，Azure +35%，盤後 +5%' },

  { id:'us-pce-mar',      date:'2026-04-24', time:'08:30 ET',
    title:'PCE 通膨 (3月)', country:'US', category:'macro', importance:'high',
    description:'個人消費支出物價指數，Fed 最偏好的通膨指標。',
    actual:'+2.3% YoY (核心)' },

  { id:'tw-tsmc-q1',      date:'2026-04-14', time:'15:30 TPE',
    title:'台積電 Q1 2026 財報', country:'TW', category:'earnings', importance:'high',
    description:'台積電 Q1 營收與 EPS 公告。',
    actual:'EPS NT$16.83，Q2 展望優於預期' },

  { id:'tw-export-mar',   date:'2026-04-16', time:'16:00 TPE',
    title:'外銷訂單 (3月)', country:'TW', category:'macro', importance:'medium',
    description:'台灣 3 月外銷訂單，反映未來 1-3 個月出口動能。',
    actual:'+12.3% YoY' },

  { id:'tw-cpi-mar',      date:'2026-04-17', time:'16:00 TPE',
    title:'CPI 通膨 (3月)', country:'TW', category:'macro', importance:'medium',
    description:'台灣消費者物價指數，關注核心 CPI 與食品價格走向。',
    actual:'+2.1% YoY' },

  { id:'tw-tsmc-ir',      date:'2026-04-24', time:'14:00 TPE',
    title:'台積電 Q1 法說會', country:'TW', category:'corporate', importance:'high',
    description:'CC Wei 說明 CoWoS 擴產進度、AI 晶片訂單能見度與全年展望。',
    actual:'全年 Capex 指引上修至 $380–420億美元' },

  { id:'jp-boj-apr',      date:'2026-04-25', time:'12:00 JST',
    title:'BOJ 政策利率決定', country:'JP', category:'central-bank', importance:'high',
    description:'日本銀行利率決策，市場關注何時再次升息。植田和男後續記者會。',
    actual:'維持利率 0.50%，措辭偏鴿' },

  { id:'jp-cpi-mar',      date:'2026-04-25', time:'08:30 JST',
    title:'CPI 通膨 (3月)', country:'JP', category:'macro', importance:'medium',
    description:'日本 CPI，觀察薪資推動通膨能否持續支撐 BOJ 升息路徑。',
    actual:'+2.9% YoY (核心)' },

  // ─── April 2026 — upcoming ────────────────────────────────────────────────
  { id:'us-amzn-q1',      date:'2026-04-27', time:'盤後',
    title:'Amazon Q1 2026 財報', country:'US', category:'earnings', importance:'high',
    description:'AWS 雲端成長率、廣告收入與電商獲利改善是三大焦點。',
    forecast:'EPS 預期 $1.42，AWS 成長率預期 +25%' },

  { id:'us-apple-q2',     date:'2026-04-28', time:'盤後',
    title:'Apple FY26 Q2 財報', country:'US', category:'earnings', importance:'high',
    description:'iPhone 16 出貨量與 Apple Intelligence AI 功能採用率。',
    forecast:'EPS 預期 $1.65，iPhone 出貨預期 5,200萬支' },

  { id:'us-fomc-d1',      date:'2026-04-29', time:'全天',
    title:'FOMC 會議 (第 1 天)', country:'US', category:'central-bank', importance:'high',
    description:'聯準會兩日會議首日，討論利率政策方向，無對外聲明。' },

  { id:'us-confidence',   date:'2026-04-29', time:'10:00 ET',
    title:'消費者信心指數 (4月)', country:'US', category:'macro', importance:'medium',
    description:'Conference Board 消費者信心，觀察關稅衝擊對情緒影響。',
    forecast:'98.5', previous:'92.9' },

  { id:'us-fomc-dec',     date:'2026-04-30', time:'14:00 ET',
    title:'FOMC 利率決定 & 聲明', country:'US', category:'central-bank', importance:'high',
    description:'聯準會公布利率決策，14:30 鮑威爾記者會。市場預期維持不變 (4.25–4.50%)。',
    forecast:'維持 4.25–4.50%', previous:'4.25–4.50%' },

  { id:'us-gdp-q1',       date:'2026-04-30', time:'08:30 ET',
    title:'GDP Q1 初估值', country:'US', category:'macro', importance:'high',
    description:'2026 Q1 GDP 年化季增率初值，關稅政策是否已衝擊美國成長。',
    forecast:'+0.3% SAAR', previous:'+2.4%' },

  { id:'us-adp-apr',      date:'2026-04-30', time:'08:15 ET',
    title:'ADP 就業人數 (4月)', country:'US', category:'macro', importance:'medium',
    description:'ADP 私人部門就業，非農就業的前瞻參考指標。',
    forecast:'+12.5萬', previous:'+15.5萬' },

  // ─── May 2026 ─────────────────────────────────────────────────────────────
  { id:'us-nfp-apr',      date:'2026-05-01', time:'08:30 ET',
    title:'非農就業 NFP (4月)', country:'US', category:'macro', importance:'high',
    description:'4 月非農就業報告，關稅政策對就業市場的初步影響。',
    forecast:'+13.0萬', previous:'+17.7萬' },

  { id:'us-ism-svc',      date:'2026-05-05', time:'10:00 ET',
    title:'ISM 服務業 PMI (4月)', country:'US', category:'macro', importance:'medium',
    description:'服務業採購經理人指數，佔 GDP 約 70%，影響重大。',
    forecast:'52.3', previous:'50.8' },

  { id:'tw-mtk-q1',       date:'2026-05-08', time:'14:00 TPE',
    title:'聯發科 Q1 法說會', country:'TW', category:'corporate', importance:'high',
    description:'天璣 AI 晶片出貨量、PC AI 滲透率與 Q2 展望。' },

  { id:'us-cpi-apr',      date:'2026-05-12', time:'08:30 ET',
    title:'CPI 通膨 (4月)', country:'US', category:'macro', importance:'high',
    description:'關稅商品漲價效應是否開始反映在通膨數據，方向性意義重大。',
    forecast:'+2.8% YoY', previous:'+2.4% YoY' },

  { id:'us-ppi-apr',      date:'2026-05-13', time:'08:30 ET',
    title:'PPI 生產者物價 (4月)', country:'US', category:'macro', importance:'medium',
    description:'反映關稅成本向下游傳遞速度。',
    forecast:'+2.4% YoY', previous:'+2.0% YoY' },

  { id:'jp-gdp-q1',       date:'2026-05-18', time:'08:50 JST',
    title:'GDP Q1 初估', country:'JP', category:'macro', importance:'high',
    description:'日本 Q1 GDP，關注關稅衝擊對出口導向經濟的影響程度。',
    forecast:'-0.1% SAAR', previous:'+1.2%' },

  { id:'us-nvda-q1',      date:'2026-05-21', time:'盤後',
    title:'NVIDIA FY27 Q1 財報', country:'US', category:'earnings', importance:'high',
    description:'Blackwell GB200/300 出貨量、資料中心展望、中國出貨限制影響評估。',
    forecast:'EPS 預期 $0.92，資料中心營收預期 $43B' },

  { id:'jp-cpi-apr',      date:'2026-05-22', time:'08:30 JST',
    title:'CPI 通膨 (4月)', country:'JP', category:'macro', importance:'medium',
    description:'日本 4 月 CPI，BOJ 下次升息時機的關鍵數據。',
    forecast:'+3.1% YoY (核心)', previous:'+2.9% YoY' },

  { id:'tw-export-apr',   date:'2026-05-22', time:'16:00 TPE',
    title:'外銷訂單 (4月)', country:'TW', category:'macro', importance:'medium',
    description:'台灣 4 月外銷訂單，AI 伺服器能見度最關鍵的月份之一。',
    forecast:'+15% YoY' },

  { id:'us-gdp-q1r',      date:'2026-05-28', time:'08:30 ET',
    title:'GDP Q1 修正值', country:'US', category:'macro', importance:'medium',
    description:'Q1 GDP 修正版，納入更完整消費與貿易數據。',
    forecast:'+0.2% SAAR', previous:'+0.3% (初估)' },

  { id:'us-pce-apr',      date:'2026-05-28', time:'08:30 ET',
    title:'PCE 通膨 (4月)', country:'US', category:'macro', importance:'high',
    description:'4 月 PCE，Fed 最重視的通膨指標，影響 6 月 FOMC 方向。',
    forecast:'+2.6% YoY (核心)', previous:'+2.3% YoY' },

  // ─── June 2026 ────────────────────────────────────────────────────────────
  { id:'us-nfp-may',      date:'2026-06-05', time:'08:30 ET',
    title:'非農就業 NFP (5月)', country:'US', category:'macro', importance:'high',
    description:'5 月非農就業，Fed 6 月會議前最後一份就業報告，影響降息路徑。',
    forecast:'+15.0萬', previous:'+13.0萬' },

  { id:'us-cpi-may',      date:'2026-06-10', time:'08:30 ET',
    title:'CPI 通膨 (5月)', country:'US', category:'macro', importance:'high',
    description:'FOMC 6/16–17 會議前最後一份 CPI，對本次決策方向性影響極大。',
    forecast:'+2.7% YoY', previous:'+2.8% YoY' },

  { id:'us-ppi-may',      date:'2026-06-11', time:'08:30 ET',
    title:'PPI 生產者物價 (5月)', country:'US', category:'macro', importance:'medium',
    description:'5 月 PPI，持續觀察關稅成本傳遞路徑。',
    forecast:'+2.3% YoY', previous:'+2.4% YoY' },

  { id:'jp-boj-jun',      date:'2026-06-16', time:'12:00 JST',
    title:'BOJ 政策利率決定', country:'JP', category:'central-bank', importance:'high',
    description:'市場預期可能升息至 0.75%，植田和男發布會後解讀關鍵。',
    forecast:'升息至 0.75%', previous:'0.50%' },

  { id:'us-fomc-jun-d1',  date:'2026-06-16', time:'全天',
    title:'FOMC 會議 (第 1 天)', country:'US', category:'central-bank', importance:'high',
    description:'聯準會 2026 年第 4 次會議，同步更新 SEP 季度預測（含點陣圖）。' },

  { id:'us-fomc-jun-dec', date:'2026-06-17', time:'14:00 ET',
    title:'FOMC 利率決定 & 點陣圖', country:'US', category:'central-bank', importance:'high',
    description:'宣布利率並發布 SEP 點陣圖，為全年降息路徑最重要訊號。',
    forecast:'維持 or 降息 1碼', previous:'4.25–4.50%' },

  { id:'us-retail-may',   date:'2026-06-17', time:'08:30 ET',
    title:'零售銷售 (5月)', country:'US', category:'macro', importance:'medium',
    description:'5 月零售銷售，觀察美國消費者是否受關稅通膨影響而縮手。',
    forecast:'+0.3% MoM', previous:'-0.2% MoM' },

  { id:'jp-cpi-may',      date:'2026-06-19', time:'08:30 JST',
    title:'CPI 通膨 (5月)', country:'JP', category:'macro', importance:'medium',
    description:'日本 5 月 CPI，BOJ 下半年升息路徑持續觀察。' },

  { id:'tw-export-may',   date:'2026-06-20', time:'16:00 TPE',
    title:'外銷訂單 (5月)', country:'TW', category:'macro', importance:'medium',
    description:'台灣 5 月外銷訂單，半年度台廠 AI 伺服器訂單強弱指標。' },

  { id:'tw-cpi-may',      date:'2026-06-20', time:'16:00 TPE',
    title:'CPI 通膨 (5月)', country:'TW', category:'macro', importance:'low',
    description:'台灣 5 月消費者物價指數。' },

  { id:'us-pce-may',      date:'2026-06-26', time:'08:30 ET',
    title:'PCE 通膨 (5月)', country:'US', category:'macro', importance:'high',
    description:'5 月 PCE，Q2 結束，Fed 下半年降息節奏關鍵指標。',
    forecast:'+2.5% YoY (核心)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const FLAG: Record<Country, string>    = { US: '🇺🇸', JP: '🇯🇵', TW: '🇹🇼' };
const COUNTRY_LABEL: Record<Country, string> = { US: '美股', JP: '日股', TW: '台股' };
const CAT_ICON: Record<Category, string>     = {
  'macro': '📊', 'earnings': '💹', 'central-bank': '🏦', 'corporate': '🏢',
};
const IMP_LABEL: Record<Importance, string> = { high: '高', medium: '中', low: '低' };

const MONTHS = ['2026-04', '2026-05', '2026-06'];
const MONTH_NAMES = ['2026 年 4 月', '2026 年 5 月', '2026 年 6 月'];
const TODAY = '2026-04-26';
const DOW = ['一','二','三','四','五','六','日'];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Mon-first week grid
function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month+1, 0);
  const offset = (first.getDay() + 6) % 7; // Mon=0

  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i+7));
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MarketCalendar() {
  const [monthIdx, setMonthIdx]     = useState(0);          // 0=Apr, 1=May, 2=Jun
  const [viewMode, setViewMode]     = useState<ViewMode>('calendar');
  const [filter, setFilter]         = useState<Filter>('all');
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);

  const [year, mon] = MONTHS[monthIdx].split('-').map(Number);

  // Filter events by month & country
  const monthEvents = useMemo(() =>
    EVENTS.filter(e => {
      const inMonth = e.date.startsWith(MONTHS[monthIdx]);
      const inFilter = filter === 'all' || e.country === filter;
      return inMonth && inFilter;
    }), [monthIdx, filter]);

  // Map date → events for quick calendar lookup
  const eventsByDate = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    monthEvents.forEach(e => { (m[e.date] ??= []).push(e); });
    return m;
  }, [monthEvents]);

  // Events for selected day panel
  const dayEvents = useMemo(() =>
    (eventsByDate[selectedDate] ?? []).sort((a, b) =>
      (a.importance === 'high' ? 0 : a.importance === 'medium' ? 1 : 2) -
      (b.importance === 'high' ? 0 : b.importance === 'medium' ? 1 : 2)
    ), [eventsByDate, selectedDate]);

  // Grouped list for list-view
  const listGroups = useMemo(() => {
    const sorted = [...monthEvents].sort((a, b) => a.date.localeCompare(b.date));
    const groups: { date: string; events: CalEvent[] }[] = [];
    sorted.forEach(e => {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.events.push(e);
      else groups.push({ date: e.date, events: [e] });
    });
    return groups;
  }, [monthEvents]);

  const grid = useMemo(() => monthGrid(year, mon - 1), [year, mon]);

  const isToday  = (d: string) => d === TODAY;
  const isPast   = (d: string) => d < TODAY;
  const hasEvent = (d: string) => !!eventsByDate[d];

  return (
    <div className="cal-page animate-fade-in">

      {/* ── Page header ── */}
      <div className="cal-page-header">
        <span className="cal-eyebrow">Market Events</span>
        <h1 className="section-title">重要行事曆</h1>
        <p className="cal-subtitle">美股 · 日股 · 台股 — 總體經濟 · 央行決策 · 法說財報</p>
      </div>

      {/* ── Controls ── */}
      <div className="cal-controls">
        {/* Month nav */}
        <div className="cal-month-nav">
          <button className="cal-nav-btn" onClick={() => setMonthIdx(i => Math.max(0, i-1))} disabled={monthIdx === 0}>‹</button>
          <span className="cal-month-label">{MONTH_NAMES[monthIdx]}</span>
          <button className="cal-nav-btn" onClick={() => setMonthIdx(i => Math.min(2, i+1))} disabled={monthIdx === 2}>›</button>
        </div>

        {/* View toggle */}
        <div className="cal-view-toggle">
          <button className={`cal-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`} onClick={() => setViewMode('calendar')}>📅 月曆</button>
          <button className={`cal-toggle-btn ${viewMode === 'list'     ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰ 清單</button>
        </div>

        {/* Country filter */}
        <div className="cal-filter">
          {(['all','US','JP','TW'] as Filter[]).map(f => (
            <button key={f} className={`cal-filter-btn ${filter === f ? 'active' : ''} ${f !== 'all' ? `filter-${f}` : ''}`}
              onClick={() => setFilter(f)}>
              {f === 'all' ? '全部' : `${FLAG[f as Country]} ${COUNTRY_LABEL[f as Country]}`}
            </button>
          ))}
        </div>
      </div>

      {/* ════ Calendar view ════ */}
      {viewMode === 'calendar' && (
        <div className="cal-layout">

          {/* Grid */}
          <div className="cal-grid-wrap">
            <div className="cal-dow-row">
              {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
            </div>
            {grid.map((week, wi) => (
              <div key={wi} className="cal-week">
                {week.map((day, di) => {
                  if (!day) return <div key={di} className="cal-day empty" />;
                  const ymd = toYMD(day);
                  const evts = eventsByDate[ymd] ?? [];
                  const isSelected = ymd === selectedDate;
                  const cls = [
                    'cal-day',
                    isToday(ymd)    ? 'today'    : '',
                    isPast(ymd)     ? 'past'     : '',
                    isSelected      ? 'selected' : '',
                    hasEvent(ymd)   ? 'has-event': '',
                  ].filter(Boolean).join(' ');

                  return (
                    <div key={di} className={cls} onClick={() => setSelectedDate(ymd)}>
                      <span className="cal-day-num">{day.getDate()}</span>
                      {evts.length > 0 && (
                        <div className="cal-dots">
                          {evts.slice(0, 4).map(e => (
                            <span key={e.id} className={`cal-dot dot-${e.country} ${e.importance === 'high' ? 'dot-high' : ''}`} />
                          ))}
                          {evts.length > 4 && <span className="cal-dot-more">+{evts.length - 4}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Day panel */}
          <div className="cal-day-panel">
            <div className="cal-panel-header">
              <span className="cal-panel-date">
                {selectedDate
                  ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })
                  : '選擇日期'}
              </span>
              {dayEvents.length === 0 && (
                <p className="cal-panel-empty">本日無事件</p>
              )}
            </div>
            <div className="cal-panel-events">
              {dayEvents.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          </div>
        </div>
      )}

      {/* ════ List view ════ */}
      {viewMode === 'list' && (
        <div className="cal-list-view">
          {listGroups.length === 0 && (
            <div className="cal-list-empty">本月無符合篩選條件的事件。</div>
          )}
          {listGroups.map(g => {
            const d = new Date(g.date + 'T00:00:00');
            const label = d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
            return (
              <div key={g.date} className={`cal-list-group ${isToday(g.date) ? 'list-today' : ''} ${isPast(g.date) ? 'list-past' : ''}`}>
                <div className="cal-list-date-row">
                  <span className="cal-list-date-label">{label}</span>
                  {isToday(g.date) && <span className="cal-today-badge">今天</span>}
                  {isPast(g.date)  && <span className="cal-past-badge">已過</span>}
                </div>
                <div className="cal-list-events">
                  {g.events
                    .sort((a, b) => (a.importance === 'high' ? 0 : a.importance === 'medium' ? 1 : 2) - (b.importance === 'high' ? 0 : b.importance === 'medium' ? 1 : 2))
                    .map(e => <EventCard key={e.id} event={e} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="cal-legend">
        <span className="legend-item"><span className="cal-dot dot-US dot-high" />高重要性</span>
        <span className="legend-item"><span className="cal-dot dot-US" />美股</span>
        <span className="legend-item"><span className="cal-dot dot-JP" />日股</span>
        <span className="legend-item"><span className="cal-dot dot-TW" />台股</span>
        <span className="legend-item cal-legend-sep">已公布事件顯示實際數據</span>
      </div>
    </div>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────
function EventCard({ event: e }: { event: CalEvent }) {
  const isPast = e.date <= TODAY;
  return (
    <div className={`ev-card ev-${e.country} ${e.importance === 'high' ? 'ev-high' : ''} ${isPast ? 'ev-past' : 'ev-upcoming'}`}>
      <div className="ev-card-top">
        <div className="ev-badges">
          <span className={`ev-imp ev-imp-${e.importance}`}>{IMP_LABEL[e.importance]}</span>
          <span className="ev-flag">{FLAG[e.country]}</span>
          <span className="ev-cat-icon">{CAT_ICON[e.category]}</span>
        </div>
        {e.time && <span className="ev-time">{e.time}</span>}
      </div>

      <div className="ev-title">{e.title}</div>
      <div className="ev-desc">{e.description}</div>

      {(e.actual || e.forecast || e.previous) && (
        <div className="ev-data-row">
          {e.actual   && <span className="ev-data actual"><span>實際</span>{e.actual}</span>}
          {e.forecast && <span className="ev-data forecast"><span>預期</span>{e.forecast}</span>}
          {e.previous && <span className="ev-data previous"><span>前值</span>{e.previous}</span>}
        </div>
      )}
    </div>
  );
}
