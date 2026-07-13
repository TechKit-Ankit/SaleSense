import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { PrismaService } from '@salesense/db';

const mockTx: any = {
  refund: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
  refundItem: { findMany: jest.fn() },
  inventoryBatch: { findUnique: jest.fn(), update: jest.fn() },
  stockMovement: { create: jest.fn() },
  sale: { update: jest.fn() },
  auditLog: { create: jest.fn() },
};

const mockPrismaService: any = {
  sale: { findUnique: jest.fn() },
  refund: { findUnique: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn((cb: any) => cb(mockTx)),
};

// A sale of 2 units @ line total ₹100 (10000p), sold from batch b1.
const baseSale = {
  id: 'sale_1',
  storeId: 'store_1',
  status: 'COMPLETED',
  items: [
    { id: 'si_1', productId: 'p1', batchId: 'b1', quantity: 2, lineTotalPaise: 10000n, productNameSnapshot: 'Soap' },
  ],
  refunds: [] as any[],
};

describe('RefundsService', () => {
  let service: RefundsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
    jest.clearAllMocks();
  });

  describe('requestRefund', () => {
    it('computes the proportional amount server-side (1 of 2 units of a ₹100 line = ₹50)', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue(baseSale);
      mockTx.refund.create.mockResolvedValue({ id: 'ref_1', items: [] });

      await service.requestRefund('store_1', 'user_1', 'sale_1', {
        reason: 'damaged',
        items: [{ saleItemId: 'si_1', quantity: 1 }],
      } as any);

      expect(mockTx.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refundAmountPaise: 5000n,
            status: 'PENDING_APPROVAL',
            items: { create: [expect.objectContaining({ quantity: 1, refundAmountPaise: 5000n, restock: true, batchId: 'b1' })] },
          }),
        }),
      );
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'REFUND_REQUESTED' }) }),
      );
    });

    it('rejects over-refund including PENDING reservations', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue({
        ...baseSale,
        refunds: [
          { status: 'PENDING_APPROVAL', items: [{ saleItemId: 'si_1', quantity: 1 }] },
        ],
      });

      // 2 sold, 1 already reserved by a pending refund → only 1 refundable
      await expect(
        service.requestRefund('store_1', 'user_1', 'sale_1', {
          reason: 'x',
          items: [{ saleItemId: 'si_1', quantity: 2 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.refund.create).not.toHaveBeenCalled();
    });

    it('REJECTED refunds release their reservation', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue({
        ...baseSale,
        refunds: [{ status: 'REJECTED', items: [{ saleItemId: 'si_1', quantity: 2 }] }],
      });
      mockTx.refund.create.mockResolvedValue({ id: 'ref_2', items: [] });

      await service.requestRefund('store_1', 'user_1', 'sale_1', {
        reason: 'retry after rejection',
        items: [{ saleItemId: 'si_1', quantity: 2 }],
      } as any);

      expect(mockTx.refund.create).toHaveBeenCalled();
    });

    it('rejects refunds on foreign-store sales and non-refundable statuses', async () => {
      mockPrismaService.sale.findUnique.mockResolvedValue({ ...baseSale, storeId: 'store_2' });
      await expect(
        service.requestRefund('store_1', 'u', 'sale_1', { reason: 'x', items: [{ saleItemId: 'si_1', quantity: 1 }] } as any),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });

      mockPrismaService.sale.findUnique.mockResolvedValue({ ...baseSale, status: 'CANCELLED' });
      await expect(
        service.requestRefund('store_1', 'u', 'sale_1', { reason: 'x', items: [{ saleItemId: 'si_1', quantity: 1 }] } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve / reject (state machine = idempotency)', () => {
    it('approves via an atomic claim (status guard in the WHERE, not a prior read)', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue({ id: 'ref_1', storeId: 'store_1', saleId: 'sale_1', status: 'PENDING_APPROVAL' });
      mockTx.refund.updateMany.mockResolvedValue({ count: 1 });
      mockTx.refund.findUnique.mockResolvedValue({ id: 'ref_1', status: 'APPROVED' });

      const result = await service.approve('store_1', 'manager_1', 'ref_1');

      expect(result!.status).toBe('APPROVED');
      expect(mockTx.refund.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ref_1', status: 'PENDING_APPROVAL' },
          data: expect.objectContaining({ status: 'APPROVED', approvedByUserId: 'manager_1' }),
        }),
      );
    });

    it('409s when the claim loses - already transitioned or concurrent winner', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue({ id: 'ref_1', storeId: 'store_1', status: 'COMPLETED' });
      mockTx.refund.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.approve('store_1', 'u', 'ref_1')).rejects.toMatchObject({ code: 'SALE_ALREADY_PROCESSED' });
      await expect(service.reject('store_1', 'u', 'ref_1')).rejects.toMatchObject({ code: 'SALE_ALREADY_PROCESSED' });
    });
  });

  describe('complete', () => {
    const approvedRefund = {
      id: 'ref_1',
      storeId: 'store_1',
      saleId: 'sale_1',
      status: 'APPROVED',
      reason: 'damaged',
      refundAmountPaise: 5000n,
      items: [
        { saleItemId: 'si_1', productId: 'p1', batchId: 'b1', quantity: 1, restock: true },
      ],
      sale: { id: 'sale_1', items: [{ id: 'si_1', quantity: 2 }] },
    };

    it('restocks the batch, writes REFUND_IN, and marks the sale PARTIALLY_REFUNDED', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue(approvedRefund);
      mockTx.refund.updateMany.mockResolvedValue({ count: 1 });
      mockTx.refund.findUnique.mockResolvedValue({ id: 'ref_1', status: 'COMPLETED', items: [] });
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'b1', currentQuantity: 3 });
      mockTx.refundItem.findMany.mockResolvedValue([{ quantity: 1 }]); // 1 of 2 refunded

      await service.complete('store_1', 'manager_1', 'ref_1', 'req_1');

      expect(mockTx.inventoryBatch.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { currentQuantity: 4 } });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'REFUND_IN',
            quantityDelta: 1,
            quantityAfter: 4,
            referenceType: 'REFUND',
            referenceId: 'ref_1',
          }),
        }),
      );
      expect(mockTx.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED' }) }),
      );
    });

    it('marks the sale REFUNDED + paymentStatus REFUNDED when every unit is refunded', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue(approvedRefund);
      mockTx.refund.updateMany.mockResolvedValue({ count: 1 });
      mockTx.refund.findUnique.mockResolvedValue({ id: 'ref_1', status: 'COMPLETED', items: [] });
      mockTx.inventoryBatch.findUnique.mockResolvedValue({ id: 'b1', currentQuantity: 3 });
      mockTx.refundItem.findMany.mockResolvedValue([{ quantity: 2 }]); // all units now refunded

      await service.complete('store_1', 'manager_1', 'ref_1');

      expect(mockTx.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REFUNDED', paymentStatus: 'REFUNDED' }),
        }),
      );
    });

    it('moves no stock for restock=false items', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue({
        ...approvedRefund,
        items: [{ saleItemId: 'si_1', productId: 'p1', batchId: 'b1', quantity: 1, restock: false }],
      });
      mockTx.refund.updateMany.mockResolvedValue({ count: 1 });
      mockTx.refund.findUnique.mockResolvedValue({ id: 'ref_1', status: 'COMPLETED', items: [] });
      mockTx.refundItem.findMany.mockResolvedValue([{ quantity: 1 }]);

      await service.complete('store_1', 'manager_1', 'ref_1');

      expect(mockTx.inventoryBatch.update).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('409s REFUND_APPROVAL_REQUIRED when completing an unapproved refund', async () => {
      mockPrismaService.refund.findUnique.mockResolvedValue({ ...approvedRefund, status: 'PENDING_APPROVAL' });
      mockTx.refund.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.complete('store_1', 'u', 'ref_1')).rejects.toMatchObject({
        code: 'REFUND_APPROVAL_REQUIRED',
      });
    });

    it('a concurrent double-complete loses the claim and restocks NOTHING - TOCTOU guard', async () => {
      // Both requests read status=APPROVED, but the second claim returns count 0.
      mockPrismaService.refund.findUnique.mockResolvedValue(approvedRefund);
      mockTx.refund.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.complete('store_1', 'u', 'ref_1')).rejects.toMatchObject({
        code: 'REFUND_APPROVAL_REQUIRED',
      });
      expect(mockTx.inventoryBatch.update).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
    });
  });
});
