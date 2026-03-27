import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { pdfService } from '../services/pdf.service';
import { prisma } from '../utils/prisma';

export const pdfController = {
  async saleReceipt(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user!.companyId;
      const sale = await prisma.sale.findFirst({
        where: { id: req.params.id, companyId },
        include: { saleItems: true, branch: true }
      });
      if (!sale) return res.status(404).json({ error: 'Sale not found' });
      const pdf = await pdfService.generateSaleReceipt(sale);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt-${sale.id.slice(-8)}.pdf`);
      res.send(pdf);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async purchaseInvoice(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user!.companyId;
      const purchase = await prisma.purchase.findFirst({
        where: { id: req.params.id, companyId },
        include: { purchaseItems: true, supplier: true, branch: true }
      });
      if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
      const pdf = await pdfService.generatePurchaseInvoice(purchase);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${purchase.id.slice(-8)}.pdf`);
      res.send(pdf);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async repairReceipt(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user!.companyId;
      const repair = await prisma.repair.findFirst({
        where: { id: req.params.id, companyId },
        include: { technician: true }
      });
      if (!repair) return res.status(404).json({ error: 'Repair not found' });
      const pdf = await pdfService.generateRepairReceipt(repair);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=repair-${repair.id.slice(-8)}.pdf`);
      res.send(pdf);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async transferDocument(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user!.companyId;
      const transfer = await prisma.transfer.findFirst({
        where: { id: req.params.id, companyId },
        include: { fromBranch: true, toBranch: true, createdBy: true, transferItems: { include: { inventory: true } } }
      });
      if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
      const pdf = await pdfService.generateTransferDocument(transfer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=transfer-${transfer.id.slice(-8)}.pdf`);
      res.send(pdf);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
