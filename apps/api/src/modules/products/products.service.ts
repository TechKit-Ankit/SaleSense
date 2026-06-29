import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from '@salesense/db';
import { ArchiveStatus, Prisma } from '@salesense/db';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, createProductDto: CreateProductDto) {
    const { barcode, ...productData } = createProductDto;

    try {
      const data: Prisma.ProductUncheckedCreateInput = {
        storeId,
        name: productData.name,
        sellingPricePaise: productData.sellingPricePaise,
        status: productData.status ?? ArchiveStatus.ACTIVE,
      };
      if (productData.sku !== undefined) data.sku = productData.sku ?? null;
      if (productData.categoryId !== undefined) data.categoryId = productData.categoryId ?? null;
      if (productData.brandId !== undefined) data.brandId = productData.brandId ?? null;
      if (productData.description !== undefined) data.description = productData.description ?? null;
      if (productData.hsnCode !== undefined) data.hsnCode = productData.hsnCode ?? null;
      if (productData.taxRateBps !== undefined) data.taxRateBps = productData.taxRateBps;
      if (productData.mrpPaise !== undefined) data.mrpPaise = productData.mrpPaise ?? null;
      if (productData.trackInventory !== undefined) data.trackInventory = productData.trackInventory;
      if (productData.expiryTracked !== undefined) data.expiryTracked = productData.expiryTracked;

      if (barcode) {
        data.barcodes = {
          create: {
            storeId,
            barcode,
            isPrimary: true,
          },
        };
      }

      const product = await this.prisma.product.create({
        data,
        include: { barcodes: true },
      });
      return product;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A product with this SKU or barcode already exists.');
      }
      throw error;
    }
  }

  async findAll(storeId: string) {
    return this.prisma.product.findMany({
      where: { storeId },
      include: { barcodes: true, category: true, brand: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(storeId: string, id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { barcodes: true, category: true, brand: true },
    });

    if (!product || product.storeId !== storeId) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(storeId: string, id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(storeId, id);
    const { barcode, ...productData } = updateProductDto;

    try {
      const data: Prisma.ProductUncheckedUpdateInput = {};
      if (productData.name !== undefined) data.name = productData.name;
      if (productData.sku !== undefined) data.sku = productData.sku ?? null;
      if (productData.categoryId !== undefined) data.categoryId = productData.categoryId ?? null;
      if (productData.brandId !== undefined) data.brandId = productData.brandId ?? null;
      if (productData.description !== undefined) data.description = productData.description ?? null;
      if (productData.hsnCode !== undefined) data.hsnCode = productData.hsnCode ?? null;
      if (productData.taxRateBps !== undefined) data.taxRateBps = productData.taxRateBps;
      if (productData.mrpPaise !== undefined) data.mrpPaise = productData.mrpPaise ?? null;
      if (productData.sellingPricePaise !== undefined) data.sellingPricePaise = productData.sellingPricePaise;
      if (productData.trackInventory !== undefined) data.trackInventory = productData.trackInventory;
      if (productData.expiryTracked !== undefined) data.expiryTracked = productData.expiryTracked;
      if (productData.status !== undefined) data.status = productData.status;

      const product = await this.prisma.product.update({
        where: { id },
        data,
        include: { barcodes: true },
      });
      return product;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A product with this SKU already exists.');
      }
      throw error;
    }
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);

    return this.prisma.product.update({
      where: { id },
      data: { status: ArchiveStatus.ARCHIVED },
    });
  }

  async findByBarcode(storeId: string, barcode: string) {
    const productBarcode = await this.prisma.productBarcode.findUnique({
      where: {
        storeId_barcode: { storeId, barcode },
      },
      include: {
        product: {
          include: { barcodes: true, category: true, brand: true },
        },
      },
    });

    if (!productBarcode) {
      throw new NotFoundException('Barcode not found');
    }

    return productBarcode.product;
  }

  async addBarcode(storeId: string, productId: string, barcode: string) {
    await this.findOne(storeId, productId);

    try {
      return await this.prisma.productBarcode.create({
        data: {
          storeId,
          productId,
          barcode,
          isPrimary: false,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This barcode is already registered.');
      }
      throw error;
    }
  }

  async removeBarcode(storeId: string, productId: string, barcodeId: string) {
    await this.findOne(storeId, productId);

    const barcode = await this.prisma.productBarcode.findUnique({
      where: { id: barcodeId },
    });

    if (!barcode || barcode.storeId !== storeId || barcode.productId !== productId) {
      throw new NotFoundException('Barcode not found for this product');
    }

    return this.prisma.productBarcode.delete({
      where: { id: barcodeId },
    });
  }
}
