import type { Series } from "../types";

export type Campaign = { period: string; group: string; sales: number[] };

const colors = ["#5a4ff3", "#ef4c8b", "#24b47e", "#f5a623"];

export const buildDailySeries = (campaigns: Campaign[], maxDays: number): Series => ({
  labels: Array.from({ length: maxDays }, (_, index) => `day${index + 1}`),
  datasets: campaigns.map((campaign, index) => ({
    label: `${campaign.group} · ${campaign.period}`,
    data: campaign.sales,
    borderColor: colors[index % colors.length],
    backgroundColor: colors[index % colors.length],
  })),
});

export const buildTotals = (campaigns: Campaign[], color: string): Series => ({
  labels: campaigns.map((campaign) => campaign.group),
  datasets: [{
    label: "TOTAL",
    data: campaigns.map((campaign) => campaign.sales.reduce((sum, sales) => sum + sales, 0)),
    backgroundColor: color,
  }],
});

export const buildDayColumnRows = (
  campaigns: Campaign[],
  groupLabel: "분기" | "월",
) => {
  const maxDays = Math.max(0, ...campaigns.map((campaign) => campaign.sales.length));
  const totals = campaigns.map((campaign) =>
    campaign.sales.reduce((sum, sales) => sum + sales, 0),
  );
  return campaigns.map((campaign, campaignIndex) => {
    const previousTotal = totals[campaignIndex - 1];
    const change = previousTotal
      ? Math.round(((totals[campaignIndex] - previousTotal) / previousTotal) * 100)
      : null;
    return {
      [groupLabel]: campaign.group,
      기간: campaign.period,
      ...Object.fromEntries(
        Array.from({ length: maxDays }, (_, index) => [
          `day${index + 1}`,
          campaign.sales[index]?.toLocaleString("ko-KR") ?? "—",
        ]),
      ),
      총매출: totals[campaignIndex].toLocaleString("ko-KR"),
      "증감도(QoQ)": change === null ? "—" : `${change > 0 ? "+" : ""}${change}%${campaign.group.includes("진행 중") ? " · 진행 중" : ""}`,
    };
  });
};

export const promotionSheetUrl = "https://docs.google.com/spreadsheets/d/148j3X9VwT3tJbba-0WBDeow72DrWYWdKPq4VxtNff28/edit?gid=1878315571#gid=1878315571";

export const megawariCampaigns: Campaign[] = [
  { period: "2/27~3/11", group: "1Q", sales: [640033, 963247, 979279, 566210, 620558, 475060, 385530, 378394, 703217, 649883, 412938, 487914, 1353544] },
  { period: "5/29~6/10", group: "2Q", sales: [662213, 561842, 360898, 579984, 590518, 680904, 504194, 424948, 523900, 317418, 299322, 306552, 930686] },
  { period: "8/28~9/9", group: "3Q · 진행 중", sales: [2460555, 1510652, 598744] },
];

export const megapoCampaigns: Campaign[] = [
  { period: "1/1~1/7", group: "1월", sales: [54240, 43976, 38379, 33132, 32648, 37400, 57111] },
  { period: "2/1~2/9", group: "2월", sales: [252961, 92166, 112349, 94460, 107650, 127585, 177586, 109848, 138044] },
  { period: "4/1~4/9", group: "4월", sales: [137062, 110909, 58839, 129815, 51294, 82333, 31716, 53262, 68873] },
  { period: "5/1~5/9", group: "5월", sales: [230590, 120804, 76095, 101260, 146438, 132198, 89798, 60795, 139535] },
  { period: "7/1~7/9", group: "7월", sales: [257096, 147373, 120574, 94318, 160677, 93951, 114329, 72246, 120579] },
  { period: "8/1~8/9", group: "8월", sales: [163923, 59682, 83415, 53622, 63710, 67944, 75062, 65090, 97520] },
];

export const promotionSheetData = {
  megawariDaily: buildDailySeries(megawariCampaigns, 13),
  megapoDaily: buildDailySeries(megapoCampaigns, 9),
  megawariTotals: buildTotals(megawariCampaigns, "#5a4ff3"),
  megapoTotals: buildTotals(megapoCampaigns, "#ef4c8b"),
  megawariDayColumnRows: buildDayColumnRows(megawariCampaigns, "분기"),
  megapoDayColumnRows: buildDayColumnRows(megapoCampaigns, "월"),
};
