import React, { useState } from "react";
import { Fingerprint, KeyRound, RefreshCw } from "lucide-react";

const APP_COPY = {
  pos: {
    title: "ParhelionPOS",
    subtitle: "Cashier sign-in",
    description: "Authenticate before opening the register and processing sales.",
  },
  erp: {
    title: "ParhelionERP",
    subtitle: "Workspace sign-in",
    description: "Authenticate before opening the enterprise management workspace.",
  },
};

function LoginScreen({
  appMode,
  loginMode,
  authConfig,
  isLoading,
  fingerprintPreparing,
  fingerprintReady,
  errorMessage,
  configError,
  onPasswordLogin,
  onFingerprintLogin,
  onRetryConfiguration,
}) {
  const [number, setNumber] = useState("");
  const [password, setPassword] = useState("");
  const copy = APP_COPY[appMode] || APP_COPY.pos;
  const biometricsEnabled = Boolean(authConfig?.biometrics) || loginMode === "fingerprint";
  const modeLabel = biometricsEnabled ? "Fingerprint required" : "Password required";
  const showFingerprintPreparingState =
    biometricsEnabled && Boolean(fingerprintPreparing) && !isLoading && !fingerprintReady;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (configError) {
      onRetryConfiguration?.();
      return;
    }

    if (biometricsEnabled) {
      await onFingerprintLogin?.({ number });
      return;
    }

    await onPasswordLogin?.({ number, password });
  };

  return (
    <div className={`app auth-app-shell auth-app-shell-${appMode}`}>
      <div className="pos-bg-gradient" />
      <div className="pos-bg-orb pos-bg-orb-left" />
      <div className="pos-bg-orb pos-bg-orb-right" />

      <div className="auth-workspace-preview" aria-hidden="true">
        <aside className="auth-workspace-sidebar">
          <div className="auth-workspace-brand">
            <div className="auth-workspace-brand-badge">EM</div>
            <div className="auth-workspace-brand-copy">
              <span className="auth-workspace-line auth-workspace-line-md" />
              <span className="auth-workspace-line auth-workspace-line-sm" />
            </div>
          </div>

          <div className="auth-workspace-nav">
            <div className="auth-workspace-nav-item is-active" />
            <div className="auth-workspace-nav-item" />
            <div className="auth-workspace-nav-item" />
            <div className="auth-workspace-nav-item" />
            <div className="auth-workspace-nav-item" />
            <div className="auth-workspace-nav-item" />
          </div>
        </aside>

        <div className="auth-workspace-main">
          <div className="auth-workspace-topbar">
            <div className="auth-workspace-heading">
              <span className="auth-workspace-line auth-workspace-line-lg" />
              <span className="auth-workspace-line auth-workspace-line-md" />
            </div>

            <div className="auth-workspace-top-actions">
              <span className="auth-workspace-chip" />
              <span className="auth-workspace-chip auth-workspace-chip-sm" />
            </div>
          </div>

          <div className="auth-workspace-content">
            <div className="auth-workspace-card auth-workspace-card-wide">
              <span className="auth-workspace-line auth-workspace-line-lg" />
              <span className="auth-workspace-line auth-workspace-line-md" />
              <span className="auth-workspace-line auth-workspace-line-sm" />
              <div className="auth-workspace-row-group">
                <div className="auth-workspace-row" />
                <div className="auth-workspace-row" />
                <div className="auth-workspace-row" />
                <div className="auth-workspace-row" />
              </div>
            </div>

            <div className="auth-workspace-card">
              <span className="auth-workspace-line auth-workspace-line-md" />
              <span className="auth-workspace-line auth-workspace-line-xs" />
              <span className="auth-workspace-line auth-workspace-line-sm" />
            </div>

            <div className="auth-workspace-table">
              <span className="auth-workspace-line auth-workspace-line-md" />
              <div className="auth-workspace-row" />
              <div className="auth-workspace-row" />
              <div className="auth-workspace-row" />
            </div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <form className="auth-form-card auth-form-card-centered" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <p className="auth-kicker">{copy.title}</p>
            <h2>{biometricsEnabled ? "Scan to continue" : "Sign in"}</h2>
            <div className={`auth-mode-pill${biometricsEnabled ? " auth-mode-pill-centered" : ""}`}>
              {biometricsEnabled ? <Fingerprint size={20} /> : <KeyRound size={16} />}
              <span>{modeLabel}</span>
            </div>
            {!biometricsEnabled && (
              <>
                <p>Password login is active because Biometrics is disabled in configuration.</p>
                <p className="auth-inline-helper">
                  Enter the cashier number and password from the cashier collection.
                </p>
              </>
            )}
          </div>

          <div className="auth-form-grid">
            {!biometricsEnabled ? (
              <>
                <label className="auth-field">
                  <span>Cashier Number</span>
                  <input
                    type="text"
                    value={number}
                    onChange={(event) => setNumber(event.target.value)}
                    placeholder="e.g. JAMES"
                    disabled={isLoading}
                    autoFocus
                  />
                </label>

                <label className="auth-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    disabled={isLoading}
                  />
                </label>
              </>
            ) : (
              <div className="auth-form-spacer" aria-hidden="true" />
            )}
          </div>

          {(errorMessage || configError) && (
            <div className="auth-error-banner">{errorMessage || configError}</div>
          )}

          <div className="auth-actions">
            <button
              type="submit"
              className="auth-primary-btn"
              disabled={isLoading}
              autoFocus={biometricsEnabled}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="auth-spin" />
                  <span>{biometricsEnabled ? "Scanning..." : "Signing in..."}</span>
                </>
              ) : showFingerprintPreparingState ? (
                <>
                  <RefreshCw size={16} className="auth-spin" />
                  <span>Preparing Scanner...</span>
                </>
              ) : biometricsEnabled ? (
                <>
                  <Fingerprint size={20} />
                  <span>Scan Fingerprint</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Login</span>
                </>
              )}
            </button>

            {configError && (
              <button
                type="button"
                className="auth-secondary-btn"
                onClick={onRetryConfiguration}
                disabled={isLoading}
              >
                Retry
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;
