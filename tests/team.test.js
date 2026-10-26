const request = require('supertest');
process.env.NODE_ENV = 'test';
const app = require('../server/server');
const prisma = require('../server/config/prisma');

describe('Team Portfolio & Event publishing admin API', () => {
  let adminToken;
  let techHeadToken;
  let memberId;
  let eventId;

  beforeAll(async () => {
    const admin = await request(app).post('/api/auth/login').send({ email: 'admin@dsa.com', password: 'admin123' });
    adminToken = admin.body.token;
    const tech = await request(app).post('/api/auth/login').send({ email: 'anshiv@dsa.com', password: 'admin123' });
    techHeadToken = tech.body.token;
  });

  afterAll(async () => {
    if (memberId) await prisma.user.deleteMany({ where: { id: memberId } });
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.$disconnect();
  });

  describe('Auth on team writes', () => {
    it('should reject member creation without a token', async () => {
      const res = await request(app).post('/api/team').send({ name: 'No Auth' });
      expect(res.statusCode).toBe(401);
    });

    it('should reject member creation from non-admins', async () => {
      const res = await request(app)
        .post('/api/team')
        .set('Authorization', `Bearer ${techHeadToken}`)
        .send({ name: 'Not Admin' });
      expect(res.statusCode).toBe(403);
    });

    it('should hide the admin member list from anonymous users', async () => {
      const res = await request(app).get('/api/team/manage');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Member profiles', () => {
    it('should create a member with a unique slug and no login', async () => {
      const res = await request(app)
        .post('/api/team')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Jest Member', displayRole: 'Lead Photographer', teamCategory: 'photography' });

      expect(res.statusCode).toBe(201);
      memberId = res.body.data.id;
      expect(res.body.data.slug).toMatch(/^jest-member/);
      expect(res.body.data.isPublic).toBe(false);
      const row = await prisma.user.findUnique({ where: { id: memberId } });
      expect(row.password).toBeNull();
    });

    it('should update profile fields including JSON fields', async () => {
      const res = await request(app)
        .put(`/api/team/${memberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          bio: 'Bio text',
          skills: ['Portraits', 'Lighting'],
          socials: { instagram: 'https://instagram.com/jest' },
          mediaDNA: { storytelling: 40 },
          credits: ['Meraki 2026'],
          isPublic: true
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.bio).toBe('Bio text');
      expect(res.body.data.skills).toEqual(['Portraits', 'Lighting']);
      expect(res.body.data.socials).toEqual({ instagram: 'https://instagram.com/jest' });
      expect(res.body.data.mediaDNA).toEqual({ storytelling: 40 });
      expect(res.body.data.isPublic).toBe(true);
    });

    it('should reject an invalid team category', async () => {
      const res = await request(app)
        .put(`/api/team/${memberId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ teamCategory: 'astronauts' });
      expect(res.statusCode).toBe(400);
    });

    it('should set and read back the member portfolio', async () => {
      const media = await prisma.mediaAsset.findFirst();
      const put = await request(app)
        .put(`/api/team/${memberId}/portfolio`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ mediaId: media.id, role: 'Second shooter' }] });
      expect(put.statusCode).toBe(200);

      const res = await request(app)
        .get(`/api/team/manage/${memberId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.portfolio).toHaveLength(1);
      expect(res.body.data.portfolio[0].id).toBe(media.id);
      expect(res.body.data.portfolio[0].creditRole).toBe('Second shooter');
    });

    it('should refuse to delete members who have a login', async () => {
      const admin = await prisma.user.findFirst({ where: { email: 'admin@dsa.com' } });
      const res = await request(app)
        .delete(`/api/team/${admin.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(400);
    });

    it('should delete a profile-only member', async () => {
      const res = await request(app)
        .delete(`/api/team/${memberId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(await prisma.mediaCredit.count({ where: { userId: memberId } })).toBe(0);
      memberId = null;
    });
  });

  describe('Event publishing', () => {
    it('should create an event with an auto slug as a draft', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Jest Fest 2026', venue: 'Main Hall' });

      expect(res.statusCode).toBe(201);
      eventId = res.body.data.id;
      expect(res.body.data.slug).toMatch(/^jest-fest-2026/);
      expect(res.body.data.isPublished).toBe(false);
    });

    it('should 404 unpublished events on the public lookup', async () => {
      const ev = await prisma.event.findUnique({ where: { id: eventId } });
      const res = await request(app).get(`/api/events/${ev.slug}?published=true`);
      expect(res.statusCode).toBe(404);
    });

    it('should publish and then resolve by slug', async () => {
      const patch = await request(app)
        .patch(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPublished: true, summary: 'One-line summary' });
      expect(patch.statusCode).toBe(200);

      const ev = await prisma.event.findUnique({ where: { id: eventId } });
      const res = await request(app).get(`/api/events/${ev.slug}?published=true`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.summary).toBe('One-line summary');
      expect(Array.isArray(res.body.data.photos)).toBe(true);
      expect(Array.isArray(res.body.data.videos)).toBe(true);
    });

    it('should list only published events with ?published=true', async () => {
      const res = await request(app).get('/api/events?published=true');
      expect(res.statusCode).toBe(200);
      res.body.data.forEach(e => expect(e.isPublished).toBe(true));
    });
  });
});
