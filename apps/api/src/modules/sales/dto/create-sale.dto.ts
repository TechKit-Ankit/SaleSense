import { IsString, IsOptional, IsUUID, IsInt, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { SaleSource, PaymentMethod } from '@salesense/db';

export class SaleItemDto {
  @IsUUID()
  productId!: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;

  @IsInt()
  quantity!: number;

  @IsInt()
  unitSellingPricePaise!: number;

  @IsOptional()
  @IsInt()
  discountPaise?: number;
}

export class SalePaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsInt()
  amountPaise!: number;
}

export class CreateSaleDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsString()
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  clientSaleId?: string;

  @IsEnum(SaleSource)
  saleSource!: SaleSource;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments!: SalePaymentDto[];
}

export class SyncSalesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleDto)
  sales!: CreateSaleDto[];
}
