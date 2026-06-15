interface Props {
  label: string;
  pass: boolean;
  description?: string;
}

export default function IndicatorRow({ label, pass, description }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 0',
      borderBottom: '1px solid #f2f2f7',
    }}
    className="last:border-0"
    >
      <div>
        <span style={{ fontWeight: 500, fontSize: 15, color: '#1d1d1f' }}>{label}</span>
        {description && (
          <p style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>{description}</p>
        )}
      </div>
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: pass ? '#d1fae5' : '#fee2e2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {pass ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>
    </div>
  );
}
