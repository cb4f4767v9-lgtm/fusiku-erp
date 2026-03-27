import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  CreditCard,
  Wrench,
  RefreshCw,
  Truck,
  Database,
  FileText,
  BarChart3,
  Settings,
  History,
  Activity,
  Gauge,
  Sparkles,
  Code,
  Building2
} from 'lucide-react';

export interface SidebarItem {
  name: string;
  path: string;
  labelKey: string;
  keywords: string[];
  icon: LucideIcon;
}

export const sidebarItems: SidebarItem[] = [
  {
    name: 'Dashboard',
    path: '/',
    labelKey: 'nav.dashboard',
    keywords: ['dashboard', 'home', 'overview', 'main'],
    icon: LayoutDashboard
  },
  {
    name: 'AI Business Intelligence',
    path: '/ai-business-intelligence',
    labelKey: 'nav.aiBusinessIntelligence',
    keywords: ['ai', 'business intelligence', 'forecast', 'prediction'],
    icon: Sparkles
  },
  {
    name: 'Inventory',
    path: '/inventory',
    labelKey: 'nav.inventory',
    keywords: ['inventory', 'stock', 'products', 'phones'],
    icon: Package
  },
  {
    name: 'Inventory History',
    path: '/inventory-history',
    labelKey: 'nav.inventoryHistory',
    keywords: ['inventory', 'history', 'stock', 'movement'],
    icon: History
  },
  {
    name: 'Purchases',
    path: '/purchases',
    labelKey: 'nav.purchases',
    keywords: ['purchase', 'buy', 'buying', 'supplier order'],
    icon: ShoppingCart
  },
  {
    name: 'Suppliers',
    path: '/suppliers',
    labelKey: 'nav.suppliers',
    keywords: ['supplier', 'vendor', 'factory', 'china supplier'],
    icon: Users
  },
  {
    name: 'Customers',
    path: '/customers',
    labelKey: 'nav.customers',
    keywords: ['customer', 'client', 'buyer'],
    icon: Users
  },
  {
    name: 'Branches',
    path: '/branches',
    labelKey: 'nav.branches',
    keywords: ['branch', 'store', 'shop', 'location'],
    icon: Building2
  },
  {
    name: 'POS',
    path: '/pos',
    labelKey: 'nav.pos',
    keywords: ['pos', 'sale', 'sell', 'billing', 'counter'],
    icon: CreditCard
  },
  {
    name: 'Repairs',
    path: '/repairs',
    labelKey: 'nav.repairs',
    keywords: ['repair', 'fix', 'service', 'technician'],
    icon: Wrench
  },
  {
    name: 'Refurbishing',
    path: '/refurbishing',
    labelKey: 'nav.refurbishing',
    keywords: ['refurbish', 'renew', 'grade'],
    icon: RefreshCw
  },
  {
    name: 'Transfers',
    path: '/transfers',
    labelKey: 'nav.transfers',
    keywords: ['transfer', 'move', 'branch transfer'],
    icon: Truck
  },
  {
    name: 'Reports',
    path: '/reports',
    labelKey: 'nav.reports',
    keywords: ['reports', 'analytics', 'profit', 'loss', 'sales'],
    icon: BarChart3
  },
  {
    name: 'Advanced Reports',
    path: '/reports/advanced',
    labelKey: 'nav.advancedReports',
    keywords: ['reports', 'advanced', 'analytics'],
    icon: FileText
  },
  {
    name: 'Phone Database',
    path: '/phone-database',
    labelKey: 'nav.phoneDatabase',
    keywords: ['phone', 'database', 'model', 'device'],
    icon: Database
  },
  {
    name: 'System Activity',
    path: '/activity',
    labelKey: 'nav.systemActivity',
    keywords: ['activity', 'system', 'audit'],
    icon: Activity
  },
  {
    name: 'System Logs',
    path: '/logs',
    labelKey: 'nav.systemLogs',
    keywords: ['logs', 'system', 'log'],
    icon: FileText
  },
  {
    name: 'Monitoring',
    path: '/monitoring',
    labelKey: 'nav.monitoring',
    keywords: ['monitoring', 'monitor', 'health'],
    icon: Gauge
  },
  {
    name: 'Settings',
    path: '/settings',
    labelKey: 'nav.settings',
    keywords: ['settings', 'config', 'system'],
    icon: Settings
  },
  {
    name: 'Master Data',
    path: '/master-data',
    labelKey: 'nav.masterData',
    keywords: ['master', 'data', 'reference'],
    icon: Database
  },
  {
    name: 'Company Settings',
    path: '/company-settings',
    labelKey: 'nav.companySettings',
    keywords: ['company', 'settings', 'config'],
    icon: Settings
  },
  {
    name: 'Developer Settings',
    path: '/developer-settings',
    labelKey: 'nav.developerSettings',
    keywords: ['developer', 'settings', 'api'],
    icon: Code
  },
  {
    name: 'Integration Logs',
    path: '/integration-logs',
    labelKey: 'nav.integrationLogs',
    keywords: ['integration', 'logs', 'api'],
    icon: FileText
  }
];
