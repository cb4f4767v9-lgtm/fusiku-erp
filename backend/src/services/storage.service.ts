/**
 * Storage service abstraction - ready for cloud providers (AWS S3, etc.)
 * Currently uses local filesystem. Replace implementation for S3/cloud.
 */
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

export interface StorageResult {
  path: string;
  url: string;
  key: string;
}

export const storageService = {
  async save(
    buffer: Buffer,
    key: string,
    options?: { contentType?: string; metadata?: Record<string, string> }
  ): Promise<StorageResult> {
    const fullPath = path.join(UPLOAD_DIR, key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, buffer);
    const url = `/uploads/${key.replace(/\\/g, '/')}`;
    return { path: fullPath, url, key };
  },

  async get(key: string): Promise<Buffer | null> {
    const fullPath = path.join(UPLOAD_DIR, key);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath);
  },

  async delete(key: string): Promise<boolean> {
    const fullPath = path.join(UPLOAD_DIR, key);
    if (!fs.existsSync(fullPath)) return false;
    fs.unlinkSync(fullPath);
    return true;
  },

  getUrl(key: string): string {
    return `/uploads/${key.replace(/\\/g, '/')}`;
  }
};
