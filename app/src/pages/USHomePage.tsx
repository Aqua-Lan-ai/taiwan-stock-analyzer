import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUSStore } from '../store/useUSStore';
import { useUSStockData } from '../hooks/useUSStockData';
import type { USStock, DividendPayment, YearData } from '../types';

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Dividend Calendar ──────────────────────────────────────────────

function getAvailableYears(stocks: USStock[]): number[] {
  const years = new Set<number>();
  for (const s of stocks) {
    s.dividendPayments.forEach((p) => years.add(p.year));
    s.cashDividend.filter((d) => (d.value ?? 0) > 0).forEach((d) => years.add(d.year));
  }
  return Array.from(years).sort((a, b) => b - a);
}

function getBestYear(stocks: USStock[], allYears: number[]): number {
  if (allYears.length === 0) return new Date().getFullYear();
  for (const y of allYears) {
    if (stocks.every((s) => s.dividendPayments.some((p) => p.year === y))) return y;
  }
  return allYears[0];
}

function USDividendCalendar({ stocks }: { stocks: USStock[] }) {
  const selected = stocks.filter((s) => s.selected);
  const allYears = getAvailableYears(selected);
  const [pinnedYear, setPinnedYear] = useState<number | null>(null);

  const defaultYear = getBestYear(selected, allYears);
  const year = pinnedYear && allYears.includes(pinnedYear) ? pinnedYear : defaultYear;
  const yearIdx = allYears.indexOf(year);

  const allRows = selected
    .map((s) => {
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const total = s.dividendPayments
          .filter((p: DividendPayment) => p.year === year && p.month === month)
          .reduce((sum, p) => sum + p.amount, 0);
        return total > 0 ? total : null;
      });
      const hasMonthly = monthly.some((v) => v !== null);
      const annualValue: number | null = s.cashDividend.find((d: YearData) => d.year === year)?.value ?? null;
      return { stock: s, monthly, hasMonthly, annualValue };
    })
    .filter((r) => r.hasMonthly || (r.annualValue !== null && r.annualValue > 0) ||
      r.stock.dividendPayments.length > 0 || r.stock.cashDividend.some((d) => (d.value ?? 0) > 0));

  const hasShares = selected.some((s) => s.shares > 0);

  const monthlyTotals = Array.from({ length: 12 }, (_, i) =>
    allRows.reduce((sum, r) => {
      if (!r.hasMonthly) return sum;
      const perShare = r.monthly[i];
      if (perShare === null) return sum;
      return sum + perShare * (r.stock.shares || 0);
    }, 0)
  );

  const monthlyYearTotal = monthlyTotals.reduce((a, b) => a + b, 0);
  const annualOnlyTotal = allRows
    .filter((r) => !r.hasMonthly)
    .reduce((sum, r) => sum + (r.annualValue ?? 0) * (r.stock.shares || 0), 0);
  const yearTotal = monthlyYearTotal + annualOnlyTotal;

  if (selected.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f2f2f7' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f', margin: 0 }}>股利日曆</h2>
          <p style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>
            {hasShares && yearTotal > 0 && (
              <>{year} 年預估收入 <span style={{ color: '#10b981', fontWeight: 600 }}>${yearTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> · </>
            )}
            <span style={{ color: '#aeaeb2' }}>以下資料為除息月份（歷史確認）</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => allYears[yearIdx + 1] && setPinnedYear(allYears[yearIdx + 1])}
            disabled={yearIdx >= allYears.length - 1}
            style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#f5f5f7', cursor: yearIdx >= allYears.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d1d1f', opacity: yearIdx >= allYears.length - 1 ? 0.3 : 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f', minWidth: 48, textAlign: 'center' }}>{year}</span>
          <button
            onClick={() => allYears[yearIdx - 1] && setPinnedYear(allYears[yearIdx - 1])}
            disabled={yearIdx <= 0}
            style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#f5f5f7', cursor: yearIdx <= 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d1d1f', opacity: yearIdx <= 0 ? 0.3 : 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {allRows.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: '#aeaeb2', fontSize: 13 }}>
          {year} 年尚無股利紀錄
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6e6e73', fontWeight: 500, borderBottom: '1px solid #f2f2f7', minWidth: 80, position: 'sticky', left: 0, background: '#f9f9f9', zIndex: 1 }}>股票</th>
                {MONTHS.map((m) => (
                  <th key={m} style={{ textAlign: 'center', padding: '10px 6px', color: '#6e6e73', fontWeight: 500, borderBottom: '1px solid #f2f2f7', minWidth: 48 }}>{m}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '10px 16px', color: '#6e6e73', fontWeight: 500, borderBottom: '1px solid #f2f2f7', minWidth: 80, whiteSpace: 'nowrap' }}>年合計</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map(({ stock, monthly, hasMonthly, annualValue }, ri) => {
                const rowMonthlyTotal = monthly.reduce<number>((sum, v) => sum + (v ?? 0) * (stock.shares || 0), 0);
                const rowAnnualTotal = hasMonthly ? rowMonthlyTotal : (annualValue ?? 0) * (stock.shares || 0);
                return (
                  <tr key={stock.id} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '9px 16px', position: 'sticky', left: 0, background: ri % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1, borderRight: '1px solid #f2f2f7' }}>
                      <div style={{ fontWeight: 600, color: '#1d1d1f' }}>{stock.id}</div>
                      {stock.name && <div style={{ fontSize: 11, color: '#86868b', marginTop: 1 }}>{stock.name}</div>}
                    </td>
                    {monthly.map((val, mi) => (
                      <td key={mi} style={{ textAlign: 'center', padding: '9px 4px' }}>
                        {hasMonthly && val !== null ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <span style={{ color: '#0071e3', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{val.toFixed(4)}</span>
                            {stock.shares > 0 && (
                              <span style={{ fontSize: 10, color: '#86868b' }}>
                                ${(val * stock.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#e5e5ea' }}>—</span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', padding: '9px 16px', borderLeft: '1px solid #f2f2f7' }}>
                      {hasMonthly ? (
                        <span style={{ color: rowMonthlyTotal > 0 ? '#10b981' : '#1d1d1f', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {stock.shares > 0
                            ? (rowMonthlyTotal > 0 ? `$${rowMonthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—')
                            : `$${monthly.reduce<number>((s, v) => s + (v ?? 0), 0).toFixed(4)}`}
                        </span>
                      ) : annualValue !== null && annualValue > 0 ? (
                        <span style={{ color: '#10b981', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {stock.shares > 0
                            ? `$${rowAnnualTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                            : `$${annualValue.toFixed(4)}`}
                        </span>
                      ) : (
                        <span style={{ color: '#aeaeb2', fontWeight: 500 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: '#f5f5f7', borderTop: '2px solid #e5e5ea' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1d1d1f', position: 'sticky', left: 0, background: '#f5f5f7', zIndex: 1, borderRight: '1px solid #f2f2f7' }}>合計</td>
                {monthlyTotals.map((total, mi) => (
                  <td key={mi} style={{ textAlign: 'center', padding: '10px 4px', fontWeight: 600, color: total > 0 ? '#10b981' : '#aeaeb2', fontVariantNumeric: 'tabular-nums' }}>
                    {total > 0 ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                  </td>
                ))}
                <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, color: yearTotal > 0 ? '#10b981' : '#aeaeb2', fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #f2f2f7' }}>
                  {yearTotal > 0 ? `$${yearTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!hasShares && allRows.length > 0 && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f2f2f7', fontSize: 12, color: '#86868b', textAlign: 'center' }}>
          在股票卡片輸入持股數後可顯示預估現金收入
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function USHomePage() {
  const navigate = useNavigate();
  const { stocks, addStock, removeStock, toggleSelected, selectAll, updateShares, reorderStocks } = useUSStore();
  const { fetchStockData, loading, error } = useUSStockData();
  const [input, setInput] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  async function handleAdd() {
    const id = input.trim().toUpperCase();
    if (!id) return;
    addStock(id);
    setInput('');
    await fetchStockData(id);
  }

  async function handleReloadAll() {
    for (let i = 0; i < stocks.length; i++) {
      await fetchStockData(stocks[i].id, true);
      if (i < stocks.length - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const allSelected = stocks.every((s) => s.selected);
  const someSelected = stocks.some((s) => s.selected);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: SF }}>

      {/* ── Header ── */}
      <header style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 896, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f2f2f7', borderRadius: 10, padding: 3 }}>
            <button
              onClick={() => navigate('/')}
              style={{ fontSize: 13, fontWeight: 500, color: '#86868b', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 14px', borderRadius: 8, transition: 'all 0.15s' }}
            >
              台股
            </button>
            <button
              onClick={() => navigate('/us')}
              style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f', background: '#fff', border: 'none', cursor: 'pointer', padding: '5px 14px', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
            >
              美股
            </button>
          </div>
          <span style={{ fontSize: 12, color: '#aeaeb2' }}>v1.0</span>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 896, margin: '0 auto', padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {error && (
          <div style={{ background: '#fff3f3', border: '1px solid #ffd0d0', borderRadius: 12, padding: '12px 16px', color: '#c0392b', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Add Stock */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="輸入美股代號，例如 AAPL"
            style={{ flex: 1, border: '1px solid #e5e5ea', borderRadius: 10, padding: '9px 14px', fontSize: 14, outline: 'none', fontFamily: SF, background: '#f9f9f9', color: '#1d1d1f' }}
          />
          <button
            onClick={handleAdd}
            disabled={loading || !input.trim()}
            style={{ background: '#0071e3', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', opacity: loading || !input.trim() ? 0.5 : 1, fontFamily: SF, whiteSpace: 'nowrap' }}
          >
            新增
          </button>
        </div>

        {/* Stock List */}
        {stocks.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {/* List header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f2f2f7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                  onChange={(e) => selectAll(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, color: '#6e6e73', fontWeight: 500 }}>
                  {stocks.filter((s) => s.selected).length} / {stocks.length} 支
                </span>
              </div>
              <button
                onClick={handleReloadAll}
                disabled={loading}
                style={{ fontSize: 13, color: '#0071e3', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: loading ? 0.5 : 1, fontFamily: SF }}
              >
                {loading ? '更新中...' : '全部更新'}
              </button>
            </div>

            {/* Stock rows */}
            {stocks.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(s.id); }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => { e.preventDefault(); const fromId = e.dataTransfer.getData('text/plain'); reorderStocks(fromId, s.id); setDragOverId(null); }}
                onDragEnd={() => setDragOverId(null)}
                style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f2f2f7', gap: 12, background: dragOverId === s.id ? '#f0f7ff' : '#fff', transition: 'background 0.15s', cursor: 'grab' }}
              >
                <input
                  type="checkbox"
                  checked={s.selected}
                  onChange={() => toggleSelected(s.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                />

                {/* Ticker + Name */}
                <div style={{ flex: '0 0 120px', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#1d1d1f', fontSize: 15 }}>{s.id}</div>
                  {s.name && <div style={{ fontSize: 11, color: '#86868b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>}
                </div>

                {/* Price */}
                <div style={{ flex: '0 0 90px', textAlign: 'right' }}>
                  {s.price !== null ? (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f', fontVariantNumeric: 'tabular-nums' }}>
                        ${s.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: 11, color: '#86868b' }}>USD</div>
                    </>
                  ) : (
                    <span style={{ color: '#aeaeb2', fontSize: 13 }}>—</span>
                  )}
                </div>

                {/* PE */}
                <div style={{ flex: '0 0 60px', textAlign: 'right' }}>
                  {s.pe !== null ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1d1d1f', fontVariantNumeric: 'tabular-nums' }}>{s.pe.toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: '#86868b' }}>P/E</div>
                    </>
                  ) : (
                    <span style={{ color: '#aeaeb2', fontSize: 13 }}>—</span>
                  )}
                </div>

                {/* Shares */}
                <div style={{ flex: '0 0 100px', textAlign: 'right' }}>
                  <input
                    type="number"
                    value={s.shares || ''}
                    onChange={(e) => updateShares(s.id, Number(e.target.value) || 0)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="持股數"
                    style={{ width: '100%', border: '1px solid #e5e5ea', borderRadius: 8, padding: '5px 8px', fontSize: 12, textAlign: 'right', outline: 'none', fontFamily: SF, background: '#f9f9f9', color: '#1d1d1f' }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                  <button
                    onClick={() => fetchStockData(s.id, true)}
                    disabled={loading}
                    title="重新載入"
                    style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f5f5f7', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0071e3', opacity: loading ? 0.5 : 1 }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </button>
                  <button
                    onClick={() => removeStock(s.id)}
                    title="刪除"
                    style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#f5f5f7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff3b30' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dividend Calendar */}
        {stocks.some((s) => s.selected && (s.dividendPayments.length > 0 || s.cashDividend.length > 0)) && (
          <USDividendCalendar stocks={stocks} />
        )}

        {stocks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#aeaeb2', fontSize: 14 }}>
            輸入美股代號開始追蹤，例如：AAPL、JNJ、SCHD
          </div>
        )}
      </main>
    </div>
  );
}
