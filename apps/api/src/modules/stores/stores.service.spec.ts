import { Test, TestingModule } from '@nestjs/testing';
import { StoresService } from './stores.service';
import { PrismaService } from '@salesense/db';
import { BusinessException } from '../../common/errors/business-exception';

describe('StoresService', () => {
  let service: StoresService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)),
    store: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    storeUser: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoresService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StoresService>(StoresService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a store and a storeUser as OWNER', async () => {
      const dto = { name: 'New Store', currency: 'USD' };
      const userId = 'user-123';
      const createdStore = { id: 'store-123', name: 'New Store', currency: 'USD', status: 'ACTIVE' };
      
      mockPrismaService.store.create.mockResolvedValue(createdStore);

      const result = await service.create(userId, dto);

      expect(mockPrismaService.store.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          currency: 'USD',
          timezone: 'Asia/Kolkata',
          gstNumber: undefined,
          addressLine1: undefined,
          addressLine2: undefined,
          city: undefined,
          state: undefined,
          pincode: undefined,
          upiId: undefined,
        },
      });

      expect(mockPrismaService.storeUser.create).toHaveBeenCalledWith({
        data: {
          userId,
          storeId: createdStore.id,
          role: 'OWNER',
        },
      });

      expect(result).toEqual(createdStore);
    });
  });

  describe('requestDeletion', () => {
    it('should change status to PENDING_DELETION and record timestamp', async () => {
      const storeId = 'store-123';
      mockPrismaService.store.findUnique.mockResolvedValue({ id: storeId, status: 'ACTIVE' });
      mockPrismaService.store.update.mockResolvedValue({ id: storeId, status: 'PENDING_DELETION' });

      await service.requestDeletion(storeId);

      expect(mockPrismaService.store.update).toHaveBeenCalledWith({
        where: { id: storeId },
        data: expect.objectContaining({
          status: 'PENDING_DELETION',
          deletionRequestedAt: expect.any(Date),
        }),
      });
    });

    it('should throw error if already pending deletion', async () => {
      const storeId = 'store-123';
      mockPrismaService.store.findUnique.mockResolvedValue({ id: storeId, status: 'PENDING_DELETION' });

      await expect(service.requestDeletion(storeId)).rejects.toThrow(BusinessException);
    });
  });
});
