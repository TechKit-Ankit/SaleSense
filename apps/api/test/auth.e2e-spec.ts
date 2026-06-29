import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../src/app.module';

import { PrismaService } from '@salesense/db';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/login (POST) with invalid credentials should return 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nonexistent@salesense.local', password: 'wrongpassword' })
      .expect(401)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      });
  });

  it('/auth/me (GET) without token should return 401', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);
  });
});
