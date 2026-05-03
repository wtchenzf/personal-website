import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, ExternalLink, Clock, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { fetchNews, isAPIConfigured, type NewsItem } from '../utils/stockAPI';
import './News.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'US' | 'TW';

interface CacheEntry {
  items:     NewsItem[];
  fetchedAt: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_KEY    = (cat: Category) => `news_cache_v3_${cat}`;
const CACHE_MAX_MS = 30 * 60 * 1000;   // 30 min
const NEWS_COUNT   = 10;

// ── Mock data ─────────────────────────────────────────────────────────────────

const now = () => Date.now();

const MOCK_US: NewsItem[] = [
  {
    title:       'Fed 維持利率不變，鮑威爾稱將持續觀察通膨走勢',
    link:        'https://www.reuters.com/markets/rates-bonds/',
    description: '聯準會 5 月會議一致決議按兵不動，鮑威爾在記者會強調現行政策立場具有限制性，委員會需要更多數據確認通膨向 2% 目標持續邁進才考慮調整。期貨市場對首次降息預期推遲至第四季。',
    pubDate:     new Date(now() - 1.2 * 3600000).toUTCString(),
    source:      'Reuters',
  },
  {
    title:       '輝達 Q1 數據中心營收超 450 億美元，AI 晶片需求持續爆發',
    link:        'https://www.cnbc.com/quotes/NVDA',
    description: 'NVIDIA 公布財報，數據中心業務再創紀錄，Blackwell 架構出貨速度超越預期。公司上調第二季指引，稱雲端超大型業者資本支出仍在加速，執行長黃仁勳表示 AI 基礎建設正進入新階段。',
    pubDate:     new Date(now() - 2.5 * 3600000).toUTCString(),
    source:      'CNBC Markets',
  },
  {
    title:       '非農就業人口新增 21 萬，失業率維持 3.9%',
    link:        'https://www.marketwatch.com/economy-politics/calendars/economic',
    description: '美國勞工部公布 4 月非農就業報告，新增就業 21 萬人，略低於市場預估，但失業率穩定。薪資年增 3.8%，略低於上月，顯示勞動市場仍健康但漸趨均衡，支持 Fed 維持審慎立場。',
    pubDate:     new Date(now() - 4 * 3600000).toUTCString(),
    source:      'MarketWatch',
  },
  {
    title:       '蘋果季報優預期，服務收入創新高，宣布 1,100 億回購計畫',
    link:        'https://www.cnbc.com/quotes/AAPL',
    description: 'Apple 第二財季淨利超越市場預期，服務業務（App Store、Apple Intelligence 訂閱）收入達 256 億美元創歷史高峰。公司宣布史上最大規模股票回購計畫，iPhone 出貨優於預期。',
    pubDate:     new Date(now() - 5.5 * 3600000).toUTCString(),
    source:      'CNBC Markets',
  },
  {
    title:       '標普 500 本週累計漲 2.3%，科技五大市值全面回升',
    link:        'https://www.marketwatch.com/investing/index/spx',
    description: '本週美股在科技財報亮眼帶動下全面走高，S&P 500 週漲 2.3%，那斯達克漲逾 3%，AI 題材持續發酵。分析師警告估值偏高，但整體企業獲利成長仍支撐多頭信心。',
    pubDate:     new Date(now() - 7 * 3600000).toUTCString(),
    source:      'MarketWatch',
  },
  {
    title:       '微軟 Azure 季增 31%，AI Copilot 商業化加速',
    link:        'https://www.reuters.com/technology/',
    description: '微軟最新財報顯示 Azure 雲端業務季增 31%，高於市場預估的 28%。Copilot 企業版用戶數突破 1,500 萬，公司預計 AI 相關服務本財年貢獻收入將超過 300 億美元。',
    pubDate:     new Date(now() - 9 * 3600000).toUTCString(),
    source:      'Reuters',
  },
  {
    title:       '美國 PCE 通膨 3 月年增 2.3%，核心數據略低於預期',
    link:        'https://www.investopedia.com/terms/p/pce.asp',
    description: '美國 3 月個人消費支出（PCE）物價指數年增 2.3%，核心 PCE 年增 2.6%，均略低於市場預估，顯示通膨降溫進程仍在繼續，但距離 2% 目標仍有距離，市場降息預期略為升溫。',
    pubDate:     new Date(now() - 11 * 3600000).toUTCString(),
    source:      'Investopedia',
  },
  {
    title:       'Alphabet 廣告收入強勁，Google Cloud 首季破百億美元',
    link:        'https://www.cnbc.com/quotes/GOOGL',
    description: 'Alphabet 公布財報，Google 廣告業務超越市場預期，YouTube 廣告成長 21%；Google Cloud 季度營收首次突破百億美元，AI 推動企業雲端需求持續高漲，公司宣布季度股息。',
    pubDate:     new Date(now() - 14 * 3600000).toUTCString(),
    source:      'CNBC Markets',
  },
  {
    title:       '油價承壓，OPEC+ 6 月增產計畫引發市場憂慮',
    link:        'https://www.marketwatch.com/investing/future/cl.1',
    description: 'OPEC+ 宣布 6 月將推進增產計畫，WTI 原油期貨跌破 72 美元/桶。市場擔憂全球需求復甦不及預期加上供給增加，能源股全面下跌，貝克休斯、雪佛龍跌幅均逾 2%。',
    pubDate:     new Date(now() - 17 * 3600000).toUTCString(),
    source:      'MarketWatch',
  },
  {
    title:       '美國 10 年期公債殖利率攀升至 4.6%，市場重新評估降息路徑',
    link:        'https://www.investopedia.com/terms/t/treasury-yield.asp',
    description: '美國 10 年期公債殖利率周內升至 4.6%，為近三個月新高，反映市場對 Fed 維持高利率更久的預期升溫。美元指數同步走強，新興市場面臨資本外流壓力，股債雙跌格局顯現。',
    pubDate:     new Date(now() - 21 * 3600000).toUTCString(),
    source:      'Investopedia',
  },
];

const MOCK_TW: NewsItem[] = [
  {
    title:       '台積電 4 月營收 3,650 億創單月新高，法人上調全年 EPS 至 80 元',
    link:        'https://www.cnyes.com/twstock/2330',
    description: '台積電公布 4 月合併營收 3,650 億元，月增 12%、年增 48%，創單月歷史新高。受惠 CoWoS 先進封裝及 N2/N3P 客戶拉貨強勁，多家外資券商上調全年 EPS 目標至 80 元，目標價調升至 2,500～2,800 元。',
    pubDate:     new Date(now() - 0.8 * 3600000).toUTCString(),
    source:      '鉅亨網',
  },
  {
    title:       '台股 5/2 外資買超 185 億，電子五哥全線走強',
    link:        'https://news.cnyes.com/news/cat/tw_stock_news',
    description: '台股 5 月 2 日外資大舉買超 185 億元，連續第 12 個交易日買超，台積電、廣達、緯穎、世芯均受惠，加權指數盤中站上 21,500 點。三大法人合計買超逾 220 億，籌碼持續集中。',
    pubDate:     new Date(now() - 2 * 3600000).toUTCString(),
    source:      '鉅亨網',
  },
  {
    title:       '廣達 Q1 EPS 4.8 元創歷史高，AI 伺服器訂單能見度達 2027 上半年',
    link:        'https://www.moneydj.com/KLINE/KLine.djhtm?a=2382',
    description: '廣達電腦公布第一季財報，EPS 4.8 元超越市場預期，主因 AI 伺服器出貨量大幅成長。公司表示 GB200/GB300 NVL 機架訂單已排至 2027 上半年，下半年出貨量估將翻倍，目標價上調。',
    pubDate:     new Date(now() - 3.5 * 3600000).toUTCString(),
    source:      'MoneyDJ',
  },
  {
    title:       '世芯-KY AI ASIC 訂單爆量，Q2 營收估年增逾 120%',
    link:        'https://www.moneydj.com/KLINE/KLine.djhtm?a=3661',
    description: '世芯-KY 法說會揭露第二季營收估年增逾 120%，AI 推論 ASIC 定製晶片需求全面爆發。公司透露已導入第三家超大型雲端業者，七奈米以下先進製程訂單佔比超過 80%，全年EPS上看130元。',
    pubDate:     new Date(now() - 5 * 3600000).toUTCString(),
    source:      'MoneyDJ',
  },
  {
    title:       '台灣 4 月出口年增 31.5%，AI 伺服器與半導體雙引擎驅動',
    link:        'https://money.udn.com/money/story/5612/index',
    description: '財政部統計處公布 4 月出口 498 億美元，年增 31.5%，創歷史同期新高。資訊與通信產品年增 62%，半導體年增 38%，貿易順差 88 億美元，全年出口估有望突破 5,000 億美元。',
    pubDate:     new Date(now() - 6.5 * 3600000).toUTCString(),
    source:      '經濟日報',
  },
  {
    title:       '緯穎 Q1 毛利率上升至 10.5%，AI 伺服器高附加值產品佔比提升',
    link:        'https://www.cnyes.com/twstock/6669',
    description: '緯穎科技第一季毛利率升至 10.5%，優於市場預期，因高單價 AI 伺服器出貨比重上升。公司表示 GB200 NVL 72 機架出貨強勁，美系超大型雲端客戶拉貨動能不減，維持全年正向展望。',
    pubDate:     new Date(now() - 8 * 3600000).toUTCString(),
    source:      '鉅亨網',
  },
  {
    title:       '奇鋐液冷散熱Q2訂單全滿，下半年新產能加入估月增 30%',
    link:        'https://news.cnyes.com/news/cat/headline',
    description: '奇鋐科技表示液冷散熱解決方案第二季訂單已完全排滿，包含 CDU 直接液冷及背板式冷卻模組。受惠 Microsoft、Google、Meta 資料中心擴建，下半年新產能開出後估月產值可月增三成。',
    pubDate:     new Date(now() - 10 * 3600000).toUTCString(),
    source:      '鉅亨頭條',
  },
  {
    title:       '投信連 8 日買超台股，鎖定 AI 族群籌碼持續集中',
    link:        'https://www.moneydj.com/funddj/ya/yp511000.djhtm',
    description: '投信法人連續 8 個交易日買超台股，主要鎖定 AI 伺服器、液冷散熱、先進封裝等族群，累計買超金額超過 420 億元。分析師指出籌碼面持續清潔，強勢股賣壓輕，技術面多頭格局未破。',
    pubDate:     new Date(now() - 12 * 3600000).toUTCString(),
    source:      'MoneyDJ',
  },
  {
    title:       '聯發科天璣 9500 進入量產階段，AI 手機 SoC 市佔目標 35%',
    link:        'https://money.udn.com/money/story/5710/index',
    description: '聯發科表示旗艦天璣 9500 已進入量產，搭載 NPU 6.0 可支援裝置端 AI 推論。公司目標 2026 年在高階 Android 市場市佔率提升至 35%，全年 EPS 預估達 140 元，法人持續上調評等。',
    pubDate:     new Date(now() - 15 * 3600000).toUTCString(),
    source:      '經濟日報',
  },
  {
    title:       '台灣央行維持利率 2%，關注 AI 資本財出口帶動的物價走勢',
    link:        'https://news.cnyes.com/news/cat/headline',
    description: '中央銀行理監事會議決議維持重貼現率 2% 不變，但下調核心 CPI 展望至 1.8%。理事會強調 AI 相關資本財出口暢旺支撐新台幣匯率，近期匯率波動已在可接受範圍內，政策將靈活調整。',
    pubDate:     new Date(now() - 19 * 3600000).toUTCString(),
    source:      '鉅亨頭條',
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
  return `今日 ${h}:${m}`;
}

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

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const ago        = timeAgo(item.pubDate);
  const col        = sourceBadgeColor(item.source);
  const isExternal = item.link && item.link !== '#';

  return (
    <article className="news-card" style={{ animationDelay: `${index * 0.04}s` }}>
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

// ── News column ───────────────────────────────────────────────────────────────

interface ColProps {
  flag:    string;
  label:   string;
  items:   NewsItem[];
  loading: boolean;
  isLive:  boolean;
  hasError: boolean;
}

function NewsColumn({ flag, label, items, loading, isLive, hasError }: ColProps) {
  return (
    <div className="news-col">
      <div className="news-col-header">
        <span className="news-col-flag">{flag}</span>
        <span className="news-col-label">{label}</span>
        <span className={`news-col-status ${isLive ? 'live' : hasError ? 'err' : 'mock'}`}>
          {isLive ? '即時' : hasError ? '暫無法取得' : '範例'}
        </span>
      </div>

      {hasError && !loading && (
        <div className="news-col-error">
          <AlertCircle size={13} />
          無法取得即時新聞，顯示範例資料
        </div>
      )}

      <div className="news-col-list">
        {loading
          ? Array.from({ length: NEWS_COUNT }).map((_, i) => <SkeletonCard key={i} />)
          : items.slice(0, NEWS_COUNT).map((item, i) => (
              <NewsCard key={`${item.source}-${i}`} item={item} index={i} />
            ))
        }
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function News() {
  const [twItems,  setTwItems]  = useState<NewsItem[]>([]);
  const [usItems,  setUsItems]  = useState<NewsItem[]>([]);
  const [twLoad,   setTwLoad]   = useState(false);
  const [usLoad,   setUsLoad]   = useState(false);
  const [twLive,   setTwLive]   = useState(false);
  const [usLive,   setUsLive]   = useState(false);
  const [twErr,    setTwErr]    = useState(false);
  const [usErr,    setUsErr]    = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fetchingRef = useRef(false);

  const loadCategory = useCallback(async (cat: Category, force = false) => {
    const setItems = cat === 'TW' ? setTwItems : setUsItems;
    const setLoad  = cat === 'TW' ? setTwLoad  : setUsLoad;
    const setLive  = cat === 'TW' ? setTwLive  : setUsLive;
    const setErr   = cat === 'TW' ? setTwErr   : setUsErr;
    const mock     = cat === 'TW' ? MOCK_TW    : MOCK_US;

    // Cache check
    if (!force) {
      try {
        const raw = localStorage.getItem(CACHE_KEY(cat));
        if (raw) {
          const cached: CacheEntry = JSON.parse(raw);
          if (Date.now() - cached.fetchedAt < CACHE_MAX_MS && cached.items?.length) {
            setItems(cached.items.slice(0, NEWS_COUNT));
            setLive(isAPIConfigured());
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setLoad(true);
    setErr(false);

    if (!isAPIConfigured()) {
      setItems(mock);
      setLive(false);
      setLoad(false);
      return;
    }

    try {
      const result = await fetchNews(cat, NEWS_COUNT + 5);
      if (result && result.items.length > 0) {
        const entry: CacheEntry = { items: result.items, fetchedAt: Date.now() };
        localStorage.setItem(CACHE_KEY(cat), JSON.stringify(entry));
        setItems(result.items.slice(0, NEWS_COUNT));
        setLive(true);
      } else {
        throw new Error('empty');
      }
    } catch {
      setErr(true);
      setItems(mock);
      setLive(false);
    } finally {
      setLoad(false);
    }
  }, []);

  // Load both on mount
  useEffect(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const ts = Date.now();
    setUpdatedAt(ts);
    Promise.all([loadCategory('TW'), loadCategory('US')]).finally(() => {
      fetchingRef.current = false;
    });
  }, [loadCategory]);

  const isLoading = twLoad || usLoad;

  const handleRefresh = () => {
    if (isLoading) return;
    ['TW', 'US'].forEach(c => localStorage.removeItem(CACHE_KEY(c as Category)));
    setUpdatedAt(Date.now());
    loadCategory('TW', true);
    loadCategory('US', true);
  };

  return (
    <div className="news-page animate-fade-in">

      {/* ── Header ── */}
      <div className="news-header">
        <span className="news-eyebrow">FINANCIAL NEWS</span>
        <h1 className="news-page-title">財經新聞</h1>
        <p className="news-page-subtitle">美股・台股 各 10 則重要財經資訊，頁面載入時即時更新</p>
      </div>

      {/* ── Status bar ── */}
      <div className="news-status-bar">
        <span className={`status-dot ${(twLive || usLive) ? 'dot-live' : (twErr || usErr) ? 'dot-error' : 'dot-mock'}`} />
        {(twLive || usLive) ? <Wifi size={13} /> : <WifiOff size={13} />}
        <span>{(twLive || usLive) ? '即時資料' : (twErr || usErr) ? '資料暫無法取得' : '範例資料'}</span>
        <span className="news-status-sep">·</span>
        <span>更新時間：{formatUpdateTime(updatedAt)}</span>

        <button
          className={`news-refresh-btn ${isLoading ? 'loading' : ''}`}
          onClick={handleRefresh}
          disabled={isLoading}
          title="重新整理兩市新聞"
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          {isLoading ? '更新中…' : '重新整理'}
        </button>
      </div>

      {/* ── Dual column news ── */}
      <div className="news-dual">
        <NewsColumn
          flag="🇹🇼"
          label="台股財經新聞"
          items={twItems}
          loading={twLoad}
          isLive={twLive}
          hasError={twErr}
        />
        <NewsColumn
          flag="🇺🇸"
          label="美股財經新聞"
          items={usItems}
          loading={usLoad}
          isLive={usLive}
          hasError={usErr}
        />
      </div>

    </div>
  );
}
