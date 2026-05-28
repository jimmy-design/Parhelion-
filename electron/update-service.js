const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

const UPDATE_STATE_CHANNEL = "app-update:state";
const TRANSIENT_RELEASE_RETRY_DELAY_MS = 30000;
const MAX_TRANSIENT_RELEASE_RETRIES = 4;

let updaterInitialized = false;
let updaterHandlersRegistered = false;
let updaterEventsAttached = false;
let autoUpdater = null;
let currentAppVariant = "pos";
let transientReleaseRetryCount = 0;
let transientReleaseRetryTimer = null;

let updateState = createInitialState();

function hasElectronApp() {
  return Boolean(app && typeof app.getVersion === "function");
}

function getAutoUpdater() {
  if (autoUpdater) {
    return autoUpdater;
  }

  try {
    ({ autoUpdater } = require("electron-updater"));
    return autoUpdater;
  } catch (error) {
    handleUpdaterError(error);
    return null;
  }
}

function getAppLabel() {
  return currentAppVariant === "erp" ? "ParhelionERP" : "ParhelionPOS";
}

function createInitialState() {
  return {
    supported: false,
    configured: false,
    status: "idle",
    message: "Update service is preparing.",
    currentVersion: hasElectronApp() ? app.getVersion() : "",
    availableVersion: "",
    downloadedVersion: "",
    progressPercent: 0,
    bytesPerSecond: 0,
    checkedAt: "",
    releaseDate: "",
    releaseNotes: "",
  };
}

function cloneUpdateState() {
  return { ...updateState };
}

function broadcastUpdateState() {
  const payload = cloneUpdateState();
  if (!BrowserWindow || typeof BrowserWindow.getAllWindows !== "function") {
    return;
  }

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(UPDATE_STATE_CHANNEL, payload);
    }
  }
}

function setUpdateState(patch) {
  updateState = {
    ...updateState,
    ...patch,
  };
  broadcastUpdateState();
  return cloneUpdateState();
}

function formatUpdaterError(error) {
  if (!error) return "Unexpected update error.";
  if (typeof error === "string") return error;

  const details = [];
  if (error.message) details.push(error.message);
  if (error.stack && !error.message) details.push(error.stack);

  return details.join(" ").trim() || "Unexpected update error.";
}

function clearTransientReleaseRetry() {
  if (transientReleaseRetryTimer) {
    clearTimeout(transientReleaseRetryTimer);
    transientReleaseRetryTimer = null;
  }
}

function resetTransientReleaseRetryState() {
  transientReleaseRetryCount = 0;
  clearTransientReleaseRetry();
}

function isReleaseMetadataPendingError(error) {
  const message = formatUpdaterError(error);
  return (
    /cannot find .*\.yml in the latest release artifacts/i.test(message) ||
    (/latest release artifacts/i.test(message) && /releases\/download\/.*\.yml/i.test(message))
  );
}

function scheduleTransientReleaseRetry() {
  if (transientReleaseRetryCount >= MAX_TRANSIENT_RELEASE_RETRIES) {
    return null;
  }

  clearTransientReleaseRetry();
  transientReleaseRetryCount += 1;

  transientReleaseRetryTimer = setTimeout(() => {
    transientReleaseRetryTimer = null;

    if (!updateState.supported || !updateState.configured) {
      return;
    }

    const updater = getAutoUpdater();
    if (!updater) {
      return;
    }

    updater.checkForUpdates().catch((error) => {
      handleUpdaterError(error);
    });
  }, TRANSIENT_RELEASE_RETRY_DELAY_MS);

  return transientReleaseRetryCount;
}

function normalizeReleaseNotes(releaseNotes) {
  if (typeof releaseNotes === "string") {
    return releaseNotes.trim();
  }

  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry.note === "string") return entry.note.trim();
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

function resolveReleaseVersion(info) {
  if (!info) return "";
  if (typeof info.version === "string" && info.version.trim()) return info.version.trim();
  if (typeof info.releaseName === "string" && info.releaseName.trim()) return info.releaseName.trim();
  return "";
}

function getBundledUpdaterConfigPath() {
  return path.join(process.resourcesPath, "app-update.yml");
}

function isUpdaterConfigured() {
  if (!hasElectronApp() || !app.isPackaged) return false;
  return fs.existsSync(getBundledUpdaterConfigPath());
}

function handleUpdaterError(error) {
  if (isReleaseMetadataPendingError(error)) {
    const retryAttempt = scheduleTransientReleaseRetry();
    if (retryAttempt !== null) {
      const metadataFile = `${currentAppVariant}.yml`;
      return setUpdateState({
        status: "retrying",
        message:
          `Release metadata (${metadataFile}) is still publishing on GitHub. ` +
          `Retrying automatically in 30 seconds (${retryAttempt}/${MAX_TRANSIENT_RELEASE_RETRIES}).`,
        checkedAt: new Date().toISOString(),
      });
    }
  }

  return setUpdateState({
    status: "error",
    message: formatUpdaterError(error),
    checkedAt: new Date().toISOString(),
  });
}

