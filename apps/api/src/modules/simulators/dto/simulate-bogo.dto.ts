import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class SimulateBogoDto {
  @IsUUID()
  productId!: string;

  /** Paid units per bundle (the "buy N"). */
  @IsInt()
  @Min(1)
  @Max(100)
  buyQuantity!: number;

  /** Free units per bundle (the "get M free"). */
  @IsInt()
  @Min(1)
  @Max(100)
  freeQuantity!: number;

  /** Baseline lookback window in days. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  periodDays?: number;
}
