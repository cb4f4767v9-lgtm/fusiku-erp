/**
 * Route chunk preloading for instant navigation feel.
 * Keep in sync with `routes/AppRoutes.tsx` lazy imports.
 */
type PreloadFn = () => Promise<unknown>;

function once(fn: PreloadFn): PreloadFn {
  let p: Promise<unknown> | null = null;
  return () => (p ??= fn().catch(() => undefined));
}

export const preloadDashboard = once(() =>
  import('../pages/DashboardPage').then((m) => m.DashboardPage)
);
export const preloadPOS = once(() => import('../pages/POSPage').then((m) => m.POSPage));
export const preloadInventory = once(() => import('../pages/InventoryPage').then((m) => m.InventoryPage));
export const preloadPurchases = once(() => import('../pages/PurchasesPage').then((m) => m.PurchasesPage));
export const preloadNewPurchase = once(() =>
  import('../pages/purchases/NewPurchasePage').then((m) => m.default)
);
export const preloadSuppliers = once(() => import('../pages/SuppliersPage').then((m) => m.SuppliersPage));
export const preloadReports = once(() => import('../pages/ReportsPage').then((m) => m.ReportsPage));

export const preloadPrimaryRoutes = once(async () => {
  await Promise.allSettled([
    preloadDashboard(),
    preloadPOS(),
    preloadInventory(),
    preloadPurchases(),
    preloadSuppliers(),
    preloadReports(),
  ]);
});

