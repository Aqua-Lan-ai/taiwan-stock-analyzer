import type { ETFFinancials } from '../types';

const YIELD = 4; // fixed 4%

interface Props {
  etfFinancials: ETFFinancials;
  price: number | null;
  etfAUM: number | null;
  etfExpenseRatio: number | null;
  onMetaChange: (aum: number | null, expenseRatio: number | null) => void;
}

export default function ETFValuationCard({ etfFinancials, price, etfAUM, etfExpenseRatio, onMetaChange }: Props) {
  const aum = etfAUM ?? etfFinancials.aum;
  const isAUMAutoDetected = etfAUM === null && etfFinancials.aum !== null;
  const expenseRatio = etfExpenseRatio ?? etfFinancials.expenseRatio;
  const isExpenseEstimated = etfExpenseRatio === null && etfFinancials.expenseRatio !== null;
  const recentDivs = [...etfFinancials.cashDividend]
    .filter((d) => d.value !== null)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);

  const avgDiv = recentDivs.length > 0
    ? recentDivs.reduce((s, d) => s + (d.value ?? 0), 0) / recentDivs.length
    : null;

  const currentYield = price && avgDiv ? (avgDiv / price) * 100 : null;
  const yieldReached = currentYield !== null && currentYield >= YIELD;
  const yieldGap = currentYield !== null ? currentYield - YIELD : null;

  const buyPrice = avgDiv && YIELD > 0
    ? Math.round((avgDiv / (YIELD / 100)))
    : null;

  const { nav, premium } = etfFinancials;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Yield + NAV premium */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Current yield */}
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
              <span>目標 {YIELD}%</span>
              {yieldGap !== null && (
                <span style={{ color: yieldReached ? '#10b981' : '#ff3b30', fontWeight: 500 }}>
                  {yieldReached ? '已達標' : `差 ${Math.abs(yieldGap).toFixed(2)}%`}
                </span>
              )}
            </div>
            <div style={{ height: 4, background: '#f2f2f7', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, currentYield ? (currentYield / YIELD) * 100 : 0).toFixed(1)}%`,
                background: yieldReached ? '#10b981' : '#0071e3',
                borderRadius: 2,
              }} />
            </div>
            {avgDiv !== null && (
              <p style={{ fontSize: 11, color: '#aeaeb2', marginTop: 2 }}>近三年均配息 {avgDiv.toFixed(2)} 元</p>
            )}
          </div>
        </div>

        {/* Premium / NAV */}
        <div style={{
          background: '#fff',
          border: `1.5px solid ${premium !== null && Math.abs(premium) > 1 ? '#fca5a5' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 16,
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <p style={{ fontSize: 12, color: '#86868b', marginBottom: 10 }}>折溢價</p>
          <p style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: premium !== null && Math.abs(premium) > 1 ? '#ff3b30' : '#1d1d1f' }}>
            {premium !== null ? `${premium > 0 ? '+' : ''}${premium.toFixed(2)}%` : '--'}
          </p>
          <div style={{ marginTop: 12, fontSize: 11, color: '#86868b', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>淨值 (NAV)</span>
              <span style={{ color: '#1d1d1f', fontWeight: 500 }}>{nav !== null ? `$${nav}` : '--'}</span>
            </div>
            {premium !== null && (
              <p style={{ color: Math.abs(premium) <= 1 ? '#10b981' : '#ff9500', fontWeight: 500, marginTop: 2 }}>
                {Math.abs(premium) <= 1 ? '溢價合理' : Math.abs(premium) <= 2 ? '溢價偏高' : '溢價過高，注意'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ETF meta info */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        border: '1.5px solid rgba(0,0,0,0.08)',
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#86868b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
          ETF 基本資料
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {/* 基金規模 — editable */}
          <div style={{ textAlign: 'center', padding: '8px 12px' }}>
            <p style={{ fontSize: 11, color: '#86868b', marginBottom: 6 }}>基金規模</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <input
                type="number" min="0" step="100" placeholder="--"
                value={aum ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value);
                  onMetaChange(v, expenseRatio);
                }}
                style={{ width: 72, border: '1px solid #e5e5ea', borderRadius: 8, padding: '6px 8px', fontSize: 15, fontWeight: 700, textAlign: 'right', color: '#1d1d1f', outline: 'none', background: '#fafafa' }}
              />
              <span style={{ fontSize: 13, color: '#6e6e73' }}>億</span>
            </div>
            <p style={{ fontSize: 11, marginTop: 6, color: aum !== null ? (aum >= 100 ? '#10b981' : '#ff9500') : '#aeaeb2' }}>
              {aum !== null ? (aum >= 100 ? '規模充足' : '規模偏小') : '請填寫'}
              {isAUMAutoDetected && <span style={{ color: '#aeaeb2', marginLeft: 3 }}>(自動)</span>}
            </p>
          </div>

          {/* 費用率 — editable */}
          <div style={{ textAlign: 'center', padding: '8px 12px', borderLeft: '1px solid #f2f2f7' }}>
            <p style={{ fontSize: 11, color: '#86868b', marginBottom: 6 }}>費用率</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <input
                type="number" min="0" step="0.01" placeholder="--"
                value={expenseRatio ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value);
                  onMetaChange(aum, v);
                }}
                style={{ width: 60, border: '1px solid #e5e5ea', borderRadius: 8, padding: '6px 8px', fontSize: 15, fontWeight: 700, textAlign: 'right', color: '#1d1d1f', outline: 'none', background: '#fafafa' }}
              />
              <span style={{ fontSize: 13, color: '#6e6e73' }}>%</span>
            </div>
            <p style={{ fontSize: 11, marginTop: 6, color: expenseRatio !== null ? (expenseRatio <= 0.5 ? '#10b981' : '#ff9500') : '#aeaeb2' }}>
              {expenseRatio !== null ? (expenseRatio <= 0.5 ? '費用合理' : '費用偏高') : '請填寫'}
              {isExpenseEstimated && <span style={{ color: '#aeaeb2', marginLeft: 3 }}>(估算)</span>}
            </p>
          </div>

          {/* 目標買進價 — static */}
          <div style={{ textAlign: 'center', padding: '8px 12px', borderLeft: '1px solid #f2f2f7' }}>
            <p style={{ fontSize: 11, color: '#86868b', marginBottom: 6 }}>目標買進價</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.01em', lineHeight: '38px' }}>
              {buyPrice !== null ? `$${buyPrice}` : '--'}
            </p>
            <p style={{ fontSize: 11, color: '#aeaeb2', marginTop: 6 }}>殖利率 {YIELD}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
