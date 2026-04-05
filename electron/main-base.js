const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { initUpdater, registerUpdaterHandlers } = require("./update-service");
const { getConfiguredApiBaseUrl } = require("./runtime-config");

let handlersRegistered = false;
let mainWindow = null;

app.commandLine.appendSwitch(
  "disable-features",
  "BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults"
);

function ignoreBrokenPipe(stream) {
  if (!stream || typeof stream.on !== "function") {
    return;
  }

  stream.on("error", (error) => {
    if (error && error.code === "EPIPE") {
      return;
    }
  });
}

ignoreBrokenPipe(process.stdout);
ignoreBrokenPipe(process.stderr);

const DEFAULT_FINGERPRINT_TIMEOUT = Number(process.env.SECUGEN_CAPTURE_TIMEOUT || 10000);
const DEFAULT_FINGERPRINT_QUALITY = Number(process.env.SECUGEN_CAPTURE_QUALITY || 50);
const DEFAULT_FINGERPRINT_TEMPLATE_FORMAT = "STANDARDPRO";
const DEFAULT_FINGERPRINT_PREPARE_TIMEOUT = Number(process.env.SECUGEN_PREPARE_TIMEOUT || 5000);
const FINGERPRINT_PREPARE_CACHE_TTL_MS = Number(
  process.env.SECUGEN_PREPARE_CACHE_TTL_MS || 45000
);
const FINGERPRINT_CANDIDATE_CACHE_TTL_MS = Number(
  process.env.SECUGEN_CANDIDATE_CACHE_TTL_MS || 15000
);
const SUPPORTED_FINGERPRINT_TEMPLATE_FORMATS = new Set([
  "STANDARDPRO",
  "ISO",
  "STANDARD",
  "ANSI378",
]);
let fingerprintPreparePromise = null;
let fingerprintPreparedState = {
  result: null,
  preparedAt: 0,
  lastError: null,
};
let fingerprintCandidatesCache = {
  apiBaseUrl: "",
  items: null,
  expiresAt: 0,
  promise: null,
};

function getApiBaseUrl() {
  const configuredApiBaseUrl = getConfiguredApiBaseUrl();

  if (configuredApiBaseUrl) {
    if (!/^https?:\/\//i.test(configuredApiBaseUrl)) {
      throw new Error(
        "The API server URL must start with http:// or https://. Update EASTMATT_API_BASE_URL."
      );
    }

    return configuredApiBaseUrl;
  }

  throw new Error(
    "The desktop app is not configured with a server API URL. Set EASTMATT_API_BASE_URL or update electron/runtime-config.json before launching it."
  );
}

function normalizeTemplateFormat(value) {
  const requestedFormat = String(value || DEFAULT_FINGERPRINT_TEMPLATE_FORMAT)
    .trim()
    .toUpperCase();
  if (!requestedFormat) {
    return DEFAULT_FINGERPRINT_TEMPLATE_FORMAT;
  }
  if (!SUPPORTED_FINGERPRINT_TEMPLATE_FORMATS.has(requestedFormat)) {
    return DEFAULT_FINGERPRINT_TEMPLATE_FORMAT;
  }
  return requestedFormat === "ISO" ? DEFAULT_FINGERPRINT_TEMPLATE_FORMAT : requestedFormat;
}

