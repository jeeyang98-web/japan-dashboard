const SPREADSHEET_ID = "148j3X9VwT3tJbba-0WBDeow72DrWYWdKPq4VxtNff28";
const KR_SPREADSHEET_ID = "16BKIgn-uU8_scBp0t55qx4CYI-Zk3dhJOjkTUdgg90Q";

// SpreadsheetApp.openById() 자체가 이 두 시트는 (여러 탭/큰 시트가 많아서)
// 한 번 여는 데 몇 초씩 걸립니다 — 각 셀 범위를 읽는 것보다 "여는 것" 자체가
// 훨씬 비쌉니다. 같은 요청 안에서 여러 함수가 각자 openById를 다시 부르면
// 그때마다 몇 초씩 또 걸리므로, 한 번 연 핸들을 실행 동안 재사용합니다.
let _jpSpreadsheetCache_ = null;
function getJpSpreadsheet_() {
  if (!_jpSpreadsheetCache_) _jpSpreadsheetCache_ = SpreadsheetApp.openById(SPREADSHEET_ID);
  return _jpSpreadsheetCache_;
}
let _krSpreadsheetCache_ = null;
function getKrSpreadsheet_() {
  if (!_krSpreadsheetCache_) _krSpreadsheetCache_ = SpreadsheetApp.openById(KR_SPREADSHEET_ID);
  return _krSpreadsheetCache_;
}

