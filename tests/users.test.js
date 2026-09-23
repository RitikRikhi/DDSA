const request = require('supertest');
process.env.NODE_ENV = 'test';
const app = require('../server/server');
const prisma = require('../server/config/prisma');

describe('Users & Members API Suite', () => {
  let adminToken;
  let createdUserId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@dsa.com', password: 'admin123' });
    adminToken = res.body.token;
  });

  afterAll(async () => {
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    await prisma.$disconnect();
  });

  describe('GET /api/users', () => {
    it('should list users with pagination', async () => {
      const res = await request(app)
        .get('/api/users?page=1&limit=10');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
      expect(res.body.total).toBeGreaterThanOrEqual(60);
    });

    it('should filter users by department', async () => {
      const res = await request(app)
        .get('/api/users?department=Photography');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach(user => {
        expect(user.department.toLowerCase()).toContain('photo');
      });
    });

    it('should search users by name', async () => {
      const res = await request(app)
        .get('/api/users?search=Prince');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some(u => u.name.includes('Prince'))).toBe(true);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new member when called by admin', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Creator',
          email: 'test.creator@dsa.com',
          department: 'Videography',
          role: 'Videographer',
          year: '2nd Year',
          skills: ['Cinematography', 'Gimbal Operation']
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Test Creator');
      createdUserId = res.body.data.id;
    });

    it('should reject creation without auth token', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({
          name: 'Unauthorized Creator',
          email: 'unauthorized@dsa.com'
        });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should update user profile details', async () => {
      if (!createdUserId) return;
      const res = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Creator Name',
          attendancePercentage: 99.0
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Creator Name');
      expect(res.body.data.attendancePercentage).toBe(99.0);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete a user when called by admin', async () => {
      if (!createdUserId) return;
      const res = await request(app)
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      createdUserId = null;
    });
  });
});
