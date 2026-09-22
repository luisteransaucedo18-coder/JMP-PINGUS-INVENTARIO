interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  iconBg?: string;
  icon?: React.ReactNode;
  trend?: { value: string; up: boolean };
}

export default function KpiCard({ label, value, sub, iconBg = '#DBEAFE', icon, trend }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#71717A', fontWeight: 500 }}>{label}</div>
        {icon && (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#18181B', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#71717A', marginTop: 6 }}>{sub}</div>}
      {trend && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: trend.up ? '#059669' : '#DC2626', fontWeight: 600 }}>
            {trend.up ? '▲' : '▼'} {trend.value}
          </span>
          <span style={{ fontSize: 11, color: '#A1A1AA' }}>vs mes anterior</span>
        </div>
      )}
    </div>
  );
}