function doGet(e) {
  if (e && e.parameter && e.parameter.api) {
    return serveDashboardApi_(e);
  }

  return HtmlService
    .createTemplateFromFile("index")
    .evaluate()
    .setTitle("JP Business Platform")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 첫 화면에서 불러오는 가벼운 데이터만 반환합니다.
 * 상품별 일자 데이터는 여기서 보내지 않습니다.
 */
function getPlatformData(selectedMonth) {
  const ss = getJpSpreadsheet_();

  const dashboardSheet = requireSheet_(ss, "매출 대시보드");
  const salesSheet = requireSheet_(ss, "매출내역");
  const conversionSheet = requireSheet_(ss, "전환지표");
  const productSheet = requireSheet_(ss, "상품별 매출");

  const month =
    Number(selectedMonth) ||
    Number(dashboardSheet.getRange("M2").getValue()) ||
    7;

  dashboardSheet.getRange("M2").setValue(month);
  SpreadsheetApp.flush();

  const kpi = {
    month: month,
    monthLabel: month + "월",
    target: numberCell_(dashboardSheet, "D5"),
    revenue: numberCell_(dashboardSheet, "G5"),
    achievement: numberCell_(dashboardSheet, "J5"),
    dailyAverage: numberCell_(dashboardSheet, "M5"),
    visitors: numberCell_(dashboardSheet, "D9"),
    conversionRate: numberCell_(dashboardSheet, "G9"),
    orders: numberCell_(dashboardSheet, "J9"),
    aov: numberCell_(dashboardSheet, "M9"),
    targetDelta: displayCell_(dashboardSheet, "D6"),
    revenueDelta: displayCell_(dashboardSheet, "G6"),
    dailyAverageDelta: displayCell_(dashboardSheet, "M6"),
    visitorsDelta: displayCell_(dashboardSheet, "D10"),
    conversionDelta: displayCell_(dashboardSheet, "G10"),
    ordersDelta: displayCell_(dashboardSheet, "J10"),
    aovDelta: displayCell_(dashboardSheet, "M10")
  };

  // 매출내역 B:G
  const salesLastRow = Math.max(salesSheet.getLastRow(), 6);
  const salesRows = salesSheet
    .getRange(6, 2, salesLastRow - 5, 6)
    .getDisplayValues();

  const dailySales = {};
  const monthlySummary = {};
  const availableMonthSet = new Set();

  salesRows.forEach(row => {
    const date = row[0];
    const rowMonth = row[1];

    if (!date || date === "total" || !rowMonth) return;

    availableMonthSet.add(rowMonth);

    if (!dailySales[rowMonth]) {
      dailySales[rowMonth] = { dates: [], revenue: [] };
    }

    dailySales[rowMonth].dates.push(normalizeDate_(date));
    dailySales[rowMonth].revenue.push(toNumber_(row[5]));

    if (!monthlySummary[rowMonth]) {
      monthlySummary[rowMonth] = { revenue: 0, orders: 0 };
    }

    monthlySummary[rowMonth].revenue += toNumber_(row[5]);
    monthlySummary[rowMonth].orders += toNumber_(row[4]);
  });

  // 전환지표 A:BF
  const conversionLastRow = Math.max(conversionSheet.getLastRow(), 2);
  const conversionRows = conversionSheet
    .getRange(2, 1, conversionLastRow - 1, 58)
    .getDisplayValues();

  const dailyFunnel = {};

  conversionRows.forEach(row => {
    const date = row[0];
    const rowMonth = row[1];

    if (!date || !rowMonth) return;

    if (!dailyFunnel[rowMonth]) {
      dailyFunnel[rowMonth] = {
        dates: [],
        visitors: [],
        carts: [],
        completedOrders: [],
        conversionRate: []
      };
    }

    dailyFunnel[rowMonth].dates.push(normalizeDate_(date));
    dailyFunnel[rowMonth].visitors.push(nullableNumber_(row[54]));
    dailyFunnel[rowMonth].carts.push(nullableNumber_(row[55]));
    dailyFunnel[rowMonth].completedOrders.push(nullableNumber_(row[56]));
    dailyFunnel[rowMonth].conversionRate.push(nullableNumber_(row[57]));
  });

  // Product 월별 데이터: 1~8월
  const products = productSheet
    .getRange("C143:K159")
    .getDisplayValues()
    .filter(row => row[0])
    .map(row => [row[0], ...row.slice(1).map(toNumber_)]);

  const productTotals = products
    .map(row => ({
      name: row[0],
      months: row.slice(1),
      total: row.slice(1).reduce((sum, value) => sum + Number(value || 0), 0)
    }))
    .sort((a, b) => b.total - a.total);

  // 프로모션 요약 데이터 (작은 범위만)
  let promotion = { megaWari: [], megaPo: [] };

  const promotionSheet = ss.getSheetByName("프로모션별 매출내역");

  if (promotionSheet) {
    const megaWariRaw = promotionSheet.getRange("A3:Q6").getDisplayValues();
    promotion.megaWari = megaWariRaw
      .filter(row => row[0] && row[1])
      .map(row => ({
        period: row[0],
        label: row[1],
        days: row.slice(2, 15).map(nullableNumber_),
        total: toNumber_(row[15]),
        growth: row[16] || "-"
      }));

    const megaPoRaw = promotionSheet.getRange("A10:N17").getDisplayValues();
    promotion.megaPo = megaPoRaw
      .filter(row => row[0] && row[1])
      .map(row => ({
        period: row[0],
        month: Number(toNumber_(row[1])),
        label: row[1] + "월",
        days: row.slice(2, 11).map(nullableNumber_),
        total: toNumber_(row[11]),
        growth: row[12] || "-",
        note: row[13] || ""
      }));
  }

  const availableMonths = Array
    .from(availableMonthSet)
    .sort((a, b) => parseInt(a) - parseInt(b));

  // 프론트엔드(squirrelfish)의 JP Executive / Total 페이지가 기대하는
  // 12개월 배열/일별 시리즈 형태로 재가공한 필드들 (기존 필드는 그대로 유지)
  const monthlySales = new Array(12).fill(0);
  const monthlyOrders = new Array(12).fill(0);

  Object.keys(monthlySummary).forEach(label => {
    const idx = parseInt(label, 10) - 1;
    if (idx >= 0 && idx < 12) {
      monthlySales[idx] = monthlySummary[label].revenue;
      monthlyOrders[idx] = monthlySummary[label].orders;
    }
  });

  const dailyByMonth = {};

  Object.keys(dailySales).forEach(label => {
    const idx = parseInt(label, 10);
    if (idx >= 1 && idx <= 12) {
      dailyByMonth[String(idx)] = {
        labels: dailySales[label].dates,
        datasets: [{
          label: "JP daily sales",
          data: dailySales[label].revenue,
          backgroundColor: "#5a4ff3",
          borderColor: "#5a4ff3"
        }]
      };
    }
  });

  const sumArray_ = arr => (arr || []).reduce((sum, v) => sum + Number(v || 0), 0);
  const funnelByMonth = new Array(12).fill(null).map(() => ({}));

  Object.keys(dailyFunnel).forEach(label => {
    const idx = parseInt(label, 10);
    if (idx < 1 || idx > 12) return;

    const bucket = dailyFunnel[label];
    const validRates = (bucket.conversionRate || []).filter(v => v != null);
    const avgRate = validRates.length
      ? sumArray_(validRates) / validRates.length
      : 0;

    funnelByMonth[idx - 1] = {
      유입자수: sumArray_(bucket.visitors),
      장바구니: sumArray_(bucket.carts),
      주문완료: sumArray_(bucket.completedOrders),
      주문전환율: Math.round(avgRate * 100) / 100
    };
  });

  const targets = getJpMonthlyTargets_();

  // squirrelfish JP Executive 페이지의 "상품별 매출" 차트가 기대하는
  // 월별 상품 랭킹(Record<month, {name, quantity}[]>). "상품별 매출" 시트의
  // 일별 수량을 월 단위로 합산합니다. (기존 products 필드는 index.html 레거시
  // 대시보드가 그대로 쓰고 있어 건드리지 않고, 별도 필드로 추가)
  // 두 함수 모두 같은 시트/범위를 읽으므로 한 번만 읽어서 공유합니다
  // (요청마다 546열짜리 범위를 두 번 읽으면 로딩이 그만큼 느려집니다).
  const jpProductRaw = readJpProductSheetRaw_();
  const jpProducts = getJpMonthlyProductRows_(jpProductRaw);
  const jpDailyProductQty = getJpDailyLineQtyByMonth_(month, jpProductRaw);

  return {
    kpi: kpi,
    dailySales: dailySales,
    dailyFunnel: dailyFunnel,
    monthlySummary: monthlySummary,
    products: products,
    jpProducts: jpProducts,
    jpDailyProductQty: jpDailyProductQty,
    productTotals: productTotals,
    promotion: promotion,
    availableMonths: availableMonths,
    monthlySales: monthlySales,
    orders: monthlyOrders,
    dailyByMonth: dailyByMonth,
    funnel: funnelByMonth,
    targets: targets,
    generatedAt: Utilities.formatDate(
      new Date(),
      "Asia/Seoul",
      "yyyy-MM-dd HH:mm:ss"
    )
  };
}

/**
 * Promotion 메뉴를 처음 열 때 상품 목록 + 날짜 범위만 반환.
 * 매우 작은 데이터만 전송합니다.
 */
function getPromotionProductOptions() {
  const ss = getJpSpreadsheet_();
  const sheet = requireSheet_(ss, "상품별 매출");

  const meta = getProductDailyMeta_(sheet);

  return {
    products: meta.products,
    minDate: meta.dates.length ? meta.dates[0] : "",
    maxDate: meta.dates.length ? meta.dates[meta.dates.length - 1] : ""
  };
}

/**
 * 선택 상품/기간의 일별 데이터만 반환합니다.
 * __ALL__ 선택 시 해당 기간 총판매량 TOP8 상품만 반환합니다.
 */
function getPromotionProductDaily(productName, startDate, endDate) {
  const ss = getJpSpreadsheet_();
  const sheet = requireSheet_(ss, "상품별 매출");

  return buildProductDailySeries_(sheet, productName, startDate, endDate);
}

/**
 * "상품별 매출" 시트의 일별 수량 데이터를 상품별로 집계합니다.
 * getPromotionProductDaily / getKoreaProductSalesData 공용 로직입니다.
 */
function buildProductDailySeries_(sheet, productName, startDate, endDate) {
  const meta = getProductDailyMeta_(sheet);

  if (!meta.dates.length || !meta.rowCount) {
    return {
      labels: [],
      datasets: [],
      summary: {
        total: 0,
        average: 0,
        bestDay: "-",
        topProduct: "-"
      }
    };
  }

  const start = startDate || meta.dates[0];
  const end = endDate || meta.dates[meta.dates.length - 1];

  const selectedIndices = [];
  meta.dates.forEach((date, index) => {
    if (date >= start && date <= end) selectedIndices.push(index);
  });

  const labels = selectedIndices.map(index => meta.dates[index]);

  const qtyValues = sheet
    .getRange(6, 7, meta.rowCount, meta.dateCount)
    .getValues();

  const names = sheet
    .getRange(6, 3, meta.rowCount, 1)
    .getDisplayValues()
    .map(row => String(row[0] || "").trim());

  // 같은 품목명이 여러 행이면 합산
  const seriesByProduct = {};

  names.forEach((name, rowIndex) => {
    if (!name || isAggregateRowLabel_(name)) return;

    if (!seriesByProduct[name]) {
      seriesByProduct[name] = new Array(meta.dateCount).fill(0);
    }

    for (let c = 0; c < meta.dateCount; c++) {
      seriesByProduct[name][c] += Number(qtyValues[rowIndex][c] || 0);
    }
  });

  const productTotals = Object.keys(seriesByProduct)
    .map(name => ({
      name: name,
      total: selectedIndices.reduce(
        (sum, index) => sum + Number(seriesByProduct[name][index] || 0),
        0
      )
    }))
    .sort((a, b) => b.total - a.total);

  let datasetProducts = [];

  if (!productName || productName === "__ALL__") {
    datasetProducts = productTotals
      .filter(item => item.total > 0)
      .slice(0, 8)
      .map(item => item.name);
  } else {
    datasetProducts = [productName];
  }

  const datasets = datasetProducts.map(name => ({
    label: name,
    values: selectedIndices.map(index =>
      Number((seriesByProduct[name] || [])[index] || 0)
    )
  }));

  // summary
  let aggregate = selectedIndices.map(() => 0);

  if (!productName || productName === "__ALL__") {
    Object.keys(seriesByProduct).forEach(name => {
      selectedIndices.forEach((index, i) => {
        aggregate[i] += Number(seriesByProduct[name][index] || 0);
      });
    });
  } else {
    aggregate = selectedIndices.map(index =>
      Number((seriesByProduct[productName] || [])[index] || 0)
    );
  }

  const total = aggregate.reduce((sum, value) => sum + value, 0);
  const average = aggregate.length ? total / aggregate.length : 0;

  let bestDay = "-";
  if (aggregate.length) {
    const max = Math.max.apply(null, aggregate);
    const pos = aggregate.indexOf(max);
    bestDay = (labels[pos] || "-") + " · " + max;
  }

  const topProduct =
    productTotals.length && productTotals[0].total > 0
      ? productTotals[0].name + " · " + productTotals[0].total
      : "-";

  return {
    labels: labels,
    datasets: datasets,
    summary: {
      total: total,
      average: average,
      bestDay: bestDay,
      topProduct: topProduct
    }
  };
}

function getProductDailyMeta_(sheet) {
  const lastCol = sheet.getLastColumn();

  if (lastCol < 7) {
    return {
      dates: [],
      products: [],
      rowCount: 0,
      dateCount: 0
    };
  }

  const rawHeaders = sheet
    .getRange(5, 7, 1, lastCol - 6)
    .getValues()[0];

  let dateCount = 0;

  rawHeaders.forEach((value, index) => {
    if (
      value instanceof Date ||
      String(value || "").trim() !== ""
    ) {
      dateCount = index + 1;
    }
  });

  if (!dateCount) {
    return {
      dates: [],
      products: [],
      rowCount: 0,
      dateCount: 0
    };
  }

  const dates = rawHeaders
    .slice(0, dateCount)
    .map(value => dateToYmd_(value));

  const nameValues = sheet
    .getRange(6, 3, Math.max(sheet.getLastRow() - 5, 1), 1)
    .getDisplayValues();

  let rowCount = 0;

  nameValues.forEach((row, index) => {
    if (String(row[0] || "").trim() !== "") {
      rowCount = index + 1;
    }
  });

  const productSet = new Set();

  nameValues
    .slice(0, rowCount)
    .forEach(row => {
      const name = String(row[0] || "").trim();
      if (name) productSet.add(name);
    });

  return {
    dates: dates,
    products: Array.from(productSet).sort(),
    rowCount: rowCount,
    dateCount: dateCount
  };
}

/**
 * "손익계산서" 시트를 기반으로 전체 사업(P&L) 데이터를 반환합니다.
 * (serveDashboardApi_ 의 api=total 분기에서 사용)
 */
function getTotalBusinessData(month) {
  const ss = getJpSpreadsheet_();
  const sheet = requireSheet_(ss, "손익계산서");

  const lastRow = sheet.getLastRow();

  if (lastRow < 4) {
    return {
      month: month,
      monthLabel: month + "월",
      title: "",
      reportingPeriod: "",
      lineItems: [],
      summary: {},
      generatedAt: Utilities.formatDate(
        new Date(),
        "Asia/Seoul",
        "yyyy-MM-dd HH:mm:ss"
      )
    };
  }

  const values = sheet.getRange(1, 1, lastRow, 14).getDisplayValues();

  const title = values[0][0] || "";
  const reportingPeriod = values[1][0] || "";

  const lineItems = [];

  for (let r = 4; r < values.length; r++) {
    const row = values[r];
    const label = String(row[0] || "").trim();

    if (!label) continue;

    const monthsRaw = row.slice(1, 13);
    const annualRaw = row[13] || "";

    lineItems.push({
      label: label,
      isSection: /^\[.*\]$/.test(label),
      months: monthsRaw.map(parseAccountingNumber_),
      annualTotal: parseAccountingNumber_(annualRaw),
      raw: {
        months: monthsRaw,
        annualTotal: annualRaw
      }
    });
  }

  const findItem = label => lineItems.find(item => item.label === label);
  const monthValue = label => {
    const item = findItem(label);
    return item ? (item.months[month - 1] || 0) : 0;
  };
  const annualValue = label => {
    const item = findItem(label);
    return item ? item.annualTotal : 0;
  };

  const summaryLabels = [
    ["totalRevenue", "총매출"],
    ["netRevenue", "순매출"],
    ["cogs", "매출원가"],
    ["grossProfit", "매출총이익"],
    ["grossMargin", "매출총이익률"],
    ["variableCost", "총 변동비"],
    ["contributionProfit", "공헌이익"],
    ["contributionMargin", "공헌이익률"],
    ["marketingCost", "총 마케팅비"],
    ["marketingRatio", "마케팅비율"],
    ["fixedCost", "총 고정비/판관비"],
    ["operatingProfit", "영업이익"],
    ["operatingMargin", "영업이익률"]
  ];

  const summary = {};

  summaryLabels.forEach(([key, label]) => {
    summary[key] = {
      month: monthValue(label),
      annual: annualValue(label)
    };
  });

  // squirrelfish 프론트엔드(Total 페이지)가 기대하는 KR+JP 통합 월별 배열.
  // "손익계산서" 시트의 "Qoo10 매출" 라인은 마감된 달까지만 갱신되어 진행
  // 중인 달이 비어있으므로, "매출내역" 원본 로그(G열: 매출액(엔))를 월별로
  // 직접 합산합니다 — getPlatformData의 KPI 매출 계산과 동일한 소스/범위라
  // JP Executive 페이지의 실매출과 항상 일치합니다.
  const monthlyJpJpy = getJpMonthlyRevenueFromLog_();

  const krClose = getKrMonthlyClose_();
  const liveRate = getLiveJpyKrwRate_();
  const exchangeRates = {};
  let lastKnownRate = 0;

  // 마감이 끝난 달(월마감 시트에 실제 환산 환율이 남아있는 달)은 그 실제
  // 환율을 그대로 쓰고, 아직 마감 전이라 실제 환율이 없는 달(예: 이번 달)은
  // 구글 파이낸스 실시간 환율로 대체합니다. 실시간 환율 조회가 실패하면
  // (예: GOOGLEFINANCE 일시 오류) 가장 최근 마감월의 환율로 대체합니다.
  for (let m = 1; m <= 12; m++) {
    const rate = krClose.impliedRate[m - 1];
    if (rate) lastKnownRate = rate;
    exchangeRates[String(m)] = rate || liveRate || lastKnownRate;
  }

  const monthlyJpKrw = monthlyJpJpy.map((jpy, idx) =>
    Math.round(jpy * (exchangeRates[String(idx + 1)] || 0))
  );

  // squirrelfish Total 페이지의 채널별/주문건수/상품별 차트가 기대하는 필드들.
  // channels: 국내 9개 채널(월마감 "1. 채널별 월마감 매출액" 섹션) +
  // 일본 큐텐/기타(같은 KR 시트의 엔화/원화 병기 컬럼)를 월별 매출액(KRW)으로.
  const channels = getKrChannelRevenue_();
  channels["Qoo10 (JP)"] = krClose.monthlyJpQoo10Krw;
  channels["기타 (JP)"] = krClose.monthlyJpOtherKrw;

  // krClose.krUnits 는 getKrMonthlyClose_ 안에서 이미 같은 일별매출 로그를
  // 합산해 계산해 둔 값이라 그대로 재사용합니다 (getKrMonthlyOrders_()를
  // 따로 부르면 같은 시트를 한 번 더 통째로 읽게 됨).
  const ordersKr = krClose.krUnits;
  const ordersJp = getJpMonthlyOrders_();

  // products: KR 라인별매출(피봇) 월별 수량 + JP 상품별 매출 시트의 월별 수량을
  // 상품명 기준으로 합산한 TOTAL(KR+JP) 월별 판매수량 랭킹.
  const krLines = getKrLineProductRows_();
  const jpMonthlyProducts = getJpMonthlyProductRows_();
  const products = {};

  for (let m = 1; m <= 12; m++) {
    const combined = {};

    krLines.forEach(line => {
      const qty = line.monthly[m - 1].quantity;
      if (qty > 0) combined[line.name] = (combined[line.name] || 0) + qty;
    });

    (jpMonthlyProducts[String(m)] || []).forEach(item => {
      combined[item.name] = (combined[item.name] || 0) + item.quantity;
    });

    products[String(m)] = Object.keys(combined)
      .map(name => ({ name: name, quantity: combined[name] }))
      .sort((a, b) => b.quantity - a.quantity);
  }

  return {
    month: month,
    monthLabel: month + "월",
    title: title,
    reportingPeriod: reportingPeriod,
    lineItems: lineItems,
    summary: summary,
    monthlyKr: krClose.monthlyKr,
    monthlyJpJpy: monthlyJpJpy,
    monthlyJpKrw: monthlyJpKrw,
    exchangeRates: exchangeRates,
    krTargets: krClose.krTargets,
    targets: krClose.krTargets,
    krUnits: krClose.krUnits,
    channels: channels,
    ordersKr: ordersKr,
    ordersJp: ordersJp,
    products: products,
    generatedAt: Utilities.formatDate(
      new Date(),
      "Asia/Seoul",
      "yyyy-MM-dd HH:mm:ss"
    )
  };
}

/**
 * 구글 파이낸스(GOOGLEFINANCE) 실시간 JPY→KRW 환율을 가져옵니다.
 * Apps Script에는 GOOGLEFINANCE를 직접 호출하는 API가 없어서, 스프레드시트의
 * 미사용 셀(BZ1)에 수식을 잠깐 써넣고 재계산된 값을 읽은 뒤 바로 지웁니다.
 * 30분 CacheService 캐시로 매 요청마다 셀을 건드리지 않게 합니다. 실패 시
 * null을 반환하며, 호출부는 시트에 기록된 과거 환율로 대체(fallback)합니다.
 */
function getLiveJpyKrwRate_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("live-fx-jpy-krw");
  if (cached) return Number(cached);

  let rate = null;

  try {
    const ss = getKrSpreadsheet_();
    const sheet = requireSheet_(ss, "월마감");
    const cell = sheet.getRange("BZ1");

    cell.setFormula('=GOOGLEFINANCE("CURRENCY:JPYKRW")');
    SpreadsheetApp.flush();
    Utilities.sleep(1500);

    const value = cell.getValue();

    cell.clearContent();
    SpreadsheetApp.flush();

    if (typeof value === "number" && value > 0) rate = value;
  } catch (err) {
    rate = null;
  }

  if (rate) cache.put("live-fx-jpy-krw", String(rate), 1800);

  return rate;
}

