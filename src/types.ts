export type Series = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    type?: "line" | "bar";
  }[];
};
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
    productDaily?: Series;
    megawariDaily?: Series;
    megapoDaily?: Series;
    megawariTotals?: Series;
    megapoTotals?: Series;
    megawariSummary?: Record<string, string | number>[];
    megapoSummary?: Record<string, string | number>[];
  };
  marketing?: Record<string, unknown>;
  competitor?: Record<string, unknown>;
  planning?: Record<string, unknown>;
};
