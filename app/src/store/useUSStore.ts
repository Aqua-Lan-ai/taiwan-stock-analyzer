import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { USStock } from '../types';

interface USStoreState {
  stocks: USStock[];
  addStock: (id: string) => void;
  removeStock: (id: string) => void;
  updateStock: (id: string, data: Partial<USStock>) => void;
  toggleSelected: (id: string) => void;
  selectAll: (selected: boolean) => void;
  updateShares: (id: string, shares: number) => void;
  reorderStocks: (fromId: string, toId: string) => void;
}

export const useUSStore = create<USStoreState>()(
  persist(
    (set) => ({
      stocks: [],

      addStock: (id) =>
        set((state) => {
          const ticker = id.toUpperCase();
          if (state.stocks.find((s) => s.id === ticker)) return state;
          const newStock: USStock = {
            id: ticker,
            name: '',
            price: null,
            pe: null,
            currency: 'USD',
            country: null,
            withholdingRate: 30,
            shares: 0,
            selected: true,
            dividendPayments: [],
            cashDividend: [],
            lastUpdated: null,
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

      selectAll: (selected) =>
        set((state) => ({
          stocks: state.stocks.map((s) => ({ ...s, selected })),
        })),

      updateShares: (id, shares) =>
        set((state) => ({
          stocks: state.stocks.map((s) => s.id === id ? { ...s, shares } : s),
        })),

      reorderStocks: (fromId, toId) =>
        set((state) => {
          const stocks = [...state.stocks];
          const fromIdx = stocks.findIndex((s) => s.id === fromId);
          const toIdx = stocks.findIndex((s) => s.id === toId);
          if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;
          const [item] = stocks.splice(fromIdx, 1);
          stocks.splice(toIdx, 0, item);
          return { stocks };
        }),
    }),
    { name: 'us-stock-storage' }
  )
);