var KR_DAILY_SHEET_GID_ = 707880508;

/**
 * "일별매출" 시트에서 진행 중인 달의 실시간 국내 매출 누계를 읽어옵니다.
 * 이 시트는 담당자가 매달 손으로 다시 구성해서 채널 열 순서/개수가 달마다
 * 바뀌고, 개별 채널 값 사이사이에 소계(국내 합계·일본 합계·전체 합계)
 * 셀이 섞여 있어 행을 통째로 합산하면 이중 계산됩니다.
 *
 * 처음엔 "당월 누계" 요약 행(그 시트 위쪽의 별도 블록)에서 "국내 합계"
 * 열을 찾아 그 달 값만 읽는 방식으로 짰는데, 이 요약 블록은 담당자가
 * "이번 달" 걸로 매달 손으로 다시 만드는 것이라 — 달이 바뀌는 시점(예:
 * 9/1)에 아직 새 달 블록으로 안 바뀌어 있으면 지난달 값을 그 달 값인 것
 * 처럼 잘못 읽거나, 지난달이 그 사이에 0으로 비게 되는 문제가 있었음
 * (실제로 발생 확인). 그래서 요약 블록 대신 일자별 로그(1월 1일부터
 * 매일 쌓이는 원본 데이터, getKrMonthlyOrdersFromDailyLog_와 동일한
 * 헤더 행)에서 "국내 합계" 열을 날짜 기준으로 월별 합산하는 방식으로
 * 바꿨습니다 — "이번 달이 몇 월인지" 판단할 필요 자체가 없어져서 월
 * 경계 문제가 생기지 않습니다.
 */
/**
 * "일별매출" 시트를 한 번만 통째로 읽어서(값 + 헤더 행 위치) 반환합니다.
 * getKrMonthlyRevenueFromDailyLog_ / getKrDailySalesByMonth_ /
 * getKrMonthlyOrdersFromDailyLog_ 가 모두 이 시트를 처음부터 끝까지
 * 읽으므로, 한 요청 안에서 여러 개가 필요할 때는 이 결과를 한 번만 만들어
 * 넘겨써서(raw 인자) 같은 시트를 중복해서 읽지 않게 합니다.
 */
function readKrDailySheetRaw_() {
  const ss = getKrSpreadsheet_();
  let sheet = null;
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === KR_DAILY_SHEET_GID_) { sheet = sheets[i]; break; }
  }
  if (!sheet) return { values: [], headerRow: -1 };

  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getDisplayValues();

  let headerRow = -1;
  for (let r = 0; r < values.length; r++) {
    let count = 0;
    for (let c = 0; c < values[r].length; c++) {
      const v = String(values[r][c] || "");
      if (v === "판매수량" || v === "주문건수") count++;
    }
    if (count >= 3) { headerRow = r; break; }
  }

  return { values: values, headerRow: headerRow };
}

function getKrMonthlyRevenueFromDailyLog_(raw) {
  const totals = new Array(12).fill(0);
  try {
    const data = raw || readKrDailySheetRaw_();
    const values = data.values;
    const headerRow = data.headerRow;
    if (headerRow === -1) return totals;

    let domesticCol = -1;
    for (let r = headerRow; r >= 0 && r >= headerRow - 3 && domesticCol === -1; r--) {
      const row = values[r];
      for (let c = 0; c < row.length; c++) {
        if (String(row[c] || "").indexOf("국내 합계") !== -1) { domesticCol = c; break; }
      }
    }
    if (domesticCol === -1) return totals;

    for (let r = headerRow + 1; r < values.length; r++) {
      const date = String(values[r][0] || "");
      const match = date.match(/^\d{4}-(\d{2})-\d{2}/);
      if (!match) continue;
      const m = Number(match[1]);
      if (m < 1 || m > 12) continue;
      totals[m - 1] += toNumber_(values[r][domesticCol]);
    }
    return totals;
  } catch (err) {
    return totals;
  }
}

