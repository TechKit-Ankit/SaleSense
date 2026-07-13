import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '@salesense/db';

const mockPrismaService: any = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  store: { create: jest.fn() },
  storeUser: { create: jest.fn() },
  refreshSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(mockPrismaService) : Promise.all(arg))),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mocked-token'),
  verify: jest.fn(),
  decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 7 * 86400 }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'JWT_SECRET') return 'secret';
              if (key === 'JWT_ACCESS_EXPIRY') return '15m';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('mocked-token');
    mockJwtService.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 7 * 86400 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate an access token', () => {
    const token = (service as any).generateAccessToken('test-user-id', 'test@example.com');
    expect(token).toBe('mocked-token');
  });

  describe('refresh (rotation + theft detection, design doc 0010)', () => {
    const validPayload = { sub: 'user_1', type: 'refresh', jti: 'j1' };
    const activeUser = { id: 'user_1', status: 'ACTIVE', email: 'a@b.c', passwordHash: 'x' };
    const liveSession = {
      id: 'sess_1',
      familyId: 'fam_1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    };

    it('rotates: issues a new refresh token and revokes the old session with lineage', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockPrismaService.refreshSession.findUnique.mockResolvedValue(liveSession);
      mockPrismaService.user.findUnique.mockResolvedValue(activeUser);

      const result = await service.refresh('old-token');

      expect(result.accessToken).toBe('mocked-token');
      expect(result.refreshToken).toBe('mocked-token');
      // new session created in the same family…
      expect(mockPrismaService.refreshSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ familyId: 'fam_1' }) }),
      );
      // …and the old one revoked with replacedById lineage
      expect(mockPrismaService.refreshSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess_1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date), replacedById: expect.any(String) }),
        }),
      );
    });

    it('detects reuse of a rotated token and revokes the whole family', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockPrismaService.refreshSession.findUnique.mockResolvedValue({
        ...liveSession,
        revokedAt: new Date(), // already rotated → this is a stolen replay
      });

      await expect(service.refresh('stolen-token')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

      expect(mockPrismaService.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam_1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects a signature-valid token with no session record (pre-rotation era or forged env)', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockPrismaService.refreshSession.findUnique.mockResolvedValue(null);

      await expect(service.refresh('unknown-token')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(mockPrismaService.refreshSession.create).not.toHaveBeenCalled();
    });

    it('rejects an expired session', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockPrismaService.refreshSession.findUnique.mockResolvedValue({
        ...liveSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });
  });

  describe('logout', () => {
    it('revokes the session family server-side', async () => {
      mockPrismaService.refreshSession.findUnique.mockResolvedValue({
        id: 'sess_1',
        familyId: 'fam_1',
      });

      const result = await service.logout('some-refresh-token');

      expect(result).toEqual({ revoked: true });
      expect(mockPrismaService.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam_1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('degrades gracefully without a token (client-side-only logout)', async () => {
      const result = await service.logout(undefined);
      expect(result).toEqual({ revoked: false });
      expect(mockPrismaService.refreshSession.updateMany).not.toHaveBeenCalled();
    });
  });
});
