import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, MouseEvent, FocusEvent } from 'react';
import { createPortal } from 'react-dom';

export function ChartTooltip({ title, value, description, children }: {
  title: string; value?: string; description: string; children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<{ x: number; y: number; title: string; value?: string; description: string } | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const show = (event: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target.closest('[data-chart-title]') : null;
    const bounds = (target || event.currentTarget).getBoundingClientRect();
    setPoint({
      x: 'clientX' in event ? event.clientX : bounds.right,
      y: 'clientY' in event ? event.clientY : bounds.top + bounds.height / 2,
      title: target?.getAttribute('data-chart-title') || title,
      value: target?.getAttribute('data-chart-value') || value,
      description: target?.getAttribute('data-chart-description') || description,
    });
  };
  useLayoutEffect(() => {
    if (!point || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const gap = 18;
    const fitsRight = point.x + gap + width <= window.innerWidth - 8;
    const fitsLeft = point.x - gap - width >= 8;
    const x = fitsRight ? point.x + gap : fitsLeft ? point.x - gap - width : point.x - width / 2;
    const y = fitsRight || fitsLeft ? point.y - height / 2
      : point.y + gap + height <= window.innerHeight - 8 ? point.y + gap : point.y - gap - height;
    setPosition({
      x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    });
  }, [point]);
  useEffect(() => {
    if (!point) return;
    const hide = () => setPoint(null);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('keydown', escape);
    };
  }, [!!point]);
  return <div onMouseEnter={show} onMouseMove={show} onMouseLeave={() => setPoint(null)}
    onFocus={show} onBlur={() => setPoint(null)} tabIndex={0} aria-label={title} aria-describedby={point ? id : undefined}>
    {children}
    {point && createPortal(<div ref={ref} id={id} role="tooltip" className="chart-tooltip"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}>
      <strong>{point.title}</strong>
      {point.value && <span className="chart-tooltip-value">{point.value}</span>}
      <p>{point.description}</p>
    </div>, document.body)}
  </div>;
}
