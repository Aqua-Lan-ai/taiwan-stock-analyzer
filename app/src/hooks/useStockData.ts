import { useState, useCallback } from 'react';
import type { Financials, ETFFinancials, YearData, DividendPayment } from '../types';
import {
  parseStockName, parseStockPrice, parseSubType,
  evaluateIndicators, calcScore,
  parseETFBasic, evaluateETFIndicators, calcETFScore,
} from '../utils/parser';
import { useStore } from '../store/useStore';

const API = '/api';

async function fetchProxy(stockId: string, type: string): Promise<string> {
  const res = await fetch(`${API}/proxy?stockId=${stockId}&type=${type}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.html ?? '';
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
  const annualRows = rows.filter((r) => /^\d{4}$/.test(r[0]) && r.length >= 19);
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

// Extract ex-date month from a dividend row; handles both Western (2024/06/15) and ROC (113/06/15) formats
function parseDividendRows(html: string): {
  cashDividend: YearData[];
  dividendDays: YearData[];
  dividendPayments: DividendPayment[];
} {
  const rows = extractRows(html);
  const byYear = new Map<number, { div: number; days: number | null }>();
  const payments: DividendPayment[] = [];
  const seen = new Set<string>(); // deduplicate across repeated table sections
  let currentYear: number | null = null;

  for (const r of rows) {
    if (r.length < 5) continue;

    if (/^\d{4}$/.test(r[0])) {
      // Year summary row — track parent year for sub-rows below
      currentYear = parseInt(r[0]);
      const amount = parseNum(r[4]) ?? 0;
      const days = parseNum(r[9]);
      if (!byYear.has(currentYear)) byYear.set(currentYear, { div: 0, days: null });
      const entry = byYear.get(currentYear)!;
      entry.div += amount;
      if (days !== null && entry.days === null) entry.days = days;
    } else if (currentYear !== null) {
      // Sub-distribution row: r[0] = "∟MM/DD" (ex-date without year)
      // Skip rows with "未定" (TBD) — not yet announced
      if (r[0].includes('未定')) continue;
      const monthMatch = r[0].match(/(\d{1,2})\/\d{1,2}/);
      if (monthMatch) {
        const month = parseInt(monthMatch[1]);
        const amount = parseNum(r[4]);
        const key = `${currentYear}-${month}`;
        if (amount && amount > 0 && month >= 1 && month <= 12 && !seen.has(key)) {
          seen.add(key);
          payments.push({ year: currentYear, month, amount });
        }
      }
    }
  }

  const sorted = Array.from(byYear.entries()).sort((a, b) => b[0] - a[0]).slice(0, 30);
  return {
    cashDividend: sorted.map(([year, v]) => ({ year, value: v.div || null })),
    dividendDays: sorted.map(([year, v]) => ({ year, value: v.days })),
    dividendPayments: payments,
  };
}



export function useStockData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings, updateStock } = useStore();

  const fetchStockData = useCallback(async (stockId: string) => {
    setLoading(true);
    setError(null);

    // Determine type from ID pattern
    const isETF = /^0\d{3,5}$/.test(stockId);

    try {
      if (isETF) {
        // ETF: fetch basic + dividend policy
        const [basicHtml, divHtml] = await Promise.all([
          fetchProxy(stockId, 'basic'),
          fetchProxy(stockId, 'dividend'),
        ]);

        const name = parseStockName(basicHtml);
        const price = parseStockPrice(basicHtml);
        const { cashDividend, dividendDays, dividendPayments } = parseDividendRows(divHtml);
        const etfBasic = parseETFBasic(basicHtml);

        const etfFinancials: ETFFinancials = {
          cashDividend,
          dividendDays,
          dividendPayments,
          ...etfBasic,
        };

        const etfIndicators = evaluateETFIndicators(etfFinancials, settings.buyYield, price);
        const score = calcETFScore(etfIndicators);

        // Store ETF indicators in the indicators field (same shape, different keys)
        updateStock(stockId, {
          type: 'etf',
          name,
          price,
          etfFinancials,
          // Keep stock indicators as all-false; ETF indicators stored separately via etfFinancials
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
        // Individual stock: fetch all endpoints in parallel
        const [basicHtml, perfHtml, cfHtml, divHtml] = await Promise.all([
          fetchProxy(stockId, 'basic'),
          fetchProxy(stockId, 'performance'),
          fetchProxy(stockId, 'cashflow'),
          fetchProxy(stockId, 'dividend'),
        ]);

        const name = parseStockName(basicHtml);
        const price = parseStockPrice(basicHtml);
        const subType = parseSubType(basicHtml);
        const perf = parsePerformanceRows(perfHtml);
        const { cfo, capex } = parseCashFlowRows(cfHtml);
        const { cashDividend, dividendDays, dividendPayments } = parseDividendRows(divHtml);

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
          cfo,
          capex,
          freeCashFlow,
          cashDividend,
          payoutRatio,
          dividendDays,
          dividendPayments,
        };

        const indicators = evaluateIndicators(financials, Math.min(settings.years, 5), subType);
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [settings.buyYield, settings.years, updateStock]);

  return { fetchStockData, loading, error };
}
