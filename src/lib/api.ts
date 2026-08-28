const BASE_URL = import.meta.env.VITE_GAS_API_URL as string | undefined;
export type ApiName =
  "platform" | "total" | "krProduct" | "krProductSales" | "krFunnel";
export type JsonObject = Record<string, any>;
export type DashboardApiBundle = {
  month: number;
  platform: JsonObject;
  total: JsonObject;
  krProduct: JsonObject;
  krProductSales: JsonObject;
  krFunnel: JsonObject;
};
const responseCache = new Map<string, Promise<JsonObject>>();
function endpointUrl(api: ApiName, month: number) {
  if (!BASE_URL) throw new Error("VITE_GAS_API_URL is not configured.");
  const url = new URL(BASE_URL);
  url.searchParams.set("api", api);
  url.searchParams.set("month", String(month));
  return url.toString();
}
async function request(
  api: ApiName,
  month: number,
  force = false,
): Promise<JsonObject> {
  const url = endpointUrl(api, month);
  if (!force && responseCache.has(url)) return responseCache.get(url)!;
  const pending = fetch(url, { method: "GET", redirect: "follow" })
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
      console.error(`[Dashboard API] ${api} endpoint failed`, {
        endpoint: url,
        month,
        error,
      });
      throw new Error(
        `${api}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
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
export async function fetchDashboardBundle(
  month: number,
  force = false,
): Promise<DashboardApiBundle> {
  const [platform, total, krProduct, krProductSales, krFunnel] =
    await Promise.all([
      fetchPlatformData(month, force),
      fetchTotalBusinessData(month, force),
      fetchKrProductData(month, force),
      fetchKrProductSalesData(month, force),
      fetchKrFunnelData(month, force),
    ]);
  return { month, platform, total, krProduct, krProductSales, krFunnel };
}
export function clearApiCache() {
  responseCache.clear();
}
