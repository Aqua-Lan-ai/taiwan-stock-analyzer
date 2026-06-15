import { useState } from 'react';
import type { Stock } from '../types';

interface Props {
  stocks: Stock[];
}

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

function getAvailableYears(stocks: Stock[]): number[] {
  const years = new Set<number>();
  for (const s of stocks) {
    const payments = s.financials?.dividendPayments ?? s.etfFinancials?.dividendPayments ?? [];
    payments.forEach((p) => years.add(p.year));
  }
  return Array.from(years).sort((a, b) => b - a);
}

export default function DividendCalendar({ stocks }: Props) {
  const selected = stocks.filter((s) => s.selected);
  const allYears = getAvailableYears(selected);
  const [pinnedYear, setPinnedYear] = useState<number | null>(null);

  // Use pinned year if still valid, otherwise fall back to most recent available
  const year = pinnedYear && allYears.includes(pinnedYear) ? pinnedYear : (allYears[0] ?? new Date().getFullYear());
  const yearIdx = allYears.indexOf(year);

  // Per-stock monthly amounts for the selected year
  const rows = selected
    .map((s) => {
      const payments = s.financials?.dividendPayments ?? s.etfFinancials?.dividendPayments ?? [];
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const total = payments
          .filter((p) => p.year === year && p.month === month)
          .reduce((sum, p) => sum + p.amount, 0);
        return total > 0 ? total : null;
      });
      const hasAny = monthly.some((v) => v !== null);
      return { stock: s, monthly, hasAny };
    })
    .filter((r) => r.hasAny);

  // Monthly totals (per share weighted by shares held)
  const monthlyTotals = Array.from({ length: 12 }, (_, i) =>
    rows.reduce((sum, r) => {
      const perShare = r.monthly[i];
      if (perShare === null) return sum;
      const shares = r.stock.shares || 0;
      return sum + perShare * shares;
    }, 0)
  );
  const yearTotal = monthlyTotals.reduce((a, b) => a + b, 0);
  const hasShares = selected.some((s) => s.shares > 0);

  if (selected.length === 0) return null;

  return (
    <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f2f2f7' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f', margin: 0 }}>股利日曆</h2>
          {hasShares && yearTotal > 0 && (
            <p style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>
              {year} 年預估收入 <span style={{ color: '#10b981', fontWeight: 600 }}>${yearTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => allYears[yearIdx + 1] && setPinnedYear(allYears[yearIdx + 1])}
            disabled={yearIdx < 0 || yearIdx >= allYears.length - 1}
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

      {rows.length === 0 ? (
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
                  <th key={m} style={{ textAlign: 'center', padding: '10px 6px', color: '#6e6e73', fontWeight: 500, borderBottom: '1px solid #f2f2f7', minWidth: 52 }}>{m}</th>
                ))}
                {hasShares && <th style={{ textAlign: 'right', padding: '10px 16px', color: '#6e6e73', fontWeight: 500, borderBottom: '1px solid #f2f2f7', minWidth: 70 }}>年合計</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ stock, monthly }, ri) => {
                const rowTotal = monthly.reduce<number>((sum, v) => sum + (v ?? 0) * (stock.shares || 0), 0);
                return (
                  <tr key={stock.id} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '9px 16px', position: 'sticky', left: 0, background: ri % 2 === 0 ? '#fff' : '#fafafa', zIndex: 1, borderRight: '1px solid #f2f2f7' }}>
                      <div style={{ fontWeight: 600, color: '#1d1d1f' }}>{stock.id}</div>
                      {stock.name && <div style={{ fontSize: 11, color: '#86868b', marginTop: 1 }}>{stock.name}</div>}
                    </td>
                    {monthly.map((val, mi) => (
                      <td key={mi} style={{ textAlign: 'center', padding: '9px 4px' }}>
                        {val !== null ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <span style={{ color: '#0071e3', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{val.toFixed(2)}</span>
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
                    {hasShares && (
                      <td style={{ textAlign: 'right', padding: '9px 16px', color: rowTotal > 0 ? '#10b981' : '#aeaeb2', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {rowTotal > 0 ? `$${rowTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* Total row */}
              {hasShares && (
                <tr style={{ background: '#f5f5f7', borderTop: '2px solid #e5e5ea' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1d1d1f', position: 'sticky', left: 0, background: '#f5f5f7', zIndex: 1, borderRight: '1px solid #f2f2f7' }}>合計</td>
                  {monthlyTotals.map((total, mi) => (
                    <td key={mi} style={{ textAlign: 'center', padding: '10px 4px', fontWeight: 600, color: total > 0 ? '#10b981' : '#aeaeb2', fontVariantNumeric: 'tabular-nums' }}>
                      {total > 0 ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                    ${yearTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!hasShares && rows.length > 0 && (
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f2f2f7', fontSize: 12, color: '#86868b', textAlign: 'center' }}>
          在股票卡片輸入持股數後可顯示預估現金收入
        </div>
      )}
    </div>
  );
}
