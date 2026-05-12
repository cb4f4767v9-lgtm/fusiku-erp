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
  BookOpen,
  Layers,
  ClipboardCheck,
} from 'lucide-react';
import type { BusinessVertical } from '../utils/businessVertical';

export interface SidebarItem {
  path: string;
  labelKey: string;
  permissionKey: string;
  keywords: string[];
  icon: LucideIcon;
  /** When set, the item is only shown for these tenant verticals (see `companyBusinessType`). */
  onlyForVerticals?: BusinessVertical[];
  /** Hide for matching verticals (e.g. retail POS hidden for training institutes). */
  hideForVerticals?: BusinessVertical[];
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
    id: 'institute',
    labelKey: 'sidebar.sections.institute',
    items: [
      {
        path: '/institute/students',
        labelKey: 'nav.instituteStudents',
        permissionKey: 'institute.access',
        keywords: ['student', 'learner', 'trainee', '学员', 'طالب علم'],
        icon: Users,
        onlyForVerticals: ['institute'],
      },
      {
        path: '/institute/courses',
        labelKey: 'nav.instituteCourses',
        permissionKey: 'institute.access',
        keywords: ['course', 'curriculum', '课程', 'کورس'],
        icon: BookOpen,
        onlyForVerticals: ['institute'],
      },
      {
        path: '/institute/batches',
        labelKey: 'nav.instituteBatches',
        permissionKey: 'institute.access',
        keywords: ['batch', 'cohort', 'class', '班组', 'بیچ'],
        icon: Layers,
        onlyForVerticals: ['institute'],
      },
      {
        path: '/institute/fees',
        labelKey: 'nav.instituteFees',
        permissionKey: 'institute.access',
        keywords: ['fee', 'tuition', 'billing', '学费', 'فیس'],
        icon: Receipt,
        onlyForVerticals: ['institute'],
      },
      {
        path: '/institute/attendance',
        labelKey: 'nav.instituteAttendance',
        permissionKey: 'institute.access',
        keywords: ['attendance', 'presence', '考勤', 'حاضری'],
        icon: ClipboardCheck,
        onlyForVerticals: ['institute'],
      },
      {
        path: '/institute/exams',
        labelKey: 'nav.instituteExams',
        permissionKey: 'institute.access',
        keywords: ['exam', 'test', 'quiz', 'assessment', '考试', 'امتحان'],
        icon: FileText,
        onlyForVerticals: ['institute'],
      },
    ],
  },

  {
    id: 'parts_catalog',
    labelKey: 'sidebar.sections.partsCatalog',
    items: [
      {
        path: '/parts-catalog',
        labelKey: 'nav.partsCatalog',
        permissionKey: 'parts.catalog.view',
        keywords: ['parts', 'catalog', 'device', 'bom', '配件', 'قطعات'],
        icon: Boxes,
        onlyForVerticals: ['parts'],
      },
    ],
  },

  {
    id: 'sourcing',
    labelKey: 'sidebar.sections.sourcing',
    items: [
      {
        path: '/sourcing',
        labelKey: 'nav.sourcingRequests',
        permissionKey: 'sourcing.requests.manage',
        keywords: ['sourcing', 'procurement', 'request', '采购', 'ذرائع'],
        icon: FileSpreadsheet,
        onlyForVerticals: ['sourcing'],
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
        hideForVerticals: ['institute'],
      },
      {
        path: '/wholesale-sales',
        labelKey: 'nav.wholesaleSales',
        permissionKey: 'sales.pos',
        keywords: ['wholesale', 'sales', 'orders', 'invoice', 'bulk', 'جملہ', 'تھوک'],
        icon: Receipt,
        hideForVerticals: ['institute'],
      },
      {
        path: '/quotations',
        labelKey: 'nav.quotations',
        permissionKey: 'sales.pos',
        keywords: ['quote', 'quotation', 'pricing', 'whatsapp', 'share', '报价', 'اقتباس', 'حوالہ'],
        icon: FileSpreadsheet,
        hideForVerticals: ['institute'],
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
        hideForVerticals: ['institute'],
      },
      {
        path: '/suppliers',
        labelKey: 'nav.suppliers',
        permissionKey: 'suppliers.view',
        keywords: ['supplier', 'vendor', '供应商', 'سپلائر'],
        icon: Users,
        hideForVerticals: ['institute'],
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
        hideForVerticals: ['institute'],
      },
      {
        path: '/transfers',
        labelKey: 'nav.transfers',
        permissionKey: 'inventory.transfers',
        keywords: ['transfer', '调拨', 'منتقلی'],
        icon: ArrowRightLeft,
        hideForVerticals: ['institute'],
      },
      {
        path: '/inventory-history',
        labelKey: 'nav.inventoryHistory',
        permissionKey: 'inventory.history',
        keywords: ['history', 'movement', '历史', 'تاریخ'],
        icon: History,
        hideForVerticals: ['institute'],
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
        onlyForVerticals: ['repair_focused'],
      },
      {
        path: '/refurbishing',
        labelKey: 'nav.refurbishing',
        permissionKey: 'operations.refurbish',
        keywords: ['refurbish', '翻新', 'ریفربش'],
        icon: RefreshCw,
        onlyForVerticals: ['repair_focused'],
      },
      {
        path: '/phone-database',
        labelKey: 'nav.phoneDatabase',
        permissionKey: 'operations.phoneDatabase',
        keywords: ['phone', 'database', '手机', 'فون'],
        icon: Database,
        onlyForVerticals: ['mobile_retail', 'parts', 'accessories'],
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