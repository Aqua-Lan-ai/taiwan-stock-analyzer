import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useStockData } from '../hooks/useStockData';
import ScoreBadge from '../components/ScoreBadge';
import DividendCalendar from '../components/DividendCalendar';
import { evaluateETFIndicators, calcETFScore } from '../utils/parser';
import type { Stock } from '../types';

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';

export default function HomePage() {
  const navigate = useNavigate();
  const { stocks, settings, removeStock, updateSettings, toggleSelected, selectAll, updateShares } = useStore();
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

  async function handleReloadAll() {
    for (const s of stocks) {
      await fetchStockData(s.id, true);
    }
  }

  const allSelected = stocks.every((s) => s.selected);
  const someSelected = stocks.some((s) => s.selected);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: SF }}>

      {/* ── Header ── */}
      <header style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Title row */}
        <div style={{
          maxWidth: 896, margin: '0 auto', padding: '12px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em', margin: 0 }}>
              台股存股分析
            </h1>
            <p style={{ fontSize: 12, color: '#86868b', marginTop: 2, marginBottom: 0 }}>包租公選股五項指標</p>
          </div>
          <span style={{ fontSize: 12, color: '#aeaeb2' }}>v1.0</span>
        </div>

        {/* Settings row */}
        <div style={{
          maxWidth: 896, margin: '0 auto', padding: '10px 24px',
          display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#aeaeb2', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            全域參數
          </span>
          {([
            { label: '買進殖利率', key: 'buyYield' as const, color: '#34c759', step: '0.1', unit: '%' },
            { label: '賣出殖利率', key: 'sellYield' as const, color: '#ff3b30', step: '0.1', unit: '%' },
          ] as const).map(({ label, key, color, step, unit }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ color: '#6e6e73' }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f7', borderRadius: 8, padding: '3px 10px', gap: 3 }}>
                <input
                  type="number" step={step}
                  value={settings[key]}
                  onChange={(e) => updateSettings({ [key]: parseFloat(e.target.value) })}
                  style={{ width: 44, border: 'none', background: 'transparent', textAlign: 'center', color, fontWeight: 600, fontSize: 14, outline: 'none' }}
                />
                <span style={{ color: '#aeaeb2', fontSize: 13 }}>{unit}</span>
              </div>
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: '#6e6e73' }}>顯示年數</span>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f7', borderRadius: 8, padding: '3px 10px', gap: 3 }}>
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
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 896, margin: '0 auto', padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Error */}
        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#c62828' }}>
            {error}
          </div>
        )}

        {/* ── 新增股票 ── */}
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder="輸入股號，例如 2330"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{
              flex: 1, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12,
              padding: '12px 18px', fontSize: 15, color: '#1d1d1f',
              background: '#fff', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? '#aeaeb2' : '#0071e3',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '12px 24px', fontSize: 15, fontWeight: 500,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {loading ? '載入中...' : '新增'}
          </button>
        </div>

        {/* ── Toolbar & list ── */}
        {stocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#aeaeb2' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px', display: 'block', opacity: 0.35 }}>
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#6e6e73', marginBottom: 6 }}>尚未新增任何股票</p>
            <p style={{ fontSize: 13, color: '#aeaeb2' }}>輸入股號開始分析</p>
          </div>
        ) : (
          <>
            {/* ── 全選 / 全部更新 ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => selectAll(!allSelected)}
                  style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${someSelected ? '#0071e3' : '#d1d1d6'}`,
                    background: allSelected ? '#0071e3' : someSelected ? '#e8f0fe' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {allSelected ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : someSelected ? (
                    <div style={{ width: 10, height: 2, background: '#0071e3', borderRadius: 1 }} />
                  ) : null}
                </button>
                <span style={{ fontSize: 13, color: '#6e6e73' }}>
                  {someSelected
                    ? `已選 ${stocks.filter((s) => s.selected).length} / ${stocks.length}`
                    : '全選'}
                </span>
              </div>
              <button
                onClick={handleReloadAll}
                disabled={loading}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: 13, fontWeight: 500,
                  color: loading ? '#aeaeb2' : '#0071e3',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '更新中...' : '全部更新'}
              </button>
            </div>

            {/* ── 股票列表 ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stocks.map((stock) => (
                <div key={stock.id} style={{
                  background: '#fff', borderRadius: 14, padding: '12px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelected(stock.id)}
                    style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${stock.selected ? '#0071e3' : '#d1d1d6'}`,
                      background: stock.selected ? '#0071e3' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {stock.selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Stock info */}
                  <div
                    onClick={() => navigate(`/stock/${stock.id}`)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0 }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: '#f0f4ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#0071e3' }}>{stock.id}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: '#1d1d1f' }}>{stock.id}</span>
                        {stock.name && (
                          <span style={{ fontSize: 14, color: '#6e6e73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stock.name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#aeaeb2', marginTop: 2 }}>
                        {stock.price ? `現價 $${stock.price}` : '尚未載入'}
                      </div>
                    </div>
                  </div>

                  {/* Shares */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number" min="0" placeholder="0"
                      value={stock.shares || ''}
                      onChange={(e) => updateShares(stock.id, parseInt(e.target.value) || 0)}
                      style={{
                        width: 64, border: '1px solid #e5e5ea', borderRadius: 8,
                        padding: '5px 8px', fontSize: 13, textAlign: 'right',
                        color: '#1d1d1f', outline: 'none', background: '#fafafa',
                      }}
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

            {/* ── 股利日曆 ── */}
            <DividendCalendar stocks={stocks} />
          </>
        )}
      </main>
    </div>
  );
}
