import type { InstituteFeeCharge } from '../services/api';
import { instituteDec } from './instituteMoney';

export type InstituteLedgerRow = {
  id: string;
  at: string;
  kind: 'fee' | 'payment';
  description: string;
  debit: number;
  credit: number;
  running: number;
  currency: string;
};

/**
 * Chronological fee + payment ledger with running outstanding balance.
 * Outstanding increases on fee creation and decreases on each payment.
 */
export function buildInstituteFeeLedger(fees: InstituteFeeCharge[]): InstituteLedgerRow[] {
  type Ev = {
    sort: string;
    at: string;
    kind: 'fee' | 'payment';
    description: string;
    debit: number;
    credit: number;
    currency: string;
  };

  const events: Ev[] = [];

  for (const f of fees) {
    const cur = (f.currency || 'USD').toUpperCase();
    events.push({
      sort: `${f.createdAt}\t0\t${f.id}`,
      at: f.createdAt,
      kind: 'fee',
      description: f.label?.trim() || 'Fee',
      debit: instituteDec(f.amount),
      credit: 0,
      currency: cur,
    });
    for (const p of f.payments || []) {
      const amt = typeof p.amount === 'number' ? p.amount : Number.parseFloat(String(p.amount));
      const payAmt = Number.isFinite(amt) ? amt : 0;
      events.push({
        sort: `${p.paidAt}\t1\t${p.id}`,
        at: p.paidAt,
        kind: 'payment',
        description: p.reference?.trim() || `${p.method || 'payment'}`,
        debit: 0,
        credit: payAmt,
        currency: (p.currency || cur).toUpperCase(),
      });
    }
  }

  events.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));

  let running = 0;
  return events.map((e) => {
    running = running + e.debit - e.credit;
    return {
      id: e.sort,
      at: e.at,
      kind: e.kind,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      running,
      currency: e.currency,
    };
  });
}
