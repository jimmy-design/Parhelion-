import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import POSApp from "./App";
import ErpApp from "./ErpApp";
import LoginScreen from "./LoginScreen";
import { API_BASE_URL, apiFetch } from "./appConfig";

const SESSION_KEY_PREFIX = "eastmatt.auth.session.";

function getSessionKey(appMode) {
  return `${SESSION_KEY_PREFIX}${appMode}`;
}

function readStoredSession(appMode) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getSessionKey(appMode));
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function writeStoredSession(appMode, user) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getSessionKey(appMode), JSON.stringify(user));
}

function clearStoredSession(appMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getSessionKey(appMode));
}

async function requestJson(url, options) {
  const response = await apiFetch(url, options);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || `Request failed with status ${response.status}.`);
  }
  return payload;
}

function AuthShell({ appMode }) {
  const AppComponent = useMemo(() => (appMode === "erp" ? ErpApp : POSApp), [appMode]);
  const [currentUser, setCurrentUser] = useState(() => readStoredSession(appMode));
  const [authConfig, setAuthConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [fingerprintPreparing, setFingerprintPreparing] = useState(false);
  const [fingerprintReady, setFingerprintReady] = useState(false);
  const fingerprintPreparePromiseRef = useRef(null);
  const biometricsEnabled = Boolean(authConfig?.biometrics);

  const loadConfiguration = useCallback(async () => {
    setConfigLoading(true);
    setConfigError("");
    try {
      const configuration = await requestJson(`${API_BASE_URL}/auth/configuration`);
      setAuthConfig(configuration);
    } catch (error) {
      setConfigError(error.message || "Failed to load authentication configuration.");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  useEffect(() => {
    setCurrentUser(readStoredSession(appMode));
    setAuthError("");
    setFingerprintPreparing(false);
    setFingerprintReady(false);
    fingerprintPreparePromiseRef.current = null;
  }, [appMode]);

  useEffect(() => {
    if (!biometricsEnabled || configLoading || currentUser) {
      setFingerprintPreparing(false);
      setFingerprintReady(false);
      fingerprintPreparePromiseRef.current = null;
      return undefined;
    }

    const bridge = window.api?.auth;
    if (!bridge?.prepareFingerprint) {
      setFingerprintPreparing(false);
      setFingerprintReady(false);
      return undefined;
    }

    let isActive = true;
    setFingerprintPreparing(true);

    const preparePromise = bridge.prepareFingerprint({
      apiBaseUrl: API_BASE_URL,
      templateFormat: "STANDARDPRO",
      preloadCandidates: true,
      timeout: 5000,
    });

    fingerprintPreparePromiseRef.current = preparePromise;

    preparePromise
      .then(() => {
        if (!isActive || fingerprintPreparePromiseRef.current !== preparePromise) {
          return;
        }
        setFingerprintPreparing(false);
        setFingerprintReady(true);
      })
      .catch(() => {
        if (!isActive || fingerprintPreparePromiseRef.current !== preparePromise) {
          return;
        }
        setFingerprintPreparing(false);
        setFingerprintReady(false);
      });

    return () => {
      isActive = false;
    };
  }, [biometricsEnabled, configLoading, currentUser]);

  const completeLogin = useCallback(
    (user) => {
      setCurrentUser(user);
      setAuthError("");
      writeStoredSession(appMode, user);
    },
    [appMode]
  );

  const handlePasswordLogin = useCallback(
    async ({ number, password }) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        const user = await requestJson(`${API_BASE_URL}/auth/login/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number,
            password,
          }),
        });
        completeLogin(user);
      } catch (error) {
        setAuthError(error.message || "Password login failed.");
      } finally {
        setAuthLoading(false);
      }
    },
    [completeLogin]
  );

  const handleFingerprintLogin = useCallback(
    async ({ number }) => {
      setAuthLoading(true);
      setAuthError("");
      try {
        if (fingerprintPreparePromiseRef.current) {
          await fingerprintPreparePromiseRef.current.catch(() => null);
        }

        const bridge = window.api?.auth;
        if (!bridge?.loginWithFingerprint) {
          throw new Error("Fingerprint login is available only inside the Electron desktop app.");
        }

        const result = await bridge.loginWithFingerprint({
          number,
          apiBaseUrl: API_BASE_URL,
          matchThreshold: authConfig?.fingerprint_match_threshold,
          templateFormat: "STANDARDPRO",
        });

        if (!result?.user) {
          throw new Error("Fingerprint login did not return a cashier profile.");
        }

        completeLogin(result.user);
      } catch (error) {
        setAuthError(error.message || "Fingerprint login failed.");
      } finally {
        setAuthLoading(false);
      }
    },
    [authConfig?.fingerprint_match_threshold, completeLogin]
  );

  const handleLogout = useCallback(() => {
    clearStoredSession(appMode);
    setCurrentUser(null);
    setAuthError("");
  }, [appMode]);

  if (currentUser) {
    return (
      <AppComponent
        currentUser={currentUser}
        onLogout={handleLogout}
        authConfig={authConfig}
      />
    );
  }

  return (
    <LoginScreen
      appMode={appMode}
      loginMode={biometricsEnabled ? "fingerprint" : "password"}
      authConfig={authConfig}
      isLoading={configLoading || authLoading}
      fingerprintPreparing={fingerprintPreparing}
      fingerprintReady={fingerprintReady}
      errorMessage={authError}
      configError={configError}
      onPasswordLogin={handlePasswordLogin}
      onFingerprintLogin={handleFingerprintLogin}
      onRetryConfiguration={loadConfiguration}
    />
  );
}

export default AuthShell;
