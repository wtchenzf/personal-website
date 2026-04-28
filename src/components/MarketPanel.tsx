import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries, HistogramSeries, type ISeriesApi } from 'lightweight-charts';
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
  const tooltipRef = useRef<HTMLDivElement>(null);

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

    const addedSeries: ISeriesApi<'Line'>[] = [];

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
        addedSeries.push(line);
      });
    }

    // Custom tooltip for dual-line: show both series values on crosshair hover
    if (type === 'dual-line' && tooltipRef.current) {
      const tooltip = tooltipRef.current;
      chart.subscribeCrosshairMove((param) => {
        if (
          !param.point ||
          !param.time ||
          param.point.x < 0 ||
          param.point.y < 0
        ) {
          tooltip.style.display = 'none';
          return;
        }

        const values = addedSeries.map((s, i) => {
          const data = param.seriesData.get(s) as { value?: number } | undefined;
          return {
            label: series[i]?.label ?? `Series ${i + 1}`,
            color: series[i]?.color ?? '#666',
            value: data?.value,
          };
        });

        const anyValue = values.some((v) => v.value !== undefined);
        if (!anyValue) { tooltip.style.display = 'none'; return; }

        // Format date label from time (YYYY-MM-DD)
        const dateStr = typeof param.time === 'string'
          ? param.time
          : String(param.time);
        const parts = dateStr.split('-');
        const dateLabel = parts.length === 3
          ? `${parseInt(parts[1])}/${parseInt(parts[2])}`
          : dateStr;

        tooltip.innerHTML = `
          <div class="mp-tooltip-date">${dateLabel}</div>
          ${values.map((v) => `
            <div class="mp-tooltip-row">
              <span class="mp-tooltip-dot" style="background:${v.color}"></span>
              <span class="mp-tooltip-label">${v.label}</span>
              <span class="mp-tooltip-val">${v.value !== undefined ? v.value.toFixed(1) + '%' : '—'}</span>
            </div>
          `).join('')}
        `;

        // Position tooltip: prefer right side; flip to left near right edge
        const containerWidth = chartRef.current?.clientWidth ?? 300;
        const tipWidth = 150;
        let left = param.point.x + 12;
        if (left + tipWidth > containerWidth) left = param.point.x - tipWidth - 8;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${Math.max(0, param.point.y - 30)}px`;
        tooltip.style.display = 'block';
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

      <div className="mp-chart-wrap">
        <div ref={chartRef} className="mp-chart" />
        {type === 'dual-line' && (
          <div ref={tooltipRef} className="mp-tooltip" style={{ display: 'none' }} />
        )}
      </div>
    </div>
  );
}
