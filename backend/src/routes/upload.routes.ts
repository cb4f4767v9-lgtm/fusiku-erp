import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { uploadController } from '../controllers/upload.controller';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = (req.query.type as string) || 'general';
    const dir = path.join(UPLOAD_DIR, type);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadQr = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }
});

const router = Router();

router.post('/', upload.single('file'), uploadController.upload);

// QR image upload - saves to uploads/qr, max 2MB, PNG/JPG/WEBP
router.post('/qr', (req, res, next) => {
  req.query.type = 'qr';
  uploadQr.single('file')(req, res, next);
}, uploadController.upload);

export const uploadRoutes = router;
