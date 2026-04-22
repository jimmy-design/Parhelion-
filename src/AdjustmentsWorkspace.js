import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
  X,
} from "lucide-react";
import ErpCustomSelect from "./ErpCustomSelect";

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

function normalizeAdjustmentItemSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function buildAdjustmentItemSearchResult(items, query) {
  const normalizedQuery = normalizeAdjustmentItemSearch(query);
  if (!normalizedQuery) {
    return {
      match: null,
      status: "idle",
      message: "Search by item lookup code, barcode, or description.",
    };
  }

  const catalog = Array.isArray(items) ? items : [];
  const exactMatch =
    catalog.find((item) => {
      const lookupCode = normalizeAdjustmentItemSearch(item?.lookup_code);
      const barcode = normalizeAdjustmentItemSearch(item?.alias);
      const description = normalizeAdjustmentItemSearch(item?.description);
      return (
        normalizedQuery === lookupCode ||
        normalizedQuery === barcode ||
        normalizedQuery === description
      );
    }) || null;

  if (exactMatch) {
    return {
      match: exactMatch,
      status: "matched",
      message: `Matched ${String(exactMatch?.description || exactMatch?.lookup_code || "item").trim()}.`,
    };
  }

  const partialMatches = catalog.filter((item) => {
    const lookupCode = normalizeAdjustmentItemSearch(item?.lookup_code);
    const barcode = normalizeAdjustmentItemSearch(item?.alias);
    const description = normalizeAdjustmentItemSearch(item?.description);
    return (
      lookupCode.includes(normalizedQuery) ||
      barcode.includes(normalizedQuery) ||
      description.includes(normalizedQuery)
    );
  });

  if (partialMatches.length === 1) {
    return {
      match: partialMatches[0],
      status: "matched",
      message: `Matched ${String(partialMatches[0]?.description || partialMatches[0]?.lookup_code || "item").trim()}.`,
    };
  }

  if (partialMatches.length > 1) {
    return {
      match: null,
      status: "multiple",
      message: `${partialMatches.length} items match. Keep typing to narrow the search.`,
    };
  }

  return {
    match: null,
    status: "missing",
    message: "No item found. Check the lookup code, barcode, or description.",
  };
}

