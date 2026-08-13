import { useState, useCallback } from 'react';
import type { Financials, ETFFinancials, YearData, DividendPayment } from '../types';
import {
  parseStockName, parseStockPrice, parseSubType,
  evaluateIndicators, calcScore,
  parseETFBasic, evaluateETFIndicators, calcETFScore,
  parseLatestBPS,
} from '../utils/parser';
import { useStore } from '../store/useStore';
import { useRateLimitStore } from '../store/useRateLimitStore';

const API = '/api';

async function fetchProxy(stockId: string, type: string, force = false): Promise<string> {
  const url = `${API}/proxy?stockId=${stockId}&type=${type}${force ? '&force=1' : ''}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.html ?? '';
}

async function fetchFinMindDividend(stockId: string, force = false): Promise<string> {
  const url = `${API}/proxy?type=finmind_dividend&stockId=${stockId}${force ? '&force=1' : ''}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.html ?? '';
}

// The earliest year still comparable to the latest year's share count — a stock split (or
// reverse split) changes what "one share" means, so per-share metrics (dividend, EPS) from
// before the split can't be averaged together with post-split values. Walking backward from
// the latest year, any year whose share count differs from the latest by more than 1.5x marks
// the boundary; that year and earlier are excluded from trailing-average calculations.
function detectSplitCutoffYear(sharesByYear: Map<number, number>): number | null {
  const years = Array.from(sharesByYear.keys()).sort((a, b) => b - a);
  if (years.length === 0) return null;
  const latestShares = sharesByYear.get(years[0])!;
  let cutoff = years[0];
  for (const year of years) {
    const ratio = sharesByYear.get(year)! / latestShares;
    if (ratio < 0.67 || ratio > 1.5) break;
    cutoff = year;
  }
  return cutoff;
}

// FinMind TaiwanStockDividend: CashExDividendTradingDate (YYYY-MM-DD, may be blank if unannounced).
// Total per-share cash dividend is split across two fields — CashEarningsDistribution (paid from
// retained earnings) and CashStatutorySurplus (paid from the statutory surplus reserve) — both must
// be summed to match the company's actually announced total (verified against 8422: FinMind reports
// 0.99844387 + 0.19968877 = 1.19813264 ≈ the announced 1.198).
function parseFinMindDividend(body: string): { cashDividend: YearData[]; dividendPayments: DividendPayment[]; splitCutoffYear: number | null } {
  let rows: Array<{
    CashExDividendTradingDate?: string;
    CashEarningsDistribution?: number;
    CashStatutorySurplus?: number;
    ParticipateDistributionOfTotalShares?: number;
  }>;
  try {
    const json = JSON.parse(body);
    rows = Array.isArray(json.data) ? json.data : [];
  } catch {
    rows = [];
  }

  // FinMind's feed occasionally repeats the exact same ex-date as two separate records
  // (e.g. a re-published announcement) — dedupe by exact date first so a genuine single
  // payment doesn't get double-counted. Distinct dates falling in the same month (some
  // stocks pay more than once a month) are summed normally below.
  const byExactDate = new Map<string, number>();
  const sharesByYear = new Map<number, number>();
  for (const r of rows) {
    const amount = (r.CashEarningsDistribution ?? 0) + (r.CashStatutorySurplus ?? 0);
    const dateStr = r.CashExDividendTradingDate ?? '';
    if (dateStr && r.ParticipateDistributionOfTotalShares) {
      const year = parseInt(dateStr.split('-')[0]);
      if (!isNaN(year)) sharesByYear.set(year, r.ParticipateDistributionOfTotalShares);
    }
    if (!amount || amount <= 0 || !dateStr) continue;
    byExactDate.set(dateStr, amount);
  }
  const splitCutoffYear = detectSplitCutoffYear(sharesByYear);

  const byYearMonth = new Map<string, { year: number; month: number; amount: number }>();
  for (const [dateStr, amount] of byExactDate) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) continue;
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) continue;
    const key = `${year}-${month}`;
    const existing = byYearMonth.get(key);
    if (existing) existing.amount += amount;
    else byYearMonth.set(key, { year, month, amount });
  }

  const dividendPayments: DividendPayment[] = Array.from(byYearMonth.values());

  const byYear = new Map<number, number>();
  for (const p of dividendPayments) {
    byYear.set(p.year, (byYear.get(p.year) ?? 0) + p.amount);
  }
  const cashDividend: YearData[] = Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 30)
    .map(([year, value]) => ({ year, value }));

  return { cashDividend, dividendPayments, splitCutoffYear };
}

