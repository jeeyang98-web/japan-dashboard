/**
 * Paste this whole file's content into your existing Apps Script project
 * (Extensions > Apps Script, on the "큐텐 운영 대시보드" spreadsheet).
 *
 * Then, in your EXISTING doGet(e) function, add this as the very first line:
 *
 *   if (e && e.parameter && e.parameter.api) return serveDashboardApi_(e);
 *
 * Finally: Deploy > Manage deployments > (pencil icon on the existing
 * deployment) > Version: New version > Deploy. This keeps the same /exec URL.
 */
function serveDashboardApi_(e) {
  var api = String(e.parameter.api || '');
  var month = Math.max(1, Math.min(12, Number(e.parameter.month) || 8));
  var handlers = {
    promotion: function () { return getPromotionData(); },
    jpFunnel: function () { return getJpDailyFunnel(); }
  };
  if (!handlers[api]) return json_({ ok: false, error: 'Unknown api: ' + api });
  try {
    var cache = CacheService.getScriptCache();
    var key = 'dashboard-api-v1:' + api + ':' + month;
    var hit = cache.get(key);
    if (hit) return json_({ ok: true, data: JSON.parse(hit), cached: true });
    var data = handlers[api]();
    var serialized = JSON.stringify(data);
    if (serialized.length < 95000) cache.put(key, serialized, 600);
    return json_({ ok: true, data: data, cached: false });
  } catch (error) {
    return json_({ ok: false, endpoint: api, month: month, error: String(error && error.stack || error) });
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

var PROMOTION_SHEET_ID = '148j3X9VwT3tJbba-0WBDeow72DrWYWdKPq4VxtNff28';
var PROMOTION_TAB_GID = 1878315571; // "프로모션별 매출내역" tab
var JP_DAILY_FUNNEL_GID = 1605116142; // daily traffic/cart/orders/conversion tab

/**
 * Reads the daily JP funnel tab (날짜, 월, ...유입채널 breakdown columns...,
 * 유입자수, 장바구니, 주문완료, 주문전환율(%)) and returns one row per date.
 * Column positions are looked up by header text, so extra/reordered
 * traffic-channel columns in between don't break this.
 */
function getJpDailyFunnel() {
  var ss = SpreadsheetApp.openById(PROMOTION_SHEET_ID);
  var sheet = null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === JP_DAILY_FUNNEL_GID) { sheet = sheets[i]; break; }
  }
  if (!sheet) throw new Error('JP daily funnel tab (gid ' + JP_DAILY_FUNNEL_GID + ') not found');
  var values = sheet.getDataRange().getValues();
  var headerRow = -1;
  for (var r = 0; r < values.length; r++) {
    if (values[r].indexOf('날짜') !== -1 && values[r].indexOf('유입자수') !== -1) { headerRow = r; break; }
  }
  if (headerRow === -1) return [];
  var header = values[headerRow];
  var dateCol = header.indexOf('날짜');
  var trafficCol = header.indexOf('유입자수');
  var cartCol = header.indexOf('장바구니');
  var ordersCol = header.indexOf('주문완료');
  var rateCol = header.indexOf('주문전환율(%)');
  var out = [];
  for (var row = headerRow + 1; row < values.length; row++) {
    var dateVal = values[row][dateCol];
    if (!dateVal) continue;
    var date = Object.prototype.toString.call(dateVal) === '[object Date]'
      ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd')
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

function getPromotionData() {
  var ss = SpreadsheetApp.openById(PROMOTION_SHEET_ID);
  var sheet = null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === PROMOTION_TAB_GID) { sheet = sheets[i]; break; }
  }
  if (!sheet) throw new Error('Promotion tab (gid ' + PROMOTION_TAB_GID + ') not found');
  var range = sheet.getDataRange();
  var values = range.getValues();
  var formats = range.getNumberFormats();
  return {
    megawari: extractCampaignTable_(values, formats, 'MEGAWARI', '분기'),
    megapo: extractCampaignTable_(values, formats, 'MEGAPO', '월')
  };
}

/**
 * Scans for a header row matching [headerLabel, groupLabel, "day1", "day2", ...],
 * then reads each following row until a blank period/group cell.
 * A cell formatted as a percentage (leftover QoQ formulas on not-yet-started
 * rows) is treated as "no data yet" and stops that row's sales array there.
 */
function extractCampaignTable_(values, formats, headerLabel, groupLabel) {
  var headerRow = -1;
  for (var r = 0; r < values.length; r++) {
    if (values[r][0] === headerLabel && values[r][1] === groupLabel) { headerRow = r; break; }
  }
  if (headerRow === -1) return [];
  var header = values[headerRow];
  var dayCols = [];
  for (var c = 2; c < header.length; c++) {
    if (String(header[c]).indexOf('day') === 0) dayCols.push(c);
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
      var fmt = (formats[row] && formats[row][col]) || '';
      if (v === '' || v === null || typeof v !== 'number' || fmt.indexOf('%') !== -1) break;
      sales.push(v);
    }
    if (sales.length > 0) campaigns.push({ period: String(period), group: String(group), sales: sales });
  }
  return campaigns;
}
