import { useStore } from '../store/useStore';
import { calcValuation } from '../utils/parser';
import type { YearData } from '../types';

interface Props {
  cashDividend: YearData[];
  eps: YearData[];
  price: number | null;
}

export default function ValuationCard({ cashDividend, eps, price }: Props) {
  const { settings } = useStore();
  const { buyPrice, sellPrice, cheapPrice, fairPrice, expensivePrice } =
    calcValuation(cashDividend, eps, settings.buyYield, settings.sellYield);

  // 近三年平均股利
  const recentDiv = [...cashDividend]
    .filter((d) => d.value !== null)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);
  const avgDiv = recentDiv.length > 0
    ? recentDiv.reduce((s, d) => s + (d.value ?? 0), 0) / recentDiv.length
    : null;

  // 近三年平均 EPS
  const recentEps = [...eps]
    .filter((d) => d.value !== null && (d.value ?? 0) > 0)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);
  const avgEps = recentEps.length > 0
    ? recentEps.reduce((s, d) => s + (d.value ?? 0), 0) / recentEps.length
    : null;

  // 現價隱含指標
  const currentYield = price && avgDiv ? (avgDiv / price) * 100 : null;
  const currentPE = price && avgEps ? price / avgEps : null;

  // 本益比區間
  const peZone =
    currentPE === null ? null
    : currentPE <= 15 ? 'cheap'
    : currentPE <= 20 ? 'fair'
    : currentPE <= 30 ? 'pricey'
    : 'expensive';

  const peZoneLabel: Record<string, string> = {
    cheap: '便宜', fair: '合理', pricey: '偏貴', expensive: '昂貴',
  };
  const peZoneColor: Record<string, string> = {
    cheap: '#10b981', fair: '#0071e3', pricey: '#ff9500', expensive: '#ff3b30',
  };

  // 殖利率距離目標
  const yieldGap = currentYield !== null ? currentYield - settings.buyYield : null;
  const yieldReached = yieldGap !== null && yieldGap >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 現況指標 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* 殖利率 */}
        <div style={{
          background: yieldReached ? '#ecfdf5' : '#fff',
          border: `1.5px solid ${yieldReached ? '#6ee7b7' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 16,
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <p style={{ fontSize: 12, color: '#86868b', marginBottom: 10 }}>現價殖利率</p>
          <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: yieldReached ? '#10b981' : '#1d1d1f' }}>
            {currentYield !== null ? `${currentYield.toFixed(2)}%` : '--'}
          </p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#86868b' }}>
              <span>目標買進 {settings.buyYield}%</span>
              {yieldGap !== null && (
                <span style={{ color: yieldReached ? '#10b981' : '#ff3b30', fontWeight: 500 }}>
                  {yieldReached ? '已達標' : `差 ${Math.abs(yieldGap).toFixed(2)}%`}
                </span>
              )}
            </div>
            {/* 進度條：現價殖利率相對於目標 */}
            {currentYield !== null && (
              <div style={{ height: 4, background: '#f2f2f7', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (currentYield / settings.buyYield) * 100).toFixed(1)}%`,
                  background: yieldReached ? '#10b981' : '#0071e3',
                  borderRadius: 2,
                  transition: 'width 0.3s',
                }} />
              </div>
            )}
            {avgDiv !== null && (
              <p style={{ fontSize: 11, color: '#aeaeb2', marginTop: 2 }}>
                近三年均股利 {avgDiv.toFixed(2)} 元
              </p>
            )}
          </div>
        </div>

        {/* 本益比 */}
        <div style={{
          background: '#fff',
          border: '1.5px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <p style={{ fontSize: 12, color: '#86868b', marginBottom: 10 }}>現價本益比</p>
          <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: peZone ? peZoneColor[peZone] : '#1d1d1f' }}>
            {currentPE !== null ? `${currentPE.toFixed(1)}x` : '--'}
          </p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#86868b' }}>
              <span>P/E 15 / 20 / 30</span>
              {peZone && (
                <span style={{ color: peZoneColor[peZone], fontWeight: 500 }}>
                  {peZoneLabel[peZone]}
                </span>
              )}
            </div>
            {/* 本益比色帶 */}
            {currentPE !== null && (
              <PEBar pe={currentPE} />
            )}
            {avgEps !== null && (
              <p style={{ fontSize: 11, color: '#aeaeb2', marginTop: 2 }}>
                近三年均 EPS {avgEps.toFixed(2)} 元
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 估價參考 */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        border: '1.5px solid rgba(0,0,0,0.08)',
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#86868b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
          估價參考
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0 }}>
          {[
            { label: '買進價',  value: buyPrice,       sub: `殖利率 ${settings.buyYield}%`, color: '#10b981' },
            { label: '便宜價',  value: cheapPrice,     sub: 'P/E 15',  color: '#34c759' },
            { label: '合理價',  value: fairPrice,      sub: 'P/E 20',  color: '#0071e3' },
            { label: '昂貴價',  value: expensivePrice, sub: 'P/E 30',  color: '#ff9500' },
            { label: '賣出價',  value: sellPrice,      sub: `殖利率 ${settings.sellYield}%`, color: '#ff3b30' },
          ].map(({ label, value, sub, color }, i) => {
            const isCurrent = price && value
              ? Math.abs(price - value) / value < 0.05
              : false;
            return (
              <div key={label} style={{
                textAlign: 'center',
                padding: '8px 4px',
                borderLeft: i > 0 ? '1px solid #f2f2f7' : 'none',
                background: isCurrent ? `${color}10` : 'transparent',
                borderRadius: 8,
              }}>
                <p style={{ fontSize: 11, color: '#86868b', marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: isCurrent ? color : '#1d1d1f', letterSpacing: '-0.01em' }}>
                  {value ? `$${value}` : '--'}
                </p>
                <p style={{ fontSize: 10, color: '#aeaeb2', marginTop: 2 }}>{sub}</p>
              </div>
            );
          })}
        </div>

        {/* 價格色帶 */}
        {buyPrice && cheapPrice && fairPrice && expensivePrice && sellPrice && price && (
          <div style={{ marginTop: 14 }}>
            <PriceBar
              price={price}
              buy={buyPrice}
              cheap={cheapPrice}
              fair={fairPrice}
              expensive={expensivePrice}
              sell={sellPrice}
            />
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
        return (
          <div key={i} style={{ background: z.color, width: `${((z.to - from) / max) * 100}%`, height: 4 }} />
        );
      })}
      <div style={{
        position: 'absolute',
        left: markerPct,
        top: -4,
        width: 2,
        height: 12,
        background: '#1d1d1f',
        borderRadius: 1,
        transform: 'translateX(-50%)',
      }} />
    </div>
  );
}

