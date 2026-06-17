import { calcValuation } from '../utils/parser';
import type { YearData } from '../types';

interface Props {
  cashDividend: YearData[];
  eps: YearData[];
  price: number | null;
}

const YIELD = 4; // fixed 4%

export default function ValuationCard({ cashDividend, eps, price }: Props) {
  const { cheapPrice, fairPrice, expensivePrice, buyPrice } =
    calcValuation(cashDividend, eps, YIELD, YIELD);

  const recentDiv = [...cashDividend]
    .filter((d) => d.value !== null)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);
  const avgDiv = recentDiv.length > 0
    ? recentDiv.reduce((s, d) => s + (d.value ?? 0), 0) / recentDiv.length
    : null;

  const recentEps = [...eps]
    .filter((d) => d.value !== null && (d.value ?? 0) > 0)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);
  const avgEps = recentEps.length > 0
    ? recentEps.reduce((s, d) => s + (d.value ?? 0), 0) / recentEps.length
    : null;

  const currentYield = price && avgDiv ? (avgDiv / price) * 100 : null;
  const currentPE = price && avgEps ? price / avgEps : null;

  const yieldReached = currentYield !== null && currentYield >= YIELD;
  const yieldGap = currentYield !== null ? currentYield - YIELD : null;

  const peZone =
    currentPE === null ? null
    : currentPE <= 15 ? 'cheap'
    : currentPE <= 20 ? 'fair'
    : currentPE <= 30 ? 'pricey'
    : 'expensive';

  const peZoneLabel: Record<string, string> = { cheap: '便宜', fair: '合理', pricey: '偏貴', expensive: '昂貴' };
  const peZoneColor: Record<string, string> = { cheap: '#10b981', fair: '#0071e3', pricey: '#ff9500', expensive: '#ff3b30' };

  const cardStyle = {
    background: '#fff',
    border: '1.5px solid rgba(0,0,0,0.08)',
    borderRadius: 16,
    padding: '16px 18px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    minHeight: 110,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 上方：現況指標 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* 現價殖利率 */}
        <div style={{ ...cardStyle, background: yieldReached ? '#ecfdf5' : '#fff', border: `1.5px solid ${yieldReached ? '#6ee7b7' : 'rgba(0,0,0,0.08)'}` }}>
          <div>
            <p style={{ fontSize: 11, color: '#86868b', marginBottom: 6 }}>現價殖利率</p>
            <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: yieldReached ? '#10b981' : '#1d1d1f' }}>
              {currentYield !== null ? `${currentYield.toFixed(2)}%` : '--'}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#86868b' }}>
              <span>目標 {YIELD}%</span>
              {yieldGap !== null && (
                <span style={{ color: yieldReached ? '#10b981' : '#ff3b30', fontWeight: 500 }}>
                  {yieldReached ? '已達標' : `差 ${Math.abs(yieldGap).toFixed(2)}%`}
                </span>
              )}
            </div>
            {currentYield !== null && (
              <div style={{ height: 4, background: '#f2f2f7', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (currentYield / YIELD) * 100).toFixed(1)}%`, background: yieldReached ? '#10b981' : '#0071e3', borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
            )}
            {avgDiv !== null && <p style={{ fontSize: 10, color: '#aeaeb2' }}>近三年均股利 {avgDiv.toFixed(2)} 元</p>}
          </div>
        </div>

        {/* 現價本益比 */}
        <div style={cardStyle}>
          <div>
            <p style={{ fontSize: 11, color: '#86868b', marginBottom: 6 }}>現價本益比</p>
            <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: peZone ? peZoneColor[peZone] : '#1d1d1f' }}>
              {currentPE !== null ? `${currentPE.toFixed(1)}x` : '--'}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#86868b' }}>
              <span>P/E 15 / 20 / 30</span>
              {peZone && <span style={{ color: peZoneColor[peZone], fontWeight: 500 }}>{peZoneLabel[peZone]}</span>}
            </div>
            {currentPE !== null && <PEBar pe={currentPE} />}
            {avgEps !== null && <p style={{ fontSize: 10, color: '#aeaeb2' }}>近三年均 EPS {avgEps.toFixed(2)} 元</p>}
          </div>
        </div>
      </div>

      {/* 下方：估價參考 */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1.5px solid rgba(0,0,0,0.08)', minHeight: 110, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#86868b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>估價參考</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, flex: 1 }}>
          {[
            { label: '便宜價', value: cheapPrice,     sub: 'P/E 15',      color: '#10b981' },
            { label: '合理價', value: fairPrice,      sub: 'P/E 20',      color: '#0071e3' },
            { label: '昂貴價', value: expensivePrice, sub: 'P/E 30',      color: '#ff9500' },
            { label: '殖利率價', value: buyPrice,     sub: `殖利率 ${YIELD}%`, color: '#8b5cf6' },
          ].map(({ label, value, sub, color }, i) => {
            const isCurrent = price && value ? Math.abs(price - value) / value < 0.05 : false;
            return (
              <div key={label} style={{ textAlign: 'center', padding: '4px 4px', borderLeft: i > 0 ? '1px solid #f2f2f7' : 'none', background: isCurrent ? `${color}12` : 'transparent', borderRadius: 8 }}>
                <p style={{ fontSize: 10, color: '#86868b', marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 17, fontWeight: 700, color: isCurrent ? color : '#1d1d1f', letterSpacing: '-0.01em' }}>
                  {value ? `$${value}` : '--'}
                </p>
                <p style={{ fontSize: 10, color: '#aeaeb2', marginTop: 2 }}>{sub}</p>
              </div>
            );
          })}
        </div>

        {cheapPrice && fairPrice && expensivePrice && buyPrice && price && (
          <div style={{ marginTop: 12 }}>
            <PriceBar price={price} cheap={cheapPrice} fair={fairPrice} expensive={expensivePrice} buy={buyPrice} />
          </div>
        )}
      </div>
    </div>
  );
}

function PEBar({ pe }: { pe: number }) {
  const max = 40;
  const zones = [
    { to: 15,  color: '#dcfce7' },
    { to: 20,  color: '#dbeafe' },
    { to: 30,  color: '#fef9c3' },
    { to: max, color: '#fee2e2' },
  ];
  const markerPct = `${Math.min(100, (pe / max) * 100).toFixed(1)}%`;
  return (
    <div style={{ position: 'relative', height: 4, borderRadius: 2, overflow: 'visible', display: 'flex' }}>
      {zones.map((z, i) => {
        const from = i === 0 ? 0 : zones[i - 1].to;
        return <div key={i} style={{ background: z.color, width: `${((z.to - from) / max) * 100}%`, height: 4 }} />;
      })}
      <div style={{ position: 'absolute', left: markerPct, top: -4, width: 2, height: 12, background: '#1d1d1f', borderRadius: 1, transform: 'translateX(-50%)' }} />
    </div>
  );
}

function PriceBar({ price, cheap, fair, expensive, buy }: {
  price: number; cheap: number; fair: number; expensive: number; buy: number;
}) {
  const allVals = [price, cheap, fair, expensive, buy];
  const min = Math.min(...allVals) * 0.92;
  const max = Math.max(...allVals) * 1.06;
  const range = max - min;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / range) * 100)).toFixed(1)}%`;

  return (
    <div>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        {[
          { from: min,       to: cheap,     color: '#dcfce7' },
          { from: cheap,     to: fair,      color: '#dbeafe' },
          { from: fair,      to: expensive, color: '#fef9c3' },
          { from: expensive, to: max,       color: '#fee2e2' },
        ].map((z, i) => (
          <div key={i} style={{ background: z.color, width: `${((Math.min(z.to, max) - Math.max(z.from, min)) / range) * 100}%` }} />
        ))}
        {/* 現價 marker */}
        <div style={{ position: 'absolute', left: pct(price), top: -2, width: 3, height: 12, background: '#1d1d1f', borderRadius: 2, transform: 'translateX(-50%)' }} />
        {/* 殖利率 buy price marker */}
        <div style={{ position: 'absolute', left: pct(buy), top: 0, width: 2, height: 8, background: '#8b5cf6', borderRadius: 1, transform: 'translateX(-50%)', opacity: 0.8 }} />
      </div>
      <div style={{ position: 'relative', height: 16, marginTop: 2 }}>
        <div style={{ position: 'absolute', left: pct(price), transform: 'translateX(-50%)', fontSize: 10, color: '#1d1d1f', fontWeight: 600, whiteSpace: 'nowrap' }}>
          現價 ${price}
        </div>
      </div>
    </div>
  );
}
