import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsBoolean, Min, IsUUID } from 'class-validator';
import { ArchiveStatus } from '@salesense/db';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string; // This is a helper field to create the initial barcode

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  taxRateBps?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  mrpPaise?: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sellingPricePaise!: number;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  expiryTracked?: boolean;

  @IsOptional()
  @IsEnum(ArchiveStatus)
  status?: ArchiveStatus;
}
