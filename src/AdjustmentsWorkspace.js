import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  PackageSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const DEFAULT_REASON_OPTIONS = [
  "Damaged",
  "Bin correction",
  "Return to stock",
  "Cycle count variance",
  "Supplier return",
  "Found stock",
];

const DEFAULT_LOCATION_OPTIONS = [
  "Warehouse A",
  "Warehouse B",
  "Showroom",
  "Returns Cage",
  "Nairobi Dispatch",
];

function createDraft(requestedBy = "") {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return {
    item: "",
    sku: "",
    quantity: "1",
    direction: "out",
    reason: DEFAULT_REASON_OPTIONS[0],
    location: DEFAULT_LOCATION_OPTIONS[0],
    note: "",
    effectiveDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    requestedBy,
  };
}

function formatDateTime(value) {
  if (!value) return "Awaiting timestamp";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSignedQuantity(value) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) return "0";
  return `${normalized > 0 ? "+" : ""}${normalized.toLocaleString()}`;
}

function formatAbsoluteQuantity(value) {
  return Math.abs(Number(value || 0)).toLocaleString();
}

function getStatusTone(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "posted") return "is-posted";
  if (normalized === "approved") return "is-approved";
  return "is-pending";
}

function getReasonTone(reason) {
  const normalized = String(reason || "").trim().toLowerCase();
  if (normalized.includes("return") || normalized.includes("found")) return "is-positive-reason";
  if (normalized.includes("damage") || normalized.includes("variance")) return "is-risk-reason";
  return "is-neutral-reason";
}

