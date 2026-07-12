import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export class SimulateDiscountDto {
  @IsUUID()
  productId!: string;

  @IsEnum(DiscountType)
  discountType!: DiscountType;

  /** Required for PERCENTAGE: discount in basis points (10% = 1000, max 100%). */
  @ValidateIf((o) => o.discountType === DiscountType.PERCENTAGE)
  @IsInt()
  @Min(1)
  @Max(10000)
  discountValueBps?: number;

  /** Required for FLAT: discount in paise (must be below the selling price). */
  @ValidateIf((o) => o.discountType === DiscountType.FLAT)
  @IsInt()
  @Min(1)
  discountValuePaise?: number;

  /** Baseline lookback window in days. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  periodDays?: number;

  /** Owner's own volume-uplift guess in basis points (25% = 2500) → projection. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  expectedUpliftBps?: number;
}