/**
 * "일별매출" 시트의 일자별 로그에서 "국내 합계" 매출을 날짜별로 그대로
 * 뽑아 월별 Series(labels: "M/D", datasets: [{data: 매출액}])로 묶습니다.
 * KR Executive의 "일별 매출 추이" 차트가 쓰는데, 이 API(krFunnel)가
 * 지금까지 일별 데이터 필드 자체를 반환하지 않아서 프론트엔드가 항상
 * 정적 스냅샷(8/27까지)으로 폴백하고 있었습니다.
 */
function getKrDailySalesByMonth_(raw) {
  const result = {};
  try {
    const data = raw || readKrDailySheetRaw_();
    const values = data.values;
    const headerRow = data.headerRow;
    if (headerRow === -1) return result;

    let domesticCol = -1;
    for (let r = headerRow; r >= 0 && r >= headerRow - 3 && domesticCol === -1; r--) {
      const row = values[r];
      for (let c = 0; c < row.length; c++) {
        if (String(row[c] || "").indexOf("국내 합계") !== -1) { domesticCol = c; break; }
      }
    }
    if (domesticCol === -1) return result;

    const byMonth = {};
    for (let r = headerRow + 1; r < values.length; r++) {
      const date = String(values[r][0] || "");
      const match = date.match(/^\d{4}-(\d{2})-(\d{2})/);
      if (!match) continue;
      const m = Number(match[1]);
      const day = Number(match[2]);
      if (m < 1 || m > 12) continue;
      if (!byMonth[m]) byMonth[m] = { labels: [], data: [] };
      byMonth[m].labels.push(m + "/" + day);
      byMonth[m].data.push(toNumber_(values[r][domesticCol]));
    }

    Object.keys(byMonth).forEach(function (m) {
      result[m] = {
        labels: byMonth[m].labels,
        datasets: [{
          label: "KR daily sales",
          data: byMonth[m].data,
          backgroundColor: "#5a4ff3",
          borderColor: "#5a4ff3"
        }]
      };
    });
    return result;
  } catch (err) {
    return result;
  }
}

// B,E,H,K,M,O,Q,S,U열: 자사몰/네이버/29CM/카카오/글아몰/아모레/올리브영(SELL-OUT)/
// CJ ENM/시코르. 네이버·29CM은 "주문건수"를, 나머지 채널은 "판매수량"을
// 그대로 구매건수로 취급합니다(사용자 확인 — 판매수량을 주문건수와
// 동일하게 봄).
var KR_DAILY_ORDER_COLS_ = [1, 4, 7, 10, 12, 14, 16, 18, 20];

/**
 * "일별매출" 시트의 일자별 로그 테이블(1월 1일부터 매일 한 행씩 있는 원본
 * 데이터, 23행부터 시작)을 KR_DAILY_ORDER_COLS_ 기준으로 월별로 합산해서
 * 12개월치 국내 구매건수를 구합니다. "월마감" 같은 별도 마감 요약표와
 * 달리 이 로그는 매일 실시간으로 쌓이기 때문에, 마감 여부와 상관없이
 * 1월부터 오늘까지 전부 반영됩니다.
 */
function getKrMonthlyOrdersFromDailyLog_(raw) {
  const totals = new Array(12).fill(0);
  try {
    const data = raw || readKrDailySheetRaw_();
    const values = data.values;
    const headerRow = data.headerRow;
    if (headerRow === -1) return totals;

    for (let r = headerRow + 1; r < values.length; r++) {
      const date = String(values[r][0] || "");
      const match = date.match(/^\d{4}-(\d{2})-\d{2}/);
      if (!match) continue;
      const m = Number(match[1]);
      if (m < 1 || m > 12) continue;
      KR_DAILY_ORDER_COLS_.forEach(function (c) { totals[m - 1] += toNumber_(values[r][c]); });
    }
    return totals;
  } catch (err) {
    return totals;
  }
}

/**
 * "일별매출" 시트의 일자별 로그에서 KR_DAILY_ORDER_COLS_(판매수량/주문건수)
 * 합계를 날짜별로 그대로 뽑아 월별 Series로 묶습니다. Product 페이지의
 * "일간 판매 추이" 차트(KR)에서 사용 — getKrDailySalesByMonth_와 같은
 * 구조지만 매출액이 아니라 수량을 담습니다.
 */
/**
 * "상품별매출"(KR_PRODUCT_SHEET_GID_) 시트는 월별 요약 컬럼 뒤에 1월 1일부터
 * 매일 2컬럼(수량/매출)짜리 일자별 블록이 이어집니다(라벨이 "26-08-31" 형식).
 * 이 함수는 지정한 달에 해당하는 날짜 컬럼만 찾아서, 라인명(E열, 이 시트는
 * 라인의 모든 SKU 행에 라인명이 매번 채워져 있어 forward-fill 불필요)별로
 * 하루치 수량을 더합니다. Product 페이지의 "일간 판매 추이" 차트(KR, 상품
 * 라인별)에서 사용.
 */
function findKrProductSheet_() {
  const ss = getKrSpreadsheet_();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === KR_PRODUCT_SHEET_GID_) return sheets[i];
  }
  return null;
}

/**
 * KR 상품 시트에서 getKrLineProductRows_와 getKrDailyLineQtyByMonth_가 공통으로
 * 쓰는 값(일별 날짜 헤더 row5, "TOTAL" 채널 블록의 끝 행)을 한 번만 읽어서
 * 반환합니다. 각 getRange().getDisplayValues() 호출 자체에 고정 비용이 있어서
 * (셀 개수와 별개로), 이 둘을 따로따로 다시 읽으면 그만큼 왕복이 늘어납니다.
 */
function getKrProductSheetMeta_(sheet) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  const row5 = sheet.getRange(5, 1, 1, lastCol).getDisplayValues()[0];

  // "TOTAL" 채널 블록은 7행부터 시작해서, B열에 "합계"라고 적힌 소계 행
  // 바로 앞에서 끝납니다 (그 아래부터는 채널별 블록이 별도로 이어짐).
  const colB = sheet.getRange(7, 2, lastRow - 6, 1).getDisplayValues();
  let endRow = 6 + colB.length;
  for (let i = 0; i < colB.length; i++) {
    if (String(colB[i][0] || "").indexOf("합계") !== -1) { endRow = 7 + i - 1; break; }
  }

  return { lastCol: lastCol, row5: row5, numRows: endRow - 7 + 1 };
}

/**
 * KR 상품 시트(KR_PRODUCT_SHEET_GID_)를 여는 SpreadsheetApp.openById +
 * getSheets() 탐색 자체가 비용이 커서, 한 요청 안에서 getKrLineProductRows_
 * 와 getKrDailyLineQtyByMonth_ 를 같이 쓸 때는 이미 찾은 sheet 객체를
 * 그대로 넘겨 재사용합니다(sheet 인자를 생략하면 기존처럼 새로 찾습니다).
 */
/**
 * meta는 getKrProductSheetMeta_(sheet)의 결과(row5, numRows를 이미 읽어둔 것)를
 * 넘기면 재사용해서, 같은 range를 다시 읽지 않습니다(getKrLineProductRows_가
 * 자기 fallback 루프에서 부를 때 이미 계산해 둔 걸 그대로 넘겨줍니다).
 */
function getKrDailyLineQtyByMonth_(month, sheet, meta) {
  const empty = { labels: [], series: {} };
  try {
    sheet = sheet || findKrProductSheet_();
    if (!sheet) return empty;
    meta = meta || getKrProductSheetMeta_(sheet);

    const row5 = meta.row5;
    const mm = (month < 10 ? "0" : "") + month;
    const dayCols = [];
    for (let c = 0; c < row5.length; c++) {
      const match = String(row5[c] || "").match(/^\d{2}-(\d{2})-(\d{2})$/);
      if (match && match[1] === mm) dayCols.push({ col: c, day: Number(match[2]) });
    }
    if (!dayCols.length) return empty;
    dayCols.sort(function (a, b) { return a.day - b.day; });

    const numRows = meta.numRows;
    if (numRows <= 0) return empty;

    let maxCol = 0;
    dayCols.forEach(function (d) { if (d.col + 1 > maxCol) maxCol = d.col + 1; });
    const data = sheet.getRange(7, 1, numRows, maxCol).getDisplayValues();

    const series = {};
    data.forEach(function (row) {
      const name = String(row[4] || "").trim(); // E열: 라인명
      if (!name) return;
      if (!series[name]) series[name] = new Array(dayCols.length).fill(0);
      dayCols.forEach(function (d, i) { series[name][i] += toNumber_(row[d.col]); });
    });

    return {
      labels: dayCols.map(function (d) { return month + "/" + d.day; }),
      series: series
    };
  } catch (err) {
    return empty;
  }
}

