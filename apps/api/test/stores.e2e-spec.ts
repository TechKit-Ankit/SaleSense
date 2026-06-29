import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '@salesense/db';

describe('Stores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Register a test user and get token
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Store Test User',
        email: 'storetest@salesense.local',
        password: 'password123',
      });
    
    accessToken = res.body.data.accessToken;
    testUserId = res.body.data.user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      // Cleanup
      await prisma.storeUser.deleteMany({
        where: { userId: testUserId }
      });
      await prisma.user.delete({ where: { id: testUserId } });
    }
    await app.close();
  });

  let createdStoreId: string;

  it('/stores (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/stores')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'My Test Store',
        currency: 'INR',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('My Test Store');
    expect(res.body.data.id).toBeDefined();
    
    createdStoreId = res.body.data.id;
  });

  it('/stores (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/stores')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some(s => s.id === createdStoreId)).toBe(true);
  });

  it('/stores/:id (GET) with x-store-id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/stores/${createdStoreId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-store-id', createdStoreId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdStoreId);
  });
});
