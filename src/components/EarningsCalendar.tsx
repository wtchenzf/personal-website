import './EarningsCalendar.css';

interface EarningsEvent {
  date: string;       // YYYY-MM-DD
  code: string;
  name: string;
  time?: string;      // e.g. '14:00'
  quarter: string;    // e.g. 'Q1 2026'
  note?: string;
}

const EVENTS: EarningsEvent[] = [
  // ── April 2026 ──────────────────────────────────────────
  { date: '2026-04-17', code: '2330', name: '台積電',     time: '14:00', quarter: 'Q1 2026', note: '視訊/電話同步' },
  { date: '2026-04-22', code: '3008', name: '大立光',     time: '15:30', quarter: 'Q1 2026' },
  { date: '2026-04-24', code: '2303', name: '聯電',       time: '15:00', quarter: 'Q1 2026' },
  { date: '2026-04-28', code: '3711', name: '日月光投控', time: '15:00', quarter: 'Q1 2026' },
  { date: '2026-04-29', code: '2317', name: '鴻海',       time: '14:30', quarter: 'Q1 2026' },
  // ── May 2026 ────────────────────────────────────────────
  { date: '2026-05-06', code: '2327', name: '國巨',       time: '15:00', quarter: 'Q1 2026' },
  { date: '2026-05-07', code: '6669', name: '緯穎',       time: '15:00', quarter: 'Q1 2026' },
  { date: '2026-05-08', code: '2454', name: '聯發科',     time: '14:00', quarter: 'Q1 2026' },
  { date: '2026-05-09', code: '2345', name: '智邦',       time: '15:30', quarter: 'Q1 2026' },
  { date: '2026-05-12', code: '2382', name: '廣達',       time: '15:00', quarter: 'Q1 2026' },
  { date: '2026-05-13', code: '2308', name: '台達電',     time: '15:30', quarter: 'Q1 2026' },
  { date: '2026-05-14', code: '3231', name: '緯創',       time: '14:30', quarter: 'Q1 2026' },
  { date: '2026-05-14', code: '2356', name: '英業達',     time: '15:00', quarter: 'Q1 2026' },
  { date: '2026-05-15', code: '2412', name: '中華電信',   time: '14:00', quarter: 'Q1 2026' },
  { date: '2026-05-20', code: '2886', name: '兆豐金',     time: '15:00', quarter: 'Q1 2026' },
];

const TODAY = '2026-04-29';

function parseDate(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function formatMonthDay(d: string) {
  const [, m, day] = d.split('-').map(Number);
  return `${m}/${day}`;
}

function formatWeekday(d: string) {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return '（' + days[parseDate(d).getDay()] + '）';
}

/** Group events by date, return sorted entries */
function groupByDate(events: EarningsEvent[]) {
  const map = new Map<string, EarningsEvent[]>();
  for (const ev of events) {
    if (!map.has(ev.date)) map.set(ev.date, []);
    map.get(ev.date)!.push(ev);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function getStatus(date: string): 'past' | 'today' | 'upcoming' {
  if (date < TODAY) return 'past';
  if (date === TODAY) return 'today';
  return 'upcoming';
}

export default function EarningsCalendar() {
  const grouped = groupByDate(EVENTS);

  // Split into past (last 3 weeks) and upcoming
  const pastGroups = grouped.filter(([d]) => getStatus(d) === 'past');
  const todayGroups = grouped.filter(([d]) => getStatus(d) === 'today');
  const upcomingGroups = grouped.filter(([d]) => getStatus(d) === 'upcoming');

  const renderGroup = (date: string, events: EarningsEvent[]) => {
    const status = getStatus(date);
    return (
      <div key={date} className={`ec-day-group ec-${status}`}>
        <div className="ec-day-hdr">
          <span className="ec-day-date">{formatMonthDay(date)}</span>
          <span className="ec-day-weekday">{formatWeekday(date)}</span>
          {status === 'today' && <span className="ec-today-badge">今日</span>}
        </div>
        <div className="ec-events">
          {events.map((ev) => (
            <div key={ev.code + ev.date} className="ec-event">
              <span className="ec-code">{ev.code}</span>
              <span className="ec-name">{ev.name}</span>
              <span className="ec-quarter">{ev.quarter}</span>
              {ev.time && <span className="ec-time">{ev.time}</span>}
              {ev.note && <span className="ec-note">{ev.note}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="ec-section dashboard-section animate-delay-300 animate-fade-in">
      <span className="dashboard-eyebrow">Earnings Calendar</span>
      <h2 className="dashboard-title">台股大廠法說會</h2>
      <div className="dashboard-divider" />
      <p className="ec-desc">Q1 2026 財報法人說明會 · 日期以公司公告為準</p>

      <div className="ec-timeline">

        {/* Past */}
        {pastGroups.length > 0 && (
          <div className="ec-section-label ec-label-past">已舉行</div>
        )}
        {pastGroups.map(([d, evs]) => renderGroup(d, evs))}

        {/* Today */}
        {todayGroups.map(([d, evs]) => renderGroup(d, evs))}

        {/* Upcoming */}
        {upcomingGroups.length > 0 && (
          <div className="ec-section-label ec-label-upcoming">即將舉行</div>
        )}
        {upcomingGroups.map(([d, evs]) => renderGroup(d, evs))}

      </div>
    </div>
  );
}