function parseNum(s: string): number | null {
  if (!s || s === 'N/A' || s === '--' || s === '-' || s.trim() === '') return null;
  const n = parseFloat(s.replace(/,/g, '').replace(/%/, ''));
  return isNaN(n) ? null : n;
}

function extractRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rMatch;
  while ((rMatch = rowRe.exec(html)) !== null) {
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let cMatch;
    while ((cMatch = cellRe.exec(rMatch[1])) !== null) {
      cells.push(cMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    }
    if (cells.length > 1) rows.push(cells);
  }
  return rows;
}

function findRowByLabel(rows: string[][], label: string): string[] | null {
  return rows.find((r) => r[0]?.includes(label)) ?? null;
}

function parsePerformanceRows(html: string): {
  netProfit: YearData[]; eps: YearData[]; revenue: YearData[];
  operatingProfit: YearData[]; roe: YearData[]; roa: YearData[];
  grossMargin: YearData[]; operatingMargin: YearData[];
} {
  const rows = extractRows(html);
  const annualRows = rows.filter((r) => /^\d{4}$/.test(r[0]) && r.length >= 19 && parseInt(r[0]) > 1990 && parseInt(r[0]) < 2100);
  const byYear = <T extends (r: string[]) => number | null>(fn: T): YearData[] =>
    annualRows.map((r) => ({ year: parseInt(r[0]), value: fn(r) }));
  return {
    revenue:         byYear((r) => parseNum(r[7])),
    operatingProfit: byYear((r) => parseNum(r[9])),
    netProfit:       byYear((r) => parseNum(r[11])),
    grossMargin:     byYear((r) => parseNum(r[12])),
    operatingMargin: byYear((r) => parseNum(r[13])),
    roe:             byYear((r) => parseNum(r[16])),
    roa:             byYear((r) => parseNum(r[17])),
    eps:             byYear((r) => parseNum(r[18])),
  };
}

function parseCashFlowRows(html: string): { cfo: YearData[]; capex: YearData[] } {
  const rows = extractRows(html);
  const headerRow = rows.find((r) => r[0]?.includes('營業活動') && r[0]?.includes('億元'));
  const years = headerRow?.slice(1).map((c) => parseInt(c)).filter((y) => !isNaN(y) && y > 1990) ?? [];
  const cfoRow = findRowByLabel(rows, '營業活動之淨現金流入');
  const capexRow = findRowByLabel(rows, '固定資產(增加)');
  const toYD = (row: string[] | null): YearData[] =>
    years.map((year, i) => ({ year, value: parseNum(row?.[i + 1] ?? '') }));
  return { cfo: toYD(cfoRow), capex: toYD(capexRow) };
}

// 填息天數 (fill-rights days) per year, from goodinfo's dividend policy table.
// cashDividend/dividendPayments now come from FinMind (parseFinMindDividend) instead.
function parseDividendRows(html: string): { dividendDays: YearData[] } {
  const rows = extractRows(html);
  const byYear = new Map<number, number | null>();

  for (const r of rows) {
    if (r.length < 5) continue;
    if (/^\d{4}$/.test(r[0]) && parseInt(r[0]) > 1990 && parseInt(r[0]) < 2100) {
      const year = parseInt(r[0]);
      const days = parseNum(r[9]);
      if (!byYear.has(year)) byYear.set(year, days);
      else if (days !== null && byYear.get(year) === null) byYear.set(year, days);
    }
  }

  const sorted = Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]).slice(0, 30);
  return { dividendDays: sorted.map(([year, days]) => ({ year, value: days })) };
}



export function useLivePrices() {
  const { updateStock } = useStore();

  return useCallback(async () => {
    const { stocks } = useStore.getState();
    await Promise.all(
      stocks.map(async (s) => {
        try {
          const res = await fetch(`/api/proxy?stockId=${s.id}&type=twse_price&force=1`);
          const json = await res.json();
          if (json.error || !json.html) return;
          const info = JSON.parse(json.html);
          const raw = info?.z ?? info?.y;
          if (!raw || raw === '-') return;
          const price = parseFloat(raw.replace(/,/g, ''));
          if (!isNaN(price) && price > 0) updateStock(s.id, { price });
        } catch { /* ignore per-stock errors */ }
      })
    );
  }, [updateStock]);
}

