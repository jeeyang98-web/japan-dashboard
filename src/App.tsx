import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Box,
  CalendarDays,
  Compass,
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
import { ChartCard, DataTable, DrilldownLineChart, KPI, ProductRankTable, money } from "./components";
import { useDashboard } from "./context/DataContext";
import { fetchKrProductSalesData, fetchPlatformData } from "./lib/api";
import {
  promotionSheetUrl,
  megawariCampaigns,
  megapoCampaigns,
  buildDailySeries,
  buildTotals,
  buildDayColumnRows,
} from "./data/promotionSheetData";
import { krDailySheetUrl, krProductSheetUrl, krSheetData, krSheetUrl } from "./data/krSheetData";
import { jpProductSheetUrl, jpSheetData, jpSheetUrl } from "./data/jpSheetData";
import "./promotion.css";
import type { DailyFunnelRow, DashboardData, DailyLineQty, ProductRow, Series } from "./types";
const months = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
type Page =
  | "total"
  | "jp"
  | "kr"
  | "global"
  | "product"
  | "promotion"
  | "marketing"
  | "competitor"
  | "planning";
const nav: [string, Page, any][] = [
  ["Total Business", "total", Globe2],
  ["JP Executive", "jp", MapIcon],
  ["KR Executive", "kr", BarChart3],
  ["GLOBAL Executive", "global", Compass],
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
              {i === 4 && <span className="nav-label inline">COMMERCE</span>}
              {i === 6 && <span className="nav-label inline">INSIGHTS</span>}
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
  global: [
    "GLOBAL Executive Dashboard",
    "예스스타일 · 올리브영 US · 키오키 · 쇼피 · 앳코스메 홍콩 target & sales",
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
  if (page === "global") return <Global d={data} m={month} />;
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
const cumulative = (arr: number[]) =>
  arr.reduce<number[]>((acc, v, i) => [...acc, (acc[i - 1] || 0) + v], []);

function Total({ d, m }: { d: DashboardData | null; m: number }) {
  const [trendMarket, setTrendMarket] = useState<"ALL" | "KR" | "JP">("ALL");
  const t = d?.total,
    jpApi = d?.jp,
    rate = d?.exchangeRates?.[String(m)] || 0,
    kr = t?.monthlyKr?.[m - 1] || 0,
    jp = t?.monthlyJpKrw?.[m - 1] ?? (t?.monthlyJpJpy?.[m - 1] || 0) * rate,
    total = kr + jp;

  const krTargets = t?.targets || [];
  // JP 목표는 현재 선택된 월 하나만 라이브 API가 채워주고 나머지 달은 0으로 옵니다
  // (백엔드에 JP 연간 목표 시트 연동이 아직 없음) — 그만큼 통합/JP 목표 관련 수치는 해당 월만 정확합니다.
  const jpTargetsKrw = months.map((_, i) =>
    Math.round((jpApi?.targets?.[i] || 0) * (d?.exchangeRates?.[String(i + 1)] || 0)),
  );
  const combinedTargets = krTargets.map((v, i) => v + (jpTargetsKrw[i] || 0));

  const monthlyJpKrw = t?.monthlyJpKrw?.length
    ? t.monthlyJpKrw
    : (t?.monthlyJpJpy || []).map(
        (v, i) => v * (d?.exchangeRates?.[String(i + 1)] || 0),
      );
  const combinedMonthlySales = (t?.monthlyKr || []).map(
    (v, i) => v + (monthlyJpKrw[i] || 0),
  );

  const krYtd = (t?.monthlyKr || []).slice(0, m).reduce((a, v) => a + v, 0);
  const jpYtdKrw = monthlyJpKrw.slice(0, m).reduce((a, v) => a + v, 0);
  const totalYtd = krYtd + jpYtdKrw;

  const krCumSales = cumulative(t?.monthlyKr || []);
  const krCumTargets = cumulative(krTargets);
  const jpCumSalesKrw = cumulative(monthlyJpKrw);
  const jpCumTargetsKrw = cumulative(jpTargetsKrw);

  const totalProductRows = (t?.products?.[String(m)] || []).slice(0, 12);

  const monthlyDetailRows = months.map((label, i) => {
    const krTarget = krTargets[i] || 0,
      krSales = t?.monthlyKr?.[i] || 0,
      krRate = krTarget ? (krSales / krTarget) * 100 : 0;
    const jpTargetJpy = jpApi?.targets?.[i] || 0,
      jpSalesJpy = t?.monthlyJpJpy?.[i] || 0,
      jpTargetKrw = jpTargetsKrw[i] || 0,
      jpSalesKrw = monthlyJpKrw[i] || 0,
      jpRate = jpTargetJpy ? (jpSalesJpy / jpTargetJpy) * 100 : 0;
    const rowTotalTarget = combinedTargets[i] || 0,
      rowTotalSales = combinedMonthlySales[i] || 0,
      totalRate = rowTotalTarget ? (rowTotalSales / rowTotalTarget) * 100 : 0;
    return {
      월: label,
      환율: (d?.exchangeRates?.[String(i + 1)] || 0).toFixed(2),
      krTarget: money(krTarget),
      krSales: money(krSales),
      krRate,
      jpTargetJpy: money(jpTargetJpy, "JPY"),
      jpSalesJpy: money(jpSalesJpy, "JPY"),
      jpTargetKrw: money(jpTargetKrw),
      jpSalesKrw: money(jpSalesKrw),
      jpRate,
      totalTarget: money(rowTotalTarget),
      totalSales: money(rowTotalSales),
      totalRate,
    };
  });

  return (
    <>
      <section className="intro">
        <h2>KR + JP Business Overview</h2>
        <p>JP 매출을 월별 JPY→KRW 환율(월말 기준)로 환산한 통합 실적입니다.</p>
        <a className="source-link" href={krSheetUrl} target="_blank" rel="noreferrer">KR 데이터</a>
        <span> · </span>
        <a className="source-link" href={jpSheetUrl} target="_blank" rel="noreferrer">JP 데이터</a>
        <span> · </span>
        <a className="source-link" href="https://share.google/kB3LrSbGm3er9v5vB" target="_blank" rel="noreferrer">JPY/KRW 환율</a>
      </section>
      <div className="kpis">
        <KPI label="통합 월매출" value={money(total)} note={`${m}월 · KRW`} />
        <KPI label="통합 월목표" value={money(combinedTargets[m - 1] || 0)} note="KR + 환산 JP" />
        <KPI
          label="통합 목표 달성률"
          value={`${combinedTargets[m - 1] ? ((total / combinedTargets[m - 1]) * 100).toFixed(1) : "0.0"}%`}
        />
        <KPI label="통합 YTD 매출" value={money(totalYtd)} note="1월부터 선택 월까지" />
        <KPI label="KR 매출 비중" value={`${total ? ((kr / total) * 100).toFixed(1) : "0.0"}%`} />
        <KPI label="JPY/KRW 환율" value={rate.toFixed(4)} note={`${m}월 환율`} />
      </div>
      <div className="grid">
        <ChartCard
          title={
            trendMarket === "ALL"
              ? "월별 전체 매출 추이 · 국내 + 일본"
              : trendMarket === "KR"
                ? "월별 매출 추이 · 국내"
                : "월별 매출 추이 · 일본"
          }
          series={
            trendMarket === "KR"
              ? series(months, [{ label: "국내", data: t?.monthlyKr, color: "#5a4ff3" }])
              : trendMarket === "JP"
                ? series(months, [{ label: "일본", data: monthlyJpKrw, color: "#ef4c8b" }])
                : series(months, [
                    { label: "국내", data: t?.monthlyKr, color: "#5a4ff3" },
                    { label: "일본", data: monthlyJpKrw, color: "#c9c7ff" },
                  ])
          }
          wide
          stacked={trendMarket === "ALL"}
          actions={
            <div className="mini-tabs">
              {(["ALL", "KR", "JP"] as const).map((v) => (
                <button
                  key={v}
                  className={trendMarket === v ? "active" : ""}
                  onClick={() => setTrendMarket(v)}
                >
                  {v === "ALL" ? "전체" : v}
                </button>
              ))}
            </div>
          }
        />
        <ChartCard
          title="채널별 월별 매출 추이(매출액+배송비)"
          series={channelTrendSeries(d?.kr?.channelRevenue)}
          kind="line"
        />
        <ChartCard
          title="YTD 월 목표 vs 실매출"
          series={series(months, [
            { label: "전체 목표", data: combinedTargets, color: "#dfe0e8" },
            { label: "전체 실매출", data: combinedMonthlySales, color: "#5a4ff3" },
          ])}
        />
        <ChartCard
          title="국가별 누계 목표 vs 누계 실매출"
          kind="line"
          series={series(months, [
            { label: "KR 누계 목표", data: krCumTargets, color: "#b7b9c4" },
            { label: "KR 누계 실매출", data: krCumSales, color: "#5a4ff3" },
            { label: "JP 누계 목표(KRW)", data: jpCumTargetsKrw, color: "#c9c7ff" },
            { label: "JP 누계 실매출(KRW)", data: jpCumSalesKrw, color: "#ef4c8b" },
          ])}
        />
        <ChartCard
          title="월별 구매 건수 · KR + JP"
          series={series(months, [
            { label: "KR 구매 건수", data: t?.ordersKr, color: "#5a4ff3" },
            { label: "JP 구매 건수", data: t?.ordersJp, color: "#c9c7ff" },
          ])}
          stacked
        />
        <ChartCard title={`${m}월 상품별 판매 수 · TOTAL`} series={productSeries(totalProductRows)} />
        <section className="card wide detail-table">
          <h3>월별 목표매출 · 실매출 상세</h3>
          <p className="detail-caption">국내는 월마감 국내 합계, 일본은 매출내역 엔화 금액을 월별 JPY→KRW 환율로 환산한 값입니다.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>월</th>
                  <th rowSpan={2}>환율 JPY→KRW</th>
                  <th colSpan={3} className="group-kr">국내 (KRW)</th>
                  <th colSpan={5} className="group-jp">일본</th>
                  <th colSpan={3} className="group-total">전체 (KRW)</th>
                </tr>
                <tr>
                  <th className="group-kr">목표</th>
                  <th className="group-kr">실매출</th>
                  <th className="group-kr">달성률</th>
                  <th className="group-jp">목표 (JPY)</th>
                  <th className="group-jp">실매출 (JPY)</th>
                  <th className="group-jp">목표 (KRW)</th>
                  <th className="group-jp">실매출 (KRW)</th>
                  <th className="group-jp">달성률</th>
                  <th className="group-total">목표</th>
                  <th className="group-total">실매출</th>
                  <th className="group-total">달성률</th>
                </tr>
              </thead>
              <tbody>
                {monthlyDetailRows.map((row) => (
                  <tr key={row.월}>
                    <td>{row.월}</td>
                    <td>{row.환율}</td>
                    <td>{row.krTarget}</td>
                    <td>{row.krSales}</td>
                    <td className={row.krRate >= 90 ? "rate-good" : "rate-bad"}>{row.krRate.toFixed(1)}%</td>
                    <td>{row.jpTargetJpy}</td>
                    <td>{row.jpSalesJpy}</td>
                    <td>{row.jpTargetKrw}</td>
                    <td>{row.jpSalesKrw}</td>
                    <td className={row.jpRate >= 90 ? "rate-good" : "rate-bad"}>{row.jpRate.toFixed(1)}%</td>
                    <td>{row.totalTarget}</td>
                    <td>{row.totalSales}</td>
                    <td className={row.totalRate >= 90 ? "rate-good" : "rate-bad"}>{row.totalRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
      <div className={`kpis${market === "JP" ? " grid-4" : ""}`}>
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
        {market === "JP" ? (
          <KPI label="일 평균매출" value={money(dailyAvg, c)} note={`${daysInMonth}일 기준`} />
        ) : (
          <KPI
            label="판매수량"
            value={(x?.units?.[m - 1] || 0).toLocaleString()}
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
        {market === "KR" ? (
          <ChartCard title="채널별 월별 매출 추이(매출액+배송비)" series={channelTrendSeries(x?.channelRevenue)} kind="line" />
        ) : (
          <ChartCard
            title={dailyKpiSeries ? "일별 KPI 추이" : "일별 KPI 추이 · 시트 입력 대기"}
            series={dailyKpiSeries}
            kind="line"
          />
        )}
      </div>
      {market === "JP" && (
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
      )}
    </>
  );
}
const GLOBAL_GROUP_CLASSES = ["group-kr", "group-jp", "group-total"];
function Global({ d, m }: { d: DashboardData | null; m: number }) {
  const g = d?.global;
  const platforms = g?.platforms || [];
  const targets = g?.targets || {};
  const sales = g?.sales || {};
  const monthlyTotalTargets = g?.monthlyTotalTargets || [];
  const monthlyTotalSales = g?.monthlyTotalSales || [];

  const sale = monthlyTotalSales[m - 1] || 0;
  const target = monthlyTotalTargets[m - 1] || 0;
  const rate = target ? (sale / target) * 100 : 0;
  const ytdSales = monthlyTotalSales.slice(0, m).reduce((a, b) => a + b, 0);

  return (
    <>
      <section className="intro">
        <h2>Global Platform Overview</h2>
        <p>예스스타일 · 올리브영 US · 키오키 · 쇼피 · 앳코스메 홍콩 목표 대비 매출 실적입니다.</p>
        <a className="source-link" href={krSheetUrl} target="_blank" rel="noreferrer">
          목표 · 실매출 데이터 · 월마감(글로벌)
        </a>
      </section>
      <div className="kpis grid-4">
        <KPI label="이번 달 글로벌 매출" value={money(sale)} note={`${m}월 기준`} />
        <KPI label="이번 달 목표" value={money(target)} />
        <KPI label="목표 달성률" value={`${rate.toFixed(1)}%`} />
        <KPI label="YTD 누계 매출" value={money(ytdSales)} note={`1월~${m}월`} />
      </div>
      <div className="grid">
        <ChartCard
          title="플랫폼별 월별 매출 추이"
          series={channelTrendSeries(sales)}
          kind="line"
          wide
        />
        <section className="card wide">
          <div className="chart-card-head">
            <h3>{`쇼피 일자별 매출 추이 · ${m}월`}</h3>
          </div>
          <p className="detail-caption">
            쇼피만 "일별매출" 시트에 일자별 데이터가 있어 이 표에 표시됩니다. 나머지 플랫폼(예스스타일/올리브영 US/키오키/앳코스메 홍콩)은 월마감에 월별 수치만 있어 아래 상세 표를 참고해주세요.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>쇼피 매출액</th>
                </tr>
              </thead>
              <tbody>
                {(g?.shopeeDaily || []).length ? (
                  g!.shopeeDaily!.map((r) => (
                    <tr key={r.date}>
                      <td>{`${Number(r.date.slice(5, 7))}/${Number(r.date.slice(8, 10))}`}</td>
                      <td>{money(r.sales)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="empty-row">
                      No data returned
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <ChartCard
          title="글로벌 합계 월 목표 vs 실매출"
          series={series(months, [
            { label: "목표", data: monthlyTotalTargets, color: "#dfe0e8" },
            { label: "실매출", data: monthlyTotalSales, color: "#5a4ff3" },
          ])}
        />
        <ChartCard
          title={`${m}월 플랫폼별 목표 vs 실매출`}
          series={series(platforms, [
            {
              label: "목표",
              data: platforms.map((name) => targets[name]?.[m - 1] || 0),
              color: "#dfe0e8",
            },
            {
              label: "실매출",
              data: platforms.map((name) => sales[name]?.[m - 1] || 0),
              color: "#5a4ff3",
            },
          ])}
        />
      </div>
      <section className="card wide detail-table">
        <h3>플랫폼별 월별 목표매출 · 실매출 상세</h3>
        <p className="detail-caption">
          월마감 시트의 "글로벌" 섹션(예스스타일/올리브영 US/키오키/쇼피/앳코스메 홍콩)의 목표·매출액 값입니다. 큐텐은 별도 채널별 매출 추이 차트에서 확인할 수 있습니다.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th rowSpan={2}>월</th>
                {platforms.map((name, i) => (
                  <th key={name} colSpan={3} className={GLOBAL_GROUP_CLASSES[i % GLOBAL_GROUP_CLASSES.length]}>
                    {name}
                  </th>
                ))}
              </tr>
              <tr>
                {platforms.flatMap((name, i) => {
                  const cls = GLOBAL_GROUP_CLASSES[i % GLOBAL_GROUP_CLASSES.length];
                  return [
                    <th key={`${name}-target`} className={cls}>목표</th>,
                    <th key={`${name}-sales`} className={cls}>실매출</th>,
                    <th key={`${name}-rate`} className={cls}>달성률</th>,
                  ];
                })}
              </tr>
            </thead>
            <tbody>
              {months.map((label, i) => (
                <tr key={label}>
                  <td>{label}</td>
                  {platforms.flatMap((name) => {
                    const t = targets[name]?.[i] || 0;
                    const s = sales[name]?.[i] || 0;
                    const r = t ? (s / t) * 100 : 0;
                    return [
                      <td key={`${name}-target`}>{money(t)}</td>,
                      <td key={`${name}-sales`}>{money(s)}</td>,
                      <td key={`${name}-rate`} className={r >= 90 ? "rate-good" : "rate-bad"}>
                        {r.toFixed(1)}%
                      </td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
  const mergedMonthly: Record<string, ProductRow[]> = {};
  monthKeys.forEach((k) => {
    mergedMonthly[k] = sumProductRows(monthly[k] || []);
  });
  const top = sumProductRows(monthKeys.flatMap((k) => monthly[k] || []), 5);
  return {
    trends: {
      labels: months,
      datasets: top.map((p, i) => ({
        label: p.name,
        data: monthKeys.map((k) => mergedMonthly[k].find((row) => row.name === p.name)?.quantity || 0),
        backgroundColor: productChartColors[i % productChartColors.length],
        borderColor: productChartColors[i % productChartColors.length],
      })),
    } as Series,
    monthly: mergedMonthly,
    cumulative: sumProductRows(monthKeys.flatMap((k) => monthly[k] || []), 10),
  };
}
function buildDailyLineSeries(sources: (DailyLineQty | undefined)[], limit = 5): Series | undefined {
  const labels = sources.find((s) => s?.labels?.length)?.labels;
  if (!labels?.length) return undefined;
  const merged: Record<string, number[]> = {};
  sources.forEach((s) => {
    if (!s?.series) return;
    Object.entries(s.series).forEach(([name, data]) => {
      if (!merged[name]) merged[name] = new Array(labels.length).fill(0);
      data.forEach((v, i) => {
        merged[name][i] = (merged[name][i] || 0) + (v || 0);
      });
    });
  });
  const top = Object.entries(merged)
    .map(([name, data]) => ({ name, data, total: data.reduce((a, b) => a + b, 0) }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
  return {
    labels,
    datasets: top.map((t, i) => ({
      label: t.name,
      data: t.data,
      backgroundColor: productChartColors[i % productChartColors.length],
      borderColor: productChartColors[i % productChartColors.length],
    })),
  };
}
// 여러 시장(KR/JP) 소스의 bySku(라인 -> SKU -> 일별 수량)를 라인/SKU 단위로 합산.
// buildDailyLineSeries와 같은 labels을 쓰므로 같은 sources로 같이 호출해야 날짜가 맞는다.
function mergeBySku(sources: (DailyLineQty | undefined)[]): Record<string, Record<string, number[]>> {
  const labels = sources.find((s) => s?.labels?.length)?.labels;
  const merged: Record<string, Record<string, number[]>> = {};
  if (!labels?.length) return merged;
  sources.forEach((s) => {
    if (!s?.bySku) return;
    Object.entries(s.bySku).forEach(([line, skus]) => {
      if (!merged[line]) merged[line] = {};
      Object.entries(skus).forEach(([sku, data]) => {
        if (!merged[line][sku]) merged[line][sku] = new Array(labels.length).fill(0);
        data.forEach((v, i) => {
          merged[line][sku][i] = (merged[line][sku][i] || 0) + (v || 0);
        });
      });
    });
  });
  return merged;
}
// bySku(라인 -> SKU -> 일별 수량)를 라인 구분 없이 SKU 단위로 평평하게 합친다.
// 프로모션 "상품별" 토글처럼 라인 상관없이 SKU를 바로 고를 때 씀.
function flattenBySku(bySku: Record<string, Record<string, number[]>> | undefined): Record<string, number[]> {
  const flat: Record<string, number[]> = {};
  if (!bySku) return flat;
  Object.values(bySku).forEach((skus) => {
    Object.entries(skus).forEach(([sku, data]) => {
      if (!flat[sku]) flat[sku] = new Array(data.length).fill(0);
      data.forEach((v, i) => {
        flat[sku][i] = (flat[sku][i] || 0) + (v || 0);
      });
    });
  });
  return flat;
}
function buildSkuSeries(bySku: Record<string, number[]> | undefined, labels: string[], limit = 10): Series | undefined {
  if (!bySku || !labels.length) return undefined;
  const top = Object.entries(bySku)
    .map(([name, data]) => ({ name, data, total: data.reduce((a, b) => a + b, 0) }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
  return top.length
    ? {
        labels,
        datasets: top.map((t, i) => ({
          label: t.name,
          data: t.data,
          backgroundColor: productChartColors[i % productChartColors.length],
          borderColor: productChartColors[i % productChartColors.length],
        })),
      }
    : undefined;
}
// 월별 상품 순위 카드의 "상품별" 모드용 - bySku(라인 -> SKU -> 일별 수량)를 그 달
// 합계 기준으로 SKU 단위 랭킹으로 펼친다. lineFilter가 "전체"가 아니면 그 라인의
// SKU만 남긴다.
function skuRankRows(bySku: Record<string, Record<string, number[]>>, lineFilter: string) {
  const rows: { line: string; name: string; quantity: number }[] = [];
  Object.entries(bySku).forEach(([line, skus]) => {
    if (lineFilter !== "전체" && line !== lineFilter) return;
    Object.entries(skus).forEach(([sku, data]) => {
      const quantity = data.reduce((a, b) => a + (b || 0), 0);
      if (quantity > 0) rows.push({ line, name: sku, quantity });
    });
  });
  return rows.sort((a, b) => b.quantity - a.quantity);
}
type SkuTotals = Record<string, Record<string, number>>;
// 특정 달의 bySku(라인 -> SKU -> 일별 수량)를 라인/SKU별 합계로 접는다 -
// 누적(연간) 상품별 랭킹은 날짜별 배열이 아니라 총합만 있으면 되기 때문.
function sumBySkuTotals(sources: (DailyLineQty | undefined)[]): SkuTotals {
  const totals: SkuTotals = {};
  sources.forEach((s) => {
    if (!s?.bySku) return;
    Object.entries(s.bySku).forEach(([line, skus]) => {
      if (!totals[line]) totals[line] = {};
      Object.entries(skus).forEach(([sku, data]) => {
        const sum = data.reduce((a, b) => a + (b || 0), 0);
        totals[line][sku] = (totals[line][sku] || 0) + sum;
      });
    });
  });
  return totals;
}
function mergeSkuTotals(sources: (SkuTotals | undefined)[]): SkuTotals {
  const merged: SkuTotals = {};
  sources.forEach((s) => {
    if (!s) return;
    Object.entries(s).forEach(([line, skus]) => {
      if (!merged[line]) merged[line] = {};
      Object.entries(skus).forEach(([sku, qty]) => {
        merged[line][sku] = (merged[line][sku] || 0) + qty;
      });
    });
  });
  return merged;
}
function skuTotalRankRows(totals: SkuTotals, lineFilter: string) {
  const rows: { line: string; name: string; quantity: number }[] = [];
  Object.entries(totals).forEach(([line, skus]) => {
    if (lineFilter !== "전체" && line !== lineFilter) return;
    Object.entries(skus).forEach(([sku, quantity]) => {
      if (quantity > 0) rows.push({ line, name: sku, quantity });
    });
  });
  return rows.sort((a, b) => b.quantity - a.quantity);
}
// 누적 상품 순위의 "상품별" 모드용 - 12개월치 krProductSales/platform을 모두
// 불러와 SKU 단위 연간 합계를 만든다. 월별 API 응답은 lib/api의 캐시를
// 그대로 타므로, 이미 로드된 달(현재 선택된 월 등)은 재요청하지 않는다.
async function fetchYearlyBySku(): Promise<{ KR: SkuTotals; JP: SkuTotals }> {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const perMonth = await Promise.all(
    months.map(async (mo) => {
      const [ks, p] = await Promise.all([
        fetchKrProductSalesData(mo).catch(() => ({})),
        fetchPlatformData(mo).catch(() => ({})),
      ]);
      return {
        krDaily: (ks as { krDailyProductQty?: DailyLineQty })?.krDailyProductQty,
        jpDaily: (p as { jpDailyProductQty?: DailyLineQty })?.jpDailyProductQty,
      };
    }),
  );
  return {
    KR: sumBySkuTotals(perMonth.map((r) => r.krDaily)),
    JP: sumBySkuTotals(perMonth.map((r) => r.jpDaily)),
  };
}
// 라인 -> SKU -> 12개월 수량 배열. "상품별 월간 판매 추이" 차트의 라인 드릴다운
// (그 라인의 SKU별 월간 추이)용 - fetchYearlyBySku와 같은 12개월치 API를 쓰지만,
// 총합으로 접지 않고 월 인덱스를 그대로 살려서 월별 라인 차트에 바로 쓸 수 있게 한다.
type MonthlySkuSeries = Record<string, Record<string, number[]>>;
function sumBySkuMonthly(sources: (DailyLineQty | undefined)[]): MonthlySkuSeries {
  const result: MonthlySkuSeries = {};
  sources.forEach((s, monthIdx) => {
    if (!s?.bySku) return;
    Object.entries(s.bySku).forEach(([line, skus]) => {
      if (!result[line]) result[line] = {};
      Object.entries(skus).forEach(([sku, data]) => {
        if (!result[line][sku]) result[line][sku] = new Array(12).fill(0);
        result[line][sku][monthIdx] += data.reduce((a, b) => a + (b || 0), 0);
      });
    });
  });
  return result;
}
async function fetchYearlyBySkuMonthly(): Promise<{ KR: MonthlySkuSeries; JP: MonthlySkuSeries }> {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const perMonth = await Promise.all(
    months.map(async (mo) => {
      const [ks, p] = await Promise.all([
        fetchKrProductSalesData(mo).catch(() => ({})),
        fetchPlatformData(mo).catch(() => ({})),
      ]);
      return {
        krDaily: (ks as { krDailyProductQty?: DailyLineQty })?.krDailyProductQty,
        jpDaily: (p as { jpDailyProductQty?: DailyLineQty })?.jpDailyProductQty,
      };
    }),
  );
  return {
    KR: sumBySkuMonthly(perMonth.map((r) => r.krDaily)),
    JP: sumBySkuMonthly(perMonth.map((r) => r.jpDaily)),
  };
}
function mergeMonthlySkuSeries(sources: (MonthlySkuSeries | undefined)[]): MonthlySkuSeries {
  const merged: MonthlySkuSeries = {};
  sources.forEach((s) => {
    if (!s) return;
    Object.entries(s).forEach(([line, skus]) => {
      if (!merged[line]) merged[line] = {};
      Object.entries(skus).forEach(([sku, data]) => {
        if (!merged[line][sku]) merged[line][sku] = new Array(12).fill(0);
        data.forEach((v, i) => {
          merged[line][sku][i] = (merged[line][sku][i] || 0) + (v || 0);
        });
      });
    });
  });
  return merged;
}
function Product({ d, m }: { d: DashboardData | null; m: number }) {
  const [market, setMarket] = useState<"TOTAL" | "KR" | "JP">("TOTAL");
  const fallbackMonthly = useMemo(
    () => ({
      KR: krSheetData.lineQuantityProducts as Record<string, ProductRow[]>,
      JP: jpSheetData.products as Record<string, ProductRow[]>,
    }),
    [],
  );
  const hasRows = (rows?: Record<string, ProductRow[]>) =>
    !!rows && Object.values(rows).some((v) => v?.length);

  const krMonthly = hasRows(d?.product?.KR?.monthly) ? d!.product!.KR!.monthly! : fallbackMonthly.KR;
  const jpMonthly = hasRows(d?.product?.JP?.monthly) ? d!.product!.JP!.monthly! : fallbackMonthly.JP;
  const monthKeys = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const totalMonthly: Record<string, ProductRow[]> = {};
  monthKeys.forEach((k) => {
    totalMonthly[k] = [...(krMonthly[k] || []), ...(jpMonthly[k] || [])];
  });
  const monthlyByMarket = { KR: krMonthly, JP: jpMonthly, TOTAL: totalMonthly };
  const x = buildProductMarketData(monthlyByMarket[market]);
  const productDataByMarket = {
    TOTAL: buildProductMarketData(totalMonthly),
    KR: buildProductMarketData(krMonthly),
    JP: buildProductMarketData(jpMonthly),
  };
  const [top10ChartMarket, setTop10ChartMarket] = useState<"TOTAL" | "KR" | "JP">("TOTAL");
  const [cumulativeChartMarket, setCumulativeChartMarket] = useState<"TOTAL" | "KR" | "JP">("TOTAL");
  const [top10TableMarket, setTop10TableMarket] = useState<"TOTAL" | "KR" | "JP">("TOTAL");
  const [cumulativeTableMarket, setCumulativeTableMarket] = useState<"TOTAL" | "KR" | "JP">("TOTAL");
  const [top10TableLineFilter, setTop10TableLineFilter] = useState<Set<string> | null>(null);
  const [top10TableProductFilter, setTop10TableProductFilter] = useState<Set<string> | null>(null);
  const [top10TableMode, setTop10TableMode] = useState<"라인별" | "상품별">("라인별");
  const [cumulativeTableMode, setCumulativeTableMode] = useState<"라인별" | "상품별">("라인별");
  const [cumulativeTableLineFilter, setCumulativeTableLineFilter] = useState<Set<string> | null>(null);
  const [cumulativeTableProductFilter, setCumulativeTableProductFilter] = useState<Set<string> | null>(null);
  const [cumulativeSkuData, setCumulativeSkuData] = useState<{ KR: SkuTotals; JP: SkuTotals } | null>(null);
  const [cumulativeSkuLoading, setCumulativeSkuLoading] = useState(false);
  useEffect(() => {
    if (cumulativeTableMode !== "상품별" || cumulativeSkuData || cumulativeSkuLoading) return;
    setCumulativeSkuLoading(true);
    fetchYearlyBySku()
      .then(setCumulativeSkuData)
      .finally(() => setCumulativeSkuLoading(false));
  }, [cumulativeTableMode, cumulativeSkuData, cumulativeSkuLoading]);
  const [monthlyDrilldownLine, setMonthlyDrilldownLine] = useState<string | null>(null);
  const [monthlySkuData, setMonthlySkuData] = useState<{ KR: MonthlySkuSeries; JP: MonthlySkuSeries } | null>(null);
  const [monthlySkuLoading, setMonthlySkuLoading] = useState(false);
  useEffect(() => {
    if (!monthlyDrilldownLine || monthlySkuData || monthlySkuLoading) return;
    setMonthlySkuLoading(true);
    fetchYearlyBySkuMonthly()
      .then(setMonthlySkuData)
      .finally(() => setMonthlySkuLoading(false));
  }, [monthlyDrilldownLine, monthlySkuData, monthlySkuLoading]);
  const marketMiniTabs = (value: "TOTAL" | "KR" | "JP", onChange: (v: "TOTAL" | "KR" | "JP") => void) => (
    <div className="mini-tabs">
      {(["TOTAL", "KR", "JP"] as const).map((v) => (
        <button key={v} className={value === v ? "active" : ""} onClick={() => onChange(v)}>
          {v}
        </button>
      ))}
    </div>
  );

  const krDaily = d?.kr?.dailyProductQty;
  const jpDaily = d?.jp?.dailyProductQty;
  const dailySources = market === "KR" ? [krDaily] : market === "JP" ? [jpDaily] : [krDaily, jpDaily];
  const dailyQty = buildDailyLineSeries(dailySources);
  const [drilldownLine, setDrilldownLine] = useState<string | null>(null);
  const dailyBySku = mergeBySku(dailySources);
  const skuSeries = drilldownLine ? buildSkuSeries(dailyBySku[drilldownLine], dailyQty?.labels || []) : undefined;

  const monthlySkuSources =
    market === "KR" ? [monthlySkuData?.KR] : market === "JP" ? [monthlySkuData?.JP] : [monthlySkuData?.KR, monthlySkuData?.JP];
  const monthlyBySku = mergeMonthlySkuSeries(monthlySkuSources);
  const monthlySkuSeries = monthlyDrilldownLine
    ? buildSkuSeries(monthlyBySku[monthlyDrilldownLine], months)
    : undefined;

  const top10TableDailySources =
    top10TableMarket === "KR" ? [krDaily] : top10TableMarket === "JP" ? [jpDaily] : [krDaily, jpDaily];
  const top10TableBySku = mergeBySku(top10TableDailySources);
  const top10TableAllRows = skuRankRows(top10TableBySku, "전체");
  const top10TableLineOptions = Array.from(new Set(top10TableAllRows.map((r) => r.line))).sort();
  const top10TableRowsAfterLine = top10TableLineFilter
    ? top10TableAllRows.filter((r) => top10TableLineFilter.has(r.line))
    : top10TableAllRows;
  const top10TableProductOptions = Array.from(new Set(top10TableRowsAfterLine.map((r) => r.name))).sort();
  const top10TableRowsAfterProduct = top10TableProductFilter
    ? top10TableRowsAfterLine.filter((r) => top10TableProductFilter.has(r.name))
    : top10TableRowsAfterLine;
  const top10TableRows = top10TableRowsAfterProduct.map((v, i) => ({
    rank: i + 1,
    line: v.line,
    product: v.name,
    quantity: v.quantity,
  }));

  const cumulativeTableSkuTotals =
    cumulativeTableMarket === "KR"
      ? cumulativeSkuData?.KR
      : cumulativeTableMarket === "JP"
        ? cumulativeSkuData?.JP
        : mergeSkuTotals([cumulativeSkuData?.KR, cumulativeSkuData?.JP]);
  const cumulativeTableAllRows = skuTotalRankRows(cumulativeTableSkuTotals || {}, "전체");
  const cumulativeTableLineOptions = Array.from(new Set(cumulativeTableAllRows.map((r) => r.line))).sort();
  const cumulativeTableRowsAfterLine = cumulativeTableLineFilter
    ? cumulativeTableAllRows.filter((r) => cumulativeTableLineFilter.has(r.line))
    : cumulativeTableAllRows;
  const cumulativeTableProductOptions = Array.from(new Set(cumulativeTableRowsAfterLine.map((r) => r.name))).sort();
  const cumulativeTableRowsAfterProduct = cumulativeTableProductFilter
    ? cumulativeTableRowsAfterLine.filter((r) => cumulativeTableProductFilter.has(r.name))
    : cumulativeTableRowsAfterLine;
  const cumulativeTableRows = cumulativeTableRowsAfterProduct.map((v, i) => ({
    rank: i + 1,
    line: v.line,
    product: v.name,
    quantity: v.quantity,
  }));

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
              onClick={() => {
                setMarket(v);
                setDrilldownLine(null);
                setMonthlyDrilldownLine(null);
              }}
              key={v}
            >
              {v}
            </button>
          ))}
        </div>
      </section>
      <div className="grid">
        <DrilldownLineChart
          title={
            monthlyDrilldownLine
              ? `${monthlyDrilldownLine} · SKU별 월간 판매 추이 · 1월~12월${monthlySkuLoading ? " (불러오는 중...)" : ""}`
              : "상품별 월간 판매 추이 · 1월~12월"
          }
          series={monthlyDrilldownLine ? monthlySkuSeries : x?.trends}
          onLegendClick={monthlyDrilldownLine ? undefined : (label) => setMonthlyDrilldownLine(label)}
          actions={
            monthlyDrilldownLine ? (
              <button className="drilldown-back" onClick={() => setMonthlyDrilldownLine(null)}>
                ← 전체 라인 보기
              </button>
            ) : undefined
          }
          wide
        />
        <DrilldownLineChart
          title={drilldownLine ? `${m}월 ${drilldownLine} · SKU별 일간 판매 추이` : `${m}월 일간 판매 추이`}
          series={drilldownLine ? skuSeries : dailyQty}
          onLegendClick={drilldownLine ? undefined : (label) => setDrilldownLine(label)}
          actions={
            drilldownLine ? (
              <button className="drilldown-back" onClick={() => setDrilldownLine(null)}>
                ← 전체 카테고리 보기
              </button>
            ) : undefined
          }
          wide
        />
        <ChartCard
          title={`${m}월 판매량 TOP 10`}
          series={productSeries(productDataByMarket[top10ChartMarket]?.monthly?.[String(m)])}
          actions={marketMiniTabs(top10ChartMarket, setTop10ChartMarket)}
        />
        <ChartCard
          title="누적 판매량 TOP 10 · 1월~12월"
          series={productSeries(productDataByMarket[cumulativeChartMarket]?.cumulative)}
          actions={marketMiniTabs(cumulativeChartMarket, setCumulativeChartMarket)}
        />
        {top10TableMode === "라인별" ? (
          <DataTable
            title={`${m}월 상품 순위`}
            rows={productDataByMarket[top10TableMarket]?.monthly?.[String(m)]?.map((v, i) => ({
              rank: i + 1,
              product: v.name,
              quantity: v.quantity,
            }))}
            actions={
              <div className="rank-controls">
                {marketMiniTabs(top10TableMarket, setTop10TableMarket)}
                <div className="mini-tabs">
                  {(["라인별", "상품별"] as const).map((v) => (
                    <button key={v} className={top10TableMode === v ? "active" : ""} onClick={() => setTop10TableMode(v)}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            }
          />
        ) : (
          <ProductRankTable
            title={`${m}월 상품 순위`}
            rows={top10TableRows}
            actions={
              <div className="rank-controls">
                {marketMiniTabs(top10TableMarket, (v) => {
                  setTop10TableMarket(v);
                  setTop10TableLineFilter(null);
                  setTop10TableProductFilter(null);
                })}
                <div className="mini-tabs">
                  {(["라인별", "상품별"] as const).map((v) => (
                    <button key={v} className={top10TableMode === v ? "active" : ""} onClick={() => setTop10TableMode(v)}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            }
            lineOptions={top10TableLineOptions}
            lineSelected={top10TableLineFilter}
            onLineChange={setTop10TableLineFilter}
            productOptions={top10TableProductOptions}
            productSelected={top10TableProductFilter}
            onProductChange={setTop10TableProductFilter}
          />
        )}
        {cumulativeTableMode === "라인별" ? (
          <DataTable
            title="누적 상품 순위"
            rows={productDataByMarket[cumulativeTableMarket]?.cumulative?.map((v, i) => ({
              rank: i + 1,
              product: v.name,
              quantity: v.quantity,
            }))}
            actions={
              <div className="rank-controls">
                {marketMiniTabs(cumulativeTableMarket, setCumulativeTableMarket)}
                <div className="mini-tabs">
                  {(["라인별", "상품별"] as const).map((v) => (
                    <button
                      key={v}
                      className={cumulativeTableMode === v ? "active" : ""}
                      onClick={() => setCumulativeTableMode(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            }
          />
        ) : (
          <ProductRankTable
            title="누적 상품 순위"
            rows={cumulativeTableRows}
            loading={cumulativeSkuLoading && !cumulativeSkuData}
            actions={
              <div className="rank-controls">
                {marketMiniTabs(cumulativeTableMarket, (v) => {
                  setCumulativeTableMarket(v);
                  setCumulativeTableLineFilter(null);
                  setCumulativeTableProductFilter(null);
                })}
                <div className="mini-tabs">
                  {(["라인별", "상품별"] as const).map((v) => (
                    <button
                      key={v}
                      className={cumulativeTableMode === v ? "active" : ""}
                      onClick={() => setCumulativeTableMode(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            }
            lineOptions={cumulativeTableLineOptions}
            lineSelected={cumulativeTableLineFilter}
            onLineChange={setCumulativeTableLineFilter}
            productOptions={cumulativeTableProductOptions}
            productSelected={cumulativeTableProductFilter}
            onProductChange={setCumulativeTableProductFilter}
          />
        )}
      </div>
    </>
  );
}
// JP Executive의 "일별 KPI 추이" 차트와 같은 모양 - 유입자수/장바구니/주문완료를
// 기본 축에, 주문전환율(%)을 보조축(y1)에 그린다. 프로모션 기간의 일별 전환지표용.
function dailyFunnelSeries(rows?: DailyFunnelRow[]): Series | undefined {
  if (!rows?.length) return undefined;
  return {
    labels: rows.map((r) => `${Number(r.date.slice(5, 7))}/${Number(r.date.slice(8, 10))}`),
    datasets: [
      { label: "유입자수", data: rows.map((r) => r.traffic), borderColor: "#5a4ff3", backgroundColor: "#5a4ff3" },
      { label: "장바구니", data: rows.map((r) => r.cart), borderColor: "#24b47e", backgroundColor: "#24b47e" },
      { label: "주문완료", data: rows.map((r) => r.orders), borderColor: "#f5a623", backgroundColor: "#f5a623" },
      {
        label: "주문전환율(%)",
        data: rows.map((r) => r.conversionRate),
        borderColor: "#ef4c8b",
        backgroundColor: "#ef4c8b",
        yAxisID: "y1",
      },
    ],
  };
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
  // 분기/월 선택 토글 - 캠페인 테이블 순서(=시트 순서, 시간순)대로 그룹
  // 라벨(1Q/2Q/3Q, 월 번호)을 뽑아 목록으로 쓰고, 기본값은 최신 기간.
  const megawariGroups = megawari.map((c) => c.group);
  const megapoGroups = megapo.map((c) => c.group);
  // 분기/월 버튼을 여러 개 동시에 선택할 수 있게 Set으로 관리한다 - 하나만
  // 고르면 지금처럼 실제 날짜를 보여주고, 여러 개 고르면 day1/day2/...
  // 축으로 겹쳐 그려 기간끼리 비교할 수 있게 한다. 아무것도 안 골랐을 땐
  // 최신 기간 하나가 기본으로 선택된 걸로 친다.
  const [megawariGroupSel, setMegawariGroupSel] = useState<Set<string>>(new Set());
  const [megapoGroupSel, setMegapoGroupSel] = useState<Set<string>>(new Set());
  const megawariSelectedGroups = megawariGroups.filter((g) =>
    megawariGroupSel.size ? megawariGroupSel.has(g) : g === megawariGroups[megawariGroups.length - 1],
  );
  const megapoSelectedGroups = megapoGroups.filter((g) =>
    megapoGroupSel.size ? megapoGroupSel.has(g) : g === megapoGroups[megapoGroups.length - 1],
  );
  const toggleGroup = (groups: string[], setSel: (fn: (prev: Set<string>) => Set<string>) => void, g: string) => {
    setSel((prev) => {
      const list = prev.size ? groups.filter((x) => prev.has(x)) : [groups[groups.length - 1]];
      const next = new Set(list);
      if (next.has(g)) {
        if (next.size > 1) next.delete(g); // 마지막 하나는 선택 해제 못 하게 - 항상 1개 이상 유지
      } else {
        next.add(g);
      }
      return next;
    });
  };
  // 전환지표 카드와, 상품별 판매 추이가 단일 기간일 때는 "가장 최근에 선택된
  // 기간" 하나만 쓴다.
  const megawariActiveGroup = megawariSelectedGroups[megawariSelectedGroups.length - 1];
  const megapoActiveGroup = megapoSelectedGroups[megapoSelectedGroups.length - 1];
  // byPeriod가 아직 없는 캐시(배포 직후 등)에서만 예전 필드(최신 기간 전용)로
  // 대체한다 - byPeriod가 있는데 특정 그룹만 없는 경우(시트에 "7/-7/9"처럼
  // 파싱 안 되는 기간이 섞여 있는 경우)는 다른 기간 데이터로 잘못 대체하지
  // 않고 그냥 데이터 없음으로 보여준다.
  const hasMegawariByPeriod = !!api?.megawariByPeriod && Object.keys(api.megawariByPeriod).length > 0;
  const hasMegapoByPeriod = !!api?.megapoByPeriod && Object.keys(api.megapoByPeriod).length > 0;
  const megawariPeriodData = hasMegawariByPeriod ? api?.megawariByPeriod?.[megawariActiveGroup] : undefined;
  const megapoPeriodData = hasMegapoByPeriod ? api?.megapoByPeriod?.[megapoActiveGroup] : undefined;
  const megawariPeriodLabel =
    megawariPeriodData?.period ??
    (hasMegawariByPeriod ? megawari.find((c) => c.group === megawariActiveGroup)?.period : api?.megawariPeriod);
  const megapoPeriodLabel =
    megapoPeriodData?.period ??
    (hasMegapoByPeriod ? megapo.find((c) => c.group === megapoActiveGroup)?.period : api?.megapoPeriod);
  const megawariDailyFunnel = dailyFunnelSeries(
    hasMegawariByPeriod ? megawariPeriodData?.dailyFunnel : api?.megawariDailyFunnel,
  );
  const megapoDailyFunnel = dailyFunnelSeries(hasMegapoByPeriod ? megapoPeriodData?.dailyFunnel : api?.megapoDailyFunnel);
  const periodTabs = (groups: string[], selected: string[], onToggle: (g: string) => void) => (
    <div className="mini-tabs">
      {groups.map((g) => (
        <button key={g} className={selected.includes(g) ? "active" : ""} onClick={() => onToggle(g)}>
          {g}
        </button>
      ))}
    </div>
  );
  // 일별 상품별 판매 추이의 라인별/상품별 토글 + 라인·상품 선택 드롭다운.
  // "전체"면 상위 항목(또는 여러 기간 비교 땐 전체 합계)을, 하나를 고르면
  // 그 라인/상품만 뽑아서 보여준다. 기간을 2개 이상 고른 경우엔 day1/day2/
  // ... 축으로 기간마다 한 줄씩 겹쳐 그린다(기간마다 실제 날짜가 달라 같은
  // 축에 놓을 수 없으므로 캠페인 경과일로 맞춘다 - "일별 매출 비교"와 같은 방식).
  const [megawariTrendMode, setMegawariTrendMode] = useState<"라인별" | "상품별">("라인별");
  const [megawariTrendSel, setMegawariTrendSel] = useState("전체");
  const [megapoTrendMode, setMegapoTrendMode] = useState<"라인별" | "상품별">("라인별");
  const [megapoTrendSel, setMegapoTrendSel] = useState("전체");
  const productTrendChart = (
    byPeriod: Record<string, { period: string; productDaily: DailyLineQty; dailyFunnel: DailyFunnelRow[] }> | undefined,
    hasByPeriod: boolean,
    fallbackRaw: DailyLineQty | undefined,
    selectedGroups: string[],
    mode: "라인별" | "상품별",
    setMode: (v: "라인별" | "상품별") => void,
    sel: string,
    setSel: (v: string) => void,
  ) => {
    const sources: DailyLineQty[] = hasByPeriod
      ? (selectedGroups.map((g) => byPeriod?.[g]?.productDaily).filter(Boolean) as DailyLineQty[])
      : fallbackRaw
        ? [fallbackRaw]
        : [];
    const lineOptionSet = new Set<string>();
    const skuOptionSet = new Set<string>();
    sources.forEach((s) => {
      Object.keys(s.series || {}).forEach((l) => lineOptionSet.add(l));
      Object.keys(flattenBySku(s.bySku)).forEach((p) => skuOptionSet.add(p));
    });
    const lineOptions = Array.from(lineOptionSet).sort();
    const skuOptions = Array.from(skuOptionSet).sort();
    const options = mode === "라인별" ? lineOptions : skuOptions;
    const effSel = options.includes(sel) ? sel : "전체";

    let series: Series | undefined;
    if (selectedGroups.length <= 1) {
      const raw = hasByPeriod ? byPeriod?.[selectedGroups[0]]?.productDaily : fallbackRaw;
      const labels = raw?.labels || [];
      const skuFlat = flattenBySku(raw?.bySku);
      const source = mode === "라인별" ? raw?.series : skuFlat;
      series =
        effSel === "전체"
          ? buildSkuSeries(source, labels, 5)
          : buildSkuSeries(source ? { [effSel]: source[effSel] || [] } : undefined, labels, 1);
    } else {
      const perGroup = selectedGroups.map((g) => {
        const pd = byPeriod?.[g]?.productDaily;
        const skuFlat = flattenBySku(pd?.bySku);
        const source = mode === "라인별" ? pd?.series : skuFlat;
        let data: number[];
        if (effSel === "전체") {
          data = new Array(pd?.labels.length || 0).fill(0);
          Object.values(source || {}).forEach((arr) => arr.forEach((v, i) => (data[i] += v || 0)));
        } else {
          data = source?.[effSel] || [];
        }
        return { g, period: byPeriod?.[g]?.period || "", data };
      });
      const maxLen = Math.max(0, ...perGroup.map((p) => p.data.length));
      series = maxLen
        ? {
            labels: Array.from({ length: maxLen }, (_, i) => `day${i + 1}`),
            datasets: perGroup.map((p, i) => ({
              label: `${p.g} · ${p.period}`,
              data: p.data,
              borderColor: productChartColors[i % productChartColors.length],
              backgroundColor: productChartColors[i % productChartColors.length],
            })),
          }
        : undefined;
    }

    const controls = (
      <>
        <div className="mini-tabs">
          {(["라인별", "상품별"] as const).map((v) => (
            <button
              key={v}
              className={mode === v ? "active" : ""}
              onClick={() => {
                setMode(v);
                setSel("전체");
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <select className="rank-line-select" value={effSel} onChange={(e) => setSel(e.target.value)}>
          <option value="전체">전체</option>
          {options.map((o) => (
            <option value={o} key={o}>
              {o}
            </option>
          ))}
        </select>
      </>
    );
    return { series, controls };
  };
  const megawariTrend = productTrendChart(
    api?.megawariByPeriod,
    hasMegawariByPeriod,
    api?.megawariProductDaily,
    megawariSelectedGroups,
    megawariTrendMode,
    setMegawariTrendMode,
    megawariTrendSel,
    setMegawariTrendSel,
  );
  const megapoTrend = productTrendChart(
    api?.megapoByPeriod,
    hasMegapoByPeriod,
    api?.megapoProductDaily,
    megapoSelectedGroups,
    megapoTrendMode,
    setMegapoTrendMode,
    megapoTrendSel,
    setMegapoTrendSel,
  );
  const megawariTrendTitle =
    megawariSelectedGroups.length > 1
      ? ` · ${megawariSelectedGroups.length}개 기간 비교`
      : megawariPeriodLabel
        ? ` · ${megawariPeriodLabel}`
        : "";
  const megapoTrendTitle =
    megapoSelectedGroups.length > 1
      ? ` · ${megapoSelectedGroups.length}개 기간 비교`
      : megapoPeriodLabel
        ? ` · ${megapoPeriodLabel}`
        : "";
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
          title="MEGAWARI 일별 매출 비교"
          series={p?.megawariDaily}
          kind="line"
        />
        <ChartCard
          title="MEGAPO 일별 매출 비교"
          series={p?.megapoDaily}
          kind="line"
        />
        <ChartCard
          title={`MEGAWARI 일별 상품별 판매 추이${megawariTrendTitle}`}
          series={megawariTrend.series}
          kind="line"
          actions={
            <div className="rank-controls">
              {megawariGroups.length > 1
                ? periodTabs(megawariGroups, megawariSelectedGroups, (g) =>
                    toggleGroup(megawariGroups, setMegawariGroupSel, g),
                  )
                : null}
              {megawariTrend.controls}
            </div>
          }
        />
        <ChartCard
          title={`MEGAPO 일별 상품별 판매 추이${megapoTrendTitle}`}
          series={megapoTrend.series}
          kind="line"
          actions={
            <div className="rank-controls">
              {megapoGroups.length > 1
                ? periodTabs(megapoGroups, megapoSelectedGroups, (g) => toggleGroup(megapoGroups, setMegapoGroupSel, g))
                : null}
              {megapoTrend.controls}
            </div>
          }
        />
        <ChartCard
          title={`MEGAWARI 일별 전환지표${megawariPeriodLabel ? ` · ${megawariPeriodLabel}` : ""}`}
          series={megawariDailyFunnel}
          kind="line"
        />
        <ChartCard
          title={`MEGAPO 일별 전환지표${megapoPeriodLabel ? ` · ${megapoPeriodLabel}` : ""}`}
          series={megapoDailyFunnel}
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
const CHANNEL_COLORS = [
  "#5a4ff3", "#24b47e", "#f5a623", "#ef4c8b", "#00b8d9",
  "#8777d9", "#ff7452", "#36b37e", "#ffab00", "#6554c0",
  "#00c7e6", "#de350b",
];
function channelTrendSeries(channelRevenue?: Record<string, number[]>): Series | undefined {
  if (!channelRevenue) return undefined;
  const names = Object.keys(channelRevenue)
    .filter((name) => channelRevenue[name]?.some((v) => v > 0))
    .sort((a, b) => {
      const total = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
      return total(channelRevenue[b]) - total(channelRevenue[a]);
    });
  return names.length
    ? series(
        months,
        names.map((name, i) => ({
          label: name,
          data: channelRevenue[name],
          color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
        })),
      )
    : undefined;
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