/**
 * KR 사업 스프레드시트("월마감" 시트)에서 국내 월 매출, 국내 월 목표,
 * 그리고 엔화→원화 환율(큐텐 매출의 엔화/원화 병기 값에서 역산)을 읽어옵니다.
 * "월마감" 시트는 국내 채널 마감이 완료된 달까지만 값이 채워져 있어
 * (예: 진행 중인 달은 0), 그 달만 "일별매출" 시트의 실시간 누계로 보정합니다.
 */
function getKrMonthlyClose_() {
  const ss = getKrSpreadsheet_();
  const sheet = requireSheet_(ss, "월마감");

  const section1 = sheet.getRange(5, 26, 12, 10).getDisplayValues();
  const targetColumn = sheet.getRange(23, 35, 12, 1).getDisplayValues();

  const monthlyKr = [];
  const impliedRate = [];
  const krTargets = [];
  const monthlyJpQoo10Krw = []; // col31: 큐텐 매출액(KRW)
  const monthlyJpOtherKrw = []; // col34: 기타(JP) 매출액(KRW)

  for (let i = 0; i < 12; i++) {
    const row = section1[i] || [];
    const domestic = toNumber_(row[0]); // col26: 매출 합계_배송비 포함 (국내)
    const jpJpy = toNumber_(row[4]); // col30: 큐텐 매출액(엔화)
    const jpKrw = toNumber_(row[5]); // col31: 큐텐 매출액(KRW)

    monthlyKr.push(domestic);
    impliedRate.push(jpJpy ? jpKrw / jpJpy : 0);
    krTargets.push(toNumber_((targetColumn[i] || [])[0]));
    monthlyJpQoo10Krw.push(jpKrw);
    monthlyJpOtherKrw.push(toNumber_(row[8])); // col34
  }

  // 마감 전이라 "월마감"에 아직 0으로 남아있는 달은 "일별매출" 시트의
  // 일자별 로그를 날짜 기준으로 합산한 값으로 채웁니다. "오늘이 몇 월인지"
  // 로 어느 달을 보정할지 정하지 않으므로 월 경계(예: 9/1에 8월분이 아직
  // 마감 전인 경우)에서도 안전합니다.
  // 매출/구매건수 둘 다 같은 "일별매출" 시트를 읽으므로 한 번만 읽어서 공유합니다.
  const dailySheetRaw = readKrDailySheetRaw_();
  const dailyRevenue = getKrMonthlyRevenueFromDailyLog_(dailySheetRaw);
  for (let i = 0; i < 12; i++) {
    if (monthlyKr[i] === 0 && dailyRevenue[i]) monthlyKr[i] = dailyRevenue[i];
  }

  // "월마감" 시트에는 판매수량 자체가 없어서, "일별매출" 시트의 1월부터의
  // 일자별 로그를 월별로 합산해 12개월 전체를 채웁니다.
  const krUnits = getKrMonthlyOrdersFromDailyLog_(dailySheetRaw);

  return {
    monthlyKr: monthlyKr,
    impliedRate: impliedRate,
    krTargets: krTargets,
    krUnits: krUnits,
    monthlyJpQoo10Krw: monthlyJpQoo10Krw,
    monthlyJpOtherKrw: monthlyJpOtherKrw
  };
}

/**
 * "월마감" 시트의 "1. 채널별 월마감 매출액" 섹션(A1:Z16)에서 국내 채널별
 * 월 매출액(VAT 제외, 배송비 별도 컬럼이 있는 채널은 매출액만)을 반환합니다.
 * 채널: 자사몰/네이버 스마트스토어/29CM/카카오 선물하기/글로벌몰/
 * 아모레 오프라인/CJ 올리브영/CJ ENM/기타. (getTotalBusinessData 의
 * channels 필드에서 사용)
 */
function getKrChannelRevenue_() {
  const ss = getKrSpreadsheet_();
  const sheet = requireSheet_(ss, "월마감");

  const raw = sheet.getRange(5, 1, 12, 26).getDisplayValues();

  const channelColumns = [
    ["자사몰", 4],
    ["네이버 스마트스토어", 8],
    ["29CM", 12],
    ["카카오 선물하기", 16],
    ["글로벌몰", 18],
    ["아모레 오프라인", 20],
    ["CJ 올리브영", 22],
    ["CJ ENM", 24],
    ["기타", 25]
  ];

  const channels = {};

  channelColumns.forEach(([name, col]) => {
    channels[name] = raw.map(row => toNumber_(row[col - 1]));
  });

  return channels;
}


/**
 * "매출내역" 시트(JP)에서 월별 주문건수를 집계합니다. getPlatformData 의
 * monthlyOrders 계산과 동일한 로직입니다. (getTotalBusinessData 의 ordersJp
 * 필드에서 사용)
 */
function getJpMonthlyOrders_() {
  const ss = getJpSpreadsheet_();
  const salesSheet = requireSheet_(ss, "매출내역");

  const lastRow = Math.max(salesSheet.getLastRow(), 6);
  const rows = salesSheet.getRange(6, 2, lastRow - 5, 6).getDisplayValues();
  const orders = new Array(12).fill(0);

  rows.forEach(row => {
    const date = row[0];
    const rowMonth = row[1];

    if (!date || date === "total" || !rowMonth) return;

    const idx = parseInt(rowMonth, 10) - 1;
    if (idx >= 0 && idx < 12) orders[idx] += toNumber_(row[4]);
  });

  return orders;
}

/**
 * "상품별 매출" 시트(JP)의 일별 판매수량을 상품별/월별로 합산합니다.
 * (getTotalBusinessData 의 products 필드에서 KR 라인별 수량과 합쳐 사용)
 */
/**
 * "매출내역" 시트 오른쪽의 작은 요약표(K열: "N월" 라벨, M열: "월매출 목표")
 * 에서 JP 월별 목표(엔화) 12개월치를 읽어옵니다. 이전에는 대시보드 시트의
 * 선택된 달 목표 셀 하나만 읽어서 나머지 11개월이 항상 0이었습니다.
 */
/**
 * "매출내역" 시트의 원본 주문 로그(B열 주문일자 ~ G열 매출액(엔))를 월별로
 * 직접 합산합니다. getPlatformData의 dailySales/monthlySummary와 동일한
 * 범위/컬럼을 읽어서, 마감 여부와 상관없이 진행 중인 달도 실시간으로
 * 반영됩니다.
 */
function getJpMonthlyRevenueFromLog_() {
  const ss = getJpSpreadsheet_();
  const sheet = requireSheet_(ss, "매출내역");

  const lastRow = Math.max(sheet.getLastRow(), 6);
  const rows = sheet.getRange(6, 2, lastRow - 5, 6).getDisplayValues(); // B:G

  const totals = new Array(12).fill(0);

  rows.forEach(row => {
    const date = row[0]; // B: 주문일자
    const monthLabel = row[1]; // C: 월 (예: "8월")
    if (!date || date === "total" || !monthLabel) return;

    const match = String(monthLabel).match(/^(\d{1,2})월/);
    if (!match) return;

    const m = Number(match[1]);
    if (m < 1 || m > 12) return;

    totals[m - 1] += toNumber_(row[5]); // G: 매출액(엔)
  });

  return totals;
}

function getJpMonthlyTargets_() {
  const ss = getJpSpreadsheet_();
  const sheet = requireSheet_(ss, "매출내역");

  const raw = sheet.getRange(6, 11, 12, 3).getDisplayValues(); // K:M, 12 rows
  const targets = new Array(12).fill(0);

  raw.forEach(row => {
    const label = String(row[0] || ""); // K열: "1월".."12월"
    const match = label.match(/^(\d{1,2})월/);
    if (!match) return;
    const m = Number(match[1]);
    if (m < 1 || m > 12) return;
    targets[m - 1] = toNumber_(row[2]); // M열: 월매출 목표
  });

  return targets;
}

/**
 * "상품별 매출" 시트의 "라인"(B열)은 각 라인의 첫 SKU 행에만 채워져 있고
 * (색상별 하위 행은 병합된 것처럼 공란) 나머지 행은 공란이므로, 위에서부터
 * 마지막으로 채워진 라인명을 그대로 이어받는(forward-fill) 방식으로 각
 * SKU 행의 실제 라인명을 복원합니다.
 */
/**
 * "상품별 매출" 시트의 일자별 수량 컬럼에서, 지정한 달에 해당하는 날짜만
 * 골라 라인명(B열, forward-fill 필요 — getJpMonthlyProductRows_와 동일)별로
 * 하루치 수량을 모읍니다. Product 페이지의 "일간 판매 추이" 차트(JP, 상품
 * 라인별)에서 사용.
 */
/**
 * "상품별 매출" 시트(품목명/라인/일별 수량)를 한 번만 읽어서 반환합니다.
 * getJpMonthlyProductRows_ / getJpDailyLineQtyByMonth_ / getJpDailyLineQtyByDateRange_
 * 가 모두 같은 범위를 읽으므로, 한 요청 안에서 여러 번 필요할 때는 이 결과를
 * 한 번만 만들어 넘겨써서(raw 인자) 546열짜리 범위를 중복해서 읽지 않게 합니다.
 */