function attachUpdaterEvents() {
  if (updaterEventsAttached) return;
  const updater = getAutoUpdater();
  if (!updater) return;
  updaterEventsAttached = true;

  updater.channel = currentAppVariant;
  updater.allowDowngrade = false;
  updater.autoDownload = currentAppVariant !== "erp";
  updater.autoInstallOnAppQuit = currentAppVariant !== "erp";
  updater.allowPrerelease = false;
  updater.disableDifferentialDownload = true;

  updater.on("checking-for-update", () => {
    setUpdateState({
      status: "checking",
      message: "Checking for updates...",
      progressPercent: 0,
      bytesPerSecond: 0,
      checkedAt: new Date().toISOString(),
    });
  });

  updater.on("update-available", (info) => {
    resetTransientReleaseRetryState();
    const version = resolveReleaseVersion(info);

    setUpdateState({
      status: "available",
      message: version
        ? `Version ${version} is available to download.`
        : "A new version is available to download.",
      availableVersion: version,
      downloadedVersion: "",
      progressPercent: 0,
      bytesPerSecond: 0,
      checkedAt: new Date().toISOString(),
      releaseDate: info?.releaseDate || "",
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
    });
  });

  updater.on("update-not-available", () => {
    resetTransientReleaseRetryState();
    setUpdateState({
      status: "up-to-date",
      message: "This device is already on the latest version.",
      availableVersion: "",
      downloadedVersion: "",
      progressPercent: 0,
      bytesPerSecond: 0,
      checkedAt: new Date().toISOString(),
      releaseDate: "",
      releaseNotes: "",
    });
  });

  updater.on("download-progress", (progress) => {
    const percent = Number(progress?.percent || 0);

    setUpdateState({
      status: "downloading",
      message: `Downloading update... ${Math.round(percent)}%`,
      progressPercent: Number(percent.toFixed(1)),
      bytesPerSecond: Number(progress?.bytesPerSecond || 0),
    });
  });

  updater.on("update-downloaded", (info) => {
    resetTransientReleaseRetryState();
    const version = resolveReleaseVersion(info) || updateState.availableVersion;

    setUpdateState({
      status: "downloaded",
      message: version
        ? `Version ${version} is ready. Restart to install it.`
        : "The update is ready. Restart to install it.",
      availableVersion: version,
      downloadedVersion: version,
      progressPercent: 100,
      bytesPerSecond: 0,
      releaseDate: info?.releaseDate || updateState.releaseDate,
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes) || updateState.releaseNotes,
    });
  });

  updater.on("error", (error) => {
    handleUpdaterError(error);
  });
}

function registerUpdaterHandlers() {
  if (updaterHandlersRegistered) return;
  updaterHandlersRegistered = true;

  ipcMain.handle("app-update:get-state", async () => cloneUpdateState());

  ipcMain.handle("app-update:check", async () => {
    if (!updateState.supported || !updateState.configured) {
      return cloneUpdateState();
    }

    try {
      resetTransientReleaseRetryState();
      const updater = getAutoUpdater();
      if (!updater) return cloneUpdateState();
      await updater.checkForUpdates();
    } catch (error) {
      handleUpdaterError(error);
    }

    return cloneUpdateState();
  });

  ipcMain.handle("app-update:download", async () => {
    if (!updateState.supported || !updateState.configured) {
      return cloneUpdateState();
    }

    if (updateState.status !== "available") {
      return cloneUpdateState();
    }

    try {
      const updater = getAutoUpdater();
      if (!updater) return cloneUpdateState();
      await updater.downloadUpdate();
    } catch (error) {
      handleUpdaterError(error);
    }

    return cloneUpdateState();
  });

  ipcMain.handle("app-update:install", async () => {
    if (updateState.status !== "downloaded") {
      return cloneUpdateState();
    }

    setUpdateState({
      status: "installing",
      message: `Closing ${getAppLabel()} to install the update...`,
    });

    setImmediate(() => {
      const updater = getAutoUpdater();
      if (!updater) return;
      updater.quitAndInstall(false, true);
    });

    return cloneUpdateState();
  });
}

async function initUpdater(appVariant = "pos") {
  if (updaterInitialized) {
    return cloneUpdateState();
  }

  updaterInitialized = true;
  currentAppVariant = appVariant === "erp" ? "erp" : "pos";
  resetTransientReleaseRetryState();
  updateState = createInitialState();

  if (!hasElectronApp()) {
    return setUpdateState({
      supported: false,
      configured: false,
      status: "unavailable",
      message: "Update service is available only inside Electron.",
    });
  }

  if (!app.isPackaged) {
    return setUpdateState({
      supported: false,
      configured: false,
      status: "development",
      message: "Auto updates are available only in the packaged installer build.",
    });
  }

  if (!isUpdaterConfigured()) {
    return setUpdateState({
      supported: false,
      configured: false,
      status: "not-configured",
      message:
        "Updates are not configured yet. Build the installer with the GitHub publish settings so the update feed is bundled.",
    });
  }

  attachUpdaterEvents();
  if (!getAutoUpdater()) {
    return setUpdateState({
      supported: false,
      configured: false,
      status: "unavailable",
      message: "Update service could not be loaded in this build.",
    });
  }

  setUpdateState({
    supported: true,
    configured: true,
    status: "idle",
    message: "Update service is ready. Check for updates whenever you want.",
  });

  setTimeout(() => {
    const updater = getAutoUpdater();
    if (!updater) return;
    updater.checkForUpdates().catch((error) => {
      handleUpdaterError(error);
    });
  }, 1500);

  return cloneUpdateState();
}

module.exports = {
  initUpdater,
  registerUpdaterHandlers,
};
