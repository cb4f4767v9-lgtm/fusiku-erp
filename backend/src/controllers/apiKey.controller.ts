/**
 * API Key management controller - Developer Settings
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { apiKeyService } from '../services/apiKey.service';

export const apiKeyController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });
      const { name, permissions } = req.body;
      if (!name || !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'name and permissions required' });
      }
      const result = await apiKeyService.generateKey(companyId, name, permissions);
      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });
      const keys = await apiKeyService.list(companyId);
      res.json(keys);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async revoke(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });
      const ok = await apiKeyService.revoke(req.params.id, companyId);
      if (!ok) return res.status(404).json({ error: 'Key not found' });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async updatePermissions(req: AuthRequest, res: Response) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) return res.status(403).json({ error: 'Company context required' });
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions array required' });
      await apiKeyService.updatePermissions(req.params.id, companyId, permissions);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
