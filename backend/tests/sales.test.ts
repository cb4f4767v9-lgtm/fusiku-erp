import request from 'supertest';
import { buildApplication } from '../src/http/application';

describe('Sales orders (auth)', () => {
  const { app } = buildApplication();

  it('GET /api/v1/sales-orders requires authentication', async () => {
    const res = await request(app).get('/api/v1/sales-orders');
    expect(res.status).toBe(401);
  });
});
