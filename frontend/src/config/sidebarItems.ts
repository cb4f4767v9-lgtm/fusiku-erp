import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  DollarSign,
  Wrench,
  RefreshCw,
  Wallet,
  Database,
  FileText,
  BarChart3,
  Settings,
  History,
  Activity,
  Gauge,
  Sparkles,
  FileSpreadsheet,
  Boxes,
  ArrowRightLeft,
} from 'lucide-react';

export interface SidebarItem {
  path: string;
  labelKey: string;
  permissionKey: string;
  keywords: string[];
  icon: LucideIcon;
}

export type SidebarSection = {
  id: string;
  labelKey: string;
  items: SidebarItem[];
};

export const sidebarSections: SidebarSection[] = [
  {
    id: 'dashboard',
    labelKey: 'sidebar.sections.dashboard',
    items: [
      {
        path: '/',
        labelKey: 'nav.dashboard',
        permissionKey: 'dashboard.view',
        keywords: ['dashboard', 'home', '仪表盘', 'ڈیش بورڈ'],
        icon: LayoutDashboard,
      },
    ],
  },

  {
    id: 'sales',
    labelKey: 'sidebar.sections.sales',
    items: [
      {
        path: '/pos',
        labelKey: 'nav.pos',
        permissionKey: 'sales.pos',
        keywords: ['pos', 'sale', 'billing', '收银', 'فروخت'],
        icon: CreditCard,
      },
      {
        path: '/wholesale-sales',
        labelKey: 'nav.wholesaleSales',
        permissionKey: 'sales.pos',
        keywords: ['wholesale', 'sales', 'orders', 'invoice', 'bulk', 'جملہ', 'تھوک'],
        icon: Receipt,
      },
      {
        path: '/customers',
        labelKey: 'nav.customers',
        permissionKey: 'customers.view',
        keywords: ['customer', 'client', '客户', 'کسٹمر'],
        icon: Users,
      },
    ],
  },

  {
    id: 'purchase',
    labelKey: 'sidebar.sections.purchase',
    items: [
      {
        path: '/purchases',
        labelKey: 'nav.purchases',
        permissionKey: 'purchases.view',
        keywords: ['purchase', 'buy', '采购', 'خرید'],
        icon: FileSpreadsheet,
      },
      {
        path: '/suppliers',
        labelKey: 'nav.suppliers',
        permissionKey: 'suppliers.view',
        keywords: ['supplier', 'vendor', '供应商', 'سپلائر'],
        icon: Users,
      },
    ],
  },

  {
    id: 'inventory',
    labelKey: 'sidebar.sections.inventory',
    items: [
      {
        path: '/inventory',
        labelKey: 'nav.inventory',
        permissionKey: 'inventory.view',
        keywords: ['inventory', 'stock', 'imei', '库存', 'اسٹاک'],
        icon: Boxes,
      },
      {
        path: '/transfers',
        labelKey: 'nav.transfers',
        permissionKey: 'inventory.transfers',
        keywords: ['transfer', '调拨', 'منتقلی'],
        icon: ArrowRightLeft,
      },
      {
        path: '/inventory-history',
        labelKey: 'nav.inventoryHistory',
        permissionKey: 'inventory.history',
        keywords: ['history', 'movement', '历史', 'تاریخ'],
        icon: History,
      },
    ],
  },

  {
    id: 'operations',
    labelKey: 'sidebar.sections.operations',
    items: [
      {
        path: '/repairs',
        labelKey: 'nav.repairs',
        permissionKey: 'operations.repairs',
        keywords: ['repair', 'fix', '维修', 'مرمت'],
        icon: Wrench,
      },
      {
        path: '/refurbishing',
        labelKey: 'nav.refurbishing',
        permissionKey: 'operations.refurbish',
        keywords: ['refurbish', '翻新', 'ریفربش'],
        icon: RefreshCw,
      },
      {
        path: '/phone-database',
        labelKey: 'nav.phoneDatabase',
        permissionKey: 'operations.phoneDatabase',
        keywords: ['phone', 'database', '手机', 'فون'],
        icon: Database,
      },
    ],
  },

  {
    id: 'finance',
    labelKey: 'sidebar.sections.finance',
    items: [
      {
        path: '/expenses',
        labelKey: 'nav.expenses',
        permissionKey: 'finance.expenses',
        keywords: ['expense', 'cost', '费用', 'خرچ'],
        icon: Wallet,
      },
      {
        path: '/currency',
        labelKey: 'nav.currency',
        permissionKey: 'finance.currency',
        keywords: ['currency', 'exchange', '货币', 'کرنسی'],
        icon: DollarSign,
      },
    ],
  },

  {
    id: 'ai',
    labelKey: 'sidebar.sections.ai',
    items: [
      {
        path: '/ai-assistant',
        labelKey: 'nav.aiAssistant',
        permissionKey: 'ai.assistant',
        keywords: ['assistant', 'chat', '助手', 'اسسٹنٹ'],
        icon: Sparkles,
      },
      {
        path: '/ai-business-intelligence',
        labelKey: 'nav.aiBusinessIntelligence',
        permissionKey: 'ai.bi',
        keywords: ['ai', 'forecast', '人工智能', 'ذہانت'],
        icon: Sparkles,
      },
    ],
  },

  {
    id: 'reports',
    labelKey: 'sidebar.sections.reports',
    items: [
      {
        path: '/reports',
        labelKey: 'nav.reports',
        permissionKey: 'reports.view',
        keywords: ['reports', 'profit', '报表', 'رپورٹ'],
        icon: BarChart3,
      },
    ],
  },

  {
    id: 'system',
    labelKey: 'sidebar.sections.system',
    items: [
      {
        path: '/settings',
        labelKey: 'nav.settings',
        permissionKey: 'settings.app',
        keywords: ['settings', 'system', '设置', 'سیٹنگز'],
        icon: Settings,
      },
      {
        path: '/monitoring',
        labelKey: 'nav.monitoring',
        permissionKey: 'monitoring.view',
        keywords: ['monitor', 'health', '监控', 'نگرانی'],
        icon: Gauge,
      },
      {
        path: '/activity',
        labelKey: 'nav.systemActivity',
        permissionKey: 'logs.activity',
        keywords: ['activity', 'audit', '活动', 'سرگرمی'],
        icon: Activity,
      },
      {
        path: '/logs',
        labelKey: 'nav.systemLogs',
        permissionKey: 'logs.system',
        keywords: ['logs', '日志', 'لاگ'],
        icon: FileText,
      },
    ],
  },
];