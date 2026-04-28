import PDFDocument from 'pdfkit';
import { saleDocumentLogoPath } from '../utils/uploadPath';

export const pdfService = {
  async generateSaleReceipt(sale: any): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const buffer = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const logoPath = saleDocumentLogoPath(sale);
    const titleName = (sale?.company?.name || sale?.branch?.name || 'FUSIKU') as string;
    if (logoPath) {
      try {
        const w = 120;
        const x = (doc.page.width - w) / 2;
        doc.image(logoPath, x, doc.y, { width: w });
        doc.moveDown(3.2);
      } catch {
        doc.fontSize(22).text(titleName, { align: 'center' });
        doc.moveDown(0.3);
      }
    } else {
      doc.fontSize(22).text(titleName, { align: 'center' });
      doc.moveDown(0.3);
    }
    doc.fillColor('black');
    doc.moveDown(0.5);
    doc.fontSize(14).text('SALE RECEIPT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Receipt #${sale?.id?.slice(-8) || ''}`);
    doc.text(`Date: ${sale ? new Date(sale.createdAt).toLocaleString() : ''}`);
    doc.text(`Branch: ${sale?.branch?.name || ''}`);
    doc.moveDown();
    doc.text('Items:');
    (sale?.saleItems || []).forEach((si: any) => {
      doc.text(`  IMEI: ${si.imei} - $${Number(si.sellingPrice).toFixed(2)}`);
    });
    doc.moveDown();
    doc.fontSize(12).text(`Total: $${sale ? Number(sale.totalAmount).toFixed(2) : '0.00'}`);
    doc.text(`Profit: $${sale ? Number(sale.profit).toFixed(2) : '0.00'}`);
    doc.moveDown(1.2);
    doc.fontSize(8).fillColor('#666').text('Powered by Fusiku', { align: 'center' });
    doc.end();
    return buffer;
  },

  async generatePurchaseInvoice(purchase: any): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const buffer = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(24).text('FUSIKU', { align: 'center' });
    doc.fontSize(10).text('Think Smart. Play Cool.', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('PURCHASE INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Invoice #${purchase?.id?.slice(-8) || ''}`);
    doc.text(`Date: ${purchase ? new Date(purchase.createdAt).toLocaleString() : ''}`);
    doc.text(`Supplier: ${purchase?.supplier?.name || ''}`);
    doc.text(`Branch: ${purchase?.branch?.name || ''}`);
    doc.moveDown();
    doc.text('Items:');
    (purchase?.purchaseItems || []).forEach((pi: any) => {
      doc.text(`  ${pi.imei} - ${pi.brand} ${pi.model} - $${Number(pi.price).toFixed(2)}`);
    });
    doc.moveDown();
    doc.fontSize(12).text(`Total: $${purchase ? Number(purchase.totalAmount).toFixed(2) : '0.00'}`);
    doc.end();
    return buffer;
  },

  async generateRepairReceipt(repair: any): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const buffer = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(24).text('FUSIKU', { align: 'center' });
    doc.fontSize(10).text('Think Smart. Play Cool.', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('REPAIR RECEIPT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`IMEI: ${repair?.imei || ''}`);
    doc.text(`Fault: ${repair?.faultDescription || ''}`);
    doc.text(`Technician: ${repair?.technician?.name || ''}`);
    doc.text(`Date: ${repair ? new Date(repair.createdAt).toLocaleString() : ''}`);
    doc.moveDown();
    doc.fontSize(12).text(`Repair Cost: $${repair ? Number(repair.repairCost).toFixed(2) : '0.00'}`);
    doc.end();
    return buffer;
  },

  async generateTransferDocument(transfer: any): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const buffer = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(24).text('FUSIKU', { align: 'center' });
    doc.fontSize(10).text('Think Smart. Play Cool.', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('TRANSFER DOCUMENT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Transfer #${transfer?.id?.slice(-8) || ''}`);
    doc.text(`From: ${transfer?.fromBranch?.name || ''}`);
    doc.text(`To: ${transfer?.toBranch?.name || ''}`);
    doc.text(`Created by: ${transfer?.createdBy?.name || ''}`);
    doc.text(`Date: ${transfer ? new Date(transfer.createdAt).toLocaleString() : ''}`);
    doc.moveDown();
    doc.text('Items:');
    (transfer?.transferItems || []).forEach((ti: any) => {
      doc.text(`  IMEI: ${ti.inventory?.imei || ''} - ${ti.inventory?.brand || ''} ${ti.inventory?.model || ''}`);
    });
    doc.end();
    return buffer;
  }
};
