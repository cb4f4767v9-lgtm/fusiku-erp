import request from 'supertest';
import { buildApplication } from '../src/http/application';

describe('Invoice payments (auth)', () => {
  const { app } = buildApplication();

  it('POST /api/v1/invoices/x/payments requires authentication', async () => {
    const res = await request(app).post('/api/v1/invoices/inv_1/payments').send({ amount: 10 });
    expect(res.status).toBe(401);
  });
});