function normalizeCashierNumber(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function getFingerprintCandidatesUrl(apiBaseUrl, number = "") {
  const normalizedNumber = typeof number === "string" ? number.trim() : "";
  const query = normalizedNumber ? `?number=${encodeURIComponent(normalizedNumber)}` : "";
  return `${apiBaseUrl}/auth/fingerprint-users${query}`;
}

function hasFreshFingerprintPreparation() {
  return (
    Boolean(fingerprintPreparedState.result) &&
    Date.now() - fingerprintPreparedState.preparedAt < FINGERPRINT_PREPARE_CACHE_TTL_MS
  );
}

function hasFreshFingerprintCandidates(apiBaseUrl) {
  return (
    fingerprintCandidatesCache.apiBaseUrl === apiBaseUrl &&
    Array.isArray(fingerprintCandidatesCache.items) &&
    fingerprintCandidatesCache.expiresAt > Date.now()
  );
}

function filterFingerprintCandidates(candidates, number = "") {
  const normalizedNumber = normalizeCashierNumber(number);
  if (!normalizedNumber) {
    return Array.isArray(candidates) ? candidates : [];
  }

  return (Array.isArray(candidates) ? candidates : []).filter(
    (candidate) => normalizeCashierNumber(candidate?.number) === normalizedNumber
  );
}

function invalidateFingerprintRuntimeState(options = {}) {
  const keepPreparation = options.keepPreparation !== false;
  fingerprintCandidatesCache = {
    apiBaseUrl: "",
    items: null,
    expiresAt: 0,
    promise: null,
  };

  if (!keepPreparation) {
    fingerprintPreparedState = {
      result: null,
      preparedAt: 0,
      lastError: null,
    };
  }
}

function getSecuGenHelperPath() {
  const developmentPath = path.join(__dirname, "secugen-sdk-helper.ps1");
  const packagedCandidates = [
    path.join(process.resourcesPath, "app.asar.unpacked", "electron", "secugen-sdk-helper.ps1"),
    path.join(process.resourcesPath, "electron", "secugen-sdk-helper.ps1"),
    developmentPath,
  ];
  const helperPath = (app.isPackaged ? packagedCandidates : [developmentPath]).find((candidate) =>
    fs.existsSync(candidate)
  );

  if (!helperPath) {
    throw new Error(
      "The SecuGen SDK helper script was not found. Reinstall the app or check the Electron resources."
    );
  }

  return helperPath;
}

function runSecuGenSdkAction(action, payload = {}, timeoutMs = DEFAULT_FINGERPRINT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    let helperPath;
    try {
      helperPath = getSecuGenHelperPath();
    } catch (error) {
      reject(error);
      return;
    }

    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;
    const helperProcess = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        helperPath,
        "-Action",
        String(action || "").trim().toLowerCase(),
      ],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    const finish = (callback) => (value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      callback(value);
    };

    const resolveOnce = finish(resolve);
    const rejectOnce = finish((error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });

    const timeoutId = setTimeout(() => {
      helperProcess.kill();
      rejectOnce(
        new Error(
          "Timed out while waiting for the SecuGen scanner. Make sure the device is connected and try again."
        )
      );
    }, Math.max(Number(timeoutMs || DEFAULT_FINGERPRINT_TIMEOUT), 1000) + 5000);

    helperProcess.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.from(chunk));
    });

    helperProcess.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    helperProcess.on("error", () => {
      rejectOnce(
        new Error(
          "Failed to start the local SecuGen SDK bridge. Check that Windows PowerShell is available."
        )
      );
    });

    helperProcess.on("close", (code) => {
      const stdoutText = Buffer.concat(stdoutChunks).toString("utf8").trim();
      const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();

      if (code !== 0) {
        rejectOnce(
          new Error(
            stderrText ||
              stdoutText ||
              `The SecuGen SDK bridge exited with code ${code}.`
          )
        );
        return;
      }

      if (!stdoutText) {
        rejectOnce(new Error("The SecuGen SDK bridge returned no result."));
        return;
      }

      try {
        resolveOnce(JSON.parse(stdoutText));
      } catch (_error) {
        rejectOnce(
          new Error(
            stderrText
              ? `The SecuGen SDK bridge returned invalid data. ${stderrText}`
              : "The SecuGen SDK bridge returned invalid data."
          )
        );
      }
    });

    helperProcess.stdin.on("error", (error) => {
      if (error && error.code === "EPIPE") {
        return;
      }

      rejectOnce(
        new Error(
          `Failed to send the fingerprint request to the SecuGen SDK bridge. ${error.message}`
        )
      );
    });

    helperProcess.stdin.end(JSON.stringify(payload));
  });
}

