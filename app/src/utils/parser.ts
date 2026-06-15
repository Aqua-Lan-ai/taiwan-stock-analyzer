import type { Financials, Indicators, ETFFinancials, ETFIndicators, StockSubType, YearData } from '../types';

// Extract table data from goodinfo HTML
function extractTableRows(html: string, tableId: string): string[][] {
  const tablePattern = new RegExp(`id="${tableId}"[^>]*>([\\s\\S]*?)</table>`, 'i');
  const match = html.match(tablePattern);
  if (!match) return [];

  const rows: string[][] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowPattern.exec(match[1])) !== null) {
    const cells: string[] = [];
    const cellPattern = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const text = cellMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(text);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function parseNum(s: string): number | null {
  if (!s || s === 'N/A' || s === '--' || s === '') return null;
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// Parse years from header row
function parseYears(headerCells: string[]): number[] {
  return headerCells
    .map((c) => parseInt(c))
    .filter((y) => !isNaN(y) && y > 1990 && y < 2100);
}

function toYearData(years: number[], values: (number | null)[]): YearData[] {
  return years.map((year, i) => ({ year, value: values[i] ?? null }));
}

export function parseStockName(html: string): string {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (!titleMatch) return '';
  // Format: "XXXX 股名 - ..."
  const parts = titleMatch[1].split(/\s+/);
  return parts.slice(1, 2).join('') || titleMatch[1];
}

export function parseStockPrice(html: string): number | null {
  // StockDetail.asp: find first numeric td after the 成交價 header
  const m = html.match(/成交價[\s\S]{0,1500}?<td[^>]*>([\d,]+(?:\.\d+)?)<\/td>/);
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

export function parseDividendData(html: string): {
  cashDividend: YearData[];
  payoutRatio: YearData[];
  dividendDays: YearData[];
} {
  // goodinfo dividend page structure
  const years: number[] = [];
  const cashDividends: (number | null)[] = [];
  const payoutRatios: (number | null)[] = [];
  const dividendDays: (number | null)[] = [];

  // Extract year rows from dividend table
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowPattern.exec(html)) !== null) {
    const row = match[1];
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    const texts = cells.map((c) =>
      c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()
    );

    if (texts.length >= 4 && /^\d{4}$/.test(texts[0])) {
      const year = parseInt(texts[0]);
      years.push(year);
      cashDividends.push(parseNum(texts[1]) ?? parseNum(texts[2]));
      // payout ratio usually further in
      payoutRatios.push(parseNum(texts[texts.length - 2]));
      dividendDays.push(parseNum(texts[texts.length - 1]));
    }
  }

  return {
    cashDividend: toYearData(years, cashDividends),
    payoutRatio: toYearData(years, payoutRatios),
    dividendDays: toYearData(years, dividendDays),
  };
}

// Detect if a stock is a financial stock from goodinfo page content
export function parseSubType(html: string): StockSubType {
  const financialKeywords = ['金融保險', '銀行業', '保險業', '證券業', '金控', '票券'];
  if (financialKeywords.some((kw) => html.includes(kw))) return 'financial';
  return null;
}

export function evaluateIndicators(
  financials: Financials,
  years: number,
  subType: StockSubType = null,
): Indicators {
  const isFinancial = subType === 'financial';

  const recent = (data: YearData[]) =>
    data.filter((d) => d.value !== null).sort((a, b) => b.year - a.year).slice(0, years);

  // 1. 景氣循環 — 連續獲利
  const profits = recent(financials.netProfit);
  const 景氣循環 = profits.length >= years && profits.every((d) => (d.value ?? 0) > 0);

  // 2. 現金股利 — 連續配息
  const dividends = recent(financials.cashDividend);
  const 現金股利 = dividends.length >= years && dividends.every((d) => (d.value ?? 0) > 0);

  // 3. ROE — 金融股門檻 8%，一般股 10%
  const roes = recent(financials.roe);
  const roeThreshold = isFinancial ? 8 : 10;
  const ROE = roes.length > 0 && roes.every((d) => (d.value ?? 0) >= roeThreshold);

  // 4. 金融股用 ROA ≥ 0.5%；一般股用自由現金流量為正
  let 自由現金流量: boolean;
  if (isFinancial) {
    const roas = recent(financials.roa);
    自由現金流量 = roas.length > 0 && roas.every((d) => (d.value ?? 0) >= 0.5);
  } else {
    const fcfs = recent(financials.freeCashFlow);
    自由現金流量 = fcfs.length > 0 && fcfs.every((d) => (d.value ?? 0) > 0);
  }

  // 5. 現金配發率 — 金融股門檻 60%，一般股 70%
  const latestPayout = financials.payoutRatio
    .filter((d) => d.value !== null)
    .sort((a, b) => b.year - a.year)[0];
  const payoutThreshold = isFinancial ? 60 : 70;
  const 現金配發率 = (latestPayout?.value ?? 0) >= payoutThreshold;

  return { 景氣循環, 現金股利, ROE, 自由現金流量, 現金配發率 };
}

export function calcScore(indicators: Indicators): number {
  return Object.values(indicators).filter(Boolean).length;
}

// Calculate buy/sell price based on recent avg cash dividend and yield
export function calcValuation(
  cashDividends: YearData[],
  eps: YearData[],
  buyYield: number,
  sellYield: number
): {
  buyPrice: number | null;
  sellPrice: number | null;
  cheapPrice: number | null;
  fairPrice: number | null;
  expensivePrice: number | null;
} {
  const recentDiv = cashDividends
    .filter((d) => d.value !== null)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);

  const recentEps = eps
    .filter((d) => d.value !== null && (d.value ?? 0) > 0)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);

  const avgDiv = recentDiv.length > 0
    ? recentDiv.reduce((s, d) => s + (d.value ?? 0), 0) / recentDiv.length
    : null;

  const avgEps = recentEps.length > 0
    ? recentEps.reduce((s, d) => s + (d.value ?? 0), 0) / recentEps.length
    : null;

  const buyPrice = avgDiv && buyYield > 0 ? Math.round((avgDiv / buyYield) * 100) : null;
  const sellPrice = avgDiv && sellYield > 0 ? Math.round((avgDiv / sellYield) * 100) : null;

  // 三價法（本益比法）：近三年平均 EPS × 固定本益比
  const cheapPrice = avgEps ? Math.round(avgEps * 15) : null;
  const fairPrice = avgEps ? Math.round(avgEps * 20) : null;
  const expensivePrice = avgEps ? Math.round(avgEps * 30) : null;

  return { buyPrice, sellPrice, cheapPrice, fairPrice, expensivePrice };
}

