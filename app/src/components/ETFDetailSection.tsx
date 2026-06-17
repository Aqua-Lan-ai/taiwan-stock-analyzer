import { useState } from 'react';
import type { ETFFinancials } from '../types';
import { evaluateETFIndicators } from '../utils/parser';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Props {
  etfFinancials: ETFFinancials;
  years: number;
  etfAUM: number | null;
  etfExpenseRatio: number | null;
  price: number | null;
}

const ETF_INDICATOR_DESCRIPTIONS: Record<string, { label: string; desc: string }> = {
  連續配息:   { label: '連續配息',  desc: '近三年每年均有配息' },
  殖利率達標: { label: '殖利率達標', desc: '近一年殖利率達到目標買進殖利率' },
  規模充足:   { label: '規模充足',  desc: '基金規模 ≥ 100 億（防清算風險）' },
  費用率合理: { label: '費用率合理', desc: '年費用率 ≤ 0.5%' },
  溢價合理:   { label: '溢價合理',  desc: '折溢價絕對值 ≤ 1%' },
};

function IndicatorRow({ label, desc, pass, unknown }: { label: string; desc: string; pass: boolean; unknown?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f2f2f7' }}
      className="last:border-0">
      <div>
        <span style={{ fontWeight: 500, fontSize: 15, color: '#1d1d1f' }}>{label}</span>
        <p style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>{desc}</p>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: unknown ? '#f2f2f7' : pass ? '#d1fae5' : '#fee2e2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {unknown ? (
          <span style={{ fontSize: 12, color: '#aeaeb2', fontWeight: 600 }}>?</span>
        ) : pass ? (
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

export default function ETFDetailSection({ etfFinancials, years, etfAUM, etfExpenseRatio, price }: Props) {
  const [tab, setTab] = useState<'配息' | '填息'>('配息');

  const dividendData = [...etfFinancials.cashDividend]
    .sort((a, b) => a.year - b.year)
    .slice(-years);

  const fillDaysData = [...etfFinancials.dividendDays]
    .sort((a, b) => a.year - b.year)
    .slice(-years);

  // Merge manual overrides, then evaluate all 5 indicators consistently
  const merged = { ...etfFinancials, aum: etfAUM ?? etfFinancials.aum, expenseRatio: etfExpenseRatio ?? etfFinancials.expenseRatio };
  const etfIndicators = evaluateETFIndicators(merged, 4, price);

  const indicators = [
    { key: '連續配息',   pass: etfIndicators.連續配息,   unknown: false },
    { key: '殖利率達標', pass: etfIndicators.殖利率達標,  unknown: false },
    { key: '規模充足',   pass: etfIndicators.規模充足,   unknown: merged.aum === null },
    { key: '費用率合理', pass: etfIndicators.費用率合理,  unknown: merged.expenseRatio === null },
    { key: '溢價合理',   pass: etfIndicators.溢價合理,   unknown: etfFinancials.premium === null },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Indicators */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '0 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {indicators.map(({ key, pass, unknown }) => {
          const { label, desc } = ETF_INDICATOR_DESCRIPTIONS[key];
          return <IndicatorRow key={key} label={label} desc={desc} pass={pass} unknown={unknown} />;
        })}
      </div>

      {/* Dividend chart */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '18px 16px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['配息', '填息'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '5px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
              background: tab === t ? '#1d1d1f' : '#f5f5f7',
              color: tab === t ? '#fff' : '#6e6e73',
            }}>
              {t === '配息' ? '配息紀錄' : '填息天數'}
            </button>
          ))}
        </div>

        {tab === '配息' ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dividendData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#f2f2f7" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12 }}
                formatter={(v) => {
                  const n = typeof v === 'number' ? v : null;
                  return [n === null ? '--' : `${n.toFixed(2)} 元`, '現金配息'];
                }}
              />
              <Bar dataKey="value" fill="#0071e3" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fillDaysData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#f2f2f7" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12 }}
                formatter={(v) => {
                  const n = typeof v === 'number' ? v : null;
                  return [n === null ? '--' : `${n} 天`, '填息天數'];
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {fillDaysData.map((d, i) => (
                  <Cell key={i} fill={(d.value ?? 999) <= 90 ? '#34c759' : (d.value ?? 999) <= 180 ? '#ff9500' : '#ff3b30'} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Dividend table */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#86868b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>配息紀錄</p>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9f9f9' }}>
              {['年度', '現金配息 (元)', '填息天數'].map((h, i) => (
                <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '8px 12px', color: '#6e6e73', fontWeight: 500, borderBottom: '1px solid #f2f2f7' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...etfFinancials.cashDividend].sort((a, b) => b.year - a.year).slice(0, years).map((d, i) => {
              const days = etfFinancials.dividendDays.find((x) => x.year === d.year)?.value;
              return (
                <tr key={d.year} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '9px 12px', color: '#1d1d1f' }}>{d.year}</td>
                  <td style={{ textAlign: 'right', padding: '9px 12px', color: '#1d1d1f', fontVariantNumeric: 'tabular-nums' }}>
                    {d.value !== null ? d.value.toFixed(2) : '--'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '9px 12px', color: days !== undefined && days !== null ? (days <= 90 ? '#10b981' : days <= 180 ? '#ff9500' : '#ff3b30') : '#aeaeb2', fontVariantNumeric: 'tabular-nums' }}>
                    {days !== undefined && days !== null ? `${days} 天` : '--'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
