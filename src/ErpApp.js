import React, { useEffect, useMemo, useRef, useState } from "react";
import "./ErpApp.css";
import PriceChangeWorkspace from "./PriceChangeWorkspace";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Boxes,
  ShoppingCart,
  Truck,
  Landmark,
  Users,
  BarChart3,
  Settings,
  PackageSearch,
  UserRoundCog,
  UserRoundPlus,
  Handshake,
  ContactRound,
  ShieldCheck,
  Tags,
  Search,
  Fingerprint,
  IdCard,
  Minimize2,
  Maximize2,
  X,
  ChevronDown,
  Check,
  CheckCircle2,
  AlertCircle,
  TriangleAlert,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  LogOut,
} from "lucide-react";
import { API_BASE_URL, apiFetch } from "./appConfig";

const EMPTY_ITEM_FORM = {
  code: "",
  description: "",
  alias: "",
  category: "",
  categoryId: "",
  binLocation: "",
  price: "0",
  cost: "0",
  markupPercent: "0",
  stock: "",
  reorderLevel: "0",
  taxable: false,
  consignment: false,
};

const EMPTY_SUPPLIER_FORM = {
  code: "",
  supplierName: "",
  contactName: "",
  phoneNumber: "",
  faxNumber: "",
  emailAddress: "",
  webPageAddress: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "Kenya",
  zip: "",
  accountNumber: "",
  taxNumber: "",
  currencyId: "0",
  terms: "",
  withhold: false,
  grnApproval: false,
  advancePay: false,
  approved: false,
  poBlocked: false,
  payBlocked: false,
  garage: false,
  approvedBy: "",
  approvedTime: "",
  blockedNotes: "<none>",
  blockedTime: "",
  blockedBy: "",
  customText1: "",
  customText2: "",
  customText3: "",
  customText4: "",
  customText5: "",
  customNumber1: "0",
  customNumber2: "0",
  customNumber3: "0",
  customNumber4: "0",
  customNumber5: "0",
  customDate1: "",
  customDate2: "",
  customDate3: "",
  customDate4: "",
  customDate5: "",
  notes: "",
  typeOfGoods: "",
  supplying: "0",
  startDate: "",
  endDate: "",
};

const EMPTY_PRICE_CHANGE_PRICE = {
  default: "0",
  A: "0",
  B: "0",
  C: "0",
  sale: "0",
  cost: "0",
  lowerBound: "0",
  upperBound: "0",
};

function formatLocalDateValue(date = new Date()) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return normalized.toISOString().slice(0, 10);
}

function formatLocalDateTimeValue(date = new Date()) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return normalized.toISOString().slice(0, 16);
}

function isValidCategoryRecord(category) {
  const categoryId = Number(category?.id || 0);
  const categoryName = String(category?.name || "").trim();

  return categoryId > 0 && Boolean(categoryName) && !/^\d+$/.test(categoryName);
}

function sanitizeCategoryRecords(categories) {
  return (Array.isArray(categories) ? categories : []).filter(isValidCategoryRecord);
}

function createPurchaseOrderEntryDraft() {
  return {
    rowId: `po-entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: "",
    itemLookupCode: "",
    itemDescription: "",
    quantityOrdered: "1",
    price: "0",
    costedPrice: "0",
    taxRate: "16",
  };
}

function normalizePurchaseOrderLookup(value) {
  return String(value || "").trim().toLowerCase();
}

function findPurchaseOrderItemMatch(items, lookupValue) {
  const normalizedLookup = normalizePurchaseOrderLookup(lookupValue);
  if (!normalizedLookup) return null;

  return (
    items.find((item) => {
      const lookupCode = normalizePurchaseOrderLookup(item.lookup_code);
      const barcode = normalizePurchaseOrderLookup(item.alias);
      return normalizedLookup === lookupCode || normalizedLookup === barcode;
    }) || null
  );
}

function buildPurchaseOrderEntryFromItem(item, quantityOrdered, defaultTaxRate = 16) {
  return {
    ...createPurchaseOrderEntryDraft(),
    itemId: String(item?.id || ""),
    itemLookupCode: String(item?.lookup_code || ""),
    itemDescription: String(item?.description || ""),
    quantityOrdered: String(quantityOrdered),
    price: String(Number(item?.price || 0)),
    costedPrice: String(Number(item?.cost || 0)),
    taxRate: String(item?.taxable ? Number(defaultTaxRate || 16) : 0),
  };
}

function createEmptyPurchaseOrderForm(requisioner = "") {
  const requiredDate = new Date();
  requiredDate.setDate(requiredDate.getDate() + 4);

  return {
    poTitle: "",
    poType: "1",
    storeId: "1",
    pStatus: "0",
    pTo: "Eastmatt Main Store",
    shipTo: "",
    requisioner,
    shipVia: "Courier",
    fobPoint: "Nairobi",
    terms: "Cash",
    taxRate: "16",
    shipping: "0",
    freight: "Paid",
    requiredDate: formatLocalDateValue(requiredDate),
    confirmingTo: "Supplier Office",
    remarks: "",
    supplierId: "",
    currencyId: "1",
    exchangeRate: "1",
    inventoryLocation: "1",
    isPlaced: true,
    datePlaced: formatLocalDateTimeValue(new Date()),
    entries: [],
  };
}

function createEmptyPriceChangeLine() {
  return {
    rowId: `price-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id: "",
    itemLookupCode: "",
    description: "",
    stockAvailable: 0,
    quantity: "1",
    saleStart: "",
    saleEnd: "",
    timeBased: false,
    loyaltyBased: false,
    timeStart: "",
    timeEnd: "",
    price: { ...EMPTY_PRICE_CHANGE_PRICE },
    oldPrice: { ...EMPTY_PRICE_CHANGE_PRICE },
  };
}

function buildPriceChangePriceFromItem(item) {
  return {
    default: String(Number(item?.price || 0)),
    A: String(Number(item?.price_a ?? item?.sale_price ?? item?.price ?? 0)),
    B: String(Number(item?.price_b || 0)),
    C: String(Number(item?.price_c || 0)),
    sale: String(Number(item?.sale_price ?? item?.price_a ?? item?.price ?? 0)),
    cost: String(Number(item?.cost || 0)),
    lowerBound: String(Number(item?.lower_bound || 0)),
    upperBound: String(Number(item?.upper_bound || 0)),
  };
}

function buildPriceChangeLineFromItem(item) {
  const line = createEmptyPriceChangeLine();
  const price = buildPriceChangePriceFromItem(item);

  return {
    ...line,
    id: String(item?.id || ""),
    itemLookupCode: String(item?.lookup_code || ""),
    description: String(item?.description || ""),
    stockAvailable: Number(item?.stock_available ?? item?.stock ?? 0),
    saleStart: formatDateTimeInputValue(item?.sale_start_date),
    saleEnd: formatDateTimeInputValue(item?.sale_end_date),
    price,
    oldPrice: { ...price },
  };
}

function createEmptyPriceChangeForm(user = "") {
  const nextDate = new Date();
  nextDate.setHours(nextDate.getHours() + 1);

  return {
    description: "",
    effectDate: formatLocalDateTimeValue(nextDate),
    type: "0",
    storeId: "1",
    purchaseOrderId: "",
    status: "Open",
    user: String(user || ""),
    vendor: "",
    creditNote: false,
    creditNoteUser: "",
    glPosted: false,
    remarks: "",
    flashPrice: false,
    routeId: "0",
    viewed: false,
    items: [],
  };
}

function mapPriceChangeToForm(priceChange, fallbackUser = "") {
  const form = createEmptyPriceChangeForm(
    priceChange?.user || fallbackUser || ""
  );

  return {
    ...form,
    description: String(priceChange?.description || ""),
    effectDate: formatDateTimeInputValue(priceChange?.effect_date),
    type: String(Number(priceChange?.type || 0)),
    storeId: String(Number(priceChange?.store_id || 1)),
    purchaseOrderId: priceChange?.purchase_order_id
      ? String(Number(priceChange.purchase_order_id))
      : "",
    status: String(priceChange?.status || "Open"),
    user: String(priceChange?.user || fallbackUser || ""),
    vendor: String(priceChange?.vendor || ""),
    creditNote: Boolean(priceChange?.credit_note),
    creditNoteUser: String(priceChange?.credit_note_user || ""),
    glPosted: Boolean(priceChange?.gl_posted),
    remarks: String(priceChange?.remarks || ""),
    flashPrice: Boolean(priceChange?.flash_price),
    routeId: String(Number(priceChange?.route_id || 0)),
    viewed: Boolean(priceChange?.viewed),
    items: Array.isArray(priceChange?.items)
      ? priceChange.items.map((item) => ({
          rowId: `price-change-${priceChange?.id || "saved"}-${item?.id || item?.item_lookup_code || Math.random().toString(36).slice(2, 8)}`,
          id: String(item?.id || ""),
          itemLookupCode: String(item?.item_lookup_code || ""),
          description: String(item?.description || ""),
          stockAvailable: 0,
          quantity: String(Number(item?.quantity || 0)),
          saleStart: formatDateTimeInputValue(item?.sale_start),
          saleEnd: formatDateTimeInputValue(item?.sale_end),
          timeBased: Boolean(item?.time_based),
          loyaltyBased: Boolean(item?.loyalty_based),
          timeStart: String(item?.time_start || ""),
          timeEnd: String(item?.time_end || ""),
          price: {
            default: String(Number(item?.price?.default || 0)),
            A: String(Number(item?.price?.A || 0)),
            B: String(Number(item?.price?.B || 0)),
            C: String(Number(item?.price?.C || 0)),
            sale: String(Number(item?.price?.sale || 0)),
            cost: String(Number(item?.price?.cost || 0)),
            lowerBound: String(Number(item?.price?.lowerBound || 0)),
            upperBound: String(Number(item?.price?.upperBound || 0)),
          },
          oldPrice: {
            default: String(Number(item?.old_price?.default || 0)),
            A: String(Number(item?.old_price?.A || 0)),
            B: String(Number(item?.old_price?.B || 0)),
            C: String(Number(item?.old_price?.C || 0)),
            sale: String(Number(item?.old_price?.sale || 0)),
            cost: String(Number(item?.old_price?.cost || 0)),
            lowerBound: String(Number(item?.old_price?.lowerBound || 0)),
            upperBound: String(Number(item?.old_price?.upperBound || 0)),
          },
        }))
      : [],
  };
}

function mapPurchaseOrderToForm(purchaseOrder, fallbackRequisioner = "") {
  return {
    ...createEmptyPurchaseOrderForm(fallbackRequisioner),
    poTitle: String(purchaseOrder?.po_title || ""),
    poType: String(Number(purchaseOrder?.po_type || 1)),
    storeId: String(Number(purchaseOrder?.store_id || 1)),
    pStatus: String(Number(purchaseOrder?.p_status || 0)),
    pTo: String(purchaseOrder?.p_to || ""),
    shipTo: String(purchaseOrder?.ship_to || ""),
    requisioner: String(purchaseOrder?.requisioner || fallbackRequisioner || ""),
    shipVia: String(purchaseOrder?.ship_via || ""),
    fobPoint: String(purchaseOrder?.fob_point || ""),
    terms: String(purchaseOrder?.terms || ""),
    taxRate: String(Number(purchaseOrder?.tax_rate || 0)),
    shipping: String(Number(purchaseOrder?.shipping || 0)),
    freight: String(purchaseOrder?.freight || ""),
    requiredDate: formatDateInputValue(purchaseOrder?.required_date),
    confirmingTo: String(purchaseOrder?.confirming_to || ""),
    remarks: String(purchaseOrder?.remarks || ""),
    supplierId: purchaseOrder?.supplier_id ? String(Number(purchaseOrder.supplier_id)) : "",
    currencyId: String(Number(purchaseOrder?.currency_id || 1)),
    exchangeRate: String(Number(purchaseOrder?.exchange_rate || 1)),
    inventoryLocation: String(Number(purchaseOrder?.inventory_location || 1)),
    isPlaced: Boolean(purchaseOrder?.is_placed),
    datePlaced: formatDateTimeInputValue(purchaseOrder?.date_placed),
    entries: Array.isArray(purchaseOrder?.entries)
      ? purchaseOrder.entries.map((entry) => ({
          ...createPurchaseOrderEntryDraft(),
          itemId: String(entry?.item_id || ""),
          itemLookupCode: String(entry?.item_lookup_code || ""),
          itemDescription: String(entry?.item_description || ""),
          quantityOrdered: String(Number(entry?.quantity_ordered || 0)),
          price: String(Number(entry?.price || 0)),
          costedPrice: String(Number(entry?.costed_price ?? entry?.price ?? 0)),
          taxRate: String(Number(entry?.tax_rate || 0)),
        }))
      : [],
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPurchaseOrderPreviewDate(value) {
  if (!value) return "";

  const normalizedValue =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00`
      : value;
  const parsed = new Date(normalizedValue);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString();
}

function formatCurrencyValue(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildPurchaseOrderPreviewHtml(preview, autoPrint = false) {
  const rowsHtml = preview.entries.length
    ? preview.entries
        .map(
          (entry, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>
                <strong>${escapeHtml(entry.description)}</strong>
                <div class="muted">${escapeHtml(entry.code)}</div>
              </td>
              <td class="align-right">${escapeHtml(entry.quantityLabel)}</td>
              <td class="align-right">${escapeHtml(formatCurrencyValue(entry.cost))}</td>
              <td class="align-right">${escapeHtml(`${entry.taxRate.toLocaleString()}%`)}</td>
              <td class="align-right">${escapeHtml(formatCurrencyValue(entry.lineTotal))}</td>
            </tr>
          `
        )
        .join("")
    : '<tr><td class="empty-row" colspan="6">No purchase order lines added.</td></tr>';

  const remarksHtml = preview.remarks
    ? `
      <section class="notes-card">
        <h3>Remarks</h3>
        <p>${escapeHtml(preview.remarks)}</p>
      </section>
    `
    : "";

  const autoPrintScript = autoPrint
    ? `
      <script>
        window.addEventListener("load", function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 180);
        });
      </script>
    `
    : "";

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(preview.poNumber)} - ${escapeHtml(preview.poTitle)}</title>
        <style>
          :root {
            color-scheme: light;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: "Segoe UI", "SF Pro Text", Arial, sans-serif;
            background: #e8edf5;
            color: #142033;
          }

          .screen-shell {
            min-height: 100vh;
            padding: 28px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }

          .page {
            width: min(210mm, 100%);
            min-height: 297mm;
            background: #ffffff;
            border-radius: 22px;
            box-shadow: 0 24px 60px rgba(28, 43, 70, 0.14);
            padding: 30px 34px 36px;
          }

          .header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            align-items: flex-start;
            margin-bottom: 24px;
          }

          .header h1 {
            margin: 0 0 6px;
            font-size: 28px;
            line-height: 1.1;
          }

          .subtitle {
            margin: 0;
            color: #55657e;
            font-size: 14px;
          }

          .status-chip {
            display: inline-flex;
            align-items: center;
            padding: 8px 14px;
            border-radius: 999px;
            background: #eef3fb;
            color: #27436b;
            font-size: 13px;
            font-weight: 700;
            white-space: nowrap;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 20px;
          }

          .meta-card,
          .notes-card,
          .summary-card {
            border: 1px solid #dde5f1;
            border-radius: 18px;
            background: #f9fbff;
            padding: 16px 18px;
          }

          .meta-card h3,
          .notes-card h3,
          .summary-card h3 {
            margin: 0 0 12px;
            font-size: 14px;
            color: #27436b;
          }

          .meta-list {
            display: grid;
            gap: 8px;
          }

          .meta-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-size: 13px;
          }

          .meta-row span:first-child {
            color: #66778f;
          }

          .meta-row span:last-child {
            text-align: right;
            font-weight: 600;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
          }

          thead th {
            padding: 12px 10px;
            text-align: left;
            font-size: 12px;
            color: #52647d;
            border-bottom: 1px solid #d8e1ed;
            background: #f4f7fb;
          }

          tbody td {
            padding: 12px 10px;
            font-size: 13px;
            border-bottom: 1px solid #e4ebf4;
            vertical-align: top;
          }

          tbody tr:last-child td {
            border-bottom: none;
          }

          .align-right {
            text-align: right;
            white-space: nowrap;
          }

          .muted {
            margin-top: 4px;
            color: #6a7a90;
            font-size: 12px;
          }

          .empty-row {
            text-align: center;
            color: #6a7a90;
            padding: 28px 12px;
          }

          .summary-card {
            margin-left: auto;
            width: min(320px, 100%);
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 7px 0;
            font-size: 14px;
          }

          .summary-total {
            margin-top: 8px;
            padding-top: 10px;
            border-top: 1px solid #d8e1ed;
            font-size: 16px;
            font-weight: 800;
            color: #17335d;
          }

          .notes-card {
            margin-top: 18px;
          }

          .notes-card p {
            margin: 0;
            color: #33445d;
            line-height: 1.6;
            white-space: pre-wrap;
          }

          @media (max-width: 900px) {
            .screen-shell {
              padding: 16px;
            }

            .page {
              padding: 22px;
              border-radius: 18px;
            }

            .header,
            .meta-grid {
              grid-template-columns: 1fr;
              flex-direction: column;
            }
          }

          @media print {
            body {
              background: #ffffff;
            }

            .screen-shell {
              padding: 0;
            }

            .page {
              width: auto;
              min-height: auto;
              border-radius: 0;
              box-shadow: none;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="screen-shell">
          <article class="page">
            <header class="header">
              <div>
                <h1>${escapeHtml(preview.poNumber)}</h1>
                <p class="subtitle">${escapeHtml(preview.poTitle)}</p>
              </div>
              <div class="status-chip">${escapeHtml(preview.statusLabel)}</div>
            </header>

            <section class="meta-grid">
              <div class="meta-card">
                <h3>Order Details</h3>
                <div class="meta-list">
                  <div class="meta-row"><span>Created</span><span>${escapeHtml(preview.createdDateLabel)}</span></div>
                  <div class="meta-row"><span>Required</span><span>${escapeHtml(preview.requiredDateLabel)}</span></div>
                  <div class="meta-row"><span>Supplier</span><span>${escapeHtml(preview.supplierName)}</span></div>
                  <div class="meta-row"><span>Requisitioner</span><span>${escapeHtml(preview.requisioner)}</span></div>
                </div>
              </div>
              <div class="meta-card">
                <h3>Delivery Details</h3>
                <div class="meta-list">
                  <div class="meta-row"><span>P To</span><span>${escapeHtml(preview.pTo)}</span></div>
                  <div class="meta-row"><span>Ship To</span><span>${escapeHtml(preview.shipTo)}</span></div>
                  <div class="meta-row"><span>Ship Via</span><span>${escapeHtml(preview.shipVia)}</span></div>
                  <div class="meta-row"><span>Terms</span><span>${escapeHtml(preview.terms)}</span></div>
                </div>
              </div>
            </section>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th class="align-right">Qty</th>
                  <th class="align-right">Cost</th>
                  <th class="align-right">Tax</th>
                  <th class="align-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <section class="summary-card">
              <h3>LPO Summary</h3>
              <div class="summary-row"><span>Subtotal</span><span>${escapeHtml(formatCurrencyValue(preview.subtotal))}</span></div>
              <div class="summary-row"><span>Shipping</span><span>${escapeHtml(formatCurrencyValue(preview.shipping))}</span></div>
              <div class="summary-row summary-total"><span>Total</span><span>${escapeHtml(formatCurrencyValue(preview.total))}</span></div>
            </section>

            ${remarksHtml}
          </article>
        </div>
        ${autoPrintScript}
      </body>
    </html>
  `;
}

function buildPurchaseOrderShareText(preview) {
  const linesText = preview.entries.length
    ? preview.entries
        .map(
          (entry, index) =>
            `${index + 1}. ${entry.description} (${entry.code}) - Qty ${entry.quantityLabel} x ${formatCurrencyValue(
              entry.cost
            )} = ${formatCurrencyValue(entry.lineTotal)}`
        )
        .join("\n")
    : "No purchase order lines added.";

  return [
    `${preview.poNumber} - ${preview.poTitle}`,
    `Status: ${preview.statusLabel}`,
    `Supplier: ${preview.supplierName}`,
    `Required Date: ${preview.requiredDateLabel}`,
    `Ship To: ${preview.shipTo}`,
    "",
    linesText,
    "",
    `Shipping: ${formatCurrencyValue(preview.shipping)}`,
    `Total: ${formatCurrencyValue(preview.total)}`,
  ].join("\n");
}

const SUPPLIER_FLAG_FIELDS = [
  { key: "withhold", label: "Withhold" },
  { key: "grnApproval", label: "GRN Approval" },
  { key: "advancePay", label: "Advance Pay" },
  { key: "approved", label: "Approved" },
  { key: "poBlocked", label: "PO Blocked" },
  { key: "payBlocked", label: "Pay Blocked" },
  { key: "garage", label: "Garage" },
];

const SUPPLIER_CUSTOM_RANGE = [1, 2, 3, 4, 5];

function formatDateInputValue(value) {
  if (!value) return "";
  const asString = String(value);
  const match = asString.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function formatDateTimeInputValue(value) {
  if (!value) return "";
  const asString = String(value);
  const match = asString.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (match) return match[1];

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const pad = (part) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours()
  )}:${pad(parsed.getMinutes())}`;
}

function formatDisplayValue(value, fallback = "Not set") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function formatDisplayDateValue(value, includeTime = false) {
  if (!value) return "Not set";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return formatDisplayValue(value);
  }

  return includeTime ? parsed.toLocaleString() : parsed.toLocaleDateString();
}

function mapSupplierToForm(supplier) {
  return {
    ...EMPTY_SUPPLIER_FORM,
    code: String(supplier?.code || ""),
    supplierName: String(supplier?.supplier_name || ""),
    contactName: String(supplier?.contact_name || ""),
    phoneNumber: String(supplier?.phone_number || ""),
    faxNumber: String(supplier?.fax_number || ""),
    emailAddress: String(supplier?.email_address || ""),
    webPageAddress: String(supplier?.web_page_address || ""),
    address1: String(supplier?.address1 || ""),
    address2: String(supplier?.address2 || ""),
    city: String(supplier?.city || ""),
    state: String(supplier?.state || ""),
    country: String(supplier?.country || ""),
    zip: String(supplier?.zip || ""),
    accountNumber: String(supplier?.account_number || ""),
    taxNumber: String(supplier?.tax_number || ""),
    currencyId: String(Number(supplier?.currency_id || 0)),
    terms: String(supplier?.terms || ""),
    withhold: Boolean(supplier?.withhold),
    grnApproval: Boolean(supplier?.grn_approval),
    advancePay: Boolean(supplier?.advance_pay),
    approved: Boolean(supplier?.approved),
    poBlocked: Boolean(supplier?.po_blocked),
    payBlocked: Boolean(supplier?.pay_blocked),
    garage: Boolean(supplier?.garage),
    approvedBy: String(supplier?.approved_by || ""),
    approvedTime: formatDateTimeInputValue(supplier?.approved_time),
    blockedNotes: String(supplier?.blocked_notes || "<none>"),
    blockedTime: formatDateTimeInputValue(supplier?.blocked_time),
    blockedBy: String(supplier?.blocked_by || ""),
    customText1: String(supplier?.custom_text_1 || ""),
    customText2: String(supplier?.custom_text_2 || ""),
    customText3: String(supplier?.custom_text_3 || ""),
    customText4: String(supplier?.custom_text_4 || ""),
    customText5: String(supplier?.custom_text_5 || ""),
    customNumber1: String(Number(supplier?.custom_number_1 || 0)),
    customNumber2: String(Number(supplier?.custom_number_2 || 0)),
    customNumber3: String(Number(supplier?.custom_number_3 || 0)),
    customNumber4: String(Number(supplier?.custom_number_4 || 0)),
    customNumber5: String(Number(supplier?.custom_number_5 || 0)),
    customDate1: formatDateInputValue(supplier?.custom_date_1),
    customDate2: formatDateInputValue(supplier?.custom_date_2),
    customDate3: formatDateInputValue(supplier?.custom_date_3),
    customDate4: formatDateInputValue(supplier?.custom_date_4),
    customDate5: formatDateInputValue(supplier?.custom_date_5),
    notes: String(supplier?.notes || ""),
    typeOfGoods: String(supplier?.type_of_goods || ""),
    supplying: String(Number(supplier?.supplying || 0)),
    startDate: formatDateInputValue(supplier?.start_date),
    endDate: formatDateInputValue(supplier?.end_date),
  };
}

