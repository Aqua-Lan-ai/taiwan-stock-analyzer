import { useState } from 'react';
import { useUSStore } from '../store/useUSStore';
import { useUSStockData, calcGrahamNumber, calcDDM } from '../hooks/useUSStockData';
import SharedHeader from '../components/SharedHeader';
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

function TaxToggle({ afterTax, onChange }: { afterTax: boolean; onChange: (v: boolean) => void }) {
  const btn = (label: string, active: boolean, val: boolean) => (
    <button
      onClick={() => onChange(val)}
      style={{
        fontSize: 12, fontWeight: active ? 600 : 500,
        color: active ? '#1d1d1f' : '#86868b',
        background: active ? '#fff' : 'none',
        border: 'none', cursor: 'pointer',
        padding: '4px 10px', borderRadius: 7,
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        fontFamily: SF,
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f2f2f7', borderRadius: 9, padding: 2 }}>
      {btn('稅前', !afterTax, false)}
      {btn('稅後', afterTax, true)}
    </div>
  );
}

function USDividendCalendar({ stocks }: { stocks: USStock[] }) {
  const selected = stocks.filter((s) => s.selected);
  const allYears = getAvailableYears(selected);
  const [pinnedYear, setPinnedYear] = useState<number | null>(null);
  const [afterTax, setAfterTax] = useState(false);

  const defaultYear = getBestYear(selected, allYears);
  const year = pinnedYear && allYears.includes(pinnedYear) ? pinnedYear : defaultYear;
  const yearIdx = allYears.indexOf(year);

  const allRows = selected
    .map((s) => {
      const taxMult = afterTax ? (1 - s.withholdingRate / 100) : 1;
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const total = s.dividendPayments
          .filter((p: DividendPayment) => p.year === year && p.month === month)
          .reduce((sum, p) => sum + p.amount, 0);
        return total > 0 ? total * taxMult : null;
      });
      const hasMonthly = monthly.some((v) => v !== null);
      const annualRaw: number | null = s.cashDividend.find((d: YearData) => d.year === year)?.value ?? null;
      const annualValue = annualRaw != null ? annualRaw * taxMult : null;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TaxToggle afterTax={afterTax} onChange={setAfterTax} />
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
                          {stock.shares > 0 ? `$${rowAnnualTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${annualValue.toFixed(4)}`}
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
  const { stocks, addStock, removeStock, toggleSelected, selectAll, updateShares, reorderStocks } = useUSStore();
  const { fetchStockData, loading, error } = useUSStockData();
  const [input, setInput] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  async function handleAdd() {
    const id = input.trim().toUpperCase().replace(/\//g, '-');
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

      <SharedHeader activeTab="us" />

      <main style={{ maxWidth: 896, margin: '0 auto', padding: '24px 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#c62828' }}>
            {error}
          </div>
        )}

        {/* ── 新增股票 ── */}
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="輸入股票代號，例如 AAPL"
            style={{
              flex: 1, border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12,
              padding: '12px 18px', fontSize: 15, color: '#1d1d1f',
              background: '#fff', outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              fontFamily: SF,
            }}
          />
          <button
            onClick={handleAdd}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? '#aeaeb2' : '#0071e3',
              color: '#fff', border: 'none', borderRadius: 12,
              padding: '12px 24px', fontSize: 15, fontWeight: 500,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', fontFamily: SF,
            }}
          >
            {loading ? '載入中...' : '新增'}
          </button>
        </div>

        {stocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#aeaeb2' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 14px', display: 'block', opacity: 0.35 }}>
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#6e6e73', marginBottom: 6 }}>尚未新增任何股票</p>
            <p style={{ fontSize: 13, color: '#aeaeb2' }}>輸入股票代號開始分析</p>
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
                  {someSelected ? `已選 ${stocks.filter((s) => s.selected).length} / ${stocks.length}` : '全選'}
                </span>
              </div>
              <button
                onClick={handleReloadAll}
                disabled={loading}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 500, color: loading ? '#aeaeb2' : '#0071e3', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? '更新中...' : '全部更新'}
              </button>
            </div>

            {/* ── 股票列表 ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stocks.map((s) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(s.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => { e.preventDefault(); const fromId = e.dataTransfer.getData('text/plain'); reorderStocks(fromId, s.id); setDragOverId(null); }}
                  onDragEnd={() => setDragOverId(null)}
                  style={{
                    background: '#fff', borderRadius: 14, padding: '12px 16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    opacity: dragOverId === s.id ? 0.5 : 1,
                    transition: 'opacity 0.15s', cursor: 'grab',
                  }}
                >
                  {/* Drag handle */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d1d6" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, cursor: 'grab' }}>
                    <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/>
                  </svg>

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSelected(s.id)}
                    style={{
                      flexShrink: 0, width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${s.selected ? '#0071e3' : '#d1d1d6'}`,
                      background: s.selected ? '#0071e3' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {s.selected && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  {/* Stock info */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#0071e3', textAlign: 'center', lineHeight: 1.1 }}>{s.id}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: '#1d1d1f' }}>{s.id}</span>
                        {s.name && <span style={{ fontSize: 13, color: '#6e6e73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#aeaeb2', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {s.price !== null ? (
                          <span>${s.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                        ) : (
                          <span>尚未載入</span>
                        )}
                        {s.pe !== null && <><span>|</span><span>P/E {s.pe.toFixed(1)}</span></>}
                        {(() => {
                          const graham = calcGrahamNumber(s.eps, s.bvps);
                          const ddm = calcDDM(s.cashDividend);
                          if (!graham && !ddm) return null;
                          return (
                            <>
                              <span>|</span>
                              {graham && (
                                <span style={{ color: s.price && graham > s.price ? '#10b981' : '#ff3b30' }}>
                                  Graham ${Math.round(graham)}
                                </span>
                              )}
                              {graham && ddm && <span>·</span>}
                              {ddm && (
                                <span style={{ color: s.price && ddm > s.price ? '#10b981' : '#ff3b30' }}>
                                  DDM ${Math.round(ddm)}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Shares */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <input
                      type="number" min="0" placeholder="0"
                      value={s.shares || ''}
                      onChange={(e) => updateShares(s.id, Number(e.target.value) || 0)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 64, border: '1px solid #e5e5ea', borderRadius: 8, padding: '5px 8px', fontSize: 13, textAlign: 'right', color: '#1d1d1f', outline: 'none', background: '#fafafa', fontFamily: SF }}
                    />
                    <span style={{ fontSize: 12, color: '#aeaeb2', whiteSpace: 'nowrap' }}>股</span>
                  </div>

                  {/* Refresh + Delete */}
                  <button
                    onClick={() => fetchStockData(s.id, true)}
                    disabled={loading}
                    style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: loading ? 'not-allowed' : 'pointer', color: '#aeaeb2', flexShrink: 0, opacity: loading ? 0.5 : 1 }}
                    onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.color = '#0071e3'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#aeaeb2'; }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  </button>
                  <button
                    onClick={() => removeStock(s.id)}
                    style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#aeaeb2', flexShrink: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ff3b30'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#aeaeb2'; }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* ── 股利日曆 ── */}
            <USDividendCalendar stocks={stocks} />
          </>
        )}
      </main>
    </div>
  );
}
