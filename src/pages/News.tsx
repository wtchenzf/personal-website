import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ExternalLink, Clock, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { fetchNews, isAPIConfigured, type NewsItem } from '../utils/stockAPI';
import './News.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'US' | 'TW';

interface CacheEntry {
  items:     NewsItem[];
  fetchedAt: number;   // Date.now()
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_KEY     = (cat: Category) => `news_cache_v2_${cat}`;
const CACHE_MAX_MS  = 30 * 60 * 1000;   // 30 min — matches Worker edge TTL

// Mock fallback data — shown when Worker is not configured or fetch fails
const MOCK_US: NewsItem[] = [
  {
    title:       'S&P 500 收高，科技股財報全面超越預期',
    link:        '#',
    description: '標普500指數上漲0.8%，主要科技公司第一季財報普遍優於華爾街預估，雲端運算與AI相關業務營收強勁成長為主要驅動力。那斯達克綜合指數同步走揚，半導體族群領漲。',
    pubDate:     new Date(Date.now() - 2 * 3600000).toUTCString(),
    source:      'MarketWatch',
  },
  {
    title:       '聯準會維持利率不變，暗示審慎前進',
    link:        '#',
    description: '聯準會（Fed）宣布維持基準利率不變，並表示需要看到通膨進一步降溫才會考慮降息。決策官員在就業市場韌性與通膨壓力之間仔細衡量，市場預期最快第三季方有降息可能。',
    pubDate:     new Date(Date.now() - 4 * 3600000).toUTCString(),
    source:      'Reuters',
  },
  {
    title:       '輝達數據中心營收再創紀錄，AI晶片需求持續爆發',
    link:        '#',
    description: '輝達（NVIDIA）公布季度財報，受惠AI晶片需求強勁，數據中心業務營收再創歷史高峰。雲端超大規模業者持續大幅擴張AI基礎建設資本支出，Blackwell架構出貨速度超乎預期。',
    pubDate:     new Date(Date.now() - 5 * 3600000).toUTCString(),
    source:      'CNBC Markets',
  },
  {
    title:       '就業數據強勁，美債10年期殖利率突破4.5%',
    link:        '#',
    description: '美國非農就業報告優於預期，強化聯準會按兵不動的市場共識，美國10年期公債殖利率應聲突破4.5%。市場重新評估降息時程，美元指數走強，科技成長股承受一定賣壓。',
    pubDate:     new Date(Date.now() - 7 * 3600000).toUTCString(),
    source:      'MarketWatch',
  },
  {
    title:       '蘋果WWDC揭示iOS 19重大AI功能，Siri全面升級',
    link:        '#',
    description: '蘋果（Apple）在年度開發者大會宣布iOS 19將內建大型語言模型，支援裝置端AI推論，Siri深度整合生成式AI。分析師認為此舉將帶動換機潮，刺激下半年iPhone出貨量回升。',
    pubDate:     new Date(Date.now() - 9 * 3600000).toUTCString(),
    source:      'Reuters',
  },
  {
    title:       '微軟Azure成長加速，季度營收大幅超越市場預估',
    link:        '#',
    description: '微軟（Microsoft）最新財報顯示Azure雲端平台成長動能強勁，AI服務滲透率持續提升。公司上調全年展望，稱企業對AI工作負載的需求仍在加速擴張，Copilot商業化成效顯著。',
    pubDate:     new Date(Date.now() - 11 * 3600000).toUTCString(),
    source:      'CNBC Markets',
  },
  {
    title:       '美國原油庫存意外增加，WTI油價回落',
    link:        '#',
    description: '美國能源資訊局（EIA）公布原油庫存意外累積，引發需求疑慮，WTI期貨價格走低。儘管OPEC+維持下半年限產協議，市場仍擔憂全球需求復甦力道不如預期，能源股承壓。',
    pubDate:     new Date(Date.now() - 13 * 3600000).toUTCString(),
    source:      'Investopedia',
  },
  {
    title:       '日本央行升息預期升溫，美元兌日圓走弱',
    link:        '#',
    description: '交易員加碼押注日本央行（BOJ）將在下次會議升息，理由是薪資成長持續且通膨高於目標。美元兌日圓匯率走軟，日圓連續第三日走升，日本出口商獲利了結壓力有所緩解。',
    pubDate:     new Date(Date.now() - 15 * 3600000).toUTCString(),
    source:      'Reuters',
  },
  {
    title:       '那斯達克100 ETF創週淨流入紀錄，AI樂觀情緒驅動',
    link:        '#',
    description: '投資人本週對追蹤那斯達克100指數的ETF投入創紀錄資金，AI題材持續帶動科技股風險偏好上升。半導體及軟體公司引領漲勢，QQQ單週淨申購規模創設立以來最高紀錄。',
    pubDate:     new Date(Date.now() - 18 * 3600000).toUTCString(),
    source:      'Investopedia',
  },
  {
    title:       '4月消費者信心指數小幅下滑，通膨憂慮仍存',
    link:        '#',
    description: '美國諮商局（Conference Board）4月消費者信心指數略微走低，受訪者普遍擔憂通膨走勢及就業市場不確定性。儘管讀數仍高於長期均值，部分經濟學家警告消費動能可能逐漸降溫。',
    pubDate:     new Date(Date.now() - 22 * 3600000).toUTCString(),
    source:      'MarketWatch',
  },
];

const MOCK_TW: NewsItem[] = [
  {
    title:       '台積電法說會：Q2 業績展望優預期，外資大幅調升目標價',
    link:        '#',
    description: '台積電第二季業績展望優於市場預期，受惠 AI 晶片需求持續強勁，CoWoS 先進封裝產能全力擴增。外資券商紛紛上調目標價至 1,100 元，法人預計全年 EPS 可達 75 元以上。',
    pubDate:     new Date(Date.now() - 1.5 * 3600000).toUTCString(),
    source:      '鉅亨網',
  },
  {
    title:       '外資連買14日！台股攻回 21,000 點，電子股全面揚升',
    link:        '#',
    description: '台股加權指數今日強勢突破 21,000 點關卡，外資連續第14個交易日買超，單日買超金額逾 120 億元。AI 伺服器族群帶頭上攻，台積電、廣達、緯穎漲幅均超過 2%。',
    pubDate:     new Date(Date.now() - 3 * 3600000).toUTCString(),
    source:      '鉅亨網',
  },
  {
    title:       '世芯-KY 再創新高，AI ASIC 訂單能見度至 2027 年底',
    link:        '#',
    description: '世芯-KY 股價再創歷史新高，公司表示 AI 推論 ASIC 客製晶片訂單充沛，能見度已延伸至 2027 年底，受惠 NVIDIA、Google 等超大型雲端業者持續加碼 AI 資本支出。',
    pubDate:     new Date(Date.now() - 4 * 3600000).toUTCString(),
    source:      'MoneyDJ',
  },
  {
    title:       '台灣 4 月出口年增 28%，AI 伺服器出口動能強勁',
    link:        '#',
    description: '財政部公布 4 月出口統計，受惠 AI 伺服器需求爆發，資訊與通信產品出口年增 35%，整體出口創單月新高。貿易順差擴大至 72 億美元，超越市場預期。',
    pubDate:     new Date(Date.now() - 6 * 3600000).toUTCString(),
    source:      '經濟日報',
  },
  {
    title:       '奇鋐液冷訂單滿載，下半年產能全面出貨',
    link:        '#',
    description: '奇鋐科技表示液冷散熱解決方案訂單已排滿下半年，主要客戶來自 Google、AWS、Meta 等超大規模資料中心業者，預估今年液冷業務營收占比將超過 40%。',
    pubDate:     new Date(Date.now() - 8 * 3600000).toUTCString(),
    source:      '鉅亨頭條',
  },
  {
    title:       '三大法人合計買超 280 億，台股籌碼持續集中',
    link:        '#',
    description: '昨日三大法人合計買超台股 280.4 億元，其中外資買超 210 億、投信買超 55 億、自營商買超 15 億。整體市場融資餘額連日攀升，顯示資金持續流入台股。',
    pubDate:     new Date(Date.now() - 10 * 3600000).toUTCString(),
    source:      'MoneyDJ',
  },
  {
    title:       '聯發科天璣 9400 出貨強勁，手機 AI 晶片市佔持續擴大',
    link:        '#',
    description: '聯發科表示旗艦 SoC 天璣 9400 出貨量超乎預期，多家 Android 旗艦手機品牌採用，帶動高階市場市佔率提升。法人預估全年出貨量年增逾 20%，EPS 上看 135 元。',
    pubDate:     new Date(Date.now() - 12 * 3600000).toUTCString(),
    source:      '鉅亨網',
  },
  {
    title:       'AI PC 需求爆發，欣興 ABF 載板第三季起供不應求',
    link:        '#',
    description: '欣興電子透露 AI PC 帶動高階 ABF 載板需求大增，第三季起預期出現供不應求局面，客戶端下單積極，公司已啟動新產線擴產計畫，預計 2027 年貢獻完整年度效益。',
    pubDate:     new Date(Date.now() - 14 * 3600000).toUTCString(),
    source:      '經濟日報',
  },
  {
    title:       '央行理監事會議：利率按兵不動，關注通膨與匯率',
    link:        '#',
    description: '中央銀行理監事會議宣布維持政策利率不變，並表示將持續關注國內通膨走勢與美元兌新台幣匯率波動，必要時採取適當措施維持金融市場穩定。',
    pubDate:     new Date(Date.now() - 16 * 3600000).toUTCString(),
    source:      '鉅亨頭條',
  },
  {
    title:       '投信大買！高力、健策本週累計買超逾 5,000 張',
    link:        '#',
    description: '投信法人本週持續加碼液冷散熱族群，高力、健策本週累計買超分別達 2,800 張與 2,400 張。業界預期 AI 資料中心冷卻需求將在下半年進一步爆發，相關族群基本面持續強化。',
    pubDate:     new Date(Date.now() - 20 * 3600000).toUTCString(),
    source:      'MoneyDJ',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins   = Math.floor(diffMs / 60000);
  const hours  = Math.floor(diffMs / 3600000);
  const days   = Math.floor(diffMs / 86400000);
  if (mins  <  1) return '剛剛';
  if (hours <  1) return `${mins} 分鐘前`;
  if (hours < 24) return `${hours} 小時前`;
  if (days  <  7) return `${days} 天前`;
  const m = d.getMonth() + 1, dd = d.getDate();
  return `${m}/${dd}`;
}

function formatUpdateTime(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Source → badge color mapping
const SOURCE_COLORS: Record<string, string> = {
  'MarketWatch':  '#0066cc',
  'CNBC Markets': '#cc0000',
  'CNBC':         '#cc0000',
  'Reuters':      '#ff6600',
  'Investopedia': '#1a6335',
  '鉅亨網':       '#c0392b',
  '鉅亨頭條':     '#c0392b',
  'MoneyDJ':      '#1a4a8a',
  '經濟日報':     '#2c6e49',
  '工商時報':     '#6b3fa0',
};
function sourceBadgeColor(src: string): string {
  return SOURCE_COLORS[src] ?? '#6b7280';
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="news-card news-card--skeleton">
      <div className="news-sk news-sk-meta" />
      <div className="news-sk news-sk-title" />
      <div className="news-sk news-sk-title2" />
      <div className="news-sk news-sk-desc" />
      <div className="news-sk news-sk-desc2" />
    </div>
  );
}

// ── News card ─────────────────────────────────────────────────────────────────

function NewsCard({ item }: { item: NewsItem }) {
  const ago  = timeAgo(item.pubDate);
  const col  = sourceBadgeColor(item.source);
  const isExternal = item.link && item.link !== '#';

  return (
    <article className="news-card">
      <div className="news-card-meta">
        <span className="news-source-badge" style={{ background: col }}>
          {item.source}
        </span>
        {ago && (
          <span className="news-time">
            <Clock size={11} />
            {ago}
          </span>
        )}
      </div>

      <h3 className="news-title">
        {isExternal ? (
          <a href={item.link} target="_blank" rel="noopener noreferrer">
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </h3>

      {item.description && (
        <p className="news-desc">{item.description}</p>
      )}

      {isExternal && (
        <a
          className="news-read-more"
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          閱讀全文
          <ExternalLink size={12} />
        </a>
      )}
    </article>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function News() {
  const [category, setCategory] = useState<Category>('TW');
  const [items, setItems]       = useState<NewsItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [isLive, setIsLive]     = useState(false);
  const fetchingRef             = useRef(false);

  // Load news: check localStorage cache first, then fetch from Worker
  const loadNews = useCallback(async (cat: Category, forceRefresh = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setError(false);

    // Check localStorage cache
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(CACHE_KEY(cat));
        if (raw) {
          const cached: CacheEntry = JSON.parse(raw);
          if (Date.now() - cached.fetchedAt < CACHE_MAX_MS && cached.items?.length) {
            setItems(cached.items);
            setUpdatedAt(cached.fetchedAt);
            setIsLive(isAPIConfigured());
            fetchingRef.current = false;
            return;
          }
        }
      } catch { /* ignore corrupt cache */ }
    }

    setLoading(true);

    if (!isAPIConfigured()) {
      // No Worker URL — show mock data instantly
      const mock = cat === 'TW' ? MOCK_TW : MOCK_US;
      setItems(mock);
      setUpdatedAt(Date.now());
      setIsLive(false);
      setLoading(false);
      fetchingRef.current = false;
      return;
    }

    try {
      const result = await fetchNews(cat, 25);
      if (result && result.items.length > 0) {
        const entry: CacheEntry = { items: result.items, fetchedAt: Date.now() };
        localStorage.setItem(CACHE_KEY(cat), JSON.stringify(entry));
        setItems(result.items);
        setUpdatedAt(entry.fetchedAt);
        setIsLive(true);
      } else {
        throw new Error('empty');
      }
    } catch {
      setError(true);
      // Fallback to mock on error
      const mock = cat === 'TW' ? MOCK_TW : MOCK_US;
      setItems(mock);
      setUpdatedAt(Date.now());
      setIsLive(false);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Initial load + on category switch
  useEffect(() => {
    setItems([]);
    loadNews(category);
  }, [category, loadNews]);

  const handleRefresh = () => {
    // Clear cache for this category
    localStorage.removeItem(CACHE_KEY(category));
    loadNews(category, true);
  };

  const catLabel = category === 'US' ? '美股' : '台股';

  return (
    <div className="news-page animate-fade-in">
      {/* ── Header ── */}
      <div className="news-header">
        <div>
          <span className="news-eyebrow">FINANCIAL NEWS</span>
          <h1 className="news-page-title">財經新聞</h1>
          <p className="news-page-subtitle">美股・台股 重要財經資訊，每日 08:00 前更新</p>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="news-status-bar">
        <span className={`status-dot ${isLive ? 'dot-live' : error ? 'dot-error' : 'dot-mock'}`} />
        <span>
          {isLive ? '即時資料' : error ? '資料暫無法取得，顯示範例' : '範例資料'}
        </span>
        <span className="news-status-sep">·</span>
        {isLive ? <Wifi size={13} /> : <WifiOff size={13} />}
        <span>最後更新：{formatUpdateTime(updatedAt)}</span>

        <button
          className={`news-refresh-btn ${loading ? 'loading' : ''}`}
          onClick={handleRefresh}
          disabled={loading}
          title="重新整理"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          {loading ? '更新中…' : '重新整理'}
        </button>
      </div>

      {/* ── Category tabs ── */}
      <div className="news-tabs">
        <button
          className={`news-tab ${category === 'TW' ? 'active' : ''}`}
          onClick={() => setCategory('TW')}
        >
          🇹🇼 台股
        </button>
        <button
          className={`news-tab ${category === 'US' ? 'active' : ''}`}
          onClick={() => setCategory('US')}
        >
          🇺🇸 美股
        </button>
      </div>

      {/* ── Error notice ── */}
      {error && !loading && (
        <div className="news-error-notice">
          <AlertCircle size={15} />
          <span>無法從新聞來源取得資料，目前顯示範例新聞。請稍後再試或確認網路狀態。</span>
        </div>
      )}

      {/* ── News grid ── */}
      <div className="news-grid">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : items.map((item, i) => <NewsCard key={`${item.source}-${i}`} item={item} />)
        }
      </div>

      {!loading && items.length === 0 && (
        <div className="news-empty">
          <p>目前沒有 {catLabel} 相關新聞，請稍後再試。</p>
        </div>
      )}
    </div>
  );
}
