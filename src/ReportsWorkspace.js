import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Search, X } from "lucide-react";
import ErpCustomSelect from "./ErpCustomSelect";
import { API_BASE_URL, apiFetch } from "./appConfig";
import "./ReportsWorkspace.css";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const money = value => Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyColumns = new Set(["cost", "price", "sales", "tax", "total", "profit"]);
const fmt = value => Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 });
export const REPORT_TABS = { live: "Live Summary", daily: "Sales trend", products: "Product performance", categories: "Category mix", hourly: "Trading hours", tenders: "Tender mix", eod: "EOD" };

const PRODUCT_REPORTS = {
  top: { label: "Top 100 Selling Products", columns: ["name", "description", "units", "sales"], note: "Ranked by net units sold in the selected period." },
  bottom: { label: "Bottom 100 Selling Products", columns: ["name", "description", "units", "sales"] },
  categories: { label: "Sales by Category", columns: ["name", "units", "sales"] },
  branches: { label: "Sales by Branch", columns: ["name", "receipts", "sales"], note: "Completed receipt totals across configured branches." },
  profitability: { label: "Product Profitability", columns: ["name", "description", "sales", "cost", "profit", "margin", "cost_status"], note: "Recorded item revenue less historical line costs, before tax adjustments. Profit and margin are unavailable when historical costs are missing; cost shows only recorded costs." },
  dead: { label: "Dead Stock Report", columns: ["name", "description", "stock", "units"], note: "Products currently in stock with no positive-quantity sales during the selected period." },
  stock: { label: "Stock vs Sales Report", columns: ["name", "description", "stock", "units", "sales", "days_cover"], note: "Current stock compared with selected-period net sales; days of cover uses average daily net units." },
  daily: { label: "Daily Sales Trend", columns: ["name", "receipts", "sales"] },
  monthly: { label: "Monthly Product Comparison", columns: ["name", "description", "month", "units", "sales"], note: "Product sales grouped by calendar month within the selected dates. Select multiple months to compare; boundary months may be partial." },
  forecast: { label: "Product Sales Forecast", columns: ["name", "description", "units", "daily_units", "forecast_units"], note: "Next 30 days estimate: average daily net units in the selected period ? 30. Does not account for seasonality or stockouts." },
  turnover: { label: "Stock Turnover Report", columns: ["name", "description", "stock", "units", "turnover"], note: "Turnover requires historical average inventory, which is not recorded. Current stock and net units are shown; turnover remains unavailable." },
  hourly: { label: "Sales by Hour", columns: ["name", "receipts", "sales"] },
};
const PRODUCT_HEADINGS = { stock: "Current stock", cost: "Recorded cost", profit: "Profit", margin: "Margin (%)", cost_status: "Cost coverage", days_cover: "Days of cover", month: "Month", daily_units: "Daily units", forecast_units: "Forecast units (30 days)", turnover: "Turnover" };

