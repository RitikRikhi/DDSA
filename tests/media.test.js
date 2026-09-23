const request = require('supertest');
const path = require('path');
const fs = require('fs');
process.env.NODE_ENV = 'test';
const app = require('../server/server');
const prisma = require('../server/config/prisma');

describe('Media Assets & Gallery API Suite', () => {
  let createdMediaId;

  afterAll(async () => {
    if (createdMediaId) {
      await prisma.mediaAsset.deleteMany({ where: { id: createdMediaId } });
    }
    await prisma.$disconnect();
  });

  describe('GET /api/media & /api/photos', () => {
    it('should list all media assets with pagination and metadata', async () => {
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
      expect(res.body.success).toBe(true);
      res.body.data.forEach(item => {
        expect(item.category).toBe('photography');
      });
    });

    it('should filter media by type (image/video)', async () => {
      const res = await request(app).get('/api/media?type=video');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach(item => {
        expect(item.type).toBe('video');
      });
    });
  });

  describe('POST /api/media/upload', () => {
    it('should upload image file and register metadata in database', async () => {
      // Create a temporary test image buffer
      const testFilePath = path.resolve(__dirname, 'test_sample.png');
      fs.writeFileSync(testFilePath, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d040000000049454e44ae426082', 'hex'));

      const res = await request(app)
        .post('/api/media/upload')
        .attach('media', testFilePath)
        .field('category', 'photography')
        .field('tags', 'Test, Automated');

      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.category).toBe('photography');
      createdMediaId = res.body.data.id;
    });

    it('should reject upload without file', async () => {
      const res = await request(app)
        .post('/api/media/upload')
        .send({ category: 'photography' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });
});
