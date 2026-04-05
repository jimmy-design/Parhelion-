const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:8000";

function normalizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getRuntimeApiBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return normalizeApiBaseUrl(window.api?.config?.apiBaseUrl);
}

export const API_BASE_URL =
  getRuntimeApiBaseUrl() ||
  normalizeApiBaseUrl(process.env.REACT_APP_API_BASE_URL) ||
  (process.env.NODE_ENV === "development" ? DEFAULT_LOCAL_API_BASE_URL : "");

function createBridgeResponse(payload) {
  const normalizedPayload = payload && typeof payload === "object" ? payload : {};
  const headersMap = new Map(
    Object.entries(normalizedPayload.headers || {}).map(([key, value]) => [
      String(key || "").toLowerCase(),
      value,
    ])
  );
  const bodyText =
    typeof normalizedPayload.bodyText === "string" ? normalizedPayload.bodyText : "";

  return {
    ok: Boolean(normalizedPayload.ok),
    status: Number(normalizedPayload.status || 0),
    statusText: String(normalizedPayload.statusText || ""),
    headers: {
      get(name) {
        return headersMap.get(String(name || "").toLowerCase()) ?? null;
      },
    },
    async json() {
      if (!bodyText) {
        return null;
      }
      return JSON.parse(bodyText);
    },
    async text() {
      return bodyText;
    },
  };
}

export async function apiFetch(url, options) {
  const bridge = typeof window !== "undefined" ? window.api?.http : null;
  if (!bridge?.request) {
    return fetch(url, options);
  }

  const payload = await bridge.request(url, options);
  return createBridgeResponse(payload);
}

export function getAppMode() {
  if (typeof window === "undefined") {
    return "pos";
  }

  const mode =
    new URLSearchParams(window.location.search).get("app")?.toLowerCase() || "pos";
  return mode === "erp" ? "erp" : "pos";
}
