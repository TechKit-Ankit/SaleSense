import { IsUUID, IsInt, IsString, IsNotEmpty, NotEquals } from 'class-validator';

export class CreateStockAdjustmentDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  batchId!: string;

  @IsInt()
  @NotEquals(0)
  quantityDelta!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