function readJpProductSheetRaw_() {
  const ss = getJpSpreadsheet_();
  const sheet = requireSheet_(ss, "상품별 매출");
  const meta = getProductDailyMeta_(sheet);

  if (!meta.rowCount || !meta.dateCount) {
    return { meta: meta, qtyValues: [], names: [], lines: [] };
  }

  const qtyValues = sheet.getRange(6, 7, meta.rowCount, meta.dateCount).getValues();
  const names = sheet
    .getRange(6, 3, meta.rowCount, 1)
    .getDisplayValues()
    .map(row => String(row[0] || "").trim());
  const lineLabels = sheet
    .getRange(6, 2, meta.rowCount, 1)
    .getDisplayValues()
    .map(row => String(row[0] || "").trim());

  let lastLine = "";
  const lines = lineLabels.map(function (label, i) {
    if (label) lastLine = label;
    return lastLine || names[i];
  });

  return { meta: meta, qtyValues: qtyValues, names: names, lines: lines };
}

function getJpDailyLineQtyByMonth_(month, raw) {
  const empty = { labels: [], series: {} };
  const data = raw || readJpProductSheetRaw_();
  const meta = data.meta;

  if (!meta.rowCount || !meta.dateCount) return empty;

  const dayColIdx = [];
  meta.dates.forEach(function (date, i) {
    if (Number(date.slice(5, 7)) === month) dayColIdx.push(i);
  });
  if (!dayColIdx.length) return empty;

  const series = {};
  data.names.forEach(function (name, rowIndex) {
    if (!name || isAggregateRowLabel_(name)) return;
    const line = data.lines[rowIndex];
    if (!line || isAggregateRowLabel_(line)) return;
    if (!series[line]) series[line] = new Array(dayColIdx.length).fill(0);
    dayColIdx.forEach(function (colIdx, i) {
      series[line][i] += Number(data.qtyValues[rowIndex][colIdx] || 0);
    });
  });

  return {
    labels: dayColIdx.map(function (colIdx) { return month + "/" + Number(meta.dates[colIdx].slice(8, 10)); }),
    series: series
  };
}

function getJpMonthlyProductRows_(raw) {
  const data = raw || readJpProductSheetRaw_();
  const meta = data.meta;

  const result = {};
  for (let m = 1; m <= 12; m++) result[String(m)] = [];

  if (!meta.rowCount || !meta.dateCount) return result;

  const monthByCol = meta.dates.map(date => Number(date.slice(5, 7)));

  const totals = {};
  for (let m = 1; m <= 12; m++) totals[m] = {};

  data.names.forEach((name, rowIndex) => {
    if (!name || isAggregateRowLabel_(name)) return;
    const line = data.lines[rowIndex];
    if (!line || isAggregateRowLabel_(line)) return;

    for (let c = 0; c < meta.dateCount; c++) {
      const m = monthByCol[c];
      if (!m || m < 1 || m > 12) continue;

      const qty = Number(data.qtyValues[rowIndex][c] || 0);
      if (!qty) continue;

      totals[m][line] = (totals[m][line] || 0) + qty;
    }
  });

  for (let m = 1; m <= 12; m++) {
    result[String(m)] = Object.keys(totals[m])
      .map(name => ({ name: name, quantity: totals[m][name] }))
      .sort((a, b) => b.quantity - a.quantity);
  }

  return result;
}

var KR_PRODUCT_SHEET_GID_ = 1369904776;

/**
 * KR 사업 스프레드시트의 "상품별매출" 시트(SKU/색상별 원본 데이터, TOTAL
 * 채널 블록 - 6행이 헤더, "합계" 행 전까지)를 읽어서 "라인명"(E열) 기준으로
 * SKU를 통합한 월별 판매수량/매출을 반환합니다. krProduct/krProductSales/
 * getTotalBusinessData 공용 로직입니다. 이전에는 "피봇)라인별매출" 시트를
 * 썼는데 그 시트가 7월까지만 갱신돼 있어서 8월 이후가 항상 비어 있었습니다
 * — 이 시트는 월 헤더가 실제로 채워진 달까지만 반영되므로 자동으로 최신
 * 달을 따라갑니다.
 */
function getKrLineProductRows_(sheet, meta) {
  sheet = sheet || findKrProductSheet_();
  if (!sheet) return [];

  meta = meta || getKrProductSheetMeta_(sheet);
  const header = sheet.getRange(6, 1, 1, meta.lastCol).getDisplayValues()[0];
  const monthQtyCol = [];
  for (let m = 1; m <= 12; m++) {
    const label = m + "월";
    let col = -1;
    for (let c = 0; c < header.length; c++) {
      if (String(header[c] || "").indexOf(label) === 0) { col = c; break; }
    }
    monthQtyCol.push(col);
  }

  const numRows = meta.numRows;
  if (numRows <= 0) return [];
  // 이 시트는 월별 합계 블록(row 6 헤더) 뒤로 일별 수량 블록이 546열까지
  // 이어져 있어서, sheet.getLastColumn() 그대로 읽으면 실제로 쓰는 건
  // E~월별 합계 컬럼(보통 30열 안쪽)뿐인데도 매번 546열을 읽어 매우
  // 느려집니다 — 실제로 쓰는 컬럼까지만 읽도록 제한합니다.
  const neededCols = Math.max(
    8,
    ...monthQtyCol.filter(c => c !== -1).map(c => c + 2)
  );
  const data = sheet.getRange(7, 1, numRows, neededCols).getDisplayValues();

  const byName = {};
  const order = [];

  data.forEach(function (row) {
    const name = String(row[4] || "").trim(); // E열: 라인명
    if (!name) return;

    if (!byName[name]) {
      byName[name] = {
        name: name,
        monthly: Array.from({ length: 12 }, function () { return { quantity: 0, revenue: 0 }; }),
        totalQuantity: 0,
        totalRevenue: 0
      };
      order.push(name);
    }

    const entry = byName[name];
    entry.totalQuantity += toNumber_(row[6]); // 수량 (EA)
    entry.totalRevenue += toNumber_(row[7]); // 매출(원)

    for (let m = 1; m <= 12; m++) {
      const col = monthQtyCol[m - 1];
      if (col === -1) continue;
      entry.monthly[m - 1].quantity += toNumber_(row[col]);
      entry.monthly[m - 1].revenue += toNumber_(row[col + 1]);
    }
  });

  // "N월" 합계 컬럼이 아직 시트에 만들어지지 않은 달(주로 이번 달)은 같은
  // 시트의 일별 수량(getKrDailyLineQtyByMonth_)을 합산해 수량만이라도 채웁니다.
  // (매출은 일별 수량 쪽에 없어 0으로 남습니다 — 월별 합계 컬럼이 생기면 자동 대체됨)
  // 아직 오지 않은 달(예: 10~12월)은 일별 블록에도 해당 컬럼이 아예 없으므로,
  // 이미 읽어 둔 row5(meta)로 실제로 데이터가 있는 달만 골라 호출합니다
  // (없는 달마다 무거운 getKrDailyLineQtyByMonth_를 부르면 그만큼 느려짐).
  const monthsWithDailyCols = new Set();
  meta.row5.forEach(function (v) {
    const match = String(v || "").match(/^\d{2}-(\d{2})-\d{2}$/);
    if (match) monthsWithDailyCols.add(Number(match[1]));
  });

  for (let m = 1; m <= 12; m++) {
    if (monthQtyCol[m - 1] !== -1) continue;
    if (!monthsWithDailyCols.has(m)) continue;
    const daily = getKrDailyLineQtyByMonth_(m, sheet, meta);
    if (!daily.labels.length) continue;
    order.forEach(function (name) {
      const values = daily.series[name];
      if (!values) return;
      byName[name].monthly[m - 1].quantity += values.reduce(function (sum, v) { return sum + Number(v || 0); }, 0);
    });
  }

  return order.map(function (name) { return byName[name]; });
}

/**
 * KR 제품 라인 카탈로그: 월별 판매량 랭킹(monthly) + 누적 랭킹(cumulative) +
 * 상위 라인의 12개월 추이(trends)를 반환합니다.
 * (serveDashboardApi_ 의 api=krProduct 분기에서 사용)
 */
function getKoreaProductData(month) {
  const lines = getKrLineProductRows_();

  const monthly = {};

  for (let m = 1; m <= 12; m++) {
    monthly[String(m)] = lines
      .map(line => ({ name: line.name, quantity: line.monthly[m - 1].quantity }))
      .filter(item => item.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);
  }

  const cumulative = lines
    .map(line => ({ name: line.name, quantity: line.totalQuantity }))
    .filter(item => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);

  const topNames = cumulative.slice(0, 8).map(item => item.name);
  const trends = {
    labels: Array.from({ length: 12 }, (_, i) => (i + 1) + "월"),
    datasets: topNames.map(name => {
      const line = lines.find(l => l.name === name);
      return {
        label: name,
        data: line ? line.monthly.map(x => x.quantity) : new Array(12).fill(0)
      };
    })
  };

  return {
    month: month,
    monthLabel: month + "월",
    trends: trends,
    monthly: monthly,
    cumulative: cumulative
  };
}

/**
 * KR 제품 라인별 월간 판매량(모든 라인, 월별 랭킹)을 반환합니다.
 * (serveDashboardApi_ 의 api=krProductSales 분기에서 사용)
 */
function getKoreaProductSalesData(month) {
  // 월별 요약(lines)과 일별 수량(krDailyProductQty) 둘 다 같은 KR 상품
  // 시트/메타(row5, TOTAL 블록 범위)를 읽으므로, 한 번만 읽어서 공유합니다.
  const sheet = findKrProductSheet_();
  const meta = sheet ? getKrProductSheetMeta_(sheet) : null;
  const lines = getKrLineProductRows_(sheet, meta);

  const products = {};

  for (let m = 1; m <= 12; m++) {
    products[String(m)] = lines
      .map(line => ({ name: line.name, quantity: line.monthly[m - 1].quantity }))
      .filter(item => item.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);
  }

  return {
    month: month,
    monthLabel: month + "월",
    products: products,
    krDailyProductQty: getKrDailyLineQtyByMonth_(month, sheet, meta)
  };
}

