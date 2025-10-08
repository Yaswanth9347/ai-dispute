const request = require('supertest');
const app = require('../src/app');

jest.mock('../src/lib/supabaseClient');
const supabase = require('../src/lib/supabaseClient');

describe('Auth routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('POST /api/auth/login with signInWithPassword success returns token', async () => {
    const fakeUser = { id: 'user-1', email: 'u@example.com', user_metadata: { name: 'U' } };
    supabase.auth = {
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: fakeUser }, error: null })
    };

    const res = await request(app).post('/api/auth/login').send({ email: 'u@example.com', password: 'password' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ id: fakeUser.id, email: fakeUser.email });
  });

  test('POST /api/auth/login with email_not_confirmed returns 403', async () => {
    supabase.auth = {
      signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: { code: 'email_not_confirmed', message: 'not confirmed' } })
    };
    const res = await request(app).post('/api/auth/login').send({ email: 'u@example.com', password: 'password' });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('message');
  });

  test('POST /api/auth/register uses admin.createUser when available', async () => {
    const created = { id: 'new-1', email: 'new@example.com' };
    supabase.auth = {
      admin: { createUser: jest.fn().mockResolvedValue({ data: created, error: null }) }
    };
    // stub profile insert to be no-op
    supabase.from = jest.fn().mockReturnValue({ insert: jest.fn().mockResolvedValue({ data: created, error: null }) });

    const res = await request(app).post('/api/auth/register').send({ email: 'new@example.com', password: 'password', name: 'New' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toMatchObject({ id: created.id, email: created.email });
  });
});
