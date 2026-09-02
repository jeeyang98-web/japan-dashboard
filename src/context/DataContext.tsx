import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { DashboardData } from "../types";
import {
  clearApiCache,
  fetchDashboardBundle,
  type DashboardApiBundle,
} from "../lib/api";
type State = {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  month: number;
  setMonth: (month: number) => void;
  refresh: () => void;
};
const C = createContext<State | null>(null);
const pick = (o: any, ...keys: string[]) =>
  keys.map((k) => o?.[k]).find((v) => v !== undefined);
const rows = (value: any) => (Array.isArray(value) ? value : []);
function normalize(bundle: DashboardApiBundle): DashboardData {
  const p = bundle.platform || {},
    t = bundle.total || {},
    kp = bundle.krProduct || {},
    ks = bundle.krProductSales || {},
    kf = bundle.krFunnel || {},
    promo = bundle.promotion || {};
  return {
    updatedAt:
      pick(t, "updatedAt", "lastUpdated") ||
      pick(p, "updatedAt", "lastUpdated"),
    exchangeRates: pick(t, "exchangeRates", "fx", "fxByMonth") || {},
    total: {
      monthlyKr: rows(pick(t, "monthlyKr", "krMonthlySales", "krSalesByMonth")),
      monthlyJpJpy: rows(
        pick(t, "monthlyJpJpy", "jpMonthlySalesJpy", "jpSalesJpyByMonth"),
      ),
      monthlyJpKrw: rows(
        pick(t, "monthlyJpKrw", "jpMonthlySalesKrw", "jpSalesConvertedKrw"),
      ),
      targets: rows(pick(t, "targets", "monthlyTargets", "totalTargets")),
      ordersKr: rows(pick(t, "ordersKr", "krMonthlyOrders")),
      ordersJp: rows(pick(t, "ordersJp", "jpMonthlyOrders")),
      channels: pick(t, "channels", "channelSales"),
      products: pick(t, "products", "productQuantities"),
    },
    jp: {
      monthlySales: rows(
        pick(p, "monthlySales", "monthlySalesJpy", "salesByMonth"),
      ),
      targets: rows(pick(p, "targets", "monthlyTargets", "targetByMonth")),
      dailyByMonth: pick(p, "dailyByMonth", "dailySales"),
      orders: rows(pick(p, "orders", "monthlyOrders", "orderCountByMonth")),
      products: pick(p, "jpProducts", "productData", "products"),
      funnel: pick(p, "funnel", "funnelByMonth", "kpiFunnel"),
      dailyFunnel: rows(bundle.jpFunnel),
      dailyProductQty: pick(p, "jpDailyProductQty") || {},
    },
    kr: {
      monthlySales: rows(
        pick(t, "krMonthlySales", "monthlyKr", "krSalesByMonth"),
      ),
      targets: rows(pick(t, "krTargets", "krMonthlyTargets")),
      units: rows(pick(t, "krUnits")),
      dailyByMonth: pick(kf, "dailySales", "dailyByMonth"),
      orders: rows(pick(kf, "orders", "monthlyOrders")),
      products: pick(ks, "products", "productSalesByMonth"),
      funnel: pick(kf, "funnel", "funnelByMonth", "dailyKpi"),
      dailyProductQty: pick(ks, "krDailyProductQty") || {},
    },
    product: {
      TOTAL:
        pick(p, "productTotal", "totalProduct") ||
        pick(t, "productTotal") ||
        {},
      KR: pick(kp, "product", "krProduct") || kp,
      JP: pick(p, "product", "jpProduct") || {},
    },
    promotion: {
      megawariCampaigns: rows(pick(promo, "megawari", "megawariCampaigns")),
      megapoCampaigns: rows(pick(promo, "megapo", "megapoCampaigns")),
      megawariPeriod: pick(promo, "megawariPeriod") || "",
      megapoPeriod: pick(promo, "megapoPeriod") || "",
      megawariProductDaily: pick(promo, "megawariProductDaily") || {},
      megapoProductDaily: pick(promo, "megapoProductDaily") || {},
    },
    marketing: pick(p, "marketing") || {},
    competitor: pick(p, "competitor") || {},
    planning: pick(p, "planning") || {},
  };
}
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const requestId = useRef(0);
  const get = (force = false) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    if (force) clearApiCache();
    fetchDashboardBundle(month, force)
      .then((x) => {
        if (id === requestId.current) setData(normalize(x));
      })
      .catch((e) => {
        if (id === requestId.current) setError(e.message);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  };
  useEffect(() => get(), [month]);
  return (
    <C.Provider
      value={{
        data,
        loading,
        error,
        month,
        setMonth,
        refresh: () => get(true),
      }}
    >
      {children}
    </C.Provider>
  );
}
export const useDashboard = () => {
  const x = useContext(C);
  if (!x) throw Error("Missing DataProvider");
  return x;
};
