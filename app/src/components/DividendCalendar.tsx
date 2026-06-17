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
    // Always include annual cashDividend years so every stock's years are navigable
    const annual = s.financials?.cashDividend ?? s.etfFinancials?.cashDividend ?? [];
    annual.filter((d) => (d.value ?? 0) > 0).forEach((d) => years.add(d.year));
  }
  return Array.from(years).sort((a, b) => b - a);
}

function getBestYear(stocks: Stock[], allYears: number[]): number {
  if (allYears.length === 0) return new Date().getFullYear();
  // Pass 1: most recent year where ALL stocks have monthly payment data
  for (const y of allYears) {
    if (stocks.every((s) => {
      const p = s.financials?.dividendPayments ?? s.etfFinancials?.dividendPayments ?? [];
      return p.some((x) => x.year === y);
    })) return y;
  }
  // Pass 2: most recent year where ALL stocks have at least cashDividend data
  for (const y of allYears) {
    if (stocks.every((s) => {
      const p = s.financials?.dividendPayments ?? s.etfFinancials?.dividendPayments ?? [];
      const a = s.financials?.cashDividend ?? s.etfFinancials?.cashDividend ?? [];
      return p.some((x) => x.year === y) || a.some((d) => d.year === y && (d.value ?? 0) > 0);
    })) return y;
  }
  return allYears[0];
}

function InfoIcon({ tooltip }: { tooltip: string }) {
  return (
    <span
      title={tooltip}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: '#e5e5ea', color: '#86868b', fontSize: 9, fontWeight: 700, cursor: 'help', flexShrink: 0, marginLeft: 4 }}
    >
      i
    </span>
  );
}

export default function DividendCalendar({ stocks }: Props) {
  const selected = stocks.filter((s) => s.selected);
  const allYears = getAvailableYears(selected);
  const [pinnedYear, setPinnedYear] = useState<number | null>(null);

  const defaultYear = getBestYear(selected, allYears);
  const year = pinnedYear && allYears.includes(pinnedYear) ? pinnedYear : defaultYear;
  const yearIdx = allYears.indexOf(year);

  const allRows = selected
    .map((s) => {
      const payments = s.financials?.dividendPayments ?? s.etfFinancials?.dividendPayments ?? [];
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const total = payments
          .filter((p) => p.year === year && p.month === month)
          .reduce((sum, p) => sum + p.amount, 0);
        return total > 0 ? total : null;
      });
      const hasMonthly = monthly.some((v) => v !== null);

      const annualData = s.financials?.cashDividend ?? s.etfFinancials?.cashDividend ?? [];
      const annualValue = annualData.find((d) => d.year === year)?.value ?? null;

      return { stock: s, monthly, hasMonthly, annualValue };
    })
    .filter((r) => {
      if (r.hasMonthly || (r.annualValue !== null && r.annualValue > 0)) return true;
      // Always show stocks that have any dividend history, even if not for this year
      const allPayments = r.stock.financials?.dividendPayments ?? r.stock.etfFinancials?.dividendPayments ?? [];
      const allAnnual = r.stock.financials?.cashDividend ?? r.stock.etfFinancials?.cashDividend ?? [];
      return allPayments.length > 0 || allAnnual.some((d) => (d.value ?? 0) > 0);
    });

  const hasShares = selected.some((s) => s.shares > 0);

  // Monthly totals (only from stocks with monthly breakdown)
  const monthlyTotals = Array.from({ length: 12 }, (_, i) =>
    allRows.reduce((sum, r) => {
      if (!r.hasMonthly) return sum;
      const perShare = r.monthly[i];
      if (perShare === null) return sum;
      return sum + perShare * (r.stock.shares || 0);
    }, 0)
  );

  // Year total includes both monthly stocks and annual-only stocks
  const monthlyYearTotal = monthlyTotals.reduce((a, b) => a + b, 0);
  const annualOnlyTotal = allRows
    .filter((r) => !r.hasMonthly)
    .reduce((sum, r) => sum + (r.annualValue ?? 0) * (r.stock.shares || 0), 0);
  const yearTotal = monthlyYearTotal + annualOnlyTotal;

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
          <p style={{ fontSize: 11, color: '#aeaeb2', marginTop: 2 }}>以下資料為除息月份</p>
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
                  <th key={m} style={{ textAlign: 'center', padding: '10px 6px', color: '#6e6e73', fontWeight: 500, borderBottom: '1px solid #f2f2f7', minWidth: 52 }}>{m}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '10px 16px', color: '#6e6e73', fontWeight: 500, borderBottom: '1px solid #f2f2f7', minWidth: 80, whiteSpace: 'nowrap' }}>年合計</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map(({ stock, monthly, hasMonthly, annualValue }, ri) => {
                const rowMonthlyTotal = monthly.reduce<number>((sum, v) => sum + (v ?? 0) * (stock.shares || 0), 0);
                const rowAnnualTotal = hasMonthly
                  ? rowMonthlyTotal
                  : (annualValue ?? 0) * (stock.shares || 0);

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
                    {/* 年合計 */}
                    <td style={{ textAlign: 'right', padding: '9px 16px', borderLeft: '1px solid #f2f2f7' }}>
                      {hasMonthly ? (
                        // Monthly payer: show total if shares set, else per-share sum
                        <span style={{ color: rowMonthlyTotal > 0 ? '#10b981' : (stock.shares > 0 ? '#aeaeb2' : '#1d1d1f'), fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {stock.shares > 0
                            ? (rowMonthlyTotal > 0 ? `$${rowMonthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—')
                            : `${monthly.reduce<number>((s, v) => s + (v ?? 0), 0).toFixed(2)} 元`}
                        </span>
                      ) : annualValue !== null && annualValue > 0 ? (
                        // Annual-only payer — amount known but ex-date not confirmed monthly
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <InfoIcon tooltip="除息日尚未公佈，僅顯示年度合計" />
                          <span style={{ color: '#10b981', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {stock.shares > 0
                              ? `$${rowAnnualTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} (預估)`
                              : `${annualValue.toFixed(2)} 元 (預估)`}
                          </span>
                        </div>
                      ) : (
                        // No data for this year
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <InfoIcon tooltip="尚未公佈除息日與股利資訊" />
                          <span style={{ color: '#aeaeb2', fontWeight: 500 }}>尚未公告</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Total row */}
              <tr style={{ background: '#f5f5f7', borderTop: '2px solid #e5e5ea' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1d1d1f', position: 'sticky', left: 0, background: '#f5f5f7', zIndex: 1, borderRight: '1px solid #f2f2f7' }}>合計</td>
                {monthlyTotals.map((total, mi) => (
                  <td key={mi} style={{ textAlign: 'center', padding: '10px 4px', fontWeight: 600, color: total > 0 ? '#10b981' : '#aeaeb2', fontVariantNumeric: 'tabular-nums' }}>
                    {total > 0 ? `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                  </td>
                ))}
                <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, color: yearTotal > 0 ? '#10b981' : '#aeaeb2', fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid #f2f2f7' }}>
                  {yearTotal > 0 ? `$${yearTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
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
