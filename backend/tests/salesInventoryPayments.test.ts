import request from 'supertest';
import { buildApplication } from '../src/http/application';

/**
 * Smoke tests without DB: protected routes must reject unauthenticated requests.
 * Full integration tests belong in a suite with DATABASE_URL + migrations.
 */
describe('Sales / inventory / payments (auth gate)', () => {
  const { app } = buildApplication();

  it('GET /api/v1/sales-orders requires auth', async () => {
    const res = await request(app).get('/api/v1/sales-orders');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/inventory requires auth', async () => {
    const res = await request(app).get('/api/v1/inventory');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/invoices requires auth', async () => {
    const res = await request(app).get('/api/v1/invoices');
    expect(res.status).toBe(401);
  });
});
