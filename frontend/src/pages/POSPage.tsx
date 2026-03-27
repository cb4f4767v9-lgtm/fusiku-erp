import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { inventoryApi, posApi, branchesApi, customersApi, aiApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Scan, Trash2, Receipt, Percent } from 'lucide-react';
import { ReceiptPrint } from '../components/ReceiptPrint';

const MIN_TOUCH_SIZE = 48;

export function POSPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [branches, setBranches] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
    customersApi.getAll().then((r) => setCustomers(r.data)).catch(() => setCustomers([]));
  }, []);

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
        } catch { /* ignore */ }
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
      if (cart.some((c) => c.id === data.id)) {
        toast.error(t('pos.alreadyInCart'));
        return;
      }
      setCart((c) => [...c, data]);
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

  const completeSale = async (method?: 'cash' | 'card' | 'transfer') => {
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
      const { data } = await posApi.createSale({
        branchId,
        customerId: customerId || undefined,
        items: cart.map((i) => ({ inventoryId: i.id })),
        paymentMethod: methodToUse,
        discountPercent: discountPercent > 0 ? discountPercent : undefined
      });
      setReceipt(data);
      setCart([]);
      setDiscountPercent(0);
      setSelectedCartId(null);
      toast.success(t('pos.saleCompleted'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('pos.saleFailed'));
    } finally {
      setLoading(false);
    }
  };

  const clearReceipt = () => setReceipt(null);

  return (
    <div className="pos-page pos-touchscreen">
      {receipt ? (
        <div className="pos-receipt-view">
          <h2>{t('pos.receiptNum')}{receipt.id?.slice(-8)}</h2>
          <p>{t('pos.date')}: {new Date(receipt.createdAt).toLocaleString()}</p>
          <p>{t('pos.branch')}: {receipt.branch?.name}</p>
          <table className="data-table">
            <thead>
              <tr><th>{t('receipt.imei')}</th><th>{t('receipt.price')}</th></tr>
            </thead>
            <tbody>
              {receipt.saleItems?.map((si: any) => (
                <tr key={si.id}>
                  <td>{si.imei}</td>
                  <td>${Number(si.sellingPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><strong>{t('pos.total')}: ${Number(receipt.totalAmount).toFixed(2)}</strong></p>
          <p>{t('pos.profit')}: ${Number(receipt.profit).toFixed(2)}</p>
          <div className="pos-action-bar">
            <ReceiptPrint receipt={receipt} className="pos-action-btn" label={t('pos.printInvoice')} style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }} />
            <button className="pos-action-btn pos-action-btn-primary" onClick={clearReceipt} style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }}>
              <Receipt size={24} /> {t('pos.newSale')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pos-top-bar">
            <div className="pos-search">
              <input
                ref={inputRef}
                type="text"
                placeholder={t('pos.scanPlaceholder')}
                value={imeiInput}
                onChange={(e) => setImeiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); scanImei(); } }}
                autoFocus
                autoComplete="off"
              />
            </div>
            <div className="pos-customer-select">
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t('pos.walkIn')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="pos-main">
            <div className="pos-cart-area">
              <h3>{t('pos.cartCount', { count: cart.length })}</h3>
              <div className="pos-cart-list">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className={`pos-cart-item ${selectedCartId === item.id ? 'selected' : ''}`}
                    onClick={() => setSelectedCartId(selectedCartId === item.id ? null : item.id)}
                  >
                    <div className="pos-cart-item-info">
                      <strong>{item.brand} {item.model}</strong>
                      <span>{item.imei}</span>
                      <span>${Number(item.sellingPrice).toFixed(2)}</span>
                      {priceOptMap[item.id] && (
                        <span className={`pos-ai-price pos-ai-${priceOptMap[item.id].status || 'optimal'}`}>
                          AI: ${priceOptMap[item.id].recommendedPrice.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <p className="pos-empty-cart">{t('pos.scanEmptyCart')}</p>}
              </div>
            </div>

            <div className="pos-sidebar">
              <div className="pos-totals">
                <p>{t('pos.subtotal')}: ${subtotal.toFixed(2)}</p>
                {discountPercent > 0 && (
                  <p className="pos-discount">{t('pos.discount')} ({discountPercent}%): -${discountAmount.toFixed(2)}</p>
                )}
                <p className="pos-total">{t('pos.total')}: ${total.toFixed(2)}</p>
                <p className="pos-profit">{t('pos.profit')}: ${profit.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="pos-action-bar">
            <button
              className="pos-action-btn"
              onClick={scanImei}
              disabled={loading}
              style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }}
            >
              <Scan size={24} /> {t('pos.add')}
            </button>
            <button
              className="pos-action-btn"
              onClick={() => selectedCartId && removeFromCart(selectedCartId)}
              disabled={!selectedCartId}
              style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }}
            >
              <Trash2 size={24} /> {t('pos.remove')}
            </button>
            <button
              className="pos-action-btn"
              onClick={() => setShowDiscount(!showDiscount)}
              style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }}
            >
              <Percent size={24} /> {t('pos.discount')}
            </button>
            {showDiscount && (
              <div className="pos-discount-input">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                />
                <span>%</span>
              </div>
            )}
            <button
              className={`pos-action-btn ${paymentMethod === 'cash' ? 'pos-action-btn-primary' : ''}`}
              onClick={() => setPaymentMethod('cash')}
              style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }}
            >
              {t('pos.cash', 'Cash')}
            </button>
            <button
              className={`pos-action-btn ${paymentMethod === 'card' ? 'pos-action-btn-primary' : ''}`}
              onClick={() => setPaymentMethod('card')}
              style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }}
            >
              {t('pos.card', 'Card')}
            </button>
            <button
              className={`pos-action-btn ${paymentMethod === 'transfer' ? 'pos-action-btn-primary' : ''}`}
              onClick={() => setPaymentMethod('transfer')}
              style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }}
            >
              {t('pos.transfer', 'Transfer')}
            </button>
            <button
              className="pos-action-btn pos-action-btn-primary"
              onClick={() => completeSale()}
              disabled={cart.length === 0 || loading}
              style={{ minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE }}
            >
              <Receipt size={24} /> {t('pos.completeSale', 'Complete Sale')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
