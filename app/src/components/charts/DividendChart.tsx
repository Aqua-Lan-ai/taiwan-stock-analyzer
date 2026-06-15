import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { YearData } from '../../types';

interface Props {
  cashDividend: YearData[];
  payoutRatio: YearData[];
  eps: YearData[];
  years: number;
}

export default function DividendChart({ cashDividend, payoutRatio, eps, years }: Props) {
  const allYears = [...new Set([...cashDividend, ...eps].map((d) => d.year))]
    .sort((a, b) => a - b)
    .slice(-years);

  const data = allYears.map((year) => ({
    year,
    EPS: eps.find((d) => d.year === year)?.value ?? null,
    現金股利: cashDividend.find((d) => d.year === year)?.value ?? null,
    配發率: payoutRatio.find((d) => d.year === year)?.value ?? null,
  }));

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px 16px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f', marginBottom: 14, letterSpacing: '-0.01em' }}>現金股利 vs 配發率</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#f2f2f7" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12 }}
            formatter={(v, name) => {
              const n = typeof v === 'number' ? v : null;
              return [n === null ? '--' : name === '配發率' ? `${n.toFixed(1)}%` : `${n.toFixed(2)}元`, name as string];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#6e6e73' }} />
          <Bar yAxisId="left" dataKey="EPS" fill="#0071e3" radius={[4, 4, 0, 0]} opacity={0.5} />
          <Line yAxisId="left" type="monotone" dataKey="現金股利" stroke="#ff9500" strokeWidth={2} dot={{ r: 3, fill: '#ff9500', strokeWidth: 0 }} />
          <Line yAxisId="right" type="monotone" dataKey="配發率" stroke="#34c759" strokeWidth={2} dot={{ r: 3, fill: '#34c759', strokeWidth: 0 }} strokeDasharray="5 5" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
