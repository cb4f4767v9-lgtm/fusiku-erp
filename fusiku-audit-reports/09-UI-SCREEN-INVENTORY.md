# Fusiku ERP — UI Screen Inventory
**Generated:** 2026-05-11

---

## Page Count: 60+

### Authentication (5 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/login` | LoginPage | Production |
| `/signup` | SignupPage | Production |
| `/verify` | VerifyPage | Production |
| `/forgot-password` | ForgotPasswordPage | Production |
| `/reset-password` | ResetPasswordPage | Production |

### Setup (2 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/setup` | SetupPage | Production |
| `/setup/profile` | SetupProfilePage | Production |

### Dashboard (1 page)
| Route | Component | Status |
|-------|-----------|--------|
| `/` / `/dashboard` | DashboardPage | Production |
| — | 7 dashboard widgets | Production |

### Inventory (5 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/inventory` | InventoryPage | Production |
| `/inventory/new` | InventoryCreatePage | Production |
| `/inventory/:id` | InventoryDetailPage | Production |
| `/inventory/:id/edit` | InventoryEditPage | Production |
| `/phone-database` | PhoneDatabasePage | Production |

### Sales & POS (5 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/pos` | POSPage | Production |
| `/pos/receipt/:id` | ReceiptPage | Production |
| `/sales-orders` | SalesOrdersPage | Production |
| `/sales-orders/:id` | SalesOrderDetailPage | Production |
| `/invoices` | InvoicesPage | Production |

### Purchasing (2 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/purchases` | PurchasesPage | Production |
| `/purchases/new` | PurchaseCreatePage | Production |

### Suppliers (3 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/suppliers` | SuppliersPage | Production |
| `/suppliers/new` | SupplierCreatePage | Production |
| `/suppliers/:id` | SupplierDetailPage | Production |

### Customers (2 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/customers` | CustomersPage | Production |
| `/customers/:id` | CustomerDetailPage | Production |

### Transfers (1 page)
| Route | Component | Status |
|-------|-----------|--------|
| `/transfers` | TransfersPage | Production |

### Repairs & Refurbishment (3 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/repairs` | RepairsPage | Production |
| `/repairs/:id` | RepairDetailPage | Production |
| `/refurbish` | RefurbishPage | Production |

### Financial (3 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/expenses` | ExpensesPage | Production |
| `/quotations` | QuotationsPage | Production |
| `/currency` | CurrencyPage | Production |

### Institute (8 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/institute` | InstituteDashboardPage | Redirect → students |
| `/institute/students` | InstituteStudentsPage | Production |
| `/institute/students/:id` | InstituteStudentProfilePage | Production |
| `/institute/courses` | ModulePlaceholderPage | Placeholder |
| `/institute/batches` | ModulePlaceholderPage | Placeholder |
| `/institute/attendance` | ModulePlaceholderPage | Placeholder |
| `/institute/fees` | InstituteFeesPage | Production |
| `/institute/settings` | ModulePlaceholderPage | Placeholder |

### Reports (2 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/reports` | ReportsPage | Production |
| `/analytics` | AnalyticsPage | Production |

### AI (2 pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/ai/insights` | AIInsightsPage | Production |
| `/ai/business` | AIBusinessPage | Production |

### Settings & Admin (8+ pages)
| Route | Component | Status |
|-------|-----------|--------|
| `/settings` | SettingsPage | Production |
| `/settings/company` | CompanyProfilePage | Production |
| `/settings/branches` | BranchesPage | Production |
| `/settings/branches/:id` | BranchDetailPage | Production |
| `/settings/users` | UsersPage | Production |
| `/settings/translations` | TranslationsAdminPage | Production |
| `/billing` | BillingPage | Production |
| `/billing/pricing` | PricingPage | Production |
| `/admin` | AdminDashboard | Production (SystemAdmin only) |

### Modals (17 identified)
| Modal | Location |
|-------|----------|
| AddStudentModal | Institute — admission workflow |
| EditStudentModal (profile form) | Institute — student edit |
| EnrollmentModal | Institute — batch enrollment |
| RecordPaymentModal | Institute — fee payment |
| AddCourseDialog | Institute — inline course add |
| AddBatchDialog | Institute — inline batch add |
| CommandPalette | Global — Cmd+K search |
| BranchChat | Global — sidebar chat drawer |
| ConfirmDialog | Shared — delete/action confirmations |
| ExportDialog | Reports — export format selection |
| InventoryFilterDrawer | Inventory — filter panel |
| SalesOrderCreateModal | Sales — order creation |
| QuotationShareModal | Quotations — share link |
| UserInviteModal | Settings — invite user |
| TranslationAutoFillModal | Settings — AI translation |
| PaymentRecordModal | Invoices — record payment |
| RepairCreateModal | Repairs — new ticket |

### Navigation Components
| Component | Description |
|-----------|-------------|
| Sidebar | Collapsible, 6 sections, 40+ items, search, branch selector |
| TopBar | Breadcrumbs, notification bell, user avatar, settings gear |
| CommandPalette | Cmd+K global search across all modules |
