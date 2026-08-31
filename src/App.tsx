import { useMemo, useState } from "react";
import {
  BarChart3,
  Box,
  CalendarDays,
  Flame,
  Globe2,
  JapanIcon,
  LineChart,
  Map as MapIcon,
  Menu,
  RefreshCw,
  Search,
  Target,
  X,
} from "lucide-react";
import { ChartCard, DataTable, KPI, money } from "./components";
import { useDashboard } from "./context/DataContext";
import {
  megawariCampaigns,
  megapoCampaigns,
  buildDailySeries,
  buildTotals,
  buildDayColumnRows,
} from "./data/promotionSheetData";
import { krProductSheetUrl, krSheetData, krSheetUrl } from "./data/krSheetData";
import { jpProductSheetUrl, jpSheetData, jpSheetUrl } from "./data/jpSheetData";
import "./promotion.css";
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
  ["JP Executive", "jp", MapIcon],
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
    jpApi = d?.jp,
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
            ));

  const krTargets = t?.targets || [];
  // JP 목표는 현재 선택된 월 하나만 라이브 API가 채워주고 나머지 달은 0으로 옵니다
  // (백엔드에 JP 연간 목표 시트 연동이 아직 없음) — 그만큼 통합/JP 목표 차트는 해당 월만 정확합니다.
  const jpTargetsKrw = months.map((_, i) =>
    Math.round((jpApi?.targets?.[i] || 0) * (d?.exchangeRates?.[String(i + 1)] || 0)),
  );
  const combinedTargets = krTargets.map((v, i) => v + (jpTargetsKrw[i] || 0));
  const targetsYtd = combinedTargets.slice(0, m).reduce((a, v) => a + v, 0);

  const monthlyJpKrw = t?.monthlyJpKrw?.length
    ? t.monthlyJpKrw
    : (t?.monthlyJpJpy || []).map(
        (v, i) => v * (d?.exchangeRates?.[String(i + 1)] || 0),
      );
  const combinedMonthlySales = (t?.monthlyKr || []).map(
    (v, i) => v + (monthlyJpKrw[i] || 0),
  );

  const krProductsTop5 = (d?.kr?.products?.[String(m)] || []).slice(0, 5);
  const jpProductsTop5 = (d?.jp?.products?.[String(m)] || []).slice(0, 5);

  return (
    <>
      <section className="intro">
        <h2>2SLASH4 Total Business Overview</h2>
        <p>
          국내 + 일본 전체 매출과 채널·국가별 목표 대비 실적을 한 화면에서
          확인합니다.
        </p>
        <a className="source-link" href={krSheetUrl} target="_blank" rel="noreferrer">KR 데이터</a>
        <span> · </span>
        <a className="source-link" href={jpSheetUrl} target="_blank" rel="noreferrer">JP 데이터</a>
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
          value={`${total ? ((jp / total) * 100).toFixed(1) : "0.0"}%`}
          note="전체 매출 내 일본 비중"
        />
        <KPI
          label="YTD 전체 매출"
          value={money(ytd)}
          note="국내 + 일본 누적 · KRW"
        />
        <KPI
          label="YTD 전체 누계 목표"
          value={money(targetsYtd)}
          note="선택 월까지 누계 목표"
        />
      </div>
      <div className="grid">
        <ChartCard
          title="KR + JP 통합 월별 매출 vs 목표 · KRW"
          series={series(months, [
            { label: "통합 매출", data: combinedMonthlySales, color: "#5a4ff3" },
            { label: "통합 목표", data: combinedTargets, color: "#c9c7ff" },
          ])}
          wide
        />
        <ChartCard
          title="KR 월별 매출 vs 목표 · KRW"
          series={series(months, [
            { label: "KR 매출", data: t?.monthlyKr, color: "#5a4ff3" },
            { label: "KR 목표", data: krTargets, color: "#c9c7ff" },
          ])}
          wide
        />
        <ChartCard
          title="JP 월별 매출 vs 목표 · 환산 KRW"
          series={series(months, [
            { label: "JP 환산 매출", data: monthlyJpKrw, color: "#ef4c8b" },
            { label: "JP 환산 목표", data: jpTargetsKrw, color: "#f8bfd5" },
          ])}
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
        <ChartCard title={`KR ${m}월 라인별 판매량 TOP 5`} series={productSeries(krProductsTop5)} />
        <ChartCard title={`JP ${m}월 라인별 판매량 TOP 5`} series={productSeries(jpProductsTop5)} />
      </div>
    </>
  );
}
function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16);
  const clamp = Math.max(0, Math.min(1, t));
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * clamp);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * clamp);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * clamp);
  return `rgb(${r},${g},${bl})`;
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
    c = market === "JP" ? "JPY" : "KRW",
    daysInMonth = new Date(2026, m, 0).getDate(),
    dailyAvg = sales / daysInMonth;
  const dailyFunnelForMonth =
    market === "JP" ? x?.dailyFunnel?.filter((r) => Number(r.date.slice(5, 7)) === m) : undefined;
  const liveFunnel = dailyFunnelForMonth?.length
    ? (() => {
        const traffic = dailyFunnelForMonth.reduce((sum, r) => sum + r.traffic, 0);
        const cart = dailyFunnelForMonth.reduce((sum, r) => sum + r.cart, 0);
        const orders = dailyFunnelForMonth.reduce((sum, r) => sum + r.orders, 0);
        const rate = traffic ? (orders / traffic) * 100 : 0;
        return { 유입자수: traffic, 장바구니: cart, 주문완료: orders, 주문전환율: `${rate.toFixed(2)}%` };
      })()
    : undefined;
  const funnel: Record<string, number | string> = liveFunnel || x?.funnel?.[m - 1] || {};
  const orderCount = Number(funnel["주문완료"]) || 0;
  const funnelStages =
    market === "JP"
      ? [
          { label: "유입자수", desc: "사이트 방문", value: funnel["유입자수"] },
          { label: "장바구니", desc: "상품 장바구니 담기", value: funnel["장바구니"] },
          { label: "주문완료", desc: "결제 및 주문 완료", value: funnel["주문완료"] },
        ]
      : [
          { label: "유입자수", desc: "사이트 방문", value: funnel["유입자수"] },
          { label: "국내 주문", desc: "결제 및 주문 완료", value: funnel["국내 주문"] },
        ];
  const funnelMax = Math.max(1, ...funnelStages.map((s) => Number(s.value) || 0));
  const dailyKpiSeries: Series | undefined =
    dailyFunnelForMonth?.length
      ? {
          labels: dailyFunnelForMonth.map((r) => `${Number(r.date.slice(5, 7))}/${Number(r.date.slice(8, 10))}`),
          datasets: [
            { label: "유입자수", data: dailyFunnelForMonth.map((r) => r.traffic), borderColor: "#5a4ff3", backgroundColor: "#5a4ff3" },
            { label: "장바구니", data: dailyFunnelForMonth.map((r) => r.cart), borderColor: "#24b47e", backgroundColor: "#24b47e" },
            { label: "주문완료", data: dailyFunnelForMonth.map((r) => r.orders), borderColor: "#f5a623", backgroundColor: "#f5a623" },
            { label: "주문전환율(%)", data: dailyFunnelForMonth.map((r) => r.conversionRate), borderColor: "#ef4c8b", backgroundColor: "#ef4c8b", yAxisID: "y1" },
          ],
        }
      : undefined;
  return (
    <>
      <section className="intro">
        <h2>{market === "JP" ? "Japan" : "Korea"} Business Overview</h2>
        <p>매출·전환·상품 성과를 한 화면에서 확인합니다.</p>
      </section>
      <div className={`kpis${market === "JP" ? " grid-4" : ""}`}>
        <KPI label="월 매출" value={money(sales, c)} note={`${m}월 기준`} />
        <KPI label="월 목표" value={money(target, c)} />
        <KPI
          label="목표 달성률"
          value={`${target ? ((sales / target) * 100).toFixed(1) : "0.0"}%`}
        />
        {market === "JP" ? (
          <KPI label="일 평균매출" value={money(dailyAvg, c)} note={`${daysInMonth}일 기준`} />
        ) : (
          <KPI
            label="주문건수"
            value={(x?.orders?.[m - 1] || 0).toLocaleString()}
          />
        )}
        {market === "JP" && (
          <>
            <KPI label="주문건수" value={orderCount.toLocaleString()} />
            <KPI label="유입수" value={(funnel["유입자수"] || 0).toLocaleString()} />
            <KPI label="전환율" value={String(funnel["주문전환율"] || "—")} />
            <KPI
              label="객단가"
              value={money(orderCount ? sales / orderCount : 0, "JPY")}
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
        <ChartCard
          title={dailyKpiSeries ? "일별 KPI 추이" : "일별 KPI 추이 · 시트 입력 대기"}
          series={dailyKpiSeries}
          kind="line"
        />
      </div>
      <section className="card wide">
        <h3>{market} KPI & Funnel</h3>
        <div className="funnel-viz">
          {funnelStages.map((stage, i) => {
            const value = Number(stage.value) || 0;
            const heightPct = stage.value === undefined ? 0 : Math.max(6, Math.round((value / funnelMax) * 100));
            const prevValue = i > 0 ? Number(funnelStages[i - 1].value) || 0 : null;
            const stepRate = prevValue ? Math.round((value / prevValue) * 1000) / 10 : null;
            const t = funnelStages.length > 1 ? i / (funnelStages.length - 1) : 0;
            const top = mixHex("#5a4ff3", "#ef4c8b", t);
            const bottom = mixHex("#5a4ff3", "#ef4c8b", Math.min(1, t + 0.3));
            return (
              <div className="funnel-col" key={stage.label}>
                <span className="funnel-bar-value" style={{ color: top }}>
                  {stage.value === undefined ? "—" : value.toLocaleString()}
                </span>
                <div className="funnel-bar-wrap">
                  <div className="funnel-bar" style={{ height: `${heightPct}%`, background: `linear-gradient(165deg, ${top}, ${bottom})` }} />
                </div>
                <div className="funnel-step-rate">
                  {stepRate !== null ? (
                    <>
                      단계 전환율<br /><b>{stepRate}%</b>
                    </>
                  ) : (
                    <>&nbsp;</>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="funnel-steps-row">
          <div className="funnel-steps-line" />
          {funnelStages.map((stage, i) => (
            <div className="funnel-step-col" key={stage.label}>
              <div className="funnel-step-badge">STEP {i + 1}</div>
              <div className="funnel-step-label">{stage.desc}</div>
            </div>
          ))}
        </div>
        <div className="funnel-summary">
          <div className="funnel-summary-badge">
            <span>전체 주문전환율</span>
            <strong>{String(funnel["주문전환율"] ?? "—")}</strong>
          </div>
        </div>
      </section>
    </>
  );
}
const productChartColors = ["#5a4ff3", "#ef4c8b", "#24b47e", "#f5a623", "#3ba3e0", "#a855f7"];
function sumProductRows(rows: ProductRow[], limit?: number): ProductRow[] {
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(row.name, (totals.get(row.name) || 0) + row.quantity));
  const merged = Array.from(totals, ([name, quantity]) => ({ name, quantity })).sort(
    (a, b) => b.quantity - a.quantity,
  );
  return limit ? merged.slice(0, limit) : merged;
}
function buildProductMarketData(monthly: Record<string, ProductRow[]>) {
  const monthKeys = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const top = sumProductRows(monthKeys.flatMap((k) => monthly[k] || []), 5);
  return {
    trends: {
      labels: months,
      datasets: top.map((p, i) => ({
        label: p.name,
        data: monthKeys.map((k) => (monthly[k] || []).find((row) => row.name === p.name)?.quantity || 0),
        backgroundColor: productChartColors[i % productChartColors.length],
        borderColor: productChartColors[i % productChartColors.length],
      })),
    } as Series,
    monthly,
    cumulative: sumProductRows(monthKeys.flatMap((k) => monthly[k] || []), 10),
  };
}
function Product({ d, m }: { d: DashboardData | null; m: number }) {
  const [market, setMarket] = useState<"TOTAL" | "KR" | "JP">("TOTAL");
  const fallback = useMemo(() => {
    const kr = krSheetData.lineQuantityProducts as Record<string, ProductRow[]>;
    const jp = jpSheetData.products as Record<string, ProductRow[]>;
    const monthKeys = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const total: Record<string, ProductRow[]> = {};
    monthKeys.forEach((k) => {
      total[k] = [...(kr[k] || []), ...(jp[k] || [])];
    });
    return {
      KR: buildProductMarketData(kr),
      JP: buildProductMarketData(jp),
      TOTAL: buildProductMarketData(total),
    };
  }, []);
  const api = d?.product?.[market];
  const x =
    api?.trends?.datasets?.length || api?.cumulative?.length ? api : fallback[market];
  return (
    <>
      <section className="intro">
        <h2>Product Performance</h2>
        <p>
          TOTAL / KR / JP를 나눠 월별 판매량과 누적 판매량을 확인합니다 · JP · KR
          Executive 대시보드의 상품 데이터를 취합했습니다.
        </p>
        <a className="source-link" href={krProductSheetUrl} target="_blank" rel="noreferrer">
          KR 상품 데이터
        </a>
        <span> · </span>
        <a className="source-link" href={jpProductSheetUrl} target="_blank" rel="noreferrer">
          JP 상품 데이터
        </a>
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
  const megawari = api?.megawariCampaigns?.length ? api.megawariCampaigns : megawariCampaigns;
  const megapo = api?.megapoCampaigns?.length ? api.megapoCampaigns : megapoCampaigns;
  const p = {
    megawariDaily: buildDailySeries(megawari, Math.max(13, ...megawari.map((c) => c.sales.length))),
    megapoDaily: buildDailySeries(megapo, Math.max(9, ...megapo.map((c) => c.sales.length))),
    megawariTotals: buildTotals(megawari, "#5a4ff3"),
    megapoTotals: buildTotals(megapo, "#ef4c8b"),
    megawariDayColumnRows: buildDayColumnRows(megawari, "분기"),
    megapoDayColumnRows: buildDayColumnRows(megapo, "월"),
  };
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
        <DataTable title="MEGAWARI 분기별 Day 매출" rows={p.megawariDayColumnRows} scroll />
        <DataTable title="MEGAPO 월별 Day 매출" rows={p.megapoDayColumnRows} scroll />
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
