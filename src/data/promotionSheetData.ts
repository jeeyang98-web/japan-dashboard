import type { Series } from "../types";

const colors = ["#5a4ff3", "#ef4c8b", "#24b47e", "#f5a623"];
const dailySeries = (labels: string[], rows: { label: string; data: number[] }[]): Series => ({
  labels,
  datasets: rows.map((row, index) => ({
    ...row,
    borderColor: colors[index % colors.length],
    backgroundColor: colors[index % colors.length],
  })),
});

const dayColumnRows = (
  campaigns: { period: string; group: string; startMonth: number; startDay: number; sales: number[] }[],
  groupLabel: "분기" | "월",
  maxDays: number,
) => {
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

export const promotionSheetData = {
  megawariDaily: dailySeries(Array.from({ length: 13 }, (_, index) => `day${index + 1}`), [
    { label: "1Q · 2/27~3/11", data: [640033, 963247, 979279, 566210, 620558, 475060, 385530, 378394, 703217, 649883, 412938, 487914, 1353544] },
    { label: "2Q · 5/29~6/10", data: [662213, 561842, 360898, 579984, 590518, 680904, 504194, 424948, 523900, 317418, 299322, 306552, 930686] },
    { label: "3Q · 8/28~9/9 (진행 중)", data: [2460555, 1266118] },
  ]),
  megapoDaily: dailySeries(Array.from({ length: 9 }, (_, index) => `day${index + 1}`), [
    { label: "1월 · 1/1~1/7", data: [54240, 43976, 38379, 33132, 32648, 37400, 57111] },
    { label: "2월 · 2/1~2/9", data: [252961, 92166, 112349, 94460, 107650, 127585, 177586, 109848, 138044] },
    { label: "4월 · 4/1~4/9", data: [137062, 110909, 58839, 129815, 51294, 82333, 31716, 53262, 68873] },
    { label: "5월 · 5/1~5/9", data: [230590, 120804, 76095, 101260, 146438, 132198, 89798, 60795, 139535] },
    { label: "7월 · 7/1~7/9", data: [257096, 147373, 120574, 94318, 160677, 93951, 114329, 72246, 120579] },
    { label: "8월 · 8/1~8/9", data: [163923, 59682, 83415, 53622, 63710, 67944, 75062, 65090, 97520] },
  ]),
  megawariTotals: {
    labels: ["1Q", "2Q", "3Q · 2일 누적"],
    datasets: [{ label: "TOTAL", data: [8615807, 6743379, 3726673], backgroundColor: "#5a4ff3" }],
  } satisfies Series,
  megapoTotals: {
    labels: ["1월", "2월", "4월", "5월", "7월", "8월"],
    datasets: [{ label: "TOTAL", data: [296886, 1212649, 724103, 1097513, 1181143, 729968], backgroundColor: "#ef4c8b" }],
  } satisfies Series,
  megawariDayColumnRows: dayColumnRows([
    { period: "2/27~3/11", group: "1Q", startMonth: 2, startDay: 27, sales: [640033, 963247, 979279, 566210, 620558, 475060, 385530, 378394, 703217, 649883, 412938, 487914, 1353544] },
    { period: "5/29~6/10", group: "2Q", startMonth: 5, startDay: 29, sales: [662213, 561842, 360898, 579984, 590518, 680904, 504194, 424948, 523900, 317418, 299322, 306552, 930686] },
    { period: "8/28~9/9", group: "3Q · 진행 중", startMonth: 8, startDay: 28, sales: [2460555, 1266118] },
  ], "분기", 13),
  megapoDayColumnRows: dayColumnRows([
    { period: "1/1~1/7", group: "1월", startMonth: 1, startDay: 1, sales: [54240, 43976, 38379, 33132, 32648, 37400, 57111] },
    { period: "2/1~2/9", group: "2월", startMonth: 2, startDay: 1, sales: [252961, 92166, 112349, 94460, 107650, 127585, 177586, 109848, 138044] },
    { period: "4/1~4/9", group: "4월", startMonth: 4, startDay: 1, sales: [137062, 110909, 58839, 129815, 51294, 82333, 31716, 53262, 68873] },
    { period: "5/1~5/9", group: "5월", startMonth: 5, startDay: 1, sales: [230590, 120804, 76095, 101260, 146438, 132198, 89798, 60795, 139535] },
    { period: "7/1~7/9", group: "7월", startMonth: 7, startDay: 1, sales: [257096, 147373, 120574, 94318, 160677, 93951, 114329, 72246, 120579] },
    { period: "8/1~8/9", group: "8월", startMonth: 8, startDay: 1, sales: [163923, 59682, 83415, 53622, 63710, 67944, 75062, 65090, 97520] },
  ], "월", 9),
  megawariSummary: [
    { 기간: "2/27~3/11", 구분: "1Q", 총매출: "8,615,807", QoQ: "—" },
    { 기간: "5/29~6/10", 구분: "2Q", 총매출: "6,743,379", QoQ: "-22%" },
    { 기간: "8/28~9/9", 구분: "3Q", 총매출: "3,726,673 (2일 누적)", QoQ: "진행 중" },
    { 기간: "11/21~12/3", 구분: "4Q", 총매출: "—", QoQ: "예정" },
  ],
  megapoSummary: [
    { 기간: "1/1~1/7", 월: "1월", 총매출: "296,886", QoQ: "—", 비고: "신년세일" },
    { 기간: "2/1~2/9", 월: "2월", 총매출: "1,212,649", QoQ: "308%", 비고: "" },
    { 기간: "4/1~4/9", 월: "4월", 총매출: "724,103", QoQ: "-40%", 비고: "" },
    { 기간: "5/1~5/9", 월: "5월", 총매출: "1,097,513", QoQ: "52%", 비고: "" },
    { 기간: "7/1~7/9", 월: "7월", 총매출: "1,181,143", QoQ: "8%", 비고: "" },
    { 기간: "8/1~8/9", 월: "8월", 총매출: "729,968", QoQ: "-38%", 비고: "" },
  ],
};
