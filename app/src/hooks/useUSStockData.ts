import { useState, useCallback } from 'react';
import type { DividendPayment, YearData } from '../types';
import { useUSStore } from '../store/useUSStore';

function withholdingRateForCountry(country: string | null): number {
  if (!country || country === 'United States') return 30;
  if (['United Kingdom', 'Hong Kong', 'Singapore'].includes(country)) return 0;
  if (country === 'Netherlands') return 15;
  if (country === 'Switzerland') return 35;
  if (country === 'Japan') return 20;
  if (country === 'Canada') return 25;
  if (country === 'Germany') return 25;
  if (country === 'France') return 30;
  if (country === 'Australia') return 30;
  if (country === 'Ireland') return 20;
  return 30;
}

// Graham Number: √(22.5 × EPS × BVPS)
export function calcGrahamNumber(eps: number | null, bvps: number | null): number | null {
  if (!eps || !bvps || eps <= 0 || bvps <= 0) return null;
  return Math.sqrt(22.5 * eps * bvps);
}

// Gordon Growth Model DDM: D_next / (r - g)
// Uses last 5 complete years of dividends. Requires g < r.
export function calcDDM(cashDividend: YearData[], requiredReturn = 0.10): number | null {
  const currentYear = new Date().getFullYear();
  // Only use complete years (exclude current year which may be partial)
  const complete = cashDividend
    .filter((d) => d.year < currentYear && (d.value ?? 0) > 0)
    .sort((a, b) => a.year - b.year)
    .slice(-6); // up to 6 years for CAGR window
  if (complete.length < 3) return null;

  const oldest = complete[0].value!;
  const latest = complete[complete.length - 1].value!;
  const n = complete.length - 1;
  const g = Math.pow(latest / oldest, 1 / n) - 1;

  // Growth rate must be positive and below required return
  if (g <= 0 || g >= requiredReturn) return null;

  const nextDiv = latest * (1 + g);
  return nextDiv / (requiredReturn - g);
}

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
  eps: number | null;
  bvps: number | null;
  currency: string;
  country: string | null;
  withholdingRate: number;
  dividendPayments: DividendPayment[];
  cashDividend: YearData[];
} {
  const empty = { name: '', price: null, pe: null, eps: null, bvps: null, currency: 'USD', country: null, withholdingRate: 30, dividendPayments: [], cashDividend: [] };
  if (!data) return empty;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chart = data.chart as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = data.summary as any;

  const meta = chart?.meta ?? {};
  const name: string = meta.shortName ?? meta.longName ?? '';
  const price: number | null = meta.regularMarketPrice ?? null;
  const currency: string = meta.currency ?? 'USD';

  const ks = summary?.defaultKeyStatistics ?? {};
  const sd = summary?.summaryDetail ?? {};

  const peRaw = sd.trailingPE?.raw ?? sd.forwardPE?.raw ?? null;
  const pe: number | null = peRaw != null ? Math.round(peRaw * 10) / 10 : null;

  const epsRaw = ks.trailingEps?.raw ?? null;
  const eps: number | null = epsRaw != null ? Math.round(epsRaw * 100) / 100 : null;

  const bvpsRaw = ks.bookValue?.raw ?? null;
  const bvps: number | null = bvpsRaw != null ? Math.round(bvpsRaw * 100) / 100 : null;

  const country: string | null = summary?.assetProfile?.country ?? null;
  const withholdingRate = withholdingRateForCountry(country);

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

  payments.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

  const byYear = new Map<number, number>();
  for (const p of payments) {
    byYear.set(p.year, (byYear.get(p.year) ?? 0) + p.amount);
  }
  const cashDividend: YearData[] = Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, value]) => ({ year, value: Math.round(value * 1000) / 1000 }));

  return { name, price, pe, eps, bvps, currency, country, withholdingRate, dividendPayments: payments, cashDividend };
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
      const { name, price, pe, eps, bvps, currency, country, withholdingRate, dividendPayments, cashDividend } = parseUSStockData(raw);
      updateStock(ticker, {
        name, price, pe, eps, bvps, currency, country, withholdingRate,
        dividendPayments, cashDividend,
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
