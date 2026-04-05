const fs = require("fs");
const path = require("path");

const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:8000";
const RUNTIME_CONFIG_PATH = path.join(__dirname, "runtime-config.json");

function normalizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function readRuntimeConfig() {
  try {
    if (!fs.existsSync(RUNTIME_CONFIG_PATH)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, "utf8"));
  } catch (_error) {
    return null;
  }
}

function getConfiguredApiBaseUrl() {
  const environmentApiBaseUrl = normalizeApiBaseUrl(
    process.env.EASTMATT_API_BASE_URL || process.env.REACT_APP_API_BASE_URL
  );
  if (environmentApiBaseUrl) {
    return environmentApiBaseUrl;
  }

  const fileApiBaseUrl = normalizeApiBaseUrl(readRuntimeConfig()?.apiBaseUrl);
  if (fileApiBaseUrl) {
    return fileApiBaseUrl;
  }

  return process.env.NODE_ENV === "development" ? DEFAULT_LOCAL_API_BASE_URL : "";
}

module.exports = {
  DEFAULT_LOCAL_API_BASE_URL,
  getConfiguredApiBaseUrl,
  normalizeApiBaseUrl,
};
