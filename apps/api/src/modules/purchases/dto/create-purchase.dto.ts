import { IsString, IsOptional, IsUUID, IsInt, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  quantity!: number;

  @IsInt()
  purchasePricePaise!: number;

  @IsOptional()
  @IsInt()
  mrpPaise?: number;

  @IsInt()
  sellingPricePaise!: number;

  @IsOptional()
  @IsInt()
  taxRateBps?: number;

  @IsOptional()
  @IsString()
  batchNo?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class CreatePurchaseDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsDateString()
  purchaseDate!: string;

  @IsInt()
  subtotalPaise!: number;

  @IsInt()
  taxPaise!: number;

  @IsInt()
  totalPaise!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}
