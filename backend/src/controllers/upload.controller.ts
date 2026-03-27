import { Response } from 'express';
import path from 'path';
import { AuthRequest } from '../middlewares/auth.middleware';
import { prisma } from '../utils/prisma';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export const uploadController = {
  async upload(req: AuthRequest, res: Response) {
    try {
      const file = req.file as Express.Multer.File;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const relativePath = file.path.replace(UPLOAD_DIR, '').replace(/\\/g, '/');
      const entityType = (req.query.entityType as string) || req.body?.entityType || 'general';
      const entityId = (req.query.entityId as string) || req.body?.entityId || null;

      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });

      const record = await prisma.fileUpload.create({
        data: {
          companyId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: relativePath,
          entityType,
          entityId,
          uploadedBy: req.user?.userId
        }
      });

      res.json({
        ...record,
        url: `/uploads${relativePath}`,
        path: relativePath,
        filename: file.filename
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
