import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { instituteApi, type InstituteFeeCharge } from '../../services/api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { formatCurrency } from '../../utils/formatting';
import { instituteDec } from '../../utils/instituteMoney';

type Props = {
  open: boolean;
  fee: InstituteFeeCharge | null;
  onClose: () => void;
  onRecorded: () => void;
};

export function RecordPaymentModal({ open, fee, onClose, onRecorded }: Props) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const balance = fee ? instituteDec(fee.balance) : 0;
  const currency = (fee?.currency || '').trim().toUpperCase();

  useEffect(() => {
    if (open && fee) {
      const b = instituteDec(fee.balance);
      setAmount(b > 0 ? String(b) : '');
      setMethod('cash');
      setReference('');
    }
  }, [open, fee]);

  // Live preview values — derived once and reused below so the review row
  // and the submit handler always agree on what "the user is about to pay".
  const parsedAmount = useMemo(() => {
    const raw = amount.replace(/\s/g, '').replace(/,/g, '.');
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  const remainingAfter = Math.max(0, balance - parsedAmount);
  const overpaying = parsedAmount > balance + 1e-9;

  const methodLabel = (() => {
    switch (method) {
      case 'cash':
        return t('erp.paymentCash');
      case 'bank':
        return t('erp.paymentBank');
      case 'transfer':
        return t('erp.paymentTransfer');
      default:
        return method;
    }
  })();

  if (!open || !fee) return null;

  const submit = async () => {
    const raw = amount.replace(/\s/g, '').replace(/,/g, '.');
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error(t('institute.paymentAmountInvalid'));
      return;
    }
    if (n > balance + 1e-9) {
      toast.error(t('institute.paymentExceedsBalance'));
      return;
    }
    setSubmitting(true);
    try {
      await instituteApi.recordPayment({
        feeChargeId: fee.id,
        amount: n,
        currency: fee.currency,
        method,
        reference: reference.trim() || undefined,
      });
      toast.success(t('institute.paymentRecorded'));
      onRecorded();
      onClose();
    } catch (e) {
      toast.error(getErrorMessage(e, t('institute.paymentFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="institute-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="institute-modal card" role="dialog" aria-modal="true" aria-labelledby="institute-pay-title">
        <div className="institute-modal__head">
          <h2 id="institute-pay-title" className="institute-modal__title">
            {t('institute.recordPaymentTitle')}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm institute-modal__close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>
        <div className="institute-modal__body">
          <p className="muted institute-modal__meta">
            {fee.label || t('institute.feeDefaultLabel')} · {t('institute.outstanding')}:{' '}
            <strong>{formatCurrency(balance, currency)}</strong>
          </p>
          <label className="institute-field">
            <span className="institute-field__label">{t('institute.paymentAmount')}</span>
            <input
              type="text"
              inputMode="decimal"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoComplete="off"
              aria-invalid={overpaying || undefined}
            />
          </label>
          <label className="institute-field">
            <span className="institute-field__label">{t('institute.paymentMethod')}</span>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">{t('erp.paymentCash')}</option>
              <option value="bank">{t('erp.paymentBank')}</option>
              <option value="transfer">{t('erp.paymentTransfer')}</option>
            </select>
          </label>
          <label className="institute-field">
            <span className="institute-field__label">{t('institute.paymentReference')}</span>
            <input type="text" className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>

          {/*
           * Live review panel: everything the user is about to commit, in
           * one glance. Updates as they type the amount so they can see the
           * remaining balance settle to zero before clicking Submit.
           */}
          <div className="institute-modal__review" aria-live="polite">
            <div className="institute-modal__review-row">
              <span className="institute-modal__review-label">{t('institute.summaryBalance')}</span>
              <span className="institute-modal__review-value">{formatCurrency(balance, currency)}</span>
            </div>
            <div className="institute-modal__review-row">
              <span className="institute-modal__review-label">{t('institute.paymentAmount')}</span>
              <span className="institute-modal__review-value institute-amount-credit">
                {parsedAmount > 0 ? `− ${formatCurrency(parsedAmount, currency)}` : '—'}
              </span>
            </div>
            <div className="institute-modal__review-row institute-modal__review-row--total">
              <span className="institute-modal__review-label">{t('institute.remainingAfter')}</span>
              <span
                className={`institute-modal__review-value institute-amount${
                  remainingAfter > 0.0001 ? ' institute-amount--due' : ' institute-amount--zero'
                }`}
              >
                {formatCurrency(remainingAfter, currency)}
              </span>
            </div>
            <div className="institute-modal__review-row">
              <span className="institute-modal__review-label">{t('institute.paymentMethod')}</span>
              <span className="institute-modal__review-value">{methodLabel}</span>
            </div>
            {reference.trim() ? (
              <div className="institute-modal__review-row">
                <span className="institute-modal__review-label">{t('institute.paymentReference')}</span>
                <span className="institute-modal__review-value">{reference.trim()}</span>
              </div>
            ) : null}
            {overpaying ? (
              <p className="institute-modal__review-warn" role="alert">
                {t('institute.paymentExceedsBalance')}
              </p>
            ) : null}
          </div>
        </div>
        <div className="institute-modal__foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submit()}
            disabled={submitting || parsedAmount <= 0 || overpaying}
          >
            {submitting ? t('common.loading') : t('institute.recordPaymentSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}
