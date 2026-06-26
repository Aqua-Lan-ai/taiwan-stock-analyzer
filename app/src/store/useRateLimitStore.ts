import { create } from 'zustand';
import { useState, useEffect } from 'react';

const COOLDOWN_MS = 20 * 60 * 1000;

interface RateLimitState {
  rateLimitUntil: number | null;
  setRateLimit: () => void;
  clearRateLimit: () => void;
}

export const useRateLimitStore = create<RateLimitState>((set) => ({
  rateLimitUntil: null,
  setRateLimit: () => set({ rateLimitUntil: Date.now() + COOLDOWN_MS }),
  clearRateLimit: () => set({ rateLimitUntil: null }),
}));

// Hook: returns formatted countdown string (e.g. "19:42") or null if not rate limited
export function useRateLimitCountdown(): string | null {
  const { rateLimitUntil, clearRateLimit } = useRateLimitStore();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!rateLimitUntil) return;
    const id = setInterval(() => {
      if (Date.now() >= rateLimitUntil) clearRateLimit();
      else tick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [rateLimitUntil, clearRateLimit]);

  if (!rateLimitUntil || Date.now() >= rateLimitUntil) return null;
  const secs = Math.ceil((rateLimitUntil - Date.now()) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
