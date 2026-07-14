import { IsString, IsOptional, IsUUID, IsInt, IsArray, ValidateNested, IsEnum, Matches, MaxLength } from 'class-validator';
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

  /**
   * Customer capture at the counter (design 0012): find-or-create by phone
   * inside the sale transaction. Rides along in offline queue payloads too.
   */
  @IsOptional()
  @Matches(/^\d{8,15}$/, { message: 'customerPhone must be 8-15 digits' })
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

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
