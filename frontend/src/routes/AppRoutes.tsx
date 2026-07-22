import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { useAuth } from '../hooks/useAuth';

import { Layout } from '../layouts/Layout';
import { SearchProvider } from '../contexts/SearchContext';
import { HybridSyncProvider } from '../contexts/HybridSyncContext';

import { canAccessModule } from '../utils/permissions';
import { PageRouteFallback } from '../shared/components/PageRouteFallback';
import { LoadingSkeleton } from '../components/design-system/LoadingSkeleton';
import { companyApi } from '../services/api';
import { useEffect, useState } from 'react';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const SignupPage = lazy(() => import('../pages/SignupPage'));
const SignupVerifyPage = lazy(() => import('../pages/SignupVerifyPage'));
const TutorialPage = lazy(() => import('../pages/TutorialPage'));
const SetupWizardPage = lazy(() => import('../pages/SetupWizardPage'));
const PricingPage = lazy(() => import('../pages/PricingPage'));
const ForgotPasswordPage = lazy(() =>
  import('../pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('../pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const InventoryPage = lazy(() =>
  import('../pages/InventoryPage').then((m) => ({ default: m.InventoryPage }))
);
const PurchasesPage = lazy(() =>
  import('../pages/PurchasesPage').then((m) => ({ default: m.PurchasesPage }))
);
const WholesaleSalesPage = lazy(() =>
  import('../pages/WholesaleSalesPage').then((m) => ({ default: m.WholesaleSalesPage }))
);
const QuotationsPage = lazy(() =>
  import('../pages/QuotationsPage').then((m) => ({ default: m.QuotationsPage }))
);
const NewPurchasePage = lazy(() =>
  import('../pages/purchases/NewPurchasePage').then((m) => ({ default: m.default }))
);
const POSPage = lazy(() => import('../pages/POSPage').then((m) => ({ default: m.POSPage })));
const SuppliersPage = lazy(() =>
  import('../pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage }))
);
const SupplierFormPage = lazy(() =>
  import('../pages/SupplierFormPage').then((m) => ({ default: m.SupplierFormPage }))
);
const SupplierDetailPage = lazy(() =>
  import('../pages/SupplierDetailPage').then((m) => ({ default: m.SupplierDetailPage }))
);
const TransfersPage = lazy(() =>
  import('../pages/TransfersPage').then((m) => ({ default: m.TransfersPage }))
);
const RepairsPage = lazy(() =>
  import('../pages/RepairsPage').then((m) => ({ default: m.RepairsPage }))
);
const RefurbishingPage = lazy(() =>
  import('../pages/RefurbishingPage').then((m) => ({ default: m.RefurbishingPage }))
);
const InventoryHistoryPage = lazy(() =>
  import('../pages/InventoryHistoryPage').then((m) => ({ default: m.InventoryHistoryPage }))
);
const AIBusinessIntelligencePage = lazy(() =>
  import('../pages/AIBusinessIntelligencePage').then((m) => ({ default: m.AIBusinessIntelligencePage }))
);
const AiAssistantPage = lazy(() =>
  import('../pages/AiAssistantPage').then((m) => ({ default: m.default }))
);
const ExpensesPage = lazy(() =>
  import('../pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage }))
);
const ReportsPage = lazy(() =>
  import('../pages/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
const CurrencyPage = lazy(() =>
  import('../pages/CurrencyPage').then((m) => ({ default: m.default }))
);
const CustomersPage = lazy(() =>
  import('../pages/CustomersPage').then((m) => ({ default: m.CustomersPage }))
);
const CustomerFormPage = lazy(() =>
  import('../pages/CustomerFormPage').then((m) => ({ default: m.CustomerFormPage }))
);
const PlansPage = lazy(() => import('../pages/PlansPage'));
const BranchesPage = lazy(() =>
  import('../pages/BranchesPage').then((m) => ({ default: m.BranchesPage }))
);
const BranchFormPage = lazy(() =>
  import('../pages/BranchFormPage').then((m) => ({ default: m.BranchFormPage }))
);
const MasterDataUnifiedPage = lazy(() =>
  import('../pages/master-data/MasterDataUnifiedPage').then((m) => ({ default: m.MasterDataUnifiedPage }))
);
const UsersRolesPage = lazy(() =>
  import('../pages/UsersRolesPage').then((m) => ({ default: m.UsersRolesPage }))
);
const CompanySettingsPage = lazy(() =>
  import('../pages/CompanySettingsPage').then((m) => ({ default: m.CompanySettingsPage }))
);
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const MonitoringPage = lazy(() =>
  import('../pages/MonitoringPage').then((m) => ({ default: m.MonitoringPage }))
);
const SystemActivityPage = lazy(() =>
  import('../pages/SystemActivityPage').then((m) => ({ default: m.SystemActivityPage }))
);
const SystemLogsPage = lazy(() =>
  import('../pages/SystemLogsPage').then((m) => ({ default: m.SystemLogsPage }))
);
const PhoneDatabasePage = lazy(() =>
  import('../pages/PhoneDatabasePage').then((m) => ({ default: m.PhoneDatabasePage }))
);
const ChangePasswordPage = lazy(() =>
  import('../pages/ChangePasswordPage').then((m) => ({ default: m.ChangePasswordPage }))
);
const UnauthorizedPage = lazy(() =>
  import('../pages/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage }))
);
const TranslationsAdminPage = lazy(() =>
  import('../pages/TranslationsAdminPage').then((m) => ({ default: m.TranslationsAdminPage }))
);
const ModulePlaceholderPage = lazy(() => import('../pages/modules/ModulePlaceholderPage'));
const InstituteStudentsPage = lazy(() =>
  import('../pages/institute/InstituteStudentsPage').then((m) => ({ default: m.InstituteStudentsPage }))
);
const InstituteStudentProfilePage = lazy(() =>
  import('../pages/institute/InstituteStudentProfilePage').then((m) => ({ default: m.InstituteStudentProfilePage }))
);
const InstituteFeesPage = lazy(() =>
  import('../pages/institute/InstituteFeesPage').then((m) => ({ default: m.InstituteFeesPage }))
);
const InstituteCoursesPage = lazy(() =>
  import('../pages/institute/InstituteCoursesPage').then((m) => ({ default: m.InstituteCoursesPage }))
);
const InstituteBatchesPage = lazy(() =>
  import('../pages/institute/InstituteBatchesPage').then((m) => ({ default: m.InstituteBatchesPage }))
);
const InstituteAttendancePage = lazy(() =>
  import('../pages/institute/InstituteAttendancePage').then((m) => ({ default: m.InstituteAttendancePage }))
);
const InstituteExamsPage = lazy(() =>
  import('../pages/institute/InstituteExamsPage').then((m) => ({ default: m.InstituteExamsPage }))
);
const InstituteMarksEntryPage = lazy(() =>
  import('../pages/institute/InstituteMarksEntryPage').then((m) => ({ default: m.InstituteMarksEntryPage }))
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [saasGateOpen, setSaasGateOpen] = useState(true);

  useEffect(() => {
    if (loading || !user) {
      setSaasGateOpen(true);
      return;
    }
    let cancelled = false;
    setSaasGateOpen(true);
    void (async () => {
      try {
        const { data } = await companyApi.getProfile();
        const saas = (data as any)?.saas;
        const sub = saas?.subscription as { status?: string; trialEndsAt?: string | Date | null } | null | undefined;
        const status = String(sub?.status || '').trim().toLowerCase();
        const trialEndsAt = sub?.trialEndsAt ? new Date(sub.trialEndsAt) : null;
        const trialExpired = status === 'trial' && trialEndsAt && trialEndsAt.getTime() < Date.now();
        const noActivePlan = status !== 'active';
        if (!cancelled && trialExpired && noActivePlan) {
          navigate('/pricing', { replace: true });
        }
      } catch {
        // If backend enforcement is enabled, a 402 here will already be handled by the API layer redirect.
      } finally {
        if (!cancelled) setSaasGateOpen(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, loading, user?.id]);

  if (loading) return <LoadingSkeleton variant="dashboard" />;
  if (!user) return <Navigate to="/login" replace />;
  if (saasGateOpen) return <LoadingSkeleton variant="dashboard" />;
  return <>{children}</>;
}

function ProtectedModuleRoute({
  permissionKey,
  children,
}: {
  permissionKey: string;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSkeleton variant="dashboard" />;
  if (!user) return <Navigate to="/login" replace />;

  if (!canAccessModule(user, permissionKey)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageRouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/verify" element={<SignupVerifyPage />} />
        <Route path="/tutorial" element={<TutorialPage />} />
        <Route path="/setup" element={<SetupWizardPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HybridSyncProvider>
                <SearchProvider>
                  <Layout />
                </SearchProvider>
              </HybridSyncProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<ProtectedModuleRoute permissionKey="dashboard.view"><DashboardPage /></ProtectedModuleRoute>} />

          <Route path="pos" element={<ProtectedModuleRoute permissionKey="sales.pos"><POSPage /></ProtectedModuleRoute>} />
          <Route path="wholesale-sales" element={<ProtectedModuleRoute permissionKey="sales.pos"><WholesaleSalesPage /></ProtectedModuleRoute>} />
          <Route path="quotations" element={<ProtectedModuleRoute permissionKey="sales.pos"><QuotationsPage /></ProtectedModuleRoute>} />
          <Route path="purchases" element={<ProtectedModuleRoute permissionKey="purchases.view"><PurchasesPage /></ProtectedModuleRoute>} />
          <Route path="purchases/new" element={<ProtectedModuleRoute permissionKey="purchases.create"><NewPurchasePage /></ProtectedModuleRoute>} />
          <Route path="suppliers" element={<ProtectedModuleRoute permissionKey="suppliers.view"><SuppliersPage /></ProtectedModuleRoute>} />
          <Route path="suppliers/new" element={<ProtectedModuleRoute permissionKey="suppliers.create"><SupplierFormPage /></ProtectedModuleRoute>} />
          <Route path="suppliers/:id" element={<ProtectedModuleRoute permissionKey="suppliers.view"><SupplierDetailPage /></ProtectedModuleRoute>} />
          <Route path="suppliers/:id/edit" element={<ProtectedModuleRoute permissionKey="suppliers.create"><SupplierFormPage /></ProtectedModuleRoute>} />
          <Route path="inventory" element={<ProtectedModuleRoute permissionKey="inventory.view"><InventoryPage /></ProtectedModuleRoute>} />
          <Route path="transfers" element={<ProtectedModuleRoute permissionKey="inventory.transfers"><TransfersPage /></ProtectedModuleRoute>} />
          <Route path="repairs" element={<ProtectedModuleRoute permissionKey="operations.repairs"><RepairsPage /></ProtectedModuleRoute>} />
          <Route path="refurbishing" element={<ProtectedModuleRoute permissionKey="operations.refurbish"><RefurbishingPage /></ProtectedModuleRoute>} />
          <Route path="phone-database" element={<ProtectedModuleRoute permissionKey="operations.phoneDatabase"><PhoneDatabasePage /></ProtectedModuleRoute>} />
          <Route path="inventory-history" element={<ProtectedModuleRoute permissionKey="inventory.history"><InventoryHistoryPage /></ProtectedModuleRoute>} />
          <Route path="ai-business-intelligence" element={<ProtectedModuleRoute permissionKey="ai.bi"><AIBusinessIntelligencePage /></ProtectedModuleRoute>} />
          <Route path="ai-assistant" element={<ProtectedModuleRoute permissionKey="ai.assistant"><AiAssistantPage /></ProtectedModuleRoute>} />
          <Route path="expenses" element={<ProtectedModuleRoute permissionKey="finance.expenses"><ExpensesPage /></ProtectedModuleRoute>} />
          <Route path="reports" element={<ProtectedModuleRoute permissionKey="reports.view"><ReportsPage /></ProtectedModuleRoute>} />
          <Route path="currency" element={<ProtectedModuleRoute permissionKey="finance.currency"><CurrencyPage /></ProtectedModuleRoute>} />

          <Route path="customers" element={<ProtectedModuleRoute permissionKey="customers.view"><CustomersPage /></ProtectedModuleRoute>} />
          <Route path="customers/new" element={<ProtectedModuleRoute permissionKey="customers.view"><CustomerFormPage /></ProtectedModuleRoute>} />
          <Route path="customers/:id/edit" element={<ProtectedModuleRoute permissionKey="customers.view"><CustomerFormPage /></ProtectedModuleRoute>} />
          <Route path="branches" element={<ProtectedModuleRoute permissionKey="branches.manage"><BranchesPage /></ProtectedModuleRoute>} />
          <Route path="branches/new" element={<ProtectedModuleRoute permissionKey="branches.manage"><BranchFormPage /></ProtectedModuleRoute>} />
          <Route path="branches/:id/edit" element={<ProtectedModuleRoute permissionKey="branches.manage"><BranchFormPage /></ProtectedModuleRoute>} />
          <Route path="master-data" element={<ProtectedModuleRoute permissionKey="masterData.manage"><MasterDataUnifiedPage /></ProtectedModuleRoute>} />
          <Route path="users-roles" element={<ProtectedModuleRoute permissionKey="users.manage"><UsersRolesPage /></ProtectedModuleRoute>} />
          <Route path="company-settings" element={<ProtectedModuleRoute permissionKey="settings.company"><CompanySettingsPage /></ProtectedModuleRoute>} />
          <Route path="settings" element={<ProtectedModuleRoute permissionKey="settings.app"><SettingsPage /></ProtectedModuleRoute>} />
          <Route path="change-password" element={<ProtectedModuleRoute permissionKey="settings.app"><ChangePasswordPage /></ProtectedModuleRoute>} />
          <Route path="settings/translations" element={<ProtectedModuleRoute permissionKey="settings.app"><TranslationsAdminPage /></ProtectedModuleRoute>} />
          <Route path="monitoring" element={<ProtectedModuleRoute permissionKey="monitoring.view"><MonitoringPage /></ProtectedModuleRoute>} />
          <Route path="activity" element={<ProtectedModuleRoute permissionKey="logs.activity"><SystemActivityPage /></ProtectedModuleRoute>} />
          <Route path="logs" element={<ProtectedModuleRoute permissionKey="logs.system"><SystemLogsPage /></ProtectedModuleRoute>} />

          <Route
            path="institute/students"
            element={
              <ProtectedModuleRoute permissionKey="institute.access">
                <InstituteStudentsPage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="institute/students/:studentId"
            element={
              <ProtectedModuleRoute permissionKey="institute.access">
                <InstituteStudentProfilePage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="institute/courses"
            element={
              <ProtectedModuleRoute permissionKey="institute.access">
                <InstituteCoursesPage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="institute/batches"
            element={
              <ProtectedModuleRoute permissionKey="institute.access">
                <InstituteBatchesPage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="institute/fees"
            element={
              <ProtectedModuleRoute permissionKey="institute.access">
                <InstituteFeesPage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="institute/attendance"
            element={
              <ProtectedModuleRoute permissionKey="institute.access">
                <InstituteAttendancePage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="institute/exams"
            element={
              <ProtectedModuleRoute permissionKey="institute.access">
                <InstituteExamsPage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="institute/exams/:examId/marks"
            element={
              <ProtectedModuleRoute permissionKey="institute.access">
                <InstituteMarksEntryPage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="parts-catalog"
            element={
              <ProtectedModuleRoute permissionKey="parts.catalog.view">
                <ModulePlaceholderPage />
              </ProtectedModuleRoute>
            }
          />
          <Route
            path="sourcing"
            element={
              <ProtectedModuleRoute permissionKey="sourcing.requests.manage">
                <ModulePlaceholderPage />
              </ProtectedModuleRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        <Route path="/unauthorized" element={<ProtectedRoute><UnauthorizedPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
