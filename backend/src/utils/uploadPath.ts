import fs from 'fs';
import path from 'path';

/** Resolves a stored public path like `/uploads/branding/uuid.png` to an on-disk file. */
export function resolveUploadDiskPath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl || publicUrl.startsWith('http')) return null;
  const normalized = publicUrl.replace(/\\/g, '/');
  const m = normalized.match(/\/uploads\/(.+)$/);
  if (!m) return null;
  const full = path.join(process.cwd(), 'uploads', m[1]);
  return fs.existsSync(full) ? full : null;
}

/** For sale PDFs: branch logo first, then company logo. */
export function saleDocumentLogoPath(sale: { branch?: { logo?: string | null }; company?: { logo?: string | null } }): string | null {
  const b = resolveUploadDiskPath(sale?.branch?.logo ?? undefined);
  if (b) return b;
  return resolveUploadDiskPath(sale?.company?.logo ?? undefined);
}
