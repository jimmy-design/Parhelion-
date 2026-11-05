import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL, apiFetch } from "./appConfig";
import "./ReportsWorkspace.css";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const fmt = value => Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 });
const tabs = { daily: "Sales trend", products: "Product performance", categories: "Category mix", hourly: "Trading hours", cashiers: "Cashier performance", tenders: "Tender mix" };

export default function ReportsWorkspace() {
  const [from, setFrom] = useState(() => `${today().slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [store, setStore] = useState("1");
  const [tab, setTab] = useState("daily");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setData(null); setError("");
      if (!from || !to || from > to || Number(store) < 1) { setError("Choose valid dates and a branch ID."); setLoading(false); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams({ date_from: from, date_to: to, store_id: store });
        const options = window.api?.http?.request ? undefined : { signal: controller.signal };
        const res = await apiFetch(`${API_BASE_URL}/erp/reports/business?${params}`, options);
        const result = await res.json();
        if (!res.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Unable to load reports.");
        if (!controller.signal.aborted) setData(result);
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    const timer = setTimeout(load, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [from, to, store, request]);
  useEffect(() => setPage(1), [tab, search, data]);
  const rows = useMemo(() => (data?.[tab] || []).filter(r => `${r.name} ${r.description || ""}`.toLowerCase().includes(search.toLowerCase())), [data, tab, search]);
  const columns = tab === "products" ? ["name", "description", "sales", "units"] : ["name", "sales", ["categories"].includes(tab) ? "units" : "receipts"];
  function exportCsv() {
    const escape = value => `"${String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
    const content = [columns, ...rows.map(r => columns.map(c => r[c]))].map(r => r.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${tab}-branch-${data.store_id}-${data.date_from}-${data.date_to}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  const s = data?.summary;
  const change = data?.previous.sales ? ((s.sales - data.previous.sales) / Math.abs(data.previous.sales)) * 100 : null;
  const max = Math.max(1, ...(data?.daily || []).map(r => Math.abs(r.sales)));
  return <div className="bi-workspace">
    <div className="bi-heading"><div><span className="bi-eyebrow">BUSINESS INTELLIGENCE</span><h2>Know what drives your business</h2><p>Completed transactions · Kenya shillings · Africa/Nairobi</p></div><button onClick={() => setRequest(n => n + 1)} disabled={loading}>Refresh reports</button></div>
    <div className="bi-filters"><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Through<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label><label>Branch ID<input type="number" min="1" step="1" value={store} onChange={e => setStore(e.target.value)} /></label></div>
    {loading && <p role="status">Reading transaction and item records…</p>}
    {error && <p className="bi-error" role="alert">{error}</p>}
    {s && <>
      <div className="bi-kpis">{[["Receipt sales", `KES ${fmt(s.sales)}`, change === null ? "No prior sales baseline" : `${change.toFixed(1)}% vs previous equal period`], ["Completed receipts", fmt(s.receipts), "Status 1 only"], ["Average basket", `KES ${fmt(s.average_basket)}`, "Receipt sales / receipts"], ["Net units sold", fmt(s.units), "Includes negative item quantities"], ["Recorded tax", `KES ${fmt(s.tax)}`, "From receipt tax fields"], ["Recorded discounts", `KES ${fmt(s.recorded_discounts)}`, "Positive FullPrice less Price only"]].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
      <div className="bi-panels"><article className="bi-panel"><h3>Daily sales pulse</h3><div className="bi-chart" aria-label="Daily receipt sales">{data.daily.map(r => <div key={r.name} title={`${r.name}: KES ${fmt(r.sales)}`}><i style={{ height: `${Math.max(1, Math.abs(r.sales) / max * 100)}%`, background: r.sales < 0 ? "#e46a64" : undefined }} /><small>{r.name.slice(5)}</small></div>)}</div><p>Hover over a bar for the date and amount. Negative days appear in red.</p></article>
      <article className="bi-panel"><h3>Business signals</h3><p>{s.receipts ? `Top product: ${data.products[0]?.description || "No linked items"}.` : "No completed receipts in this period."}</p><p>{data.hourly.some(r => r.receipts) ? `Busiest hour by sales: ${[...data.hourly].sort((a,b) => b.sales-a.sales)[0].name}. Use trading hours to plan staffing.` : "Trading-hour signals appear when sales are available."}</p><p>Negative-quantity item value: <b>KES {fmt(s.returned_item_value)}</b>. Review returns separately from receipt sales.</p><p>Previous period sales: <b>KES {fmt(data.previous.sales)}</b> from {fmt(data.previous.receipts)} receipts.</p></article></div>
      <article className="bi-quality"><h3>Financial data quality</h3><p>Receipt total less item quantity × price: <b>KES {fmt(s.reconciliation_gap)}</b>. Tax treatment, rounding, incomplete lines or receipt adjustments can cause differences.</p><p><b>{fmt(s.missing_cost_lines)}</b> item lines have no positive recorded cost. Recorded cost on covered lines: KES {fmt(s.recorded_cost)} against KES {fmt(s.covered_item_sales)} item sales. Profit is unavailable until historical costs and tax treatment are reliable.</p><p>{fmt(s.receipts_without_items)} receipts without linked items · {fmt(s.duplicate_receipt_ids)} duplicate receipt identifiers. Tender amounts are recorded payments and may include cash given before change; they are not sales revenue.</p></article>
      <div className="bi-tabs" role="tablist" aria-label="Business reports">{Object.entries(tabs).map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
      <article className="bi-panel"><div className="bi-table-tools"><h3>{tabs[tab]}</h3><input aria-label="Search report" placeholder="Search this report…" value={search} onChange={e => setSearch(e.target.value)} /><button onClick={exportCsv} disabled={!rows.length}>Export CSV</button></div><div className="bi-table-scroll"><table><thead><tr>{columns.map(c => <th key={c}>{c === "sales" ? (tab === "tenders" ? "Recorded payment (KES)" : "Sales (KES)") : c === "name" ? "Name / ID" : c}</th>)}</tr></thead><tbody>{rows.slice((page-1)*50, page*50).map(r => <tr key={r.name}>{columns.map(c => <td key={c}>{typeof r[c] === "number" ? fmt(r[c]) : r[c]}</td>)}</tr>)}</tbody></table>{!rows.length && <p>No matching records.</p>}</div><div className="bi-pagination"><span>{rows.length} rows · Page {page} of {Math.max(1, Math.ceil(rows.length/50))}</span><button disabled={page === 1} onClick={() => setPage(p => p-1)}>Previous</button><button disabled={page*50 >= rows.length} onClick={() => setPage(p => p+1)}>Next</button></div></article>
      <p className="bi-footnote">Generated {new Date(data.generated_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })} EAT. Products and categories use recorded item sales; trends and cashiers use receipt totals. Cashier and tender identifiers are preserved for audit.</p>
    </>}
  </div>;
}
