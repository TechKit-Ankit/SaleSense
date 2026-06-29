import { Test, TestingModule } from '@nestjs/testing';
import { BrandsService } from './brands.service';
import { PrismaService } from '@salesense/db';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArchiveStatus } from '@salesense/db';

const mockPrismaService = {
  brand: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('BrandsService', () => {
  let service: BrandsService;
  let prisma: any; // using any for simplicity in mock

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BrandsService>(BrandsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a brand', async () => {
      const dto = { name: 'Amul' };
      const createdBrand = { id: 'brand_1', storeId: 'store_1', name: 'Amul', status: ArchiveStatus.ACTIVE };
      
      prisma.brand.create.mockResolvedValue(createdBrand);

      const result = await service.create('store_1', dto);
      expect(result).toEqual(createdBrand);
      expect(prisma.brand.create).toHaveBeenCalledWith({
        data: {
          storeId: 'store_1',
          name: 'Amul',
          status: ArchiveStatus.ACTIVE,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a brand if it belongs to the store', async () => {
      const brand = { id: 'brand_1', storeId: 'store_1', name: 'Amul' };
      prisma.brand.findUnique.mockResolvedValue(brand);

      const result = await service.findOne('store_1', 'brand_1');
      expect(result).toEqual(brand);
    });

    it('should throw NotFoundException if brand does not exist', async () => {
      prisma.brand.findUnique.mockResolvedValue(null);
      await expect(service.findOne('store_1', 'brand_1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if brand belongs to another store', async () => {
      const brand = { id: 'brand_1', storeId: 'other_store', name: 'Amul' };
      prisma.brand.findUnique.mockResolvedValue(brand);
      await expect(service.findOne('store_1', 'brand_1')).rejects.toThrow(NotFoundException);
    });
  });
});
