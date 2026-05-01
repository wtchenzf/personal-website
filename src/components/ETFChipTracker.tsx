import { useState, useEffect, useRef } from 'react';
import { fetchChips, fetchETFHoldings, isAPIConfigured } from '../utils/stockAPI';
import { type ChipData } from '../utils/technicalIndicators';
import './ETFChipTracker.css';

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface ETFHolding {
  rank:         number;
  code:         string;
  name:         string;
  prevShares:   number;        // 前一日持股張數（0 = 新增）
  shares:       number;        // 今日持股張數（0 = 出清）
  weight:       number;        // 今日持股權重 %
  weightChange?: number;       // 權重增減百分點（undefined = 不顯示）
  status:       'new' | 'add' | 'reduce' | 'exit';
}

interface ETFDayData {
  date:      string;   // 結算日   e.g. '04/28'
  prevDate:  string;   // 前一交易日 e.g. '04/27'
  newCount:  number;   // 新增檔數
  addCount:  number;   // 加碼檔數
  exitCount: number;   // 出清檔數
  buys:      ETFHolding[];
  sells:     ETFHolding[];
}

interface ETFInfo {
  id:       string;
  fullName: string;
  nav:      number;
  data:     ETFDayData;
}

// ── 持股異動資料 — 最後更新：2026/04/29 ─────────────────────────────────────────
// 主動型 ETF 每日持股異動由基金公司揭露，本站以 04/29 估算數據為基準。
// 三大法人動向（法人動向頁籤）由 TWSE T86 即時提供，每日 17:30 後自動更新。
const ETF_DATA: ETFInfo[] = [
  {
    id: '00981A',
    fullName: '主動統一台股增長ETF',
    nav: 17.75,   // 估算（04/29 盤後）
    data: {
      date: '04/29', prevDate: '04/28',
      newCount: 0, addCount: 5, exitCount: 0,
      buys: [
        { rank: 1, code: '2454', name: '聯發科',     prevShares:  4363, shares:  4580, weight: 5.12, weightChange: 0.28, status: 'add' },
        { rank: 2, code: '2327', name: '國巨',       prevShares: 16954, shares: 17820, weight: 2.48, weightChange: 0.13, status: 'add' },
        { rank: 3, code: '3711', name: '日月光投控', prevShares:  9536, shares: 10200, weight: 2.15, weightChange: 0.15, status: 'add' },
        { rank: 4, code: '1590', name: '亞德客-KY', prevShares:   500, shares:   880, weight: 0.53, weightChange: 0.23, status: 'add' },
        { rank: 5, code: '2337', name: '旺宏',       prevShares:  2910, shares:  3450, weight: 0.24, weightChange: 0.04, status: 'add' },
      ],
      sells: [
        { rank: 1, code: '2303', name: '聯電', prevShares: 40054, shares: 37500, weight: 1.12, weightChange: -0.16, status: 'reduce' },
      ],
    },
  },
  {
    id: '00991A',
    fullName: '國泰台灣半導體領航ETF',
    nav: 13.38,   // 估算（04/29 盤後）
    data: {
      date: '04/29', prevDate: '04/28',
      newCount: 0, addCount: 6, exitCount: 1,
      buys: [
        { rank: 1, code: '2454', name: '聯發科',  prevShares: 1524, shares: 1680, weight: 9.42, weightChange: 0.47, status: 'add' },
        { rank: 2, code: '6415', name: '矽力-KY', prevShares: 1040, shares: 1120, weight: 7.58, weightChange: 0.35, status: 'add' },
        { rank: 3, code: '3533', name: '嘉澤',    prevShares:  148, shares:  220, weight: 6.12, weightChange: 0.28, status: 'add' },
        { rank: 4, code: '8299', name: '群聯',    prevShares:  387, shares:  430, weight: 5.84, weightChange: 0.22, status: 'add' },
        { rank: 5, code: '3034', name: '聯詠',    prevShares:  710, shares:  745, weight: 6.28, weightChange: 0.13, status: 'add' },
        { rank: 6, code: '2379', name: '瑞昱',    prevShares:  620, shares:  655, weight: 5.55, weightChange: 0.14, status: 'add' },
      ],
      sells: [
        { rank: 1, code: '3037', name: '欣興', prevShares:  200, shares:    0, weight: 0.00, status: 'exit'   },
        { rank: 2, code: '2337', name: '旺宏', prevShares:  800, shares:  400, weight: 0.04, status: 'reduce' },
        { rank: 3, code: '3529', name: '力旺', prevShares:  255, shares:  180, weight: 4.72, weightChange: -0.21, status: 'reduce' },
      ],
    },
  },
  {
    id: '00992A',
    fullName: '元大台灣AI科技旗艦ETF',
    nav: 13.55,   // 估算（04/29 盤後，鴻海法說會利多）
    data: {
      date: '04/29', prevDate: '04/28',
      newCount: 1, addCount: 6, exitCount: 1,
      buys: [
        { rank: 1, code: '2317', name: '鴻海',   prevShares: 4178, shares: 5200, weight:  9.85, weightChange: 0.80, status: 'add' },
        { rank: 2, code: '2382', name: '廣達',   prevShares: 2121, shares: 2380, weight:  8.05, weightChange: 0.43, status: 'add' },
        { rank: 3, code: '3231', name: '緯創',   prevShares: 2163, shares: 2450, weight:  6.72, weightChange: 0.37, status: 'add' },
        { rank: 4, code: '2308', name: '台達電', prevShares:  208, shares:  380, weight:  6.15, weightChange: 0.70, status: 'add' },
        { rank: 5, code: '2356', name: '英業達', prevShares: 3116, shares: 3350, weight:  6.03, weightChange: 0.18, status: 'add' },
        { rank: 6, code: '3017', name: '奇鋐',   prevShares:  145, shares:  190, weight:  5.24, weightChange: 0.19, status: 'add' },
        { rank: 7, code: '6669', name: '緯穎',   prevShares:    0, shares:  350, weight:  3.85,                    status: 'new' },
      ],
      sells: [
        { rank: 1, code: '2330', name: '台積電', prevShares:  116, shares:    0, weight:  0.00, status: 'exit'   },
        { rank: 2, code: '3653', name: '健策',   prevShares:   54, shares:   30, weight:  4.58, weightChange: -0.17, status: 'reduce' },
        { rank: 3, code: '2357', name: '華碩',   prevShares:  120, shares:   60, weight:  0.12, weightChange: -0.04, status: 'reduce' },
      ],
    },
  },
];

