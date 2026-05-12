import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBranding } from '../contexts/BrandingContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { publicAssetUrl } from '../config/appConfig';
import { formatDateTimeForUi } from '../utils/formatting';

interface ReceiptPrintProps {
  receipt: any;
  storeName?: string;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ReceiptPrint({ receipt, storeName, className, label, style }: ReceiptPrintProps) {
  const { t } = useTranslation();
  const { companyLogoUrl, companyName } = useBranding();
  const { formatMoney, convert, selectedCurrency, ledgerBaseCurrency } = useCurrency();
  const buttonLabel = label ?? t('receipt.printReceipt');
  const thankYou = t('receipt.thankYou');
  const powered = t('brand.poweredBy');

  const branchLogoUrl = publicAssetUrl(receipt?.branch?.logo);
  const headerImg = branchLogoUrl || companyLogoUrl;
  const titleText =
    storeName?.trim() ||
    receipt?.branch?.name?.trim() ||
    companyName?.trim() ||
    t('brand.name');

  const lineMoney = (n: number) =>
    formatMoney(convert(Number(n || 0), ledgerBaseCurrency, selectedCurrency), selectedCurrency);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const branchLabel = t('receipt.branch');
    const receiptNumLabel = t('receipt.receiptNum');
    const imeiLabel = t('receipt.imei');
    const deviceLabel = t('receipt.device');
    const priceLabel = t('receipt.price');
    const totalLabel = t('receipt.total');
    const profitLabel = t('receipt.profit');
    const createdAtStr = receipt ? formatDateTimeForUi(receipt.createdAt) : '';

    const imgBlock = headerImg
      ? `<div class="receipt-logo-wrap"><img class="receipt-logo" src="${escapeHtml(headerImg)}" alt="" /></div>`
      : `<div class="logo-text">${escapeHtml(titleText)}</div>`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${receipt?.id?.slice(-8) || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .receipt-logo-wrap { text-align: center; margin-bottom: 8px; }
            .receipt-logo { max-height: 56px; max-width: 200px; object-fit: contain; }
            .logo-text { font-size: 22px; font-weight: bold; color: #0f172a; margin-bottom: 4px; text-align: center; }
            .slogan { font-size: 11px; color: #64748b; margin-bottom: 8px; text-align: center; }
            .receipt-header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 12px; margin-bottom: 12px; }
            .receipt-body { margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 6px 0; text-align: left; }
            th { border-bottom: 1px solid #eee; }
            .total-row { font-weight: bold; font-size: 18px; margin-top: 12px; padding-top: 12px; border-top: 2px solid #333; }
            .profit { color: #22c55e; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            .powered { margin-top: 8px; font-size: 11px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            ${imgBlock}
            <div class="slogan">${escapeHtml(titleText)}</div>
            <p style="margin: 4px 0;">${escapeHtml(receipt?.branch?.name || branchLabel)}</p>
            <p style="margin: 4px 0; font-size: 12px;">${escapeHtml(createdAtStr)}</p>
            <p style="margin: 4px 0; font-size: 12px;">${receiptNumLabel}${receipt?.id?.slice(-8) || ''}</p>
          </div>
          <div class="receipt-body">
            <table>
              <thead>
                <tr><th>${imeiLabel}</th><th>${deviceLabel}</th><th>${priceLabel}</th></tr>
              </thead>
              <tbody>
                ${(receipt?.saleItems || [])
                  .map(
                    (si: any) => `
                  <tr>
                    <td>${escapeHtml(String(si.imei || ''))}</td>
                    <td>—</td>
                    <td>${escapeHtml(lineMoney(Number(si.sellingPrice)))}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
            <p class="total-row">${totalLabel}: ${escapeHtml(lineMoney(receipt ? Number(receipt.totalAmount) : 0))}</p>
            <p class="profit">${profitLabel}: ${escapeHtml(lineMoney(receipt ? Number(receipt.profit) : 0))}</p>
          </div>
          <div class="footer">
            ${escapeHtml(thankYou)}
            <p class="powered">${escapeHtml(powered)}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <button type="button" className={className || 'btn btn-primary'} style={style} onClick={handlePrint}>
      <Printer size={18} /> {buttonLabel}
    </button>
  );
}
