export type Series = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    type?: "line" | "bar";
    yAxisID?: "y" | "y1";
  }[];
};
export type DailyFunnelRow = { date: string; traffic: number; cart: number; orders: number; conversionRate: number };
export type ProductRow = { name: string; quantity: number };
export type DashboardData = {
  updatedAt?: string;
  exchangeRates?: Record<string, number>;
  total?: {
    monthlyKr: number[];
    monthlyJpJpy: number[];
    monthlyJpKrw?: number[];
    targets: number[];
    ordersKr: number[];
    ordersJp: number[];
    channels?: Record<string, number[]>;
    products?: Record<string, ProductRow[]>;
  };
  kr?: {
    monthlySales: number[];
    targets: number[];
    units?: number[];
    dailyByMonth?: Record<string, Series>;
    orders?: number[];
    products?: Record<string, ProductRow[]>;
    funnel?: Record<string, number>[];
  };
  jp?: {
    monthlySales: number[];
    targets: number[];
    dailyByMonth?: Record<string, Series>;
    orders?: number[];
    products?: Record<string, ProductRow[]>;
    funnel?: Record<string, number>[];
    dailyFunnel?: DailyFunnelRow[];
  };
  product?: Record<
    "TOTAL" | "KR" | "JP",
    {
      trends?: Series;
      monthly?: Record<string, ProductRow[]>;
      cumulative?: ProductRow[];
    }
  >;
  promotion?: {
    megawariCampaigns?: { period: string; group: string; sales: number[] }[];
    megapoCampaigns?: { period: string; group: string; sales: number[] }[];
  };
  marketing?: Record<string, unknown>;
  competitor?: Record<string, unknown>;
  planning?: Record<string, unknown>;
};
