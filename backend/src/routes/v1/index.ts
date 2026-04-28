import { Router, type RequestHandler } from 'express';

import { userRoutes } from '../user.routes';
import { branchRoutes } from '../branch.routes';
import { inventoryRoutes } from '../inventory.routes';
import { masterDataRoutes } from '../masterData.routes';
import { imeiRoutes } from '../imei.routes';
import { supplierRoutes } from '../supplier.routes';
import { purchaseRoutes } from '../purchase.routes';
import { posRoutes } from '../pos.routes';
import { repairRoutes } from '../repair.routes';
import { refurbishRoutes } from '../refurbish.routes';
import { exchangeRateRoutes } from '../exchangeRate.routes';
import { currencyRoutes } from '../currency.routes';
import { reportRoutes } from '../report.routes';
import { importRoutes } from '../import.routes';
import { auditRoutes } from '../audit.routes';
import { roleRoutes } from '../role.routes';
import { permissionRoutes } from '../permission.routes';
import { transferRoutes } from '../transfer.routes';
import { phoneDatabaseRoutes } from '../phoneDatabase.routes';
import { deviceGradeRoutes } from '../deviceGrade.routes';
import { aiRoutes } from '../ai.routes';
import { deviceSpecsRoutes } from '../deviceSpecs.routes';
import { uploadRoutes } from '../upload.routes';
import { stockMovementRoutes } from '../stockMovement.routes';
import { stockAlertRoutes } from '../stockAlert.routes';
import { logsRoutes } from '../logs.routes';
import { pdfRoutes } from '../pdf.routes';
import { warrantyRoutes } from '../warranty.routes';
import { customerRoutes } from '../customer.routes';
import { activityLogRoutes } from '../activityLog.routes';
import { companyRoutes } from '../company.routes';
import { systemRoutes } from '../system.routes';
import { adminRoutes } from '../admin.routes';
import { setupRoutes } from '../setup.routes';
import { apiKeyRoutes } from '../apiKey.routes';
import { webhookRoutes } from '../webhook.routes';
import { integrationLogRoutes } from '../integrationLog.routes';
import { locationRoutes } from '../location.routes';
import { syncRoutes } from '../sync.routes';
import { dashboardRoutes } from '../dashboard.routes';
import { expenseRoutes } from '../expense.routes';
import { investorRoutes } from '../investor.routes';
import { signupRoutes } from '../signup.routes';
import { signupRateLimiter } from '../../middlewares/signupRateLimit.middleware';
import { planRoutes } from '../plan.routes';
import { invoiceRoutes } from '../invoice.routes';
import { salesOrderRoutes } from '../salesOrder.routes';
import { translationRoutes } from '../translation.routes';
import { analyticsRoutes } from '../analytics.routes';
import { billingRoutes } from '../billing.routes';
import { inviteRoutes } from '../invite.routes';
import { inviteController } from '../../controllers/invite.controller';

import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantGuard } from '../../middlewares/tenantGuard.middleware';
import { saasEnforcementMiddleware } from '../../middlewares/saasEnforcement.middleware';
import { usageTrackingMiddleware } from '../../middlewares/usageTracking.middleware';
import { requireSystemDiagnosticsRole } from '../../middlewares/systemDiagnostics.middleware';

const v1Router = Router();

/**
 * Standard protected chain for `/api/v1/*`:
 * 1. `authMiddleware` — verify JWT, bind tenant ALS (`userId`, `companyId`, `branchId`, …).
 * 2. `tenantGuard` — require `companyId` unless system admin. **Does not require `branchId`.**
 *    Dashboard (`/dashboard`, `/reports/dashboard`, …) stays branch-optional; controllers use
 *    `assertBranchQueryAllowed` for query-branch rules.
 * 3. `saasEnforcementMiddleware` — subscription/plan gate (placeholder until enforced).
 */
const tenantAuth: RequestHandler[] = [authMiddleware, tenantGuard, saasEnforcementMiddleware];
const tenantAuthWithUsage: RequestHandler[] = [
  authMiddleware,
  tenantGuard,
  usageTrackingMiddleware,
  saasEnforcementMiddleware,
];

