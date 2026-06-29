import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '@salesense/db';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArchiveStatus } from '@salesense/db';

const mockPrismaService = {
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  productBarcode: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product without barcode', async () => {
      const dto = { name: 'Milk', sellingPricePaise: 3000 };
      const createdProduct = { id: 'prod_1', storeId: 'store_1', name: 'Milk', status: ArchiveStatus.ACTIVE };
      
      prisma.product.create.mockResolvedValue(createdProduct);

      const result = await service.create('store_1', dto);
      expect(result).toEqual(createdProduct);
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          storeId: 'store_1',
          name: 'Milk',
          sellingPricePaise: 3000,
          status: ArchiveStatus.ACTIVE,
        },
        include: { barcodes: true },
      });
    });

    it('should create a product with a barcode nested', async () => {
      const dto = { name: 'Milk', sellingPricePaise: 3000, barcode: '123' };
      prisma.product.create.mockResolvedValue({ id: 'prod_1' });

      await service.create('store_1', dto);
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          storeId: 'store_1',
          name: 'Milk',
          sellingPricePaise: 3000,
          status: ArchiveStatus.ACTIVE,
          barcodes: {
            create: {
              storeId: 'store_1',
              barcode: '123',
              isPrimary: true,
            },
          },
        },
        include: { barcodes: true },
      });
    });
  });

  describe('findByBarcode', () => {
    it('should return product if barcode found', async () => {
      prisma.productBarcode.findUnique.mockResolvedValue({
        product: { id: 'prod_1', name: 'Milk' },
      });
      const result = await service.findByBarcode('store_1', '123');
      expect(result).toEqual({ id: 'prod_1', name: 'Milk' });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.productBarcode.findUnique.mockResolvedValue(null);
      await expect(service.findByBarcode('store_1', '123')).rejects.toThrow(NotFoundException);
    });
  });
});
