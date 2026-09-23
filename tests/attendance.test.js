const request = require('supertest');
process.env.NODE_ENV = 'test';
const app = require('../server/server');
const prisma = require('../server/config/prisma');

describe('Attendance API Suite', () => {
  let createdAttendanceId;

  afterAll(async () => {
    if (createdAttendanceId) {
      await prisma.attendance.deleteMany({ where: { id: createdAttendanceId } });
    }
    await prisma.$disconnect();
  });

  describe('GET /api/attendance', () => {
    it('should list all attendance records', async () => {
      const res = await request(app).get('/api/attendance');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(40);
    });

    it('should calculate monthly attendance stats', async () => {
      const res = await request(app).get('/api/attendance/monthly');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toHaveProperty('totalRecords');
      expect(res.body.stats).toHaveProperty('attendanceRate');
      expect(res.body.stats.weeklyBreakdown.length).toBe(4);
    });
  });

  describe('POST /api/attendance/check-in & check-out', () => {
    it('should record a new check-in entry', async () => {
      const res = await request(app)
        .post('/api/attendance/check-in')
        .send({
          creator: 'Prince Kumar',
          date: '2026-06-20',
          checkIn: '09:30 AM',
          status: 'On Duty'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.creator).toBe('Prince Kumar');
      createdAttendanceId = res.body.data.id;
    });

    it('should record check-out and log total production hours', async () => {
      if (!createdAttendanceId) return;
      const res = await request(app)
        .post('/api/attendance/check-out')
        .send({
          id: createdAttendanceId,
          checkOut: '06:00 PM',
          totalHours: 8.5
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalHours).toBe(8.5);
      expect(res.body.data.status).toBe('Present');
    });
  });
});
