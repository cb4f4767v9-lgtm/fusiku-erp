import type { SmartInsight } from './aiBusiness.types';

type Memory = {
  questions: Array<{ at: string; question: string }>;
  lastInsights: Array<{ at: string; insights: SmartInsight[] }>;
};

const byCompany = new Map<string, Memory>();

function getMem(companyId: string): Memory {
  const key = String(companyId);
  const cur = byCompany.get(key);
  if (cur) return cur;
  const m: Memory = { questions: [], lastInsights: [] };
  byCompany.set(key, m);
  return m;
}

function cap<T>(xs: T[], n: number) {
  if (xs.length <= n) return xs;
  return xs.slice(xs.length - n);
}

export const aiMemory = {
  addQuestion(companyId: string, question: string) {
    const mem = getMem(companyId);
    mem.questions.push({ at: new Date().toISOString(), question: String(question || '').slice(0, 600) });
    mem.questions = cap(mem.questions, 20);
  },

  addInsights(companyId: string, insights: SmartInsight[]) {
    const mem = getMem(companyId);
    mem.lastInsights.push({ at: new Date().toISOString(), insights });
    mem.lastInsights = cap(mem.lastInsights, 20);
  },

  get(companyId: string) {
    return getMem(companyId);
  },
};

