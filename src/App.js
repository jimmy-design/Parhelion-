import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import './App.css';
import { API_BASE_URL, apiFetch } from './appConfig';

const formatCurrencyValue = (value) =>
  Number(value || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const PosWorkspace = memo(function PosWorkspace({
  items,
  inputValue,
  onInputValueChange,
  scanFlashText,
  scanFlashVariant,
  lineItemsCount,
  totalQuantity,
  cashierRole,
  cashierName,
  registerLabel,
  onLogout,
  subtotal,
  tax,
  total,
  amountDue,
  totalTendered,
  changeDue,
  onOpenTender,
  onPrefetchTenders,
}) {
  return (
    <div className="main-content">
      <div className="items-section">
        <div className="items-card">
          <div className="items-card-header">
            <div>
              <h3>Current basket</h3>
              <p>
                {lineItemsCount > 0
                  ? `${lineItemsCount} line items | ${totalQuantity} total units`
                  : 'No items scanned yet. Start with a barcode or lookup code.'}
              </p>
            </div>

            <div
              className={`scan-flash ${scanFlashText ? 'is-visible' : ''} ${scanFlashVariant === 'error' ? 'is-error' : ''}`}
              aria-live="polite"
            >
              {scanFlashText}
            </div>

            <div className="items-card-metrics">
              <div className="metric-pill">
                <span>Items</span>
                <strong>{lineItemsCount}</strong>
              </div>
              <div className="metric-pill">
                <span>Units</span>
                <strong>{totalQuantity}</strong>
              </div>
            </div>
          </div>

          <div className="items-scroll">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>STOCK DESCRIPTION</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th>Sales Tax</th>
                  <th>Rep</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="items-empty-cell">
                      <div className="items-empty-state">
                        <h4>Basket is empty</h4>
                        <p>The most recent scan will appear first.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index} className={index === 0 ? 'is-latest-row' : ''}>
                      <td>{item.code}</td>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td>{item.price.toFixed(2)}</td>
                      <td>{(item.price * item.quantity).toFixed(2)}</td>
                      <td>{item.taxable ? 'Yes' : 'No'}</td>
                      <td>{item.rep}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="input-bar">
          <div className="scan-input-group">
            <label htmlFor="barcode-input">Barcode / lookup code</label>
            <input
              id="barcode-input"
              type="text"
              value={inputValue}
              onChange={(e) => onInputValueChange(e.target.value)}
              placeholder="Scan or enter item code..."
              autoFocus
            />
          </div>

          <div className="user-info">
            <span><strong>Role</strong> {cashierRole}</span>
            <span><strong>Teller</strong> {cashierName}</span>
            <span><strong>Register</strong> {registerLabel}</span>
            {onLogout && (
              <button type="button" className="user-info-logout" onClick={onLogout}>
                <LogOut size={14} />
                <span>Log out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="totals-sidebar">
        <div className="totals-sidebar-card">
          <p className="section-kicker">Sale Summary</p>
          <h3>Totals</h3>

          <div className="total-row">
            <span>Sub Total</span>
            <span>KES {formatCurrencyValue(subtotal)}</span>
          </div>
          <div className="total-row">
            <span>Sales Tax</span>
            <span>KES {formatCurrencyValue(tax)}</span>
          </div>
          <div className="total-row grand-total">
            <span>Total</span>
            <span>KES {formatCurrencyValue(total)}</span>
          </div>
          <div className="total-row">
            <span>Loyalty Points</span>
            <span>{Math.floor(total / 100)}</span>
          </div>

          <div className="summary-banner">
            <span>Amount Due</span>
            <strong>KES {formatCurrencyValue(amountDue)}</strong>
          </div>

          <div className="totals-grid">
            <div className="mini-summary-card">
              <span>Tendered</span>
              <strong>KES {formatCurrencyValue(totalTendered)}</strong>
            </div>
            <div className="mini-summary-card">
              <span>Change</span>
              <strong>KES {formatCurrencyValue(changeDue)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="checkout-btn"
            onClick={onOpenTender}
            onMouseEnter={onPrefetchTenders}
            onFocus={onPrefetchTenders}
            disabled={lineItemsCount === 0}
          >
            Open Tender
          </button>
        </div>
      </div>
    </div>
  );
});

function App({ currentUser, onLogout }) {
  const [items, setItems] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [tenders, setTenders] = useState([]);
  const [tendersLoading, setTendersLoading] = useState(false);
  const [tendersError, setTendersError] = useState('');
  const [tenderAmounts, setTenderAmounts] = useState({});
  const [showMpesaModal, setShowMpesaModal] = useState(false);
  const [mpesaData, setMpesaData] = useState({
    phone: "",
    name: "",
    code: "",
    amount: 0,
    time: new Date().toLocaleString(),
  });
  const [loadingMpesa, setLoadingMpesa] = useState(false);
  const [checkingMpesaTransactions, setCheckingMpesaTransactions] = useState(false);
  const [availableMpesaTransactions, setAvailableMpesaTransactions] = useState([]);
  const [showTransactionList, setShowTransactionList] = useState(false);
  
  // Loyalty system states
  const [showLoyaltyInputModal, setShowLoyaltyInputModal] = useState(false);
  const [loyaltyIdentifier, setLoyaltyIdentifier] = useState(""); // ID number, card number, or mobile
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [transactionId, setTransactionId] = useState(null);
  const [customerName, setCustomerName] = useState(""); // To display customer name
  const [customerData, setCustomerData] = useState(null); // To store full customer data
  const [scanFlashText, setScanFlashText] = useState('');
  const [scanFlashVariant, setScanFlashVariant] = useState('success');
  const itemsRef = useRef(items);
  const inputValueRef = useRef(inputValue);
  const tendersRef = useRef(tenders);
  const tenderRequestRef = useRef(null);
  const mpesaAvailabilityRequestRef = useRef(0);
  const scanFlashTimeoutRef = useRef(null);

  itemsRef.current = items;
  inputValueRef.current = inputValue;
  tendersRef.current = tenders;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = items.filter(item => item.taxable).reduce((sum, item) => sum + item.price * item.quantity * 0.08, 0);
  const total = subtotal + tax;

  const totalTendered = Object.values(tenderAmounts).reduce((sum, val) => sum + parseFloat(val || 0), 0);
  const balance = (totalTendered - total).toFixed(2);
  const lineItemsCount = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const amountDue = Math.max(total - totalTendered, 0);
  const changeDue = Math.max(totalTendered - total, 0);
  const tenderColumnSize = Math.ceil(tenders.length / 2);
  const tenderColumns = [
    tenders.slice(0, tenderColumnSize),
    tenders.slice(tenderColumnSize),
  ];
  const cashierName = currentUser?.name || currentUser?.number || 'Unknown cashier';
  const cashierRole = currentUser?.user_role || 'Cashier';
  const registerLabel = String(Number(currentUser?.store_id || 1)).padStart(2, '0');
  const isOverlayActive =
    showTenderModal || showMpesaModal || showTransactionList || showLoyaltyInputModal;

  const showScanFlash = useCallback((description, variant = 'success') => {
    if (scanFlashTimeoutRef.current) {
      clearTimeout(scanFlashTimeoutRef.current);
    }

    setScanFlashText(description);
    setScanFlashVariant(variant);
    scanFlashTimeoutRef.current = setTimeout(() => {
      setScanFlashText('');
      scanFlashTimeoutRef.current = null;
    }, 900);
  }, []);

  const loadTenders = useCallback(async () => {
    if (tendersRef.current.length) {
      return tendersRef.current;
    }

    if (tenderRequestRef.current) {
      return tenderRequestRef.current;
    }

    setTendersLoading(true);
    setTendersError('');

    const request = (async () => {
      try {
        const res = await apiFetch(`${API_BASE_URL}/tender`);
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.detail || data?.message || 'Failed to load tenders');
        }

        const nextTenders = Array.isArray(data) ? data : [];
        tendersRef.current = nextTenders;
        setTenders(nextTenders);
        return nextTenders;
      } catch (error) {
        const message = error.message || 'Failed to load tenders';
        setTendersError(message);
        throw error;
      } finally {
        tenderRequestRef.current = null;
        setTendersLoading(false);
      }
    })();

    tenderRequestRef.current = request;
    return request;
  }, []);

  const openTenderModal = useCallback(() => {
    setTenderAmounts({});
    setTendersError('');
    setShowTenderModal(true);
    loadTenders().catch(() => null);
  }, [loadTenders]);

  const prefetchTenders = useCallback(() => {
    loadTenders().catch(() => null);
  }, [loadTenders]);

  const handleKeyDown = useCallback(async (e) => {
    const currentInputValue = inputValueRef.current.trim();

    if (e.key === 'Enter' && currentInputValue) {
      const code = currentInputValue;
      setInputValue('');

      try {
        const res = await apiFetch(`${API_BASE_URL}/item/${code}`);
        const errorData = !res.ok ? await res.json().catch(() => null) : null;
        if (!res.ok) throw new Error(errorData?.detail || 'Item not found');
        const data = await res.json();
        const itemCode = data.code || code;
        const description = data.description || `Product ${itemCode}`;
        let stockAvailable = Math.max(
          Number(data.quantity ?? data.stock_available ?? data.stock ?? 0) || 0,
          0
        );

        try {
          const stockRes = await apiFetch(`${API_BASE_URL}/erp/items/by-lookup/${encodeURIComponent(itemCode)}`);
          if (stockRes.ok) {
            const stockData = await stockRes.json();
            stockAvailable = Math.max(
              Number(stockData.stock_available ?? stockData.stock ?? stockData.quantity ?? stockAvailable) || 0,
              0
            );
          }
        } catch (stockError) {
          console.warn('Stock lookup fallback failed:', stockError);
        }

        const latestItems = itemsRef.current;
        const existingIndex = latestItems.findIndex(item => item.code === itemCode);
        const quantityInBasket = existingIndex !== -1 ? latestItems[existingIndex].quantity : 0;

        if (stockAvailable <= 0) {
          showScanFlash(`${description} is out of stock`, 'error');
          return;
        }

        if (quantityInBasket >= stockAvailable) {
          showScanFlash(`Only ${stockAvailable} in stock for ${description}`, 'error');
          return;
        }

        if (existingIndex !== -1) {
          setItems(prev =>
            prev.map(item =>
              item.code === itemCode
                ? { ...item, quantity: item.quantity + 1 }
                : item
            )
          );
        } else {
          const newItem = {
            code: itemCode,
            description,
            quantity: 1,
            price: parseFloat(data.price),
            taxable: !!data.taxable,
            rep: 'T001',
          };
          setItems(prev => [newItem, ...prev]);
        }
        showScanFlash(description);
      } catch (error) {
        alert(error.message || 'Error fetching item');
      }
    }

    if (e.key === 'F1') {
      e.preventDefault();
      openTenderModal();
    }
  }, [openTenderModal, showScanFlash]);

  const handleTenderChange = (code, value) => {
    setTenderAmounts(prev => ({
      ...prev,
      [code]: value,
    }));
  };

  const handleModalClose = () => {
    setShowTenderModal(false);
    setTendersError('');
  };

  const handleTenderFocus = async (tender) => {
    if (String(tender.Description || '').toLowerCase() === "mpesa") {
      const requestId = mpesaAvailabilityRequestRef.current + 1;
      mpesaAvailabilityRequestRef.current = requestId;
      setCheckingMpesaTransactions(true);
      setAvailableMpesaTransactions([]);
      setShowTransactionList(false);
      setMpesaData((prev) => ({
        ...prev,
        amount: total,
        time: new Date().toLocaleString(),
      }));
      setShowMpesaModal(true);

      try {
        const res = await apiFetch(`${API_BASE_URL}/api/mpesa/transactions/available?amount=${total}`);
        const data = await res.json().catch(() => null);

        if (requestId !== mpesaAvailabilityRequestRef.current) {
          return;
        }

        if (res.ok && data?.success && data.transactions && data.transactions.length > 0) {
          setAvailableMpesaTransactions(data.transactions);
          setCheckingMpesaTransactions(false);
          setShowMpesaModal(false);
          setShowTransactionList(true);
        }
      } catch (err) {
        console.error("Error checking M-Pesa transactions:", err);
      } finally {
        if (requestId === mpesaAvailabilityRequestRef.current) {
          setCheckingMpesaTransactions(false);
        }
      }
      return;
    }

    if (!tenderAmounts[tender.Code]) {
      const filledSoFar = Object.entries(tenderAmounts).reduce((sum, [code, val]) => {
        return code !== tender.Code ? sum + parseFloat(val || 0) : sum;
      }, 0);
      const remaining = total - filledSoFar;
      if (remaining > 0) {
        handleTenderChange(tender.Code, remaining.toFixed(2));
      }
    }
  };

  const handleTransactionSubmit = async () => {
    // Show loyalty input modal on top of tender modal
    const pointsEarned = Math.floor(total / 100);
    setLoyaltyPoints(pointsEarned);
    setShowLoyaltyInputModal(true);
  };

  // Validate identifier (ID number, card number, or mobile)
  const validateIdentifier = (identifier) => {
    // Remove all non-alphanumeric characters
    const cleanIdentifier = identifier.replace(/[^a-zA-Z0-9]/g, '');
    
    // Check if it's a valid ID number (8 digits)
    const idRegex = /^\d{8}$/;
    if (idRegex.test(cleanIdentifier)) {
      return { type: "Idnumber", value: cleanIdentifier };
    }
    
    // Check if it's a valid mobile number (Kenyan format)
    const cleanMobile = identifier.replace(/\D/g, '');
    let formattedMobile = cleanMobile;
    if (formattedMobile.startsWith("0")) {
      formattedMobile = "254" + formattedMobile.substring(1);
    } else if (!formattedMobile.startsWith("254")) {
      formattedMobile = "254" + formattedMobile;
    }
    const mobileRegex = /^2547\d{8}$/;
    if (mobileRegex.test(formattedMobile)) {
      return { type: "Mobile", value: formattedMobile };
    }
    
    // Check if it's a valid card number (starts with LOY and has numbers)
    const cardRegex = /^LOY\d{10}$/;
    if (cardRegex.test(cleanIdentifier)) {
      return { type: "Loyaltyno", value: cleanIdentifier };
    }
    
    return null;
  };

  // Fetch customer data when loyalty identifier changes
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!loyaltyIdentifier) {
        setCustomerName("");
        setCustomerData(null);
        return;
      }

      const validation = validateIdentifier(loyaltyIdentifier);
      if (validation) {
        try {
          let customerResult = null;
          
          // For mobile numbers, use the specific mobile endpoint
          if (validation.type === "Mobile") {
            const mobileRes = await apiFetch(`${API_BASE_URL}/loyalty/customer/mobile/${validation.value}`);
            customerResult = await mobileRes.json();
          } else {
            // For ID numbers and card numbers, use the general endpoint
            const res = await apiFetch(`${API_BASE_URL}/loyalty/customer/${validation.value}`);
            customerResult = await res.json();
          }
          
          if (customerResult.success) {
            setCustomerName(customerResult.customer.Fullname || "Customer");
            setCustomerData(customerResult.customer);
          } else {
            setCustomerName("");
            setCustomerData(null);
          }
        } catch (err) {
          console.error("Error fetching customer data:", err);
          setCustomerName("");
          setCustomerData(null);
        }
      }
    };

    // Add a small delay to avoid too many API calls while typing
    const timer = setTimeout(() => {
      fetchCustomerData();
    }, 500);

    return () => clearTimeout(timer);
  }, [loyaltyIdentifier]);

  const handleLoyaltySubmit = async () => {
    // Validate identifier
    const validation = validateIdentifier(loyaltyIdentifier);
    if (!validation) {
      alert('Please enter a valid ID number, card number, or mobile number');
      return;
    }

    // Close the loyalty input modal
    setShowLoyaltyInputModal(false);

    // Process the transaction
    const tenderData = Object.entries(tenderAmounts)
      .filter(([_, val]) => parseFloat(val) > 0)
      .map(([code, amount]) => ({
        code,
        amount: parseFloat(amount),
      }));

    const payload = {
      items,
      tenders: tenderData,
      total,
      tax,
      cashier_id: Number(currentUser?.id || 1002),
      store_id: Number(currentUser?.store_id || 1),
    };

    try {
      const res = await apiFetch(`${API_BASE_URL}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        // After successful transaction, show success message
        alert("Transaction completed successfully!");
        setTransactionId(result.transaction_id);
        setItems([]);
        setTenderAmounts({});
        setShowTenderModal(false);
        
        // Process loyalty points
        try {
          let customerInfo = customerData;
          
          // If we don't have customer data, fetch it now
          if (!customerInfo) {
            const res = await apiFetch(`${API_BASE_URL}/loyalty/customer/${validation.value}`);
            const result = await res.json();
            
            if (result.success) {
              customerInfo = result.customer;
            }
          }
          
          // If customer doesn't exist, create new customer
          if (!customerInfo) {
            customerInfo = {
              Idnumber: validation.type === "Idnumber" ? validation.value : "",
              Mobile: validation.type === "Mobile" ? validation.value : "",
              Loyaltyno: validation.type === "Loyaltyno" ? validation.value : "",
              Fullname: customerName || "Customer",
              TotalCredit: 0,
              TotalDebit: 0,
              Balance: 0,
              Points: 0,
              Bal2: 0
            };
          }
          
          // Create or update customer
          const customerRes = await apiFetch(`${API_BASE_URL}/loyalty/customer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customerInfo),
          });

          const customerResult = await customerRes.json();
          
          if (customerRes.ok) {
            // Award loyalty points
            const pointsToAward = Math.floor(total / 100);
            
            // Generate a unique card number if customer doesn't have one
            let cardNumber = customerInfo.Loyaltyno;
            if (!cardNumber) {
              cardNumber = `LOY${Date.now()}`;
            }
            
            const loyaltyTransaction = {
              Cardno: cardNumber,
              Register: "chege",
              TransactionNo: `TXN${transactionId || result.transaction_id}`,
              Description: "Purchase",
              TransactionAmt: total,
              Pointsb4trn: customerInfo.Points || 0,
              Points: pointsToAward,
              sdatetime: new Date().toISOString(),
              STID: "ST123",
              tkind: 1,
              uuser: "admin",
              RedeemID: 0,
              Lastupdated: new Date().toISOString(),
              identityid: validation.value,
              Uploaded: 0,
              web: 0
            };

            const awardRes = await apiFetch(`${API_BASE_URL}/loyalty/award-points`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(loyaltyTransaction),
            });

            const awardResult = await awardRes.json();

            if (awardRes.ok) {
              alert(`Successfully awarded ${awardResult.points_earned} loyalty points!`);
              setLoyaltyIdentifier("");
              setCustomerName("");
              setCustomerData(null);
            } else {
              alert(awardResult?.detail || 'Failed to award loyalty points');
            }
          } else {
            // If customer creation fails, still award points with existing data
            alert('Customer information saved, proceeding with loyalty points');
            setLoyaltyIdentifier("");
            setCustomerName("");
            setCustomerData(null);
          }
        } catch (err) {
          console.error(err);
          alert('Error processing loyalty information, but transaction completed successfully');
          setLoyaltyIdentifier("");
          setCustomerName("");
          setCustomerData(null);
        }
      } else {
        alert(result?.detail || 'Failed to save transaction');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving transaction');
    }
  };

  const handleLoyaltySkip = async () => {
    setShowLoyaltyInputModal(false);

    const tenderData = Object.entries(tenderAmounts)
      .filter(([_, val]) => parseFloat(val) > 0)
      .map(([code, amount]) => ({
        code,
        amount: parseFloat(amount),
      }));

    try {
      const res = await apiFetch(`${API_BASE_URL}/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          tenders: tenderData,
          total,
          tax,
          cashier_id: Number(currentUser?.id || 1002),
          store_id: Number(currentUser?.store_id || 1),
        }),
      });

      const result = await res.json();

      if (res.ok) {
        alert("Transaction completed successfully!");
        setTransactionId(result.transaction_id);
        setItems([]);
        setTenderAmounts({});
        setShowTenderModal(false);
        setLoyaltyIdentifier("");
        setCustomerName("");
        setCustomerData(null);
      } else {
        alert(result?.detail || 'Failed to save transaction');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving transaction');
    }
  };

  const handleLoyaltyInputKeyDown = async (e) => {
    if (e.key !== 'Enter') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (loyaltyIdentifier.trim()) {
      await handleLoyaltySubmit();
      return;
    }

    await handleLoyaltySkip();
  };

  useEffect(() => {
    let idleHandle = null;
    let timeoutHandle = null;

    const schedulePrefetch = () => {
      prefetchTenders();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(schedulePrefetch, { timeout: 1200 });
    } else {
      timeoutHandle = window.setTimeout(schedulePrefetch, 300);
    }

    return () => {
      if (idleHandle !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      }

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    return () => {
      if (scanFlashTimeoutRef.current) {
        clearTimeout(scanFlashTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`app ${isOverlayActive ? 'is-modal-open' : ''}`.trim()}>
      <div className="pos-bg-gradient" />
      <div className="pos-bg-orb pos-bg-orb-left" />
      <div className="pos-bg-orb pos-bg-orb-right" />

      <div className="pos-shell">
        <PosWorkspace
          items={items}
          inputValue={inputValue}
          onInputValueChange={setInputValue}
          scanFlashText={scanFlashText}
          scanFlashVariant={scanFlashVariant}
          lineItemsCount={lineItemsCount}
          totalQuantity={totalQuantity}
          cashierRole={cashierRole}
          cashierName={cashierName}
          registerLabel={registerLabel}
          onLogout={onLogout}
          subtotal={subtotal}
          tax={tax}
          total={total}
          amountDue={amountDue}
          totalTendered={totalTendered}
          changeDue={changeDue}
          onOpenTender={openTenderModal}
          onPrefetchTenders={prefetchTenders}
        />
      </div>

      {/* Tender Modal */}
      {showTenderModal && (
        <div className="modal tender-modal-overlay">
          <div className="modal-card tender-modal-card">
            <h2>
              {tendersLoading && !tenders.length
                ? 'Loading payment options...'
                : tendersError && !tenders.length
                ? 'Payment options unavailable'
                : 'Payment processing...'}
            </h2>
            {tendersLoading && !tenders.length ? (
              <div className="modal-status-panel">
                <p>Fetching available payment methods...</p>
              </div>
            ) : tendersError && !tenders.length ? (
              <div className="modal-status-panel is-error">
                <p>{tendersError}</p>
              </div>
            ) : (
              <>
                <div className="tender-grid">
                  {tenderColumns.map((column, columnIndex) => (
                    <div key={columnIndex} className="tender-panel">
                      <table className="modal-table tender-table">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {column.map((tender) => (
                            <tr key={tender.Code}>
                              <td>{tender.Description}</td>
                              <td>
                                <input
                                  type="number"
                                  value={tenderAmounts[tender.Code] || ''}
                                  onFocus={() => handleTenderFocus(tender)}
                                  onChange={(e) => handleTenderChange(tender.Code, e.target.value)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                <div className="modal-totals tender-modal-totals">
                  <div>Total Bill: {total.toFixed(2)}</div>
                  <div>Total Tendered: {totalTendered.toFixed(2)}</div>
                  <div>Change Due: {balance}</div>
                </div>
              </>
            )}

            <div className="modal-actions tender-modal-actions">
              {tendersError && !tenders.length ? (
                <button className="modal-btn" onClick={() => loadTenders().catch(() => null)}>Retry</button>
              ) : (
                <button
                  className="modal-btn"
                  onClick={handleTransactionSubmit}
                  disabled={tendersLoading || !tenders.length}
                >
                  Proceed
                </button>
              )}
              <button className="modal-btn cancel" onClick={handleModalClose}>Abort</button>
            </div>

            {/* Loyalty Input Modal - appears on top of tender modal with same styling */}
            {showLoyaltyInputModal && (
              <div className="modal tender-modal-overlay loyalty-modal-overlay">
                <div className="modal-card tender-modal-card loyalty-modal-card">
                  <h2>Enter Customer Information</h2>
                  <div className="loyalty-form">
                    <div className="loyalty-panel">
                      <p><strong>Points to be earned:</strong> {loyaltyPoints} points</p>

                      {customerName && (
                        <p><strong>Loyalty Customer:</strong> {customerName}</p>
                      )}
                    </div>
                    <div className="loyalty-panel">
                      <input
                        className="loyalty-input"
                        type="text"
                        value={loyaltyIdentifier}
                        onChange={(e) => setLoyaltyIdentifier(e.target.value)}
                        onKeyDown={handleLoyaltyInputKeyDown}
                        placeholder="Enter ID, card, or mobile and press Enter"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="modal-actions tender-modal-actions loyalty-modal-actions">
                    <button className="modal-btn primary" onClick={handleLoyaltySubmit}>Proceed</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mpesa Modal */}
      {showMpesaModal && (
        <div className="modal tender-modal-overlay">
          <div className="modal-card tender-modal-card mpesa-card">
            <h2>{checkingMpesaTransactions ? 'Checking M-Pesa transactions...' : 'M-Pesa Payment'}</h2>
            {checkingMpesaTransactions ? (
              <div className="modal-status-panel">
                <p>Looking for a matching payment before we send a new STK request...</p>
              </div>
            ) : (
              <div className="mpesa-form">
                <div className="form-field full-width label-top">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    value={mpesaData.phone}
                    onChange={(e) => setMpesaData({ ...mpesaData, phone: e.target.value })}
                    placeholder="e.g., 254712345678"
                    autoFocus
                  />
                </div>
                <div className="form-field full-width mpesa-details-field">
                  <table className="mpesa-details-table">
                    <thead>
                      <tr>
                        <th scope="col">Description</th>
                        <th scope="col">Name</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Transaction Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>M-Pesa</td>
                        <td>
                          <input
                            type="text"
                            value={mpesaData.name}
                            onChange={(e) => setMpesaData({ ...mpesaData, name: e.target.value })}
                            placeholder="Customer name"
                          />
                        </td>
                        <td>{mpesaData.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                        <td>{mpesaData.time}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions tender-modal-actions mpesa-actions">
              <button
                className="modal-btn primary"
                disabled={loadingMpesa || checkingMpesaTransactions || !mpesaData.phone.trim()}
                onClick={async () => {
                  // Validate phone number
                  const validatedPhone = validatePhoneNumber(mpesaData.phone);
                  if (!validatedPhone) {
                    alert("Please enter a valid Kenyan phone number (e.g., 254712345678 or 0712345678)");
                    return;
                  }
                  
                  setLoadingMpesa(true);
                  try {
                    const res = await apiFetch(`${API_BASE_URL}/api/mpesa/stkpush`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        phone: validatedPhone,
                        amount: Math.round(mpesaData.amount), // Round to nearest integer
                        customer_name: mpesaData.name || 'Customer',
                      }),
                    });

                    const data = await res.json();
                    if (res.ok && data.success) {
                      alert("STK Push sent successfully! Ask customer to enter PIN on phone.");
                      handleTenderChange("M-Pesa", mpesaData.amount.toFixed(2));
                      mpesaAvailabilityRequestRef.current += 1;
                      setCheckingMpesaTransactions(false);
                      setShowMpesaModal(false);
                      setMpesaData({
                        phone: "",
                        name: "",
                        code: "",
                        amount: 0,
                        time: new Date().toLocaleString(),
                      });
                    } else {
                      alert("STK Push failed: " + (data.message || "Please try again"));
                    }
                  } catch (err) {
                    alert("Error connecting to payment service. Please check your connection and try again.");
                    console.error(err);
                  } finally {
                    setLoadingMpesa(false);
                  }
                }}
              >
                {loadingMpesa ? "Sending..." : "Send Request"}
              </button>
              <button
                className="modal-btn cancel"
                onClick={() => {
                  mpesaAvailabilityRequestRef.current += 1;
                  setCheckingMpesaTransactions(false);
                  setAvailableMpesaTransactions([]);
                  setShowMpesaModal(false);
                  setMpesaData({
                    phone: "",
                    name: "",
                    code: "",
                    amount: 0,
                    time: new Date().toLocaleString(),
                  });
                }}
                disabled={loadingMpesa}
              >
                Cancel
              </button>
            </div>
            <div className="mpesa-info">
              <p>Secure M-Pesa payment processing.</p>
              <p>The customer will receive a prompt on their phone.</p>
            </div>
          </div>
        </div>
      )}
      {/* Available M-Pesa Transactions List */}
      {showTransactionList && (
        <div className="modal tender-modal-overlay">
          <div className="modal-card tender-modal-card mpesa-card">
            <h2>Available M-Pesa Transactions</h2>
            <div className="mpesa-form">
              <div className="form-field full-width">
                <p>Found {availableMpesaTransactions.length} transaction(s) for KES {total.toFixed(2)}</p>
              </div>
              {availableMpesaTransactions.map((transaction, index) => (
                <div key={index} className="form-field full-width mpesa-transaction-card">
                  <div className="mpesa-transaction-head">
                    <div className="mpesa-transaction-meta">
                      <div><strong>Transaction ID:</strong> {transaction.transaction_id}</div>
                      <div><strong>Phone:</strong> {transaction.phone}</div>
                      <div><strong>Date:</strong> {new Date(transaction.transaction_date).toLocaleString()}</div>
                    </div>
                    <button
                      className="modal-btn primary"
                      onClick={() => {
                        // Use this transaction
                        handleTenderChange("M-Pesa", total.toFixed(2));
                        setShowTransactionList(false);
                        setAvailableMpesaTransactions([]);
                      }}
                    >
                      Use
                    </button>
                  </div>
                </div>
              ))}
              {availableMpesaTransactions.length === 0 && (
                <div className="form-field full-width">
                  <p>No available transactions found for this amount.</p>
                </div>
              )}
            </div>
            <div className="modal-actions tender-modal-actions mpesa-actions">
              <button
                className="modal-btn primary"
                onClick={() => {
                  // Initiate STK Push
                  setMpesaData({
                    ...mpesaData,
                    amount: total,
                    time: new Date().toLocaleString(),
                  });
                  setCheckingMpesaTransactions(false);
                  setShowTransactionList(false);
                  setShowMpesaModal(true);
                }}
              >
                Initiate STK Push
              </button>
              <button
                className="modal-btn cancel"
                onClick={() => {
                  setShowTransactionList(false);
                  setAvailableMpesaTransactions([]);
                }}
              >
                Cancel
              </button>
            </div>
            <div className="mpesa-info">
              <p>Select a transaction to use or initiate a new STK Push.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Validate phone number format (Kenyan format)
const validatePhoneNumber = (phone) => {
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Format phone number to ensure it starts with 2547
  let formattedPhone = cleanPhone;
  if (formattedPhone.startsWith("0")) {
    formattedPhone = "254" + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith("254")) {
    formattedPhone = "254" + formattedPhone;
  }
  
  // Validate Kenyan phone number format
  const phoneRegex = /^2547\d{8}$/;
  return phoneRegex.test(formattedPhone) ? formattedPhone : null;
};

export default App;
