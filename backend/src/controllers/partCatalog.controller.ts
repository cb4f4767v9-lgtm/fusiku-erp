import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { partCatalogSuggestionService } from '../services/partCatalog/partCatalogSuggestion.service';
import { partCatalogTreeService } from '../services/partCatalog/partCatalogTree.service';
import { PartCatalogSuggestionSource } from '@prisma/client';

function requireCompany(req: AuthRequest, res: Response): string | null {
  const companyId = String(req.user?.companyId || '').trim();
  if (!companyId) {
    res.status(403).json({ error: 'Tenant context required (companyId)' });
    return null;
  }
  return companyId;
}

export const partCatalogController = {
  async tree(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const tree = await partCatalogTreeService.getTree(companyId);
      res.json({ success: true, data: tree });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to load catalog tree' });
    }
  },

  async listSuggestions(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const rows = await partCatalogSuggestionService.listPending(companyId);
      res.json({ success: true, data: rows });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to list suggestions' });
    }
  },

  async createSuggestion(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const sourceRaw = String(req.body?.source || 'USER').toUpperCase();
      const source =
        sourceRaw === 'IMPORT'
          ? PartCatalogSuggestionSource.IMPORT
          : sourceRaw === 'AI'
            ? PartCatalogSuggestionSource.AI
            : PartCatalogSuggestionSource.USER;
      const payload = req.body?.payload ?? req.body;
      const row = await partCatalogSuggestionService.createSuggestion({
        companyId,
        source,
        payload,
        submittedByUserId: String(req.user?.userId || '').trim() || undefined,
      });
      res.status(201).json({ success: true, data: row });
    } catch (e: any) {
      const msg = e?.issues ? JSON.stringify(e.issues) : e.message;
      res.status(400).json({ error: msg || 'Invalid suggestion payload' });
    }
  },

  async applySuggestion(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const id = String(req.params.id || '').trim();
      await partCatalogSuggestionService.apply({
        companyId,
        suggestionId: id,
        reviewerUserId: String(req.user?.userId || '').trim(),
      });
      res.json({ success: true });
    } catch (e: any) {
      const code = e.statusCode === 404 ? 404 : e.statusCode === 400 ? 400 : 500;
      res.status(code).json({ error: e.message || 'Apply failed' });
    }
  },

  async rejectSuggestion(req: AuthRequest, res: Response) {
    try {
      const companyId = requireCompany(req, res);
      if (!companyId) return;
      const id = String(req.params.id || '').trim();
      await partCatalogSuggestionService.reject({
        companyId,
        suggestionId: id,
        reviewerUserId: String(req.user?.userId || '').trim(),
        reviewNotes: req.body?.reviewNotes != null ? String(req.body.reviewNotes) : undefined,
      });
      res.json({ success: true });
    } catch (e: any) {
      const code = e.statusCode === 404 ? 404 : 500;
      res.status(code).json({ error: e.message || 'Reject failed' });
    }
  },
};