function escapeCsvValue(value) {
  const normalized = String(value ?? "");
  if (!/[",\n]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

export default function AdjustmentsWorkspace({
  records,
  summaryRecords,
  totalRecords,
  selectedAdjustmentId,
  onSelectAdjustment,
  onSaveAdjustment,
  currentUserLabel,
  itemSuggestions,
  saving = false,
  rowsPerPage,
  pageOptions,
  onRowsPerPageChange,
  pageStartRecord,
  pageEndRecord,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
  actionRequest,
  onNotify,
}) {
  const [draft, setDraft] = React.useState(() => createDraft(currentUserLabel));
  const itemInputRef = React.useRef(null);
  const formPanelRef = React.useRef(null);
  const notifyRef = React.useRef(onNotify);
  const recordsRef = React.useRef(summaryRecords);

  React.useEffect(() => {
    notifyRef.current = onNotify;
  }, [onNotify]);

  React.useEffect(() => {
    recordsRef.current = summaryRecords;
  }, [summaryRecords]);

  React.useEffect(() => {
    setDraft((prev) => ({ ...prev, requestedBy: currentUserLabel }));
  }, [currentUserLabel]);

  React.useEffect(() => {
    if (!actionRequest?.nonce) return;

    if (actionRequest.type === "create") {
      formPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      window.setTimeout(() => itemInputRef.current?.focus(), 120);
      return;
    }

    if (actionRequest.type === "export") {
      const exportRecords = Array.isArray(recordsRef.current) ? recordsRef.current : [];
      if (!exportRecords.length) {
        notifyRef.current?.("warning", "No adjustment entries are available to export.");
        return;
      }

      const csvRows = [
        ["Reference", "Reason", "Item", "SKU", "Quantity", "Raised By", "Status", "Location", "Requested At", "Approved By", "Note"].join(","),
        ...exportRecords.map((record) =>
          [
            record.id,
            record.reason,
            record.item,
            record.sku,
            record.quantity,
            record.raisedBy,
            record.status,
            record.location,
            record.requestedAt,
            record.approvedBy,
            record.note,
          ]
            .map(escapeCsvValue)
            .join(",")
        ),
      ];

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "inventory-adjustments-log.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      notifyRef.current?.("success", "Adjustment log exported.");
    }
  }, [actionRequest?.nonce, actionRequest?.type]);

  const selectedRecord =
    (Array.isArray(summaryRecords) ? summaryRecords : []).find(
      (record) => String(record.id) === String(selectedAdjustmentId)
    ) ||
    (Array.isArray(summaryRecords) ? summaryRecords[0] : null) ||
    null;

  const summary = React.useMemo(() => {
    const sourceRecords = Array.isArray(summaryRecords) ? summaryRecords : [];
    const pendingCount = sourceRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "pending"
    ).length;
    const approvedCount = sourceRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "approved"
    ).length;
    const postedCount = sourceRecords.filter(
      (record) => String(record.status || "").toLowerCase() === "posted"
    ).length;
    const netUnits = sourceRecords.reduce(
      (sum, record) => sum + Number(record.quantity || 0),
      0
    );
    const reductionUnits = sourceRecords.reduce((sum, record) => {
      const quantity = Number(record.quantity || 0);
      return quantity < 0 ? sum + Math.abs(quantity) : sum;
    }, 0);

    const reasonCounts = sourceRecords.reduce((accumulator, record) => {
      const reason = String(record.reason || "Uncategorised").trim();
      accumulator[reason] = (accumulator[reason] || 0) + 1;
      return accumulator;
    }, {});

    const topReasons = Object.entries(reasonCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4);

    return {
      pendingCount,
      approvedCount,
      postedCount,
      netUnits,
      reductionUnits,
      topReasons,
    };
  }, [summaryRecords]);

  const mergedSuggestions = React.useMemo(() => {
    const suggestionMap = new Map();

    (Array.isArray(itemSuggestions) ? itemSuggestions : []).forEach((item) => {
      const name = String(item?.item || "").trim();
      const sku = String(item?.sku || "").trim();
      const key = `${sku}|${name}`;
      if (!name || suggestionMap.has(key)) return;
      suggestionMap.set(key, { item: name, sku });
    });

    (Array.isArray(summaryRecords) ? summaryRecords : []).forEach((record) => {
      const name = String(record?.item || "").trim();
      const sku = String(record?.sku || "").trim();
      const key = `${sku}|${name}`;
      if (!name || suggestionMap.has(key)) return;
      suggestionMap.set(key, { item: name, sku });
    });

    return Array.from(suggestionMap.values()).slice(0, 8);
  }, [itemSuggestions, summaryRecords]);

  const handleDraftChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSuggestionPick = (suggestion) => {
    setDraft((prev) => ({
      ...prev,
      item: suggestion.item,
      sku: suggestion.sku,
    }));
    itemInputRef.current?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const createdRecord = await onSaveAdjustment(draft);
    if (!createdRecord) return;
    setDraft(createDraft(currentUserLabel));
  };

  return (
    <div className="erp-adjustments-layout">
      <section className="erp-adjustments-hero">
        <div className="erp-adjustments-hero-copy">
          <span className="erp-adjustments-hero-eyebrow">Inventory Control</span>
          <h3>Adjustments with clarity, approval context, and audit-ready movement trails.</h3>
          <p>
            Keep stock corrections visible at a glance with structured movement cards,
            approval cues, and a capture lane for new adjustment drafts.
          </p>

          <div className="erp-adjustments-signal-row">
            <span className="erp-adjustments-signal-chip">
              <ClipboardCheck size={15} />
              {summary.pendingCount} pending review
            </span>
            <span className="erp-adjustments-signal-chip">
              <ShieldCheck size={15} />
              {summary.approvedCount + summary.postedCount} already cleared
            </span>
            <span className="erp-adjustments-signal-chip">
              <PackageSearch size={15} />
              {formatAbsoluteQuantity(summary.reductionUnits)} units reduced
            </span>
          </div>
        </div>

        <div className="erp-adjustments-hero-focus">
          <div className="erp-adjustments-focus-card">
            <span className="erp-adjustments-focus-label">Live Focus</span>
            <strong>{selectedRecord?.item || "No adjustment selected"}</strong>
            <p>
              {selectedRecord
                ? `${selectedRecord.reason} at ${selectedRecord.location}`
                : "Select an entry below to inspect its movement trail and approval details."}
            </p>
            {selectedRecord && (
              <div className="erp-adjustments-focus-main">
                <span
                  className={`erp-adjustment-row-qty ${
                    Number(selectedRecord.quantity || 0) >= 0 ? "is-positive" : "is-negative"
                  }`}
                >
                  {Number(selectedRecord.quantity || 0) >= 0 ? (
                    <ArrowUpRight size={14} />
                  ) : (
                    <ArrowDownRight size={14} />
                  )}
                  {formatSignedQuantity(selectedRecord.quantity)}
                </span>
                <span className={`erp-adjustment-pill is-status ${getStatusTone(selectedRecord.status)}`}>
                  {selectedRecord.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="erp-adjustments-stats">
        <article className="erp-adjustments-stat-card">
          <span className="erp-adjustments-stat-label">Pending</span>
          <strong className="erp-adjustments-stat-value">{summary.pendingCount}</strong>
          <small className="erp-adjustments-stat-trend">Need review before posting</small>
        </article>
        <article className="erp-adjustments-stat-card">
          <span className="erp-adjustments-stat-label">Approved</span>
          <strong className="erp-adjustments-stat-value">{summary.approvedCount}</strong>
          <small className="erp-adjustments-stat-trend">Awaiting final stock post</small>
        </article>
        <article className="erp-adjustments-stat-card">
          <span className="erp-adjustments-stat-label">Posted</span>
          <strong className="erp-adjustments-stat-value">{summary.postedCount}</strong>
          <small className="erp-adjustments-stat-trend">Already reflected in stock</small>
        </article>
        <article className="erp-adjustments-stat-card">
          <span className="erp-adjustments-stat-label">Net Units</span>
          <strong className="erp-adjustments-stat-value">{formatSignedQuantity(summary.netUnits)}</strong>
          <small className="erp-adjustments-stat-trend">Current movement balance</small>
        </article>
      </section>

      <div className="erp-adjustments-content">
        <section className="erp-adjustments-panel">
          <div className="erp-adjustments-panel-head">
            <div className="erp-adjustments-panel-title">
              <h4>Movement Ledger</h4>
              <p>{totalRecords} entries in the current view</p>
            </div>

            <div className="erp-adjustments-breakdown">
              {summary.topReasons.length ? (
                summary.topReasons.map(([reason, count]) => (
                  <span
                    key={`${reason}-${count}`}
                    className={`erp-adjustment-pill ${getReasonTone(reason)}`}
                  >
                    {reason} {count}
                  </span>
                ))
              ) : (
                <span className="erp-adjustment-pill is-neutral-reason">No activity yet</span>
              )}
            </div>
          </div>

          <div className="erp-adjustments-ledger">
            {records.length ? (
              records.map((record) => {
                const isSelected = String(record.id) === String(selectedAdjustmentId);
                const quantity = Number(record.quantity || 0);
                return (
                  <button
                    key={record.id}
                    type="button"
                  className={`erp-adjustment-row-card ${isSelected ? "is-selected" : ""}`.trim()}
                  onClick={() => onSelectAdjustment(record.id)}
                  disabled={saving}
                >
                    <div className="erp-adjustment-row-head">
                      <div className="erp-adjustment-row-item">
                        <strong>{record.item}</strong>
                        <span>
                          {record.id} {record.sku ? `- ${record.sku}` : ""}
                        </span>
                      </div>
                      <span
                        className={`erp-adjustment-row-qty ${
                          quantity >= 0 ? "is-positive" : "is-negative"
                        }`}
                      >
                        {quantity >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {formatSignedQuantity(quantity)}
                      </span>
                    </div>

                    <div className="erp-adjustment-row-main">
                      <div className="erp-adjustment-row-badges">
                        <span className={`erp-adjustment-pill ${getReasonTone(record.reason)}`}>
                          {record.reason}
                        </span>
                        <span
                          className={`erp-adjustment-pill is-status ${getStatusTone(record.status)}`}
                        >
                          {record.status}
                        </span>
                      </div>

                      <div className="erp-adjustment-row-trail">
                        <span>{record.location}</span>
                        <span>{record.raisedBy}</span>
                        <span>{formatDateTime(record.requestedAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="erp-adjustment-empty">
                <Sparkles size={20} />
                <strong>No matching adjustment entries</strong>
                <p>Try another search term or create a new draft from the panel on the right.</p>
              </div>
            )}
          </div>

          {totalRecords > 0 && (
            <div className="erp-table-pagination erp-adjustments-pagination">
              <div className="erp-page-size-control">
                <span className="erp-page-size-label">Rows</span>
                <select
                  className="erp-adjustments-table-select"
                  value={String(rowsPerPage)}
                  onChange={(event) => onRowsPerPageChange(event.target.value)}
                >
                  {pageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="erp-page-meta">
                {pageStartRecord}-{pageEndRecord} of {totalRecords}
              </span>
              <span className="erp-page-meta">
                Page {safePage} of {totalPages}
              </span>
              <button type="button" className="erp-mini-btn" onClick={onPrevPage} disabled={safePage === 1}>
                Previous
              </button>
              <button
                type="button"
                className="erp-mini-btn"
                onClick={onNextPage}
                disabled={safePage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </section>

        <div className="erp-adjustments-side-stack">
          <section ref={formPanelRef} className="erp-adjustments-panel">
            <div className="erp-adjustments-panel-head">
              <div className="erp-adjustments-panel-title">
                <h4>Quick Capture</h4>
                <p>Draft a new adjustment without leaving this view</p>
              </div>
            </div>

            <form className="erp-adjustments-quick-form" onSubmit={handleSubmit}>
              <div className="erp-adjustments-direction-toggle">
                <button
                  type="button"
                  className={`erp-adjustments-direction-button ${
                    draft.direction === "out" ? "is-active is-negative" : ""
                  }`.trim()}
                  disabled={saving}
                  onClick={() => handleDraftChange("direction", "out")}
                >
                  <ArrowDownRight size={15} />
                  Reduce stock
                </button>
                <button
                  type="button"
                  className={`erp-adjustments-direction-button ${
                    draft.direction === "in" ? "is-active is-positive" : ""
                  }`.trim()}
                  disabled={saving}
                  onClick={() => handleDraftChange("direction", "in")}
                >
                  <ArrowUpRight size={15} />
                  Add stock
                </button>
              </div>

              <div className="erp-adjustments-form-grid">
                <div className="erp-form-field is-span-2">
                  <label>Item Description</label>
                  <input
                    ref={itemInputRef}
                    type="text"
                    value={draft.item}
                    disabled={saving}
                    onChange={(event) => handleDraftChange("item", event.target.value)}
                    placeholder="e.g. Orthopedic Mattress 5x6"
                  />
                </div>
                <div className="erp-form-field">
                  <label>SKU / Lookup Code</label>
                  <input
                    type="text"
                    value={draft.sku}
                    disabled={saving}
                    onChange={(event) => handleDraftChange("sku", event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="erp-form-field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={draft.quantity}
                    disabled={saving}
                    onChange={(event) => handleDraftChange("quantity", event.target.value)}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Reason</label>
                  <select
                    value={draft.reason}
                    disabled={saving}
                    onChange={(event) => handleDraftChange("reason", event.target.value)}
                  >
                    {DEFAULT_REASON_OPTIONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="erp-form-field">
                  <label>Location</label>
                  <select
                    value={draft.location}
                    disabled={saving}
                    onChange={(event) => handleDraftChange("location", event.target.value)}
                  >
                    {DEFAULT_LOCATION_OPTIONS.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="erp-form-field">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={draft.effectiveDate}
                    disabled={saving}
                    onChange={(event) => handleDraftChange("effectiveDate", event.target.value)}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Raised By</label>
                  <input type="text" value={draft.requestedBy} readOnly disabled={saving} />
                </div>
                <div className="erp-form-field is-span-2">
                  <label>Audit Note</label>
                  <textarea
                    rows="4"
                    value={draft.note}
                    disabled={saving}
                    onChange={(event) => handleDraftChange("note", event.target.value)}
                    placeholder="Describe why the adjustment is needed and what changed physically."
                  />
                </div>
              </div>

              {mergedSuggestions.length > 0 && (
                <div className="erp-adjustments-suggestion-row">
                  {mergedSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.sku}-${suggestion.item}`}
                      type="button"
                      className="erp-adjustments-suggestion-chip"
                      disabled={saving}
                      onClick={() => handleSuggestionPick(suggestion)}
                    >
                      {suggestion.item}
                    </button>
                  ))}
                </div>
              )}

              <div className="erp-adjustments-form-actions">
                <button
                  type="button"
                  className="erp-mini-btn"
                  disabled={saving}
                  onClick={() => setDraft(createDraft(currentUserLabel))}
                >
                  Clear Draft
                </button>
                <button type="submit" className="erp-mini-btn erp-mini-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </section>

          <section className="erp-adjustments-panel">
            <div className="erp-adjustments-panel-head">
              <div className="erp-adjustments-panel-title">
                <h4>Selected Detail</h4>
                <p>Approval and stock impact snapshot</p>
              </div>
            </div>

            {selectedRecord ? (
              <div className="erp-adjustments-detail-stack">
                <div className="erp-adjustments-detail-grid">
                  <article className="erp-adjustments-detail-card">
                    <span className="erp-adjustments-detail-label">Movement</span>
                    <strong className="erp-adjustments-detail-value">
                      {formatSignedQuantity(selectedRecord.quantity)} units
                    </strong>
                    <small>{selectedRecord.location}</small>
                  </article>
                  <article className="erp-adjustments-detail-card">
                    <span className="erp-adjustments-detail-label">Raised By</span>
                    <strong className="erp-adjustments-detail-value">{selectedRecord.raisedBy}</strong>
                    <small>{formatDateTime(selectedRecord.requestedAt)}</small>
                  </article>
                  <article className="erp-adjustments-detail-card">
                    <span className="erp-adjustments-detail-label">Status</span>
                    <strong className="erp-adjustments-detail-value">{selectedRecord.status}</strong>
                    <small>
                      {selectedRecord.approvedBy
                        ? `Reviewed by ${selectedRecord.approvedBy}`
                        : "Waiting for reviewer"}
                    </small>
                  </article>
                </div>

                <div className="erp-adjustments-detail-note">
                  <span className="erp-adjustments-detail-label">Audit Note</span>
                  <p>{selectedRecord.note || "No note attached to this adjustment."}</p>
                </div>

                <div className="erp-adjustments-timeline">
                  <div className="erp-adjustments-timeline-item">
                    <strong>Request captured</strong>
                    <span>{formatDateTime(selectedRecord.requestedAt)}</span>
                  </div>
                  <div className="erp-adjustments-timeline-item">
                    <strong>Approval owner</strong>
                    <span>{selectedRecord.approvedBy || "Awaiting assignment"}</span>
                  </div>
                  <div className="erp-adjustments-timeline-item">
                    <strong>Stock posture</strong>
                    <span>{selectedRecord.impact || "Impact note not yet captured"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="erp-adjustment-empty">
                <CheckCircle2 size={20} />
                <strong>No entry selected</strong>
                <p>Choose an adjustment card to see the approval trail and supporting note.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
