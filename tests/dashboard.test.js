const request = require('supertest');
process.env.NODE_ENV = 'test';
const app = require('../server/server');
const prisma = require('../server/config/prisma');

describe('Dashboard Telemetry & Aggregated KPI Suite', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/dashboard', () => {
    it('should return all required KPIs in one high-performance response', async () => {
      const res = await request(app).get('/api/dashboard');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('kpis');
      expect(res.body.data.kpis).toHaveProperty('totalMembers');
      expect(res.body.data.kpis).toHaveProperty('activeEvents');
      expect(res.body.data.kpis).toHaveProperty('uploadedPhotos');
      expect(res.body.data.kpis).toHaveProperty('attendanceRate');
      expect(res.body.data.kpis).toHaveProperty('gearStatusString');

      expect(res.body.data.kpis.totalMembers).toBeGreaterThanOrEqual(60);
      expect(res.body.data.kpis.uploadedPhotos).toBeGreaterThanOrEqual(200);

      // Verify upcoming events structure
      expect(res.body.data).toHaveProperty('upcomingEvents');
      expect(Array.isArray(res.body.data.upcomingEvents)).toBe(true);
      if (res.body.data.upcomingEvents.length > 0) {
        expect(res.body.data.upcomingEvents[0]).toHaveProperty('title');
        expect(res.body.data.upcomingEvents[0]).toHaveProperty('assignedTeam');
      }

      // Verify recent activities
      expect(res.body.data).toHaveProperty('recentActivities');
      expect(Array.isArray(res.body.data.recentActivities)).toBe(true);

      // Verify analytics
      expect(res.body.data).toHaveProperty('analytics');
      expect(res.body.data.analytics).toHaveProperty('weeklyProductionHours');
      expect(res.body.data.analytics).toHaveProperty('attendanceWeeks');
      expect(res.body.data.analytics).toHaveProperty('departmentBreakdown');
    });
  });

  describe('GET /api/health', () => {
    it('should return healthy database connection state', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('Healthy');
      expect(res.body).toHaveProperty('database');
    });
  });
});
