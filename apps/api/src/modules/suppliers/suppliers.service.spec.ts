import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '@salesense/db';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArchiveStatus } from '@salesense/db';

const mockPrismaService = {
  supplier: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a supplier', async () => {
      const dto = { name: 'Supplier A' };
      const created = { id: 'supp_1', storeId: 'store_1', name: 'Supplier A', status: ArchiveStatus.ACTIVE };
      
      prisma.supplier.create.mockResolvedValue(created);

      const result = await service.create('store_1', dto);
      expect(result).toEqual(created);
      expect(prisma.supplier.create).toHaveBeenCalledWith({
        data: {
          storeId: 'store_1',
          name: 'Supplier A',
          phone: null,
          gstNumber: null,
          address: null,
          status: ArchiveStatus.ACTIVE,
        },
      });
    });
  });
});
