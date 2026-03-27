/**
 * API Key management service
 * Phase 10 - Platform API & Extension Ecosystem
 */
import { prisma } from '../utils/prisma';
import crypto from 'crypto';

const KEY_PREFIX = 'fusiku_';
const KEY_LENGTH = 32;

export const apiKeyService = {
  async generateKey(companyId: string, name: string, permissions: string[]): Promise<{ id: string; key: string; name: string }> {
    const rawKey = crypto.randomBytes(KEY_LENGTH).toString('hex');
    const key = `${KEY_PREFIX}${rawKey}`;
    const created = await prisma.apiKey.create({
      data: { companyId, name, key, permissions: JSON.stringify(permissions) }
    });
    return { id: created.id, key, name: created.name };
  },

  async list(companyId: string) {
    const rows = await prisma.apiKey.findMany({
      where: { companyId },
      select: { id: true, name: true, permissions: true, lastUsedAt: true, createdAt: true }
    });
    return rows.map((k) => ({
      ...k,
      permissions: (() => {
        try {
          return typeof k.permissions === 'string' ? JSON.parse(k.permissions) : [];
        } catch {
          return [];
        }
      })()
    }));
  },

  async revoke(id: string, companyId: string) {
    const deleted = await prisma.apiKey.deleteMany({
      where: { id, companyId }
    });
    return deleted.count > 0;
  },

  async updatePermissions(id: string, companyId: string, permissions: string[]) {
    return prisma.apiKey.updateMany({
      where: { id, companyId },
      data: { permissions: JSON.stringify(permissions) }
    });
  }
};