// ── localStorage helpers ──────────────────────────────────────────────────────
const LS_KEY = (id: string) => `etf_holdings_v1_${id}`;

function loadOverride(id: string): ETFInfo | null {
  try {
    const raw = localStorage.getItem(LS_KEY(id));
    return raw ? (JSON.parse(raw) as ETFInfo) : null;
  } catch { return null; }
}
function saveOverride(info: ETFInfo) {
  localStorage.setItem(LS_KEY(info.id), JSON.stringify(info));
}
function clearOverride(id: string) {
  localStorage.removeItem(LS_KEY(id));
}
function loadAllOverrides(): Record<string, ETFInfo> {
  const out: Record<string, ETFInfo> = {};
  ETF_DATA.forEach(e => { const v = loadOverride(e.id); if (v) out[e.id] = v; });
  return out;
}

// Blank holding template
const blankHolding = (rank: number, side: 'buy' | 'sell'): ETFHolding => ({
  rank, code: '', name: '', prevShares: 0, shares: 0, weight: 0,
  status: side === 'buy' ? 'add' : 'reduce',
});

// ── Component ─────────────────────────────────────────────────────────────────
interface ETFChipTrackerProps {
  refreshTrigger?: number;
}

export default function ETFChipTracker({ refreshTrigger }: ETFChipTrackerProps) {
  const [activeETF,  setActiveETF]  = useState(ETF_DATA[0].id);
  const [chipView,   setChipView]   = useState<'holdings' | 'institutional'>(
    isAPIConfigured() ? 'institutional' : 'holdings'
  );
  const [editOpen,   setEditOpen]   = useState(false);

  // User-saved overrides (persisted in localStorage)
  const [overrides, setOverrides] = useState<Record<string, ETFInfo>>(loadAllOverrides);

  // Edit form state (draft before saving)
  const [draft, setDraft] = useState<ETFInfo | null>(null);

  // Real T86 三大法人 for each ETF
  const [instData, setInstData] = useState<Record<string, ChipData[]>>({});
  const cacheRef = useRef<Record<string, ChipData[]>>({});
  const apiOn = isAPIConfigured();

  // When refreshTrigger changes (parent pressed update), bust cache & re-fetch
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === 0) return;
    cacheRef.current = {};
    setInstData({});
  }, [refreshTrigger]);

  useEffect(() => {
    if (!apiOn) return;
    const etfCode = activeETF;
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
  }, [activeETF, apiOn, instData]);

  // Resolved data: user override > hardcoded default
  const baseETF   = ETF_DATA.find(e => e.id === activeETF) ?? ETF_DATA[0];
  const etf       = overrides[activeETF] ?? baseETF;
  const { data }  = etf;
  const isOverridden = !!overrides[activeETF];

  // ── Edit helpers ────────────────────────────────────────────────────────────
  const openEdit = () => {
    setDraft(JSON.parse(JSON.stringify(etf)));   // deep clone
    setEditOpen(true);
  };
  const closeEdit = () => { setEditOpen(false); setDraft(null); };

  const saveDraft = () => {
    if (!draft) return;
    // Recalculate counts from rows
    const d = {
      ...draft,
      data: {
        ...draft.data,
        newCount:  draft.data.buys.filter(h => h.status === 'new').length,
        addCount:  draft.data.buys.filter(h => h.status === 'add').length,
        exitCount: draft.data.sells.filter(h => h.status === 'exit').length,
      },
    };
    saveOverride(d);
    setOverrides(prev => ({ ...prev, [d.id]: d }));
    setEditOpen(false);
    setDraft(null);
  };

  const resetToDefault = () => {
    clearOverride(activeETF);
    setOverrides(prev => { const n = { ...prev }; delete n[activeETF]; return n; });
    setEditOpen(false);
    setDraft(null);
  };

  // Draft field setters
  const setDraftField = <K extends keyof ETFInfo>(k: K, v: ETFInfo[K]) =>
    setDraft(prev => prev ? { ...prev, [k]: v } : prev);
  const setDataField = <K extends keyof ETFDayData>(k: K, v: ETFDayData[K]) =>
    setDraft(prev => prev ? { ...prev, data: { ...prev.data, [k]: v } } : prev);

  const updateHolding = (side: 'buys' | 'sells', idx: number, field: keyof ETFHolding, val: string | number) =>
    setDraft(prev => {
      if (!prev) return prev;
      const arr = [...prev.data[side]] as ETFHolding[];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, data: { ...prev.data, [side]: arr } };
    });

  const addHolding = (side: 'buys' | 'sells') =>
    setDraft(prev => {
      if (!prev) return prev;
      const arr = prev.data[side] as ETFHolding[];
      const rank = arr.length + 1;
      return { ...prev, data: { ...prev.data, [side]: [...arr, blankHolding(rank, side === 'buys' ? 'buy' : 'sell')] } };
    });

  const removeHolding = (side: 'buys' | 'sells', idx: number) =>
    setDraft(prev => {
      if (!prev) return prev;
      const arr = (prev.data[side] as ETFHolding[]).filter((_, i) => i !== idx)
        .map((h, i) => ({ ...h, rank: i + 1 }));
      return { ...prev, data: { ...prev.data, [side]: arr } };
    });

  // ── Auto-fetch from MoneyDJ ──────────────────────────────────────────────
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoError,    setAutoError]    = useState<string | null>(null);

  const autoFetch = async () => {
    setAutoFetching(true);
    setAutoError(null);
    try {
      const result = await fetchETFHoldings(activeETF);
      if (!result) {
        setAutoError('無法取得資料 — 持股資料可能尚未更新（通常盤後 18:00 後可用），或 API 未設定。請稍後再試，或手動輸入。');
        setAutoFetching(false);
        return;
      }
      // Map API result → ETFInfo draft and open edit panel for review
      const newDraft: typeof etf = {
        ...etf,
        data: {
          date:      result.date,
          prevDate:  result.prevDate,
          newCount:  result.newCount,
          addCount:  result.addCount,
          exitCount: result.exitCount,
          buys:  result.buys.map(h => ({ ...h, weightChange: h.weightChange ?? undefined })),
          sells: result.sells.map(h => ({ ...h, weightChange: h.weightChange ?? undefined })),
        },
      };
      setDraft(newDraft);
      setEditOpen(true);
    } catch {
      setAutoError('發生錯誤，請稍後再試。');
    }
    setAutoFetching(false);
  };
  const instChips = instData[activeETF] ?? [];
  const latestChip = instChips.length ? instChips[instChips.length - 1] : null;
  const recent5    = instChips.slice(-5).reverse();

  return (
    <div className="etf-tracker-container card">

      {/* ── Header ── */}
      <div className="etf-tracker-header">
        <div>
          <span className="etf-tracker-badge">ETF 籌碼</span>
          <h3 className="etf-tracker-title">ETF 每日進出追蹤</h3>
          <p className="etf-tracker-subtitle">主動型 ETF 持股異動 · {data.prevDate} → {data.date}</p>
        </div>
        <div className="etf-nav-group">
          <span className="etf-nav-label">淨值 ({data.date} 最新)</span>
          <span className="etf-nav-value">{etf.nav.toFixed(2)}</span>
        </div>
      </div>

      {/* ── ETF selector ── */}
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
      <div className="etf-fullname">{etf.fullName}</div>

      {/* ── View toggle ── */}
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

      {/* ── Institutional view ── */}
      {chipView === 'institutional' && (
        <div className="etf-inst-view">
          {instChips.length === 0 ? (
            <p className="etf-inst-empty">
              {apiOn ? '資料載入中…' : '需設定 VITE_STOCK_API_URL 才能顯示即時資料'}
            </p>
          ) : (
            <>
              {latestChip && (
                <div className="etf-inst-summary">
                  {[
                    { label: '外資',     value: latestChip.foreign,   color: '#2962FF' },
                    { label: '投信',     value: latestChip.trust,     color: '#FF6D00' },
                    { label: '自營商',   value: latestChip.dealer,    color: '#7B1FA2' },
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

      {/* ── Holdings view ── */}
      {chipView === 'holdings' && !editOpen && (
        <div className="etf-holdings-view">

          {/* Update button row */}
          <div className="etf-update-bar">
            <span className="etf-update-date">
              {isOverridden && <span className="etf-override-dot" title="已套用自訂資料" />}
              資料日期：{data.prevDate} → {data.date}
            </span>
            <div className="etf-update-btns">
              {apiOn && (
                <button
                  className={`etf-auto-btn ${autoFetching ? 'loading' : ''}`}
                  onClick={autoFetch}
                  disabled={autoFetching}
                  title="自動取得最新持股（盤後 18:00 後可用）"
                >
                  <span className={`etf-auto-icon ${autoFetching ? 'spinning' : ''}`}>⬇</span>
                  {autoFetching ? '取得中…' : '自動更新'}
                </button>
              )}
              <button className="etf-update-btn" onClick={openEdit}>
                ✏️ 手動輸入
              </button>
            </div>
          </div>
          {autoError && (
            <div className="etf-auto-error">⚠ {autoError}</div>
          )}

          {/* 今日調整概況 */}
          <div className="etf-adj-summary">
            <span className="etf-adj-icon">📋</span>
            <span className="etf-adj-text">今日調整概況：</span>
            <span className="etf-adj-chip new">{data.newCount} 檔新增</span>
            <span className="etf-adj-sep">、</span>
            <span className="etf-adj-chip add">{data.addCount} 檔加碼</span>
            <span className="etf-adj-sep">、</span>
            <span className="etf-adj-chip exit">{data.exitCount} 檔出清</span>
          </div>

          {/* ── Buy / Add section ── */}
          <div className="etf-sec-hdr buy">
            <span className="etf-sec-deco">◀◀</span>
            <span className="etf-sec-label">【新增 / 加碼 / 權重】</span>
            <span className="etf-sec-deco">▶▶</span>
          </div>

          <div className="etf-hlist">
            {data.buys.map((h, idx) => (
              <div
                key={h.code}
                className={`etf-hrow ${h.status}`}
                style={{ animationDelay: `${idx * 45}ms` }}
              >
                {/* Rank */}
                <span className="etf-hrow-rank buy">{h.rank}.</span>

                {/* Name + shares */}
                <div className="etf-hrow-body">
                  <div className="etf-hrow-name">
                    {h.name}
                    <span className="etf-hrow-code"> ({h.code})</span>
                    {h.status === 'new' && <span className="etf-hrow-badge new">★ 新增</span>}
                  </div>
                  <div className="etf-hrow-shares">
                    <span className="etf-hrow-prev">{h.prevShares.toLocaleString()} 張</span>
                    <span className="etf-hrow-arrow">→</span>
                    <span className="etf-hrow-cur buy">{h.shares.toLocaleString()} 張</span>
                  </div>
                </div>

                {/* Weight */}
                <div className="etf-hrow-wt-group">
                  <span className="etf-hrow-wt buy">{h.weight.toFixed(2)}%</span>
                  {h.weightChange != null && h.weightChange > 0 && (
                    <span className="etf-hrow-wchg buy">(+{h.weightChange.toFixed(2)}%)</span>
                  )}
                </div>

                {/* Icon */}
                <div className="etf-hrow-icon buy">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* ── Sell / Exit section ── */}
          <div className="etf-sec-hdr sell">
            <span className="etf-sec-deco">◀◀</span>
            <span className="etf-sec-label">【減碼 / 出清 / 權重】</span>
            <span className="etf-sec-deco">▶▶</span>
          </div>

          <div className="etf-hlist">
            {data.sells.map((h, idx) => (
              <div
                key={h.code}
                className={`etf-hrow ${h.status}`}
                style={{ animationDelay: `${idx * 45}ms` }}
              >
                <span className="etf-hrow-rank sell">{h.rank}.</span>

                <div className="etf-hrow-body">
                  <div className="etf-hrow-name">
                    {h.name}
                    <span className="etf-hrow-code"> ({h.code})</span>
                    {h.status === 'exit' && <span className="etf-hrow-badge exit">▼ 出清</span>}
                  </div>
                  <div className="etf-hrow-shares">
                    <span className="etf-hrow-prev">{h.prevShares.toLocaleString()} 張</span>
                    <span className="etf-hrow-arrow">→</span>
                    <span className="etf-hrow-cur sell">{h.shares.toLocaleString()} 張</span>
                  </div>
                </div>

                <div className="etf-hrow-wt-group">
                  <span className="etf-hrow-wt sell">{h.weight.toFixed(2)}%</span>
                </div>

                <div className="etf-hrow-icon sell">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
                    <polyline points="17 18 23 18 23 12"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>

          <p className="etf-disclaimer">
            ※ 持股異動資料以 {data.date} 人工核對為基準（主動型 ETF 每日由基金公司揭露，非即時 API）。
            如需即時三大法人進出，請切換至「🏦 法人動向」頁籤（TWSE T86 每日 17:30 後自動更新）。
          </p>
        </div>
      )}

      {/* ── Edit panel ── */}
      {chipView === 'holdings' && editOpen && draft && (
        <div className="etf-edit-panel">

          <div className="etf-edit-header">
            <span className="etf-edit-title">✏️ 更新持股異動 — {draft.id}</span>
            <button className="etf-edit-close" onClick={closeEdit}>✕</button>
          </div>
          {!autoError && draft.data.date !== etf.data.date && (
            <div className="etf-edit-autofill-notice">
              {draft.data.buys.length + draft.data.sells.length > 0
                ? `✅ 已自動填入 ${draft.data.prevDate} → ${draft.data.date} 持股異動資料，請確認後點「儲存到本機」。`
                : `📋 已取得 ${draft.data.date} 完整持股（${draft.data.date === draft.data.prevDate ? '首次建立基準，下次執行時才會出現異動明細' : '無異動'}），請確認後點「儲存到本機」。`
              }
            </div>
          )}

          {/* Meta row: dates + NAV */}
          <div className="etf-edit-meta">
            <label className="etf-edit-field">
              <span>前一交易日</span>
              <input type="text" value={draft.data.prevDate} maxLength={5}
                onChange={e => setDataField('prevDate', e.target.value)} />
            </label>
            <span className="etf-edit-arrow">→</span>
            <label className="etf-edit-field">
              <span>今日</span>
              <input type="text" value={draft.data.date} maxLength={5}
                onChange={e => setDataField('date', e.target.value)} />
            </label>
            <label className="etf-edit-field etf-edit-nav">
              <span>淨值 (NAV)</span>
              <input type="number" step="0.01" value={draft.nav}
                onChange={e => setDraftField('nav', parseFloat(e.target.value) || 0)} />
            </label>
          </div>

          {/* Buys table */}
          <div className="etf-edit-section-hdr buy">▲ 加碼 / 新增</div>
          <div className="etf-edit-table">
            <div className="etf-edit-thead">
              <span>代碼</span><span>名稱</span><span>前日張數</span><span>今日張數</span>
              <span>權重%</span><span>狀態</span><span></span>
            </div>
            {draft.data.buys.map((h, i) => (
              <div key={i} className="etf-edit-row">
                <input value={h.code}  onChange={e => updateHolding('buys', i, 'code',  e.target.value)} placeholder="2454" />
                <input value={h.name}  onChange={e => updateHolding('buys', i, 'name',  e.target.value)} placeholder="聯發科" />
                <input type="number" value={h.prevShares} onChange={e => updateHolding('buys', i, 'prevShares', +e.target.value)} />
                <input type="number" value={h.shares}     onChange={e => updateHolding('buys', i, 'shares',     +e.target.value)} />
                <input type="number" step="0.01" value={h.weight} onChange={e => updateHolding('buys', i, 'weight', +e.target.value)} />
                <select value={h.status} onChange={e => updateHolding('buys', i, 'status', e.target.value as ETFHolding['status'])}>
                  <option value="new">★ 新增</option>
                  <option value="add">▲ 加碼</option>
                </select>
                <button className="etf-edit-del" onClick={() => removeHolding('buys', i)}>✕</button>
              </div>
            ))}
            <button className="etf-edit-add-row" onClick={() => addHolding('buys')}>＋ 新增一列</button>
          </div>

          {/* Sells table */}
          <div className="etf-edit-section-hdr sell">▼ 減碼 / 出清</div>
          <div className="etf-edit-table">
            <div className="etf-edit-thead">
              <span>代碼</span><span>名稱</span><span>前日張數</span><span>今日張數</span>
              <span>權重%</span><span>狀態</span><span></span>
            </div>
            {draft.data.sells.map((h, i) => (
              <div key={i} className="etf-edit-row">
                <input value={h.code}  onChange={e => updateHolding('sells', i, 'code',  e.target.value)} placeholder="2303" />
                <input value={h.name}  onChange={e => updateHolding('sells', i, 'name',  e.target.value)} placeholder="聯電" />
                <input type="number" value={h.prevShares} onChange={e => updateHolding('sells', i, 'prevShares', +e.target.value)} />
                <input type="number" value={h.shares}     onChange={e => updateHolding('sells', i, 'shares',     +e.target.value)} />
                <input type="number" step="0.01" value={h.weight} onChange={e => updateHolding('sells', i, 'weight', +e.target.value)} />
                <select value={h.status} onChange={e => updateHolding('sells', i, 'status', e.target.value as ETFHolding['status'])}>
                  <option value="reduce">▽ 減碼</option>
                  <option value="exit">✕ 出清</option>
                </select>
                <button className="etf-edit-del" onClick={() => removeHolding('sells', i)}>✕</button>
              </div>
            ))}
            <button className="etf-edit-add-row" onClick={() => addHolding('sells')}>＋ 新增一列</button>
          </div>

          {/* Action buttons */}
          <div className="etf-edit-actions">
            <button className="etf-edit-save" onClick={saveDraft}>💾 儲存到本機</button>
            <button className="etf-edit-reset" onClick={resetToDefault}>↺ 還原預設</button>
            <button className="etf-edit-cancel" onClick={closeEdit}>取消</button>
          </div>
          <p className="etf-edit-hint">※ 資料儲存於瀏覽器本機（localStorage），清除快取後需重新輸入。</p>
        </div>
      )}
    </div>
  );
}
