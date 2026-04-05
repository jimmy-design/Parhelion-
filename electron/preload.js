const { contextBridge, ipcRenderer } = require("electron");
const { getConfiguredApiBaseUrl } = require("./runtime-config");

const updateSubscriptions = new Map();
let nextUpdateSubscriptionId = 1;

contextBridge.exposeInMainWorld("api", {
  config: {
    apiBaseUrl: getConfiguredApiBaseUrl(),
  },
  http: {
    request: (url, options) => ipcRenderer.invoke("http:request", { url, options }),
  },
  auth: {
    captureFingerprint: (options) => ipcRenderer.invoke("auth:capture-fingerprint", options),
    prepareFingerprint: (options) => ipcRenderer.invoke("auth:prepare-fingerprint", options),
    invalidateFingerprintCache: () => ipcRenderer.invoke("auth:invalidate-fingerprint-cache"),
    loginWithFingerprint: (options) => ipcRenderer.invoke("auth:fingerprint-login", options),
  },
  updates: {
    getState: () => ipcRenderer.invoke("app-update:get-state"),
    check: () => ipcRenderer.invoke("app-update:check"),
    download: () => ipcRenderer.invoke("app-update:download"),
    install: () => ipcRenderer.invoke("app-update:install"),
    subscribe: (callback) => {
      if (typeof callback !== "function") {
        return null;
      }

      const subscriptionId = nextUpdateSubscriptionId;
      nextUpdateSubscriptionId += 1;

      const listener = (_event, state) => {
        callback(state);
      };

      updateSubscriptions.set(subscriptionId, listener);
      ipcRenderer.on("app-update:state", listener);

      return subscriptionId;
    },
    unsubscribe: (subscriptionId) => {
      const listener = updateSubscriptions.get(subscriptionId);
      if (!listener) return;

      ipcRenderer.removeListener("app-update:state", listener);
      updateSubscriptions.delete(subscriptionId);
    },
  },
});
