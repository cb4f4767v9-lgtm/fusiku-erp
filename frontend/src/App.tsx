import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './hooks/useAuth';
import { Layout } from './layouts/Layout';
import { SearchProvider } from './contexts/SearchContext';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { PurchaseNewPage } from './pages/PurchaseNewPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { SupplierFormPage } from './pages/SupplierFormPage';
import { SupplierDetailPage } from './pages/SupplierDetailPage';
import { POSPage } from './pages/POSPage';
import { RepairsPage } from './pages/RepairsPage';
import { RefurbishingPage } from './pages/RefurbishingPage';
import { ReportsPage } from './pages/ReportsPage';
import { TransfersPage } from './pages/TransfersPage';
import { PhoneDatabasePage } from './pages/PhoneDatabasePage';
import { SystemLogsPage } from './pages/SystemLogsPage';
import { InventoryHistoryPage } from './pages/InventoryHistoryPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerFormPage } from './pages/CustomerFormPage';
import { BranchesPage } from './pages/BranchesPage';
import { BranchFormPage } from './pages/BranchFormPage';
import { SystemActivityPage } from './pages/SystemActivityPage';
import { CompanySettingsPage } from './pages/CompanySettingsPage';
import { AdvancedReportsPage } from './pages/AdvancedReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { SetupPage } from './pages/SetupPage';
import { AIBusinessIntelligencePage } from './pages/AIBusinessIntelligencePage';
import { DeveloperSettingsPage } from './pages/DeveloperSettingsPage';
import { IntegrationLogsPage } from './pages/IntegrationLogsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { MasterDataUnifiedPage } from './pages/master-data/MasterDataUnifiedPage';
import { HybridSyncProvider } from './contexts/HybridSyncContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <HybridSyncProvider>
            <SearchProvider>
              <Layout />
            </SearchProvider>
          </HybridSyncProvider>
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="purchases" element={<PurchasesPage />} />
        <Route path="purchases/new" element={<PurchaseNewPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="suppliers/new" element={<SupplierFormPage />} />
        <Route path="suppliers/:id/edit" element={<SupplierFormPage />} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="repairs" element={<RepairsPage />} />
        <Route path="refurbishing" element={<RefurbishingPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/advanced" element={<AdvancedReportsPage />} />
        <Route path="transfers" element={<TransfersPage />} />
        <Route path="inventory-history" element={<InventoryHistoryPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/new" element={<CustomerFormPage />} />
        <Route path="customers/:id/edit" element={<CustomerFormPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="branches/new" element={<BranchFormPage />} />
        <Route path="branches/:id/edit" element={<BranchFormPage />} />
        <Route path="activity" element={<SystemActivityPage />} />
        <Route path="phone-database" element={<PhoneDatabasePage />} />
        <Route path="logs" element={<SystemLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="master-data" element={<MasterDataUnifiedPage />} />
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="company-settings" element={<CompanySettingsPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="ai-business-intelligence" element={<AIBusinessIntelligencePage />} />
        <Route path="developer-settings" element={<DeveloperSettingsPage />} />
        <Route path="integration-logs" element={<IntegrationLogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
