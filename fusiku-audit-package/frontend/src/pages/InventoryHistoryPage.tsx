import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stockMovementsApi, branchesApi } from '../services/api';
import { PageLayout, PageHeader, TableWrapper } from '../components/design-system';
import { formatDateTimeForUi } from '../utils/formatting';

export function InventoryHistoryPage() {
  const { t } = useTranslation();
  const [movements, setMovements] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState('');
  const [type, setType] = useState('');

  useEffect(() => {
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    const params: any = {};
    if (branchId) params.branchId = branchId;
    if (type) params.type = type;
    stockMovementsApi.getAll(params).then((r) => setMovements(r.data)).catch(() => setMovements([]));
  }, [branchId, type]);

  return (
    <PageLayout className="page">
      <PageHeader
        title={t('inventoryHistory.title')}
        actions={
          <div className="filters-row">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('inventoryHistory.allBranches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t('inventoryHistory.allTypes')}</option>
              <option value="purchase">{t('inventoryHistory.purchase')}</option>
              <option value="sale">{t('inventoryHistory.sale')}</option>
              <option value="repair">{t('inventoryHistory.repair')}</option>
              <option value="refurbish">{t('inventoryHistory.refurbish')}</option>
              <option value="transfer">{t('inventoryHistory.transfer')}</option>
              <option value="adjustment">{t('inventoryHistory.adjustment')}</option>
            </select>
          </div>
        }
      />
      <TableWrapper>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>IMEI</th>
              <th>Brand / Model</th>
              <th>Branch</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{formatDateTimeForUi(m.createdAt)}</td>
                <td><span className="badge">{m.movementType || m.type}</span></td>
                <td>{m.inventory?.imei}</td>
                <td>{m.inventory?.brand} {m.inventory?.model}</td>
                <td>{m.branch?.name}</td>
                <td>{m.quantity ?? 1}</td>
              </tr>
            ))}
            {movements.length === 0 && <tr><td colSpan={6}>{t('inventoryHistory.noMovements')}</td></tr>}
          </tbody>
        </table>
      </TableWrapper>
    </PageLayout>
  );
}
