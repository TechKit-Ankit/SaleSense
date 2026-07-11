import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export enum ReconciliationAction {
  /** Physical count differs — create a corrective stock adjustment. */
  ADJUST = 'ADJUST',
  /** Numbers are already correct — clear the flag without stock changes. */
  DISMISS = 'DISMISS',
}

export class ResolveReconciliationDto {
  @IsEnum(ReconciliationAction)
  action!: ReconciliationAction;

  /** Required when action = ADJUST: the physically counted batch quantity. */
  @IsOptional()
  @IsInt()
  @Min(0)
  countedQuantity?: number;

  /** Always required — persisted to the audit trail. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
