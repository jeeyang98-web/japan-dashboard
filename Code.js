const SPREADSHEET_ID = "148j3X9VwT3tJbba-0WBDeow72DrWYWdKPq4VxtNff28";

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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

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

  return {
    kpi: kpi,
    dailySales: dailySales,
    dailyFunnel: dailyFunnel,
    monthlySummary: monthlySummary,
    products: products,
    productTotals: productTotals,
    promotion: promotion,
    availableMonths: availableMonths,
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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

  return {
    month: month,
    monthLabel: month + "월",
    title: title,
    reportingPeriod: reportingPeriod,
    lineItems: lineItems,
    summary: summary,
    generatedAt: Utilities.formatDate(
      new Date(),
      "Asia/Seoul",
      "yyyy-MM-dd HH:mm:ss"
    )
  };
}

/**
 * "상품별 매출" 시트의 SKU별 카탈로그(라인/코드/브랜드/단위)와
 * 선택 월/누적 판매수량을 반환합니다.
 * (serveDashboardApi_ 의 api=krProduct 분기에서 사용)
 */
function getKoreaProductData(month) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = requireSheet_(ss, "상품별 매출");

  const meta = getProductDailyMeta_(sheet);

  if (!meta.rowCount || !meta.dateCount) {
    return { month: month, monthLabel: month + "월", products: [] };
  }

  const monthKey = String(month).padStart(2, "0");
  const monthFlags = meta.dates.map(ymd => ymd.slice(5, 7) === monthKey);

  const infoValues = sheet
    .getRange(6, 2, meta.rowCount, 4)
    .getDisplayValues(); // B:라인, C:품목명, D:품목코드, E:브랜드명

  const unitValues = sheet
    .getRange(6, 6, meta.rowCount, 1)
    .getDisplayValues(); // F:단위

  const qtyValues = sheet
    .getRange(6, 7, meta.rowCount, meta.dateCount)
    .getValues();

  const products = [];

  for (let i = 0; i < meta.rowCount; i++) {
    const name = String(infoValues[i][1] || "").trim();

    if (!name || isAggregateRowLabel_(name)) continue;

    let monthQty = 0;
    let totalQty = 0;

    for (let c = 0; c < meta.dateCount; c++) {
      const value = Number(qtyValues[i][c] || 0);
      totalQty += value;
      if (monthFlags[c]) monthQty += value;
    }

    products.push({
      line: String(infoValues[i][0] || "").trim(),
      name: name,
      code: String(infoValues[i][2] || "").trim(),
      brand: String(infoValues[i][3] || "").trim(),
      unit: String(unitValues[i][0] || "").trim(),
      monthQty: monthQty,
      totalQty: totalQty
    });
  }

  products.sort((a, b) => b.monthQty - a.monthQty);

  return {
    month: month,
    monthLabel: month + "월",
    products: products
  };
}

/**
 * "상품별 매출" 시트에서 선택한 월의 일별 판매량(TOP8 상품)을 반환합니다.
 * (serveDashboardApi_ 의 api=krProductSales 분기에서 사용)
 */
function getKoreaProductSalesData(month) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = requireSheet_(ss, "상품별 매출");

  const monthKey = String(month).padStart(2, "0");
  const daysInMonth = new Date(2026, month, 0).getDate();
  const start = "2026-" + monthKey + "-01";
  const end = "2026-" + monthKey + "-" + String(daysInMonth).padStart(2, "0");

  const series = buildProductDailySeries_(sheet, "__ALL__", start, end);

  return {
    month: month,
    monthLabel: month + "월",
    labels: series.labels,
    datasets: series.datasets,
    summary: series.summary
  };
}

/**
 * "전환지표" 시트의 채널별 유입(PV) 상세 + 퍼널(유입/장바구니/주문완료/전환율)을
 * 선택한 월 기준으로 반환합니다.
 * (serveDashboardApi_ 의 api=krFunnel 분기에서 사용)
 */
function getKoreaFunnelData(month) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = requireSheet_(ss, "전환지표");

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const monthLabel = month + "월";

  if (lastRow < 2 || lastCol < 58) {
    return {
      month: month,
      monthLabel: monthLabel,
      dates: [],
      channels: [],
      channelTotals: [],
      funnel: { visitors: [], carts: [], completedOrders: [], conversionRate: [] },
      summary: { totalVisitors: 0, totalCarts: 0, totalCompletedOrders: 0, avgConversionRate: 0 }
    };
  }

  const headerRow = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const channelHeaders = headerRow.slice(2, 54); // C~BB: 유입채널(PV) 상세 52종

  const rows = sheet
    .getRange(2, 1, lastRow - 1, lastCol)
    .getDisplayValues();

  const dates = [];
  const channelSeries = channelHeaders.map(() => []);
  const visitors = [];
  const carts = [];
  const completedOrders = [];
  const conversionRate = [];

  rows.forEach(row => {
    const date = row[0];
    const rowMonth = row[1];

    if (!date || rowMonth !== monthLabel) return;

    dates.push(normalizeDate_(date));

    channelHeaders.forEach((_, index) => {
      channelSeries[index].push(nullableNumber_(row[2 + index]));
    });

    visitors.push(nullableNumber_(row[54]));
    carts.push(nullableNumber_(row[55]));
    completedOrders.push(nullableNumber_(row[56]));
    conversionRate.push(nullableNumber_(row[57]));
  });

  const channelTotals = channelHeaders
    .map((name, index) => ({
      name: name,
      total: channelSeries[index].reduce((sum, v) => sum + Number(v || 0), 0)
    }))
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total);

  const sum = arr => arr.reduce((total, v) => total + Number(v || 0), 0);
  const validConversionRates = conversionRate.filter(v => v != null);
  const avgConversionRate = validConversionRates.length
    ? sum(validConversionRates) / validConversionRates.length
    : 0;

  return {
    month: month,
    monthLabel: monthLabel,
    dates: dates,
    channels: channelHeaders.map((name, index) => ({
      name: name,
      values: channelSeries[index]
    })),
    channelTotals: channelTotals,
    funnel: {
      visitors: visitors,
      carts: carts,
      completedOrders: completedOrders,
      conversionRate: conversionRate
    },
    summary: {
      totalVisitors: sum(visitors),
      totalCarts: sum(carts),
      totalCompletedOrders: sum(completedOrders),
      avgConversionRate: Math.round(avgConversionRate * 100) / 100
    }
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
  return normalized === "total" || normalized === "합계" || normalized === "총계";
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
    }
  };

  if (!handlers[api]) {
    return dashboardJson_({
      ok: false,
      error: "Unknown api: " + api
    });
  }

  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = "dashboard-api-v1:" + api + ":" + month;
    var cached = cache.get(cacheKey);

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

function dashboardJson_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
