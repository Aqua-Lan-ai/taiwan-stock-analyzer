import { useState, useCallback } from 'react';
import type { Financials, ETFFinancials, YearData, DividendPayment } from '../types';
import {
  parseStockName, parseStockPrice, parseSubType,
  evaluateIndicators, calcScore,
  parseETFBasic, evaluateETFIndicators, calcETFScore,
  parseExDividendDate, parseLatestBPS,
} from '../utils/parser';
import { useStore } from '../store/useStore';

const API = '/api';

async function fetchProxy(stockId: string, type: string, force = false): Promise<string> {
  const url = `${API}/proxy?stockId=${stockId}&type=${type}${force ? '&force=1' : ''}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.html ?? '';
}

async function fetchTWSEYear(year: number, force = false): Promise<string> {
  const url = `${API}/proxy?type=twse_ex&year=${year}${force ? '&force=1' : ''}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.html ?? '';
}

// Parse StockDividendSchedule.asp rows → { months, days } keyed by payout year
// Row format: col[0]=payout year, col[2]=ex-date "'YY/MM/DD", col[6]=填息天數
function parseScheduleData(html: string): { months: Map<number, number>; days: Map<number, number> } {
  const months = new Map<number, number>();
  const days = new Map<number, number>();
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(html)) !== null) {
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      cells.push(cm[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    }
    if (cells.length < 3) continue;
    const year = parseInt(cells[0]);
    if (isNaN(year) || year < 2000 || year > 2100) continue;
    // ex-date: "'25/06/19" — strip leading apostrophe
    const parts = cells[2].replace(/^'/, '').split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[1]);
      if (!isNaN(month) && month >= 1 && month <= 12 && !months.has(year)) {
        months.set(year, month);
      }
    }
    // col 6 = 填息天數 (may be empty for recent/unfilled years)
    const d = parseNum(cells[6] ?? '');
    if (d !== null && d > 0 && !days.has(year)) days.set(year, d);
  }
  return { months, days };
}

// If goodinfo StockDividendPolicy has no sub-row months, supplement from schedule page.
// Falls back to StockDetail 除息交易日 if schedule also has no data.
function supplementFromSchedule(
  payments: DividendPayment[],
  cashDividend: YearData[],
  scheduleMths: Map<number, number>,
  basicHtml: string,
): DividendPayment[] {
  if (payments.length > 0) return payments;

  if (scheduleMths.size > 0) {
    const result: DividendPayment[] = [];
    for (const d of cashDividend) {
      if (d.value === null || d.value <= 0) continue;
      const month = scheduleMths.get(d.year);
      if (month) result.push({ year: d.year, month, amount: d.value });
    }
    if (result.length > 0) return result;
  }

  // Fallback: apply current-year's month from 除息交易日 to all historical years
  const exDate = parseExDividendDate(basicHtml);
  if (!exDate) return payments;
  return cashDividend
    .filter((d) => d.value !== null && d.value > 0)
    .map((d) => ({ year: d.year, month: exDate.month, amount: d.value as number }));
}

// Merge schedule 填息天數 into dividendDays: schedule data is more reliable for
// stocks with both cash and stock dividends (policy page column index varies).
function mergeScheduleDays(
  policyDays: YearData[],
  scheduleDays: Map<number, number>,
): YearData[] {
  if (scheduleDays.size === 0) return policyDays;
  return policyDays.map((d) => {
    const sd = scheduleDays.get(d.year);
    return sd !== undefined ? { year: d.year, value: sd } : d;
  });
}

async function fetchTWSEFallback(stockId: string, cashDividend: YearData[], force: boolean): Promise<DividendPayment[]> {
  const years = cashDividend
    .filter((d) => d.value !== null && d.value > 0)
    .slice(0, 3)
    .map((d) => d.year);
  const payments: DividendPayment[] = [];
  for (const year of years) {
    try {
      const body = await fetchTWSEYear(year, force);
      payments.push(...parseTWSEExDates(body, stockId));
    } catch { /* ignore */ }
  }
  return payments;
}

