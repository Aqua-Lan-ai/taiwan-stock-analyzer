import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { YearData } from '../../types';

interface Props {
  freeCashFlow: YearData[];
  years: number;
}

export default function FreeCashFlowChart({ freeCashFlow, years }: Props) {
  const data = [...freeCashFlow]
    .sort((a, b) => a.year - b.year)
    .slice(-years)
    .map((d) => ({ year: d.year, 自由現金流量: d.value }));

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px 16px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f', marginBottom: 14, letterSpacing: '-0.01em' }}>自由現金流量</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#f2f2f7" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#86868b' }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: 12 }}
            formatter={(v) => {
              const n = typeof v === 'number' ? v : null;
              return [n === null ? '--' : `${n.toLocaleString()}億`, '自由現金流量'];
            }}
          />
          <Bar dataKey="自由現金流量" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={(entry.自由現金流量 ?? 0) >= 0 ? '#34c759' : '#ff3b30'} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
