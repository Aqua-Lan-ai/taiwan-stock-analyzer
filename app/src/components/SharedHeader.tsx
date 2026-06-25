import { useNavigate } from 'react-router-dom';

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';

interface Props {
  activeTab: 'tw' | 'us';
}

export default function SharedHeader({ activeTab }: Props) {
  const navigate = useNavigate();

  function handleExport() {
    const tw = localStorage.getItem('stock-storage');
    const us = localStorage.getItem('us-stock-storage');
    if (!tw && !us) return;
    const bundle: Record<string, unknown> = {};
    if (tw) bundle['stock-storage'] = JSON.parse(tw);
    if (us) bundle['us-stock-storage'] = JSON.parse(us);
    const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stocks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed['stock-storage'] || parsed['us-stock-storage']) {
          if (parsed['stock-storage']) localStorage.setItem('stock-storage', JSON.stringify(parsed['stock-storage']));
          if (parsed['us-stock-storage']) localStorage.setItem('us-stock-storage', JSON.stringify(parsed['us-stock-storage']));
          window.location.reload();
          return;
        }
        // Legacy: plain stock-storage format
        if (!parsed.state?.stocks) { alert('格式不正確，請選擇正確的匯出檔案'); return; }
        localStorage.setItem('stock-storage', text);
        window.location.reload();
      } catch { alert('檔案解析失敗'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const tabBtn = (label: string, tab: 'tw' | 'us', path: string) => (
    <button
      onClick={() => navigate(path)}
      style={{
        fontSize: 13,
        fontWeight: activeTab === tab ? 600 : 500,
        color: activeTab === tab ? '#1d1d1f' : '#86868b',
        background: activeTab === tab ? '#fff' : 'none',
        border: 'none', cursor: 'pointer',
        padding: '5px 14px', borderRadius: 8,
        boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        transition: 'all 0.15s',
        fontFamily: SF,
      }}
    >
      {label}
    </button>
  );

  return (
    <header style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 896, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f2f2f7', borderRadius: 10, padding: 3 }}>
          {tabBtn('台股', 'tw', '/')}
          {tabBtn('美股', 'us', '/us')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleExport}
            style={{ fontSize: 13, color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '4px 8px', fontFamily: SF }}
          >
            匯出
          </button>
          <label style={{ fontSize: 13, color: '#0071e3', fontWeight: 500, cursor: 'pointer', padding: '4px 8px', fontFamily: SF }}>
            匯入
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          <span style={{ fontSize: 12, color: '#aeaeb2' }}>v1.0</span>
        </div>
      </div>
    </header>
  );
}
