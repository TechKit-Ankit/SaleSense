import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '@salesense/db';

const mockPrismaService = {
  invoice: { findUnique: jest.fn() },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('share-token-mock'),
  verify: jest.fn(),
};

const dbInvoice = {
  id: 'inv_1',
  storeId: 'store_1',
  invoiceNumber: 'INV-2026-2027-00002',
  financialYear: '2026-2027',
  status: 'ISSUED',
  issuedAt: new Date('2026-07-12T10:30:00Z'),
  storeNameSnapshot: 'E2E Audit Store',
  storeAddressSnapshot: null,
  gstNumberSnapshot: null,
  sale: {
    id: 'sale_1',
    createdAt: new Date('2026-07-12T10:30:00Z'),
    paymentStatus: 'PAID',
    subtotalPaise: 10000n,
    discountPaise: 0n,
    taxPaise: 0n,
    totalPaise: 10000n,
    profitPaise: 4000n, // must never reach the response
    items: [
      {
        productNameSnapshot: 'E2E Test Soap',
        hsnCodeSnapshot: null,
        quantity: 2,
        unitSellingPricePaise: 5000n,
        unitPurchasePricePaise: 3000n, // must never reach the response
        discountPaise: 0n,
        taxRateBps: 0,
        taxPaise: 0n,
        lineTotalPaise: 10000n,
        profitPaise: 4000n, // must never reach the response
      },
    ],
    payments: [{ method: 'CASH', amountPaise: 10000n }],
  },
};

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('share-token-mock');
  });

  it('returns the full receipt payload with numbers as integers', async () => {
    mockPrismaService.invoice.findUnique.mockResolvedValue(dbInvoice);

    const result = await service.getInvoice('store_1', 'inv_1');

    expect(result.invoiceNumber).toBe('INV-2026-2027-00002');
    expect(result.store.nameSnapshot).toBe('E2E Audit Store');
    expect(result.sale.totalPaise).toBe(10000);
    expect(result.sale.items[0]).toEqual({
      productNameSnapshot: 'E2E Test Soap',
      hsnCodeSnapshot: null,
      quantity: 2,
      unitSellingPricePaise: 5000,
      discountPaise: 0,
      taxRateBps: 0,
      taxPaise: 0,
      lineTotalPaise: 10000,
    });
    expect(result.sale.payments).toEqual([{ method: 'CASH', amountPaise: 10000 }]);
  });

  it('never leaks cost or profit fields (customer-facing document)', async () => {
    mockPrismaService.invoice.findUnique.mockResolvedValue(dbInvoice);

    const result = await service.getInvoice('store_1', 'inv_1');
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('profitPaise');
    expect(serialized).not.toContain('unitPurchasePricePaise');
  });

  it('throws RESOURCE_NOT_FOUND for a foreign-store invoice', async () => {
    mockPrismaService.invoice.findUnique.mockResolvedValue({ ...dbInvoice, storeId: 'store_2' });

    await expect(service.getInvoice('store_1', 'inv_1')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('throws RESOURCE_NOT_FOUND for an unknown invoice', async () => {
    mockPrismaService.invoice.findUnique.mockResolvedValue(null);

    await expect(service.getInvoice('store_1', 'nope')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  describe('share token + public access (Gate 2 upgrade)', () => {
    it('getInvoice includes a signed shareToken', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(dbInvoice);

      const result = await service.getInvoice('store_1', 'inv_1');

      expect(result.shareToken).toBe('share-token-mock');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { inv: 'inv_1', typ: 'receipt' },
        expect.objectContaining({ expiresIn: '30d' }),
      );
    });

    it('getPublicReceipt resolves a valid token without exposing store id', async () => {
      mockJwtService.verify.mockReturnValue({ inv: 'inv_1', typ: 'receipt' });
      mockPrismaService.invoice.findUnique.mockResolvedValue(dbInvoice);

      const result = await service.getPublicReceipt('valid-token');

      expect(result.invoiceNumber).toBe('INV-2026-2027-00002');
      expect((result as any)._storeId).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('profitPaise');
    });

    it('getPublicReceipt rejects tampered and wrong-type tokens with a generic 404', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('bad signature'); });
      await expect(service.getPublicReceipt('tampered')).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

      mockJwtService.verify.mockReturnValue({ inv: 'inv_1', typ: 'refresh' }); // wrong typ
      await expect(service.getPublicReceipt('wrong-type')).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });

    it('buildPdf renders a real PDF document', async () => {
      mockJwtService.verify.mockReturnValue({ inv: 'inv_1', typ: 'receipt' });
      mockPrismaService.invoice.findUnique.mockResolvedValue(dbInvoice);
      const receipt = await service.getPublicReceipt('valid-token');

      const pdf = await service.buildPdf(receipt);

      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(500);
    });
  });
});