async function captureFingerprint(options = {}) {
  const templateFormat = normalizeTemplateFormat(options.templateFormat);

  if (fingerprintPreparePromise) {
    await fingerprintPreparePromise.catch(() => null);
  }

  const captureMode = String(options.captureMode || options.mode || "enroll")
    .trim()
    .toLowerCase();
  const action = captureMode === "capture" || captureMode === "verify" ? "capture" : "enroll";
  const result = await runSecuGenSdkAction(
    action,
    {
      ...options,
      templateFormat,
    },
    Number(options.timeout || DEFAULT_FINGERPRINT_TIMEOUT)
  );

  if (!result?.templateText) {
    throw new Error("Fingerprint capture did not return a template.");
  }

  const imageQuality =
    result?.imageQuality !== undefined && result?.imageQuality !== null
      ? Number(result.imageQuality)
      : Number(options.quality || DEFAULT_FINGERPRINT_QUALITY);

  return {
    templateBase64: result.templateText,
    templateFormat: normalizeTemplateFormat(result.templateFormat || templateFormat),
    imageBase64: result.imageBase64 || "",
    imageQuality: Number.isFinite(imageQuality) ? imageQuality : null,
    nfiq:
      result?.nfiq !== undefined && result?.nfiq !== null ? Number(result.nfiq) : null,
    serialNumber:
      typeof result?.deviceSerial === "string" ? result.deviceSerial.trim() : "",
    deviceName: result?.deviceName || "SecuGen Hamster",
  };
}

async function fetchJson(url) {
  const response = await performHttpRequest(url);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || `Request failed with status ${response.status}.`);
  }
  return payload;
}