function PriceBar({ price, buy, cheap, fair, expensive, sell }: {
  price: number; buy: number; cheap: number; fair: number; expensive: number; sell: number;
}) {
  const allVals = [price, buy, cheap, fair, expensive, sell];
  const min = Math.min(...allVals) * 0.92;
  const max = Math.max(...allVals) * 1.05;
  const range = max - min;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - min) / range) * 100)).toFixed(1)}%`;

  const zones = [
    { from: min,      to: Math.min(buy, cheap),  color: '#dcfce7' },
    { from: Math.min(buy, cheap), to: fair,       color: '#dbeafe' },
    { from: fair,     to: expensive,              color: '#fef9c3' },
    { from: expensive, to: max,                   color: '#fee2e2' },
  ];

  return (
    <div>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
        {zones.map((z, i) => (
          <div key={i} style={{
            background: z.color,
            width: `${((Math.min(z.to, max) - Math.max(z.from, min)) / range) * 100}%`,
          }} />
        ))}
        <div style={{
          position: 'absolute',
          left: pct(price),
          top: -2,
          width: 3,
          height: 12,
          background: '#1d1d1f',
          borderRadius: 2,
          transform: 'translateX(-50%)',
        }} />
      </div>
      {/* 現價標籤 */}
      <div style={{ position: 'relative', height: 16, marginTop: 2 }}>
        <div style={{
          position: 'absolute',
          left: pct(price),
          transform: 'translateX(-50%)',
          fontSize: 10,
          color: '#1d1d1f',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>
          現價 ${price}
        </div>
      </div>
    </div>
  );
}
