import type { HourlyPoint } from '../types';
import { useMemo, useRef, useState } from 'react';

type Props = {
  points: HourlyPoint[];
};

export function Chart24h({ points }: Props) {
  const width = 320;
  const height = 96;
  const padding = 10;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState<number>(0);

  const maxTotal = useMemo(() => {
    return Math.max(1, ...points.map((p) => p.totalReports));
  }, [points]);

  const barWidth = (width - padding * 2) / Math.max(1, points.length);
  const innerHeight = height - padding * 2;

  const activePoint = activeIndex === null ? null : points[activeIndex];

  function hourLabel(isoUtc: string) {
    const date = new Date(isoUtc);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const rawIndex = Math.floor((x - padding) / barWidth);
    const nextIndex = Math.max(0, Math.min(points.length - 1, rawIndex));
    setActiveIndex(nextIndex);
    setTooltipLeft(Math.max(14, Math.min(rect.width - 14, x)));
  }

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="chart"
        role="img"
        aria-label="Last 24 hours reports (unavailable vs total)"
        onMouseMove={handleMove}
        onMouseLeave={() => setActiveIndex(null)}
      >
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="chart-axis" />

        {points.map((point, index) => {
          const x = padding + index * barWidth;
          const totalH = (point.totalReports / maxTotal) * innerHeight;
          const unavailableH = (point.unavailableReports / maxTotal) * innerHeight;
          const yBase = height - padding;

          return (
            <g key={point.hourUtc}>
              <rect
                x={x + 1}
                y={yBase - totalH}
                width={Math.max(1, barWidth - 2)}
                height={totalH}
                rx={3}
                className="chart-bar-total"
              />
              <rect
                x={x + 1}
                y={yBase - unavailableH}
                width={Math.max(1, barWidth - 2)}
                height={unavailableH}
                rx={3}
                className="chart-bar-unavailable"
              />

              {activeIndex === index && (
                <line
                  x1={x + barWidth / 2}
                  y1={padding}
                  x2={x + barWidth / 2}
                  y2={height - padding}
                  className="chart-focus"
                />
              )}
            </g>
          );
        })}

        <text x={padding} y={padding - 2} className="chart-caption">
          max {maxTotal}
        </text>
      </svg>

      {activePoint && (
        <div className="chart-tooltip" style={{ left: tooltipLeft }}>
          <div className="chart-tooltip-time">{hourLabel(activePoint.hourUtc)}</div>
          <div className="chart-tooltip-row">
            <span className="chart-pill chart-pill-bad">Unavailable</span>
            <span>{activePoint.unavailableReports}</span>
          </div>
          <div className="chart-tooltip-row">
            <span className="chart-pill chart-pill-total">Total</span>
            <span>{activePoint.totalReports}</span>
          </div>
        </div>
      )}

      <div className="chart-legend" aria-hidden="true">
        <span className="chart-pill chart-pill-bad">Unavailable</span>
        <span className="chart-pill chart-pill-total">Total</span>
      </div>
    </div>
  );
}
