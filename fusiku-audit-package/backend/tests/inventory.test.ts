import request from 'supertest';
import { buildApplication } from '../src/http/application';

describe('Inventory (auth)', () => {
  const { app } = buildApplication();

  it('GET /api/v1/inventory requires authentication', async () => {
    const res = await request(app).get('/api/v1/inventory');
    expect(res.status).toBe(401);
  });
});
