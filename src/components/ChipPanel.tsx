import { useEffect, useRef } from 'react';
import { createChart, ColorType, HistogramSeries } from 'lightweight-charts';
import { type ChipData } from '../utils/technicalIndicators';
import './ChipPanel.css';

interface ChipPanelProps {
  data: ChipData[];
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

export default function ChipPanel({ data }: ChipPanelProps) {
  const mainRef    = useRef<HTMLDivElement>(null);
  const foreignRef = useRef<HTMLDivElement>(null);
  const trustRef   = useRef<HTMLDivElement>(null);
  const dealerRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current || !foreignRef.current || !trustRef.current || !dealerRef.current || !data?.length) return;

    const createChipChart = (container: HTMLElement, seriesData: {time: string, value: number}[], color: string | ((v: number) => string)) => {
      const chart = createChart(container, {
        layout: LAYOUT,
        grid: GRID,
        width: container.clientWidth,
        height: 100,
        timeScale: { borderColor: '#e5e7eb' },
        rightPriceScale: { borderColor: '#e5e7eb' },
      });
      const series = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
      });
      series.setData(seriesData.map(d => ({ 
        time: d.time, 
        value: d.value, 
        color: typeof color === 'function' ? color(d.value) : (d.value >= 0 ? color : color + '80')
      })) as any);
      return chart;
    };

    const mChart = createChipChart(mainRef.current,    data.map(d => ({ time: d.time, value: d.mainForce })), v => v >= 0 ? '#c0392b' : '#4a7c59');
    const fChart = createChipChart(foreignRef.current, data.map(d => ({ time: d.time, value: d.foreign })), '#2962FF');
    const tChart = createChipChart(trustRef.current,   data.map(d => ({ time: d.time, value: d.trust })),   '#FF6D00');
    const dChart = createChipChart(dealerRef.current,  data.map(d => ({ time: d.time, value: d.dealer })),  '#7B1FA2');

    const charts = [mChart, fChart, tChart, dChart];

    // Sync time scales
    mChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const r = mChart.timeScale().getVisibleLogicalRange();
      if (r) {
        charts.forEach(c => { if(c !== mChart) c.timeScale().setVisibleLogicalRange(r); });
      }
    });

    const onResize = () => {
      const refs = [mainRef, foreignRef, trustRef, dealerRef];
      charts.forEach((c, i) => {
        const container = refs[i].current;
        if (container) c.applyOptions({ width: container.clientWidth });
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      charts.forEach(c => c.remove());
    };
  }, [data]);

  return (
    <div className="chip-panel">
      <div className="chip-section-header">
        <h3 className="chip-section-title">主力與法人籌碼動向</h3>
        <p className="chip-section-subtitle">每日買賣超 · 單位：張</p>
      </div>
      
      <div className="chip-grid">
        <div className="chip-item highlight">
          <span className="chip-label main">主力買賣超</span>
          <div ref={mainRef} className="chip-subchart" />
        </div>
        <div className="chip-item">
          <span className="chip-label foreign">外資買賣超</span>
          <div ref={foreignRef} className="chip-subchart" />
        </div>
        <div className="chip-item">
          <span className="chip-label trust">投信買賣超</span>
          <div ref={trustRef} className="chip-subchart" />
        </div>
        <div className="chip-item">
          <span className="chip-label dealer">自營商買賣超</span>
          <div ref={dealerRef} className="chip-subchart" />
        </div>
      </div>
    </div>
  );
}
