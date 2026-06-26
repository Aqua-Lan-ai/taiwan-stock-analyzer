import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { evaluateETFIndicators, calcETFScore } from '../utils/parser';
import { useStockData } from '../hooks/useStockData';
import { useRateLimitCountdown } from '../store/useRateLimitStore';
import ScoreBadge from '../components/ScoreBadge';
import IndicatorRow from '../components/IndicatorRow';
import ValuationCard from '../components/ValuationCard';
import DataTable from '../components/DataTable';
import ETFValuationCard from '../components/ETFValuationCard';
import ETFDetailSection from '../components/ETFDetailSection';
import ProfitROEChart from '../components/charts/ProfitROEChart';
import FreeCashFlowChart from '../components/charts/FreeCashFlowChart';
import DividendChart from '../components/charts/DividendChart';

const STOCK_INDICATOR_DESCRIPTIONS: Record<string, string> = {
  景氣循環: '近五年連續獲利',
  現金股利: '近五年連續現金股利發放',
  ROE: '近五年 ROE 均維持 10% 以上',
  自由現金流量: '近五年自由現金流量均為正值',
  現金配發率: '最近一年現金配發率超過 70%',
};

const FINANCIAL_INDICATOR_DESCRIPTIONS: Record<string, string> = {
  景氣循環: '近五年連續獲利',
  現金股利: '近五年連續現金股利發放',
  ROE: '近五年 ROE 均維持 8% 以上（金融股標準）',
  自由現金流量: '近五年 ROA 均維持 0.5% 以上（替代 FCF）',
  現金配發率: '最近一年現金配發率超過 60%（金融股標準）',
};

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 11, fontWeight: 600, color: '#86868b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function StockDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { stocks, updateETFMeta } = useStore();
  const { fetchStockData, loading, error } = useStockData();
  const countdown = useRateLimitCountdown();

  const stock = stocks.find((s) => s.id === id);
  const isETF = stock?.type === 'etf';
  const isFinancial = stock?.subType === 'financial';

  const displayScore = (() => {
    if (!stock) return 0;
    if (isETF && stock.etfFinancials) {
      const merged = {
        ...stock.etfFinancials,
        aum: stock.etfAUM ?? stock.etfFinancials.aum,
        expenseRatio: stock.etfExpenseRatio ?? stock.etfFinancials.expenseRatio,
      };
      return calcETFScore(evaluateETFIndicators(merged, 4, stock.price));
    }
    return stock.score;
  })();

  useEffect(() => {
    if (!id) return;
    const needsLoad =
      !stock ||
      (!stock.financials && !stock.etfFinancials) ||
      (stock.etfFinancials && stock.etfFinancials.aum === null);
    if (needsLoad) fetchStockData(id);
  }, [id]);

  if (!stock) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#6e6e73', fontSize: 16 }}>找不到股票</p>
          <button onClick={() => navigate('/')} style={{ marginTop: 12, color: '#0071e3', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>返回首頁</button>
        </div>
      </div>
    );
  }

  const hasData = isETF ? !!stock.etfFinancials : !!stock.financials;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', fontFamily: SF }}>
      {/* Header */}
      <header style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/')} style={{ padding: 8, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', color: '#0071e3', display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div className="flex items-center gap-3">
              <span style={{ fontWeight: 700, fontSize: 18, color: '#1d1d1f' }}>{stock.id}</span>
              {stock.name && <span style={{ fontSize: 16, color: '#6e6e73' }}>{stock.name}</span>}
              {isETF && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#0071e3', background: '#e8f0fe', padding: '2px 8px', borderRadius: 6 }}>ETF</span>
              )}
              {isFinancial && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#9333ea', background: '#f3e8ff', padding: '2px 8px', borderRadius: 6 }}>金融股</span>
              )}
              <ScoreBadge score={displayScore} />
            </div>
            {stock.price && (
              <p style={{ fontSize: 13, color: '#86868b', marginTop: 1 }}>現價 <span style={{ color: '#1d1d1f', fontWeight: 500 }}>${stock.price}</span></p>
            )}
          </div>
          <button
            onClick={() => fetchStockData(stock.id, true)}
            disabled={loading || !!countdown}
            style={{ fontSize: 13, color: (loading || countdown) ? '#aeaeb2' : '#0071e3', background: 'none', border: 'none', cursor: (loading || countdown) ? 'not-allowed' : 'pointer', fontWeight: 500 }}
          >
            {countdown ? `等 ${countdown}` : loading ? '更新中...' : '重新載入'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Loading */}
        {loading && !hasData && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', color: '#86868b', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #e5e5ea', borderTopColor: '#0071e3', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: 14 }}>正在從 Goodinfo 載入資料...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fff5f5', border: '1px solid #ffcdd2', borderRadius: 12, padding: '14px 18px', color: '#c62828', fontSize: 13 }}>
            載入失敗：{error}
          </div>
        )}

        {/* ETF layout */}
        {isETF && stock.etfFinancials && (
          <>
            <Section title="估價 & 現況">
              <ETFValuationCard
                etfFinancials={stock.etfFinancials}
                price={stock.price}
                etfAUM={stock.etfAUM ?? null}
                etfExpenseRatio={stock.etfExpenseRatio ?? null}
                onMetaChange={(aum, exp) => updateETFMeta(stock.id, aum, exp)}
              />
            </Section>
            <Section title="五項指標 & 配息分析">
              <ETFDetailSection
                etfFinancials={stock.etfFinancials}
                years={10}
                etfAUM={stock.etfAUM ?? null}
                etfExpenseRatio={stock.etfExpenseRatio ?? null}
                price={stock.price}
              />
            </Section>
          </>
        )}

        {/* Stock layout */}
        {!isETF && (
          <>
            {stock.financials && (
              <Section title="估價區間">
                <ValuationCard cashDividend={stock.financials.cashDividend} eps={stock.financials.eps} bps={stock.financials.bps ?? []} price={stock.price} subType={stock.subType ?? null} />
              </Section>
            )}

            <Section title="五項指標評估">
              <div style={{ background: '#fff', borderRadius: 16, padding: '0 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {Object.entries(stock.indicators).map(([key, pass]) => (
                  <IndicatorRow
                    key={key}
                    label={key}
                    pass={pass}
                    description={(isFinancial ? FINANCIAL_INDICATOR_DESCRIPTIONS : STOCK_INDICATOR_DESCRIPTIONS)[key]}
                  />
                ))}
              </div>
            </Section>

            {stock.financials && (
              <>
                <Section title="圖表分析">
                  <div className="space-y-4">
                    <ProfitROEChart netProfit={stock.financials.netProfit} roe={stock.financials.roe} years={10} />
                    <FreeCashFlowChart freeCashFlow={stock.financials.freeCashFlow} years={10} />
                    <DividendChart cashDividend={stock.financials.cashDividend} payoutRatio={stock.financials.payoutRatio} eps={stock.financials.eps} years={10} />
                  </div>
                </Section>
                <Section title="財務資料">
                  <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <DataTable financials={stock.financials} years={10} />
                  </div>
                </Section>
              </>
            )}
          </>
        )}

        {stock.lastUpdated && (
          <p style={{ fontSize: 11, color: '#aeaeb2', textAlign: 'center', paddingBottom: 16 }}>
            資料更新時間：{new Date(stock.lastUpdated).toLocaleString('zh-TW')}
          </p>
        )}
      </main>
    </div>
  );
}
