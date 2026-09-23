const request = require('supertest');
process.env.NODE_ENV = 'test';
const app = require('../server/server');
const prisma = require('../server/config/prisma');

describe('Equipment Inventory & Borrow System Suite', () => {
  let adminToken;
  let testGearId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@dsa.com', password: 'admin123' });
    adminToken = res.body.token;
  });

  afterAll(async () => {
    if (testGearId) {
      await prisma.equipment.deleteMany({ where: { id: testGearId } });
    }
    await prisma.$disconnect();
  });

  describe('GET /api/equipment', () => {
    it('should list all equipment items with borrower status', async () => {
      const res = await request(app).get('/api/equipment');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(30);
      expect(res.body.data[0]).toHaveProperty('name');
      expect(res.body.data[0]).toHaveProperty('status');
    });

    it('should filter equipment by category', async () => {
      const res = await request(app).get('/api/equipment?category=Camera');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach(item => {
        expect(item.category.toLowerCase()).toContain('camera');
      });
    });
  });

  describe('POST /api/equipment', () => {
    it('should add a new gear item when called by authorized user', async () => {
      const randomSerial = 'SN-TEST-' + Math.floor(Math.random() * 100000);
      const res = await request(app)
        .post('/api/equipment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Canon Cinema Prime 50mm T1.5',
          category: 'Lens',
          serialNumber: randomSerial,
          condition: 'Excellent',
          status: 'Available'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Canon Cinema Prime 50mm T1.5');
      testGearId = res.body.data.id;
    });
  });

  describe('POST /api/equipment/:id/borrow & return', () => {
    it('should check-out equipment to a borrower', async () => {
      if (!testGearId) return;
      const res = await request(app)
        .post(`/api/equipment/${testGearId}/borrow`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          borrower: 'Prince Kumar',
          expectedReturn: 'Tomorrow 06:00 PM'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('In Use');
      expect(res.body.data.borrower).toBe('Prince Kumar');
    });

    it('should check-in equipment and mark available', async () => {
      if (!testGearId) return;
      const res = await request(app)
        .post(`/api/equipment/${testGearId}/return`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          condition: 'Excellent'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('Available');
    });
  });
});
