import { api } from './api';

/** Queue a mutation for cloud sync (processed when online + CLOUD_API_BASE_URL set). */
export async function enqueueCloudSync(
  entity: string,
  op: 'create' | 'update' | 'delete',
  payload: Record<string, unknown>
) {
  const { data } = await api.post('/sync/enqueue', { entity, op, payload });
  return data;
}
