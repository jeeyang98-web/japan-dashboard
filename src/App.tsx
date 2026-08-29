import { useEffect, useMemo, useState } from "react";
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
import { promotionSheetData, promotionSheetUrl } from "./data/promotionSheetData";
import { krDailySheetUrl, krProductSheetUrl, krSheetData, krSheetUrl } from "./data/krSheetData";
import { jpProductSheetUrl, jpSheetData, jpSheetUrl } from "./data/jpSheetData";
import type { DashboardData, ProductRow, Series } from "./types";
import "./promotion.css";
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
  const [page, setPage] = useState<Page>("promotion"),
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
  if (page === "total") return <TotalCombined m={month} />;
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
function TotalCombined({ m }: { m: number }) {
  const [jpyKrw, setJpyKrw] = useState(8.6317);
  const [fxDate, setFxDate] = useState("2026-08-29");
  useEffect(() => {
    fetch("https://api.frankfurter.dev/v2/rate/JPY/KRW")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((result) => {
        if (Number(result?.rate) > 0) setJpyKrw(Number(result.rate));
        if (result?.date) setFxDate(String(result.date));
      })
      .catch((error) => console.warn("JPY/KRW exchange rate fallback in use", error));
  }, []);
  const krSales = krSheetData.monthlySales[m - 1] || 0;
  const jpSales = jpSheetData.monthlySales[m - 1] || 0;
  const krTarget = krSheetData.targets[m - 1] || 0;
  const jpTarget = jpSheetData.targets[m - 1] || 0;
  const krYtd = krSheetData.monthlySales.slice(0, m).reduce((sum, value) => sum + value, 0);
  const jpYtd = jpSheetData.monthlySales.slice(0, m).reduce((sum, value) => sum + value, 0);
  const totalSales = Math.round(krSales + jpSales * jpyKrw);
  const totalTarget = Math.round(krTarget + jpTarget * jpyKrw);
  const totalYtd = Math.round(krYtd + jpYtd * jpyKrw);
  const combinedMonthlySales = krSheetData.monthlySales.map(
    (value, index) => Math.round(value + (jpSheetData.monthlySales[index] || 0) * jpyKrw),
  );
  const combinedMonthlyTargets = krSheetData.targets.map(
    (value, index) => Math.round(value + (jpSheetData.targets[index] || 0) * jpyKrw),
  );
  const jpMonthlySalesKrw = jpSheetData.monthlySales.map((value) => Math.round(value * jpyKrw));
  const jpMonthlyTargetsKrw = jpSheetData.targets.map((value) => Math.round(value * jpyKrw));
  return (
    <>
      <section className="intro">
        <h2>KR + JP Business Overview</h2>
        <p>JP 매출을 최신 JPY→KRW 환율로 환산한 통합 실적입니다.</p>
        <a className="source-link" href={krSheetUrl} target="_blank" rel="noreferrer">KR 데이터</a>
        <span> · </span>
        <a className="source-link" href={jpSheetUrl} target="_blank" rel="noreferrer">JP 데이터</a>
        <span> · </span>
        <a className="source-link" href="https://share.google/kB3LrSbGm3er9v5vB" target="_blank" rel="noreferrer">JPY/KRW 환율</a>
      </section>
      <div className="kpis">
        <KPI label="통합 월매출" value={money(totalSales)} note={`${m}월 · KRW`} />
        <KPI label="통합 월목표" value={money(totalTarget)} note="KR + 환산 JP" />
        <KPI label="통합 목표 달성률" value={`${totalTarget ? ((totalSales / totalTarget) * 100).toFixed(1) : "0.0"}%`} />
        <KPI label="통합 YTD 매출" value={money(totalYtd)} note="1월부터 선택 월까지" />
        <KPI label="KR 매출 비중" value={`${totalSales ? ((krSales / totalSales) * 100).toFixed(1) : "0.0"}%`} />
        <KPI label="JPY/KRW 환율" value={jpyKrw.toFixed(4)} note={`${fxDate} 기준`} />
      </div>
      <div className="grid">
        <ChartCard
          title="KR + JP 통합 월별 매출 vs 목표 · KRW"
          series={series(months, [
            { label: "통합 매출", data: combinedMonthlySales, color: "#5a4ff3" },
            { label: "통합 목표", data: combinedMonthlyTargets, color: "#c9c7ff" },
          ])}
          wide
        />
        <ChartCard
          title="KR 월별 매출 vs 목표 · KRW"
          series={series(months, [
            { label: "KR 매출", data: krSheetData.monthlySales, color: "#5a4ff3" },
            { label: "KR 목표", data: krSheetData.targets, color: "#c9c7ff" },
          ])}
          wide
        />
        <ChartCard
          title="JP 월별 매출 vs 목표 · 환산 KRW"
          series={series(months, [
            { label: "JP 환산 매출", data: jpMonthlySalesKrw, color: "#ef4c8b" },
            { label: "JP 환산 목표", data: jpMonthlyTargetsKrw, color: "#f8bfd5" },
          ])}
          wide
        />
        <ChartCard title={`KR ${m}월 라인별 판매량 TOP 5`} series={productSeries(krSheetData.lineQuantityProducts[String(m) as keyof typeof krSheetData.lineQuantityProducts])} />
        <ChartCard title={`JP ${m}월 라인별 판매량 TOP 5`} series={productSeries(jpSheetData.products[String(m) as keyof typeof jpSheetData.products])} />
      </div>
    </>
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
  const source = market === "JP" ? d?.jp : d?.kr;
  const x = market === "KR"
    ? {
        ...source,
        monthlySales: source?.monthlySales?.some(Boolean) ? source.monthlySales : krSheetData.monthlySales,
        targets: source?.targets?.some(Boolean) ? source.targets : krSheetData.targets,
        units: source?.units?.some(Boolean) ? source.units : krSheetData.units,
        dailyByMonth: source?.dailyByMonth && Object.keys(source.dailyByMonth).length ? source.dailyByMonth : krSheetData.dailyByMonth,
        products: source?.products && Object.keys(source.products).length ? source.products : krSheetData.lineQuantityProducts,
      }
    : {
        ...source,
        monthlySales: source?.monthlySales?.some(Boolean) ? source.monthlySales : jpSheetData.monthlySales,
        targets: source?.targets?.some(Boolean) ? source.targets : jpSheetData.targets,
        orders: source?.orders?.some(Boolean) ? source.orders : jpSheetData.orders,
        dailyByMonth: source?.dailyByMonth && Object.keys(source.dailyByMonth).length ? source.dailyByMonth : jpSheetData.dailyByMonth,
        products: source?.products && Object.keys(source.products).length ? source.products : jpSheetData.products,
        funnel: source?.funnel?.some((item) => Object.keys(item || {}).length) ? source.funnel : jpSheetData.funnel,
      },
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
        {market === "KR" && (
          <>
            <a className="source-link" href={krSheetUrl} target="_blank" rel="noreferrer">마감 데이터 · 월마감</a>
            <span> · </span>
            <a className="source-link" href={krDailySheetUrl} target="_blank" rel="noreferrer">당월 데이터 · 일별매출</a>
            <span> · </span>
            <a className="source-link" href={krProductSheetUrl} target="_blank" rel="noreferrer">상품 데이터</a>
          </>
        )}
        {market === "JP" && (
          <>
            <a className="source-link" href={jpSheetUrl} target="_blank" rel="noreferrer">
              매출 데이터 · 매출 대시보드
            </a>
            <span> · </span>
            <a className="source-link" href={jpProductSheetUrl} target="_blank" rel="noreferrer">
              라인별 판매량 · 상품별 매출
            </a>
          </>
        )}
      </section>
      <div className="kpis">
        <KPI
          label="월 매출"
          value={money(sales, c)}
          note={market === "KR" && m === 8 ? `8월 누계 · ${krSheetData.latestDailyDate} 기준` : `${m}월 기준`}
        />
        <KPI label="월 목표" value={money(target, c)} />
        <KPI
          label="목표 달성률"
          value={`${target ? ((sales / target) * 100).toFixed(1) : "0.0"}%`}
        />
        <KPI
          label={market === "KR" ? "판매수량" : "주문건수"}
          value={(market === "KR" ? x?.units?.[m - 1] : x?.orders?.[m - 1] || 0)?.toLocaleString() || "0"}
        />
        {market === "JP" && (
          <>
            <KPI label="유입수" value={(funnel["유입자수"] || 0).toLocaleString()} />
            <KPI label="전환율" value={String(funnel["주문전환율"] || "—")} />
            <KPI
              label="객단가"
              value={money((x?.orders?.[m - 1] || 0) ? sales / (x?.orders?.[m - 1] || 1) : 0, "JPY")}
            />
          </>
        )}
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
          title="라인별 판매량 TOP 5"
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
  const api = d?.promotion;
  const p = {
    productDaily: api?.productDaily,
    megawariDaily: api?.megawariDaily?.labels?.length ? api.megawariDaily : promotionSheetData.megawariDaily,
    megapoDaily: api?.megapoDaily?.labels?.length ? api.megapoDaily : promotionSheetData.megapoDaily,
    megawariTotals: api?.megawariTotals?.labels?.length ? api.megawariTotals : promotionSheetData.megawariTotals,
    megapoTotals: api?.megapoTotals?.labels?.length ? api.megapoTotals : promotionSheetData.megapoTotals,
    megawariSummary: api?.megawariSummary?.length ? api.megawariSummary : promotionSheetData.megawariSummary,
    megapoSummary: api?.megapoSummary?.length ? api.megapoSummary : promotionSheetData.megapoSummary,
  };
  return (
    <>
      <section className="intro">
        <h2>Promotion Product Performance</h2>
        <p>
          상품/기간별 판매 흐름과 MEGAWARI · MEGAPO 전체 성과를 함께 확인합니다.
        </p>
        <a className="source-link" href={promotionSheetUrl} target="_blank" rel="noreferrer">
          데이터 소스 · 프로모션별 매출내역
        </a>
      </section>
      <div className="grid">
        <ChartCard
          title="상품별 일자별 판매 추이 · 시트 입력 대기"
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
        <DataTable title="MEGAWARI 분기별 Day 매출" rows={promotionSheetData.megawariDayColumnRows} scroll />
        <DataTable title="MEGAPO 월별 Day 매출" rows={promotionSheetData.megapoDayColumnRows} scroll />
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
function productSalesSeries(rows?: ProductRow[]): Series | undefined {
  return rows?.length
    ? series(
        rows.map((row) => row.name),
        [{ label: "매출액", data: rows.map((row) => row.quantity), color: "#5a4ff3" }],
      )
    : undefined;
}
