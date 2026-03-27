import { prisma } from '../utils/prisma';

export const exchangeRateService = {
  async getAll() {
    return prisma.exchangeRate.findMany({
      orderBy: { effectiveFrom: 'desc' }
    });
  },

  async getCurrent(currency: string) {
    const now = new Date();
    return prisma.exchangeRate.findFirst({
      where: {
        currency,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
      },
      orderBy: { effectiveFrom: 'desc' }
    });
  },

  async create(data: { currency: string; rate: number; effectiveFrom: Date; effectiveTo?: Date }) {
    return prisma.exchangeRate.create({
      data: {
        ...data,
        rate: data.rate
      }
    });
  }
};
