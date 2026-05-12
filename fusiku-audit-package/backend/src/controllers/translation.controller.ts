import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { translationService } from '../services/translation.service';

export const translationController = {
  async list(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Company context required' });
    const rows = await translationService.list(companyId, {
      languageCode: String(req.query.languageCode || '').trim() || undefined,
      search: String(req.query.search || '').trim() || undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    return res.json(rows);
  },

  async upsert(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Company context required' });
    const row = await translationService.upsert(companyId, req.body || {});
    return res.json(row);
  },

  async verify(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Company context required' });
    const row = await translationService.setVerified(companyId, req.body || {});
    return res.json(row);
  },

  async importBulk(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Company context required' });
    const out = await translationService.importBulk(companyId, req.body || {});
    return res.json(out);
  },

  async missing(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Company context required' });
    const lang = String(req.params.languageCode || '').trim();
    const keys = await translationService.findMissing(companyId, { targetLanguageCode: lang });
    return res.json({ languageCode: lang, missingKeys: keys, count: keys.length });
  },

  async autoFill(req: AuthRequest, res: Response) {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(403).json({ error: 'Company context required' });
    const out = await translationService.autoFillMissing(companyId, req.body || {});
    return res.json(out);
  },
};