// ================= PUBLIC ROUTES =================
v1Router.use('/setup', setupRoutes);
v1Router.use('/plans', planRoutes);
v1Router.use('/signup', signupRateLimiter, signupRoutes);

// ================= PROTECTED ROUTES =================
v1Router.use('/billing', ...tenantAuth, billingRoutes);
// Public: accept invite (registration flow)
v1Router.post('/invites/accept', inviteController.accept);
// Protected: create invites (tenant + saas enforced)
v1Router.use('/invites', ...tenantAuth, inviteRoutes);
v1Router.use('/roles', ...tenantAuth, roleRoutes);
v1Router.use('/permissions', ...tenantAuth, permissionRoutes);
v1Router.use('/users', ...tenantAuth, userRoutes);
v1Router.use('/branches', ...tenantAuth, branchRoutes);
v1Router.use('/inventory', ...tenantAuth, inventoryRoutes);
v1Router.use('/master-data', ...tenantAuth, masterDataRoutes);
v1Router.use('/imei', ...tenantAuth, imeiRoutes);
v1Router.use('/suppliers', ...tenantAuth, supplierRoutes);
v1Router.use('/purchases', ...tenantAuth, purchaseRoutes);
v1Router.use('/pos', ...tenantAuth, posRoutes);
v1Router.use('/sales-orders', ...tenantAuth, salesOrderRoutes);
v1Router.use('/invoices', ...tenantAuth, invoiceRoutes);
v1Router.use('/repairs', ...tenantAuth, repairRoutes);
v1Router.use('/refurbish', ...tenantAuth, refurbishRoutes);
v1Router.use('/transfers', ...tenantAuth, transferRoutes);
v1Router.use('/phone-database', ...tenantAuth, phoneDatabaseRoutes);
v1Router.use('/device-grades', ...tenantAuth, deviceGradeRoutes);
v1Router.use('/ai', ...tenantAuthWithUsage, aiRoutes);
v1Router.use('/device-specs', ...tenantAuth, deviceSpecsRoutes);
v1Router.use('/exchange-rates', ...tenantAuth, exchangeRateRoutes);
v1Router.use('/currencies', ...tenantAuth, currencyRoutes);
v1Router.use('/dashboard', ...tenantAuth, dashboardRoutes);
v1Router.use('/expenses', ...tenantAuth, expenseRoutes);
v1Router.use('/investors', ...tenantAuth, investorRoutes);
v1Router.use('/reports', ...tenantAuth, reportRoutes);
v1Router.use('/analytics', ...tenantAuth, analyticsRoutes);
v1Router.use('/import', ...tenantAuth, importRoutes);
v1Router.use('/audit', ...tenantAuth, auditRoutes);
v1Router.use('/stock-movements', ...tenantAuth, stockMovementRoutes);
v1Router.use('/stock-alerts', ...tenantAuth, stockAlertRoutes);
v1Router.use('/logs', ...tenantAuth, logsRoutes);
v1Router.use('/upload', ...tenantAuth, uploadRoutes);
v1Router.use('/pdf', ...tenantAuth, pdfRoutes);
v1Router.use('/warranty', ...tenantAuth, warrantyRoutes);
v1Router.use('/customers', ...tenantAuth, customerRoutes);
v1Router.use('/activity', ...tenantAuth, activityLogRoutes);
v1Router.use('/api-keys', ...tenantAuth, apiKeyRoutes);
v1Router.use('/webhooks', ...tenantAuth, webhookRoutes);
v1Router.use('/integration-logs', ...tenantAuth, integrationLogRoutes);
v1Router.use('/locations', ...tenantAuth, locationRoutes);
v1Router.use('/sync', ...tenantAuth, syncRoutes);
v1Router.use('/company', ...tenantAuth, companyRoutes);
v1Router.use('/translations', ...tenantAuth, translationRoutes);

// System (extra secure)
v1Router.use(
  '/system',
  authMiddleware,
  tenantGuard,
  saasEnforcementMiddleware,
  requireSystemDiagnosticsRole,
  systemRoutes
);

// Admin
v1Router.use('/admin', ...tenantAuth, adminRoutes);

export { v1Router };