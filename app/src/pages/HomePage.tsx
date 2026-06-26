import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useStockData, useLivePrices } from '../hooks/useStockData';
import ScoreBadge from '../components/ScoreBadge';
import DividendCalendar from '../components/DividendCalendar';
import SharedHeader from '../components/SharedHeader';
import { evaluateETFIndicators, calcETFScore } from '../utils/parser';
import { useRateLimitStore, useRateLimitCountdown } from '../store/useRateLimitStore';
import type { Stock, YearData } from '../types';

function avg3(arr: YearData[]): number | null {
  const recent = [...arr].filter((d) => d.value !== null).sort((a, b) => b.year - a.year).slice(0, 3);
  if (recent.length === 0) return null;
  return recent.reduce((s, d) => s + (d.value ?? 0), 0) / recent.length;
}

function liveSecondary(s: Stock): string | null {
  if (s.type === 'etf' && s.etfFinancials) {
    const nav = s.etfFinancials.nav;
    const price = s.price;
    if (!nav || !price) return null;
    const pct = ((price - nav) / nav) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${pct >= 0 ? '溢價' : '折價'} ${sign}${pct.toFixed(2)}%`;
  }
  if (s.financials) {
    if (s.subType === 'financial') {
      const latestBps = [...(s.financials.bps ?? [])].filter((d) => (d.value ?? 0) > 0).sort((a, b) => b.year - a.year)[0]?.value ?? null;
      const fair = latestBps ? Math.round(latestBps) : null;
      return fair ? `合理價 $${fair}` : null;
    }
    const avgEps = avg3(s.financials.eps.filter((d) => (d.value ?? 0) > 0));
    const fair = avgEps ? Math.round(avgEps * 20) : null;
    return fair ? `合理價 $${fair}` : null;
  }
  return null;
}

const YIELD = 4;

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';

export default function HomePage() {
  const navigate = useNavigate();
  const { stocks, removeStock, toggleSelected, selectAll, updateShares, reorderStocks } = useStore();
  const { fetchStockData, loading, error } = useStockData();
  const countdown = useRateLimitCountdown();
  const fetchLivePrices = useLivePrices();

  useEffect(() => { fetchLivePrices(); }, [fetchLivePrices]);
  const [input, setInput] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const { addStock } = useStore();

  function liveScore(s: Stock): number {
    if (s.type === 'etf' && s.etfFinancials) {
      const merged = { ...s.etfFinancials, aum: s.etfAUM ?? s.etfFinancials.aum, expenseRatio: s.etfExpenseRatio ?? s.etfFinancials.expenseRatio };
      return calcETFScore(evaluateETFIndicators(merged, YIELD, s.price));
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
    if (useRateLimitStore.getState().rateLimitUntil) return;
    // Sort oldest lastUpdated first (null = never updated goes first)
    const sorted = [...stocks].sort((a, b) => {
      if (!a.lastUpdated) return -1;
      if (!b.lastUpdated) return 1;
      return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
    });
    for (let i = 0; i < sorted.length; i++) {
      if (useRateLimitStore.getState().rateLimitUntil) break;
      await fetchStockData(sorted[i].id, true);
      if (i < sorted.length - 1) await new Promise(r => setTimeout(r, 2500));
    }
  }

  const allSelected = stocks.every((s) => s.selected);
  const someSelected = stocks.some((s) => s.selected);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: SF }}>

      <SharedHeader activeTab="tw" />

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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
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
                disabled={loading || !!countdown}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: 13, fontWeight: 500,
                  color: (loading || countdown) ? '#aeaeb2' : '#0071e3',
                  cursor: (loading || countdown) ? 'not-allowed' : 'pointer',
                }}
              >
                {countdown ? `等 ${countdown}` : loading ? '更新中...' : '全部更新'}
              </button>
            </div>

            {/* ── 股票列表 ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stocks.map((stock) => (
                <div
                  key={stock.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', stock.id); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(stock.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => { e.preventDefault(); const fromId = e.dataTransfer.getData('text/plain'); reorderStocks(fromId, stock.id); setDragOverId(null); }}
                  onDragEnd={() => setDragOverId(null)}
                  style={{
                    background: '#fff', borderRadius: 14, padding: '12px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: dragOverId === stock.id ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                    cursor: 'grab',
                  }}
                >
                  {/* Drag handle */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d1d6" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, cursor: 'grab' }}>
                    <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/>
                  </svg>
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
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Stock info */}
                  <div
                    onClick={() => navigate(`/stock/${stock.id}`)}
                    onDragStart={(e) => e.stopPropagation()}
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
                      <div style={{ fontSize: 12, color: '#aeaeb2', marginTop: 2, display: 'flex', alignItems: 'center' }}>
                        <span>{stock.price ? `現價 $${stock.price}` : '尚未載入'}</span>
                        {(() => {
                          const secondary = liveSecondary(stock);
                          if (!secondary) return null;
                          return <><span style={{ margin: '0 8px' }}>|</span><span>{secondary}</span></>;
                        })()}
                        {stock.lastUpdated && (() => {
                          const d = new Date(stock.lastUpdated);
                          const stale = Date.now() - d.getTime() > 24 * 60 * 60 * 1000;
                          const label = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                          return <span style={{ marginLeft: 8, color: stale ? '#ff9500' : '#aeaeb2' }}>{label}</span>;
                        })()}
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

                  {/* Refresh */}
                  <button
                    onClick={(e) => { e.stopPropagation(); fetchStockData(stock.id, true); }}
                    disabled={loading || !!countdown}
                    style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: (loading || countdown) ? 'not-allowed' : 'pointer', color: '#aeaeb2', flexShrink: 0, opacity: (loading || countdown) ? 0.4 : 1 }}
                    onMouseEnter={(e) => { if (!loading && !countdown) (e.currentTarget as HTMLButtonElement).style.color = '#0071e3'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#aeaeb2'; }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </button>

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