function parseTWSEExDates(body: string, stockId: string): DividendPayment[] {
  try {
    const json = JSON.parse(body);
    if (json.stat !== 'OK' || !Array.isArray(json.data)) return [];
    const fields: string[] = json.fields ?? [];
    const dateIdx = fields.findIndex((f) => f.includes('除息') && f.includes('日'));
    const idIdx = fields.findIndex((f) => f.includes('代號'));
    const divIdx = fields.findIndex((f) => f.includes('現金') && f.includes('股利'));
    if (dateIdx === -1 || idIdx === -1 || divIdx === -1) return [];
    const payments: DividendPayment[] = [];
    for (const row of json.data as string[][]) {
      if (row[idIdx]?.trim() !== stockId) continue;
      const amount = parseFloat((row[divIdx] ?? '').replace(/,/g, ''));
      if (!amount || amount <= 0) continue;
      const parts = (row[dateIdx] ?? '').trim().split('/');
      if (parts.length !== 3) continue;
      const y = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = y < 200 ? y + 1911 : y;
      if (month >= 1 && month <= 12 && year > 1990 && year < 2100) {
        payments.push({ year, month, amount });
      }
    }
    return payments;
  } catch {
    return [];
  }
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

    if (/^\d{4}$/.test(r[0]) && parseInt(r[0]) > 1990 && parseInt(r[0]) < 2100) {
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
      // Require the ∟ prefix so rows from other tables aren't misread
      if (!r[0].includes('∟')) continue;
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
  const { updateStock } = useStore();

  const fetchStockData = useCallback(async (stockId: string, force = false) => {
    setLoading(true);
    setError(null);

    // Determine type from ID pattern
    const isETF = /^0\d{3,5}$/.test(stockId);

    try {
      if (isETF) {
        // ETF: fetch basic + dividend policy + schedule in parallel
        const [basicHtml, divHtml, schedHtml] = await Promise.all([
          fetchProxy(stockId, 'basic', force),
          fetchProxy(stockId, 'dividend', force),
          fetchProxy(stockId, 'schedule', force),
        ]);

        const name = parseStockName(basicHtml);
        const price = parseStockPrice(basicHtml);
        const { cashDividend, dividendDays: policyDays, dividendPayments: rawPayments } = parseDividendRows(divHtml);
        const { months: scheduleMths, days: schedDays } = parseScheduleData(schedHtml);
        const afterSched = supplementFromSchedule(rawPayments, cashDividend, scheduleMths, basicHtml);
        const dividendPayments = afterSched.length > 0 ? afterSched : await fetchTWSEFallback(stockId, cashDividend, force);
        const dividendDays = mergeScheduleDays(policyDays, schedDays);
        const etfBasic = parseETFBasic(basicHtml);

        const etfFinancials: ETFFinancials = {
          cashDividend,
          dividendDays,
          dividendPayments,
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
        // Individual stock: fetch all endpoints in parallel
        const [basicHtml, perfHtml, cfHtml, divHtml, schedHtml] = await Promise.all([
          fetchProxy(stockId, 'basic', force),
          fetchProxy(stockId, 'performance', force),
          fetchProxy(stockId, 'cashflow', force),
          fetchProxy(stockId, 'dividend', force),
          fetchProxy(stockId, 'schedule', force),
        ]);

        const name = parseStockName(basicHtml);
        const price = parseStockPrice(basicHtml);
        const subType = parseSubType(basicHtml);
        const latestBpsValue = parseLatestBPS(basicHtml);
        const perf = parsePerformanceRows(perfHtml);
        const { cfo, capex } = parseCashFlowRows(cfHtml);
        const { cashDividend, dividendDays: policyDays, dividendPayments: rawPayments } = parseDividendRows(divHtml);
        const { months: scheduleMths, days: schedDays } = parseScheduleData(schedHtml);
        const afterSched = supplementFromSchedule(rawPayments, cashDividend, scheduleMths, basicHtml);
        const dividendPayments = afterSched.length > 0 ? afterSched : await fetchTWSEFallback(stockId, cashDividend, force);
        const dividendDays = mergeScheduleDays(policyDays, schedDays);

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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [updateStock]);

  return { fetchStockData, loading, error };
}
