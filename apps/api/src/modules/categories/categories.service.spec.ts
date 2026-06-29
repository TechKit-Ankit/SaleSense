import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@salesense/db';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArchiveStatus } from '@salesense/db';

const mockPrismaService = {
  category: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: any; // using any for simplicity in mock

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category', async () => {
      const dto = { name: 'Dairy' };
      const createdCategory = { id: 'cat_1', storeId: 'store_1', name: 'Dairy', status: ArchiveStatus.ACTIVE };
      
      prisma.category.create.mockResolvedValue(createdCategory);

      const result = await service.create('store_1', dto);
      expect(result).toEqual(createdCategory);
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          storeId: 'store_1',
          name: 'Dairy',
          parentId: null,
          status: ArchiveStatus.ACTIVE,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a category if it belongs to the store', async () => {
      const cat = { id: 'cat_1', storeId: 'store_1', name: 'Dairy' };
      prisma.category.findUnique.mockResolvedValue(cat);

      const result = await service.findOne('store_1', 'cat_1');
      expect(result).toEqual(cat);
    });

    it('should throw NotFoundException if category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne('store_1', 'cat_1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if category belongs to another store', async () => {
      const cat = { id: 'cat_1', storeId: 'other_store', name: 'Dairy' };
      prisma.category.findUnique.mockResolvedValue(cat);
      await expect(service.findOne('store_1', 'cat_1')).rejects.toThrow(NotFoundException);
    });
  });
});
