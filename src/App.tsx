import { useMemo, useState } from "react";
import {
  BarChart3,
  Box,
  CalendarDays,
  Flame,
  Globe2,
  JapanIcon,
  LineChart,
  Map,
  Menu,
  RefreshCw,
  Search,
  Target,
  X,
} from "lucide-react";
import { ChartCard, DataTable, KPI, money } from "./components";
import { useDashboard } from "./context/DataContext";
import type { DashboardData, ProductRow, Series } from "./types";
const months = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
type Page =
  | "total"
  | "jp"
  | "kr"
  | "product"
  | "promotion"
  | "marketing"
  | "competitor"
  | "planning";
const nav: [string, Page, any][] = [
  ["Total Business", "total", Globe2],
  ["JP Executive", "jp", Map],
  ["KR Executive", "kr", BarChart3],
  ["Product", "product", Box],
  ["Promotion", "promotion", Flame],
  ["Marketing", "marketing", LineChart],
  ["Competitor", "competitor", Search],
  ["Planning", "planning", CalendarDays],
];
const series = (
  labels: string[],
  sets: { label: string; data?: number[]; color: string }[],
): Series => ({
  labels,
  datasets: sets.map((s) => ({
    label: s.label,
    data: s.data || [],
    backgroundColor: s.color,
    borderColor: s.color,
  })),
});
export default function App() {
  const [page, setPage] = useState<Page>("total"),
    [open, setOpen] = useState(false);
  const { data, loading, error, refresh, month, setMonth } = useDashboard();
  return (
    <div className="app">
      <aside className={open ? "open" : ""}>
        <button className="close" onClick={() => setOpen(false)}>
          <X />
        </button>
        <div className="brand">
          <div className="brand-logo">
            <img
              src="https://cdn-design.amorepacific.com/contents/2023/05/25131018/09_04.png"
              alt="TWO SLASH FOUR"
            />
          </div>
          <strong>Business Platform</strong>
          <span>Total Sales & Japan Growth Hub</span>
        </div>
        <p className="nav-label">OVERVIEW</p>
        <nav>
          {nav.map(([label, id, Icon], i) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => {
                setPage(id);
                setOpen(false);
              }}
            >
              {i === 3 && <span className="nav-label inline">COMMERCE</span>}
              {i === 5 && <span className="nav-label inline">INSIGHTS</span>}
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <header>
          <button className="menu" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div>
            <h1>{titles[page][0]}</h1>
            <p>{titles[page][1]}</p>
          </div>
          <div className="controls">
            <label>
              Month
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {months.map((m, i) => (
                  <option value={i + 1} key={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={refresh}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </header>
        {loading && <div className="notice">Loading dashboard data once…</div>}
        {error && (
          <div className="notice error">
            <b>Data connection required</b>
            <span>{error}</span>
            <small>
              The interface remains available; connect the Apps Script JSON
              endpoint to populate every chart.
            </small>
          </div>
        )}
        <PageView page={page} month={month} data={data} />
      </main>
    </div>
  );
}
const titles: Record<Page, [string, string]> = {
  total: ["Total Business Dashboard", "2SLASH4 total sales · Korea + Japan"],
  jp: [
    "JP Executive Dashboard",
    "Japan sales, orders, conversion & daily performance",
  ],
  kr: [
    "KR Executive Dashboard",
    "Korea sales, target achievement & cumulative performance",
  ],
  product: [
    "Product Dashboard",
    "TOTAL / KR / JP SKU performance & product mix",
  ],
  promotion: ["Promotion Dashboard", "Product daily performance"],
  marketing: ["Marketing Dashboard", "Marketing performance & acquisition"],
  competitor: ["Competitor Dashboard", "Market and competitor monitoring"],
  planning: ["Planning Dashboard", "Business plans and schedules"],
};
function PageView({
  page,
  month,
  data,
}: {
  page: Page;
  month: number;
  data: DashboardData | null;
}) {
  if (page === "total") return <Total d={data} m={month} />;
  if (page === "jp" || page === "kr")
    return (
      <Executive
        market={page.toUpperCase() as "JP" | "KR"}
        d={data}
        m={month}
      />
    );
  if (page === "product") return <Product d={data} m={month} />;
  if (page === "promotion") return <Promotion d={data} />;
  return (
    <section className="intro">
      <h2>{titles[page][0].replace(" Dashboard", "")}</h2>
      <p>
        This section is connected to the shared dashboard payload and ready for
        the existing Apps Script fields.
      </p>
      <div className="card placeholder">
        <Target />
        <b>Waiting for source fields</b>
        <span>No business values are hardcoded.</span>
      </div>
    </section>
  );
}
function Total({ d, m }: { d: DashboardData | null; m: number }) {
  const t = d?.total,
    rate = d?.exchangeRates?.[String(m)] || 0,
    kr = t?.monthlyKr?.[m - 1] || 0,
    jp = t?.monthlyJpKrw?.[m - 1] ?? (t?.monthlyJpJpy?.[m - 1] || 0) * rate,
    total = kr + jp,
    ytd =
      (t?.monthlyKr || []).slice(0, m).reduce((a, v) => a + v, 0) +
      (t?.monthlyJpKrw?.length
        ? t.monthlyJpKrw.slice(0, m).reduce((a, v) => a + v, 0)
        : (t?.monthlyJpJpy || [])
            .slice(0, m)
            .reduce(
              (a, v, i) => a + v * (d?.exchangeRates?.[String(i + 1)] || 0),
              0,
            )),
    targets = (t?.targets || []).slice(0, m).reduce((a, v) => a + v, 0);
  const monthly = series(months, [
    { label: "KR sales", data: t?.monthlyKr, color: "#5a4ff3" },
    {
      label: "JP sales · converted KRW",
      data: t?.monthlyJpKrw?.length
        ? t.monthlyJpKrw
        : t?.monthlyJpJpy?.map(
            (v, i) => v * (d?.exchangeRates?.[String(i + 1)] || 0),
          ),
      color: "#ef4c8b",
    },
  ]);
  return (
    <>
      <section className="intro">
        <h2>2SLASH4 Total Business Overview</h2>
        <p>
          국내 + 일본 전체 매출과 채널·국가별 목표 대비 실적을 한 화면에서
          확인합니다.
        </p>
      </section>
      <div className="kpis">
        <KPI
          label="전체 월매출"
          value={money(total)}
          note={`${m}월 기준 · KRW`}
        />
        <KPI label="국내 월매출" value={money(kr)} note={`${m}월 기준 · KRW`} />
        <KPI
          label="일본 월매출"
          value={money(jp)}
          note={`JPY→KRW · rate ${rate || "—"}`}
        />
        <KPI
          label="일본 비중"
          value={`${total ? (jp / total) * 100 : (0).toFixed?.(1)}%`}
          note="전체 매출 내 일본 비중"
        />
        <KPI
          label="YTD 전체 매출"
          value={money(ytd)}
          note="국내 + 일본 누적 · KRW"
        />
        <KPI
          label="YTD 전체 누계 목표"
          value={money(targets)}
          note="선택 월까지 누계 목표"
        />
      </div>
      <div className="grid">
        <ChartCard
          title="월별 전체 매출 추이 · 국내 + 일본"
          series={monthly}
          wide
        />
        <ChartCard
          title={`${m}월 채널별 매출`}
          series={
            t?.channels
              ? series(
                  Object.keys(t.channels),
                  Object.entries(t.channels).map(([label, data], i) => ({
                    label,
                    data,
                    color: ["#5a4ff3", "#ef4c8b", "#24b47e"][i % 3],
                  })),
                )
              : undefined
          }
        />
        <ChartCard
          title="월별 구매 건수 · KR + JP"
          series={series(months, [
            { label: "KR", data: t?.ordersKr, color: "#5a4ff3" },
            { label: "JP", data: t?.ordersJp, color: "#ef4c8b" },
          ])}
        />
        <ChartCard
          title={`${m}월 상품별 판매 수 · TOTAL`}
          series={productSeries(t?.products?.[String(m)])}
        />
        <ChartCard
          title="YTD 월 목표 vs 실매출"
          series={series(months, [
            { label: "Target", data: t?.targets, color: "#c9c7ff" },
            {
              label: "Actual",
              data: monthly.datasets[0].data.map(
                (v, i) => v + monthly.datasets[1].data[i],
              ),
              color: "#5a4ff3",
            },
          ])}
        />
        <ChartCard
          title="국가별 누계 목표 vs 누계 실매출"
          series={series(
            ["KR", "JP"],
            [{ label: "Actual", data: [kr, jp], color: "#ef4c8b" }],
          )}
        />
      </div>
    </>
  );
}
function Executive({
  market,
  d,
  m,
}: {
  market: "JP" | "KR";
  d: DashboardData | null;
  m: number;
}) {
  const x = market === "JP" ? d?.jp : d?.kr,
    sales = x?.monthlySales?.[m - 1] || 0,
    target = x?.targets?.[m - 1] || 0,
    c = market === "JP" ? "JPY" : "KRW";
  const funnel = x?.funnel?.[m - 1] || {};
  const funnelSteps =
    market === "JP"
      ? [
          ["유입자수", ["유입자수", "traffic", "Traffic"]],
          ["장바구니", ["장바구니", "cart", "addToCart", "Add to Cart"]],
          ["주문완료", ["주문완료", "completedOrders", "Completed Orders"]],
          [
            "주문전환율",
            ["주문전환율", "conversionRate", "Order Conversion Rate"],
          ],
        ]
      : [
          ["유입자수", ["유입자수", "traffic", "Traffic"]],
          ["국내 주문", ["국내 주문", "orders", "Orders"]],
          [
            "주문전환율",
            ["주문전환율", "conversionRate", "Order Conversion Rate"],
          ],
        ];
  return (
    <>
      <section className="intro">
        <h2>{market === "JP" ? "Japan" : "Korea"} Business Overview</h2>
        <p>매출·전환·상품 성과를 한 화면에서 확인합니다.</p>
      </section>
      <div className="kpis">
        <KPI label="월 매출" value={money(sales, c)} note={`${m}월 기준`} />
        <KPI label="월 목표" value={money(target, c)} />
        <KPI
          label="목표 달성률"
          value={`${target ? ((sales / target) * 100).toFixed(1) : "0.0"}%`}
        />
        <KPI
          label="주문건수"
          value={(x?.orders?.[m - 1] || 0).toLocaleString()}
        />
      </div>
      <div className="grid">
        <ChartCard
          title="연간 월별 매출 추이"
          series={series(months, [
            {
              label: `${market} sales`,
              data: x?.monthlySales,
              color: "#5a4ff3",
            },
          ])}
          wide
        />
        <ChartCard
          title="일별 매출 추이"
          series={x?.dailyByMonth?.[String(m)]}
          kind="line"
        />
        <ChartCard
          title="상품별 매출"
          series={productSeries(x?.products?.[String(m)])}
        />
        <ChartCard
          title="월 목표 vs 실매출"
          series={series(months, [
            { label: "Target", data: x?.targets, color: "#c9c7ff" },
            { label: "Actual", data: x?.monthlySales, color: "#5a4ff3" },
          ])}
        />
        <section className="card">
          <h3>{market} KPI & Funnel</h3>
          <div className="funnel">
            {funnelSteps.map(([label, aliases], i) => {
              const value = (aliases as string[])
                .map((key) => funnel[key])
                .find((item) => item !== undefined);
              return (
                <div key={label as string}>
                  <b>{label as string}</b>
                  <strong>
                    {value === undefined
                      ? "—"
                      : typeof value === "number"
                        ? value.toLocaleString()
                        : String(value)}
                  </strong>
                  {i < funnelSteps.length - 1 && <span>→</span>}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
function Product({ d, m }: { d: DashboardData | null; m: number }) {
  const [market, setMarket] = useState<"TOTAL" | "KR" | "JP">("TOTAL"),
    x = d?.product?.[market];
  return (
    <>
      <section className="intro">
        <h2>Product Performance</h2>
        <p>TOTAL / KR / JP를 나눠 월별 판매량과 누적 판매량을 확인합니다.</p>
        <div className="tabs">
          {(["TOTAL", "KR", "JP"] as const).map((v) => (
            <button
              className={market === v ? "active" : ""}
              onClick={() => setMarket(v)}
              key={v}
            >
              {v}
            </button>
          ))}
        </div>
      </section>
      <div className="grid">
        <ChartCard
          title="상품별 월간 판매 추이 · 1월~12월"
          series={x?.trends}
          kind="line"
          wide
        />
        <ChartCard
          title={`${m}월 판매량 TOP 10`}
          series={productSeries(x?.monthly?.[String(m)])}
        />
        <ChartCard
          title="누적 판매량 TOP 10 · 1월~12월"
          series={productSeries(x?.cumulative)}
        />
        <DataTable
          title={`${m}월 상품 순위`}
          rows={x?.monthly?.[String(m)]?.map((v, i) => ({
            rank: i + 1,
            product: v.name,
            quantity: v.quantity,
          }))}
        />
        <DataTable
          title="누적 상품 순위"
          rows={x?.cumulative?.map((v, i) => ({
            rank: i + 1,
            product: v.name,
            quantity: v.quantity,
          }))}
        />
      </div>
    </>
  );
}
function Promotion({ d }: { d: DashboardData | null }) {
  const p = d?.promotion;
  return (
    <>
      <section className="intro">
        <h2>Promotion Product Performance</h2>
        <p>
          상품/기간별 판매 흐름과 MEGAWARI · MEGAPO 전체 성과를 함께 확인합니다.
        </p>
      </section>
      <div className="grid">
        <ChartCard
          title="상품별 일자별 판매 추이"
          series={p?.productDaily}
          kind="line"
          wide
        />
        <ChartCard
          title="MEGAWARI 일별 매출 비교"
          series={p?.megawariDaily}
          kind="line"
        />
        <ChartCard
          title="MEGAPO 일별 매출 비교"
          series={p?.megapoDaily}
          kind="line"
        />
        <ChartCard title="MEGAWARI 분기별 총매출" series={p?.megawariTotals} />
        <ChartCard title="MEGAPO 월별 총매출" series={p?.megapoTotals} />
        <DataTable title="MEGAWARI 성과 요약" rows={p?.megawariSummary} />
        <DataTable title="MEGAPO 성과 요약" rows={p?.megapoSummary} />
      </div>
    </>
  );
}
function productSeries(rows?: ProductRow[]): Series | undefined {
  return rows?.length
    ? series(
        rows.map((v) => v.name),
        [
          {
            label: "Quantity",
            data: rows.map((v) => v.quantity),
            color: "#5a4ff3",
          },
        ],
      )
    : undefined;
}
