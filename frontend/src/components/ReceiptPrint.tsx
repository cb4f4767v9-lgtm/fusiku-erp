import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ReceiptPrintProps {
  receipt: any;
  storeName?: string;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}

export function ReceiptPrint({ receipt, storeName, className, label, style }: ReceiptPrintProps) {
  const { t } = useTranslation();
  const brandName = storeName ?? t('brand.name');
  const buttonLabel = label ?? t('receipt.printReceipt');
  const slogan = t('brand.slogan');

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
    const thankYou = t('receipt.thankYou');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${receipt?.id?.slice(-8) || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            .logo { font-size: 24px; font-weight: bold; color: #38bdf8; margin-bottom: 4px; }
            .slogan { font-size: 12px; color: #666; margin-bottom: 16px; }
            .receipt-header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 12px; margin-bottom: 12px; }
            .receipt-body { margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 6px 0; text-align: left; }
            th { border-bottom: 1px solid #eee; }
            .total-row { font-weight: bold; font-size: 18px; margin-top: 12px; padding-top: 12px; border-top: 2px solid #333; }
            .profit { color: #22c55e; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="logo">${brandName}</div>
            <div class="slogan">${slogan}</div>
            <p style="margin: 4px 0;">${receipt?.branch?.name || branchLabel}</p>
            <p style="margin: 4px 0; font-size: 12px;">${receipt ? new Date(receipt.createdAt).toLocaleString() : ''}</p>
            <p style="margin: 4px 0; font-size: 12px;">${receiptNumLabel}${receipt?.id?.slice(-8) || ''}</p>
          </div>
          <div class="receipt-body">
            <table>
              <thead>
                <tr><th>${imeiLabel}</th><th>${deviceLabel}</th><th>${priceLabel}</th></tr>
              </thead>
              <tbody>
                ${(receipt?.saleItems || []).map((si: any) => `
                  <tr>
                    <td>${si.imei}</td>
                    <td>—</td>
                    <td>$${Number(si.sellingPrice).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <p class="total-row">${totalLabel}: $${receipt ? Number(receipt.totalAmount).toFixed(2) : '0.00'}</p>
            <p class="profit">${profitLabel}: $${receipt ? Number(receipt.profit).toFixed(2) : '0.00'}</p>
          </div>
          <div class="footer">
            ${thankYou}
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
    <button className={className || 'btn btn-primary'} style={style} onClick={handlePrint}>
      <Printer size={18} /> {buttonLabel}
    </button>
  );
}
