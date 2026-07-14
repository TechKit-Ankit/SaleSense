import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '@salesense/db';

const mockPrismaService = {
  customer: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
  });

  it('searches by name or phone within the store', async () => {
    mockPrismaService.customer.findMany.mockResolvedValue([]);

    await service.list('store_1', '98');

    expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          storeId: 'store_1',
          OR: [
            { name: { contains: '98', mode: 'insensitive' } },
            { phone: { contains: '98' } },
          ],
        }),
      }),
    );
  });

  it('requires at least a name or phone to create', async () => {
    await expect(service.create('store_1', {})).rejects.toThrow(BadRequestException);
    expect(mockPrismaService.customer.create).not.toHaveBeenCalled();
  });

  it('creates a customer scoped to the store', async () => {
    mockPrismaService.customer.create.mockResolvedValue({ id: 'c1' });

    await service.create('store_1', { name: 'Asha', phone: '9812345678' });

    expect(mockPrismaService.customer.create).toHaveBeenCalledWith({
      data: { storeId: 'store_1', name: 'Asha', phone: '9812345678', gstNumber: null },
    });
  });

  it('scopes get/update to the store', async () => {
    mockPrismaService.customer.findUnique.mockResolvedValue({ id: 'c1', storeId: 'store_2' });

    await expect(service.get('store_1', 'c1')).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    await expect(service.update('store_1', 'c1', { name: 'X' })).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});
