const request = require('supertest');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
process.env.NODE_ENV = 'test';
// Keep uploads on local disk during tests (dotenv won't override these)
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
const app = require('../server/server');
const prisma = require('../server/config/prisma');
const { deleteStoredFile } = require('../server/utils/mediaProcessor');

const uploadsDir = path.resolve(__dirname, '../server/uploads');

describe('Media Assets & Gallery API Suite', () => {
  let adminToken;
  let techHeadToken;
  let testFilePath;
  const createdIds = [];

  beforeAll(async () => {
    const admin = await request(app).post('/api/auth/login').send({ email: 'admin@dsa.com', password: 'admin123' });
    adminToken = admin.body.token;
    const tech = await request(app).post('/api/auth/login').send({ email: 'anshiv@dsa.com', password: 'admin123' });
    techHeadToken = tech.body.token;

    testFilePath = path.resolve(__dirname, 'test_sample.png');
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#c8102e' } }).png().toBuffer();
    fs.writeFileSync(testFilePath, png);
  });

  afterAll(async () => {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    if (createdIds.length) {
      const rows = await prisma.mediaAsset.findMany({ where: { id: { in: createdIds } } });
      for (const row of rows) await deleteStoredFile(row);
      await prisma.mediaAsset.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  });

  const upload = (token, fields = {}) => {
    let req = request(app).post('/api/media/upload');
    if (token) req = req.set('Authorization', `Bearer ${token}`);
    req = req.attach('media', testFilePath);
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req;
  };

  describe('GET /api/media & /api/photos', () => {
    it('should list media assets with pagination and metadata', async () => {
      const res = await request(app).get('/api/media?page=1&limit=20');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(20);
      expect(res.body.total).toBeGreaterThanOrEqual(100);
      expect(res.body.data[0]).toHaveProperty('category');
      expect(res.body.data[0]).toHaveProperty('fileUrl');
    });

    it('should filter media by category', async () => {
      const res = await request(app).get('/api/media?category=photography');

      expect(res.statusCode).toBe(200);
      res.body.data.forEach(item => {
        expect(item.category).toBe('photography');
      });
    });

    it('should filter media by type (image/video)', async () => {
      const res = await request(app).get('/api/media?type=video');

      expect(res.statusCode).toBe(200);
      res.body.data.forEach(item => {
        expect(item.type).toBe('video');
      });
    });
  });

  describe('POST /api/media/upload', () => {
    // No file attached: auth rejects before the body is read, and a large
    // pending body would make supertest see ECONNRESET instead of the status.
    it('should reject uploads without a token', async () => {
      const res = await request(app).post('/api/media/upload').field('category', 'photography');
      expect(res.statusCode).toBe(401);
    });

    it('should reject uploads from non-admin roles', async () => {
      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${techHeadToken}`)
        .field('category', 'photography');
      expect(res.statusCode).toBe(403);
    });

    it('should upload an image, read its real dimensions and make a thumbnail', async () => {
      const res = await upload(adminToken, { category: 'photography', tags: 'Test, Automated', title: 'Jest sample' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      const item = res.body.data;
      createdIds.push(item.id);
      expect(item.category).toBe('photography');
      expect(item.title).toBe('Jest sample');
      expect(item.width).toBe(40);
      expect(item.height).toBe(30);
      expect(item.tags).toEqual(['Test', 'Automated']);
      expect(item.isPublished).toBe(true);
      expect(item.thumbnailUrl).toMatch(/^\/media\/thumbs\/.+-thumb\.webp$/);
      expect(fs.existsSync(path.join(uploadsDir, item.thumbnailUrl.replace('/media/', '')))).toBe(true);
    });

    it('should reject an unknown category', async () => {
      const res = await upload(adminToken, { category: 'not-a-category' });
      expect(res.statusCode).toBe(400);
    });

    it('should reject upload without file', async () => {
      const res = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'photography' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('Drafts, editing, ordering and deletion', () => {
    let draftId;

    it('should hide drafts from the public but show them to admins', async () => {
      const up = await upload(adminToken, { category: 'archives', publish: 'false' });
      expect(up.statusCode).toBe(201);
      draftId = up.body.data.id;
      createdIds.push(draftId);
      expect(up.body.data.isPublished).toBe(false);

      const pub = await request(app).get('/api/media?category=archives&limit=200');
      expect(pub.body.data.some(i => i.id === draftId)).toBe(false);
      const single = await request(app).get(`/api/media/${draftId}`);
      expect(single.statusCode).toBe(404);

      const adm = await request(app)
        .get('/api/media?category=archives&status=draft&limit=200')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adm.body.data.some(i => i.id === draftId)).toBe(true);
    });

    it('should not let anonymous users see drafts via status=all', async () => {
      const res = await request(app).get('/api/media?category=archives&status=all&limit=200');
      expect(res.body.data.some(i => i.id === draftId)).toBe(false);
    });

    it('should edit title, publish state and credits', async () => {
      const member = await prisma.user.findFirst({ where: { email: 'anshiv@dsa.com' } });
      const res = await request(app)
        .patch(`/api/media/${draftId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Archive frame', isPublished: true, credits: [{ userId: member.id, role: 'Photographer' }] });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.title).toBe('Archive frame');
      expect(res.body.data.isPublished).toBe(true);
      expect(res.body.data.credits).toEqual([{ userId: member.id, name: member.name, role: 'Photographer' }]);
    });

    it('should reject edits without a token', async () => {
      const res = await request(app).patch(`/api/media/${draftId}`).send({ title: 'x' });
      expect(res.statusCode).toBe(401);
    });

    it('should save a custom order', async () => {
      const [a, b] = createdIds;
      const res = await request(app)
        .patch('/api/media/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ id: a, sortOrder: 2 }, { id: b, sortOrder: 1 }] });
      expect(res.statusCode).toBe(200);
      const rows = await prisma.mediaAsset.findMany({ where: { id: { in: [a, b] } } });
      expect(rows.find(r => r.id === a).sortOrder).toBe(2);
      expect(rows.find(r => r.id === b).sortOrder).toBe(1);
    });

    it('should apply bulk actions', async () => {
      const res = await request(app)
        .patch('/api/media/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: createdIds, action: 'unpublish' });
      expect(res.statusCode).toBe(200);
      const rows = await prisma.mediaAsset.findMany({ where: { id: { in: createdIds } } });
      rows.forEach(r => expect(r.isPublished).toBe(false));
    });

    it('should delete the asset and its stored files', async () => {
      const asset = await prisma.mediaAsset.findUnique({ where: { id: draftId } });
      const filePath = path.join(uploadsDir, asset.fileUrl.replace('/media/', ''));
      expect(fs.existsSync(filePath)).toBe(true);

      const res = await request(app)
        .delete(`/api/media/${draftId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(fs.existsSync(filePath)).toBe(false);
      expect(await prisma.mediaCredit.count({ where: { mediaId: draftId } })).toBe(0);
    });
  });
});