const FALLBACK_UPDATE_STATE = {
  supported: false,
  configured: false,
  status: "unavailable",
  message: "Updates are available only in the packaged Electron app.",
  currentVersion: "",
  availableVersion: "",
  downloadedVersion: "",
  progressPercent: 0,
  bytesPerSecond: 0,
  checkedAt: "",
  releaseDate: "",
  releaseNotes: "",
};

const UPDATE_STATUS_LABELS = {
  idle: "Ready",
  checking: "Checking",
  available: "Available",
  downloading: "Downloading",
  downloaded: "Ready To Install",
  installing: "Installing",
  "up-to-date": "Up To Date",
  development: "Packaged Build Required",
  "not-configured": "Setup Required",
  unavailable: "Unavailable",
  error: "Attention Needed",
};

function getUpdaterBridge() {
  if (typeof window === "undefined") return null;
  return window.api?.updates || null;
}

function createInitialUpdateState() {
  const updaterBridge = getUpdaterBridge();

  return {
    ...FALLBACK_UPDATE_STATE,
    supported: Boolean(updaterBridge),
    status: updaterBridge ? "idle" : FALLBACK_UPDATE_STATE.status,
    message: updaterBridge ? "Loading update status..." : FALLBACK_UPDATE_STATE.message,
  };
}

function formatUpdateDate(value) {
  if (!value) return "Not yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not yet";
  }

  return parsed.toLocaleString();
}

function formatTransferSpeed(bytesPerSecond) {
  const size = Number(bytesPerSecond || 0);
  if (!size) return "";

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB/s`;
  }

  return `${Math.round(size)} B/s`;
}

function ErpCustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select option",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const listboxIdRef = useRef(`erp-custom-select-${Math.random().toString(36).slice(2, 10)}`);

  const selectedOption = options.find((option) => String(option.value) === String(value)) || null;

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`erp-custom-select ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`.trim()}
    >
      <button
        type="button"
        className="erp-custom-select-trigger"
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxIdRef.current}
        disabled={disabled}
      >
        <span
          className={`erp-custom-select-value ${selectedOption ? "" : "is-placeholder"}`.trim()}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown size={16} className="erp-custom-select-icon" />
      </button>
      {isOpen && (
        <div className="erp-custom-select-menu" id={listboxIdRef.current} role="listbox">
          {options.map((option) => {
            const isSelected = String(option.value) === String(value);
            return (
              <button
                key={`${listboxIdRef.current}-${option.value}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`erp-custom-select-option ${isSelected ? "is-selected" : ""}`.trim()}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={14} className="erp-custom-select-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ERP_API_BASES = Array.from(new Set([API_BASE_URL])).filter(Boolean);

const DASHBOARD_CATEGORY_COLORS = [
  "#61d8ea",
  "#64ef7d",
  "#9b63f3",
  "#ff8f70",
  "#f7d154",
  "#5f83ff",
  "#ff6da8",
  "#313849",
];
const TABLE_PAGE_SIZE_OPTIONS = [50, 500, 1000];

