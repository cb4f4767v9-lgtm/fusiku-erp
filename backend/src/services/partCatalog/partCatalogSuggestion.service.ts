import {
  PartCatalogQualityGrade,
  PartCatalogSuggestionSource,
  PartCatalogSuggestionStatus,
} from '@prisma/client';
import { prismaPlatform as prisma } from '../../utils/prismaPlatform';
import {
  normalizeCatalogSku,
  partCatalogSuggestionPayloadSchema,
  type PartCatalogSuggestionPayload,
} from './partCatalogPayload.schema';

/**
 * Parts catalog mutations:
 * - AI / assistants MUST call `createSuggestion` only — never `partCatalogItem.create` directly.
 * - Approved catalog rows are written exclusively via `applySuggestion` (transactional).
 */
export const partCatalogSuggestionService = {
  parsePayload(raw: unknown): PartCatalogSuggestionPayload {
    return partCatalogSuggestionPayloadSchema.parse(raw);
  },

  async createSuggestion(opts: {
    companyId: string;
    source: PartCatalogSuggestionSource;
    payload: unknown;
    submittedByUserId?: string | null;
  }) {
    const parsed = this.parsePayload(opts.payload);
    return prisma.partCatalogSuggestion.create({
      data: {
        companyId: opts.companyId,
        source: opts.source,
        status: PartCatalogSuggestionStatus.PENDING,
        payload: JSON.parse(JSON.stringify(parsed)) as object,
        submittedByUserId: opts.submittedByUserId ?? undefined,
      },
    });
  },

  async listPending(companyId: string, take = 50) {
    return prisma.partCatalogSuggestion.findMany({
      where: { companyId, status: PartCatalogSuggestionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        source: true,
        status: true,
        payload: true,
        submittedByUserId: true,
        createdAt: true,
      },
    });
  },

  async reject(opts: {
    companyId: string;
    suggestionId: string;
    reviewerUserId: string;
    reviewNotes?: string | null;
  }) {
    const s = await prisma.partCatalogSuggestion.findFirst({
      where: {
        id: opts.suggestionId,
        companyId: opts.companyId,
        status: PartCatalogSuggestionStatus.PENDING,
      },
    });
    if (!s) {
      const e: any = new Error('Suggestion not found or already handled');
      e.statusCode = 404;
      throw e;
    }
    return prisma.partCatalogSuggestion.update({
      where: { id: s.id },
      data: {
        status: PartCatalogSuggestionStatus.REJECTED,
        reviewerUserId: opts.reviewerUserId,
        reviewedAt: new Date(),
        reviewNotes: opts.reviewNotes ?? undefined,
      },
    });
  },

  async apply(opts: { companyId: string; suggestionId: string; reviewerUserId: string }) {
    const s = await prisma.partCatalogSuggestion.findFirst({
      where: {
        id: opts.suggestionId,
        companyId: opts.companyId,
        status: PartCatalogSuggestionStatus.PENDING,
      },
    });
    if (!s) {
      const e: any = new Error('Suggestion not found or already handled');
      e.statusCode = 404;
      throw e;
    }

    const data = partCatalogSuggestionPayloadSchema.parse(s.payload);

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const series = await tx.partCatalogSeries.upsert({
        where: {
          companyId_name: {
            companyId: opts.companyId,
            name: data.device.name.trim(),
          },
        },
        update: {
          phoneModelId: data.device.phoneModelId ?? null,
        },
        create: {
          companyId: opts.companyId,
          name: data.device.name.trim(),
          phoneModelId: data.device.phoneModelId ?? null,
          sortOrder: 0,
        },
      });

      let root = await tx.partCatalogCategory.findFirst({
        where: {
          seriesId: series.id,
          parentId: null,
          name: data.categoryName.trim(),
          band: data.taxonomyBand as any,
        },
      });
      if (!root) {
        root = await tx.partCatalogCategory.create({
          data: {
            seriesId: series.id,
            parentId: null,
            name: data.categoryName.trim(),
            band: data.taxonomyBand as any,
            allowsParts: false,
            sortOrder: 0,
          },
        });
      }

      let sub = await tx.partCatalogCategory.findFirst({
        where: {
          seriesId: series.id,
          parentId: root.id,
          name: data.subcategoryName.trim(),
        },
      });
      if (!sub) {
        sub = await tx.partCatalogCategory.create({
          data: {
            seriesId: series.id,
            parentId: root.id,
            name: data.subcategoryName.trim(),
            allowsParts: true,
            sortOrder: 0,
          },
        });
      }

      const hasChildren = await tx.partCatalogCategory.count({
        where: { parentId: sub.id },
      });
      if (hasChildren > 0) {
        const e: any = new Error(
          'Target subcategory has nested children — attach parts only to leaf subcategories.'
        );
        e.statusCode = 400;
        throw e;
      }

      const skuNorm = normalizeCatalogSku(data.part.sku);
      const grade =
        data.part.qualityGrade === 'ORIGINAL'
          ? PartCatalogQualityGrade.ORIGINAL
          : data.part.qualityGrade === 'COPY'
            ? PartCatalogQualityGrade.COPY
            : PartCatalogQualityGrade.OEM;

      let item = await tx.partCatalogItem.findFirst({
        where: {
          categoryId: sub.id,
          sku: skuNorm,
          qualityGrade: grade,
        },
      });

      if (!item) {
        item = await tx.partCatalogItem.create({
          data: {
            categoryId: sub.id,
            sku: skuNorm,
            qualityGrade: grade,
            name: data.part.name.trim(),
            description: data.part.description ?? null,
            oemPartNumber: data.part.oemPartNumber ?? null,
          },
        });
      }

      const variantIds = new Set<string>();
      for (const vid of data.part.compatiblePhoneVariantIds ?? []) {
        variantIds.add(vid);
      }
      const mids = data.part.compatiblePhoneModelIds ?? [];
      if (mids.length) {
        const vars = await tx.phoneVariant.findMany({
          where: { modelId: { in: mids } },
          select: { id: true },
        });
        for (const v of vars) variantIds.add(v.id);
      }

      if (variantIds.size === 0) {
        const e: any = new Error(
          'Add at least one compatible phone variant or model before approving — prevents orphan catalog lines.'
        );
        e.statusCode = 400;
        throw e;
      }

      const compatRows = [...variantIds].map((phoneVariantId) => ({
        partItemId: item!.id,
        phoneVariantId,
      }));

      await tx.partCatalogItemCompatibility.createMany({
        data: compatRows,
        skipDuplicates: true,
      });

      await tx.partCatalogSuggestion.update({
        where: { id: s.id },
        data: {
          status: PartCatalogSuggestionStatus.APPLIED,
          reviewerUserId: opts.reviewerUserId,
          reviewedAt: now,
          appliedAt: now,
        },
      });
    });

    return { ok: true };
  },
};
