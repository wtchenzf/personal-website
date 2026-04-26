import { useEffect, useRef, useMemo } from 'react';
import { createChart, CandlestickSeries, LineSeries, ColorType } from 'lightweight-charts';

export interface OHLCBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  data: OHLCBar[];
  height?: number;
}

function calcMA(data: OHLCBar[], period: number): { time: string; value: number }[] {
  const result: { time: string; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const avg = data.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period;
    result.push({ time: data[i].time, value: +avg.toFixed(2) });
  }
  return result;
}

export default function MiniKLineChart({ data, height = 230 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ma5  = useMemo(() => calcMA(data, 5),  [data]);
  const ma10 = useMemo(() => calcMA(data, 10), [data]);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b7280',
        fontFamily: "'Inter', 'Noto Sans TC', sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#f3f4f6' },
        horzLines: { color: '#f3f4f6' },
      },
      width: containerRef.current.clientWidth,
      height,
      timeScale: { borderColor: '#e5e7eb' },
      rightPriceScale: { borderColor: '#e5e7eb' },
    });

    // Taiwan colour convention: red = up (漲), green = down (跌)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         '#c0392b',
      downColor:       '#4a7c59',
      borderUpColor:   '#c0392b',
      borderDownColor: '#4a7c59',
      wickUpColor:     '#c0392b',
      wickDownColor:   '#4a7c59',
    });
    candleSeries.setData(data as any);

    const ma5Series = chart.addSeries(LineSeries, {
      color: '#e67e22',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma5Series.setData(ma5 as any);

    const ma10Series = chart.addSeries(LineSeries, {
      color: '#8e44ad',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma10Series.setData(ma10 as any);

    chart.timeScale().fitContent();

    const onResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
    };
  }, [data, ma5, ma10, height]);

  return (
    <div className="mini-kline-wrap">
      <div className="mini-kline-legend">
        <span className="mkl-item mkl-up">▲ 漲</span>
        <span className="mkl-item mkl-down">▼ 跌</span>
        <span className="mkl-item mkl-ma5">── MA5</span>
        <span className="mkl-item mkl-ma10">── MA10</span>
        <span className="mkl-item mkl-range">近1個月 (03/26 – 04/24)</span>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