async function fetchJsonWithFallback(pathWithQuery, options, defaultErrorMessage) {
  let lastError = null;

  for (const baseUrl of ERP_API_BASES) {
    try {
      const res = await apiFetch(`${baseUrl}${pathWithQuery}`, options);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || defaultErrorMessage);
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(defaultErrorMessage);
}

async function fetchDashboardJson(pathWithQuery) {
  return fetchJsonWithFallback(pathWithQuery, undefined, "Failed to load dashboard data");
}

function getLocalDateInputValue(dateValue = new Date()) {
  const pad = (part) => String(part).padStart(2, "0");
  return `${dateValue.getFullYear()}-${pad(dateValue.getMonth() + 1)}-${pad(dateValue.getDate())}`;
}

function mapItemToForm(item, categories = []) {
  const cost = Number(item?.cost || 0);
  const price = Number(item?.price || 0);
  const reorderLevel = Number(item?.reorder_level || 0);
  const storedMarkup = Number(item?.markup_percent);
  const rawCategoryId = Number(item?.category_id || 0);
  const computedMarkup =
    Number.isFinite(storedMarkup) && storedMarkup !== 0
      ? storedMarkup
      : cost > 0
      ? ((Number(item?.sale_price || price) - cost) / cost) * 100
      : 0;

  const matchedCategory =
    Array.isArray(categories) && categories.length
      ? categories.find((category) => {
          const categoryId = Number(category?.id || 0);
          if (rawCategoryId > 0 && categoryId === rawCategoryId) {
            return true;
          }

          return (
            String(category?.name || "").trim().toLowerCase() ===
            String(item?.category || "").trim().toLowerCase()
          );
        }) || null
      : null;

  const resolvedCategoryId =
    rawCategoryId > 0
      ? String(rawCategoryId)
      : matchedCategory && Number(matchedCategory.id || 0) > 0
      ? String(Number(matchedCategory.id))
      : "";
  const resolvedCategoryName = String(
    matchedCategory?.name || item?.category || ""
  );

  return {
    code: String(item?.lookup_code || ""),
    description: String(item?.description || ""),
    alias: String(item?.alias || ""),
    category: resolvedCategoryName,
    categoryId: resolvedCategoryId,
    binLocation: String(item?.bin_location || ""),
    price: String(price),
    cost: String(cost),
    markupPercent: String(Number(computedMarkup.toFixed(2))),
    stock: String(Number(item?.stock ?? item?.stock_available ?? 0)),
    reorderLevel: String(Number(reorderLevel.toFixed(2))),
    taxable: Boolean(item?.taxable),
    consignment: Boolean(item?.consignment),
  };
}

function getStockReorderStatus(onHand, reorderLevel) {
  if (reorderLevel <= 0) return "No Level";
  if (onHand <= 0) return "Out of Stock";
  if (onHand < reorderLevel) return "Reorder";
  if (onHand === reorderLevel) return "At Level";
  if (onHand <= reorderLevel * 1.2) return "Low Stock";
  return "Healthy";
}

function getReorderPriority(onHand, reorderLevel) {
  if (reorderLevel <= 0) return "Set Level";
  if (onHand <= 0) return "Critical";
  if (onHand < reorderLevel * 0.5) return "High";
  if (onHand < reorderLevel) return "Normal";
  return "Monitor";
}

function ErpApp({ currentUser, onLogout }) {
  const managementData = useMemo(
    () => ({
      users: {
        columns: ["ID", "Number", "Name", "User Role", "Email", "Status", "Fingerprint"],
        rows: [],
      },
      suppliers: {
        columns: ["ID", "Code", "Supplier Name", "Contact", "Phone", "Terms"],
        rows: [
          ["11", "SUP011", "FoamTech Ltd", "Peter M.", "+254712300111", "30 Days"],
          ["12", "SUP012", "SoftLine Fabrics", "Ann W.", "+254733850777", "14 Days"],
          ["13", "SUP013", "SpringCore Metals", "John K.", "+254701225009", "COD"],
        ],
      },
      customers: {
        columns: ["Customer No", "Name", "Phone", "Loyalty", "Balance"],
        rows: [
          ["CST-1001", "Fatuma Ali", "+254722331122", "Gold", "0"],
          ["CST-1002", "Brian Otieno", "+254711990033", "Silver", "2,500"],
          ["CST-1003", "Ruth Wanjiru", "+254734110098", "Bronze", "0"],
        ],
      },
      "user-roles": {
        columns: ["Role", "Modules", "Edit Rights", "Approval", "Users"],
        rows: [
          ["Administrator", "All", "Full", "Yes", "2"],
          ["Supervisor", "POS, Inventory", "Limited", "Yes", "4"],
          ["Cashier", "POS", "Restricted", "No", "8"],
        ],
      },
      categories: {
        columns: ["Category ID", "Category Name", "Parent", "Items", "Status"],
        rows: [
          ["CAT-01", "Mattresses", "-", "66", "Active"],
          ["CAT-02", "Accessories", "-", "34", "Active"],
          ["CAT-03", "Beds", "Furniture", "21", "Active"],
        ],
      },
    }),
    []
  );

  const managementTabs = useMemo(
    () => [
      { id: "items", label: "Items", hint: "Manage product records and pricing.", icon: PackageSearch, tone: "tone-items" },
      { id: "users", label: "Users", hint: "Create and maintain user accounts.", icon: UserRoundCog, tone: "tone-users" },
      { id: "suppliers", label: "Suppliers", hint: "Supplier contacts and procurement setup.", icon: Handshake, tone: "tone-suppliers" },
      { id: "customers", label: "Customers", hint: "Customer profiles and account data.", icon: ContactRound, tone: "tone-customers" },
      { id: "user-roles", label: "User Roles", hint: "Permissions, access levels, and policy rules.", icon: ShieldCheck, tone: "tone-roles" },
      { id: "categories", label: "Categories", hint: "Organize master data by category.", icon: Tags, tone: "tone-categories" },
    ],
    []
  );
  const inventoryData = useMemo(
    () => ({
      "stock-overview": {
        columns: ["SKU", "Item", "On Hand", "Reserved", "Reorder Level", "Status"],
        rows: [
          ["MAT-001", "Orthopedic Mattress 6x6", "128", "14", "60", "Healthy"],
          ["MAT-014", "Executive Headboard", "22", "3", "12", "Healthy"],
          ["ACC-102", "Mattress Protector", "41", "9", "50", "Low Stock"],
          ["BED-011", "Metal Bed 5x6", "9", "1", "10", "Reorder"],
        ],
      },
      "purchase-orders": {
        columns: ["PO No", "Supplier", "Order Date", "Expected", "Value", "Status"],
        rows: [
          ["PO-24031", "FoamTech Ltd", "29 Mar 2026", "02 Apr 2026", "182,000", "Pending Approval"],
          ["PO-24032", "SoftLine Fabrics", "29 Mar 2026", "03 Apr 2026", "96,500", "Sent"],
          ["PO-24033", "SpringCore Metals", "28 Mar 2026", "01 Apr 2026", "241,300", "Part Received"],
        ],
      },
      "stock-counts": {
        columns: ["Batch", "Location", "Scheduled Date", "Counter", "Variance", "Status"],
        rows: [
          ["CNT-2401", "Warehouse A", "29 Mar 2026", "Mercy", "+2", "Open"],
          ["CNT-2402", "Showroom", "30 Mar 2026", "James", "0", "Ready"],
          ["CNT-2403", "Van Stock", "31 Mar 2026", "Brian", "-4", "Under Review"],
        ],
      },
      adjustments: {
        columns: ["Ref", "Reason", "Item", "Qty", "Raised By", "Status"],
        rows: [
          ["ADJ-8801", "Damaged", "Orthopedic Mattress 5x6", "-2", "Grace", "Approved"],
          ["ADJ-8802", "Bin correction", "Pillow Topper", "+6", "Mercy", "Pending"],
          ["ADJ-8803", "Return to stock", "Foam Mattress 4x6", "+3", "James", "Posted"],
        ],
      },
      transfers: {
        columns: ["Transfer No", "From", "To", "Items", "Dispatch Date", "Status"],
        rows: [
          ["TRF-5101", "Warehouse A", "Thika Branch", "18", "29 Mar 2026", "In Transit"],
          ["TRF-5102", "Warehouse B", "Showroom", "7", "30 Mar 2026", "Queued"],
          ["TRF-5103", "Showroom", "Syokimau Branch", "11", "31 Mar 2026", "Received"],
        ],
      },
      reorder: {
        columns: ["Item", "Preferred Supplier", "Available", "Reorder Point", "Suggested Qty", "Priority"],
        rows: [
          ["Mattress Protector", "SoftLine Fabrics", "41", "50", "60", "High"],
          ["Metal Bed 5x6", "SpringCore Metals", "9", "10", "18", "High"],
          ["Luxury Pillow Set", "FoamTech Ltd", "23", "20", "12", "Normal"],
        ],
      },
      "price-change": {
        columns: ["Item", "Current Price", "Proposed Price", "Effective Date", "Approved By", "Status"],
        rows: [
          ["Orthopedic Mattress 6x6", "24,500", "25,900", "01 Apr 2026", "Mercy", "Pending"],
          ["Mattress Protector", "2,100", "2,250", "30 Mar 2026", "James", "Approved"],
          ["Metal Bed 5x6", "18,000", "18,750", "02 Apr 2026", "Grace", "Draft"],
        ],
      },
    }),
    []
  );

  const inventoryTabs = useMemo(
    () => [
      {
        id: "stock-overview",
        label: "Stock Overview",
        hint: "Current balances, reserved stock, and replenishment signals.",
        icon: Boxes,
        tone: "tone-items",
        actions: ["Export Snapshot", "Low Stock", "Properties"],
      },
      {
        id: "purchase-orders",
        label: "Purchase Orders",
        hint: "Supplier orders, approvals, and inbound stock planning.",
        icon: Handshake,
        tone: "tone-suppliers",
        actions: ["New PO", "Properties", "Refresh"],
      },
      {
        id: "stock-counts",
        label: "Stock Counts",
        hint: "Cycle counts, physical stock checks, and variance review.",
        icon: PackageSearch,
        tone: "tone-users",
        actions: ["Start Count", "Variance Report"],
      },
      {
        id: "adjustments",
        label: "Adjustments",
        hint: "Corrections, damages, and audit-backed stock movements.",
        icon: BarChart3,
        tone: "tone-suppliers",
        actions: ["New Adjustment", "Export Log"],
      },
      {
        id: "transfers",
        label: "Transfers",
        hint: "Move stock between warehouses, branches, and delivery units.",
        icon: Truck,
        tone: "tone-customers",
        actions: ["New Transfer", "Receive Transfer"],
      },
      {
        id: "reorder",
        label: "Reorder",
        hint: "Supplier-ready replenishment lists and restock priorities.",
        icon: TriangleAlert,
        tone: "tone-roles",
        actions: ["Generate Reorder", "Supplier View"],
      },
      {
        id: "price-change",
        label: "Price Change",
        hint: "Review, approve, and schedule item price updates.",
        icon: DollarSign,
        tone: "tone-categories",
        actions: ["New Change", "Approve Prices"],
      },
    ],
    []
  );
  const userRoleOptions = useMemo(
    () => ["Cashier", "Supervisor", "Administrator"],
    []
  );

  const navItems = useMemo(
    () => [
      { id: "dashboard", label: "Dashboard", hint: "Overview and KPI cards", icon: LayoutDashboard, tone: "tone-dashboard" },
      { id: "managment", label: "Managment", hint: "Business management controls", icon: BriefcaseBusiness, tone: "tone-managment" },
      { id: "inventory", label: "Inventory", hint: "Stock levels and adjustments", icon: Boxes, tone: "tone-inventory" },
      { id: "sales", label: "Sales", hint: "Orders, invoices, returns", icon: ShoppingCart, tone: "tone-sales" },
      { id: "purchases", label: "Purchasing", hint: "Suppliers and POs", icon: Truck, tone: "tone-purchases" },
      { id: "finance", label: "Finance", hint: "Ledger, expenses, statements", icon: Landmark, tone: "tone-finance" },
      { id: "hr", label: "HR", hint: "Staff and payroll", icon: Users, tone: "tone-hr" },
      { id: "reports", label: "Reports", hint: "Exports and analytics", icon: BarChart3, tone: "tone-reports" },
      { id: "settings", label: "Settings", hint: "Company and system config", icon: Settings, tone: "tone-settings" },
    ],
    []
  );

  const [activeNav, setActiveNav] = useState("dashboard");
  const [activeManagementTab, setActiveManagementTab] = useState("items");
  const [activeInventoryTab, setActiveInventoryTab] = useState("stock-overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsRecords, setItemsRecords] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [editingItemLookupCode, setEditingItemLookupCode] = useState(null);
  const [itemFormLoading, setItemFormLoading] = useState(false);
  const [itemFormError, setItemFormError] = useState("");
  const [addItemTab, setAddItemTab] = useState("basic");
  const [itemFormWindowState, setItemFormWindowState] = useState("normal");
  const [savingItem, setSavingItem] = useState(false);
  const [removingItem, setRemovingItem] = useState(false);
  const [usersRecords, setUsersRecords] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [categoriesRecords, setCategoriesRecords] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [categoryOptionsRecords, setCategoryOptionsRecords] = useState([]);
  const [categoryOptionsLoading, setCategoryOptionsLoading] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [suppliersRecords, setSuppliersRecords] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState("");
  const [purchaseOrdersRecords, setPurchaseOrdersRecords] = useState([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(false);
  const [purchaseOrdersError, setPurchaseOrdersError] = useState("");
  const [priceChangesRecords, setPriceChangesRecords] = useState([]);
  const [priceChangesLoading, setPriceChangesLoading] = useState(false);
  const [priceChangesError, setPriceChangesError] = useState("");
  const [selectedPriceChangeId, setSelectedPriceChangeId] = useState(null);
  const [priceChangeComposerMode, setPriceChangeComposerMode] = useState("view");
  const [savingPriceChange, setSavingPriceChange] = useState(false);
  const [priceChangeActionPending, setPriceChangeActionPending] = useState(false);
  const [priceChangeLookupValue, setPriceChangeLookupValue] = useState("");
  const [priceChangeLookupPending, setPriceChangeLookupPending] = useState(false);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState(null);
  const [selectedInventoryItemLookupCode, setSelectedInventoryItemLookupCode] = useState("");
  const [showAddSupplierForm, setShowAddSupplierForm] = useState(false);
  const [supplierFormWindowState, setSupplierFormWindowState] = useState("normal");
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [showAddPurchaseOrderForm, setShowAddPurchaseOrderForm] = useState(false);
  const [purchaseOrderModalMode, setPurchaseOrderModalMode] = useState("create");
  const [savingPurchaseOrder, setSavingPurchaseOrder] = useState(false);
  const [purchaseOrderLookupValue, setPurchaseOrderLookupValue] = useState("");
  const [purchaseOrderLookupQuantity, setPurchaseOrderLookupQuantity] = useState("1");
  const [purchaseOrderLookupPending, setPurchaseOrderLookupPending] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState({
    totalSales: 0,
    totalBaskets: 0,
  });
  const [dashboardSummaryLoading, setDashboardSummaryLoading] = useState(false);
  const [dashboardDateFrom] = useState(() => {
    const now = new Date();
    return getLocalDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dashboardDateTo] = useState(() => getLocalDateInputValue(new Date()));
  const [dashboardCategorySales, setDashboardCategorySales] = useState([]);
  const [dashboardCategorySalesTotal, setDashboardCategorySalesTotal] = useState(0);
  const [dashboardCategorySalesLoading, setDashboardCategorySalesLoading] = useState(false);
  const [dashboardCategorySalesError, setDashboardCategorySalesError] = useState("");
  const [showInventoryItemPropertiesModal, setShowInventoryItemPropertiesModal] = useState(false);
  const [savingInventoryItemProperties, setSavingInventoryItemProperties] = useState(false);
  const [inventoryItemPropertiesForm, setInventoryItemPropertiesForm] = useState({
    lookupCode: "",
    description: "",
    onHand: "0",
    reorderLevel: "0",
  });
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);
  const [fingerprintUserId, setFingerprintUserId] = useState(null);
  const [fingerprintSaving, setFingerprintSaving] = useState(false);
  const [fingerprintError, setFingerprintError] = useState("");
  const [fingerprintPreview, setFingerprintPreview] = useState("");
  const [fingerprintCaptureMeta, setFingerprintCaptureMeta] = useState(null);
  const [selectedItemLookupCode, setSelectedItemLookupCode] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(TABLE_PAGE_SIZE_OPTIONS[0]);
  const [updateState, setUpdateState] = useState(createInitialUpdateState);
  const tableWrapRef = useRef(null);
  const purchaseOrderLookupInputRef = useRef(null);
  const purchaseOrderLookupQuantityRef = useRef(null);
  const priceChangeLookupInputRef = useRef(null);
  const itemFormRequestRef = useRef(0);
  const [newItemForm, setNewItemForm] = useState({ ...EMPTY_ITEM_FORM });
  const [newSupplierForm, setNewSupplierForm] = useState({ ...EMPTY_SUPPLIER_FORM });
  const [newPurchaseOrderForm, setNewPurchaseOrderForm] = useState(() =>
    createEmptyPurchaseOrderForm("")
  );
  const [newPriceChangeForm, setNewPriceChangeForm] = useState(() =>
    createEmptyPriceChangeForm("")
  );
  const [newUserForm, setNewUserForm] = useState({
    number: "",
    name: "",
    userRole: "Cashier",
    password: "",
    emailAddress: "",
    telephone: "",
    floorLimit: "0",
    dropLimit: "0",
    enabled: true,
  });
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: "",
    parentId: "",
    status: "Active",
  });

  const activeItem = navItems.find((item) => item.id === activeNav) || navItems[0];
  const isInventoryWorkspace = activeNav === "inventory";
  const isWorkspaceView = activeNav === "managment" || isInventoryWorkspace;
  const selectedManagementTab =
    managementTabs.find((tab) => tab.id === activeManagementTab) || managementTabs[0];
  const selectedInventoryTab =
    inventoryTabs.find((tab) => tab.id === activeInventoryTab) || inventoryTabs[0];
  const selectedWorkspaceTab = isInventoryWorkspace ? selectedInventoryTab : selectedManagementTab;
  const workspaceTabs = isInventoryWorkspace ? inventoryTabs : managementTabs;
  const isItemsView = activeNav === "managment" && activeManagementTab === "items";
  const isSuppliersView = activeNav === "managment" && activeManagementTab === "suppliers";
  const isUsersView = activeNav === "managment" && activeManagementTab === "users";
  const isCategoriesView = activeNav === "managment" && activeManagementTab === "categories";
  const isStockOverviewView = activeNav === "inventory" && activeInventoryTab === "stock-overview";
  const isPurchaseOrdersView = activeNav === "inventory" && activeInventoryTab === "purchase-orders";
  const isReorderView = activeNav === "inventory" && activeInventoryTab === "reorder";
  const isPriceChangeView = activeNav === "inventory" && activeInventoryTab === "price-change";
  const isDashboardView = activeNav === "dashboard";
  const hasDashboardSales =
    Number(dashboardSummary.totalBaskets || 0) > 0 || Number(dashboardSummary.totalSales || 0) > 0;
  const dashboardTotalItems = itemsRecords.length;
  const dashboardLowStockItems = useMemo(
    () =>
      itemsRecords.filter((item) => {
        const onHand = Number(item.stock_available ?? item.stock ?? 0);
        const reorderLevel = Number(item.reorder_level || 0);
        return reorderLevel > 0 && onHand <= reorderLevel;
      }).length,
    [itemsRecords]
  );
  const dashboardCategorySalesChart = useMemo(() => {
    if (!dashboardCategorySales.length || dashboardCategorySalesTotal <= 0) return null;

    const size = 176;
    const strokeWidth = 24;
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const gap = 6;
    let progress = 0;

    return {
      size,
      strokeWidth,
      radius,
      center: size / 2,
      segments: dashboardCategorySales.map((entry, index) => {
        const share = Number(entry.sales || 0) / dashboardCategorySalesTotal;
        const rawLength = circumference * share;
        const segmentLength = Math.max(rawLength - gap, 0);
        const segment = {
          ...entry,
          color: DASHBOARD_CATEGORY_COLORS[index % DASHBOARD_CATEGORY_COLORS.length],
          share,
          strokeDasharray: `${segmentLength} ${circumference}`,
          strokeDashoffset: -progress,
        };
        progress += rawLength;
        return segment;
      }),
    };
  }, [dashboardCategorySales, dashboardCategorySalesTotal]);
  const dashboardCategoryPeriodLabel = useMemo(() => {
    const from = dashboardDateFrom ? new Date(`${dashboardDateFrom}T00:00:00`) : null;
    const to = dashboardDateTo ? new Date(`${dashboardDateTo}T00:00:00`) : null;

    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return "This Month";
    }

    if (
      from.getFullYear() === to.getFullYear() &&
      from.getMonth() === to.getMonth() &&
      from.getDate() === 1
    ) {
      return from.toLocaleString(undefined, { month: "long" });
    }

    return "Custom Range";
  }, [dashboardDateFrom, dashboardDateTo]);
  const dashboardStatCards = [
    {
      id: "sales",
      title: "Total Sales",
      caption: "Live summary",
      value: dashboardSummaryLoading
        ? "Loading..."
        : hasDashboardSales
        ? `Ksh ${Math.round(Number(dashboardSummary.totalSales || 0)).toLocaleString()}`
        : "No sales yet",
      note: dashboardSummaryLoading
        ? "Refreshing live sales"
        : hasDashboardSales
        ? "Based on completed baskets"
        : "Waiting for first sale",
      tone: "tone-sales",
      Icon: DollarSign,
      TrendIcon: ArrowUpRight,
      trendClass: hasDashboardSales ? "is-positive" : "is-muted",
      sparkPoints: "4,30 16,24 29,18 44,12 60,4",
    },
    {
      id: "baskets",
      title: "Total Baskets",
      caption: "Live summary",
      value: dashboardSummaryLoading
        ? "Loading..."
        : Number(dashboardSummary.totalBaskets || 0).toLocaleString(),
      note: dashboardSummaryLoading
        ? "Refreshing basket count"
        : "Transactions recorded in ERP",
      tone: "tone-baskets",
      Icon: ShoppingCart,
      TrendIcon: ArrowUpRight,
      trendClass: "is-positive",
      sparkPoints: "4,29 18,26 30,21 46,10 60,8",
    },
    {
      id: "items",
      title: "Total Items",
      caption: "Live summary",
      value:
        itemsLoading && dashboardTotalItems === 0
          ? "Loading..."
          : Number(dashboardTotalItems || 0).toLocaleString(),
      note:
        itemsLoading && dashboardTotalItems === 0
          ? "Refreshing catalog size"
          : "Items currently in the catalog",
      tone: "tone-items",
      Icon: Boxes,
      TrendIcon: ArrowUpRight,
      trendClass: "is-positive",
      sparkPoints: "4,31 18,28 30,20 44,16 60,11",
    },
    {
      id: "low-stock",
      title: "Low Stock",
      caption: "Live summary",
      value:
        itemsLoading && dashboardTotalItems === 0
          ? "Loading..."
          : Number(dashboardLowStockItems || 0).toLocaleString(),
      note:
        itemsLoading && dashboardTotalItems === 0
          ? "Checking stock levels"
          : dashboardLowStockItems > 0
          ? "Needs reorder attention"
          : "No active stock alerts",
      tone: "tone-alert",
      Icon: TriangleAlert,
      TrendIcon: dashboardLowStockItems > 0 ? ArrowDownRight : ArrowUpRight,
      trendClass:
        itemsLoading && dashboardTotalItems === 0
          ? "is-muted"
          : dashboardLowStockItems > 0
          ? "is-negative"
          : "is-positive",
      sparkPoints: "4,31 18,22 30,18 44,8 60,10",
    },
  ];
  const updaterBridge = getUpdaterBridge();
  const updateStatusLabel =
    UPDATE_STATUS_LABELS[updateState.status] || UPDATE_STATUS_LABELS.idle;
  const updateStatusTone = updateState.status
    ? updateState.status.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    : "idle";
  const updateProgressPercent = Math.max(
    0,
    Math.min(100, Number(updateState.progressPercent || 0))
  );
  const updateTransferSpeed = formatTransferSpeed(updateState.bytesPerSecond);
  const canCheckForUpdates =
    Boolean(updaterBridge) &&
    !["checking", "downloading", "installing"].includes(updateState.status);
  const canDownloadUpdate = updateState.status === "available";
  const canInstallUpdate = updateState.status === "downloaded";
  const isEditingItem = Boolean(editingItemLookupCode);
  const isEditingSupplier = editingSupplierId !== null;
  const isEditingCategory = editingCategoryId !== null;
  const itemModalTitle = isEditingItem ? "Item Properties" : "Add New Item";
  const itemModalSaveLabel = savingItem
    ? isEditingItem
      ? "Updating..."
      : "Saving..."
    : isEditingItem
    ? "Update Item"
    : "Save Item";
  const supplierModalTitle = isEditingSupplier ? "Supplier Properties" : "Create Supplier";
  const supplierModalSaveLabel = savingSupplier
    ? isEditingSupplier
      ? "Updating..."
      : "Saving..."
    : isEditingSupplier
    ? "Update Supplier"
    : "Save Supplier";
  const categoryModalTitle = isEditingCategory ? "Category Properties" : "Create Category";
  const categoryModalSaveLabel = savingCategory
    ? isEditingCategory
      ? "Updating..."
      : "Saving..."
    : isEditingCategory
    ? "Update Category"
    : "Save Category";
  const isViewingPurchaseOrder = purchaseOrderModalMode === "properties";
  const purchaseOrderModalTitle = isViewingPurchaseOrder
    ? "Purchase Order Properties"
    : "Create Purchase Order";
  const isAnyModalOpen =
    showAddItemForm ||
    showAddSupplierForm ||
    showAddPurchaseOrderForm ||
    showInventoryItemPropertiesModal ||
    showAddCategoryForm ||
    showAddUserForm ||
    showFingerprintModal;

  const itemsTableData = useMemo(
    () => ({
      columns: [
        "Barcode",
        "Code",
        "Description",
        "Price",
        "Cost",
        "Sale Price",
        "Available stock",
      ],
      rows: itemsRecords.map((item) => [
        item.alias || "",
        item.lookup_code || "",
        item.description || "",
        `${Number(item.price || 0).toLocaleString()}`,
        `${Number(item.cost || 0).toLocaleString()}`,
        `${Number(item.sale_price || 0).toLocaleString()}`,
        String(item.stock_available ?? 0),
      ]),
    }),
    [itemsRecords]
  );

  const usersTableData = useMemo(
    () => ({
      columns: ["ID", "Number", "Name", "User Role", "Email", "Status", "Fingerprint"],
      rows: usersRecords.map((user) => [
        String(user.id || ""),
        user.number || "",
        user.name || "",
        user.user_role || "",
        user.email_address || "",
        user.status || "",
        user.has_fingerprint ? "Enrolled" : "Not enrolled",
      ]),
    }),
    [usersRecords]
  );

  const suppliersTableData = useMemo(
    () => ({
      columns: ["ID", "Code", "Supplier Name", "Contact", "Phone", "Terms"],
      rows: suppliersRecords.map((supplier) => [
        String(supplier.id || ""),
        supplier.code || "",
        supplier.supplier_name || "",
        supplier.contact_name || "",
        supplier.phone_number || "",
        supplier.terms || "",
      ]),
    }),
    [suppliersRecords]
  );

  const categoriesTableData = useMemo(
    () => ({
      columns: ["ID", "Code", "Category Name", "Parent", "Items", "Status"],
      rows: categoriesRecords.map((category) => [
        category.id ? String(category.id) : "--",
        category.code || "--",
        category.name || "",
        category.parent || "--",
        String(category.items ?? 0),
        category.status || "Active",
      ]),
    }),
    [categoriesRecords]
  );

  const categoryReferenceRecords = useMemo(
    () => (categoryOptionsRecords.length ? categoryOptionsRecords : categoriesRecords),
    [categoryOptionsRecords, categoriesRecords]
  );

  const availableParentCategories = useMemo(() => {
    const seenIds = new Set();

    return categoryReferenceRecords
      .filter(
        (category) =>
          Number(category.id || 0) > 0 &&
          Number(category.id) !== Number(editingCategoryId) &&
          String(category.name || "").trim()
      )
      .filter((category) => {
        const categoryId = Number(category.id || 0);
        if (seenIds.has(categoryId)) {
          return false;
        }
        seenIds.add(categoryId);
        return true;
      })
      .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
  }, [categoryReferenceRecords, editingCategoryId]);

  const categoryParentOptions = useMemo(
    () => [
      { value: "", label: "No parent" },
      ...availableParentCategories.map((category) => ({
        value: String(category.id),
        label: String(category.name || ""),
      })),
    ],
    [availableParentCategories]
  );

  const categoryStatusOptions = useMemo(
    () => [
      { value: "Active", label: "Active" },
      { value: "Inactive", label: "Inactive" },
    ],
    []
  );
  const itemCategoryOptions = useMemo(
    () =>
      categoryReferenceRecords
        .filter((category) => Number(category.id || 0) > 0 && String(category.name || "").trim())
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
        .map((category) => ({
          value: String(category.id),
          label: String(category.name || ""),
        })),
    [categoryReferenceRecords]
  );
  const tablePageSizeOptions = useMemo(
    () =>
      TABLE_PAGE_SIZE_OPTIONS.map((size) => ({
        value: String(size),
        label: `${size}`,
      })),
    []
  );

  const purchaseOrdersTableData = useMemo(
    () => ({
      columns: ["PO Number", "Title", "Supplier", "Created", "Required", "Items", "Total", "Status"],
      rows: purchaseOrdersRecords.map((purchaseOrder) => [
        purchaseOrder.po_number || "",
        purchaseOrder.po_title || "",
        purchaseOrder.supplier_name || "",
        purchaseOrder.date_created
          ? new Date(purchaseOrder.date_created).toLocaleDateString()
          : "",
        purchaseOrder.required_date
          ? new Date(purchaseOrder.required_date).toLocaleDateString()
          : "",
        String(purchaseOrder.items_count ?? 0),
        Number(purchaseOrder.total_amount || 0).toLocaleString(),
        purchaseOrder.status_label || "",
      ]),
    }),
    [purchaseOrdersRecords]
  );

  const stockOverviewTableData = useMemo(
    () => ({
      columns: ["SKU", "Item", "On Hand", "Reserved", "Reorder Level", "Status"],
      rows: [...itemsRecords]
        .sort((left, right) =>
          String(left.description || "").localeCompare(String(right.description || ""))
        )
        .map((item) => {
          const onHand = Number(item.stock_available ?? item.stock ?? 0);
          const reorderLevel = Number(item.reorder_level || 0);
          return [
            item.lookup_code || "",
            item.description || "",
            String(onHand),
            "0",
            String(Number(reorderLevel.toFixed(2))),
            getStockReorderStatus(onHand, reorderLevel),
          ];
        }),
    }),
    [itemsRecords]
  );

  const reorderTableData = useMemo(
    () => ({
      columns: ["SKU", "Item", "On Hand", "Reorder Level", "Suggested Qty", "Priority"],
      rows: [...itemsRecords]
        .map((item) => {
          const onHand = Number(item.stock_available ?? item.stock ?? 0);
          const reorderLevel = Number(item.reorder_level || 0);
          const suggestedQty =
            reorderLevel > 0 && onHand <= reorderLevel
              ? Math.max(Math.ceil(reorderLevel * 2 - onHand), 1)
              : 0;

          return {
            lookupCode: item.lookup_code || "",
            description: item.description || "",
            onHand,
            reorderLevel,
            suggestedQty,
            priority: getReorderPriority(onHand, reorderLevel),
          };
        })
        .filter((item) => item.reorderLevel > 0 && item.onHand <= item.reorderLevel)
        .sort((left, right) => {
          if (left.onHand !== right.onHand) {
            return left.onHand - right.onHand;
          }
          return right.reorderLevel - left.reorderLevel;
        })
        .map((item) => [
          item.lookupCode,
          item.description,
          String(item.onHand),
          String(Number(item.reorderLevel.toFixed(2))),
          String(item.suggestedQty),
          item.priority,
        ]),
    }),
    [itemsRecords]
  );

  const priceChangesTableData = useMemo(
    () => ({
      columns: ["ID", "Description", "Vendor", "Effective", "Items", "Status", "User"],
      rows: priceChangesRecords.map((priceChange) => [
        String(priceChange.id || ""),
        priceChange.description || "",
        priceChange.vendor || "",
        priceChange.effect_date
          ? formatDisplayDateValue(priceChange.effect_date, true)
          : "Immediate",
        String(priceChange.total_items ?? (priceChange.items || []).length ?? 0),
        priceChange.status || "Open",
        priceChange.user || "",
      ]),
    }),
    [priceChangesRecords]
  );

  const purchaseOrderDraftTotal = useMemo(
    () => {
      const entriesTotal = newPurchaseOrderForm.entries.reduce((sum, entry) => {
        const quantity = Number(entry.quantityOrdered || 0);
        const costedPrice = Number(entry.costedPrice || 0);
        return sum + quantity * costedPrice;
      }, 0);
      const shipping = Number(newPurchaseOrderForm.shipping || 0);
      return entriesTotal + shipping;
    },
    [newPurchaseOrderForm.entries, newPurchaseOrderForm.shipping]
  );
  const selectedPurchaseOrderRecord = useMemo(
    () =>
      purchaseOrdersRecords.find(
        (purchaseOrder) => Number(purchaseOrder.id) === Number(selectedPurchaseOrderId)
      ) || null,
    [purchaseOrdersRecords, selectedPurchaseOrderId]
  );
  const selectedInventoryItemRecord = useMemo(
    () =>
      itemsRecords.find(
        (item) => String(item.lookup_code || "") === String(selectedInventoryItemLookupCode || "")
      ) || null,
    [itemsRecords, selectedInventoryItemLookupCode]
  );
  const selectedPriceChangeRecord = useMemo(
    () =>
      priceChangesRecords.find(
        (priceChange) => Number(priceChange.id) === Number(selectedPriceChangeId)
      ) || null,
    [priceChangesRecords, selectedPriceChangeId]
  );
  const selectedSupplierRecord = useMemo(
    () =>
      suppliersRecords.find((supplier) => Number(supplier.id) === Number(selectedSupplierId)) || null,
    [suppliersRecords, selectedSupplierId]
  );
  const selectedCategoryRecord = useMemo(
    () =>
      categoriesRecords.find((category) => Number(category.id) === Number(selectedCategoryId)) || null,
    [categoriesRecords, selectedCategoryId]
  );
  const selectedSupplierPanelData = useMemo(() => {
    if (!selectedSupplierRecord) return null;

    const addressParts = [
      selectedSupplierRecord.address1,
      selectedSupplierRecord.address2,
      selectedSupplierRecord.city,
      selectedSupplierRecord.state,
      selectedSupplierRecord.country,
      selectedSupplierRecord.zip,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return {
      supplierName: formatDisplayValue(selectedSupplierRecord.supplier_name, "Supplier"),
      supplierCode: formatDisplayValue(selectedSupplierRecord.code),
      supplierId: formatDisplayValue(selectedSupplierRecord.id),
      notes: formatDisplayValue(selectedSupplierRecord.notes, "No notes added."),
      statusBadges: [
        {
          label: selectedSupplierRecord.approved ? "Approved" : "Pending Approval",
          tone: selectedSupplierRecord.approved ? "is-good" : "is-warning",
        },
        {
          label: selectedSupplierRecord.po_blocked ? "PO Blocked" : "PO Open",
          tone: selectedSupplierRecord.po_blocked ? "is-danger" : "is-good",
        },
        {
          label: selectedSupplierRecord.pay_blocked ? "Pay Blocked" : "Payments Open",
          tone: selectedSupplierRecord.pay_blocked ? "is-danger" : "is-good",
        },
        {
          label: selectedSupplierRecord.grn_approval ? "GRN Approval" : "GRN Direct",
          tone: selectedSupplierRecord.grn_approval ? "is-info" : "is-neutral",
        },
      ],
    };
  }, [selectedSupplierRecord]);
  const priceChangeSummary = useMemo(() => {
    const currentTime = new Date();
    const records = Array.isArray(priceChangesRecords) ? priceChangesRecords : [];
    const approvedDue = records.filter((record) => {
      if (String(record.status || "").toLowerCase() !== "approved") return false;
      if (!record.effect_date) return true;
      const effectDate = new Date(record.effect_date);
      return !Number.isNaN(effectDate.getTime()) && effectDate <= currentTime;
    }).length;

    return {
      open: records.filter((record) => String(record.status || "").toLowerCase() === "open").length,
      approved: records.filter((record) => String(record.status || "").toLowerCase() === "approved").length,
      applied: records.filter((record) => String(record.status || "").toLowerCase() === "applied").length,
      approvedDue,
    };
  }, [priceChangesRecords]);
  const buildPurchaseOrderPreviewData = () => {
    const resolvedSupplier =
      suppliersRecords.find(
        (supplier) => Number(supplier.id) === Number(newPurchaseOrderForm.supplierId || 0)
      ) || null;
    const entries = newPurchaseOrderForm.entries
      .filter(
        (entry) =>
          entry.itemId ||
          String(entry.itemLookupCode || "").trim() ||
          String(entry.itemDescription || "").trim() ||
          Number(entry.quantityOrdered || 0) > 0
      )
      .map((entry, index) => {
        const quantity = Number(entry.quantityOrdered || 0);
        const cost = Number(entry.costedPrice || 0);
        const taxRate = Number(entry.taxRate || 0);

        return {
          rowNumber: index + 1,
          code: String(entry.itemLookupCode || entry.itemId || `Line ${index + 1}`),
          description: String(entry.itemDescription || "Item description unavailable"),
          quantity,
          quantityLabel: Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2),
          cost,
          taxRate,
          lineTotal: quantity * cost,
        };
      });

    const subtotal = entries.reduce((sum, entry) => sum + entry.lineTotal, 0);
    const shipping = Number(newPurchaseOrderForm.shipping || 0);

    return {
      poNumber: isViewingPurchaseOrder
        ? selectedPurchaseOrderRecord?.po_number || "Draft LPO"
        : "Draft LPO",
      poTitle: newPurchaseOrderForm.poTitle.trim() || "Local Purchase Order",
      statusLabel: isViewingPurchaseOrder
        ? selectedPurchaseOrderRecord?.status_label || "Draft"
        : "Draft",
      createdDateLabel: formatPurchaseOrderPreviewDate(
        isViewingPurchaseOrder ? selectedPurchaseOrderRecord?.date_created : new Date().toISOString()
      ),
      requiredDateLabel:
        formatPurchaseOrderPreviewDate(newPurchaseOrderForm.requiredDate) || "Not scheduled",
      supplierName:
        String(
          resolvedSupplier?.supplier_name ||
            selectedPurchaseOrderRecord?.supplier_name ||
            "Supplier not selected"
        ) || "Supplier not selected",
      pTo: newPurchaseOrderForm.pTo.trim() || "Not set",
      shipTo: newPurchaseOrderForm.shipTo.trim() || "Not set",
      shipVia: newPurchaseOrderForm.shipVia.trim() || "Not set",
      terms: newPurchaseOrderForm.terms.trim() || "Not set",
      requisioner: newPurchaseOrderForm.requisioner.trim() || "Not set",
      remarks: newPurchaseOrderForm.remarks.trim(),
      entries,
      subtotal,
      shipping,
      total: subtotal + shipping,
    };
  };

  const openPurchaseOrderPreviewWindow = ({ autoPrint = false } = {}) => {
    const preview = buildPurchaseOrderPreviewData();
    const previewWindow = window.open("", "_blank", "width=1120,height=860");

    if (!previewWindow) {
      pushAlert("warning", "Allow pop-ups to open the LPO preview window.");
      return;
    }

    previewWindow.document.open();
    previewWindow.document.write(buildPurchaseOrderPreviewHtml(preview, autoPrint));
    previewWindow.document.close();
    previewWindow.focus();
  };

  const handleViewPurchaseOrderPreview = () => {
    openPurchaseOrderPreviewWindow();
  };

  const handlePrintPurchaseOrder = () => {
    openPurchaseOrderPreviewWindow({ autoPrint: true });
  };

  const handleSharePurchaseOrder = async () => {
    const preview = buildPurchaseOrderPreviewData();
    const title = `${preview.poNumber} - ${preview.poTitle}`;
    const text = buildPurchaseOrderShareText(preview);

    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        pushAlert("success", "LPO shared successfully.");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        pushAlert("success", "LPO details copied for sharing.");
        return;
      }

      throw new Error("Sharing is not available on this device.");
    } catch (error) {
      if (error?.name === "AbortError") return;
      pushAlert("error", error.message || "Failed to share LPO.");
    }
  };

  const selectedManagementData =
    activeManagementTab === "items"
      ? itemsTableData
      : activeManagementTab === "users"
      ? usersTableData
      : activeManagementTab === "suppliers"
      ? suppliersTableData
      : activeManagementTab === "categories"
      ? categoriesTableData
      : managementData[activeManagementTab] || managementData[managementTabs[0].id];
  const selectedInventoryData =
    activeInventoryTab === "stock-overview"
      ? stockOverviewTableData
      : activeInventoryTab === "purchase-orders"
      ? purchaseOrdersTableData
      : activeInventoryTab === "reorder"
      ? reorderTableData
      : activeInventoryTab === "price-change"
      ? priceChangesTableData
      : inventoryData[activeInventoryTab] || inventoryData[inventoryTabs[0].id];
  const selectedWorkspaceData = isInventoryWorkspace ? selectedInventoryData : selectedManagementData;
  const filteredManagementRows = (selectedManagementData?.rows || []).filter((row) =>
    row.some((cell) => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const filteredInventoryRows = (selectedInventoryData?.rows || []).filter((row) =>
    row.some((cell) => String(cell).toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const filteredItemsRecords = itemsRecords;
  const filteredSuppliersRecords = suppliersRecords;
  const filteredPurchaseOrdersRecords = purchaseOrdersRecords;
  const filteredPriceChangesRecords = priceChangesRecords;
  const filteredUsersRecords = usersRecords;
  const filteredCategoriesRecords = categoriesRecords;
  const totalRecords = isItemsView
    ? filteredItemsRecords.length
    : isSuppliersView
    ? filteredSuppliersRecords.length
    : isPurchaseOrdersView
    ? filteredPurchaseOrdersRecords.length
    : isPriceChangeView
    ? filteredPriceChangesRecords.length
    : isUsersView
    ? filteredUsersRecords.length
    : isCategoriesView
    ? filteredCategoriesRecords.length
    : isInventoryWorkspace
    ? filteredInventoryRows.length
    : filteredManagementRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * rowsPerPage;
  const pageStartRecord = totalRecords > 0 ? startIndex + 1 : 0;
  const pageEndRecord = Math.min(startIndex + rowsPerPage, totalRecords);
  const pagedManagementRows = filteredManagementRows.slice(startIndex, startIndex + rowsPerPage);
  const pagedInventoryRows = filteredInventoryRows.slice(startIndex, startIndex + rowsPerPage);
  const pagedItemsRecords = filteredItemsRecords.slice(startIndex, startIndex + rowsPerPage);
  const pagedSuppliersRecords = filteredSuppliersRecords.slice(startIndex, startIndex + rowsPerPage);
  const pagedPurchaseOrdersRecords = filteredPurchaseOrdersRecords.slice(startIndex, startIndex + rowsPerPage);
  const pagedPriceChangesRecords = filteredPriceChangesRecords.slice(startIndex, startIndex + rowsPerPage);
  const pagedUsersRecords = filteredUsersRecords.slice(startIndex, startIndex + rowsPerPage);
  const pagedCategoriesRecords = filteredCategoriesRecords.slice(startIndex, startIndex + rowsPerPage);

  const title = isWorkspaceView ? `${activeItem.label} / ${selectedWorkspaceTab.label}` : activeItem.label;
  const subtitle = isWorkspaceView ? selectedWorkspaceTab.hint : activeItem.hint;
  const currentUserLabel = currentUser?.name || currentUser?.number || "Signed in";
  const currentUserRole = currentUser?.user_role || "Cashier";
  const fingerprintTargetUser =
    usersRecords.find((user) => Number(user.id) === Number(fingerprintUserId)) || null;

  const pushAlert = (type, message) => {
    const id = Date.now() + Math.random();
    setAlerts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    }, 3500);
  };

  const dismissAlert = (id) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const closeInventoryItemPropertiesModal = () => {
    setShowInventoryItemPropertiesModal(false);
    setSavingInventoryItemProperties(false);
    setInventoryItemPropertiesForm({
      lookupCode: "",
      description: "",
      onHand: "0",
      reorderLevel: "0",
    });
  };

  const openInventoryItemPropertiesModal = () => {
    if (!selectedInventoryItemRecord) {
      pushAlert("warning", "Select a stock row to open properties.");
      return;
    }

    setInventoryItemPropertiesForm({
      lookupCode: String(selectedInventoryItemRecord.lookup_code || ""),
      description: String(selectedInventoryItemRecord.description || ""),
      onHand: String(
        Number(selectedInventoryItemRecord.stock_available ?? selectedInventoryItemRecord.stock ?? 0)
      ),
      reorderLevel: String(Number(selectedInventoryItemRecord.reorder_level || 0)),
    });
    setShowInventoryItemPropertiesModal(true);
  };

  const handleSaveInventoryItemProperties = async (e) => {
    e.preventDefault();

    const lookupCode = inventoryItemPropertiesForm.lookupCode.trim();
    const reorderLevel = Number(inventoryItemPropertiesForm.reorderLevel || 0);

    if (!lookupCode) {
      pushAlert("warning", "Select a valid item before saving properties.");
      return;
    }

    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      pushAlert("warning", "Reorder level must be a non-negative number.");
      return;
    }

    setSavingInventoryItemProperties(true);
    try {
      const data = await fetchJsonWithFallback(
        `/erp/items/${encodeURIComponent(lookupCode)}/reorder-level`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reorder_level: reorderLevel }),
        },
        "Failed to update reorder level"
      );

      setItemsRecords((prev) =>
        prev.map((item) =>
          String(item.lookup_code || "") === lookupCode ? data : item
        )
      );
      closeInventoryItemPropertiesModal();
      pushAlert("success", `Reorder level updated for ${data.description || lookupCode}.`);
    } catch (error) {
      pushAlert("error", error.message || "Failed to update reorder level");
    } finally {
      setSavingInventoryItemProperties(false);
    }
  };

  const resetPriceChangeForm = (overrides = {}) => {
    const currentUserLabel =
      currentUser?.name || currentUser?.number || "";
    setNewPriceChangeForm({
      ...createEmptyPriceChangeForm(currentUserLabel),
      ...overrides,
    });
    setPriceChangeLookupValue("");
  };

  const openCreatePriceChangeComposer = () => {
    resetPriceChangeForm();
    setSelectedPriceChangeId(null);
    setPriceChangeComposerMode("create");
  };

  const closePriceChangeComposer = () => {
    resetPriceChangeForm();
    setPriceChangeComposerMode("view");
  };

  const openEditPriceChangeComposer = () => {
    if (!selectedPriceChangeRecord) {
      pushAlert("warning", "Select a price change to edit.");
      return;
    }

    const status = String(selectedPriceChangeRecord.status || "").toLowerCase();
    if (status === "applied" || status === "cancelled") {
      pushAlert("info", "Applied or cancelled price changes are kept read-only.");
      return;
    }

    setNewPriceChangeForm(
      mapPriceChangeToForm(
        selectedPriceChangeRecord,
        currentUser?.name || currentUser?.number || ""
      )
    );
    setPriceChangeLookupValue("");
    setPriceChangeComposerMode("edit");
  };

  const updatePriceChangeForm = (field, value) => {
    setNewPriceChangeForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updatePriceChangeItemField = (rowId, field, value) => {
    setNewPriceChangeForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.rowId === rowId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const updatePriceChangeItemPrice = (rowId, field, value) => {
    setNewPriceChangeForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.rowId === rowId
          ? {
              ...item,
              price: {
                ...item.price,
                [field]: value,
              },
            }
          : item
      ),
    }));
  };

  const removePriceChangeItem = (rowId) => {
    setNewPriceChangeForm((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.rowId !== rowId),
    }));
  };

  const loadPriceChanges = async (search = "") => {
    setPriceChangesLoading(true);
    setPriceChangesError("");
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const data = await fetchJsonWithFallback(
        `/erp/price-changes${query}`,
        undefined,
        "Failed to load price changes"
      );
      setPriceChangesRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error.message || "Failed to load price changes";
      setPriceChangesError(message);
    } finally {
      setPriceChangesLoading(false);
    }
  };

  const handleAddPriceChangeItem = async () => {
    const lookupCode = priceChangeLookupValue.trim();
    if (!lookupCode) {
      pushAlert("warning", "Enter an item lookup code or barcode.");
      return;
    }

    const duplicate = newPriceChangeForm.items.some(
      (item) =>
        String(item.itemLookupCode || "").trim().toLowerCase() ===
        lookupCode.toLowerCase()
    );
    if (duplicate) {
      pushAlert("info", `${lookupCode} is already in this price change.`);
      return;
    }

    setPriceChangeLookupPending(true);
    try {
      const item = await fetchJsonWithFallback(
        `/erp/items/by-lookup/${encodeURIComponent(lookupCode)}`,
        undefined,
        "Failed to load item for price change"
      );
      setNewPriceChangeForm((prev) => ({
        ...prev,
        items: [...prev.items, buildPriceChangeLineFromItem(item)],
      }));
      setPriceChangeLookupValue("");
      pushAlert("success", `${item.description || lookupCode} added to the price change.`);
    } catch (error) {
      pushAlert("error", error.message || "Failed to add item to price change.");
    } finally {
      setPriceChangeLookupPending(false);
    }
  };

  const handleSavePriceChange = async (event) => {
    event.preventDefault();

    const description = newPriceChangeForm.description.trim();
    if (!description) {
      pushAlert("warning", "Description is required.");
      return;
    }

    if (!newPriceChangeForm.items.length) {
      pushAlert("warning", "Add at least one item to this price change.");
      return;
    }

    const payload = {
      description,
      effect_date: newPriceChangeForm.effectDate
        ? new Date(newPriceChangeForm.effectDate).toISOString()
        : null,
      type: Number(newPriceChangeForm.type || 0),
      store_id: Number(newPriceChangeForm.storeId || 1),
      purchase_order_id: newPriceChangeForm.purchaseOrderId
        ? Number(newPriceChangeForm.purchaseOrderId)
        : null,
      status: newPriceChangeForm.status || "Open",
      user:
        newPriceChangeForm.user.trim() ||
        currentUser?.name ||
        currentUser?.number ||
        "",
      vendor: newPriceChangeForm.vendor.trim(),
      credit_note: Boolean(newPriceChangeForm.creditNote),
      credit_note_user: newPriceChangeForm.creditNoteUser.trim() || null,
      gl_posted: Boolean(newPriceChangeForm.glPosted),
      remarks: newPriceChangeForm.remarks.trim(),
      flash_price: Boolean(newPriceChangeForm.flashPrice),
      route_id: Number(newPriceChangeForm.routeId || 0),
      viewed: Boolean(newPriceChangeForm.viewed),
      items: newPriceChangeForm.items.map((item) => ({
        id: item.id ? Number(item.id) : 0,
        item_lookup_code: item.itemLookupCode.trim(),
        description: item.description.trim(),
        quantity: Number(item.quantity || 0),
        sale_start: item.saleStart ? new Date(item.saleStart).toISOString() : null,
        sale_end: item.saleEnd ? new Date(item.saleEnd).toISOString() : null,
        time_based: Boolean(item.timeBased),
        loyalty_based: Boolean(item.loyaltyBased),
        time_start: item.timeStart || null,
        time_end: item.timeEnd || null,
        price: {
          default: Number(item.price.default || 0),
          A: Number(item.price.A || 0),
          B: Number(item.price.B || 0),
          C: Number(item.price.C || 0),
          sale: Number(item.price.sale || 0),
          cost: Number(item.price.cost || 0),
          lowerBound: Number(item.price.lowerBound || 0),
          upperBound: Number(item.price.upperBound || 0),
        },
        old_price: {
          default: Number(item.oldPrice.default || 0),
          A: Number(item.oldPrice.A || 0),
          B: Number(item.oldPrice.B || 0),
          C: Number(item.oldPrice.C || 0),
          sale: Number(item.oldPrice.sale || 0),
          cost: Number(item.oldPrice.cost || 0),
          lowerBound: Number(item.oldPrice.lowerBound || 0),
          upperBound: Number(item.oldPrice.upperBound || 0),
        },
      })),
    };

    const isEditingPriceChange =
      priceChangeComposerMode === "edit" && selectedPriceChangeRecord;

    setSavingPriceChange(true);
    try {
      const saved = await fetchJsonWithFallback(
        isEditingPriceChange
          ? `/erp/price-changes/${encodeURIComponent(String(selectedPriceChangeRecord.id))}`
          : "/erp/price-changes",
        {
          method: isEditingPriceChange ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        "Failed to save price change"
      );

      setSelectedPriceChangeId(saved.id);
      setPriceChangeComposerMode("view");
      resetPriceChangeForm();
      await loadPriceChanges(searchTerm);
      pushAlert(
        "success",
        isEditingPriceChange
          ? "Price change updated successfully."
          : "Price change created successfully."
      );
    } catch (error) {
      pushAlert("error", error.message || "Failed to save price change");
    } finally {
      setSavingPriceChange(false);
    }
  };

  const handleApproveSelectedPriceChange = async () => {
    if (!selectedPriceChangeRecord) {
      pushAlert("warning", "Select a price change to approve.");
      return;
    }

    const status = String(selectedPriceChangeRecord.status || "").toLowerCase();
    if (status === "applied") {
      pushAlert("info", "This price change has already been applied.");
      return;
    }
    if (status === "cancelled") {
      pushAlert("warning", "Cancelled price changes cannot be approved.");
      return;
    }

    setPriceChangeActionPending(true);
    try {
      const updated = await fetchJsonWithFallback(
        `/erp/price-changes/${encodeURIComponent(String(selectedPriceChangeRecord.id))}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: currentUser?.name || currentUser?.number || "",
          }),
        },
        "Failed to approve price change"
      );
      setSelectedPriceChangeId(updated.id);
      await loadPriceChanges(searchTerm);
      pushAlert(
        "success",
        updated.status === "Applied"
          ? "Price change approved and applied."
          : "Price change approved successfully."
      );
    } catch (error) {
      pushAlert("error", error.message || "Failed to approve price change");
    } finally {
      setPriceChangeActionPending(false);
    }
  };

  const handleApplySelectedPriceChange = async () => {
    if (!selectedPriceChangeRecord) {
      pushAlert("warning", "Select a price change to apply.");
      return;
    }

    setPriceChangeActionPending(true);
    try {
      const updated = await fetchJsonWithFallback(
        `/erp/price-changes/${encodeURIComponent(String(selectedPriceChangeRecord.id))}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: currentUser?.name || currentUser?.number || "",
          }),
        },
        "Failed to apply price change"
      );
      setSelectedPriceChangeId(updated.id);
      await loadPriceChanges(searchTerm);
      pushAlert("success", "Price change applied successfully.");
    } catch (error) {
      pushAlert("error", error.message || "Failed to apply price change");
    } finally {
      setPriceChangeActionPending(false);
    }
  };

  const handleCancelSelectedPriceChange = async () => {
    if (!selectedPriceChangeRecord) {
      pushAlert("warning", "Select a price change to cancel.");
      return;
    }

    setPriceChangeActionPending(true);
    try {
      const updated = await fetchJsonWithFallback(
        `/erp/price-changes/${encodeURIComponent(String(selectedPriceChangeRecord.id))}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: currentUser?.name || currentUser?.number || "",
          }),
        },
        "Failed to cancel price change"
      );
      setSelectedPriceChangeId(updated.id);
      setPriceChangeComposerMode("view");
      await loadPriceChanges(searchTerm);
      pushAlert("success", "Price change cancelled.");
    } catch (error) {
      pushAlert("error", error.message || "Failed to cancel price change");
    } finally {
      setPriceChangeActionPending(false);
    }
  };

  const handleInventoryModuleAction = (actionLabel) => {
    if (selectedInventoryTab.id === "stock-overview" && actionLabel === "Low Stock") {
      setActiveInventoryTab("reorder");
      return;
    }

    if (selectedInventoryTab.id === "stock-overview" && actionLabel === "Properties") {
      openInventoryItemPropertiesModal();
      return;
    }

    if (selectedInventoryTab.id === "reorder" && actionLabel === "Generate Reorder") {
      pushAlert("info", "Reorder list refreshed from the live item stock levels.");
      return;
    }

    if (selectedInventoryTab.id === "price-change") {
      if (actionLabel === "New Change") {
        openCreatePriceChangeComposer();
        return;
      }
      if (actionLabel === "Approve Prices") {
        handleApproveSelectedPriceChange();
        return;
      }
    }

    if (selectedInventoryTab.id === "purchase-orders") {
      if (actionLabel === "New PO") {
        openCreatePurchaseOrderModal();
        return;
      }
      if (actionLabel === "Properties") {
        openPurchaseOrderPropertiesModal();
        return;
      }
      if (actionLabel === "Refresh") {
        loadPurchaseOrders(searchTerm);
        return;
      }
    }

    pushAlert("info", `${actionLabel} for ${selectedInventoryTab.label} is ready for the next inventory screen.`);
  };

  const loadPurchaseOrders = async (search = "") => {
    setPurchaseOrdersLoading(true);
    setPurchaseOrdersError("");
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const res = await apiFetch(`${API_BASE_URL}/erp/purchase-orders${query}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Purchase order endpoint not available. Restart the backend and reload ERP."
            : data?.detail || "Failed to load purchase orders"
        );
      }
      setPurchaseOrdersRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error.message || "Failed to load purchase orders";
      setPurchaseOrdersError(message);
      pushAlert("error", message);
      setPurchaseOrdersRecords([]);
    } finally {
      setPurchaseOrdersLoading(false);
    }
  };

  const upsertPurchaseOrderCatalogItem = (nextItem) => {
    setItemsRecords((prev) => {
      const nextLookup = normalizePurchaseOrderLookup(nextItem.lookup_code || nextItem.id);
      const nextBarcode = normalizePurchaseOrderLookup(nextItem.alias);
      const existingIndex = prev.findIndex((item) => {
        const existingLookup = normalizePurchaseOrderLookup(item.lookup_code || item.id);
        const existingBarcode = normalizePurchaseOrderLookup(item.alias);
        return (
          (nextLookup && existingLookup === nextLookup) ||
          (nextBarcode && existingBarcode === nextBarcode)
        );
      });

      if (existingIndex === -1) {
        return [nextItem, ...prev];
      }

      return prev.map((item, index) =>
        index === existingIndex ? { ...item, ...nextItem } : item
      );
    });
  };

  const resolvePurchaseOrderLookupItem = async (lookupValue) => {
    const directMatch = findPurchaseOrderItemMatch(itemsRecords, lookupValue);
    if (directMatch) {
      return directMatch;
    }

    const query = lookupValue.trim();
    const data = await fetchJsonWithFallback(
      `/erp/items?search=${encodeURIComponent(query)}&limit=25`,
      undefined,
      "Failed to search items"
    );

    const nextItems = Array.isArray(data) ? data : [];
    const remoteMatch =
      findPurchaseOrderItemMatch(nextItems, query) ||
      (nextItems.length === 1 ? nextItems[0] : null);

    if (remoteMatch) {
      upsertPurchaseOrderCatalogItem(remoteMatch);
    }

    return remoteMatch;
  };

  const closePurchaseOrderForm = () => {
    setPurchaseOrdersError("");
    setSavingPurchaseOrder(false);
    setPurchaseOrderModalMode("create");
    setPurchaseOrderLookupValue("");
    setPurchaseOrderLookupQuantity("1");
    setPurchaseOrderLookupPending(false);
    setShowAddPurchaseOrderForm(false);
    setNewPurchaseOrderForm(createEmptyPurchaseOrderForm(currentUser?.name || currentUser?.number || ""));
  };

  const openCreatePurchaseOrderModal = (prefillSupplier = null) => {
    setPurchaseOrdersError("");
    setPurchaseOrderModalMode("create");
    setPurchaseOrderLookupValue("");
    setPurchaseOrderLookupQuantity("1");
    setPurchaseOrderLookupPending(false);
    const nextPurchaseOrderForm = createEmptyPurchaseOrderForm(
      currentUser?.name || currentUser?.number || ""
    );
    if (prefillSupplier?.id) {
      nextPurchaseOrderForm.supplierId = String(Number(prefillSupplier.id));
      nextPurchaseOrderForm.terms = String(prefillSupplier.terms || "");
    }
    setNewPurchaseOrderForm(nextPurchaseOrderForm);
    setShowAddPurchaseOrderForm(true);
    loadItems("");
    loadSuppliers("");
  };

  const openPurchaseOrderPropertiesModal = () => {
    if (!selectedPurchaseOrderRecord) {
      pushAlert("warning", "Select a purchase order row to open properties.");
      return;
    }

    setPurchaseOrdersError("");
    setPurchaseOrderModalMode("properties");
    setPurchaseOrderLookupValue("");
    setPurchaseOrderLookupQuantity("1");
    setPurchaseOrderLookupPending(false);
    setNewPurchaseOrderForm(
      mapPurchaseOrderToForm(
        selectedPurchaseOrderRecord,
        currentUser?.name || currentUser?.number || ""
      )
    );
    setShowAddPurchaseOrderForm(true);
    loadSuppliers("");
  };

  const updatePurchaseOrderForm = (field, value) => {
    setNewPurchaseOrderForm((prev) => ({ ...prev, [field]: value }));
  };

  const removePurchaseOrderEntryRow = (rowId) => {
    setNewPurchaseOrderForm((prev) => {
      return {
        ...prev,
        entries: prev.entries.filter((entry) => entry.rowId !== rowId),
      };
    });
  };

  const updatePurchaseOrderEntry = (rowId, field, value) => {
    setNewPurchaseOrderForm((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.rowId === rowId ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const handleAddPurchaseOrderLookupItem = async () => {
    const lookupValue = purchaseOrderLookupValue.trim();
    const quantity = Number(purchaseOrderLookupQuantity || 0);

    if (!lookupValue) {
      setPurchaseOrdersError("Enter an item lookup code or scan a barcode.");
      pushAlert("warning", "Enter an item lookup code or scan a barcode.");
      purchaseOrderLookupInputRef.current?.focus();
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setPurchaseOrdersError("Enter a valid quantity greater than zero.");
      pushAlert("warning", "Enter a valid quantity greater than zero.");
      return;
    }

    setPurchaseOrdersError("");
    setPurchaseOrderLookupPending(true);

    try {
      const matchedItem = await resolvePurchaseOrderLookupItem(lookupValue);
      if (!matchedItem) {
        const message = `No item found for "${lookupValue}".`;
        setPurchaseOrdersError(message);
        pushAlert("warning", message);
        purchaseOrderLookupInputRef.current?.focus();
        return;
      }

      setNewPurchaseOrderForm((prev) => {
        const normalizedLookup = normalizePurchaseOrderLookup(matchedItem.lookup_code);
        const existingEntry = prev.entries.find(
          (entry) =>
            (normalizedLookup &&
              normalizePurchaseOrderLookup(entry.itemLookupCode) === normalizedLookup) ||
            (!normalizedLookup &&
              String(entry.itemId || "") === String(matchedItem.id || ""))
        );

        if (existingEntry) {
          const nextQuantity = Number(existingEntry.quantityOrdered || 0) + quantity;
          return {
            ...prev,
            entries: prev.entries.map((entry) =>
              entry.rowId === existingEntry.rowId
                ? {
                    ...buildPurchaseOrderEntryFromItem(
                      matchedItem,
                      nextQuantity,
                      prev.taxRate
                    ),
                    rowId: existingEntry.rowId,
                  }
                : entry
            ),
          };
        }

        return {
          ...prev,
          entries: [
            ...prev.entries,
            buildPurchaseOrderEntryFromItem(matchedItem, quantity, prev.taxRate),
          ],
        };
      });

      setPurchaseOrderLookupValue("");
      setPurchaseOrderLookupQuantity("1");
      window.requestAnimationFrame(() => {
        purchaseOrderLookupInputRef.current?.focus();
      });
    } catch (error) {
      const message = error.message || "Failed to search items";
      setPurchaseOrdersError(message);
      pushAlert("error", message);
    } finally {
      setPurchaseOrderLookupPending(false);
    }
  };

  const handlePurchaseOrderLookupKeyDown = (event, field) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (field === "lookup") {
      purchaseOrderLookupQuantityRef.current?.focus();
      purchaseOrderLookupQuantityRef.current?.select?.();
      return;
    }

    if (!purchaseOrderLookupPending) {
      void handleAddPurchaseOrderLookupItem();
    }
  };

  const closeSupplierForm = () => {
    setSuppliersError("");
    setEditingSupplierId(null);
    setSupplierFormWindowState("normal");
    setShowAddSupplierForm(false);
    setNewSupplierForm({ ...EMPTY_SUPPLIER_FORM });
  };

  const openCreateSupplierModal = () => {
    setSuppliersError("");
    setEditingSupplierId(null);
    setSupplierFormWindowState("normal");
    setShowAddSupplierForm(true);
    setNewSupplierForm({ ...EMPTY_SUPPLIER_FORM });
  };

  const updateSupplierForm = (field, value) => {
    setNewSupplierForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenSupplierProperties = () => {
    const selected = suppliersRecords.find((supplier) => Number(supplier.id) === Number(selectedSupplierId));
    if (!selected) {
      pushAlert("warning", "Select a supplier row to open properties.");
      return;
    }

    setSuppliersError("");
    setEditingSupplierId(Number(selected.id));
    setSupplierFormWindowState("normal");
    setNewSupplierForm(mapSupplierToForm(selected));
    setShowAddSupplierForm(true);
  };

  const openCreateUserModal = () => {
    setEditingUserId(null);
    setShowAddUserForm(true);
    setNewUserForm({
      number: "",
      name: "",
      userRole: "Cashier",
      password: "",
      emailAddress: "",
      telephone: "",
      floorLimit: "0",
      dropLimit: "0",
      enabled: true,
    });
  };

  const closeUserForm = () => {
    setShowAddUserForm(false);
    setEditingUserId(null);
    setNewUserForm({
      number: "",
      name: "",
      userRole: "Cashier",
      password: "",
      emailAddress: "",
      telephone: "",
      floorLimit: "0",
      dropLimit: "0",
      enabled: true,
    });
  };

  const openCreateCategoryModal = () => {
    setCategoriesError("");
    setEditingCategoryId(null);
    setShowAddCategoryForm(true);
    setNewCategoryForm({
      name: "",
      parentId: "",
      status: "Active",
    });
  };

  const closeCategoryForm = () => {
    setCategoriesError("");
    setShowAddCategoryForm(false);
    setSavingCategory(false);
    setEditingCategoryId(null);
    setNewCategoryForm({
      name: "",
      parentId: "",
      status: "Active",
    });
  };

  const closeFingerprintModal = () => {
    setShowFingerprintModal(false);
    setFingerprintUserId(null);
    setFingerprintSaving(false);
    setFingerprintError("");
    setFingerprintPreview("");
    setFingerprintCaptureMeta(null);
  };

  const handleOpenUserProperties = () => {
    const selected = usersRecords.find((user) => Number(user.id) === Number(selectedUserId));
    if (!selected) {
      pushAlert("warning", "Select a user row to open properties.");
      return;
    }

    setEditingUserId(Number(selected.id));
    setNewUserForm({
      number: String(selected.number || ""),
      name: String(selected.name || ""),
      userRole: String(selected.user_role || "Cashier"),
      password: "",
      emailAddress: String(selected.email_address || ""),
      telephone: String(selected.telephone || ""),
      floorLimit: String(Number(selected.floor_limit || 0)),
      dropLimit: String(Number(selected.drop_limit || 0)),
      enabled: Boolean(selected.enabled),
    });
    setShowAddUserForm(true);
  };

  const handleOpenCategoryProperties = () => {
    const selected = categoriesRecords.find((category) => Number(category.id) === Number(selectedCategoryId));
    if (!selected) {
      pushAlert("warning", "Select a category row to open properties.");
      return;
    }

    const parentMatch = categoriesRecords.find(
      (category) =>
        String(category.name || "").trim().toLowerCase() ===
        String(selected.parent || "").trim().toLowerCase()
    );

    setCategoriesError("");
    setEditingCategoryId(Number(selected.id));
    setNewCategoryForm({
      name: String(selected.name || ""),
      parentId: parentMatch && Number(parentMatch.id || 0) > 0 ? String(parentMatch.id) : "",
      status: String(selected.status || "Active"),
    });
    setShowAddCategoryForm(true);
  };

  const handleFingerprintSetup = () => {
    const selected = usersRecords.find((user) => Number(user.id) === Number(selectedUserId));
    if (!selected) {
      pushAlert("warning", "Select a user row to open fingerprint setup.");
      return;
    }

    setFingerprintUserId(Number(selected.id));
    setFingerprintError("");
    setFingerprintPreview("");
    setFingerprintCaptureMeta(
      selected.fingerprint_updated_at
        ? {
            imageQuality: null,
            nfiq: null,
            updatedAt: selected.fingerprint_updated_at,
          }
        : null
    );
    setShowFingerprintModal(true);

    const bridge = window.api?.auth;
    bridge?.prepareFingerprint?.({
      templateFormat: "STANDARDPRO",
      preloadCandidates: false,
      timeout: 5000,
    }).catch(() => null);
  };

  const handleCaptureFingerprint = async () => {
    if (!fingerprintTargetUser) {
      setFingerprintError("Select a cashier before enrolling a fingerprint.");
      return;
    }

    setFingerprintSaving(true);
    setFingerprintError("");

    try {
      const bridge = window.api?.auth;
      if (!bridge?.captureFingerprint) {
        throw new Error("Fingerprint capture is available only in the Electron desktop app.");
      }

      const capture = await bridge.captureFingerprint({
        timeout: 10000,
        quality: 50,
        templateFormat: "STANDARDPRO",
        captureMode: "enroll",
      });

      const res = await apiFetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(String(fingerprintTargetUser.id))}/fingerprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_base64: capture.templateBase64,
          template_format: capture.templateFormat,
          image_quality: capture.imageQuality,
          nfiq: capture.nfiq,
          device_model: capture.deviceName,
          device_serial: capture.serialNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Failed to save fingerprint");
      }

      await bridge.invalidateFingerprintCache?.();

      setUsersRecords((prev) =>
        prev.map((user) => (Number(user.id) === Number(data.id) ? data : user))
      );
      setSelectedUserId(Number(data.id));
      setFingerprintPreview(capture.imageBase64 ? `data:image/bmp;base64,${capture.imageBase64}` : "");
      setFingerprintCaptureMeta({
        imageQuality: capture.imageQuality,
        nfiq: capture.nfiq,
        updatedAt: data.fingerprint_updated_at || new Date().toISOString(),
      });
      pushAlert(
        "success",
        `Fingerprint saved for ${data.name || data.number || `User ${data.id}`}.`
      );
    } catch (error) {
      const message = error.message || "Failed to capture fingerprint";
      setFingerprintError(message);
      pushAlert("error", message);
    } finally {
      setFingerprintSaving(false);
    }
  };

  const loadItems = async (search = "") => {
    setItemsLoading(true);
    setItemsError("");
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const data = await fetchJsonWithFallback(
        `/erp/items${query}`,
        undefined,
        "Failed to load items"
      );
      setItemsRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setItemsError(error.message || "Failed to load items");
      pushAlert("error", error.message || "Failed to load items");
      setItemsRecords([]);
    } finally {
      setItemsLoading(false);
    }
  };

  const loadUsers = async (search = "") => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const res = await apiFetch(`${API_BASE_URL}/erp/users${query}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Failed to load users");
      }
      setUsersRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setUsersError(error.message || "Failed to load users");
      pushAlert("error", error.message || "Failed to load users");
      setUsersRecords([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadCategories = async (search = "") => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const data = await fetchJsonWithFallback(
        `/erp/categories${query}`,
        undefined,
        "Failed to load categories"
      );
      const normalizedCategories = sanitizeCategoryRecords(data);
      setCategoriesRecords(normalizedCategories);
      if (!search.trim()) {
        setCategoryOptionsRecords(normalizedCategories);
      }
    } catch (error) {
      setCategoriesError(error.message || "Failed to load categories");
      pushAlert("error", error.message || "Failed to load categories");
      setCategoriesRecords([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadCategoryOptions = async () => {
    setCategoryOptionsLoading(true);
    try {
      const data = await fetchJsonWithFallback(
        "/erp/categories",
        undefined,
        "Failed to load categories"
      );
      const normalizedCategories = sanitizeCategoryRecords(data);
      setCategoryOptionsRecords(normalizedCategories);
      return normalizedCategories;
    } catch (error) {
      pushAlert("error", error.message || "Failed to load categories");
      setCategoryOptionsRecords([]);
      throw error;
    } finally {
      setCategoryOptionsLoading(false);
    }
  };

  const ensureCategoryOptionsLoaded = async () => {
    if (categoryOptionsRecords.length) {
      return categoryOptionsRecords;
    }

    return loadCategoryOptions();
  };

  const loadSuppliers = async (search = "") => {
    setSuppliersLoading(true);
    setSuppliersError("");
    try {
      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const res = await apiFetch(`${API_BASE_URL}/erp/suppliers${query}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Supplier endpoint not available. Restart the backend and reload ERP."
            : data?.detail || "Failed to load suppliers"
        );
      }
      setSuppliersRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setSuppliersError(error.message || "Failed to load suppliers");
      pushAlert("error", error.message || "Failed to load suppliers");
      setSuppliersRecords([]);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const loadDashboardSummary = async () => {
    setDashboardSummaryLoading(true);
    try {
      const summaryData = await fetchDashboardJson("/erp/dashboard/summary");
      setDashboardSummary({
        totalSales: Number(summaryData?.total_sales || 0),
        totalBaskets: Number(summaryData?.total_baskets || 0),
      });
    } catch {
      setDashboardSummary({
        totalSales: 0,
        totalBaskets: 0,
      });
    } finally {
      setDashboardSummaryLoading(false);
    }
  };

  const loadDashboardCategorySales = async (dateFrom, dateTo) => {
    if (!dateFrom || !dateTo) return;

    setDashboardCategorySalesLoading(true);
    setDashboardCategorySalesError("");
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
      });
      const data = await fetchDashboardJson(`/erp/dashboard/category-sales?${params.toString()}`);
      setDashboardCategorySales(
        Array.isArray(data?.categories)
          ? data.categories.map((entry) => ({
              category: String(entry.category || "Uncategorized"),
              sales: Number(entry.sales || 0),
            }))
          : []
      );
      setDashboardCategorySalesTotal(Number(data?.total_sales || 0));
    } catch (error) {
      setDashboardCategorySales([]);
      setDashboardCategorySalesTotal(0);
      setDashboardCategorySalesError(error.message || "Unable to load category sales.");
    } finally {
      setDashboardCategorySalesLoading(false);
    }
  };

  const closeItemForm = () => {
    itemFormRequestRef.current += 1;
    setShowAddItemForm(false);
    setEditingItemLookupCode(null);
    setItemFormLoading(false);
    setItemFormError("");
    setAddItemTab("basic");
    setItemFormWindowState("normal");
    setNewItemForm({ ...EMPTY_ITEM_FORM });
  };

  const openCreateItemModal = async () => {
    itemFormRequestRef.current += 1;
    setEditingItemLookupCode(null);
    setItemFormLoading(false);
    setItemFormError("");
    setAddItemTab("basic");
    setItemFormWindowState("normal");
    setNewItemForm({ ...EMPTY_ITEM_FORM });
    setShowAddItemForm(true);

    try {
      await ensureCategoryOptionsLoaded();
    } catch (_error) {
      // Keep the item modal open even if the category list is temporarily unavailable.
    }
  };

  const openItemPropertiesModal = async () => {
    if (!selectedItemLookupCode) {
      pushAlert("warning", "Select an item row to view properties.");
      return;
    }

    const lookupCode = selectedItemLookupCode;
    const selectedItem = itemsRecords.find(
      (item) => String(item.lookup_code || "") === String(lookupCode)
    );

    if (!selectedItem) {
      pushAlert("warning", "Selected item details are no longer available. Refresh the list and try again.");
      return;
    }

    const requestId = itemFormRequestRef.current + 1;
    itemFormRequestRef.current = requestId;
    setItemsError("");
    setItemFormError("");
    setItemFormLoading(false);
    setEditingItemLookupCode(lookupCode);
    setAddItemTab("basic");
    setItemFormWindowState("normal");
    setNewItemForm(
      mapItemToForm(
        selectedItem,
        categoryOptionsRecords.length ? categoryOptionsRecords : categoriesRecords
      )
    );
    setShowAddItemForm(true);

    ensureCategoryOptionsLoaded()
      .then((categoryOptions) => {
        if (itemFormRequestRef.current !== requestId) {
          return;
        }

        setNewItemForm(mapItemToForm(selectedItem, categoryOptions));
      })
      .catch(() => null);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    const price = Number(newItemForm.price || 0);
    const cost = Number(newItemForm.cost || 0);
    const markupPercent = Number(newItemForm.markupPercent || 0);
    const salePrice = cost > 0 ? Number((cost * (1 + markupPercent / 100)).toFixed(2)) : Number(newItemForm.price || 0);
    const stock = Number(newItemForm.stock || 0);
    const reorderLevel = Number(newItemForm.reorderLevel || 0);
    const selectedCategoryId = Number(newItemForm.categoryId || 0);
    const currentEditingLookupCode = editingItemLookupCode;
    const selectedCategory =
      categoryReferenceRecords.find((category) => Number(category.id || 0) === selectedCategoryId) || null;

    if (!newItemForm.code.trim()) {
      setItemsError("Lookup Code is required.");
      pushAlert("warning", "Lookup Code is required.");
      return;
    }
    if (!newItemForm.description.trim()) {
      setItemsError("Description is required.");
      pushAlert("warning", "Description is required.");
      return;
    }
    if (!newItemForm.alias.trim()) {
      setItemsError("Barcode is required.");
      pushAlert("warning", "Barcode is required.");
      return;
    }
    if (selectedCategoryId <= 0 || !selectedCategory) {
      setItemsError("Category is required.");
      pushAlert("warning", "Category is required.");
      return;
    }
    if (price < 0 || cost < 0 || stock < 0 || reorderLevel < 0) {
      setItemsError("Price, cost, stock and reorder level must be non-negative.");
      pushAlert("warning", "Price, cost, stock and reorder level must be non-negative.");
      return;
    }
    if (salePrice < cost) {
      setItemsError("Sale price cannot be below cost.");
      pushAlert("warning", "Sale price cannot be below cost.");
      return;
    }

    setSavingItem(true);
    setItemsError("");
    try {
      const payload = {
        code: newItemForm.code.trim(),
        description: newItemForm.description.trim(),
        alias: newItemForm.alias.trim(),
        category: String(selectedCategory.name || ""),
        category_id: selectedCategoryId,
        bin_location: newItemForm.binLocation.trim(),
        price,
        cost,
        sale_price: salePrice,
        markup_percent: markupPercent,
        stock,
        reorder_level: reorderLevel,
        taxable: Boolean(newItemForm.taxable),
        consignment: Boolean(newItemForm.consignment),
      };

      const data = await fetchJsonWithFallback(
        currentEditingLookupCode
          ? `/erp/items/${encodeURIComponent(currentEditingLookupCode)}`
          : "/erp/items",
        {
          method: currentEditingLookupCode ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        currentEditingLookupCode ? "Failed to update item" : "Failed to add item"
      );

      setItemsRecords((prev) =>
        currentEditingLookupCode
          ? prev.map((item) =>
              item.lookup_code === currentEditingLookupCode ? data : item
            )
          : [data, ...prev]
      );
      setSelectedItemLookupCode(data.lookup_code || "");
      closeItemForm();
      pushAlert(
        "success",
        currentEditingLookupCode ? "Item updated successfully." : "Item created successfully."
      );
    } catch (error) {
      const message =
        error.message || (currentEditingLookupCode ? "Failed to update item" : "Failed to add item");
      setItemsError(message);
      pushAlert("error", message);
    } finally {
      setSavingItem(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();

    const number = newUserForm.number.trim();
    const password = newUserForm.password.trim();
    const name = newUserForm.name.trim();
    const userRole = newUserForm.userRole.trim() || "Cashier";
    const emailAddress = newUserForm.emailAddress.trim();
    const telephone = newUserForm.telephone.trim();
    const floorLimit = Number(newUserForm.floorLimit || 0);
    const dropLimit = Number(newUserForm.dropLimit || 0);
    const enabled = Boolean(newUserForm.enabled);

    if (!number) {
      setUsersError("User number is required.");
      pushAlert("warning", "User number is required.");
      return;
    }
    if (!userRole) {
      setUsersError("User role is required.");
      pushAlert("warning", "User role is required.");
      return;
    }
    if (!editingUserId && !password) {
      setUsersError("Password is required.");
      pushAlert("warning", "Password is required.");
      return;
    }
    if (floorLimit < 0) {
      setUsersError("Floor limit cannot be negative.");
      pushAlert("warning", "Floor limit cannot be negative.");
      return;
    }
    if (dropLimit < 0) {
      setUsersError("Drop limit cannot be negative.");
      pushAlert("warning", "Drop limit cannot be negative.");
      return;
    }

    setSavingUser(true);
    setUsersError("");
    try {
      const payload = {
        number,
        password,
        name,
        user_role: userRole,
        email_address: emailAddress,
        telephone,
        floor_limit: floorLimit,
        drop_limit: dropLimit,
        enabled,
      };

      const endpoint = editingUserId
        ? `${API_BASE_URL}/erp/users/${encodeURIComponent(String(editingUserId))}`
        : `${API_BASE_URL}/erp/users`;
      const method = editingUserId ? "PUT" : "POST";
      const res = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (editingUserId && res.status === 404 && data?.detail === "Not Found") {
          throw new Error("Update endpoint not available. Restart backend and try again.");
        }
        throw new Error(data?.detail || (editingUserId ? "Failed to update user" : "Failed to create user"));
      }

      setUsersRecords((prev) =>
        editingUserId
          ? prev.map((user) => (Number(user.id) === Number(editingUserId) ? data : user))
          : [...prev, data]
      );
      setSelectedUserId(Number(data.id));
      closeUserForm();
      pushAlert("success", editingUserId ? "User updated successfully." : "User created successfully.");
    } catch (error) {
      const message = error.message || (editingUserId ? "Failed to update user" : "Failed to create user");
      setUsersError(message);
      pushAlert("error", message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();

    const name = newCategoryForm.name.trim();
    const parentId = Number(newCategoryForm.parentId || 0);
    const status = newCategoryForm.status.trim() || "Active";
    const currentEditingCategoryId = editingCategoryId;

    if (!name) {
      setCategoriesError("Category name is required.");
      pushAlert("warning", "Category name is required.");
      return;
    }

    setSavingCategory(true);
    setCategoriesError("");
    try {
      const data = await fetchJsonWithFallback(
        currentEditingCategoryId
          ? `/erp/categories/${encodeURIComponent(String(currentEditingCategoryId))}`
          : "/erp/categories",
        {
          method: currentEditingCategoryId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            parent_id: parentId,
            status,
          }),
        },
        currentEditingCategoryId ? "Failed to update category" : "Failed to create category"
      );

      setCategoriesRecords((prev) =>
        (
          currentEditingCategoryId
            ? prev.map((category) =>
                Number(category.id) === Number(currentEditingCategoryId)
                  ? {
                      ...category,
                      ...data,
                      items: category.items,
                    }
                  : category
              )
            : [...prev, data]
        ).sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
      );
      if (currentEditingCategoryId) {
        setSelectedCategoryId(Number(currentEditingCategoryId));
      } else if (Number(data?.id || 0) > 0) {
        setSelectedCategoryId(Number(data.id));
      }
      closeCategoryForm();
      pushAlert(
        "success",
        currentEditingCategoryId ? "Category updated successfully." : "Category created successfully."
      );
    } catch (error) {
      const message = error.message || (currentEditingCategoryId ? "Failed to update category" : "Failed to create category");
      setCategoriesError(message);
      pushAlert("error", message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();

    const nullableValue = (value) => {
      const trimmed = String(value || "").trim();
      return trimmed ? trimmed : null;
    };
    const code = newSupplierForm.code.trim();
    const supplierName = newSupplierForm.supplierName.trim();
    const currentEditingSupplierId = editingSupplierId;

    if (!supplierName) {
      setSuppliersError("Supplier name is required.");
      pushAlert("warning", "Supplier name is required.");
      return;
    }

    setSavingSupplier(true);
    setSuppliersError("");
    try {
      const payload = {
        code,
        supplier_name: supplierName,
        contact_name: newSupplierForm.contactName.trim(),
        phone_number: newSupplierForm.phoneNumber.trim(),
        fax_number: newSupplierForm.faxNumber.trim(),
        email_address: newSupplierForm.emailAddress.trim(),
        web_page_address: newSupplierForm.webPageAddress.trim(),
        address1: newSupplierForm.address1.trim(),
        address2: newSupplierForm.address2.trim(),
        city: newSupplierForm.city.trim(),
        state: newSupplierForm.state.trim(),
        country: newSupplierForm.country.trim(),
        zip: newSupplierForm.zip.trim(),
        account_number: newSupplierForm.accountNumber.trim(),
        tax_number: newSupplierForm.taxNumber.trim(),
        currency_id: Number(newSupplierForm.currencyId || 0),
        terms: newSupplierForm.terms.trim(),
        withhold: Boolean(newSupplierForm.withhold),
        grn_approval: Boolean(newSupplierForm.grnApproval),
        advance_pay: Boolean(newSupplierForm.advancePay),
        approved: Boolean(newSupplierForm.approved),
        po_blocked: Boolean(newSupplierForm.poBlocked),
        pay_blocked: Boolean(newSupplierForm.payBlocked),
        garage: Boolean(newSupplierForm.garage),
        approved_by: newSupplierForm.approvedBy.trim(),
        approved_time: nullableValue(newSupplierForm.approvedTime),
        blocked_notes: newSupplierForm.blockedNotes.trim(),
        blocked_time: nullableValue(newSupplierForm.blockedTime),
        blocked_by: newSupplierForm.blockedBy.trim(),
        custom_text_1: newSupplierForm.customText1.trim(),
        custom_text_2: newSupplierForm.customText2.trim(),
        custom_text_3: newSupplierForm.customText3.trim(),
        custom_text_4: newSupplierForm.customText4.trim(),
        custom_text_5: newSupplierForm.customText5.trim(),
        custom_number_1: Number(newSupplierForm.customNumber1 || 0),
        custom_number_2: Number(newSupplierForm.customNumber2 || 0),
        custom_number_3: Number(newSupplierForm.customNumber3 || 0),
        custom_number_4: Number(newSupplierForm.customNumber4 || 0),
        custom_number_5: Number(newSupplierForm.customNumber5 || 0),
        custom_date_1: nullableValue(newSupplierForm.customDate1),
        custom_date_2: nullableValue(newSupplierForm.customDate2),
        custom_date_3: nullableValue(newSupplierForm.customDate3),
        custom_date_4: nullableValue(newSupplierForm.customDate4),
        custom_date_5: nullableValue(newSupplierForm.customDate5),
        notes: newSupplierForm.notes.trim(),
        type_of_goods: newSupplierForm.typeOfGoods.trim(),
        supplying: Number(newSupplierForm.supplying || 0),
        start_date: nullableValue(newSupplierForm.startDate),
        end_date: nullableValue(newSupplierForm.endDate),
      };

      const endpoint = currentEditingSupplierId
        ? `${API_BASE_URL}/erp/suppliers/${encodeURIComponent(String(currentEditingSupplierId))}`
        : `${API_BASE_URL}/erp/suppliers`;
      const method = currentEditingSupplierId ? "PUT" : "POST";
      const res = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Supplier endpoint not available. Restart the backend and reload ERP."
            : data?.detail || (currentEditingSupplierId ? "Failed to update supplier" : "Failed to create supplier")
        );
      }

      setSuppliersRecords((prev) =>
        currentEditingSupplierId
          ? prev.map((supplier) => (Number(supplier.id) === Number(currentEditingSupplierId) ? data : supplier))
          : [data, ...prev]
      );
      setSelectedSupplierId(Number(data.id));
      closeSupplierForm();
      pushAlert("success", currentEditingSupplierId ? "Supplier updated successfully." : "Supplier created successfully.");
    } catch (error) {
      const message = error.message || (currentEditingSupplierId ? "Failed to update supplier" : "Failed to create supplier");
      setSuppliersError(message);
      pushAlert("error", message);
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleSavePurchaseOrder = async (e) => {
    e.preventDefault();

    const poTitle = newPurchaseOrderForm.poTitle.trim();
    const supplierId = Number(newPurchaseOrderForm.supplierId || 0);
    const pTo = newPurchaseOrderForm.pTo.trim();
    const shipTo = newPurchaseOrderForm.shipTo.trim();
    const requisioner = newPurchaseOrderForm.requisioner.trim();
    const shipping = Number(newPurchaseOrderForm.shipping || 0);
    const exchangeRate = Number(newPurchaseOrderForm.exchangeRate || 1);
    const preparedEntries = newPurchaseOrderForm.entries.map((entry, index) => {
      const sourceItem =
        itemsRecords.find(
          (item) =>
            entry.itemLookupCode &&
            String(item.lookup_code || "") === String(entry.itemLookupCode || "")
        ) ||
        itemsRecords.find((item) => String(item.id || "") === String(entry.itemId || ""));

      const derivedPrice = Number(sourceItem?.price ?? entry.price ?? 0);
      const derivedCost = Number(sourceItem?.cost ?? entry.costedPrice ?? 0);
      const derivedTaxRate = sourceItem
        ? Number(sourceItem.taxable ? newPurchaseOrderForm.taxRate || entry.taxRate || 0 : 0)
        : Number(entry.taxRate || newPurchaseOrderForm.taxRate || 0);

      return {
        ...entry,
        lineNumber: index + 1,
        itemId: Number(sourceItem?.id ?? (entry.itemId || 0)),
        itemLookupCode: sourceItem?.lookup_code || entry.itemLookupCode || "",
        itemDescription:
          String(entry.itemDescription || "").trim() ||
          sourceItem?.description ||
          "",
        quantityOrdered: Number(entry.quantityOrdered || 0),
        price: derivedPrice,
        costedPrice: derivedCost,
        taxRate: derivedTaxRate,
      };
    });
    const actionableEntries = preparedEntries.filter(
      (entry) =>
        entry.itemId ||
        String(entry.itemLookupCode || "").trim() ||
        String(entry.itemDescription || "").trim() ||
        entry.quantityOrdered > 0
    );

    if (!poTitle) {
      setPurchaseOrdersError("PO title is required.");
      pushAlert("warning", "PO title is required.");
      return;
    }
    if (!supplierId) {
      setPurchaseOrdersError("Supplier is required.");
      pushAlert("warning", "Select a supplier for the purchase order.");
      return;
    }
    if (!pTo) {
      setPurchaseOrdersError("Purchase order destination is required.");
      pushAlert("warning", "Enter the PO destination.");
      return;
    }
    if (!shipTo) {
      setPurchaseOrdersError("Ship to location is required.");
      pushAlert("warning", "Enter the ship to location.");
      return;
    }
    if (!requisioner) {
      setPurchaseOrdersError("Requisioner is required.");
      pushAlert("warning", "Enter the requisitioner.");
      return;
    }
    if (shipping < 0) {
      setPurchaseOrdersError("Shipping cannot be negative.");
      pushAlert("warning", "Shipping cannot be negative.");
      return;
    }
    if (exchangeRate <= 0) {
      setPurchaseOrdersError("Exchange rate must be greater than zero.");
      pushAlert("warning", "Exchange rate must be greater than zero.");
      return;
    }
    if (!actionableEntries.length) {
      setPurchaseOrdersError("Add at least one purchase order line.");
      pushAlert("warning", "Add at least one purchase order line.");
      return;
    }

    const invalidEntry = actionableEntries.find(
      (entry) =>
        (!entry.itemId && !String(entry.itemLookupCode || "").trim()) ||
        entry.quantityOrdered <= 0
    );
    if (invalidEntry) {
      setPurchaseOrdersError("Each line must include an item and quantity.");
      pushAlert("warning", "Complete every line with an item and quantity.");
      return;
    }

    setSavingPurchaseOrder(true);
    setPurchaseOrdersError("");
    try {
      const payload = {
        po_title: poTitle,
        po_type: Number(newPurchaseOrderForm.poType || 1),
        store_id: Number(newPurchaseOrderForm.storeId || 1),
        p_status: Number(newPurchaseOrderForm.pStatus || 0),
        p_to: pTo,
        ship_to: shipTo,
        requisioner,
        ship_via: newPurchaseOrderForm.shipVia.trim(),
        fob_point: newPurchaseOrderForm.fobPoint.trim(),
        terms: newPurchaseOrderForm.terms.trim(),
        tax_rate: Number(newPurchaseOrderForm.taxRate || 0),
        shipping,
        freight: newPurchaseOrderForm.freight.trim(),
        required_date: newPurchaseOrderForm.requiredDate
          ? new Date(`${newPurchaseOrderForm.requiredDate}T00:00:00`).toISOString()
          : null,
        confirming_to: newPurchaseOrderForm.confirmingTo.trim(),
        remarks: newPurchaseOrderForm.remarks.trim(),
        supplier_id: supplierId,
        currency_id: Number(newPurchaseOrderForm.currencyId || 1),
        exchange_rate: exchangeRate,
        user_id: Number(currentUser?.id || 1),
        inventory_location: Number(newPurchaseOrderForm.inventoryLocation || 1),
        is_placed: Boolean(newPurchaseOrderForm.isPlaced),
        date_placed:
          newPurchaseOrderForm.isPlaced && newPurchaseOrderForm.datePlaced
            ? new Date(newPurchaseOrderForm.datePlaced).toISOString()
            : null,
        entries: actionableEntries.map((entry) => ({
          item_id: entry.itemId || null,
          item_lookup_code: entry.itemLookupCode,
          item_description: entry.itemDescription,
          quantity_ordered: entry.quantityOrdered,
          price: entry.price,
          costed_price: entry.costedPrice,
          tax_rate: entry.taxRate,
        })),
      };

      const res = await apiFetch(`${API_BASE_URL}/erp/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Purchase order endpoint not available. Restart the backend and reload ERP."
            : data?.detail || "Failed to create purchase order"
        );
      }

      setPurchaseOrdersRecords((prev) => [
        data,
        ...prev.filter((purchaseOrder) => Number(purchaseOrder.id) !== Number(data.id)),
      ]);
      closePurchaseOrderForm();
      if (searchTerm.trim()) {
        setSearchTerm("");
      }
      pushAlert("success", `Purchase order ${data.po_number || ""} created successfully.`);
    } catch (error) {
      const message = error.message || "Failed to create purchase order";
      setPurchaseOrdersError(message);
      pushAlert("error", message);
    } finally {
      setSavingPurchaseOrder(false);
    }
  };

  const fetchLookupDefaults = async (lookupCode) => {
    const code = lookupCode.trim();
    if (!code) return;
    try {
      const data = await fetchJsonWithFallback(
        `/erp/items/by-lookup/${encodeURIComponent(code)}`,
        undefined,
        "Failed to load item defaults"
      );
      const matchedCategory =
        categoryReferenceRecords.find(
          (category) =>
            String(category.name || "").trim().toLowerCase() ===
            String(data.category || "").trim().toLowerCase()
        ) || null;
      setNewItemForm((prev) => ({
        ...prev,
        description: prev.description || String(data.description || ""),
        category:
          prev.category ||
          String(data.category || ""),
        categoryId:
          prev.categoryId ||
          (Number(data.category_id || 0) > 0
            ? String(Number(data.category_id))
            : matchedCategory && Number(matchedCategory.id || 0) > 0
            ? String(Number(matchedCategory.id))
            : ""),
        price: String(Number(data.price || 0)),
        cost: String(Number(data.cost || 0)),
        reorderLevel:
          prev.reorderLevel && Number(prev.reorderLevel) !== 0
            ? prev.reorderLevel
            : String(Number(data.reorder_level || 0)),
        taxable: Boolean(data.taxable),
        consignment: Boolean(data.consignment),
      }));
      const fetchedCost = Number(data.cost || 0);
      const fetchedPrice = Number(data.price || 0);
      if (fetchedCost > 0) {
        const markup = ((fetchedPrice - fetchedCost) / fetchedCost) * 100;
        setNewItemForm((prev) => ({ ...prev, markupPercent: String(Number(markup.toFixed(2))) }));
      }
    } catch (error) {
      // keep manual flow if lookup is not found/unreachable
    }
  };

  const handleRemoveItem = async () => {
    if (!selectedItemLookupCode) {
      setItemsError("Select an item row to remove.");
      pushAlert("warning", "Select an item row to remove.");
      return;
    }

    const confirmed = window.confirm(`Remove item ${selectedItemLookupCode}?`);
    if (!confirmed) return;

    setRemovingItem(true);
    setItemsError("");
    try {
      await fetchJsonWithFallback(
        `/erp/items/${encodeURIComponent(selectedItemLookupCode)}`,
        {
          method: "DELETE",
        },
        "Failed to remove item"
      );
      setItemsRecords((prev) => prev.filter((item) => item.lookup_code !== selectedItemLookupCode));
      setSelectedItemLookupCode("");
      pushAlert("success", "Item removed successfully.");
    } catch (error) {
      setItemsError(error.message || "Failed to remove item");
      pushAlert("error", error.message || "Failed to remove item");
    } finally {
      setRemovingItem(false);
    }
  };

  const handleExportItems = () => {
    const columns = itemsTableData.columns;
    const rows = filteredItemsRecords.map((item) => [
      item.alias || "",
      item.lookup_code || "",
      item.description || "",
      String(item.price ?? 0),
      String(item.cost ?? 0),
      String(item.sale_price ?? 0),
      String(item.stock_available ?? 0),
    ]);

    const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [columns.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "items_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleProperties = () => {
    openItemPropertiesModal();
  };

  const handleCheckForUpdates = async () => {
    if (!updaterBridge) {
      pushAlert("info", "Updates are available only in the packaged Electron ERP app.");
      return;
    }

    try {
      const nextState = await updaterBridge.check();
      if (nextState) {
        setUpdateState(nextState);
      }
    } catch (error) {
      const message = error.message || "Failed to check for updates.";
      setUpdateState((prev) => ({
        ...prev,
        status: "error",
        message,
      }));
      pushAlert("error", message);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!updaterBridge) {
      pushAlert("info", "Updates are available only in the packaged Electron ERP app.");
      return;
    }

    try {
      const nextState = await updaterBridge.download();
      if (nextState) {
        setUpdateState(nextState);
      }
    } catch (error) {
      const message = error.message || "Failed to download the update.";
      setUpdateState((prev) => ({
        ...prev,
        status: "error",
        message,
      }));
      pushAlert("error", message);
    }
  };

  const handleInstallUpdate = async () => {
    if (!updaterBridge) {
      pushAlert("info", "Updates are available only in the packaged Electron ERP app.");
      return;
    }

    try {
      const nextState = await updaterBridge.install();
      if (nextState) {
        setUpdateState(nextState);
      }
    } catch (error) {
      const message = error.message || "Failed to install the update.";
      setUpdateState((prev) => ({
        ...prev,
        status: "error",
        message,
      }));
      pushAlert("error", message);
    }
  };

  useEffect(() => {
    if (!isItemsView && !isStockOverviewView && !isReorderView) return;

    const timer = setTimeout(() => {
      loadItems(searchTerm);
      if (isItemsView) {
        setSelectedItemLookupCode("");
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isItemsView, isStockOverviewView, isReorderView, searchTerm]);

  useEffect(() => {
    if (!isItemsView || categoryOptionsRecords.length || categoryOptionsLoading) return;
    void loadCategoryOptions().catch(() => null);
  }, [isItemsView, categoryOptionsRecords.length, categoryOptionsLoading]);

  useEffect(() => {
    if (!isSuppliersView) return;

    const timer = setTimeout(() => {
      loadSuppliers(searchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [isSuppliersView, searchTerm]);

  useEffect(() => {
    if (!isDashboardView) return;
    loadDashboardSummary();
  }, [isDashboardView]);

  useEffect(() => {
    if (!isDashboardView) return;
    loadItems("");
  }, [isDashboardView]);

  useEffect(() => {
    if (!isDashboardView) return;
    if (!dashboardDateFrom || !dashboardDateTo) return;
    if (dashboardDateFrom > dashboardDateTo) {
      setDashboardCategorySales([]);
      setDashboardCategorySalesTotal(0);
      setDashboardCategorySalesError("Choose a valid date range.");
      return;
    }
    loadDashboardCategorySales(dashboardDateFrom, dashboardDateTo);
  }, [isDashboardView, dashboardDateFrom, dashboardDateTo]);

  useEffect(() => {
    if (!isUsersView) return;

    const timer = setTimeout(() => {
      loadUsers(searchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [isUsersView, searchTerm]);

  useEffect(() => {
    if (!isCategoriesView) return;

    const timer = setTimeout(() => {
      loadCategories(searchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [isCategoriesView, searchTerm]);

  useEffect(() => {
    if (!isPurchaseOrdersView) return;

    const timer = setTimeout(() => {
      loadPurchaseOrders(searchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [isPurchaseOrdersView, searchTerm]);

  useEffect(() => {
    if (!isPriceChangeView) return;

    const timer = setTimeout(() => {
      loadPriceChanges(searchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [isPriceChangeView, searchTerm]);

  useEffect(() => {
    if (!showAddPurchaseOrderForm || !isPurchaseOrdersView || isViewingPurchaseOrder) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      purchaseOrderLookupInputRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [showAddPurchaseOrderForm, isPurchaseOrdersView, isViewingPurchaseOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeNav, activeManagementTab, activeInventoryTab, searchTerm, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!isPurchaseOrdersView || selectedPurchaseOrderId === null) return;
    if (selectedPurchaseOrderRecord) return;
    setSelectedPurchaseOrderId(null);
  }, [isPurchaseOrdersView, selectedPurchaseOrderId, selectedPurchaseOrderRecord]);

  useEffect(() => {
    if (!isPriceChangeView || selectedPriceChangeId === null) return;
    if (selectedPriceChangeRecord) return;
    setSelectedPriceChangeId(null);
  }, [isPriceChangeView, selectedPriceChangeId, selectedPriceChangeRecord]);

  useEffect(() => {
    if (!isPriceChangeView || priceChangeComposerMode !== "view") return;
    if (selectedPriceChangeId !== null) return;
    if (!priceChangesRecords.length) return;
    setSelectedPriceChangeId(priceChangesRecords[0].id);
  }, [isPriceChangeView, priceChangeComposerMode, selectedPriceChangeId, priceChangesRecords]);

  useEffect(() => {
    if (!isPriceChangeView || priceChangeComposerMode !== "create") return;

    const timer = window.setTimeout(() => {
      priceChangeLookupInputRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [isPriceChangeView, priceChangeComposerMode]);

  useEffect(() => {
    if (!isSuppliersView || selectedSupplierId === null) return;
    if (selectedSupplierRecord) return;
    setSelectedSupplierId(null);
  }, [isSuppliersView, selectedSupplierId, selectedSupplierRecord]);

  useEffect(() => {
    if (!isCategoriesView || selectedCategoryId === null) return;
    if (selectedCategoryRecord) return;
    setSelectedCategoryId(null);
  }, [isCategoriesView, selectedCategoryId, selectedCategoryRecord]);

  useEffect(() => {
    if (!updaterBridge) return undefined;

    let disposed = false;
    let subscriptionId = null;

    updaterBridge
      .getState()
      .then((state) => {
        if (!disposed && state) {
          setUpdateState(state);
        }
      })
      .catch((error) => {
        if (!disposed) {
          setUpdateState((prev) => ({
            ...prev,
            status: "error",
            message: error.message || "Failed to read updater state.",
          }));
        }
      });

    subscriptionId = updaterBridge.subscribe((state) => {
      if (!disposed && state) {
        setUpdateState(state);
      }
    });

    return () => {
      disposed = true;
      if (subscriptionId !== null) {
        updaterBridge.unsubscribe(subscriptionId);
      }
    };
  }, [updaterBridge]);

  return (
    <div className={`erp-shell ${isAnyModalOpen ? "is-modal-open" : ""}`.trim()}>
      <div className="erp-bg-gradient" />
      <aside className="erp-sidebar">
        <div className="erp-brand">
          <div className="erp-brand-badge">EM</div>
          <div>
            <p className="erp-brand-title">ParhelionERP</p>
            <p className="erp-brand-subtitle">Enterprise workspace</p>
          </div>
        </div>

        <nav className="erp-nav">
          {navItems.map((item) => (
            <React.Fragment key={item.id}>
              <button
                className={`erp-nav-item ${activeNav === item.id ? "is-active" : ""}`}
                onClick={() => {
                  setActiveNav(item.id);
                  closeItemForm();
                  closeSupplierForm();
                  closePurchaseOrderForm();
                  closeUserForm();
                  closeCategoryForm();
                  closePriceChangeComposer();
                  closeFingerprintModal();
                  setSelectedSupplierId(null);
                  setSelectedUserId(null);
                  setSelectedCategoryId(null);
                  setSelectedPurchaseOrderId(null);
                  setSelectedPriceChangeId(null);
                }}
                type="button"
              >
                <span className={`erp-nav-icon-wrap ${item.tone}`}>
                  <item.icon size={16} strokeWidth={2.1} className="erp-nav-icon" />
                </span>
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          ))}
        </nav>
      </aside>

      <main
        className={`erp-content ${isDashboardView ? "is-dashboard-view" : ""} ${
          isWorkspaceView ? "is-workspace-view" : ""
        }`.trim()}
      >
        <div className="erp-alerts">
          {alerts.map((alert) => (
            <div key={alert.id} className={`erp-alert erp-alert-${alert.type}`}>
              <span className="erp-alert-icon">
                {alert.type === "success" && <CheckCircle2 size={16} />}
                {alert.type === "warning" && <TriangleAlert size={16} />}
                {alert.type === "error" && <AlertCircle size={16} />}
                {alert.type === "info" && <Info size={16} />}
              </span>
              <span>{alert.message}</span>
              <button type="button" className="erp-alert-close" onClick={() => dismissAlert(alert.id)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <header className="erp-topbar">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-session-chip">
              <span>{currentUserLabel}</span>
              <strong>{currentUserRole}</strong>
            </div>
            <button
              className="erp-action-btn"
              type="button"
              onClick={() => {
                if (isItemsView) {
                  if (showAddItemForm && !isEditingItem) {
                    closeItemForm();
                  } else {
                    openCreateItemModal();
                  }
                } else if (isSuppliersView) {
                  if (showAddSupplierForm) {
                    closeSupplierForm();
                  } else {
                    openCreateSupplierModal();
                  }
                } else if (isPurchaseOrdersView) {
                  if (showAddPurchaseOrderForm) {
                    closePurchaseOrderForm();
                  } else {
                    openCreatePurchaseOrderModal();
                  }
                } else if (isUsersView) {
                  if (showAddUserForm) {
                    closeUserForm();
                  } else {
                    openCreateUserModal();
                  }
                } else if (isCategoriesView) {
                  if (showAddCategoryForm) {
                    closeCategoryForm();
                  } else {
                    openCreateCategoryModal();
                  }
                } else if (isInventoryWorkspace) {
                  handleInventoryModuleAction(selectedInventoryTab.actions[0] || "Open module");
                }
              }}
            >
              {isItemsView
                ? "Add Item"
                : isSuppliersView
                ? "Add Supplier"
                : isUsersView
                ? "Add User"
                : isCategoriesView
                ? "New Category"
                : isInventoryWorkspace
                ? selectedInventoryTab.actions[0] || "New"
                : "New"}
            </button>
            {onLogout && (
              <button
                className="erp-action-btn erp-action-btn-secondary"
                type="button"
                onClick={onLogout}
              >
                <LogOut size={16} />
                <span>Log out</span>
              </button>
            )}
          </div>
        </header>
        {isWorkspaceView && (
          <section
            className="erp-management-tabs"
            role="tablist"
            aria-label={isInventoryWorkspace ? "Inventory sub menu" : "Managment sub menu"}
          >
            {workspaceTabs.map((tab) => (
              <button
                key={tab.id}
                className={`erp-management-tab ${selectedWorkspaceTab.id === tab.id ? "is-active" : ""}`}
                onClick={() => {
                  if (isInventoryWorkspace) {
                    setActiveInventoryTab(tab.id);
                  } else {
                    setActiveManagementTab(tab.id);
                  }
                  setSearchTerm("");
                  closeItemForm();
                  closeSupplierForm();
                  closePurchaseOrderForm();
                  closeUserForm();
                  closeCategoryForm();
                  closePriceChangeComposer();
                  closeFingerprintModal();
                  setSelectedSupplierId(null);
                  setSelectedUserId(null);
                  setSelectedCategoryId(null);
                  setSelectedPriceChangeId(null);
                }}
                type="button"
                role="tab"
                aria-selected={selectedWorkspaceTab.id === tab.id}
              >
                <span className={`erp-management-tab-icon-wrap ${tab.tone}`}>
                  <tab.icon size={15} strokeWidth={2.1} className="erp-management-tab-icon" />
                </span>
                <span>{tab.label}</span>
              </button>
            ))}
          </section>
        )}

        <section className="erp-panels">
          <article className={`erp-panel erp-panel-large ${!isWorkspaceView ? "erp-home-card" : ""}`.trim()}>
            {isWorkspaceView ? (
              <div className="erp-management-content">
                <div className="erp-search-wrap">
                  <div className="erp-search-input-group">
                    <span className="erp-search-icon-wrap" aria-hidden="true">
                      <Search size={16} strokeWidth={2.2} className="erp-search-icon" />
                    </span>
                    <input
                      className="erp-search-input"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={`Search ${selectedWorkspaceTab.label.toLowerCase()}...`}
                    />
                  </div>
                  {isItemsView && (
                    <div className="erp-search-actions">
                      <button
                        type="button"
                        className="erp-mini-btn erp-mini-btn-primary"
                        onClick={openCreateItemModal}
                      >
                        New Item
                      </button>
                      <button type="button" className="erp-mini-btn" onClick={handleExportItems}>
                        Export Items
                      </button>
                      <button
                        type="button"
                        className="erp-mini-btn"
                        onClick={handleProperties}
                        disabled={!selectedItemLookupCode}
                      >
                        Properties
                      </button>
                      <button
                        type="button"
                        className="erp-mini-btn erp-mini-btn-danger"
                        onClick={handleRemoveItem}
                        disabled={!selectedItemLookupCode || removingItem}
                      >
                        {removingItem ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  )}
                  {isSuppliersView && (
                    <div className="erp-search-actions">
                      <button
                        type="button"
                        className="erp-mini-btn erp-mini-btn-primary"
                        onClick={openCreateSupplierModal}
                      >
                        New Supplier
                      </button>
                      <button
                        type="button"
                        className="erp-mini-btn"
                        onClick={handleOpenSupplierProperties}
                        disabled={!selectedSupplierId}
                      >
                        <IdCard size={14} />
                        Properties
                      </button>
                    </div>
                  )}
                  {isUsersView && (
                    <div className="erp-search-actions">
                      <button
                        type="button"
                        className="erp-mini-btn erp-mini-btn-primary"
                        onClick={openCreateUserModal}
                      >
                        <UserRoundPlus size={14} />
                        New User
                      </button>
                      <button
                        type="button"
                        className="erp-mini-btn"
                        onClick={handleFingerprintSetup}
                        disabled={!selectedUserId}
                      >
                        <Fingerprint size={16} />
                        Fingerprint
                      </button>
                      <button
                        type="button"
                        className="erp-mini-btn"
                        onClick={handleOpenUserProperties}
                        disabled={!selectedUserId}
                      >
                        <IdCard size={14} />
                        User Properties
                      </button>
                    </div>
                  )}
                  {isCategoriesView && (
                    <div className="erp-search-actions">
                      <button
                        type="button"
                        className="erp-mini-btn erp-mini-btn-primary"
                        onClick={openCreateCategoryModal}
                      >
                        <Tags size={14} />
                        New Category
                      </button>
                      <button
                        type="button"
                        className="erp-mini-btn"
                        onClick={handleOpenCategoryProperties}
                        disabled={!selectedCategoryId}
                      >
                        <IdCard size={14} />
                        Properties
                      </button>
                    </div>
                  )}
                  {isInventoryWorkspace && (
                    <div className="erp-search-actions">
                      {selectedInventoryTab.actions.map((actionLabel, actionIndex) => (
                        <button
                          key={`${selectedInventoryTab.id}-${actionLabel}`}
                          type="button"
                          className={`erp-mini-btn ${actionIndex === 0 ? "erp-mini-btn-primary" : ""}`.trim()}
                          onClick={() => handleInventoryModuleAction(actionLabel)}
                          disabled={
                            (isPurchaseOrdersView &&
                              actionLabel === "Properties" &&
                              !selectedPurchaseOrderRecord) ||
                            (isStockOverviewView &&
                              actionLabel === "Properties" &&
                              !selectedInventoryItemRecord) ||
                            (isPriceChangeView &&
                              actionLabel === "Approve Prices" &&
                              !selectedPriceChangeRecord)
                          }
                        >
                          {actionLabel}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(isItemsView || isStockOverviewView || isReorderView) && itemsLoading && (
                  <p className="erp-table-status">Loading items...</p>
                )}
                {(isItemsView || isStockOverviewView || isReorderView) && itemsError && (
                  <p className="erp-table-status erp-table-status-error">{itemsError}</p>
                )}
                {isSuppliersView && suppliersLoading && <p className="erp-table-status">Loading suppliers...</p>}
                {isSuppliersView && suppliersError && <p className="erp-table-status erp-table-status-error">{suppliersError}</p>}
                {isPurchaseOrdersView && purchaseOrdersLoading && <p className="erp-table-status">Loading purchase orders...</p>}
                {isPurchaseOrdersView && purchaseOrdersError && <p className="erp-table-status erp-table-status-error">{purchaseOrdersError}</p>}
                {isPriceChangeView && priceChangesLoading && <p className="erp-table-status">Loading price changes...</p>}
                {isPriceChangeView && priceChangesError && <p className="erp-table-status erp-table-status-error">{priceChangesError}</p>}
                {isUsersView && usersLoading && <p className="erp-table-status">Loading users...</p>}
                {isUsersView && usersError && <p className="erp-table-status erp-table-status-error">{usersError}</p>}
                {isCategoriesView && categoriesLoading && <p className="erp-table-status">Loading categories...</p>}
                {isCategoriesView && categoriesError && <p className="erp-table-status erp-table-status-error">{categoriesError}</p>}
                {isPriceChangeView ? (
                  <PriceChangeWorkspace
                    summary={priceChangeSummary}
                    records={pagedPriceChangesRecords}
                    totalRecords={totalRecords}
                    selectedPriceChangeId={selectedPriceChangeId}
                    onSelectPriceChange={(nextId) => {
                      setSelectedPriceChangeId(nextId);
                      if (priceChangeComposerMode !== "view") {
                        setPriceChangeComposerMode("view");
                      }
                    }}
                    composerMode={priceChangeComposerMode}
                    selectedPriceChangeRecord={selectedPriceChangeRecord}
                    onOpenCreate={openCreatePriceChangeComposer}
                    onOpenEdit={openEditPriceChangeComposer}
                    onCloseComposer={closePriceChangeComposer}
                    form={newPriceChangeForm}
                    onFormChange={updatePriceChangeForm}
                    onItemFieldChange={updatePriceChangeItemField}
                    onItemPriceChange={updatePriceChangeItemPrice}
                    lookupValue={priceChangeLookupValue}
                    onLookupValueChange={setPriceChangeLookupValue}
                    lookupPending={priceChangeLookupPending}
                    onAddItem={handleAddPriceChangeItem}
                    lookupInputRef={priceChangeLookupInputRef}
                    onRemoveItem={removePriceChangeItem}
                    onSave={handleSavePriceChange}
                    saving={savingPriceChange}
                    onApprove={handleApproveSelectedPriceChange}
                    onApply={handleApplySelectedPriceChange}
                    onCancel={handleCancelSelectedPriceChange}
                    actionPending={priceChangeActionPending}
                    rowsPerPage={rowsPerPage}
                    pageOptions={tablePageSizeOptions}
                    onRowsPerPageChange={(nextValue) =>
                      setRowsPerPage(Number(nextValue) || TABLE_PAGE_SIZE_OPTIONS[0])
                    }
                    pageStartRecord={pageStartRecord}
                    pageEndRecord={pageEndRecord}
                    safePage={safePage}
                    totalPages={totalPages}
                    onPrevPage={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    onNextPage={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    tableWrapRef={tableWrapRef}
                  />
                ) : (
                <div className={`erp-table-region ${isSuppliersView ? "erp-supplier-view-layout" : ""}`.trim()}>
                  <div className={`${isSuppliersView ? "erp-supplier-main " : ""}erp-table-layout`.trim()}>
                <div className="erp-table-wrap" ref={tableWrapRef}>
                  <table
                    className={`erp-data-table ${isUsersView ? "is-users-table" : ""} ${
                      isItemsView ? "is-items-table" : ""
                    } ${
                      isSuppliersView ? "is-suppliers-table" : ""
                    } ${isStockOverviewView ? "is-stock-overview-table" : ""} ${
                      isReorderView ? "is-reorder-table" : ""
                    }`.trim()}
                  >
                    <thead>
                      <tr>
                        {selectedWorkspaceData.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {isItemsView
                        ? pagedItemsRecords.map((item, rowIndex) => {
                          const stockAvailable = Number(item.stock_available ?? 0);
                          const hasStock = stockAvailable > 0;
                          const row = [
                              item.alias || "",
                              item.lookup_code || "",
                              item.description || "",
                              Number(item.price || 0).toLocaleString(),
                              Number(item.cost || 0).toLocaleString(),
                              Number(item.sale_price || 0).toLocaleString(),
                              stockAvailable.toLocaleString(),
                            ];
                            const isSelected = selectedItemLookupCode === (item.lookup_code || "");
                            return (
                              <tr
                                key={`${activeManagementTab}-${rowIndex}-${item.lookup_code || item.id}`}
                                className={isSelected ? "is-selected-row" : ""}
                                onClick={() => setSelectedItemLookupCode(item.lookup_code || "")}
                              >
                                {row.map((cell, cellIndex) => (
                                  <td
                                    key={`${activeManagementTab}-${rowIndex}-${cellIndex}`}
                                    className={cellIndex === 6 ? "erp-stock-cell" : ""}
                                  >
                                    {cellIndex === 6 ? (
                                      <span className="erp-stock-cell-content">
                                        <span>{cell}</span>
                                        <BarChart3
                                          size={15}
                                          aria-hidden="true"
                                          className={`erp-stock-cell-icon ${
                                            hasStock ? "is-in-stock" : "is-out-of-stock"
                                          }`}
                                        />
                                      </span>
                                    ) : (
                                      cell
                                    )}
                                  </td>
                                ))}
                              </tr>
                            );
                          })
                        : isSuppliersView
                        ? pagedSuppliersRecords.map((supplier, rowIndex) => {
                            const isSelected = Number(selectedSupplierId) === Number(supplier.id);
                            return (
                              <tr
                                key={`${activeManagementTab}-${rowIndex}-${supplier.code || supplier.id || rowIndex}`}
                                className={isSelected ? "is-selected-row" : ""}
                                onClick={() => setSelectedSupplierId(Number(supplier.id))}
                              >
                                <td>{String(supplier.id || "")}</td>
                                <td>{supplier.code || ""}</td>
                                <td>{supplier.supplier_name || ""}</td>
                                <td>{supplier.contact_name || ""}</td>
                                <td>{supplier.phone_number || ""}</td>
                                <td>{supplier.terms || ""}</td>
                              </tr>
                            );
                          })
                        : isUsersView
                        ? pagedUsersRecords.map((user, rowIndex) => {
                            const isSelected = Number(selectedUserId) === Number(user.id);
                            return (
                            <tr
                              key={`${activeManagementTab}-${rowIndex}-${user.id || rowIndex}`}
                              className={isSelected ? "is-selected-row" : ""}
                              onClick={() => setSelectedUserId(Number(user.id))}
                            >
                              <td>{String(user.id || "")}</td>
                              <td>{user.number || ""}</td>
                              <td>{user.name || ""}</td>
                              <td>{user.user_role || ""}</td>
                              <td>{user.email_address || ""}</td>
                              <td>{user.status || ""}</td>
                            </tr>
                          );
                        })
                        : isCategoriesView
                        ? pagedCategoriesRecords.map((category, rowIndex) => {
                            const categoryId = Number(category.id || 0);
                            const isSelectable = categoryId > 0;
                            const isSelected = isSelectable && Number(selectedCategoryId) === categoryId;
                            return (
                              <tr
                                key={`${activeManagementTab}-${rowIndex}-${category.id || rowIndex}`}
                                className={isSelected ? "is-selected-row" : ""}
                                onClick={() => setSelectedCategoryId(isSelectable ? categoryId : null)}
                              >
                                <td>{categoryId ? String(categoryId) : "--"}</td>
                                <td>{category.code || "--"}</td>
                                <td>{category.name || ""}</td>
                                <td>{category.parent || "--"}</td>
                                <td>{String(category.items ?? 0)}</td>
                                <td>{category.status || "Active"}</td>
                              </tr>
                            );
                          })
                        : isPurchaseOrdersView
                        ? pagedPurchaseOrdersRecords.map((purchaseOrder, rowIndex) => {
                            const isSelected =
                              Number(selectedPurchaseOrderId) === Number(purchaseOrder.id);
                            return (
                              <tr
                                key={`${activeInventoryTab}-${rowIndex}-${purchaseOrder.purchase_order_id || purchaseOrder.id}`}
                                className={isSelected ? "is-selected-row" : ""}
                                onClick={() => setSelectedPurchaseOrderId(Number(purchaseOrder.id))}
                              >
                                <td>{purchaseOrder.po_number || ""}</td>
                                <td>{purchaseOrder.po_title || ""}</td>
                                <td>{purchaseOrder.supplier_name || ""}</td>
                                <td>
                                  {purchaseOrder.date_created
                                    ? new Date(purchaseOrder.date_created).toLocaleDateString()
                                    : ""}
                                </td>
                                <td>
                                  {purchaseOrder.required_date
                                    ? new Date(purchaseOrder.required_date).toLocaleDateString()
                                    : ""}
                                </td>
                                <td>{String(purchaseOrder.items_count ?? 0)}</td>
                                <td>{Number(purchaseOrder.total_amount || 0).toLocaleString()}</td>
                                <td>{purchaseOrder.status_label || ""}</td>
                              </tr>
                            );
                          })
                        : isInventoryWorkspace
                        ? pagedInventoryRows.map((row, rowIndex) => {
                            const onHandValue = Number(String(row[2] || "0").replace(/,/g, ""));
                            const hasStock = onHandValue > 0;
                            const reorderLevelColumnIndex = isStockOverviewView ? 4 : isReorderView ? 3 : -1;
                            const reorderLevelValue =
                              reorderLevelColumnIndex >= 0
                                ? Number(String(row[reorderLevelColumnIndex] || "0").replace(/,/g, ""))
                                : 0;
                            const hasReorderLevel = reorderLevelValue > 0;
                            return (
                              <tr
                                key={`${activeInventoryTab}-${rowIndex}-${row[0] || rowIndex}`}
                                className={
                                  (isStockOverviewView || isReorderView) &&
                                  String(row[0] || "") === String(selectedInventoryItemLookupCode || "")
                                    ? "is-selected-row"
                                    : ""
                                }
                                onClick={() => {
                                  if (isStockOverviewView || isReorderView) {
                                    setSelectedInventoryItemLookupCode(String(row[0] || ""));
                                  }
                                }}
                              >
                                {row.map((cell, cellIndex) => {
                                  const showStockIcon =
                                    (isStockOverviewView || isReorderView) && cellIndex === 2;
                                  const showReorderLevelIcon =
                                    (isStockOverviewView && cellIndex === 4) ||
                                    (isReorderView && cellIndex === 3);
                                  const showMetricIcon = showStockIcon || showReorderLevelIcon;
                                  const metricToneClass = showStockIcon
                                    ? hasStock
                                      ? "is-in-stock"
                                      : "is-out-of-stock"
                                    : !hasReorderLevel
                                    ? "is-out-of-stock"
                                    : onHandValue < reorderLevelValue
                                    ? "is-below-reorder"
                                    : "is-in-stock";
                                  return (
                                    <td
                                      key={`${activeInventoryTab}-${rowIndex}-${cellIndex}`}
                                      className={showMetricIcon ? "erp-stock-cell" : ""}
                                    >
                                      {showMetricIcon ? (
                                        <span className="erp-stock-cell-content">
                                          <span>{cell}</span>
                                          <BarChart3
                                            size={15}
                                            aria-hidden="true"
                                            className={`erp-stock-cell-icon ${metricToneClass}`}
                                          />
                                        </span>
                                      ) : (
                                        cell
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        : pagedManagementRows.map((row, rowIndex) => (
                            <tr key={`${activeManagementTab}-${rowIndex}`}>
                              {row.map((cell, cellIndex) => (
                                <td key={`${activeManagementTab}-${rowIndex}-${cellIndex}`}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                      {(isItemsView
                        ? filteredItemsRecords.length === 0
                        : isSuppliersView
                        ? filteredSuppliersRecords.length === 0
                        : isPurchaseOrdersView
                        ? filteredPurchaseOrdersRecords.length === 0
                        : isUsersView
                        ? filteredUsersRecords.length === 0
                        : isCategoriesView
                        ? filteredCategoriesRecords.length === 0
                        : isInventoryWorkspace
                        ? filteredInventoryRows.length === 0
                        : filteredManagementRows.length === 0) && (
                        <tr>
                          <td colSpan={selectedWorkspaceData.columns.length} className="erp-table-empty">
                            No matching records.
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
                      <ErpCustomSelect
                        value={String(rowsPerPage)}
                        options={tablePageSizeOptions}
                        onChange={(nextValue) => setRowsPerPage(Number(nextValue) || TABLE_PAGE_SIZE_OPTIONS[0])}
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
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={safePage === 1}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="erp-mini-btn"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={safePage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
                  </div>
                  {isSuppliersView && (
                    <aside className="erp-supplier-details-panel">
                      {selectedSupplierPanelData ? (
                        <>
                          <div className="erp-supplier-details-header">
                            <div>
                              <p className="erp-supplier-details-eyebrow">Supplier Details</p>
                              <h3>{selectedSupplierPanelData.supplierName}</h3>
                              <p className="erp-supplier-details-subtitle">
                                Code {selectedSupplierPanelData.supplierCode}
                              </p>
                            </div>
                            <span className="erp-supplier-details-id-chip">
                              ID {selectedSupplierPanelData.supplierId}
                            </span>
                          </div>

                          <div className="erp-supplier-details-badges">
                            {selectedSupplierPanelData.statusBadges.map((badge) => (
                              <span
                                key={`${selectedSupplierPanelData.supplierId}-${badge.label}`}
                                className={`erp-supplier-details-badge ${badge.tone}`}
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>

                          <div className="erp-supplier-details-actions">
                            <button
                              type="button"
                              className="erp-mini-btn"
                              onClick={handleOpenSupplierProperties}
                            >
                              <IdCard size={14} />
                              Properties
                            </button>
                            <button
                              type="button"
                              className="erp-mini-btn erp-mini-btn-primary"
                              onClick={() => openCreatePurchaseOrderModal(selectedSupplierRecord)}
                            >
                              <ShoppingCart size={14} />
                              New PO
                            </button>
                          </div>

                          <section className="erp-supplier-details-section">
                            <h4>Notes</h4>
                            <div className="erp-supplier-details-note">
                              <span className="erp-supplier-details-label">Notes</span>
                              <p>{selectedSupplierPanelData.notes}</p>
                            </div>
                          </section>
                        </>
                      ) : (
                        <div className="erp-supplier-details-empty">
                          <p className="erp-supplier-details-eyebrow">Supplier Details</p>
                          <h3>Select a supplier</h3>
                          <p>
                            Click a supplier row to review contact information, approval status,
                            address, and procurement settings here.
                          </p>
                          <button
                            type="button"
                            className="erp-mini-btn erp-mini-btn-primary"
                            onClick={openCreateSupplierModal}
                          >
                            New Supplier
                          </button>
                        </div>
                      )}
                    </aside>
                  )}
                </div>
                )}
              </div>
            ) : activeNav === "settings" ? (
              <div className="erp-settings-layout">
                <div className="erp-settings-view">
                  <div className="erp-settings-update-hero">
                    <div>
                      <span className={`erp-update-badge is-${updateStatusTone}`}>
                        {updateStatusLabel}
                      </span>
                      <h3>Application Updates</h3>
                    </div>
                    <div className="erp-update-version-chip">
                      <span>Current Version</span>
                      <strong>v{updateState.currentVersion || "1.0.0"}</strong>
                    </div>
                  </div>

                  <div className="erp-settings-update-grid">
                    <div className="erp-settings-update-stat">
                      <span>Current build</span>
                      <strong>v{updateState.currentVersion || "1.0.0"}</strong>
                    </div>
                    <div className="erp-settings-update-stat">
                      <span>Available build</span>
                      <strong>
                        {updateState.downloadedVersion ||
                          updateState.availableVersion ||
                          "No pending update"}
                      </strong>
                    </div>
                    <div className="erp-settings-update-stat">
                      <span>Last checked</span>
                      <strong>{formatUpdateDate(updateState.checkedAt)}</strong>
                    </div>
                    <div className="erp-settings-update-stat">
                      <span>Release date</span>
                      <strong>{formatUpdateDate(updateState.releaseDate)}</strong>
                    </div>
                  </div>

                  <div className="erp-update-message-box">
                    <p>{updateState.message}</p>
                    {updateTransferSpeed && updateState.status === "downloading" && (
                      <span>{updateTransferSpeed}</span>
                    )}
                  </div>

                  {(updateState.status === "downloading" ||
                    updateState.status === "downloaded" ||
                    updateProgressPercent > 0) && (
                    <div className="erp-update-progress-block">
                      <div className="erp-update-progress-meta">
                        <span>Download Progress</span>
                        <strong>{Math.round(updateProgressPercent)}%</strong>
                      </div>
                      <div className="erp-update-progress-track" aria-hidden="true">
                        <span
                          className="erp-update-progress-fill"
                          style={{ width: `${updateProgressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="erp-update-actions">
                    <button
                      type="button"
                      className="erp-mini-btn erp-mini-btn-primary"
                      onClick={handleCheckForUpdates}
                      disabled={!canCheckForUpdates}
                    >
                      {updateState.status === "checking"
                        ? "Checking..."
                        : "Check For Updates"}
                    </button>

                    {canDownloadUpdate && (
                      <button
                        type="button"
                        className="erp-mini-btn"
                        onClick={handleDownloadUpdate}
                      >
                        Download Update
                      </button>
                    )}

                    {canInstallUpdate && (
                      <button
                        type="button"
                        className="erp-mini-btn"
                        onClick={handleInstallUpdate}
                      >
                        Install And Restart
                      </button>
                    )}
                  </div>

                  {updateState.releaseNotes && (
                    <div className="erp-update-release-notes">
                      <h4>What&apos;s New</h4>
                      <p>{updateState.releaseNotes}</p>
                    </div>
                  )}
                </div>

                <aside className="erp-settings-aside">
                  <div className="erp-settings-side-card">
                    <h4>Release Checklist</h4>
                    <p>
                      Increase the app version, build a new ERP installer, then upload
                      {" "}
                      the generated GitHub release artifacts for this version.
                    </p>
                  </div>
                  <div className="erp-settings-side-card">
                    <h4>Update Feed</h4>
                    <p>
                      This installer checks PARHELION GROUP LIMITED update release
                      feed or ParhelionERP and ParhelionPOS channel when you use
                      Check For Updates.
                    </p>
                  </div>
                </aside>
              </div>
            ) : isDashboardView ? (
              <div className="erp-dashboard-overview">
                <div className="erp-dashboard-stat-grid">
                  {dashboardStatCards.map((card) => {
                    const SparkTrendIcon = card.TrendIcon;
                    const StatIcon = card.Icon;
                    return (
                      <article
                        key={card.id}
                        className={`erp-dashboard-stat-card ${card.tone}`}
                      >
                        <div className="erp-dashboard-stat-header">
                          <div className={`erp-dashboard-stat-icon ${card.tone}`}>
                            <StatIcon size={18} />
                          </div>
                          <div className="erp-dashboard-stat-copy">
                            <span className="erp-dashboard-stat-label">{card.title}</span>
                            <span className="erp-dashboard-stat-tag">{card.caption}</span>
                          </div>
                        </div>

                        <strong className="erp-dashboard-stat-value">{card.value}</strong>

                        <div className="erp-dashboard-stat-footer">
                          <span className={`erp-dashboard-stat-trend ${card.trendClass}`}>
                            <SparkTrendIcon size={14} />
                            <span>{card.note}</span>
                          </span>

                          <svg
                            className="erp-dashboard-stat-spark"
                            viewBox="0 0 64 36"
                            aria-hidden="true"
                          >
                            <polygon
                              className="erp-dashboard-stat-spark-fill"
                              points={`${card.sparkPoints} 60,34 4,34`}
                            />
                            <polyline
                              className="erp-dashboard-stat-spark-line"
                              points={card.sparkPoints}
                            />
                          </svg>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p>
                This area is ready for your {activeItem.label.toLowerCase()} module screens,
                tables, and workflows.
              </p>
            )}
          </article>
          {!isWorkspaceView && activeNav !== "settings" && (
            <>
              {isDashboardView ? (
                <article className="erp-panel erp-home-card erp-category-sales-card">
                  <div className="erp-category-sales-header">
                    <div>
                      <h3>Top Sales Categories</h3>
                    </div>
                    <div className="erp-category-sales-period">{dashboardCategoryPeriodLabel}</div>
                  </div>

                  <div className="erp-category-sales-body">
                    <div className="erp-category-sales-chart-card">
                      {dashboardCategorySalesError ? (
                        <p className="erp-table-status erp-table-status-error">{dashboardCategorySalesError}</p>
                      ) : dashboardCategorySalesLoading ? (
                        <p className="erp-table-status">Loading categories...</p>
                      ) : dashboardCategorySalesChart ? (
                        <div className="erp-category-sales-chart-shell">
                          <svg
                            className="erp-category-sales-chart"
                            viewBox={`0 0 ${dashboardCategorySalesChart.size} ${dashboardCategorySalesChart.size}`}
                            role="img"
                            aria-label="Top sales categories"
                          >
                            <circle
                              cx={dashboardCategorySalesChart.center}
                              cy={dashboardCategorySalesChart.center}
                              r={dashboardCategorySalesChart.radius}
                              className="erp-category-sales-track"
                              strokeWidth={dashboardCategorySalesChart.strokeWidth}
                            />
                            <g
                              transform={`rotate(-90 ${dashboardCategorySalesChart.center} ${dashboardCategorySalesChart.center})`}
                            >
                              {dashboardCategorySalesChart.segments.map((segment) => (
                                <circle
                                  key={segment.category}
                                  cx={dashboardCategorySalesChart.center}
                                  cy={dashboardCategorySalesChart.center}
                                  r={dashboardCategorySalesChart.radius}
                                  fill="none"
                                  stroke={segment.color}
                                  strokeWidth={dashboardCategorySalesChart.strokeWidth}
                                  strokeDasharray={segment.strokeDasharray}
                                  strokeDashoffset={segment.strokeDashoffset}
                                  strokeLinecap="round"
                                  className="erp-category-sales-segment"
                                />
                              ))}
                            </g>
                          </svg>
                          <div className="erp-category-sales-total">
                            <span>Total Sales</span>
                            <strong>{formatCurrencyValue(dashboardCategorySalesTotal)}</strong>
                          </div>
                        </div>
                      ) : (
                        <p className="erp-table-status">No category sales in the selected period.</p>
                      )}
                    </div>

                    <div className="erp-category-sales-legend">
                      {dashboardCategorySales.map((entry, index) => {
                        const color =
                          DASHBOARD_CATEGORY_COLORS[index % DASHBOARD_CATEGORY_COLORS.length];
                        const share =
                          dashboardCategorySalesTotal > 0
                            ? (Number(entry.sales || 0) / dashboardCategorySalesTotal) * 100
                            : 0;
                        return (
                          <div key={entry.category} className="erp-category-sales-legend-row">
                            <span
                              className="erp-category-sales-legend-dot"
                              style={{ backgroundColor: color }}
                            />
                            <div className="erp-category-sales-legend-content">
                              <span className="erp-category-sales-legend-name" title={entry.category}>
                                {entry.category}
                              </span>
                              <div className="erp-category-sales-legend-metrics">
                                <span className="erp-category-sales-legend-share">
                                  {share.toFixed(1)}%
                                </span>
                                <strong className="erp-category-sales-legend-value">
                                  {formatCurrencyValue(entry.sales)}
                                </strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>
              ) : (
                <article className="erp-panel erp-home-card">
                  <h3>Top Sales Categories</h3>
                  <p>Category sales distribution will appear here when dashboard data is available.</p>
                </article>
              )}
              <article className="erp-panel erp-home-card">
                <h3>Recent Activity</h3>
                <p>Show latest transactions, approvals, and alerts here.</p>
              </article>
            </>
          )}
        </section>
        {isItemsView && showAddItemForm && (
          <div className="erp-modal-overlay" onClick={closeItemForm}>
            <div
              className={`erp-modal-card ${itemFormWindowState === "full" ? "is-full" : ""} ${itemFormWindowState === "minimized" ? "is-minimized" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="erp-modal-header">
                <h3>{itemModalTitle}</h3>
                <div className="erp-window-controls">
                  <button
                    type="button"
                    className="erp-window-btn"
                    onClick={() =>
                      setItemFormWindowState((prev) => (prev === "minimized" ? "normal" : "minimized"))
                    }
                    aria-label="Minimize"
                  >
                    <Minimize2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="erp-window-btn"
                    onClick={() =>
                      setItemFormWindowState((prev) => (prev === "full" ? "normal" : "full"))
                    }
                    aria-label="Fullscreen"
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="erp-window-btn erp-window-btn-close"
                    onClick={closeItemForm}
                    aria-label="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              {itemFormWindowState !== "minimized" && (
                <>
                  {!itemFormLoading && !itemFormError && (
                    <div className="erp-form-tabs">
                      <button
                        type="button"
                        className={`erp-form-tab ${addItemTab === "basic" ? "is-active" : ""}`}
                        onClick={() => setAddItemTab("basic")}
                      >
                        Basic
                      </button>
                      <button
                        type="button"
                        className={`erp-form-tab ${addItemTab === "pricing" ? "is-active" : ""}`}
                        onClick={() => setAddItemTab("pricing")}
                      >
                        Pricing
                      </button>
                      <button
                        type="button"
                        className={`erp-form-tab ${addItemTab === "inventory" ? "is-active" : ""}`}
                        onClick={() => setAddItemTab("inventory")}
                      >
                        Inventory
                      </button>
                      <button
                        type="button"
                        className={`erp-form-tab ${addItemTab === "more" ? "is-active" : ""}`}
                        onClick={() => setAddItemTab("more")}
                      >
                        More
                      </button>
                    </div>
                  )}
                  {itemFormLoading ? (
                    <div className="erp-form-placeholder">Loading item details...</div>
                  ) : itemFormError ? (
                    <div className="erp-form-placeholder">{itemFormError}</div>
                  ) : (
                    <form className="erp-add-form-modal" onSubmit={handleSaveItem}>
                {addItemTab === "basic" && (
                  <>
                    <div className="erp-form-field">
                      <label>Lookup Code</label>
                      <input
                        type="text"
                        placeholder="e.g. 10012"
                        value={newItemForm.code}
                        onChange={(e) => setNewItemForm((prev) => ({ ...prev, code: e.target.value }))}
                        onBlur={() => {
                          if (!isEditingItem) {
                            fetchLookupDefaults(newItemForm.code);
                          }
                        }}
                        required
                      />
                    </div>
                    <div className="erp-form-field">
                      <label>Description</label>
                      <input
                        type="text"
                        placeholder="Item description"
                        value={newItemForm.description}
                        onChange={(e) => setNewItemForm((prev) => ({ ...prev, description: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="erp-form-field">
                      <label>Barcode</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Scan or enter barcode"
                        value={newItemForm.alias}
                        onChange={(e) => setNewItemForm((prev) => ({ ...prev, alias: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="erp-form-field">
                      <label>Category</label>
                      <ErpCustomSelect
                        value={newItemForm.categoryId}
                        options={itemCategoryOptions}
                        placeholder={
                          categoryOptionsLoading
                            ? "Loading categories..."
                            : itemCategoryOptions.length
                            ? "Choose category"
                            : "No categories available"
                        }
                        disabled={categoryOptionsLoading || !itemCategoryOptions.length}
                        onChange={(nextValue) => {
                          const matchedCategory =
                            categoryReferenceRecords.find(
                              (category) => String(category.id) === String(nextValue)
                            ) || null;

                          setNewItemForm((prev) => ({
                            ...prev,
                            categoryId: String(nextValue),
                            category: String(matchedCategory?.name || ""),
                          }));
                        }}
                      />
                    </div>
                    <label className="erp-switch-field">
                      <span>Taxable</span>
                      <span className="erp-switch">
                        <input
                          type="checkbox"
                          checked={newItemForm.taxable}
                          onChange={(e) => setNewItemForm((prev) => ({ ...prev, taxable: e.target.checked }))}
                        />
                        <span className="erp-switch-slider" />
                      </span>
                    </label>
                    <label className="erp-switch-field">
                      <span>Consignment</span>
                      <span className="erp-switch">
                        <input
                          type="checkbox"
                          checked={newItemForm.consignment}
                          onChange={(e) => setNewItemForm((prev) => ({ ...prev, consignment: e.target.checked }))}
                        />
                        <span className="erp-switch-slider" />
                      </span>
                    </label>
                    <div className="erp-form-field">
                      <label>Price (from DB)</label>
                      <div className="erp-money-input">
                        <input type="number" value={newItemForm.price} readOnly />
                        <span className="erp-money-suffix">£</span>
                      </div>
                    </div>
                    <div className="erp-form-field">
                      <label>Cost (from DB)</label>
                      <div className="erp-money-input">
                        <input type="number" value={newItemForm.cost} readOnly />
                        <span className="erp-money-suffix">£</span>
                      </div>
                    </div>
                    <div className="erp-form-field">
                      <label>Markup (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItemForm.markupPercent}
                        onChange={(e) => setNewItemForm((prev) => ({ ...prev, markupPercent: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                {addItemTab === "pricing" && (
                  <div className="erp-form-placeholder">
                    Pricing uses fetched Cost/Price and your Markup (%) from the Basic tab.
                  </div>
                )}
                {addItemTab === "inventory" && (
                  <>
                    <div className="erp-form-field">
                      <label>Bin Location</label>
                      <input
                        type="text"
                        placeholder="e.g. A12-34"
                        value={newItemForm.binLocation}
                        onChange={(e) => setNewItemForm((prev) => ({ ...prev, binLocation: e.target.value }))}
                      />
                    </div>
                    <div className="erp-form-field">
                      <label>Stock</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={newItemForm.stock}
                        onChange={(e) => setNewItemForm((prev) => ({ ...prev, stock: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="erp-form-field">
                      <label>Reorder Level</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={newItemForm.reorderLevel}
                        onChange={(e) => setNewItemForm((prev) => ({ ...prev, reorderLevel: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                {addItemTab === "more" && (
                  <div className="erp-form-placeholder">
                    More item actions and settings will be added here.
                  </div>
                )}
                <div className="erp-modal-actions">
                  <button type="button" className="erp-footer-btn erp-footer-btn-secondary" onClick={closeItemForm}>
                    Cancel
                  </button>
                  <button type="submit" className="erp-footer-btn erp-footer-btn-primary" disabled={savingItem}>
                    {itemModalSaveLabel}
                  </button>
                </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {isSuppliersView && showAddSupplierForm && (
          <div className="erp-modal-overlay erp-supplier-modal-overlay" onClick={closeSupplierForm}>
            <div
              className={`erp-modal-card erp-supplier-modal-card ${
                supplierFormWindowState === "full" ? "is-full" : ""
              } ${supplierFormWindowState === "minimized" ? "is-minimized" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="erp-modal-header">
                <h3>{supplierModalTitle}</h3>
                <div className="erp-window-controls">
                  <button
                    type="button"
                    className="erp-window-btn"
                    onClick={() =>
                      setSupplierFormWindowState((prev) => (prev === "minimized" ? "normal" : "minimized"))
                    }
                    aria-label="Minimize"
                  >
                    <Minimize2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="erp-window-btn"
                    onClick={() =>
                      setSupplierFormWindowState((prev) => (prev === "full" ? "normal" : "full"))
                    }
                    aria-label="Fullscreen"
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="erp-window-btn erp-window-btn-close"
                    onClick={closeSupplierForm}
                    aria-label="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              {supplierFormWindowState !== "minimized" && (
                <form className="erp-supplier-form-modal" onSubmit={handleAddSupplier} noValidate>
                  <div className="erp-supplier-form-scroll">
                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Identity</h4>
                    <div className="erp-supplier-section-grid">
                      <div className="erp-form-field">
                        <label>ID</label>
                        <input type="text" value="Auto-generated" readOnly />
                      </div>
                      <div className="erp-form-field">
                        <label>Code</label>
                        <input
                          type="text"
                          placeholder="Leave blank to auto-generate"
                          value={newSupplierForm.code}
                          onChange={(e) => updateSupplierForm("code", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field is-span-2">
                        <label>Supplier Name</label>
                        <input
                          type="text"
                          placeholder="ABC Suppliers Ltd"
                          value={newSupplierForm.supplierName}
                          onChange={(e) => updateSupplierForm("supplierName", e.target.value)}
                          required
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Type of Goods</label>
                        <input
                          type="text"
                          placeholder="e.g. Hardware"
                          value={newSupplierForm.typeOfGoods}
                          onChange={(e) => updateSupplierForm("typeOfGoods", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Supplying</label>
                        <input
                          type="number"
                          min="0"
                          value={newSupplierForm.supplying}
                          onChange={(e) => updateSupplierForm("supplying", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Contact</h4>
                    <div className="erp-supplier-section-grid">
                      <div className="erp-form-field">
                        <label>Contact Name</label>
                        <input
                          type="text"
                          placeholder="John Doe"
                          value={newSupplierForm.contactName}
                          onChange={(e) => updateSupplierForm("contactName", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Phone Number</label>
                        <input
                          type="text"
                          placeholder="0700000000"
                          value={newSupplierForm.phoneNumber}
                          onChange={(e) => updateSupplierForm("phoneNumber", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Fax Number</label>
                        <input
                          type="text"
                          value={newSupplierForm.faxNumber}
                          onChange={(e) => updateSupplierForm("faxNumber", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Email Address</label>
                        <input
                          type="email"
                          placeholder="supplier@example.com"
                          value={newSupplierForm.emailAddress}
                          onChange={(e) => updateSupplierForm("emailAddress", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field is-span-2">
                        <label>Web Page Address</label>
                        <input
                          type="text"
                          placeholder="https://example.com"
                          value={newSupplierForm.webPageAddress}
                          onChange={(e) => updateSupplierForm("webPageAddress", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Address</h4>
                    <div className="erp-supplier-section-grid">
                      <div className="erp-form-field is-span-2">
                        <label>Address 1</label>
                        <input
                          type="text"
                          placeholder="Industrial Area"
                          value={newSupplierForm.address1}
                          onChange={(e) => updateSupplierForm("address1", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field is-span-2">
                        <label>Address 2</label>
                        <input
                          type="text"
                          value={newSupplierForm.address2}
                          onChange={(e) => updateSupplierForm("address2", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>City</label>
                        <input
                          type="text"
                          value={newSupplierForm.city}
                          onChange={(e) => updateSupplierForm("city", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>State</label>
                        <input
                          type="text"
                          value={newSupplierForm.state}
                          onChange={(e) => updateSupplierForm("state", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Country</label>
                        <input
                          type="text"
                          value={newSupplierForm.country}
                          onChange={(e) => updateSupplierForm("country", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Zip</label>
                        <input
                          type="text"
                          value={newSupplierForm.zip}
                          onChange={(e) => updateSupplierForm("zip", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Account</h4>
                    <div className="erp-supplier-section-grid">
                      <div className="erp-form-field">
                        <label>Account Number</label>
                        <input
                          type="text"
                          value={newSupplierForm.accountNumber}
                          onChange={(e) => updateSupplierForm("accountNumber", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Tax Number</label>
                        <input
                          type="text"
                          value={newSupplierForm.taxNumber}
                          onChange={(e) => updateSupplierForm("taxNumber", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Currency ID</label>
                        <input
                          type="number"
                          min="0"
                          value={newSupplierForm.currencyId}
                          onChange={(e) => updateSupplierForm("currencyId", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Terms</label>
                        <input
                          type="text"
                          placeholder="e.g. 30 Days"
                          value={newSupplierForm.terms}
                          onChange={(e) => updateSupplierForm("terms", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Flags</h4>
                    <div className="erp-supplier-switch-grid">
                      {SUPPLIER_FLAG_FIELDS.map((flag) => (
                        <label key={flag.key} className="erp-switch-field">
                          <span>{flag.label}</span>
                          <span className="erp-switch">
                            <input
                              type="checkbox"
                              checked={Boolean(newSupplierForm[flag.key])}
                              onChange={(e) => updateSupplierForm(flag.key, e.target.checked)}
                            />
                            <span className="erp-switch-slider" />
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Approval</h4>
                    <div className="erp-supplier-section-grid">
                      <div className="erp-form-field">
                        <label>Approved By</label>
                        <input
                          type="text"
                          value={newSupplierForm.approvedBy}
                          onChange={(e) => updateSupplierForm("approvedBy", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Approved Time</label>
                        <input
                          type="datetime-local"
                          value={newSupplierForm.approvedTime}
                          onChange={(e) => updateSupplierForm("approvedTime", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Blocking</h4>
                    <div className="erp-supplier-section-grid">
                      <div className="erp-form-field">
                        <label>Blocked By</label>
                        <input
                          type="text"
                          value={newSupplierForm.blockedBy}
                          onChange={(e) => updateSupplierForm("blockedBy", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Blocked Time</label>
                        <input
                          type="datetime-local"
                          value={newSupplierForm.blockedTime}
                          onChange={(e) => updateSupplierForm("blockedTime", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field is-span-2">
                        <label>Blocked Notes</label>
                        <textarea
                          value={newSupplierForm.blockedNotes}
                          onChange={(e) => updateSupplierForm("blockedNotes", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Custom Text</h4>
                    <div className="erp-supplier-section-grid">
                      {SUPPLIER_CUSTOM_RANGE.map((index) => (
                        <div key={`custom-text-${index}`} className="erp-form-field">
                          <label>{`Custom Text ${index}`}</label>
                          <input
                            type="text"
                            value={newSupplierForm[`customText${index}`]}
                            onChange={(e) => updateSupplierForm(`customText${index}`, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Custom Numbers</h4>
                    <div className="erp-supplier-section-grid">
                      {SUPPLIER_CUSTOM_RANGE.map((index) => (
                        <div key={`custom-number-${index}`} className="erp-form-field">
                          <label>{`Custom Number ${index}`}</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newSupplierForm[`customNumber${index}`]}
                            onChange={(e) => updateSupplierForm(`customNumber${index}`, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">Custom Dates</h4>
                    <div className="erp-supplier-section-grid">
                      {SUPPLIER_CUSTOM_RANGE.map((index) => (
                        <div key={`custom-date-${index}`} className="erp-form-field">
                          <label>{`Custom Date ${index}`}</label>
                          <input
                            type="date"
                            value={newSupplierForm[`customDate${index}`]}
                            onChange={(e) => updateSupplierForm(`customDate${index}`, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="erp-supplier-section erp-supplier-section-span-2">
                    <h4 className="erp-supplier-section-title">Notes And Dates</h4>
                    <div className="erp-supplier-section-grid">
                      <div className="erp-form-field">
                        <label>Last Updated</label>
                        <input type="text" value="Automatic on save" readOnly />
                      </div>
                      <div className="erp-form-field" />
                      <div className="erp-form-field">
                        <label>Start Date</label>
                        <input
                          type="date"
                          value={newSupplierForm.startDate}
                          onChange={(e) => updateSupplierForm("startDate", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>End Date</label>
                        <input
                          type="date"
                          value={newSupplierForm.endDate}
                          onChange={(e) => updateSupplierForm("endDate", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field is-span-2">
                        <label>Notes</label>
                        <textarea
                          value={newSupplierForm.notes}
                          onChange={(e) => updateSupplierForm("notes", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>
                </div>
                <div className="erp-modal-actions">
                  <button
                    type="button"
                    className="erp-footer-btn erp-footer-btn-secondary"
                    onClick={closeSupplierForm}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="erp-footer-btn erp-footer-btn-primary" disabled={savingSupplier}>
                    {supplierModalSaveLabel}
                  </button>
                </div>
                </form>
              )}
            </div>
          </div>
        )}
        {isPurchaseOrdersView && showAddPurchaseOrderForm && (
          <div className="erp-modal-overlay erp-supplier-modal-overlay" onClick={closePurchaseOrderForm}>
            <div
              className="erp-modal-card erp-purchase-order-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="erp-modal-header">
                <h3>{purchaseOrderModalTitle}</h3>
                <div className="erp-window-controls">
                  <button
                    type="button"
                    className="erp-window-btn erp-window-btn-close"
                    onClick={closePurchaseOrderForm}
                    aria-label="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <form className="erp-supplier-form-modal erp-purchase-order-form" onSubmit={handleSavePurchaseOrder} noValidate>
                <fieldset className="erp-po-fieldset" disabled={isViewingPurchaseOrder}>
                <div className="erp-purchase-order-scroll">
                  <section className="erp-supplier-section">
                    <h4 className="erp-supplier-section-title">PO Header</h4>
                    <div className="erp-supplier-section-grid">
                      <div className="erp-form-field is-span-2">
                        <label>PO Title</label>
                        <input
                          type="text"
                          placeholder="Main Branch Stock Refill"
                          value={newPurchaseOrderForm.poTitle}
                          onChange={(e) => updatePurchaseOrderForm("poTitle", e.target.value)}
                          required
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Supplier</label>
                        <select
                          value={newPurchaseOrderForm.supplierId}
                          onChange={(e) => updatePurchaseOrderForm("supplierId", e.target.value)}
                          required
                        >
                          <option value="">
                            {suppliersLoading ? "Loading suppliers..." : "Select supplier"}
                          </option>
                          {suppliersRecords.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {(supplier.supplier_name || "Supplier").trim()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="erp-form-field">
                        <label>Required Date</label>
                        <input
                          type="date"
                          value={newPurchaseOrderForm.requiredDate}
                          onChange={(e) => updatePurchaseOrderForm("requiredDate", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>P To</label>
                        <input
                          type="text"
                          value={newPurchaseOrderForm.pTo}
                          onChange={(e) => updatePurchaseOrderForm("pTo", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Ship To</label>
                        <input
                          type="text"
                          value={newPurchaseOrderForm.shipTo}
                          onChange={(e) => updatePurchaseOrderForm("shipTo", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Requisioner</label>
                        <input
                          type="text"
                          value={newPurchaseOrderForm.requisioner}
                          onChange={(e) => updatePurchaseOrderForm("requisioner", e.target.value)}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Ship Via</label>
                        <input
                          type="text"
                          value={newPurchaseOrderForm.shipVia}
                          onChange={(e) => updatePurchaseOrderForm("shipVia", e.target.value)}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="erp-supplier-section">
                    <div className="erp-po-quick-add-grid">
                      <div className="erp-form-field erp-po-quick-add-field">
                        <label>Item Lookup / Barcode</label>
                        <input
                          ref={purchaseOrderLookupInputRef}
                          type="text"
                          autoComplete="off"
                          placeholder="Scan barcode or enter item lookup code"
                          value={purchaseOrderLookupValue}
                          onChange={(e) => setPurchaseOrderLookupValue(e.target.value)}
                          onKeyDown={(e) => handlePurchaseOrderLookupKeyDown(e, "lookup")}
                        />
                      </div>
                      <div className="erp-form-field">
                        <label>Quantity</label>
                        <input
                          ref={purchaseOrderLookupQuantityRef}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={purchaseOrderLookupQuantity}
                          onChange={(e) => setPurchaseOrderLookupQuantity(e.target.value)}
                          onKeyDown={(e) => handlePurchaseOrderLookupKeyDown(e, "quantity")}
                        />
                      </div>
                      <div className="erp-po-quick-add-action">
                        <button
                          type="button"
                          className="erp-mini-btn erp-po-add-btn"
                          onClick={() => {
                            void handleAddPurchaseOrderLookupItem();
                          }}
                          disabled={purchaseOrderLookupPending}
                        >
                          {purchaseOrderLookupPending ? "Adding..." : "Add Item"}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="erp-supplier-section erp-supplier-section-span-2">
                    <div className="erp-po-entries-toolbar">
                      <div>
                        <h4 className="erp-supplier-section-title">Purchase Order Entries</h4>
                      </div>
                      <div className="erp-po-toolbar-actions">
                        <span className="erp-po-summary-chip">
                          Lines: {newPurchaseOrderForm.entries.length}
                        </span>
                        <span className="erp-po-summary-chip">
                          LPO Total: {purchaseOrderDraftTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="erp-po-table-wrap">
                      <table className="erp-po-table">
                        <thead>
                          <tr>
                            <th>Item Code</th>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Price</th>
                            <th>Cost</th>
                            <th>Tax %</th>
                            <th>Cost Total</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {newPurchaseOrderForm.entries.length ? (
                            newPurchaseOrderForm.entries.map((entry) => {
                              const lineTotal =
                                Number(entry.quantityOrdered || 0) * Number(entry.costedPrice || 0);

                              return (
                                <tr key={entry.rowId}>
                                  <td className="erp-po-code-cell">
                                    {entry.itemLookupCode || entry.itemId || "-"}
                                  </td>
                                  <td className="erp-po-description-cell">
                                    {entry.itemDescription || "Item description unavailable"}
                                  </td>
                                  <td>
                                    <input
                                      className="erp-po-qty-input"
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={entry.quantityOrdered}
                                      onChange={(e) =>
                                        updatePurchaseOrderEntry(
                                          entry.rowId,
                                          "quantityOrdered",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </td>
                                  <td className="erp-po-money-cell">
                                    {Number(entry.price || 0).toLocaleString()}
                                  </td>
                                  <td className="erp-po-money-cell">
                                    {Number(entry.costedPrice || 0).toLocaleString()}
                                  </td>
                                  <td className="erp-po-tax-cell">
                                    {Number(entry.taxRate || 0).toLocaleString()}%
                                  </td>
                                  <td className="erp-po-line-total-cell">
                                    {lineTotal.toLocaleString()}
                                  </td>
                                  <td className="erp-po-action-cell">
                                    <button
                                      type="button"
                                      className="erp-po-row-remove"
                                      onClick={() => removePurchaseOrderEntryRow(entry.rowId)}
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td className="erp-po-table-empty" colSpan="8">
                                Scan an item lookup code or barcode above to add the first purchase
                                order line.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {purchaseOrdersError && <div className="erp-po-inline-error">{purchaseOrdersError}</div>}
                  </section>
                </div>
                </fieldset>
                <div className="erp-modal-actions">
                  <button
                    type="button"
                    className="erp-footer-btn erp-footer-btn-secondary"
                    onClick={closePurchaseOrderForm}
                  >
                    {isViewingPurchaseOrder ? "Close" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    className="erp-footer-btn erp-footer-btn-secondary"
                    onClick={handleViewPurchaseOrderPreview}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="erp-footer-btn erp-footer-btn-secondary"
                    onClick={handlePrintPurchaseOrder}
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    className="erp-footer-btn erp-footer-btn-secondary"
                    onClick={() => {
                      void handleSharePurchaseOrder();
                    }}
                  >
                    Share
                  </button>
                  {!isViewingPurchaseOrder && (
                    <button
                      type="submit"
                      className="erp-footer-btn erp-footer-btn-primary"
                      disabled={savingPurchaseOrder}
                    >
                      {savingPurchaseOrder ? "Saving..." : "Proceed"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
        {showInventoryItemPropertiesModal && (
          <div className="erp-modal-overlay" onClick={closeInventoryItemPropertiesModal}>
            <div className="erp-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="erp-modal-header">
                <h3>Stock Properties</h3>
                <div className="erp-window-controls">
                  <button
                    type="button"
                    className="erp-window-btn erp-window-btn-close"
                    onClick={closeInventoryItemPropertiesModal}
                    aria-label="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <form className="erp-add-form-modal" onSubmit={handleSaveInventoryItemProperties} noValidate>
                <div className="erp-form-field">
                  <label>Lookup Code</label>
                  <input type="text" value={inventoryItemPropertiesForm.lookupCode} readOnly />
                </div>
                <div className="erp-form-field">
                  <label>Quantity On Hand</label>
                  <input type="number" value={inventoryItemPropertiesForm.onHand} readOnly />
                </div>
                <div className="erp-form-field is-span-2">
                  <label>Item Description</label>
                  <input type="text" value={inventoryItemPropertiesForm.description} readOnly />
                </div>
                <div className="erp-form-field">
                  <label>Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inventoryItemPropertiesForm.reorderLevel}
                    onChange={(e) =>
                      setInventoryItemPropertiesForm((prev) => ({
                        ...prev,
                        reorderLevel: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="erp-modal-actions">
                  <button
                    type="button"
                    className="erp-footer-btn erp-footer-btn-secondary"
                    onClick={closeInventoryItemPropertiesModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="erp-footer-btn erp-footer-btn-primary"
                    disabled={savingInventoryItemProperties}
                  >
                    {savingInventoryItemProperties ? "Saving..." : "Save Level"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {isCategoriesView && showAddCategoryForm && (
          <div className="erp-modal-overlay" onClick={closeCategoryForm}>
            <div className="erp-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="erp-modal-header">
                <h3>{categoryModalTitle}</h3>
                <div className="erp-window-controls">
                  <button
                    type="button"
                    className="erp-window-btn erp-window-btn-close"
                    onClick={closeCategoryForm}
                    aria-label="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <form className="erp-add-form-modal" onSubmit={handleAddCategory} noValidate>
                <div className="erp-form-field is-span-2">
                  <label>Category Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Mattresses"
                    value={newCategoryForm.name}
                    onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Parent</label>
                  <ErpCustomSelect
                    value={newCategoryForm.parentId}
                    options={categoryParentOptions}
                    placeholder="Choose parent"
                    onChange={(nextValue) =>
                      setNewCategoryForm((prev) => ({ ...prev, parentId: String(nextValue) }))
                    }
                  />
                </div>
                <div className="erp-form-field">
                  <label>Status</label>
                  <ErpCustomSelect
                    value={newCategoryForm.status}
                    options={categoryStatusOptions}
                    onChange={(nextValue) =>
                      setNewCategoryForm((prev) => ({ ...prev, status: String(nextValue) }))
                    }
                  />
                </div>
                <div className="erp-modal-actions">
                  <button
                    type="button"
                    className="erp-footer-btn erp-footer-btn-secondary"
                    onClick={closeCategoryForm}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="erp-footer-btn erp-footer-btn-primary"
                    disabled={savingCategory}
                  >
                    {categoryModalSaveLabel}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {isUsersView && showAddUserForm && (
          <div className="erp-modal-overlay" onClick={closeUserForm}>
            <div className="erp-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="erp-modal-header">
                <h3>{editingUserId ? "User Properties" : "Create Cashier User"}</h3>
                <div className="erp-window-controls">
                  <button
                    type="button"
                    className="erp-window-btn erp-window-btn-close"
                    onClick={closeUserForm}
                    aria-label="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
              <form className="erp-add-form-modal" onSubmit={handleAddUser} noValidate>
                <div className="erp-form-field">
                  <label>User Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 100"
                    value={newUserForm.number}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, number: e.target.value }))}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Name</label>
                  <input
                    type="text"
                    placeholder="Cashier name"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="erp-form-field">
                  <label>User Role</label>
                  <select
                    value={newUserForm.userRole}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, userRole: e.target.value }))}
                  >
                    {userRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="erp-form-field">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder={editingUserId ? "Leave blank to keep current password" : "Enter password"}
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Email</label>
                  <input
                    type="email"
                    placeholder="email@domain.com"
                    value={newUserForm.emailAddress}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, emailAddress: e.target.value }))}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Telephone</label>
                  <input
                    type="text"
                    placeholder="Phone number"
                    value={newUserForm.telephone}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, telephone: e.target.value }))}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Floor Limit</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newUserForm.floorLimit}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, floorLimit: e.target.value }))}
                  />
                </div>
                <div className="erp-form-field">
                  <label>Drop Limit</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newUserForm.dropLimit}
                    onChange={(e) => setNewUserForm((prev) => ({ ...prev, dropLimit: e.target.value }))}
                  />
                </div>
                <label className="erp-switch-field">
                  <span>Enabled</span>
                  <span className="erp-switch">
                    <input
                      type="checkbox"
                      checked={newUserForm.enabled}
                      onChange={(e) => setNewUserForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <span className="erp-switch-slider" />
                  </span>
                </label>
                <div className="erp-modal-actions">
                  <button
                    type="button"
                    className="erp-footer-btn erp-footer-btn-secondary"
                    onClick={closeUserForm}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="erp-footer-btn erp-footer-btn-primary" disabled={savingUser}>
                    {savingUser ? "Saving..." : editingUserId ? "Update User" : "Save User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showFingerprintModal && fingerprintTargetUser && (
          <div className="erp-modal-overlay" onClick={closeFingerprintModal}>
            <div className="erp-modal-card erp-fingerprint-modal" onClick={(e) => e.stopPropagation()}>
              <div className="erp-modal-header">
                <h3>Fingerprint Setup</h3>
                <div className="erp-window-controls">
                  <button
                    type="button"
                    className="erp-window-btn erp-window-btn-close"
                    onClick={closeFingerprintModal}
                    aria-label="Close fingerprint setup"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              <div className="erp-fingerprint-layout">
                <div className="erp-fingerprint-copy">
                  <p className="erp-fingerprint-user">
                    {fingerprintTargetUser.name || fingerprintTargetUser.number || `User ${fingerprintTargetUser.id}`}
                  </p>
                  <p className="erp-fingerprint-status">
                    {fingerprintTargetUser.has_fingerprint
                      ? "Fingerprint already enrolled. Capture again to replace it."
                      : "No fingerprint enrolled yet for this cashier."}
                  </p>
                  {fingerprintCaptureMeta?.updatedAt && (
                    <p className="erp-fingerprint-meta">
                      Saved at {new Date(fingerprintCaptureMeta.updatedAt).toLocaleString()}
                    </p>
                  )}
                  {fingerprintCaptureMeta?.imageQuality !== undefined &&
                    fingerprintCaptureMeta?.imageQuality !== null && (
                      <p className="erp-fingerprint-meta">
                        Quality: {fingerprintCaptureMeta.imageQuality}
                        {fingerprintCaptureMeta?.nfiq !== null &&
                        fingerprintCaptureMeta?.nfiq !== undefined
                          ? ` | NFIQ: ${fingerprintCaptureMeta.nfiq}`
                          : ""}
                      </p>
                    )}
                  {fingerprintError && (
                    <div className="erp-fingerprint-error">{fingerprintError}</div>
                  )}
                </div>

                <div className="erp-fingerprint-preview">
                  {fingerprintPreview ? (
                    <img src={fingerprintPreview} alt="Fingerprint preview" />
                  ) : (
                    <div className="erp-fingerprint-placeholder">
                      <Fingerprint size={36} />
                      <span>Capture preview appears here</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="erp-modal-actions">
                <button
                  type="button"
                  className="erp-footer-btn erp-footer-btn-secondary"
                  onClick={closeFingerprintModal}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="erp-footer-btn erp-footer-btn-primary"
                  onClick={handleCaptureFingerprint}
                  disabled={fingerprintSaving}
                >
                  {fingerprintSaving ? "Capturing..." : "Capture And Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ErpApp;

