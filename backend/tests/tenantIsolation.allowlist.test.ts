import fs from 'node:fs';
import path from 'node:path';
import { TENANT_MODELS, BRANCH_SCOPED_MODELS } from '../src/infrastructure/db/tenantModels';

function readSchema(): string {
  const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
  return fs.readFileSync(schemaPath, 'utf8');
}

function getModelsWithCompanyId(schema: string): string[] {
  // Very small parser: split on `model <Name> { ... }` blocks.
  // We treat a model as tenant-owned if it declares a `companyId` scalar field (required or optional).
  const modelBlockRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = modelBlockRegex.exec(schema))) {
    const modelName = match[1];
    const block = match[2];
    if (/(^|\n)\s*companyId\s+String\b/.test(block)) out.push(modelName);
  }
  return out.sort();
}

describe('tenant isolation allowlists', () => {
  it('includes every Prisma model that has a companyId field', () => {
    const schema = readSchema();
    const modelsWithCompanyId = getModelsWithCompanyId(schema);
    const allowlist = [...TENANT_MODELS].sort();

    const missing = modelsWithCompanyId.filter((m) => !TENANT_MODELS.has(m));
    const extra = allowlist.filter((m) => !modelsWithCompanyId.includes(m));

    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it('branch-scoped allowlist is a subset of tenant-scoped allowlist', () => {
    const missingFromTenant = [...BRANCH_SCOPED_MODELS].filter((m) => !TENANT_MODELS.has(m));
    expect(missingFromTenant).toEqual([]);
  });
});

