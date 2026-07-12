import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RecommendationsDto {
  /** Lookback window in days for sales-based rules. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  periodDays?: number;
}
