import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useStockData } from '../hooks/useStockData';
import ScoreBadge from '../components/ScoreBadge';
import DividendCalendar from '../components/DividendCalendar';
import { evaluateETFIndicators, calcETFScore } from '../utils/parser';
import type { Stock } from '../types';

export default function HomePage() {
  const navigate = useNavigate();
  const { stocks, settings, removeStock, updateSettings, toggleSelected, updateShares } = useStore();
  const { fetchStockData, loading, error } = useStockData();
  const [input, setInput] = useState('');
  const { addStock } = useStore();

  function liveScore(s: Stock): number {
    if (s.type === 'etf' && s.etfFinancials) {
      const merged = { ...s.etfFinancials, aum: s.etfAUM, expenseRatio: s.etfExpenseRatio };
      return calcETFScore(evaluateETFIndicators(merged, settings.buyYield, s.price));
    }
    return s.score;
  }

  async function handleAdd() {
    const id = input.trim();
    if (!id) return;
    addStock(id);
    setInput('');
    await fetchStockData(id);
  }

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f7', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
      {/* Header */}
      <header style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>台股存股分析</h1>
            <p style={{ fontSize: 12, color: '#86868b', marginTop: 1 }}>包租公選股五項指標</p>
          </div>
          <span style={{ fontSize: 12, color: '#aeaeb2' }}>v1.0</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Global settings */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="flex flex-wrap gap-6 items-center">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f' }}>全域參數</span>
            {[
              { label: '買進殖利率', key: 'buyYield' as const, color: '#34c759', step: '0.1' },
              { label: '賣出殖利率', key: 'sellYield' as const, color: '#ff3b30', step: '0.1' },
            ].map(({ label, key, color, step }) => (
              <label key={key} className="flex items-center gap-2" style={{ fontSize: 13 }}>
                <span style={{ color: '#6e6e73' }}>{label}</span>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f7', borderRadius: 8, padding: '4px 10px', gap: 4 }}>
                  <input
                    type="number"
                    step={step}
                    value={settings[key]}
                    onChange={(e) => updateSettings({ [key]: parseFloat(e.target.value) })}
                    style={{ width: 44, border: 'none', background: 'transparent', textAlign: 'center', color, fontWeight: 600, fontSize: 14, outline: 'none' }}
                  />
                  <span style={{ color: '#aeaeb2', fontSize: 13 }}>%</span>
                </div>
              </label>
            ))}
            <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <span style={{ color: '#6e6e73' }}>顯示年數</span>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f7', borderRadius: 8, padding: '4px 10px', gap: 4 }}>
                <input
                  type="number" min="1" max="20"
                  value={settings.years}
                  onChange={(e) => updateSettings({ years: parseInt(e.target.value) })}
                  style={{ width: 36, border: 'none', background: 'transparent', textAlign: 'center', color: '#1d1d1f', fontWeight: 600, fontSize: 14, outline: 'none' }}
                />
                <span style={{ color: '#aeaeb2', fontSize: 13 }}>年</span>
              </div>
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#c62828' }}>
            {error}
          </div>
        )}

        {/* Add stock */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="輸入股號，例如 2330"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '13px 18px', fontSize: 15, color: '#1d1d1f', background: '#fff', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          />
          <button
            onClick={handleAdd}
            disabled={loading || !input.trim()}
            style={{ background: loading || !input.trim() ? '#aeaeb2' : '#0071e3', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 24px', fontSize: 15, fontWeight: 500, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
          >
            {loading ? '載入中...' : '新增'}
          </button>
        </div>

        {/* Stock list */}
        {stocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#aeaeb2' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.4 }}>
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <p style={{ fontSize: 17, fontWeight: 500, color: '#6e6e73' }}>尚未新增任何股票</p>
            <p style={{ fontSize: 14, color: '#aeaeb2', marginTop: 6 }}>輸入股號開始分析</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-8">
              {stocks.map((stock) => (
                <div key={stock.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelected(stock.id)}
                    style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `2px solid ${stock.selected ? '#0071e3' : '#d1d1d6'}`, background: stock.selected ? '#0071e3' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    {stock.selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Stock info — clickable */}
                  <div
                    onClick={() => navigate(`/stock/${stock.id}`)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0 }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#0071e3' }}>{stock.id}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: '#1d1d1f' }}>{stock.id}</span>
                        {stock.name && <span style={{ fontSize: 14, color: '#6e6e73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stock.name}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#aeaeb2', marginTop: 2 }}>
                        {stock.price ? `現價 $${stock.price}` : '尚未載入'}
                      </div>
                    </div>
                  </div>

                  {/* Shares input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number" min="0" placeholder="0"
                      value={stock.shares || ''}
                      onChange={(e) => updateShares(stock.id, parseInt(e.target.value) || 0)}
                      style={{ width: 64, border: '1px solid #e5e5ea', borderRadius: 8, padding: '5px 8px', fontSize: 13, textAlign: 'right', color: '#1d1d1f', outline: 'none', background: '#fafafa' }}
                    />
                    <span style={{ fontSize: 12, color: '#aeaeb2', whiteSpace: 'nowrap' }}>股</span>
                  </div>


                  <ScoreBadge score={liveScore(stock)} />

                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeStock(stock.id); }}
                    style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#aeaeb2', flexShrink: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ff3b30'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#aeaeb2'; }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Dividend Calendar */}
            <DividendCalendar stocks={stocks} />
          </>
        )}
      </main>
    </div>
  );
}