// Parse ETF NAV and premium from goodinfo StockDetail.asp
// Structure: <th colspan='3'>淨值&nbsp;(折溢價%)</th>
//            <td colspan='3'>32.83&nbsp;<font color='...'>(±X.XX%)</font></td>
export function parseETFBasic(html: string): Pick<ETFFinancials, 'nav' | 'premium' | 'expenseRatio' | 'aum'> {
  let nav: number | null = null;
  let premium: number | null = null;

  // The NAV cell: <td colspan='3'>32.83&nbsp;<font ...>(±X.XX%)</font></td>
  const navCell = html.match(/淨值[\s\S]{0,400}?<td[^>]*colspan[^>]*>(\d[\d.]*)\s*&nbsp;\s*<font[^>]*>\(([+-]?\d[\d.]*%)\)<\/font>/);
  if (navCell) {
    nav = parseFloat(navCell[1]);
    premium = parseFloat(navCell[2].replace('%', ''));
  }

  // expenseRatio and aum are not available on StockDetail.asp — return null
  return { nav, premium, expenseRatio: null, aum: null };
}

export function evaluateETFIndicators(
  etfFinancials: ETFFinancials,
  buyYield: number,
  currentPrice: number | null,
): ETFIndicators {
  // 1. 連續配息 — 近三年每年都有配息
  const recentDivs = [...etfFinancials.cashDividend]
    .filter((d) => d.value !== null)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3);
  const 連續配息 = recentDivs.length >= 3 && recentDivs.every((d) => (d.value ?? 0) > 0);

  // 2. 殖利率達標 — 近一年配息 / 現價 >= 目標殖利率
  const latestDiv = recentDivs[0]?.value ?? null;
  const currentYield = latestDiv && currentPrice ? (latestDiv / currentPrice) * 100 : null;
  const 殖利率達標 = currentYield !== null && currentYield >= buyYield;

  // 3. 規模充足 — AUM >= 100億
  const 規模充足 = etfFinancials.aum !== null ? etfFinancials.aum >= 100 : false;

  // 4. 費用率合理 — 費用率 <= 0.5%
  const 費用率合理 = etfFinancials.expenseRatio !== null ? etfFinancials.expenseRatio <= 0.5 : false;

  // 5. 溢價合理 — 折溢價絕對值 <= 1%
  const 溢價合理 = etfFinancials.premium !== null ? Math.abs(etfFinancials.premium) <= 1 : false;

  return { 連續配息, 殖利率達標, 規模充足, 費用率合理, 溢價合理 };
}

export function calcETFScore(indicators: ETFIndicators): number {
  return Object.values(indicators).filter(Boolean).length;
}
