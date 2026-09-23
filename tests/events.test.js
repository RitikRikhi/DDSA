const request = require('supertest');
process.env.NODE_ENV = 'test';
const app = require('../server/server');
const prisma = require('../server/config/prisma');

describe('Events & Assignments API Suite', () => {
  let adminToken;
  let testEventId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@dsa.com', password: 'admin123' });
    adminToken = res.body.token;
  });

  afterAll(async () => {
    if (testEventId) {
      await prisma.event.deleteMany({ where: { id: testEventId } });
    }
    await prisma.$disconnect();
  });

  describe('GET /api/events', () => {
    it('should retrieve list of all events with status and crew assignments', async () => {
      const res = await request(app).get('/api/events');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(20);
      expect(res.body.data[0]).toHaveProperty('title');
      expect(res.body.data[0]).toHaveProperty('status');
      expect(res.body.data[0]).toHaveProperty('venue');
    });

    it('should filter events by status (planning, live, completed)', async () => {
      const res = await request(app).get('/api/events?status=live');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach(event => {
        expect(event.status).toBe('live');
      });
    });
  });

  describe('POST /api/events', () => {
    it('should create a new event when called by authorized user', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Automated Test Mega Festival',
          venue: 'Main Sports Complex',
          date: '2026-06-15',
          time: '05:00 PM',
          status: 'planning',
          priority: 'high',
          description: 'A test event created by the automated test suite',
          assignedTeam: ['Prince Kumar', 'Anshiv']
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('Automated Test Mega Festival');
      expect(res.body.data.assignedTeam.length).toBeGreaterThan(0);
      testEventId = res.body.data.id;
    });

    it('should fail creation with invalid payload (missing venue)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Incomplete Event'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('PATCH /api/events/:id', () => {
    it('should update event status to live', async () => {
      if (!testEventId) return;
      const res = await request(app)
        .patch(`/api/events/${testEventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'live',
          completedTasks: 8
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('live');
      expect(res.body.data.completedTasks).toBe(8);
    });
  });

  describe('POST /api/events/:id/assign', () => {
    it('should assign a crew member to the event', async () => {
      if (!testEventId) return;
      const res = await request(app)
        .post(`/api/events/${testEventId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userName: 'Prince Kumar',
          responsibility: 'Lead Drone Pilot'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.responsibility).toBe('Lead Drone Pilot');
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('should delete the event successfully', async () => {
      if (!testEventId) return;
      const res = await request(app)
        .delete(`/api/events/${testEventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      testEventId = null;
    });
  });
});
