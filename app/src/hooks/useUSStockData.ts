import { useState, useCallback } from 'react';
import type { DividendPayment, YearData } from '../types';
import { useUSStore } from '../store/useUSStore';

const API = '/api';

async function fetchYahoo(ticker: string, force = false): Promise<{ chart: unknown; summary: unknown } | null> {
  const url = `${API}/proxy?ticker=${ticker}&type=us_stock${force ? '&force=1' : ''}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  try {
    return JSON.parse(json.html ?? 'null');
  } catch {
    return null;
  }
}

function parseUSStockData(data: { chart: unknown; summary: unknown } | null): {
  name: string;
  price: number | null;
  pe: number | null;
  currency: string;
  dividendPayments: DividendPayment[];
  cashDividend: YearData[];
} {
  const empty = { name: '', price: null, pe: null, currency: 'USD', dividendPayments: [], cashDividend: [] };
  if (!data) return empty;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chart = data.chart as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = data.summary as any;

  const meta = chart?.meta ?? {};
  const name: string = meta.shortName ?? meta.longName ?? '';
  const price: number | null = meta.regularMarketPrice ?? null;
  const currency: string = meta.currency ?? 'USD';

  // PE from summaryDetail
  const pe: number | null =
    summary?.summaryDetail?.trailingPE?.raw ??
    summary?.defaultKeyStatistics?.forwardPE?.raw ??
    null;

  // Dividend history from chart events
  const rawDivs = chart?.events?.dividends ?? {};
  const payments: DividendPayment[] = [];

  for (const entry of Object.values(rawDivs)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = entry as any;
    if (!d?.date || !d?.amount) continue;
    const date = new Date(d.date * 1000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    payments.push({ year, month, amount: d.amount });
  }

  // Sort by date descending
  payments.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

  // Build annual totals from payments
  const byYear = new Map<number, number>();
  for (const p of payments) {
    byYear.set(p.year, (byYear.get(p.year) ?? 0) + p.amount);
  }
  const cashDividend: YearData[] = Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, value]) => ({ year, value: Math.round(value * 1000) / 1000 }));

  return { name, price, pe, currency, dividendPayments: payments, cashDividend };
}

export function useUSStockData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateStock } = useUSStore();

  const fetchStockData = useCallback(async (ticker: string, force = false) => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchYahoo(ticker, force);
      const { name, price, pe, currency, dividendPayments, cashDividend } = parseUSStockData(raw);
      updateStock(ticker, {
        name,
        price,
        pe,
        currency,
        dividendPayments,
        cashDividend,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [updateStock]);

  return { fetchStockData, loading, error };
}
