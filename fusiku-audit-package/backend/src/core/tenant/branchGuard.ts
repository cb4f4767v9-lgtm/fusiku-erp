/** Re-export canonical branch rules from `core/auth` (legacy import path). */
export { applyBranchScope, enforceBranchWrite } from '../../utils/branchScope';
export { requireBranchContext, tenantGuard } from '../../middlewares/tenantGuard.middleware';
export { assertBranchQueryAllowed, assertRequestedBranchMatchesUser, isHeadOfficeUser } from '../auth/branchGuard';
