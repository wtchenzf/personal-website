import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries, HistogramSeries } from 'lightweight-charts';
import './MarketPanel.css';

type ChartType = 'bar' | 'line' | 'dual-line';

interface Series {
  data: { time: string; value: number; color?: string }[];
  color?: string;
  label?: string;
}

interface MarketPanelProps {
  title: string;
  subtitle?: string;
  type: ChartType;
  series: Series[];
  /** Optional summary stats to show above chart */
  stats?: { label: string; value: string; trend?: 'up' | 'down' | 'neutral' }[];
}

const LAYOUT = {
  background: { type: ColorType.Solid, color: 'transparent' },
  textColor: '#6b7280',
  fontFamily: "'Inter', 'Noto Sans TC', sans-serif",
  fontSize: 11,
};
const GRID = {
  vertLines: { color: '#f3f4f6' },
  horzLines: { color: '#f3f4f6' },
};

export default function MarketPanel({ title, subtitle, type, series, stats }: MarketPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !series.length || !series[0].data.length) return;

    const chart = createChart(chartRef.current, {
      layout: LAYOUT,
      grid: GRID,
      width: chartRef.current.clientWidth,
      height: 160,
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#e5e7eb' },
      rightPriceScale: { borderColor: '#e5e7eb' },
    });

    if (type === 'bar') {
      const hist = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' } });
      hist.setData(series[0].data as any);
    } else {
      // 'line' or 'dual-line'
      series.forEach((s) => {
        const line = chart.addSeries(LineSeries, {
          color: s.color ?? '#1a1a2e',
          lineWidth: 2,
        });
        line.setData(s.data as any);
      });
    }

    const onResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, [series, type]);

  return (
    <div className="mp-card">
      <h3 className="mp-title">{title}</h3>
      {subtitle && <p className="mp-subtitle">{subtitle}</p>}

      {stats && (
        <div className="mp-stat-row">
          {stats.map((s) => (
            <div key={s.label} className="mp-stat">
              <span className="mp-stat-label">{s.label}</span>
              <span className={`mp-stat-value ${s.trend ?? ''}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Color legend for dual-line charts */}
      {type === 'dual-line' && series.some(s => s.label) && (
        <div className="mp-legend">
          {series.map(s => s.label ? (
            <span key={s.label} className="mp-legend-item">
              <span className="mp-legend-dot" style={{ background: s.color ?? '#666' }} />
              <span className="mp-legend-label">{s.label}</span>
            </span>
          ) : null)}
        </div>
      )}

      <div ref={chartRef} className="mp-chart" />
    </div>
  );
}
