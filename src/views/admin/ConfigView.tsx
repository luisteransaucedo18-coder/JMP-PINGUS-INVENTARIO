interface Props { onToast: (msg: string) => void; }

export default function ConfigView({ onToast }: Props) {
  return (
    <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[
          {
            title: 'Parámetros del Sistema', items: [
              ['Nombre de la empresa', 'Industrias SIGMA S.A. de C.V.'],
              ['RFC', 'ISI-840312-AB3'],
              ['Almacén principal', 'Planta Monterrey'],
              ['Unidad monetaria', 'MXN (Peso Mexicano)'],
              ['Zona horaria', 'America/Monterrey (UTC-6)'],
              ['Versión del sistema', 'v2.4.1'],
            ]
          },
          {
            title: 'Alertas y Notificaciones', items: [
              ['Umbral de stock bajo', '≤ 20% del mínimo'],
              ['Umbral crítico', '≤ 10% del mínimo'],
              ['Días de anticipación vencimiento', '30 días'],
              ['Notificación por email', 'Habilitada'],
              ['Frecuencia de reportes automáticos', 'Semanal (lunes 07:00)'],
            ]
          },
          {
            title: 'Seguridad y Accesos', items: [
              ['Política de contraseñas', 'Mín. 8 chars + especial'],
              ['Tiempo de sesión', '8 horas'],
              ['2FA requerido', 'Solo administradores'],
              ['Registro de auditoría', 'Habilitado — retención 2 años'],
              ['Backup automático', 'Diario 23:00 h'],
            ]
          },
          {
            title: 'Integraciones', items: [
              ['ERP conectado', 'SAP S/4HANA'],
              ['Última sincronización', '2024-11-15 08:00'],
              ['API contabilidad', 'Activa (CONTPAQi)'],
              ['Escáner de códigos', 'Zebra DS2208 — OK'],
              ['Impresora etiquetas', 'Zebra ZD230 — OK'],
            ]
          },
        ].map(section => (
          <div key={section.title} className="panel">
            <div className="section-header"><span className="section-title">{section.title}</span></div>
            <div style={{ padding: '8px 0' }}>
              {section.items.map(([k, v]) => (
                <div key={k} style={{ padding: '10px 18px', borderBottom: '1px solid #1a1e28', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ fontSize: 12, color: '#6b7590', flexShrink: 0 }}>{k}</span>
                  <span style={{ fontSize: 12, color: '#e8eaf0', textAlign: 'right', fontFamily: typeof v === 'string' && v.match(/^v\d|SAP|API|Zebra|RFC|UTC|MXN/) ? 'var(--font-mono)' : undefined }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 18px' }}>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => onToast('Editando: ' + section.title)}>Editar configuración</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
