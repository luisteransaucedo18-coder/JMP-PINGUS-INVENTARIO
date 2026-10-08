import { useId, type ReactNode } from 'react';

export type DetailField = { label: string; value: ReactNode; wide?: boolean };

/** Shared presentation for read-only record data, including long descriptions. */
export default function DataDetails({ title, reference, fields, className = '' }: {
  title?: string; reference?: ReactNode; fields: DetailField[]; className?: string;
}) {
  const titleId = useId();
  return <section className={`data-details ${className}`} aria-labelledby={title ? titleId : undefined}>
    {(title || reference) && <header className="data-details-header">
      {title && <h3 id={titleId}>{title}</h3>}
      {reference && <span className="data-details-reference">{reference}</span>}
    </header>}
    <dl className="data-details-grid">
      {fields.map(({ label, value, wide }) => <div key={label} className={wide ? 'data-details-field data-details-field-wide' : 'data-details-field'}>
        <dt>{label}</dt>
        <dd>{value === null || value === undefined || value === '' ? <span className="data-details-empty">Sin registrar</span> : value}</dd>
      </div>)}
    </dl>
  </section>;
}
