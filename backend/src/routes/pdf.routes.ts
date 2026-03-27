import { Router } from 'express';
import { pdfController } from '../controllers/pdf.controller';

const router = Router();

router.get('/sale/:id', pdfController.saleReceipt);
router.get('/purchase/:id', pdfController.purchaseInvoice);
router.get('/repair/:id', pdfController.repairReceipt);
router.get('/transfer/:id', pdfController.transferDocument);

export const pdfRoutes = router;