/**
 * KR 사업 스프레드시트의 자사몰(cafe24) 방문 트래픽/구매 전환 지표에서
 * 2026년 월별 유입/주문/전환율을 반환합니다. 자사몰 데이터는 2026년 4월까지만
 * 갱신되어 있어(이후 달은 값이 비어있음), 그 상태를 그대로 반영합니다.
 * 다른 국내 채널(네이버/29CM/카카오 등)의 유입 데이터는 이 시트에 없습니다.
 * (serveDashboardApi_ 의 api=krFunnel 분기에서 사용)
 */
function getKoreaFunnelData(month) {
  const ss = getKrSpreadsheet_();
  const sheet = requireSheet_(ss, "월마감");

  const raw = sheet.getRange(72, 1, 39, 10).getDisplayValues();

  const funnelByMonth = {};
  const ordersByMonth = new Array(12).fill(0);

  raw.forEach(row => {
    const label = String(row[0] || "");
    const match = label.match(/^(\d{4})-(\d{2})-01/);

    if (!match || match[1] !== "2026") return;

    const m = Number(match[2]);
    const visitors = toNumber_(row[1]); // 전체방문
    const orders = toNumber_(row[5]); // 구매건수
    const conversionRate = parseFloat(String(row[8] || "").replace("%", "")) || 0;

    funnelByMonth[m] = {
      유입자수: visitors,
      "국내 주문": orders,
      주문전환율: conversionRate
    };
    ordersByMonth[m - 1] = orders;
  });

  const funnel = [];

  for (let m = 1; m <= 12; m++) {
    funnel.push(funnelByMonth[m] || {});
  }

  return {
    month: month,
    monthLabel: month + "월",
    orders: ordersByMonth,
    funnel: funnel,
    dailyByMonth: getKrDailySalesByMonth_()
  };
}

function dateToYmd_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      "Asia/Seoul",
      "yyyy-MM-dd"
    );
  }

  const text = String(value || "").trim();

  if (/^\d{1,2}\/\d{1,2}$/.test(text)) {
    const parts = text.split("/");
    return "2026-" +
      parts[0].padStart(2, "0") + "-" +
      parts[1].padStart(2, "0");
  }

  return normalizeDate_(text);
}

function requireSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("시트를 찾을 수 없습니다: " + name);
  return sheet;
}

function numberCell_(sheet, a1) {
  const value = sheet.getRange(a1).getValue();
  return typeof value === "number" ? value : toNumber_(value);
}

function displayCell_(sheet, a1) {
  return sheet.getRange(a1).getDisplayValue() || "-";
}

function toNumber_(value) {
  if (value === "" || value == null) return 0;

  const number = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim()
  );

  return Number.isFinite(number) ? number : 0;
}

function nullableNumber_(value) {
  if (value === "" || value == null) return null;
  return toNumber_(value);
}

/**
 * "상품별 매출" 시트의 품목명 컬럼에 섞여 있는 합계/total 행을 걸러냅니다.
 * (실제 SKU가 아니라 시트 내 소계용 라벨)
 */
function isAggregateRowLabel_(name) {
  const normalized = String(name || "").trim().toLowerCase();
  // 순수 숫자만 있는 값("1", "2", ...)은 "상품별 매출" 시트의 랭킹용 보조
  // 표가 같은 열 범위에 섞여 들어오면서 생기는 잡음이라 상품명이 아닙니다.
  return (
    normalized === "total" ||
    normalized === "합계" ||
    normalized === "총계" ||
    /^\d+$/.test(normalized)
  );
}

/**
 * "¥850,041", "(¥5,189,317)", "87.1%", "-" 같은 손익계산서 표기를
 * 부호 있는 숫자로 변환합니다. 괄호 표기는 음수로 처리합니다.
 */
function parseAccountingNumber_(value) {
  let text = String(value == null ? "" : value).trim();

  if (!text || text === "-") return 0;

  let negative = false;

  if (text.charAt(0) === "(" && text.charAt(text.length - 1) === ")") {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text.replace(/[¥,%\s]/g, "");

  const number = Number(text);

  if (!Number.isFinite(number)) return 0;

  return negative ? -number : number;
}

function normalizeDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      "Asia/Seoul",
      "yyyy-MM-dd"
    );
  }

  const text = String(value || "")
    .trim()
    .replace(/\./g, "-")
    .replace(/\//g, "-");

  const parts = text.split("-").filter(Boolean);

  if (parts.length >= 3) {
    return [
      parts[0],
      parts[1].padStart(2, "0"),
      parts[2].padStart(2, "0")
    ].join("-");
  }

  return text;
}

function serveDashboardApi_(e) {
  var api = String(e.parameter.api || "");

  var month = Math.max(
    1,
    Math.min(12, Number(e.parameter.month) || 8)
  );

  var handlers = {
    platform: function () {
      return getPlatformData(month);
    },

    total: function () {
      return getTotalBusinessData(month);
    },

    krProduct: function () {
      return getKoreaProductData(month);
    },

    krProductSales: function () {
      return getKoreaProductSalesData(month);
    },

    krFunnel: function () {
      return getKoreaFunnelData(month);
    },

    promotion: function () {
      return getPromotionData_();
    },

    jpFunnel: function () {
      return getJpDailyFunnel_();
    },

  };

  if (!handlers[api]) {
    return dashboardJson_({
      ok: false,
      error: "Unknown api: " + api
    });
  }

  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = "dashboard-api-v25:" + api + ":" + month;
    var skipCache = String(e.parameter.force || "") === "1";
    var cached = skipCache ? null : cache.get(cacheKey);

    if (cached) {
      return dashboardJson_({
        ok: true,
        data: JSON.parse(cached),
        cached: true
      });
    }

    var data = handlers[api]();
    var serialized = JSON.stringify(data);

    if (serialized.length < 95000) {
      cache.put(cacheKey, serialized, 600);
    }

    return dashboardJson_({
      ok: true,
      data: data,
      cached: false
    });

  } catch (error) {
    return dashboardJson_({
      ok: false,
      endpoint: api,
      month: month,
      error: String(error && error.stack ? error.stack : error)
    });
  }
}

var PROMOTION_TAB_GID_ = 1878315571;
var JP_DAILY_FUNNEL_GID_ = 1605116142;

function getJpDailyFunnel_() {
  var ss = getJpSpreadsheet_();
  var sheet = null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === JP_DAILY_FUNNEL_GID_) { sheet = sheets[i]; break; }
  }
  if (!sheet) throw new Error("JP daily funnel tab (gid " + JP_DAILY_FUNNEL_GID_ + ") not found");

  var values = sheet.getDataRange().getValues();
  var headerRow = -1;
  for (var r = 0; r < values.length; r++) {
    if (values[r].indexOf("날짜") !== -1 && values[r].indexOf("유입자수") !== -1) { headerRow = r; break; }
  }
  if (headerRow === -1) return [];

  var header = values[headerRow];
  var dateCol = header.indexOf("날짜");
  var trafficCol = header.indexOf("유입자수");
  var cartCol = header.indexOf("장바구니");
  var ordersCol = header.indexOf("주문완료");
  var rateCol = header.indexOf("주문전환율(%)");

  var out = [];
  for (var row = headerRow + 1; row < values.length; row++) {
    var dateVal = values[row][dateCol];
    if (!dateVal) continue;
    var date = Object.prototype.toString.call(dateVal) === "[object Date]"
      ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(dateVal);
    out.push({
      date: date,
      traffic: Number(values[row][trafficCol]) || 0,
      cart: Number(values[row][cartCol]) || 0,
      orders: Number(values[row][ordersCol]) || 0,
      conversionRate: Number(values[row][rateCol]) || 0
    });
  }
  return out;
}

function getPromotionData_() {
  var ss = getJpSpreadsheet_();
  var sheet = null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === PROMOTION_TAB_GID_) { sheet = sheets[i]; break; }
  }
  if (!sheet) throw new Error("Promotion tab (gid " + PROMOTION_TAB_GID_ + ") not found");

  var range = sheet.getDataRange();
  var values = range.getValues();
  var formats = range.getNumberFormats();
  var megawari = extractCampaignTable_(values, formats, "MEGAWARI", "분기");
  var megapo = extractCampaignTable_(values, formats, "MEGAPO", "월");

  var megawariLatest = megawari.length ? megawari[megawari.length - 1] : null;
  var megapoLatest = megapo.length ? megapo[megapo.length - 1] : null;
  var megawariRange = megawariLatest ? parsePeriodRange_(megawariLatest.period) : null;
  var megapoRange = megapoLatest ? parsePeriodRange_(megapoLatest.period) : null;

  // MEGAWARI/MEGAPO 둘 다 같은 "상품별 매출" 시트를 읽으므로 한 번만 읽어서 공유합니다.
  var jpProductRaw = (megawariRange || megapoRange) ? readJpProductSheetRaw_() : null;

  return {
    megawari: megawari,
    megapo: megapo,
    megawariPeriod: megawariLatest ? megawariLatest.period : "",
    megapoPeriod: megapoLatest ? megapoLatest.period : "",
    megawariProductDaily: megawariRange
      ? getJpDailyLineQtyByDateRange_(megawariRange.startYmd, megawariRange.endYmd, jpProductRaw)
      : { labels: [], series: {} },
    megapoProductDaily: megapoRange
      ? getJpDailyLineQtyByDateRange_(megapoRange.startYmd, megapoRange.endYmd, jpProductRaw)
      : { labels: [], series: {} }
  };
}

