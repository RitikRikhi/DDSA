const request = require('supertest');
process.env.NODE_ENV = 'test';
const app = require('../server/server');
const prisma = require('../server/config/prisma');

describe('Authentication & Authorization Suite', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('should successfully log in with valid admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@dsa.com',
          password: 'admin123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('email', 'admin@dsa.com');
      expect(res.body.user.roleKey).toBe('SUPER_ADMIN');
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@dsa.com',
          password: 'incorrectPassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@dsa.com',
          password: 'password123'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should validate request schema with Zod', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email-format'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('GET /api/auth/session', () => {
    let authToken;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@dsa.com',
          password: 'admin123'
        });
      authToken = res.body.token;
    });

    it('should return session details with valid JWT', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toHaveProperty('email', 'admin@dsa.com');
    });

    it('should reject request without authorization token', async () => {
      const res = await request(app)
        .get('/api/auth/session');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid authorization token', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear session on logout', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
