const BASE_URL = import.meta.env.VITE_GAS_API_URL as string | undefined;
export type ApiName =
  "platform" | "total" | "krProduct" | "krProductSales" | "krFunnel" | "promotion" | "jpFunnel";
export type JsonObject = Record<string, any>;
export type DashboardApiBundle = {
  month: number;
  platform: JsonObject;
  total: JsonObject;
  krProduct: JsonObject;
  krProductSales: JsonObject;
  krFunnel: JsonObject;
  promotion: JsonObject;
  jpFunnel: any[];
};
const responseCache = new Map<string, Promise<JsonObject>>();
function endpointUrl(api: ApiName, month: number, force: boolean) {
  if (!BASE_URL) throw new Error("VITE_GAS_API_URL is not configured.");
  const url = new URL(BASE_URL);
  url.searchParams.set("api", api);
  url.searchParams.set("month", String(month));
  // Apps Script 쪽 10분 서버 캐시까지 건너뛰고 시트를 바로 다시 읽게 함
  // (Refresh 버튼을 눌렀을 때만 — 평소 로드는 캐시를 그대로 씀)
  if (force) url.searchParams.set("force", "1");
  return url.toString();
}
const REQUEST_TIMEOUT_MS = 30000;

async function request(
  api: ApiName,
  month: number,
  force = false,
): Promise<JsonObject> {
  const url = endpointUrl(api, month, force);
  if (!force && responseCache.has(url)) return responseCache.get(url)!;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const pending = fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: controller.signal,
  })
    .then(async (response) => {
      const type = response.headers.get("content-type") || "";
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!type.toLowerCase().includes("json"))
        throw new Error(
          `Expected JSON but received ${type || "an unknown content type"}`,
        );
      const body = await response.json();
      if (body?.ok === false)
        throw new Error(body.error || "Apps Script returned an error");
      return body?.data ?? body;
    })
    .catch((error) => {
      responseCache.delete(url);
      const isTimeout = error?.name === "AbortError";
      console.error(`[Dashboard API] ${api} endpoint failed`, {
        endpoint: url,
        month,
        error,
        timeout: isTimeout,
      });
      throw new Error(
        isTimeout
          ? `${api}: 응답이 ${REQUEST_TIMEOUT_MS / 1000}초 넘게 없어 요청을 중단했습니다. 네트워크 상태를 확인해주세요.`
          : `${api}: ${error instanceof Error ? error.message : String(error)}`,
      );
    })
    .finally(() => clearTimeout(timeoutId));
  responseCache.set(url, pending);
  return pending;
}
export const fetchPlatformData = (month: number, force = false) =>
  request("platform", month, force);
export const fetchTotalBusinessData = (month: number, force = false) =>
  request("total", month, force);
export const fetchKrProductData = (month: number, force = false) =>
  request("krProduct", month, force);
export const fetchKrProductSalesData = (month: number, force = false) =>
  request("krProductSales", month, force);
export const fetchKrFunnelData = (month: number, force = false) =>
  request("krFunnel", month, force);
export const fetchPromotionData = (month: number, force = false) =>
  request("promotion", month, force);
export const fetchJpFunnelData = (month: number, force = false) =>
  request("jpFunnel", month, force);
export async function fetchDashboardBundle(
  month: number,
  force = false,
): Promise<DashboardApiBundle> {
  if (!BASE_URL) {
    return {
      month,
      platform: {},
      total: {},
      krProduct: {},
      krProductSales: {},
      krFunnel: {},
      promotion: {},
      jpFunnel: [],
    };
  }
  const soft = (p: Promise<JsonObject>) => p.catch(() => ({}));
  const [platform, total, krProduct, krProductSales, krFunnel, promotion, jpFunnel] =
    await Promise.all([
      soft(fetchPlatformData(month, force)),
      soft(fetchTotalBusinessData(month, force)),
      soft(fetchKrProductData(month, force)),
      soft(fetchKrProductSalesData(month, force)),
      soft(fetchKrFunnelData(month, force)),
      soft(fetchPromotionData(month, force)),
      fetchJpFunnelData(month, force).catch(() => []),
    ]);
  return { month, platform, total, krProduct, krProductSales, krFunnel, promotion, jpFunnel };
}
export function clearApiCache() {
  responseCache.clear();
}
