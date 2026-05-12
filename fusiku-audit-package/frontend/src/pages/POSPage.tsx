import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { inventoryApi, posApi, branchesApi, customersApi, aiApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../contexts/CurrencyContext';
import toast from 'react-hot-toast';
import { Scan, Trash2, Receipt, Percent, Boxes } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';
import { ReceiptPrint } from '../components/ReceiptPrint';
import { EmptyState, PageLayout, PageHeader, ErrorState } from '../components/design-system';
import { useSaasCommercialGate } from '../hooks/useSaasCommercialGate';
import { enqueueIfOfflineDesktop } from '../offline/outboxEnqueue';
import { OUTBOX_KIND } from '../offline/outboxKinds';
import { formatDateTimeForUi } from '../utils/formatting';
import { useNavigate } from 'react-router-dom';
import { useBranding } from '../contexts/BrandingContext';

export function POSPage() {
  const { t } = useTranslation();
  const { commercialWritesAllowed } = useSaasCommercialGate();
  const { user } = useAuth();
  const { formatMoney, convert, selectedCurrency, ledgerBaseCurrency } = useCurrency();
  const navigate = useNavigate();
  const { companyName, companyLogoUrl } = useBranding();
  const [branches, setBranches] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [imeiInput, setImeiInput] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [priceOptMap, setPriceOptMap] = useState<Record<string, { recommendedPrice: number; confidenceScore: number; status?: string }>>({});
  const [bootstrapError, setBootstrapError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeResultIdx, setActiveResultIdx] = useState<number>(-1);
  const [heldCart, setHeldCart] = useState<any[]>(() => {
    try {
      const raw = sessionStorage.getItem('fusiku_pos_held_cart');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const money = (amount: number) =>
    formatMoney(convert(Number(amount || 0), ledgerBaseCurrency, selectedCurrency), selectedCurrency);

  const addToCart = (data: any) => {
    if (!data) return;
    if (data.status !== 'available') {
      toast.error(t('pos.itemNotAvailable'));
      return;
    }
    if (cart.some((c) => c.id === data.id)) {
      toast.error(t('pos.alreadyInCart'));
      return;
    }
    setCart((c) => [...c, data]);
  };

  const refreshInventory = async () => {
    const r = await inventoryApi.getAll();
    const rows = r.data;
    setItems(Array.isArray(rows) ? rows : []);
  };

  const loadBootstrap = useCallback(() => {
    setBootstrapError(false);
    Promise.all([
      branchesApi.getAll().then((r) => setBranches(r.data)),
      customersApi.getAll().then((r) => setCustomers(r.data)),
      inventoryApi.getAll().then((r) => {
        const rows = r.data;
        setItems(Array.isArray(rows) ? rows : []);
      }),
    ]).catch((err) => {
      if (import.meta.env.DEV) console.warn('POS bootstrap failed', err);
      setBootstrapError(true);
      setBranches([]);
      setCustomers([]);
      setItems([]);
    });
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!receipt) inputRef.current?.focus();
  }, [receipt, cart.length]);

  useEffect(() => {
    if (cart.length === 0) {
      setPriceOptMap({});
      return;
    }
    const map: Record<string, { recommendedPrice: number; confidenceScore: number; status?: string }> = {};
    Promise.all(
      cart.map(async (item) => {
        try {
          const days = item.createdAt ? Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (24 * 60 * 60 * 1000)) : undefined;
          const { data } = await aiApi.priceOptimize({
            brand: item.brand,
            model: item.model,
            storage: item.storage,
            condition: item.condition,
            currentPrice: Number(item.sellingPrice),
            inventoryAgeDays: days
          });
          map[item.id] = { recommendedPrice: data.recommendedPrice, confidenceScore: data.confidenceScore ?? 0, status: data.status };
        } catch (err) {
          if (import.meta.env.DEV) console.warn('POS price optimize failed', err);
        }
      })
    ).then(() => setPriceOptMap(map));
  }, [cart]);

  const branchId = user?.branchId || branches[0]?.id;

  const scanImei = async () => {
    const input = imeiInput.trim();
    if (!input) return;
    setLoading(true);
    try {
      let data;
      if (input.startsWith('FUS') && /^FUS\d{8}$/.test(input)) {
        const res = await inventoryApi.getByBarcode(input);
        data = res.data;
      } else {
        const res = await inventoryApi.getByImei(input);
        data = res.data;
      }
      if (data.status !== 'available') {
        toast.error(t('pos.itemNotAvailable'));
        return;
      }
      addToCart(data);
      setImeiInput('');
      inputRef.current?.focus();
    } catch {
      toast.error(t('pos.imeiNotFound'));
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = (id: string) => {
    setCart((c) => c.filter((x) => x.id !== id));
    if (selectedCartId === id) setSelectedCartId(null);
  };

  const subtotal = cart.reduce((s, i) => s + Number(i.sellingPrice), 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const total = Math.max(0, subtotal - discountAmount);
  const totalCost = cart.reduce((s, i) => s + Number(i.purchasePrice), 0);
  const profit = total - totalCost;

  const searchableItems = items.filter((i) => i && i.status === 'available');
  const q = imeiInput.trim().toLowerCase();
  const searchResults =
    q.length < 2
      ? []
      : searchableItems
          .filter((i) => {
            const hay = `${i.imei || ''} ${i.barcode || ''} ${i.brand || ''} ${i.model || ''} ${i.storage || ''} ${i.color || ''}`.toLowerCase();
            return hay.includes(q);
          })
          .slice(0, 24);

  useEffect(() => {
    // Reset keyboard selection when query changes.
    setActiveResultIdx(searchResults.length ? 0 : -1);
  }, [q, searchResults.length]);

  const holdSale = () => {
    try {
      sessionStorage.setItem('fusiku_pos_held_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
    setHeldCart(cart);
    setCart([]);
    setSelectedCartId(null);
    toast.success(t('pos.saleHeld'));
    inputRef.current?.focus();
  };

  const restoreHeldSale = () => {
    if (!heldCart.length) return;
    setCart(heldCart);
    setHeldCart([]);
    try {
      sessionStorage.removeItem('fusiku_pos_held_cart');
    } catch {
      // ignore
    }
    toast.success(t('pos.saleRestored'));
    inputRef.current?.focus();
  };

  const completeSale = async (method?: 'cash' | 'card' | 'transfer') => {
    if (!commercialWritesAllowed) {
      toast.error(t('saas.actionBlocked'));
      return;
    }
    if (cart.length === 0) {
      toast.error(t('pos.cartEmpty'));
      return;
    }
    if (!branchId) {
      toast.error(t('pos.noBranchSelected'));
      return;
    }
    setLoading(true);
    try {
      const methodToUse = method || paymentMethod;
      const saleBody = {
        branchId,
        customerId: customerId || undefined,
        items: cart.map((i) => ({ inventoryId: i.id, sellingPrice: Number(i.sellingPrice) })),
        paymentMethod: methodToUse,
        discountPercent: discountPercent > 0 ? discountPercent : undefined,
      };
      if (await enqueueIfOfflineDesktop(OUTBOX_KIND.POS_SALE, saleBody)) {
        setCart([]);
        setDiscountPercent(0);
        setSelectedCartId(null);
        toast.success(t('offline.saleQueuedOffline'));
        window.dispatchEvent(new Event('fusiku-dashboard-refresh'));
        return;
      }
      const { data } = await posApi.createSale(saleBody);
      setReceipt(data);
      setCart([]);
      setDiscountPercent(0);
      setSelectedCartId(null);
      try {
        await refreshInventory();
      } catch {
        // ignore refresh errors; sale already completed
      }
      window.dispatchEvent(new Event('fusiku-dashboard-refresh'));
      toast.success(t('pos.saleCompleted'));
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('pos.saleFailed')));
    } finally {
      setLoading(false);
    }
  };

  const clearReceipt = () => setReceipt(null);

  if (bootstrapError) {
    return (
      <PageLayout className="page pos-page pos-touchscreen">
        <PageHeader title={t('pos.title')} subtitle={t('pos.subtitle')} />
        <ErrorState message={t('common.unableToLoadData')} hint={t('pos.bootstrapHint')} onRetry={loadBootstrap} />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="page pos-page pos-touchscreen">
      {receipt ? (
        <div className="pos-receipt-view">
          <div className="pos-invoice-branding" aria-label={t('receipt.invoiceBranding', { defaultValue: 'Invoice branding' })}>
            {companyLogoUrl ? <img src={companyLogoUrl} alt="" className="pos-invoice-branding__logo" /> : null}
            <div className="pos-invoice-branding__meta">
              <div className="pos-invoice-branding__name">{companyName || t('brand.name')}</div>
              <div className="pos-invoice-branding__hint muted">
                {t('receipt.brandingHint', { defaultValue: 'Invoice branding settings will appear here (logo, footer, contact).' })}
              </div>
            </div>
          </div>
          <h2>{t('pos.receiptNum')}{receipt.id?.slice(-8)}</h2>
          <p>
            {t('pos.date')}: {formatDateTimeForUi(receipt.createdAt)}
          </p>
          <p>{t('pos.branch')}: {receipt.branch?.name}</p>
          <table className="data-table">
            <thead>
              <tr><th>{t('receipt.imei')}</th><th className="num">{t('receipt.price')}</th></tr>
            </thead>
            <tbody>
              {receipt.saleItems?.map((si: any) => (
                <tr key={si.id}>
                  <td>{si.imei}</td>
                  <td className="num">{money(Number(si.sellingPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><strong>{t('pos.total')}: {money(Number(receipt.totalAmount))}</strong></p>
          <p>{t('pos.profit')}: {money(Number(receipt.profit))}</p>
          <div className="pos-action-bar">
            <ReceiptPrint receipt={receipt} className="pos-action-btn pos-touch-target" label={t('pos.printInvoice')} />
            <button type="button" className="pos-action-btn pos-action-btn-primary pos-touch-target" onClick={clearReceipt}>
              <Receipt size={24} /> {t('pos.newSale')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <PageHeader title={t('pos.title')} subtitle={t('pos.subtitle')} className="pos-page__header" />
          <div className="pos-shell">
            <section className="pos-col pos-col--left" aria-label={t('pos.ariaProductSearch')}>
              <div className="pos-search-card">
                <div className="pos-search-card__row">
                  <div className="pos-search">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={t('pos.scanPlaceholder')}
                      value={imeiInput}
                      onChange={(e) => setImeiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setActiveResultIdx((n) => Math.min(searchResults.length - 1, Math.max(0, n + 1)));
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setActiveResultIdx((n) => Math.max(0, n - 1));
                          return;
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setImeiInput('');
                          setActiveResultIdx(-1);
                          return;
                        }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const selected = activeResultIdx >= 0 ? searchResults[activeResultIdx] : null;
                          if (selected) {
                            addToCart(selected);
                            setImeiInput('');
                            inputRef.current?.focus();
                            return;
                          }
                          scanImei();
                        }
                      }}
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                  <button type="button" className="btn btn-primary pos-quick-add" onClick={scanImei} disabled={loading}>
                    <Scan size={18} /> {t('pos.add')}
                  </button>
                </div>

                <div className="pos-search-card__row">
                  <div className="pos-customer-select">
                    <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                      <option value="">{t('pos.walkIn')}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pos-held">
                    <button type="button" className="btn btn-secondary" onClick={holdSale} disabled={!cart.length}>
                      {t('pos.hold')}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={restoreHeldSale} disabled={!heldCart.length}>
                      {t('pos.restore')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card pos-results-card">
                <div className="pos-results-card__head">
                  <h3 className="dashboard-card-title">{t('pos.results')}</h3>
                  <p className="muted pos-results-card__hint">{t('pos.resultsHint')}</p>
                </div>
                <div className="pos-results-list" role="list">
                  {q.length < 2 && searchableItems.length === 0 ? (
                    <EmptyState
                      className="pos-results-empty"
                      icon={<Boxes />}
                      title={t('pos.noInventoryTitle', { defaultValue: 'No inventory available yet' })}
                      description={t('pos.noInventoryHint', {
                        defaultValue:
                          'Add inventory first, then come back here to scan and complete your first sale.',
                      })}
                      action={
                        <button type="button" className="btn btn-primary" onClick={() => navigate('/inventory')}>
                          {t('nav.inventory')}
                        </button>
                      }
                    />
                  ) : q.length < 2 ? (
                    <div className="pos-results-empty muted">{t('pos.searchHint')}</div>
                  ) : searchResults.length ? (
                    searchResults.map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        className={`pos-result-row ${searchResults[activeResultIdx]?.id === i.id ? 'is-active' : ''}`}
                        aria-selected={searchResults[activeResultIdx]?.id === i.id}
                        onClick={() => addToCart(i)}
                      >
                        <span className="pos-result-row__main">
                          <span className="pos-result-row__title">
                            {i.brand} {i.model}
                          </span>
                          <span className="pos-result-row__meta">
                            {i.storage ? `${i.storage} · ` : ''}
                            {i.color ? `${i.color} · ` : ''}
                            {i.imei}
                          </span>
                        </span>
                        <span className="pos-result-row__price">{money(Number(i.sellingPrice))}</span>
                      </button>
                    ))
                  ) : (
                    <div className="pos-results-empty muted">{t('pos.noResults')}</div>
                  )}
                </div>
              </div>
            </section>

            <section className="pos-col pos-col--center" aria-label={t('pos.ariaCart')}>
              <div className="card pos-cart-card">
                <div className="pos-cart-card__head">
                  <h3 className="dashboard-card-title">{t('pos.cartCount', { count: cart.length })}</h3>
                  <button
                    type="button"
                    className="btn btn-secondary pos-remove-btn"
                    onClick={() => selectedCartId && removeFromCart(selectedCartId)}
                    disabled={!selectedCartId}
                  >
                    <Trash2 size={16} /> {t('pos.remove')}
                  </button>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('pos.item')}</th>
                        <th>{t('receipt.imei')}</th>
                        <th className="num">{t('pos.price')}</th>
                        <th className="num">{t('pos.ai')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr
                          key={item.id}
                          className={`pos-cart-row ${selectedCartId === item.id ? 'pos-cart-row--selected' : ''}`}
                          onClick={() => setSelectedCartId(selectedCartId === item.id ? null : item.id)}
                        >
                          <td>
                            {item.brand} {item.model}
                          </td>
                          <td>{item.imei}</td>
                          <td className="num">{money(Number(item.sellingPrice))}</td>
                          <td className="num">
                            {priceOptMap[item.id] ? money(Number(priceOptMap[item.id].recommendedPrice)) : t('common.selectPlaceholder')}
                          </td>
                        </tr>
                      ))}
                      {cart.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="data-table-empty-cell">
                            {t('pos.scanEmptyCart')}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="pos-col pos-col--right" aria-label={t('pos.ariaSummary')}>
              <div className="card pos-summary-card">
                <h3 className="dashboard-card-title">{t('pos.summary')}</h3>
                <div className="pos-summary-kpis">
                  <div className="pos-summary-row">
                    <span className="muted">{t('pos.subtotal')}</span>
                    <strong className="num">{money(subtotal)}</strong>
                  </div>
                  <div className="pos-summary-row">
                    <span className="muted">{t('pos.discount')}</span>
                    <button type="button" className="btn btn-secondary btn-compact" onClick={() => setShowDiscount(!showDiscount)}>
                      <Percent size={14} /> {discountPercent || 0}%
                    </button>
                  </div>
                  {showDiscount ? (
                    <div className="pos-discount-inline">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                      />
                      <span className="muted">%</span>
                      <span className="muted">(-{money(discountAmount)})</span>
                    </div>
                  ) : null}

                  <div className="pos-summary-total">
                    <span className="muted">{t('pos.total')}</span>
                    <span className="pos-summary-total__value">{money(total)}</span>
                  </div>

                  <div className={`pos-summary-profit ${profit < 0 ? 'pos-summary-profit--danger' : ''}`}>
                    <span className="pos-summary-profit__label">{t('pos.profit')}</span>
                    <span className="pos-summary-profit__value">{money(profit)}</span>
                  </div>
                </div>

                <div className="pos-payment">
                  <p className="ds-section-title">{t('pos.paymentMethod')}</p>
                  <div className="pos-payment-row">
                    <button
                      type="button"
                      className={`btn btn-secondary ${paymentMethod === 'cash' ? 'pos-pay--active' : ''}`}
                      onClick={() => setPaymentMethod('cash')}
                    >
                      {t('erp.paymentCash')}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-secondary ${paymentMethod === 'card' ? 'pos-pay--active' : ''}`}
                      onClick={() => setPaymentMethod('card')}
                    >
                      {t('common.card')}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-secondary ${paymentMethod === 'transfer' ? 'pos-pay--active' : ''}`}
                      onClick={() => setPaymentMethod('transfer')}
                    >
                      {t('erp.paymentTransfer')}
                    </button>
                  </div>
                </div>

                <div className="pos-summary-actions">
                  <button
                    type="button"
                    className="btn btn-primary pos-complete-btn pos-touch-target"
                    onClick={() => completeSale()}
                    disabled={cart.length === 0 || loading || !commercialWritesAllowed}
                  >
                    <Receipt size={18} /> {t('pos.completeSale')}
                  </button>
                  <p className="muted pos-summary-footnote">
                    {commercialWritesAllowed ? t('pos.readyToComplete') : t('saas.actionBlocked')}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </PageLayout>
  );
}
