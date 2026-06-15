import { useState } from 'react';
import type { TableType } from '../types';
import type { Financials } from '../types';

interface Props {
  financials: Financials;
  years: number;
}

type Row = { label: string; data: { year: number; value: number | null }[] };

function makeRows(financials: Financials, tableType: TableType, years: number): Row[] {
  const trim = (arr: { year: number; value: number | null }[]) =>
    [...arr].sort((a, b) => b.year - a.year).slice(0, years).reverse();

  switch (tableType) {
    case '獲利能力指標':
      return [
        { label: 'ROE (%)', data: trim(financials.roe) },
        { label: '毛利率 (%)', data: trim(financials.grossMargin) },
        { label: '營益率 (%)', data: trim(financials.operatingMargin) },
      ];
    case '損益表':
      return [
        { label: '營業收入 (億)', data: trim(financials.revenue) },
        { label: '營業利益 (億)', data: trim(financials.operatingProfit) },
        { label: '稅後淨利 (億)', data: trim(financials.netProfit) },
        { label: 'EPS (元)', data: trim(financials.eps) },
      ];
    case '現金流量表':
      return [
        { label: '營業現金流 (億)', data: trim(financials.cfo) },
        { label: '資本支出 (億)', data: trim(financials.capex) },
        { label: '自由現金流量 (億)', data: trim(financials.freeCashFlow) },
      ];
    case '股利政策表':
      return [
        { label: '現金股利 (元)', data: trim(financials.cashDividend) },
        { label: '現金配發率 (%)', data: trim(financials.payoutRatio) },
        { label: '填息天數', data: trim(financials.dividendDays) },
      ];
    default:
      return [];
  }
}

const TABLE_TYPES: TableType[] = ['獲利能力指標', '損益表', '現金流量表', '股利政策表'];

export default function DataTable({ financials, years }: Props) {
  const [active, setActive] = useState<TableType>('損益表');
  const rows = makeRows(financials, active, years);
  const colYears = rows[0]?.data.map((d) => d.year) ?? [];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: '#f5f5f7', borderRadius: 10, padding: 3 }}>
        {TABLE_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setActive(t)}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: active === t ? '#fff' : 'transparent',
              color: active === t ? '#1d1d1f' : '#6e6e73',
              boxShadow: active === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #f2f2f7' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f9' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', color: '#6e6e73', fontWeight: 500, minWidth: 140, borderBottom: '1px solid #f2f2f7' }}>項目</th>
              {colYears.map((y) => (
                <th key={y} style={{ textAlign: 'right', padding: '10px 14px', color: '#6e6e73', fontWeight: 500, minWidth: 70, borderBottom: '1px solid #f2f2f7' }}>
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '10px 16px', color: '#1d1d1f' }}>{row.label}</td>
                {row.data.map((d, j) => (
                  <td
                    key={j}
                    style={{
                      textAlign: 'right',
                      padding: '10px 14px',
                      fontVariantNumeric: 'tabular-nums',
                      color: d.value !== null && d.value < 0 ? '#ff3b30' : '#1d1d1f',
                      fontWeight: 400,
                    }}
                  >
                    {d.value !== null ? d.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
