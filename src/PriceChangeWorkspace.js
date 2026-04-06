import React from "react";
import { Search } from "lucide-react";

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
  summary,
  records,
  totalRecords,
  selectedPriceChangeId,
  onSelectPriceChange,
  composerMode,
  selectedPriceChangeRecord,
  onOpenCreate,
  onOpenEdit,
  onCloseComposer,
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
  onApprove,
  onApply,
  onCancel,
  actionPending,
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
  const selectedStatus = String(selectedPriceChangeRecord?.status || "").toLowerCase();

  return (
    <div className="erp-price-change-layout">
      <section className="erp-price-change-main">
        <div className="erp-price-change-summary-grid">
          <article className="erp-price-change-summary-card">
            <span>Open</span>
            <strong>{summary.open}</strong>
            <p>Waiting for approval or review.</p>
          </article>
          <article className="erp-price-change-summary-card">
            <span>Approved</span>
            <strong>{summary.approved}</strong>
            <p>Scheduled and waiting for effect date.</p>
          </article>
          <article className="erp-price-change-summary-card">
            <span>Applied</span>
            <strong>{summary.applied}</strong>
            <p>Already written to the live item catalog.</p>
          </article>
          <article className="erp-price-change-summary-card">
            <span>Due Now</span>
            <strong>{summary.approvedDue}</strong>
            <p>Approved changes whose effect date is already due.</p>
          </article>
        </div>

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

      <aside className="erp-price-change-panel">
        {composerMode === "create" || composerMode === "edit" ? (
          <form className="erp-price-change-form" onSubmit={onSave}>
            <div className="erp-price-change-panel-header">
              <div>
                <p className="erp-supplier-details-eyebrow">Price Change Composer</p>
                <h3>{composerMode === "edit" ? "Edit Price Change" : "Create Price Change"}</h3>
                <p className="erp-supplier-details-subtitle">
                  Build scheduled price adjustments and sale offers from live item data.
                </p>
              </div>
            </div>

            <div className="erp-price-change-form-scroll">
              <div className="erp-price-change-form-grid">
                <div className="erp-form-field is-span-2">
                  <label>Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Weekend TV sale"
                    value={form.description}
                    onChange={(event) => onFormChange("description", event.target.value)}
                    required
                  />
                </div>
                <div className="erp-form-field">
                  <label>Effect Date</label>
                  <input
                    type="datetime-local"
                    value={form.effectDate}
                    onChange={(event) => onFormChange("effectDate", event.target.value)}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Type</label>
                  <select
                    className="erp-price-change-select"
                    value={String(form.type)}
                    onChange={(event) => onFormChange("type", event.target.value)}
                  >
                    <option value="0">Standard Price Change</option>
                    <option value="1">Sale Offer</option>
                  </select>
                </div>
                <div className="erp-form-field">
                  <label>Status</label>
                  <select
                    className="erp-price-change-select"
                    value={String(form.status)}
                    onChange={(event) => onFormChange("status", event.target.value)}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Open">Open</option>
                    <option value="Approved">Approved</option>
                  </select>
                </div>
                <div className="erp-form-field">
                  <label>Vendor</label>
                  <input
                    type="text"
                    placeholder="Supplier or brand"
                    value={form.vendor}
                    onChange={(event) => onFormChange("vendor", event.target.value)}
                  />
                </div>
                <div className="erp-form-field">
                  <label>User</label>
                  <input
                    type="text"
                    value={form.user}
                    onChange={(event) => onFormChange("user", event.target.value)}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Purchase Order ID</label>
                  <input
                    type="number"
                    min="0"
                    value={form.purchaseOrderId}
                    onChange={(event) => onFormChange("purchaseOrderId", event.target.value)}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Store ID</label>
                  <input
                    type="number"
                    min="1"
                    value={form.storeId}
                    onChange={(event) => onFormChange("storeId", event.target.value)}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Route ID</label>
                  <input
                    type="number"
                    min="0"
                    value={form.routeId}
                    onChange={(event) => onFormChange("routeId", event.target.value)}
                  />
                </div>
                <div className="erp-form-field is-span-2">
                  <label>Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={(event) => onFormChange("remarks", event.target.value)}
                    placeholder="Optional notes for approval, audit trail, or promotion brief."
                  />
                </div>
                {form.creditNote && (
                  <div className="erp-form-field is-span-2">
                    <label>Credit Note User</label>
                    <input
                      type="text"
                      value={form.creditNoteUser}
                      onChange={(event) => onFormChange("creditNoteUser", event.target.value)}
                    />
                  </div>
                )}
              </div>

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
                <button
                  type="button"
                  className="erp-mini-btn erp-mini-btn-primary"
                  onClick={onAddItem}
                  disabled={lookupPending}
                >
                  {lookupPending ? "Adding..." : "Add Item"}
                </button>
              </div>

              <div className="erp-price-change-lines">
                {form.items.length ? (
                  form.items.map((item) => (
                    <article key={item.rowId} className="erp-price-change-line-card">
                      <div className="erp-price-change-line-header">
                        <div>
                          <strong>{item.description || "New item"}</strong>
                          <p>
                            {item.itemLookupCode || "No code"} · Stock {formatNumber(item.stockAvailable)}
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

                      <div className="erp-price-change-price-grid">
                        {[
                          ["default", "Default"],
                          ["A", "Price A"],
                          ["B", "Price B"],
                          ["C", "Price C"],
                          ["sale", "Sale"],
                          ["cost", "Cost"],
                          ["lowerBound", "Lower Bound"],
                          ["upperBound", "Upper Bound"],
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
                          <label>Quantity</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(event) =>
                              onItemFieldChange(item.rowId, "quantity", event.target.value)
                            }
                          />
                        </div>
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
                        <div className="erp-form-field">
                          <label>Time Start</label>
                          <input
                            type="time"
                            value={item.timeStart}
                            onChange={(event) =>
                              onItemFieldChange(item.rowId, "timeStart", event.target.value)
                            }
                          />
                        </div>
                        <div className="erp-form-field">
                          <label>Time End</label>
                          <input
                            type="time"
                            value={item.timeEnd}
                            onChange={(event) =>
                              onItemFieldChange(item.rowId, "timeEnd", event.target.value)
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
                                onItemFieldChange(item.rowId, "timeBased", event.target.checked)
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
                                onItemFieldChange(item.rowId, "loyaltyBased", event.target.checked)
                              }
                            />
                            <span className="erp-switch-slider" />
                          </span>
                        </label>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="erp-price-change-empty-state">
                    <h4>No items added yet</h4>
                    <p>
                      Add an item lookup code above to pull live pricing and build the change set.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="erp-modal-actions">
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
        ) : selectedPriceChangeRecord ? (
          <>
            <div className="erp-price-change-panel-header">
              <div>
                <p className="erp-supplier-details-eyebrow">Selected Price Change</p>
                <h3>{selectedPriceChangeRecord.description}</h3>
                <p className="erp-supplier-details-subtitle">
                  Effective {formatDateTime(selectedPriceChangeRecord.effect_date)}
                </p>
              </div>
              <span className="erp-supplier-details-id-chip">
                #{selectedPriceChangeRecord.id}
              </span>
            </div>

            <div className="erp-supplier-details-badges">
              <span
                className={`erp-supplier-details-badge ${
                  selectedStatus === "applied"
                    ? "is-good"
                    : selectedStatus === "approved"
                    ? "is-info"
                    : selectedStatus === "cancelled"
                    ? "is-danger"
                    : "is-warning"
                }`}
              >
                {selectedPriceChangeRecord.status || "Open"}
              </span>
              {selectedPriceChangeRecord.flash_price && (
                <span className="erp-supplier-details-badge is-warning">Flash Price</span>
              )}
              {selectedPriceChangeRecord.credit_note && (
                <span className="erp-supplier-details-badge is-neutral">Credit Note</span>
              )}
              {selectedPriceChangeRecord.gl_posted && (
                <span className="erp-supplier-details-badge is-good">GL Posted</span>
              )}
            </div>

            <div className="erp-price-change-action-grid">
              <button
                type="button"
                className="erp-mini-btn"
                onClick={onOpenEdit}
                disabled={actionPending}
              >
                Edit Change
              </button>
              <button
                type="button"
                className="erp-mini-btn"
                onClick={onApprove}
                disabled={actionPending || ["applied", "cancelled"].includes(selectedStatus)}
              >
                Approve
              </button>
              <button
                type="button"
                className="erp-mini-btn erp-mini-btn-primary"
                onClick={onApply}
                disabled={actionPending || selectedStatus === "cancelled"}
              >
                Apply Now
              </button>
              <button
                type="button"
                className="erp-mini-btn erp-mini-btn-danger"
                onClick={onCancel}
                disabled={actionPending || ["applied", "cancelled"].includes(selectedStatus)}
              >
                Cancel Change
              </button>
            </div>

            <div className="erp-price-change-detail-grid">
              <div className="erp-price-change-detail-card">
                <span className="erp-supplier-details-label">Vendor</span>
                <strong>{selectedPriceChangeRecord.vendor || "Not set"}</strong>
              </div>
              <div className="erp-price-change-detail-card">
                <span className="erp-supplier-details-label">User</span>
                <strong>{selectedPriceChangeRecord.user || "Not set"}</strong>
              </div>
              <div className="erp-price-change-detail-card">
                <span className="erp-supplier-details-label">Purchase Order</span>
                <strong>
                  {selectedPriceChangeRecord.purchase_order_id
                    ? selectedPriceChangeRecord.purchase_order_id
                    : "Not linked"}
                </strong>
              </div>
              <div className="erp-price-change-detail-card">
                <span className="erp-supplier-details-label">Items</span>
                <strong>
                  {selectedPriceChangeRecord.total_items ??
                    selectedPriceChangeRecord.items?.length ??
                    0}
                </strong>
              </div>
            </div>

            <section className="erp-supplier-details-section">
              <h4>Remarks</h4>
              <div className="erp-supplier-details-note">
                <span className="erp-supplier-details-label">Notes</span>
                <p>{selectedPriceChangeRecord.remarks || "No remarks added."}</p>
              </div>
            </section>

            <section className="erp-price-change-detail-lines">
              <h4>Item Changes</h4>
              <div className="erp-price-change-detail-lines-list">
                {selectedPriceChangeRecord.items?.length ? (
                  selectedPriceChangeRecord.items.map((item) => (
                    <article
                      key={`${selectedPriceChangeRecord.id}-${item.id}-${item.item_lookup_code}`}
                      className="erp-price-change-detail-line"
                    >
                      <div className="erp-price-change-detail-line-head">
                        <div>
                          <strong>{item.description}</strong>
                          <p>{item.item_lookup_code}</p>
                        </div>
                        <span className="erp-supplier-details-badge is-neutral">
                          Qty {formatNumber(item.quantity)}
                        </span>
                      </div>

                      <div className="erp-price-change-delta-grid">
                        {[
                          ["default", "Default"],
                          ["sale", "Sale"],
                          ["cost", "Cost"],
                        ].map(([field, label]) => (
                          <div key={`${item.item_lookup_code}-${field}`} className="erp-price-change-delta-card">
                            <span>{label}</span>
                            <strong>{formatNumber(item.price?.[field])}</strong>
                            <small>was {formatNumber(item.old_price?.[field])}</small>
                          </div>
                        ))}
                      </div>

                      {(item.sale_start || item.sale_end) && (
                        <p className="erp-price-change-schedule-text">
                          Offer window: {item.sale_start ? formatDateTime(item.sale_start) : "Immediate"} to{" "}
                          {item.sale_end ? formatDateTime(item.sale_end) : "Open ended"}
                        </p>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="erp-price-change-empty-state">
                    <h4>No item lines</h4>
                    <p>This price change does not contain any saved line items.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="erp-price-change-empty-state">
            <h4>Select a price change</h4>
            <p>
              Review saved price adjustments here, or create a fresh change set for new
              promotions and regular price updates.
            </p>
            <button
              type="button"
              className="erp-mini-btn erp-mini-btn-primary"
              onClick={onOpenCreate}
            >
              New Change
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