function formatAdjustmentItemMatch(item) {
  const description = String(item?.description || item?.lookup_code || "Item").trim();
  const lookupCode = String(item?.lookup_code || "").trim();
  const barcode = String(item?.alias || "").trim();

  return [
    description,
    lookupCode ? `Code ${lookupCode}` : "",
    barcode ? `Barcode ${barcode}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

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
  inventoryItems,
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
  const [itemSearch, setItemSearch] = React.useState("");
  const [showStatCards, setShowStatCards] = React.useState(false);
  const [showSelectedDetail, setShowSelectedDetail] = React.useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = React.useState(false);
  const itemInputRef = React.useRef(null);
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
      setIsQuickCaptureOpen(true);
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

  React.useEffect(() => {
    if (!isQuickCaptureOpen) return undefined;

    const timer = window.setTimeout(() => itemInputRef.current?.focus(), 120);
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsQuickCaptureOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isQuickCaptureOpen]);

  const selectedRecord =
    (Array.isArray(summaryRecords) ? summaryRecords : []).find(
      (record) => String(record.id) === String(selectedAdjustmentId)
    ) || null;

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

  const itemSearchResult = React.useMemo(
    () => buildAdjustmentItemSearchResult(inventoryItems, itemSearch),
    [inventoryItems, itemSearch]
  );

  const handleDraftChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemSearchChange = (value) => {
    setItemSearch(value);

    const result = buildAdjustmentItemSearchResult(inventoryItems, value);
    if (!result.match) return;

    setDraft((prev) => ({
      ...prev,
      item: String(result.match?.description || "").trim(),
      sku: String(result.match?.lookup_code || "").trim(),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const createdRecord = await onSaveAdjustment(draft);
    if (!createdRecord) return;
    setDraft(createDraft(currentUserLabel));
    setItemSearch("");
    setIsQuickCaptureOpen(false);
  };

  const handleAdjustmentSelect = (adjustmentId) => {
    setShowStatCards(true);
    setShowSelectedDetail(true);
    onSelectAdjustment(adjustmentId);
  };

  const handleOpenQuickCapture = () => {
    setIsQuickCaptureOpen(true);
  };

  const handleCloseQuickCapture = () => {
    setIsQuickCaptureOpen(false);
  };

  const handleClearDraft = () => {
    setDraft(createDraft(currentUserLabel));
    setItemSearch("");
    itemInputRef.current?.focus();
  };

  const statCards = [
    {
      id: "pending",
      label: "Pending",
      value: summary.pendingCount,
      hint: "Need review before posting",
      tone: "is-warning",
    },
    {
      id: "approved",
      label: "Approved",
      value: summary.approvedCount,
      hint: "Awaiting final stock post",
      tone: "is-info",
    },
    {
      id: "posted",
      label: "Posted",
      value: summary.postedCount,
      hint: "Already reflected in stock",
      tone: "is-success",
    },
    {
      id: "net-units",
      label: "Net Units",
      value: formatSignedQuantity(summary.netUnits),
      hint: "Current movement balance",
      tone:
        summary.netUnits < 0 ? "is-negative" : summary.netUnits > 0 ? "is-positive" : "is-neutral",
    },
  ];

  return (
    <div className="erp-adjustments-layout">
      {showStatCards && (
        <section className="erp-adjustments-stats">
          {statCards.map((card) => (
            <article key={card.id} className={`erp-adjustments-stat-card ${card.tone}`.trim()}>
              <span className="erp-adjustments-stat-label">{card.label}</span>
              <strong className="erp-adjustments-stat-value">{card.value}</strong>
              <small className="erp-adjustments-stat-trend">{card.hint}</small>
            </article>
          ))}
        </section>
      )}

      <div className="erp-adjustments-content">
        <section className="erp-adjustments-ledger-panel">
          <div className="erp-adjustments-ledger">
            {records.length ? (
              <div className="erp-table-shell erp-adjustments-ledger-shell">
                <div className="erp-table-wrap erp-adjustments-ledger-wrap">
                  <table className="erp-data-table erp-adjustments-ledger-table">
                    <thead>
                      <tr>
                        <th>Ref</th>
                        <th>Lookup</th>
                        <th>Item Description</th>
                        <th>Qty</th>
                        <th>Location</th>
                        <th>Raised By</th>
                        <th>Requested</th>
                        <th>Status</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => {
                        const isSelected = String(record.id) === String(selectedAdjustmentId);
                        const quantity = Number(record.quantity || 0);

                        return (
                          <tr
                            key={record.id}
                            role="button"
                            tabIndex={saving ? -1 : 0}
                            aria-selected={isSelected}
                            aria-disabled={saving}
                            className={isSelected ? "is-selected-row" : ""}
                            onClick={() => {
                              if (!saving) {
                                handleAdjustmentSelect(record.id);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (saving) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleAdjustmentSelect(record.id);
                              }
                            }}
                          >
                            <td className="erp-adjustments-ledger-ref">{record.id}</td>
                            <td>{record.sku || "N/A"}</td>
                            <td className="erp-adjustments-ledger-item">
                              <strong>{record.item}</strong>
                            </td>
                            <td>
                              <span
                                className={`erp-adjustment-row-qty ${
                                  quantity >= 0 ? "is-positive" : "is-negative"
                                }`}
                              >
                                {quantity >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                {formatSignedQuantity(quantity)}
                              </span>
                            </td>
                            <td>{record.location}</td>
                            <td>{record.raisedBy}</td>
                            <td>{formatDateTime(record.requestedAt)}</td>
                            <td>
                              <span className={`erp-adjustment-pill is-status ${getStatusTone(record.status)}`}>
                                {record.status}
                              </span>
                            </td>
                            <td>
                              <span className={`erp-adjustment-pill ${getReasonTone(record.reason)}`}>
                                {record.reason}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalRecords > 0 && (
                  <div className="erp-table-pagination">
                    <div className="erp-page-size-control">
                      <span className="erp-page-size-label">Rows</span>
                      <ErpCustomSelect
                        value={String(rowsPerPage)}
                        options={pageOptions}
                        onChange={onRowsPerPageChange}
                      />
                    </div>
                    <span className="erp-page-meta">
                      {pageStartRecord}-{pageEndRecord} of {totalRecords}
                    </span>
                    <span className="erp-page-meta">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="erp-mini-btn"
                      onClick={onPrevPage}
                      disabled={safePage === 1}
                    >
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
              </div>
            ) : (
              <div className="erp-adjustment-empty">
                <Sparkles size={20} />
                <strong>No matching adjustment entries</strong>
                <p>Try another search term or open Quick Capture to raise a new adjustment.</p>
                <button
                  type="button"
                  className="erp-mini-btn erp-mini-btn-primary"
                  disabled={saving}
                  onClick={handleOpenQuickCapture}
                >
                  Open Quick Capture
                </button>
              </div>
            )}
          </div>
        </section>
        {showSelectedDetail && selectedRecord && (
          <section className="erp-adjustments-panel erp-adjustments-detail-panel">
            <div className="erp-adjustments-panel-head">
              <div className="erp-adjustments-panel-title">
                <h4>Selected Detail</h4>
                <p>Approval and stock impact snapshot</p>
              </div>
            </div>

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

              <div className="erp-adjustments-detail-lower">
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
            </div>
          </section>
        )}
      </div>

      {isQuickCaptureOpen && (
        <div className="erp-modal-overlay erp-adjustments-modal-overlay" onClick={handleCloseQuickCapture}>
          <div
            className="erp-modal-card erp-adjustments-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Quick Capture"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="erp-modal-header">
              <h3>Quick Capture</h3>
              <div className="erp-window-controls">
                <button
                  type="button"
                  className="erp-window-btn erp-window-btn-close"
                  onClick={handleCloseQuickCapture}
                  aria-label="Close quick capture"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            <div className="erp-adjustments-modal-body">
              <div className="erp-adjustments-panel-search erp-adjustments-modal-search">
                <input
                  ref={itemInputRef}
                  type="text"
                  value={itemSearch}
                  disabled={saving}
                  autoComplete="off"
                  onChange={(event) => handleItemSearchChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                    }
                  }}
                  placeholder="Find item by lookup code, barcode, or description"
                />
                <small className={`erp-adjustments-item-search-help is-${itemSearchResult.status}`.trim()}>
                  {itemSearchResult.match
                    ? formatAdjustmentItemMatch(itemSearchResult.match)
                    : itemSearchResult.message}
                </small>
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

                <div className="erp-adjustments-form-actions">
                  <button
                    type="button"
                    className="erp-mini-btn"
                    disabled={saving}
                    onClick={handleClearDraft}
                  >
                    Clear Draft
                  </button>
                  <button type="submit" className="erp-mini-btn erp-mini-btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Adjustment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