async function performHttpRequest(url, options = {}) {
  const requestUrl = typeof url === "string" ? url.trim() : "";
  if (!requestUrl) {
    throw new Error("A request URL is required.");
  }

  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(requestUrl);
    } catch (_error) {
      reject(new Error(`Request URL is invalid: ${requestUrl}`));
      return;
    }

    const transport = parsedUrl.protocol === "https:" ? https : http;
    const method = String(options.method || "GET").trim().toUpperCase() || "GET";
    const timeoutMs = Number(options.timeout || 15000);
    const headers = {};

    for (const [key, value] of Object.entries(options.headers || {})) {
      if (value === undefined || value === null) {
        continue;
      }
      headers[key] = value;
    }

    let body = options.body;
    if (body !== undefined && body !== null) {
      if (typeof body === "string" || Buffer.isBuffer(body)) {
        // use as-is
      } else if (ArrayBuffer.isView(body)) {
        body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
      } else if (body instanceof ArrayBuffer) {
        body = Buffer.from(body);
      } else {
        body = JSON.stringify(body);
        if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
          headers["Content-Type"] = "application/json";
        }
      }

      if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-length")) {
        headers["Content-Length"] = Buffer.byteLength(body);
      }
    }

    const request = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method,
        headers,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf8");
          const responseHeaders = Object.fromEntries(
            Object.entries(response.headers).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(", ") : String(value || ""),
            ])
          );

          resolve({
            ok: Number(response.statusCode || 0) >= 200 && Number(response.statusCode || 0) < 300,
            status: Number(response.statusCode || 0),
            statusText: String(response.statusMessage || ""),
            headers: {
              get(name) {
                return responseHeaders[String(name || "").toLowerCase()] ?? null;
              },
              entries() {
                return Object.entries(responseHeaders)[Symbol.iterator]();
              },
            },
            async text() {
              return bodyText;
            },
            async json() {
              if (!bodyText) {
                return null;
              }
              return JSON.parse(bodyText);
            },
          });
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out after ${timeoutMs}ms`));
    });

    request.on("error", (error) => {
      reject(new Error(`Request to ${requestUrl} failed. Cause: ${error.message}`));
    });

    if (body !== undefined && body !== null) {
      request.write(body);
    }

    request.end();
  });
}

async function preloadFingerprintCandidates(apiBaseUrl = getApiBaseUrl(), forceRefresh = false) {
  const resolvedApiBaseUrl = apiBaseUrl || getApiBaseUrl();

  if (!forceRefresh && hasFreshFingerprintCandidates(resolvedApiBaseUrl)) {
    return fingerprintCandidatesCache.items;
  }

  if (
    !forceRefresh &&
    fingerprintCandidatesCache.apiBaseUrl === resolvedApiBaseUrl &&
    fingerprintCandidatesCache.promise
  ) {
    return fingerprintCandidatesCache.promise;
  }

  const previousItems =
    fingerprintCandidatesCache.apiBaseUrl === resolvedApiBaseUrl &&
    Array.isArray(fingerprintCandidatesCache.items)
      ? fingerprintCandidatesCache.items
      : null;
  const previousExpiry =
    fingerprintCandidatesCache.apiBaseUrl === resolvedApiBaseUrl
      ? fingerprintCandidatesCache.expiresAt
      : 0;

  const requestPromise = fetchJson(getFingerprintCandidatesUrl(resolvedApiBaseUrl))
    .then((candidates) => {
      const normalizedCandidates = Array.isArray(candidates) ? candidates : [];
      fingerprintCandidatesCache = {
        apiBaseUrl: resolvedApiBaseUrl,
        items: normalizedCandidates,
        expiresAt: Date.now() + FINGERPRINT_CANDIDATE_CACHE_TTL_MS,
        promise: null,
      };
      return normalizedCandidates;
    })
    .catch((error) => {
      if (fingerprintCandidatesCache.promise === requestPromise) {
        fingerprintCandidatesCache = {
          apiBaseUrl: resolvedApiBaseUrl,
          items: previousItems,
          expiresAt: previousExpiry,
          promise: null,
        };
      }
      throw error;
    });

  fingerprintCandidatesCache = {
    apiBaseUrl: resolvedApiBaseUrl,
    items: previousItems,
    expiresAt: previousExpiry,
    promise: requestPromise,
  };

  return requestPromise;
}

async function loadFingerprintCandidates(apiBaseUrl = getApiBaseUrl(), number = "") {
  const resolvedApiBaseUrl = apiBaseUrl || getApiBaseUrl();

  if (hasFreshFingerprintCandidates(resolvedApiBaseUrl)) {
    return filterFingerprintCandidates(fingerprintCandidatesCache.items, number);
  }

  if (!normalizeCashierNumber(number)) {
    return preloadFingerprintCandidates(resolvedApiBaseUrl);
  }

  if (
    fingerprintCandidatesCache.apiBaseUrl === resolvedApiBaseUrl &&
    fingerprintCandidatesCache.promise
  ) {
    const warmedCandidates = await fingerprintCandidatesCache.promise.catch(() => null);
    if (Array.isArray(warmedCandidates)) {
      return filterFingerprintCandidates(warmedCandidates, number);
    }
  }

  const filteredCandidates = await fetchJson(getFingerprintCandidatesUrl(resolvedApiBaseUrl, number));
  return Array.isArray(filteredCandidates) ? filteredCandidates : [];
}

async function prepareFingerprint(options = {}) {
  const resolvedApiBaseUrl = options.apiBaseUrl || getApiBaseUrl();
  const templateFormat = normalizeTemplateFormat(options.templateFormat);

  if (!options.force && hasFreshFingerprintPreparation()) {
    if (options.preloadCandidates !== false) {
      preloadFingerprintCandidates(resolvedApiBaseUrl).catch(() => null);
    }

    return {
      ...fingerprintPreparedState.result,
      cached: true,
    };
  }

  if (fingerprintPreparePromise) {
    return fingerprintPreparePromise;
  }

  const timeoutMs = Number(options.timeout || DEFAULT_FINGERPRINT_PREPARE_TIMEOUT);

  fingerprintPreparePromise = Promise.all([
    runSecuGenSdkAction(
      "probe",
      {
        ...options,
        templateFormat,
        showImage: false,
        windowStyle: "INVISIBLE",
      },
      timeoutMs
    ),
    options.preloadCandidates === false
      ? Promise.resolve(null)
      : preloadFingerprintCandidates(resolvedApiBaseUrl)
          .then((candidates) => (Array.isArray(candidates) ? candidates.length : 0))
          .catch(() => null),
  ])
    .then(([probeResult, candidateCount]) => {
      const result = {
        ready: true,
        preparedAt: new Date().toISOString(),
        deviceName: probeResult?.deviceName || "SecuGen Hamster",
        deviceSerial:
          typeof probeResult?.deviceSerial === "string" ? probeResult.deviceSerial.trim() : "",
        templateFormat: normalizeTemplateFormat(probeResult?.templateFormat || templateFormat),
        enrolledCandidates: Number.isFinite(candidateCount) ? candidateCount : null,
      };

      fingerprintPreparedState = {
        result,
        preparedAt: Date.now(),
        lastError: null,
      };

      return result;
    })
    .catch((error) => {
      fingerprintPreparedState.lastError = error;
      throw error;
    })
    .finally(() => {
      fingerprintPreparePromise = null;
    });

  return fingerprintPreparePromise;
}

async function authenticateWithFingerprint(options = {}) {
  const apiBaseUrl = options.apiBaseUrl || getApiBaseUrl();
  const number = typeof options.number === "string" ? options.number.trim() : "";
  const candidatesPromise = loadFingerprintCandidates(apiBaseUrl, number);

  if (fingerprintPreparePromise) {
    await fingerprintPreparePromise.catch(() => null);
  }

  const candidates = await candidatesPromise;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error(
      number
        ? `No enrolled fingerprint was found for cashier ${number}.`
        : "No enrolled fingerprints were found. Enroll a cashier fingerprint from ERP first."
    );
  }

  const templateFormat = normalizeTemplateFormat(
    options.templateFormat || DEFAULT_FINGERPRINT_TEMPLATE_FORMAT
  );
  const templates = candidates
    .map((candidate) => {
      const templateText =
        typeof candidate?.template_base64 === "string"
          ? candidate.template_base64.trim()
          : "";
      if (!templateText) {
        return null;
      }

      return {
        id: candidate.id,
        number: candidate.number,
        name: candidate.name,
        user_role: candidate.user_role,
        store_id: candidate.store_id,
        templateText,
        templateFormat: normalizeTemplateFormat(candidate.template_format),
        fingerprint_updated_at: candidate.fingerprint_updated_at || null,
      };
    })
    .filter((candidate) => candidate && candidate.templateFormat === templateFormat);

  if (templates.length === 0) {
    throw new Error(
      number
        ? `No compatible fingerprint template was found for cashier ${number}. Re-enroll the fingerprint from ERP.`
        : "No compatible fingerprint templates were found. Re-enroll fingerprints from ERP."
    );
  }

  const verification = await runSecuGenSdkAction(
    "verify",
    {
      ...options,
      templateFormat,
      templates,
    },
    Number(options.timeout || DEFAULT_FINGERPRINT_TIMEOUT)
  );

  if (!verification?.matched || !verification?.matchedCandidate) {
    throw new Error(
      number
        ? "Fingerprint did not match the selected cashier."
        : "Fingerprint not recognized. Try again or narrow the login with cashier number."
    );
  }

  const matchedCandidate = verification.matchedCandidate;
  return {
    matchScore: Number(options.matchThreshold || 100),
    user: {
      id: matchedCandidate.id,
      number: matchedCandidate.number,
      name: matchedCandidate.name,
      user_role: matchedCandidate.user_role,
      store_id: matchedCandidate.store_id,
      enabled: true,
      status: "Active",
      has_fingerprint: true,
      fingerprint_updated_at: matchedCandidate.fingerprint_updated_at || null,
    },
  };
}

function getWindowIconPath() {
  const candidates = process.platform === "win32"
    ? [
        path.join(__dirname, "..", "assets", "icon.ico"),
        path.join(__dirname, "..", "assets", "icon.png"),
      ]
    : [path.join(__dirname, "..", "assets", "icon.png")];

  return candidates.find((iconPath) => {
    if (!fs.existsSync(iconPath)) return false;

    // Skip mislabeled files (e.g. a PNG renamed to .ico), which causes
    // Electron to fall back to the default app icon.
    const header = fs.readFileSync(iconPath);
    if (iconPath.endsWith(".ico")) {
      return (
        header.length >= 4 &&
        header[0] === 0x00 &&
        header[1] === 0x00 &&
        header[2] === 0x01 &&
        header[3] === 0x00
      );
    }

    if (iconPath.endsWith(".png")) {
      return (
        header.length >= 8 &&
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47 &&
        header[4] === 0x0d &&
        header[5] === 0x0a &&
        header[6] === 0x1a &&
        header[7] === 0x0a
      );
    }

    return true;
  });
}

function createWindow(appVariant) {
  const isErp = appVariant === "erp";
  const icon = getWindowIconPath();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    frame: !isErp,
    fullscreen: isErp,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Packaged Electron renders from file://, but the app talks to a LAN-hosted
      // HTTP API. Relax web security here so the desktop app can reach the server.
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });
  mainWindow = win;

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(
      `Renderer failed to load (${errorCode}) ${errorDescription} at ${validatedURL || "unknown URL"}`
    );
  });

  if (isErp) {
    win.setMenuBarVisibility(false);
    win.removeMenu();
  }

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "..", "build", "index.html"), {
      query: { app: appVariant },
    });
    return win;
  }

  win.loadURL(`http://localhost:3000/?app=${appVariant}`);
  return win;
}

function registerIpcHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle("http:request", async (_event, request = {}) => {
    const url = typeof request?.url === "string" ? request.url.trim() : "";
    if (!url) {
      throw new Error("A request URL is required.");
    }

    const options = request?.options && typeof request.options === "object" ? request.options : {};
    const response = await performHttpRequest(url, options);
    const bodyText = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      bodyText,
    };
  });

  ipcMain.handle("auth:capture-fingerprint", async (_event, options = {}) => {
    return captureFingerprint(options);
  });

  ipcMain.handle("auth:prepare-fingerprint", async (_event, options = {}) => {
    return prepareFingerprint(options);
  });

  ipcMain.handle("auth:invalidate-fingerprint-cache", async () => {
    invalidateFingerprintRuntimeState({ keepPreparation: true });
    return { ok: true };
  });

  ipcMain.handle("auth:fingerprint-login", async (_event, options = {}) => {
    return authenticateWithFingerprint(options);
  });
}

function bootstrap(appVariant) {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      return;
    }

    if (app.isReady()) {
      createWindow(appVariant);
    }
  });

  app.whenReady().then(async () => {
    try {
      if (appVariant === "erp") {
        Menu.setApplicationMenu(null);
      }

      const apiBaseUrl = getApiBaseUrl();
      process.env.EASTMATT_API_BASE_URL = apiBaseUrl;
      console.log(`Using server API: ${apiBaseUrl}`);

      registerIpcHandlers();
      registerUpdaterHandlers();
      createWindow(appVariant);
      await initUpdater(appVariant);

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(appVariant);
      });
    } catch (error) {
      console.error("Application startup failed:", error);
      dialog.showErrorBox(
        `${appVariant === "erp" ? "Eastmatt ERP" : "Eastmatt POS"} could not start`,
        error?.message || String(error)
      );
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

module.exports = { bootstrap };
