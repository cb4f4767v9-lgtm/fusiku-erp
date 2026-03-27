/**
 * Public API controller - external integrations
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { Response } from 'express';
import { ApiKeyRequest } from '../middlewares/apiKey.middleware';
import { prisma } from '../utils/prisma';
import { inventoryService } from '../services/inventory.service';
import { posService } from '../services/pos.service';
import { reportService } from '../services/report.service';
import { integrationLogService } from '../services/integrationLog.service';

export const publicApiController = {
  async getInventory(req: ApiKeyRequest, res: Response) {
    try {
      const companyId = req.apiKey?.companyId;
      if (!companyId) return res.status(401).json({ error: 'Unauthorized' });
      const items = await inventoryService.getAll({
        companyId,
        ...(req.query as any)
      });
      const sanitized = items.map((i: any) => ({
        id: i.id,
        imei: i.imei,
        brand: i.brand,
        model: i.model,
        storage: i.storage,
        color: i.color,
        condition: i.condition,
        purchasePrice: Number(i.purchasePrice),
        sellingPrice: Number(i.sellingPrice),
        status: i.status,
        branchId: i.branchId,
        createdAt: i.createdAt
      }));
      res.json({ data: sanitized });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async getDevices(req: ApiKeyRequest, res: Response) {
    try {
      const companyId = req.apiKey?.companyId;
      if (!companyId) return res.status(401).json({ error: 'Unauthorized' });
      const items = await inventoryService.getAll({
        companyId,
        status: 'available',
        ...(req.query as any)
      });
      const sanitized = items.map((i: any) => ({
        imei: i.imei,
        brand: i.brand,
        model: i.model,
        storage: i.storage,
        color: i.color,
        condition: i.condition,
        sellingPrice: Number(i.sellingPrice)
      }));
      res.json({ data: sanitized });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },

  async createSale(req: ApiKeyRequest, res: Response) {
    try {
      const companyId = req.apiKey?.companyId;
      if (!companyId) return res.status(401).json({ error: 'Unauthorized' });
      const branch = await prisma.branch.findFirst({ where: { companyId } });
      if (!branch) return res.status(400).json({ error: 'No branch found for company' });
      const sale = await posService.createSale({
        ...req.body,
        branchId: req.body.branchId || branch.id,
        customerId: req.body.customerId,
        items: req.body.items,
        userId: undefined
      });
      await integrationLogService.log({
        companyId,
        integrationType: 'api',
        requestPayload: { action: 'create_sale', saleId: (sale as any).id },
        responseStatus: 201
      });
      res.status(201).json({ data: sale });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  },

  async getReports(req: ApiKeyRequest, res: Response) {
    try {
      const companyId = req.apiKey?.companyId;
      if (!companyId) return res.status(401).json({ error: 'Unauthorized' });
      const branchId = req.query.branchId as string;
      const dashboard = await reportService.getDashboard(branchId, companyId);
      res.json({ data: dashboard });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
};
