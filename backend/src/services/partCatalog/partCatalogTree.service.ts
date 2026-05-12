import { prismaPlatform as prisma } from '../../utils/prismaPlatform';

function nestCategories<T extends { id: string; parentId: string | null }>(flat: T[]): (T & { children: any[] })[] {
  const nodes = new Map<string, T & { children: any[] }>();
  for (const c of flat) {
    nodes.set(c.id, { ...c, children: [] });
  }
  const roots: (T & { children: any[] })[] = [];
  for (const c of flat) {
    const n = nodes.get(c.id)!;
    if (!c.parentId) roots.push(n);
    else nodes.get(c.parentId)?.children.push(n);
  }
  return roots;
}

export const partCatalogTreeService = {
  async getTree(companyId: string) {
    const seriesList = await prisma.partCatalogSeries.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        phoneModel: {
          select: {
            id: true,
            name: true,
            brand: { select: { name: true } },
          },
        },
        categories: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            parts: {
              orderBy: [{ sku: 'asc' }],
              include: {
                compatibilities: {
                  include: {
                    phoneVariant: {
                      select: {
                        id: true,
                        storage: true,
                        color: true,
                        model: {
                          select: {
                            id: true,
                            name: true,
                            brand: { select: { name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return seriesList.map((s) => ({
      ...s,
      categoryTree: nestCategories(s.categories),
    }));
  },
};
