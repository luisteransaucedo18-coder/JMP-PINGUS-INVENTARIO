import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ChartTooltip } from './ChartTooltip';

export function Card({ children, style, className = '' }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return <div className={`panel dashboard-card ${className}`} style={style}>{children}</div>;
}

export function SectionHead({ title, action, actionLabel = 'Ver todo' }: { title: string; action?: () => void; actionLabel?: string }) {
  return <div className="dashboard-section-head"><h2>{title}</h2>{action && <button type="button" onClick={action}>{actionLabel}</button>}</div>;
}

/** Measure the plot, keeping labels in CSS pixels rather than shrinking a fixed wide SVG. */
export function BarChart({ data, colors, labels, height = 260, periodLabel = 'Todo el historial disponible' }: { data: number[][]; colors: string[]; labels: string[]; height?: number; periodLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(380);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(220, entry.contentRect.width)));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const margin = { top: 28, right: 12, bottom: 32, left: 40 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const step = Math.max(1, Math.ceil(Math.max(...data.flat(), 1) / 4));
  const max = Math.ceil(Math.max(...data.flat(), 1) / step) * step;
  const barW = Math.min(32, plotW / Math.max(data.length * (colors.length + 2), 1));
  const gap = 5;
  return <ChartTooltip title="Solicitudes por sede y estado" description={`${periodLabel}. Cada barra cuenta solicitudes, no materiales. Verde: confirmadas; naranja: enviadas y pendientes de revisión.`}><div ref={ref} className="dashboard-chart">
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Solicitudes por sede y estado">
      <desc>{labels.map((label, i) => `${label}: ${data[i].join(', ')}`).join('; ')}</desc>
      {Array.from({ length: max / step + 1 }, (_, i) => i * step).map(value => {
        const y = margin.top + plotH * (1 - value / max);
        return <g key={value}><line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#E4E4F0" strokeDasharray={value ? '4 4' : undefined}/><text x={margin.left - 8} y={y + 4} textAnchor="end" fontSize={12} fill="#71717A">{value}</text></g>;
      })}
      {data.map((group, i) => {
        const center = margin.left + (i + .5) * plotW / data.length;
        const start = center - (colors.length * barW + (colors.length - 1) * gap) / 2;
        return <g key={labels[i]}>{group.map((value, j) => {
          const h = value / max * plotH;
          const x = start + j * (barW + gap);
          const y = margin.top + plotH - h;
          const estado = j === 0 ? 'confirmadas' : 'pendientes';
          const explanation = `${periodLabel}. ${j === 0 ? 'Solicitudes confirmadas por coordinación.' : 'Solicitudes enviadas que esperan revisión de coordinación.'} En ${labels[i]}: ${value} de ${group.reduce((a, b) => a + b, 0)} solicitudes confirmadas o pendientes.`;
          return <g key={j} tabIndex={0} aria-label={`${labels[i]}: ${value} solicitudes ${estado}. ${explanation}`} data-chart-title={`${labels[i]} · ${estado}`} data-chart-value={`${value} solicitudes`}
            data-chart-description={explanation}>
            <rect x={x} y={y} width={barW} height={h} rx={4} fill={colors[j]}/>
            <text x={x + barW / 2} y={y - 7} textAnchor="middle" fontSize={12} fontWeight={600} fill={colors[j]}>{value}</text>
            <rect x={x} y={Math.min(y - 20, margin.top + plotH - 12)} width={barW} height={Math.max(h + 20, 12)} fill="transparent" />
          </g>;
        })}<text x={center} y={height - 8} textAnchor="middle" fontSize={12} fill="#52525B">{labels[i]}</text></g>;
      })}
    </svg>
  </div></ChartTooltip>;
}