/**
 * "2/27~3/11", "8/1-8/9" 같은 프로모션 기간 문자열을 실제 날짜 범위로 변환합니다.
 * 형식이 맞지 않으면 null을 반환합니다.
 */
function parsePeriodRange_(periodText) {
  var text = String(periodText || "").trim();
  var m = text.match(/^(\d{1,2})\/(\d{1,2})\s*[~-]\s*(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  var pad = function (n) { return String(n).padStart(2, "0"); };
  return {
    startYmd: "2026-" + pad(m[1]) + "-" + pad(m[2]),
    endYmd: "2026-" + pad(m[3]) + "-" + pad(m[4])
  };
}

/**
 * "상품별 매출" 시트에서 지정한 날짜 범위(startYmd~endYmd)의 라인별 일별 판매수량을 반환합니다.
 * getJpDailyLineQtyByMonth_ 와 동일한 로직이나 월 단위가 아닌 임의의 날짜 범위를 받습니다.
 */
function getJpDailyLineQtyByDateRange_(startYmd, endYmd, raw) {
  var empty = { labels: [], series: {} };
  var data = raw || readJpProductSheetRaw_();
  var meta = data.meta;

  if (!meta.rowCount || !meta.dateCount) return empty;

  var dayColIdx = [];
  meta.dates.forEach(function (date, i) {
    if (date >= startYmd && date <= endYmd) dayColIdx.push(i);
  });
  if (!dayColIdx.length) return empty;

  var series = {};
  data.names.forEach(function (name, rowIndex) {
    if (!name || isAggregateRowLabel_(name)) return;
    var line = data.lines[rowIndex];
    if (!line || isAggregateRowLabel_(line)) return;
    if (!series[line]) series[line] = new Array(dayColIdx.length).fill(0);
    dayColIdx.forEach(function (colIdx, i) {
      series[line][i] += Number(data.qtyValues[rowIndex][colIdx] || 0);
    });
  });

  return {
    labels: dayColIdx.map(function (colIdx) {
      var d = meta.dates[colIdx];
      return Number(d.slice(5, 7)) + "/" + Number(d.slice(8, 10));
    }),
    series: series
  };
}

function extractCampaignTable_(values, formats, headerLabel, groupLabel) {
  var headerRow = -1;
  for (var r = 0; r < values.length; r++) {
    if (values[r][0] === headerLabel && values[r][1] === groupLabel) { headerRow = r; break; }
  }
  if (headerRow === -1) return [];

  var header = values[headerRow];
  var dayCols = [];
  for (var c = 2; c < header.length; c++) {
    if (String(header[c]).indexOf("day") === 0) dayCols.push(c);
    else break;
  }

  var campaigns = [];
  for (var row = headerRow + 1; row < values.length; row++) {
    var period = values[row][0];
    var group = values[row][1];
    if (!period || !group) break;
    var sales = [];
    for (var i = 0; i < dayCols.length; i++) {
      var col = dayCols[i];
      var v = values[row][col];
      var fmt = (formats[row] && formats[row][col]) || "";
      if (v === "" || v === null || typeof v !== "number" || fmt.indexOf("%") !== -1) break;
      sales.push(v);
    }
    if (sales.length > 0) campaigns.push({ period: String(period), group: String(group), sales: sales });
  }
  return campaigns;
}

function dashboardJson_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------
// Supabase sync
//
// The dashboard used to make the frontend wait on a live Sheets read on
// every page load. Instead, whenever the sheets change, we recompute the
// same handlers serveDashboardApi_ uses and push the result into a
// Supabase table (dashboard_cache). FastAPI then only ever reads that
// table, so a page load is a single indexed Postgres lookup instead of
// a multi-second SpreadsheetApp.openById()+getRange() chain.
//
// One-time setup: set SUPABASE_URL / SUPABASE_SERVICE_KEY as Script
// Properties (Project Settings > Script Properties), then run
// installSupabaseSyncTrigger_ once from the editor.
// ---------------------------------------------------------------------

var SUPABASE_SYNC_HANDLERS_ = {
  platform: function (month) { return getPlatformData(month); },
  total: function (month) { return getTotalBusinessData(month); },
  krProduct: function (month) { return getKoreaProductData(month); },
  krProductSales: function (month) { return getKoreaProductSalesData(month); },
  krFunnel: function (month) { return getKoreaFunnelData(month); },
  // These two ignore month entirely (same as in serveDashboardApi_), so
  // syncAllToSupabase_ only computes them once per run and reuses the
  // result across every month it writes.
  promotion: function () { return getPromotionData_(); },
  jpFunnel: function () { return getJpDailyFunnel_(); },
};
var SUPABASE_MONTH_INDEPENDENT_APIS_ = ["promotion", "jpFunnel"];

function getSupabaseConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("SUPABASE_URL");
  var serviceKey = props.getProperty("SUPABASE_SERVICE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY script properties are not set.");
  }
  return { url: url, serviceKey: serviceKey };
}

function upsertDashboardCache_(api, month, data) {
  var cfg = getSupabaseConfig_();
  var url = cfg.url + "/rest/v1/dashboard_cache?on_conflict=api,month";
  var payload = { api: api, month: month, data: data, updated_at: new Date().toISOString() };

  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      apikey: cfg.serviceKey,
      Authorization: "Bearer " + cfg.serviceKey,
      Prefer: "resolution=merge-duplicates",
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code >= 300) {
    throw new Error("Supabase upsert failed for " + api + "/" + month + " (" + code + "): " + res.getContentText());
  }
}

// Recomputes every api for the given months and pushes each into Supabase.
// One handler failing (e.g. a transient Sheets error) is logged and skipped
// rather than aborting the whole run, so a bad month doesn't block the rest.
function syncAllToSupabase_(months) {
  var monthIndependentCache_ = {};

  Object.keys(SUPABASE_SYNC_HANDLERS_).forEach(function (api) {
    var isMonthIndependent = SUPABASE_MONTH_INDEPENDENT_APIS_.indexOf(api) !== -1;

    months.forEach(function (month) {
      try {
        var data;
        if (isMonthIndependent) {
          if (!(api in monthIndependentCache_)) {
            monthIndependentCache_[api] = SUPABASE_SYNC_HANDLERS_[api]();
          }
          data = monthIndependentCache_[api];
        } else {
          data = SUPABASE_SYNC_HANDLERS_[api](month);
        }
        upsertDashboardCache_(api, month, data);
      } catch (err) {
        Logger.log("syncAllToSupabase_ failed for " + api + "/" + month + ": " + err);
      }
    });
  });
}

function syncCurrentMonthToSupabase_() {
  syncAllToSupabase_([new Date().getMonth() + 1]);
}

function syncAllMonthsToSupabase_() {
  var months = [];
  for (var m = 1; m <= 12; m++) months.push(m);
  syncAllToSupabase_(months);
}

// Installable onEdit trigger handler: just marks "something changed" and
// when. The actual (expensive, ~30-60s) sync runs from a separate 1-minute
// time-driven trigger below, debounced so a burst of edits collapses into
// one sync instead of one per keystroke.
function onEditInstallable_(e) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("supabaseSyncDirty", "1");
  props.setProperty("supabaseSyncLastEditMs", String(Date.now()));
}

var SUPABASE_SYNC_DEBOUNCE_MS_ = 20000;

function checkAndSyncIfDirty_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("supabaseSyncDirty") !== "1") return;

  var lastEdit = Number(props.getProperty("supabaseSyncLastEditMs") || "0");
  if (Date.now() - lastEdit < SUPABASE_SYNC_DEBOUNCE_MS_) return; // edits still settling, wait for the next tick

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // a sync is already running
  try {
    props.setProperty("supabaseSyncDirty", "0");
    syncCurrentMonthToSupabase_();
  } finally {
    lock.releaseLock();
  }
}

// One-time setup - run this once from the Apps Script editor after setting
// the SUPABASE_URL / SUPABASE_SERVICE_KEY script properties. Safe to re-run
// (it clears its own previously-created triggers first).
function installSupabaseSyncTrigger_() {
  var ownHandlers = ["onEditInstallable_", "checkAndSyncIfDirty_", "syncAllMonthsToSupabase_"];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (ownHandlers.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("onEditInstallable_").forSpreadsheet(SPREADSHEET_ID).onEdit().create();
  ScriptApp.newTrigger("onEditInstallable_").forSpreadsheet(KR_SPREADSHEET_ID).onEdit().create();

  ScriptApp.newTrigger("checkAndSyncIfDirty_").timeBased().everyMinutes(1).create();

  // Catches months other than the current one (e.g. a corrected past-month
  // figure) that the onEdit-driven sync intentionally skips to stay fast.
  ScriptApp.newTrigger("syncAllMonthsToSupabase_").timeBased().everyDays(1).atHour(3).create();

  Logger.log("Supabase sync triggers installed.");
}
