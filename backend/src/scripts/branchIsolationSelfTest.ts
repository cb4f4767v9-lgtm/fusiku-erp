import { applyBranchScope, enforceBranchWrite } from '../utils/branchScope';

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function assertThrows(fn: () => any, msg: string) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, msg);
}

function run() {
  const branchUser = { branchId: 'b1', branchRole: 'BRANCH_USER' as const, isSystemAdmin: false };
  const branchAdmin = { branchId: 'b1', branchRole: 'BRANCH_ADMIN' as const, isSystemAdmin: false };
  const superAdmin = { branchId: null as any, branchRole: 'SUPER_ADMIN' as const, isSystemAdmin: false };

  // 1) Branch user cannot query another branch
  assertThrows(() => applyBranchScope(branchUser, { branchId: 'b2' }), 'branch user cross-branch read must throw');

  // 2) Branch user query without branchId gets scoped
  const w1: any = applyBranchScope(branchUser, { status: 'available' } as any);
  assert(JSON.stringify(w1).includes('"branchId":"b1"'), 'branch user read must inject branchId');

  // 3) Branch admin same behavior
  assertThrows(() => enforceBranchWrite(branchAdmin, { branchId: 'b2' }), 'branch admin cross-branch write must throw');

  // 4) Super admin has no restriction
  const w2: any = applyBranchScope(superAdmin, { branchId: 'b2' } as any);
  assert(w2.branchId === 'b2', 'super admin should not be restricted');

  console.log('[branchIsolationSelfTest] OK');
}

run();

