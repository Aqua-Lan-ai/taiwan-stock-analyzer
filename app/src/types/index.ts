export type AssetType = 'stock' | 'etf';
export type StockSubType = 'financial' | null;

export interface DividendPayment {
  year: number;   // 除息年份
  month: number;  // 除息月份 (1-12)
  amount: number; // 每股現金股利
}

export interface Stock {
  id: string;
  type: AssetType;
  subType?: StockSubType;
  name: string;
  price: number | null;
  shares: number;
  selected: boolean;
  etfAUM: number | null;           // 手動輸入基金規模 (億)
  etfExpenseRatio: number | null;  // 手動輸入費用率 (%)
  score: number;
  indicators: Indicators;
  financials: Financials | null;
  etfFinancials: ETFFinancials | null;
  lastUpdated?: string;
}

export interface Indicators {
  景氣循環: boolean;
  現金股利: boolean;
  ROE: boolean;
  自由現金流量: boolean;
  現金配發率: boolean;
}

export interface ETFIndicators {
  連續配息: boolean;
  殖利率達標: boolean;
  規模充足: boolean;
  費用率合理: boolean;
  溢價合理: boolean;
}

export interface YearData {
  year: number;
  value: number | null;
}

export interface Financials {
  // Income statement
  netProfit: YearData[];
  eps: YearData[];
  revenue: YearData[];
  operatingProfit: YearData[];

  // Profitability
  roe: YearData[];
  roa: YearData[];
  grossMargin: YearData[];
  operatingMargin: YearData[];

  // Cash flow
  cfo: YearData[];
  capex: YearData[];
  freeCashFlow: YearData[];

  // Dividend
  cashDividend: YearData[];
  payoutRatio: YearData[];
  dividendDays: YearData[];
  dividendPayments: DividendPayment[];  // 月份級別配息紀錄
}

export interface ETFFinancials {
  cashDividend: YearData[];
  dividendDays: YearData[];
  dividendPayments: DividendPayment[];  // 月份級別配息紀錄
  nav: number | null;
  premium: number | null;
  expenseRatio: number | null;
  aum: number | null;
}

export interface GlobalSettings {
  buyYield: number;
  sellYield: number;
  years: number;
}

export type TableType = '獲利能力指標' | '損益表' | '現金流量表' | '股利政策表';
export type ETFTableType = '配息紀錄';
