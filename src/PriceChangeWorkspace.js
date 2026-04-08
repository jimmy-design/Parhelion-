import React from "react";
import { Search, X } from "lucide-react";

function formatDateTime(value) {
  if (!value) return "Immediate";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export default function PriceChangeWorkspace({
  records,
  totalRecords,
  selectedPriceChangeId,
  onSelectPriceChange,
  composerMode,
  onCloseComposer,
  onImport,
  onOpenHistory,
  onOpenLogs,
  form,
  onFormChange,
  onItemFieldChange,
  onItemPriceChange,
  lookupValue,
  onLookupValueChange,
  lookupPending,
  onAddItem,
  lookupInputRef,
  onRemoveItem,
  onSave,
  saving,
  rowsPerPage,
  pageOptions,
  onRowsPerPageChange,
  pageStartRecord,
  pageEndRecord,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
  tableWrapRef,
}) {
  const isComposerMode = composerMode === "create" || composerMode === "edit";
  const composerScrollRef = React.useRef(null);

  React.useLayoutEffect(() => {
    if (isComposerMode && composerScrollRef.current) {
      composerScrollRef.current.scrollTop = 0;
    }
  }, [isComposerMode, form.items.length]);

  return (
    <>
      <div className="erp-price-change-layout">
        <section className="erp-price-change-main">
          <div className="erp-table-layout">
            <div className="erp-table-wrap" ref={tableWrapRef}>
              <table className="erp-data-table is-price-change-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Description</th>
                    <th>Vendor</th>
                    <th>Effective</th>
                    <th>Items</th>
                    <th>Status</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((priceChange, rowIndex) => {
                    const isSelected =
                      Number(selectedPriceChangeId) === Number(priceChange.id);
                    return (
                      <tr
                        key={`price-change-${rowIndex}-${priceChange.id}`}
                        className={isSelected ? "is-selected-row" : ""}
                        onClick={() => onSelectPriceChange(Number(priceChange.id))}
                      >
                        <td>{String(priceChange.id || "")}</td>
                        <td>{priceChange.description || ""}</td>
                        <td>{priceChange.vendor || "--"}</td>
                        <td>{formatDateTime(priceChange.effect_date)}</td>
                        <td>
                          {String(
                            priceChange.total_items ?? priceChange.items?.length ?? 0
                          )}
                        </td>
                        <td>{priceChange.status || "Open"}</td>
                        <td>{priceChange.user || "--"}</td>
                      </tr>
                    );
                  })}
                  {totalRecords === 0 && (
                    <tr>
                      <td colSpan="7" className="erp-table-empty">
                        No price changes found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalRecords > 0 && (
              <div className="erp-table-pagination">
                <div className="erp-page-size-control">
                  <span className="erp-page-size-label">Rows</span>
                  <select
                    className="erp-price-change-select"
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
        </section>
      </div>

      {isComposerMode && (
        <div
          className="erp-modal-overlay erp-price-change-modal-overlay"
          onClick={onCloseComposer}
        >
          <div
            className="erp-modal-card erp-price-change-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="erp-modal-header">
              <div className="erp-price-change-modal-title">
                <p className="erp-supplier-details-eyebrow">Price Change</p>
                <h3>{composerMode === "edit" ? "Edit Change" : "New Change"}</h3>
              </div>
              <div className="erp-window-controls">
                <button
                  type="button"
                  className="erp-window-btn erp-window-btn-close"
                  onClick={onCloseComposer}
                  aria-label="Close price change composer"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <form className="erp-price-change-form" onSubmit={onSave}>
              <div className="erp-price-change-form-scroll" ref={composerScrollRef}>
                <div className="erp-price-change-toggle-grid">
                  {[
                    ["flashPrice", "Flash price"],
                    ["creditNote", "Credit note"],
                    ["glPosted", "GL posted"],
                    ["viewed", "Viewed"],
                  ].map(([key, label]) => (
                    <label key={key} className="erp-switch-field">
                      <span>{label}</span>
                      <span className="erp-switch">
                        <input
                          type="checkbox"
                          checked={Boolean(form[key])}
                          onChange={(event) => onFormChange(key, event.target.checked)}
                        />
                        <span className="erp-switch-slider" />
                      </span>
                    </label>
                  ))}
                </div>

                <div className="erp-price-change-item-toolbar">
                  <div className="erp-search-input-group">
                    <span className="erp-search-icon-wrap" aria-hidden="true">
                      <Search size={16} strokeWidth={2.2} className="erp-search-icon" />
                    </span>
                    <input
                      ref={lookupInputRef}
                      className="erp-search-input"
                      type="text"
                      value={lookupValue}
                      onChange={(event) => onLookupValueChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          onAddItem();
                        }
                      }}
                      placeholder="Scan or enter item code to add a pricing line..."
                    />
                  </div>
                  <div className="erp-price-change-toolbar-actions">
                    <button
                      type="button"
                      className="erp-mini-btn"
                      onClick={onImport}
                    >
                      Import
                    </button>
                    <button
                      type="button"
                      className="erp-mini-btn erp-mini-btn-primary"
                      onClick={onAddItem}
                      disabled={lookupPending}
                    >
                      {lookupPending ? "Adding..." : "Add Item"}
                    </button>
                  </div>
                </div>

                <div className="erp-price-change-lines">
                  {form.items.length ? (
                    form.items.map((item) => (
                      <article key={item.rowId} className="erp-price-change-line-card">
                        <div className="erp-price-change-line-header">
                          <div>
                            <strong>{item.description || "New item"}</strong>
                            <p>
                              {item.itemLookupCode || "No code"} - Stock{" "}
                              {formatNumber(item.stockAvailable)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="erp-mini-btn erp-mini-btn-danger"
                            onClick={() => onRemoveItem(item.rowId)}
                          >
                            Remove
                          </button>
                        </div>

                        <div className="erp-price-change-line-body">
                          <div className="erp-price-change-price-grid">
                            {[
                              ["default", "Default"],
                              ["sale", "Sale"],
                              ["cost", "Cost"],
                            ].map(([field, label]) => (
                              <div key={`${item.rowId}-${field}`} className="erp-form-field">
                                <label>{label}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.price[field]}
                                  onChange={(event) =>
                                    onItemPriceChange(item.rowId, field, event.target.value)
                                  }
                                />
                                <span className="erp-price-change-old-value">
                                  Was {formatNumber(item.oldPrice[field])}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="erp-price-change-meta-grid">
                            <div className="erp-form-field">
                              <label>Sale Start</label>
                              <input
                                type="datetime-local"
                                value={item.saleStart}
                                onChange={(event) =>
                                  onItemFieldChange(item.rowId, "saleStart", event.target.value)
                                }
                              />
                            </div>
                            <div className="erp-form-field">
                              <label>Sale End</label>
                              <input
                                type="datetime-local"
                                value={item.saleEnd}
                                onChange={(event) =>
                                  onItemFieldChange(item.rowId, "saleEnd", event.target.value)
                                }
                              />
                            </div>
                          </div>

                          <div className="erp-price-change-toggle-grid is-compact">
                            <label className="erp-switch-field">
                              <span>Time based</span>
                              <span className="erp-switch">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.timeBased)}
                                  onChange={(event) =>
                                    onItemFieldChange(
                                      item.rowId,
                                      "timeBased",
                                      event.target.checked
                                    )
                                  }
                                />
                                <span className="erp-switch-slider" />
                              </span>
                            </label>
                            <label className="erp-switch-field">
                              <span>Loyalty based</span>
                              <span className="erp-switch">
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.loyaltyBased)}
                                  onChange={(event) =>
                                    onItemFieldChange(
                                      item.rowId,
                                      "loyaltyBased",
                                      event.target.checked
                                    )
                                  }
                                />
                                <span className="erp-switch-slider" />
                              </span>
                            </label>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="erp-price-change-empty-state">
                      <h4>No items added yet</h4>
                    </div>
                  )}
                </div>
              </div>

              <div className="erp-modal-actions">
                <button
                  type="button"
                  className="erp-footer-btn erp-footer-btn-secondary"
                  onClick={onOpenHistory}
                >
                  Price Change History
                </button>
                <button
                  type="button"
                  className="erp-footer-btn erp-footer-btn-secondary"
                  onClick={onOpenLogs}
                >
                  Price Change Logs
                </button>
                <button
                  type="button"
                  className="erp-footer-btn erp-footer-btn-secondary"
                  onClick={onCloseComposer}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="erp-footer-btn erp-footer-btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Price Change"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