export function useStockData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateStock } = useStore();
  const { setRateLimit } = useRateLimitStore();

  const fetchStockData = useCallback(async (stockId: string, force = false) => {
    const { rateLimitUntil } = useRateLimitStore.getState();
    if (rateLimitUntil && Date.now() < rateLimitUntil) return;

    setLoading(true);
    setError(null);

    // Determine type from ID pattern
    const isETF = /^0\d{3,5}$/.test(stockId);

    try {
      if (isETF) {
        // ETF: fetch basic + dividend policy (for dividendDays) + FinMind dividend calendar in parallel
        const [basicHtml, divHtml, finMindBody] = await Promise.all([
          fetchProxy(stockId, 'basic', force),
          fetchProxy(stockId, 'dividend', force),
          fetchFinMindDividend(stockId, force),
        ]);

        const name = parseStockName(basicHtml);
        const price = parseStockPrice(basicHtml);
        const { dividendDays } = parseDividendRows(divHtml);
        const { cashDividend, dividendPayments, splitCutoffYear } = parseFinMindDividend(finMindBody);
        const etfBasic = parseETFBasic(basicHtml);

        const etfFinancials: ETFFinancials = {
          cashDividend,
          dividendDays,
          dividendPayments,
          splitCutoffYear,
          ...etfBasic,
        };

        const etfIndicators = evaluateETFIndicators(etfFinancials, 4, price);
        const score = calcETFScore(etfIndicators);

        // Store ETF indicators in the indicators field (same shape, different keys)
        updateStock(stockId, {
          type: 'etf',
          name,
          price,
          etfFinancials,
          etfAUM: etfBasic.aum,
          etfExpenseRatio: etfBasic.expenseRatio,
          indicators: {
            景氣循環: etfIndicators.連續配息,
            現金股利: etfIndicators.殖利率達標,
            ROE: etfIndicators.規模充足,
            自由現金流量: etfIndicators.費用率合理,
            現金配發率: etfIndicators.溢價合理,
          },
          score,
          lastUpdated: new Date().toISOString(),
        });

      } else {
        // Individual stock: fetch basic/performance/cashflow/dividend (goodinfo) + FinMind dividend calendar in parallel
        const [basicHtml, perfHtml, cfHtml, divHtml, finMindBody] = await Promise.all([
          fetchProxy(stockId, 'basic', force),
          fetchProxy(stockId, 'performance', force),
          fetchProxy(stockId, 'cashflow', force),
          fetchProxy(stockId, 'dividend', force),
          fetchFinMindDividend(stockId, force),
        ]);

        const name = parseStockName(basicHtml);
        const price = parseStockPrice(basicHtml);
        const subType = parseSubType(basicHtml);
        const latestBpsValue = parseLatestBPS(basicHtml);
        const perf = parsePerformanceRows(perfHtml);
        const { cfo, capex } = parseCashFlowRows(cfHtml);
        const { dividendDays } = parseDividendRows(divHtml);
        const { cashDividend, dividendPayments, splitCutoffYear } = parseFinMindDividend(finMindBody);

        const freeCashFlow: YearData[] = cfo.map((d) => {
          const k = capex.find((c) => c.year === d.year)?.value;
          return { year: d.year, value: d.value != null && k != null ? d.value + k : null };
        });

        const payoutRatio: YearData[] = cashDividend.map((d) => {
          const eps = perf.eps.find((e) => e.year === d.year)?.value;
          if (d.value == null || eps == null || eps === 0) return { year: d.year, value: null };
          return { year: d.year, value: (d.value / eps) * 100 };
        });

        const financials: Financials = {
          netProfit: perf.netProfit,
          eps: perf.eps,
          revenue: perf.revenue,
          operatingProfit: perf.operatingProfit,
          roe: perf.roe,
          roa: perf.roa,
          grossMargin: perf.grossMargin,
          operatingMargin: perf.operatingMargin,
          bps: latestBpsValue != null
            ? [{ year: new Date().getFullYear(), value: latestBpsValue }]
            : [],
          cfo,
          capex,
          freeCashFlow,
          cashDividend,
          payoutRatio,
          dividendDays,
          dividendPayments,
          splitCutoffYear,
        };

        const indicators = evaluateIndicators(financials, 5, subType);
        const score = calcScore(indicators);

        updateStock(stockId, {
          type: 'stock',
          subType,
          name,
          price,
          financials,
          indicators,
          score,
          lastUpdated: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('goodinfo rate limit') || msg.includes('rate limit')) {
        setRateLimit();
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [updateStock, setRateLimit]);

  return { fetchStockData, loading, error };
}
