import { useEffect, useRef } from 'react';
import {
  ColorType,
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts';

type Point = { time: number; value: number };

function toUtcTimestamp(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

/** lightweight-charts rejects duplicate bar times — collapse to last value per second. */
function buildLineData(points: Point[]): LineData[] {
  const filtered = (points || []).filter(
    (p) => Number.isFinite(p.time) && Number.isFinite(p.value) && p.value > 0
  );
  const bySec = new Map<number, number>();
  for (const p of filtered) {
    const sec = toUtcTimestamp(p.time);
    bySec.set(sec, p.value);
  }
  return Array.from(bySec.entries())
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }))
    .sort((a, b) => a.time - b.time);
}

function safeFitContent(chart: IChartApi) {
  try {
    chart.timeScale().fitContent();
  } catch {
    /* empty or single-point series can throw */
  }
}

export function TradingChart(props: {
  points: Point[];
  height?: number;
  accent?: string;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // lightweight-charts v5 uses addSeries(LineSeries, opts) instead of addLineSeries(opts)
  // Keep this ref loosely typed to tolerate library upgrades without breaking runtime.
  const seriesRef = useRef<ISeriesApi<any> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: props.height ?? 320,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.08)' },
        horzLines: { color: 'rgba(148,163,184,0.08)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.15)',
      },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: 'rgba(148,163,184,0.25)' },
        horzLine: { color: 'rgba(148,163,184,0.25)' },
      },
    });

    const seriesOptions = {
      color: props.accent || '#3b82f6',
      lineWidth: 2,
    } as const;

    const series: ISeriesApi<any> =
      typeof (chart as any).addLineSeries === 'function'
        ? (chart as any).addLineSeries(seriesOptions)
        : (chart as any).addSeries(LineSeries, seriesOptions);

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
      safeFitContent(chart);
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const data = buildLineData(props.points || []);
    try {
      series.setData(data);
      if (data.length > 0) safeFitContent(chart);
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[TradingChart] setData failed', e);
      }
    }
  }, [props.points]);

  return (
    <div className="fx-tv-chart">
      {props.label ? <div className="fx-tv-chart__label">{props.label}</div> : null}
      <div ref={containerRef} className="fx-tv-chart__container" />
    </div>
  );
}

