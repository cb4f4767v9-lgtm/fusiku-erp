import { Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../middlewares/auth.middleware';
import { importService } from '../services/import.service';

const upload = multer({ storage: multer.memoryStorage() });

export const importController = {
  upload,

  async importInventory(req: AuthRequest, res: Response) {
    try {
      const file = req.file;
      const { branchId } = req.body;

      if (!file || !branchId) {
        return res.status(400).json({ error: 'File and branchId required' });
      }

      const result = await importService.importInventory(file.buffer, branchId);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Import failed' });
    }
  },

  async importSuppliers(req: AuthRequest, res: Response) {
    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'File required' });
      }

      const result = await importService.importSuppliers(file.buffer);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Import failed' });
    }
  },

  async importPurchases(req: AuthRequest, res: Response) {
    try {
      const file = req.file;
      const { branchId, supplierId } = req.body;

      if (!file || !branchId || !supplierId) {
        return res.status(400).json({ error: 'File, branchId and supplierId required' });
      }

      const result = await importService.importPurchases(
        file.buffer,
        branchId,
        supplierId
      );

      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Import failed' });
    }
  }
};
