import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';

import { Layout } from '../layouts/Layout';
import { SearchProvider } from '../contexts/SearchContext';
import { HybridSyncProvider } from '../contexts/HybridSyncContext';
import { ProtectedAppProviders } from '../contexts/AppStateProvider';

import { canAccessModule } from '../utils/permissions';
import { PageRouteFallback } from '../shared/components/PageRouteFallback';
import { LoadingSkeleton } from '../components/design-system/LoadingSkeleton';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const SignupPage = lazy(() => import('../pages/SignupPage'));
const TutorialPage = lazy(() => import('../pages/TutorialPage'));
const SetupPage = lazy(() => import('../pages/SetupPage'));
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSkeleton variant="dashboard" />;
  if (!user) return <Navigate to="/login" replace />;

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

function NotFoundInApp() {
  const { t } = useTranslation();
  return (
    <div className="page" style={{ padding: 24 }}>
      <h1>{t('common.notFound', { defaultValue: 'Page not found' })}</h1>
      <p>404</p>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageRouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/tutorial" element={<TutorialPage />} />
        <Route path="/setup" element={<SetupWizardPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ProtectedAppProviders>
                <HybridSyncProvider>
                  <SearchProvider>
                    <Layout />
                </SearchProvider>
              </HybridSyncProvider>
              </ProtectedAppProviders>
            </ProtectedRoute>
          }
        >
          <Route index element={<ProtectedModuleRoute permissionKey="dashboard.view"><DashboardPage /></ProtectedModuleRoute>} />

          <Route path="pos" element={<ProtectedModuleRoute permissionKey="sales.pos"><POSPage /></ProtectedModuleRoute>} />
          <Route path="wholesale-sales" element={<ProtectedModuleRoute permissionKey="sales.pos"><WholesaleSalesPage /></ProtectedModuleRoute>} />
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

          <Route path="*" element={<NotFoundInApp />} />
        </Route>

        <Route path="/unauthorized" element={<ProtectedRoute><UnauthorizedPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