export default function ReportsWorkspace({ tab = "daily", storeId = 1 }) {
  const dateDialog = useRef(null);
  const [dateRange, setDateRange] = useState(null);
  const [draftFrom, setDraftFrom] = useState(today());
  const [draftTo, setDraftTo] = useState(today());
  function openDates() {
    setDraftFrom(dateRange?.from || today());
    setDraftTo(dateRange?.to || today());
    dateDialog.current.showModal();
  }
  const [productReport, setProductReport] = useState("top");
  const isProducts = tab === "products";
  const productConfig = PRODUCT_REPORTS[productReport];
  const isLive = tab === "live";
  const isEod = tab === "eod";
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState(0);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [showQuality, setShowQuality] = useState(false);
  const [branchName, setBranchName] = useState("");
  useEffect(() => {
    let cancelled = false;
    setBranchName("");
    async function loadBranchName() {
      try {
        const response = await apiFetch(`${API_BASE_URL}/erp/branches`);
        if (!response.ok) throw new Error("Unable to load branch name");
        const branches = await response.json();
        const branch = branches.find(item => Number(item.store_id) === Number(storeId));
        if (!cancelled) setBranchName(branch?.name || "Branch name unavailable");
      } catch {
        if (!cancelled) setBranchName("Branch name unavailable");
      }
    }
    loadBranchName();
    return () => { cancelled = true; };
  }, [storeId]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError("");
      setLoading(true);
      try {
        const to = dateRange?.to || today();
        const from = dateRange?.from || ((isEod || isLive) ? to : `${to.slice(0, 7)}-01`);
        const params = new URLSearchParams({ date_from: from, date_to: to, store_id: String(storeId) });
        if (isLive) { params.set("page", String(page)); params.set("page_size", String(rowsPerPage)); params.set("search", search); }
        if (isProducts) params.set("report", productReport);
        const options = window.api?.http?.request ? undefined : { signal: controller.signal };
        const res = await apiFetch(`${API_BASE_URL}/erp/reports/${isLive ? "live-summary" : isProducts ? "product-performance" : "business"}?${params}`, options);
        const result = await res.json();
        if (!res.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Unable to load reports.");
        if (!controller.signal.aborted) setData(result);
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    const timer = setTimeout(load, 300);
    const refresh = isLive ? setInterval(load, 15000) : null;
    return () => { clearTimeout(timer); clearInterval(refresh); controller.abort(); };
  }, [isEod, isLive, storeId, request, page, rowsPerPage, search, dateRange, isProducts, productReport]);
  useEffect(() => { setData(null); setPage(1); }, [tab, storeId]);
  useEffect(() => setPage(1), [search, rowsPerPage, productReport]);
  const rows = useMemo(() => {
    if (tab === "live") return data?.live || [];
    if (tab === "products") return (data?.product_reports?.[productReport] || []).filter(row => Object.values(row).join(" ").toLowerCase().includes(search.toLowerCase()));
    const summary = data?.summary;
    const source = tab === "eod" ? (summary ? [
      { name: "Receipt sales (KES)", value: summary.sales },
      { name: "Completed receipts", value: summary.receipts },
      { name: "Recorded tax (KES)", value: summary.tax },
      { name: "Sales less recorded tax (KES)", value: summary.sales - summary.tax },
      { name: "Average basket (KES)", value: summary.average_basket },
      { name: "Net units sold", value: summary.units },
      { name: "Recorded discounts (KES)", value: summary.recorded_discounts },
      { name: "Negative-quantity item value (KES)", value: summary.returned_item_value },
      ...(data.tenders || []).map(t => ({ name: `Recorded tender: ${t.name} (KES)`, value: t.sales })),
    ] : []) : data?.[tab] || [];
    return source.filter(r => `${r.name} ${r.description || ""}`.toLowerCase().includes(search.toLowerCase()));
  }, [data, tab, search, productReport]);
  const columns = isLive ? ["receipt", "batch", "time", "tax", "total", "tender_mix", "cashier"] : isEod ? ["name", "value"] : isProducts ? productConfig.columns : ["name", "sales", tab === "categories" ? "units" : "receipts"];
  function exportCsv() {
    const escape = value => `"${String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
    const content = [columns, ...rows.map(r => columns.map(c => moneyColumns.has(c) && r[c] != null ? Number(r[c]).toFixed(2) : r[c]))].map(r => r.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${isProducts ? productReport : tab}-branch-${String(branchName || "branch").replace(/[^a-z0-9_-]+/gi, "_")}-${data.date_from || today()}-${data.date_to || today()}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  const s = data?.summary;
  const rowCount = isLive ? (data?.total || 0) : rows.length;
  const totalPages = Math.max(1, Math.ceil(rowCount / rowsPerPage));
  const safePage = isLive ? (data?.page || page) : Math.min(page, totalPages);
  const visibleRows = isLive ? rows : rows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
  const startIndex = (safePage - 1) * rowsPerPage;
  const pageOptions = [25, 50, 100, 250].map(value => ({ value: String(value), label: String(value) }));
  const heading = column => PRODUCT_HEADINGS[column] || ({ receipt: "Receipt number", batch: "Batch", time: "Time (Africa/Nairobi)", tax: "Tax (KES)", total: "Total (KES)", tender_mix: "Tender mix", cashier: "Cashier" })[column] || (column === "value" ? "Value" : column === "name" && isEod ? "EOD summary" : column === "sales" ? (tab === "tenders" ? "Recorded payment (KES)" : "Sales (KES)") : column === "name" ? (isProducts ? ({ categories: "Category", branches: "Branch", daily: "Date", hourly: "Hour" }[productReport] || "Itemcode") : "Name / ID") : column === "units" ? "Units" : column === "receipts" ? "Receipts" : "Description");
  return <div className="erp-management-content erp-reports-content">
    <dialog ref={dateDialog} className="erp-report-date-dialog" aria-labelledby="report-date-title">
      <form onSubmit={event => { event.preventDefault(); setPage(1); setData(null); setDateRange({ from: draftFrom, to: draftTo }); dateDialog.current.close(); }}>
        <div className="erp-report-date-header">
          <h2 id="report-date-title"><CalendarDays size={16} /> Report dates</h2>
          <button type="button" className="erp-report-date-close" aria-label="Close date selector" onClick={() => dateDialog.current.close()}><X size={20} /></button>
        </div>
        <fieldset className="erp-report-date-fields">
          <legend>Select a range of dates</legend>
          <label>Start date<input autoFocus required type="date" value={draftFrom} max={draftTo || undefined} onChange={event => setDraftFrom(event.target.value)} /></label>
          <label>End date<input required type="date" value={draftTo} min={draftFrom || undefined} onChange={event => setDraftTo(event.target.value)} /></label>
        </fieldset>
        <div className="erp-report-date-actions">
          <button type="button" className="erp-report-date-reset" onClick={() => { setPage(1); setData(null); setDateRange(null); dateDialog.current.close(); }}>{isLive ? "Today" : "Default dates"}</button>
          <button type="submit" className="erp-mini-btn" disabled={!draftFrom || !draftTo || draftFrom > draftTo}>Proceed</button>
          <button type="button" className="erp-report-date-cancel" onClick={() => dateDialog.current.close()}>Cancel</button>
        </div>
      </form>
    </dialog>
    <div className={`erp-search-wrap ${isProducts ? "erp-product-toolbar" : ""}`}>
      <div className="erp-search-input-group">
        <span className="erp-search-icon-wrap" aria-hidden="true"><Search size={16} strokeWidth={2.2} className="erp-search-icon" /></span>
        <input className="erp-search-input" type="text" aria-label="Search report" placeholder={`Search ${REPORT_TABS[tab].toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {isProducts && <div className="erp-product-report-select" role="group" aria-label="Product report"><ErpCustomSelect value={productReport} options={Object.entries(PRODUCT_REPORTS).map(([value, config]) => ({ value, label: config.label }))} onChange={value => { setData(null); setPage(1); setProductReport(value); }} /></div>}
      <div className="erp-search-actions">
        <button type="button" className={`erp-mini-btn erp-report-calendar ${dateRange ? "is-active" : ""}`} onClick={openDates} aria-label="Choose report dates" title="Choose report dates"><CalendarDays size={18} /></button>
        <button type="button" className="erp-mini-btn" onClick={exportCsv} disabled={!data || !rows.length}>{isLive || isProducts ? "CSV" : "Export CSV"}</button>
        {isLive ? <>
          <output className="erp-mini-btn erp-report-money" aria-label="Total for matching transactions">Total: {s ? money(s.sales) : "—"}</output>
          <output className="erp-mini-btn erp-report-money" aria-label="Tax for matching transactions">Tax: {s ? money(s.tax) : "—"}</output>
        </> : <button type="button" className="erp-mini-btn" onClick={() => setRequest(n => n + 1)} disabled={loading}>Refresh</button>}
        {!isLive && <button type="button" className="erp-mini-btn" onClick={() => setShowQuality(v => !v)} aria-expanded={showQuality}>Data quality</button>}
      </div>
    </div>
    {loading && <p className="erp-table-status" role="status">Loading reports...</p>}
    {error && <p className="erp-table-status erp-table-status-error" role="alert">{error}</p>}
    {!isLive && showQuality && s && <div className="erp-report-quality">
      <p>Receipt total less item sales: KES {fmt(s.reconciliation_gap)}. Tax, rounding or missing lines can cause differences.</p>
      <p>{fmt(s.missing_cost_lines)} lines lack positive recorded costs. Recorded costs: KES {fmt(s.recorded_cost)} against KES {fmt(s.covered_item_sales)} covered item sales. Profit requires reliable historical costs and tax treatment.</p>
      <p>{fmt(s.receipts_without_items)} receipts without items; {fmt(s.duplicate_receipt_ids)} duplicate receipt IDs. Tender payments may include cash given before change.</p>
    </div>}
    <div className="erp-table-region"><div className="erp-table-layout"><div className="erp-table-shell">
      <div className="erp-table-wrap">
        <table className={`erp-data-table ${isLive ? "is-live-summary" : ""}`}><thead><tr>{columns.map(c => <th key={c}>{heading(c)}</th>)}</tr></thead>
          <tbody>{visibleRows.map(r => <tr key={isLive ? r.id : `${r.name}-${r.month || ""}`}>{columns.map(c => <td key={c} className={moneyColumns.has(c) || (isEod && c === "value" && r.name.includes("KES")) ? "erp-report-money" : undefined}>{isLive && c === "time" && !Number.isNaN(Date.parse(r[c])) ? new Date(r[c]).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : typeof r[c] === "number" ? (moneyColumns.has(c) || (isEod && c === "value" && r.name.includes("KES")) ? money(r[c]) : fmt(r[c])) : (r[c] ?? "?")}</td>)}</tr>)}
            {!rows.length && <tr><td colSpan={columns.length} className="erp-table-empty">{loading ? "Loading reports..." : error ? "Report unavailable." : "No matching records."}</td></tr>}
          </tbody>
        </table>
      </div>
      {(isLive || data || rows.length > 0) && <div className="erp-table-pagination">
        <div className="erp-page-size-control"><span className="erp-page-size-label">Rows</span><ErpCustomSelect value={String(rowsPerPage)} options={pageOptions} onChange={value => setRowsPerPage(Number(value))} /></div>
        {isLive && <span className="erp-report-footer erp-page-meta"><span className="erp-report-date-range">{data?.date_from || today()} to {data?.date_to || today()}</span> | {branchName || "Loading branch..."} | Refreshes every 15 seconds</span>}
        {!isLive && data && <span className="erp-report-footer erp-page-meta">{isEod ? "EOD - today's activity" : dateRange ? "Selected period" : "Month to date"}: <span className="erp-report-date-range">{data.date_from} to {data.date_to}</span> | {branchName || "Loading branch..."} | Africa/Nairobi{isEod ? " | Live summary" : ""}</span>}
        <span className="erp-page-meta">{rowCount ? startIndex + 1 : 0}-{Math.min(startIndex + rowsPerPage, rowCount)} of {rowCount}</span>
        <span className="erp-page-meta">Page {safePage} of {totalPages}</span>
        <button type="button" className="erp-mini-btn" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
        <button type="button" className="erp-mini-btn" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
      </div>}
    </div></div></div>
  </div>;
}
