import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Stock, GlobalSettings, AssetType } from '../types';
import { evaluateETFIndicators, calcETFScore } from '../utils/parser';

interface StoreState {
  stocks: Stock[];
  settings: GlobalSettings;
  addStock: (id: string) => void;
  removeStock: (id: string) => void;
  updateStock: (id: string, data: Partial<Stock>) => void;
  updateSettings: (settings: Partial<GlobalSettings>) => void;
  toggleSelected: (id: string) => void;
  updateShares: (id: string, shares: number) => void;
  updateETFMeta: (id: string, aum: number | null, expenseRatio: number | null) => void;
}

const defaultSettings: GlobalSettings = {
  buyYield: 6.0,
  sellYield: 3.0,
  years: 10,
};

function detectType(id: string): AssetType {
  return /^0\d{3,5}$/.test(id) ? 'etf' : 'stock';
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      stocks: [],
      settings: defaultSettings,

      addStock: (id) =>
        set((state) => {
          if (state.stocks.find((s) => s.id === id)) return state;
          const type = detectType(id);
          const newStock: Stock = {
            id,
            type,
            name: '',
            price: null,
            shares: 0,
            selected: true,
            etfAUM: null,
            etfExpenseRatio: null,
            score: 0,
            indicators: { 景氣循環: false, 現金股利: false, ROE: false, 自由現金流量: false, 現金配發率: false },
            financials: null,
            etfFinancials: null,
          };
          return { stocks: [...state.stocks, newStock] };
        }),

      removeStock: (id) =>
        set((state) => ({ stocks: state.stocks.filter((s) => s.id !== id) })),

      updateStock: (id, data) =>
        set((state) => ({
          stocks: state.stocks.map((s) => (s.id === id ? { ...s, ...data } : s)),
        })),

      toggleSelected: (id) =>
        set((state) => ({
          stocks: state.stocks.map((s) => s.id === id ? { ...s, selected: !s.selected } : s),
        })),

      updateShares: (id, shares) =>
        set((state) => ({
          stocks: state.stocks.map((s) => s.id === id ? { ...s, shares } : s),
        })),

      updateETFMeta: (id, aum, expenseRatio) =>
        set((state) => {
          return {
            stocks: state.stocks.map((s) => {
              if (s.id !== id) return s;
              let score = s.score;
              if (s.etfFinancials) {
                const merged = { ...s.etfFinancials, aum, expenseRatio };
                score = calcETFScore(evaluateETFIndicators(merged, state.settings.buyYield, s.price));
              }
              return { ...s, etfAUM: aum, etfExpenseRatio: expenseRatio, score };
            }),
          };
        }),

      updateSettings: (settings) =>
        set((state) => ({ settings: { ...state.settings, ...settings } })),
    }),
    { name: 'stock-storage' }
  )
);
