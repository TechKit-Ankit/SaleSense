import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RefundItemInputDto {
  @IsUUID()
  saleItemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  /** Return the units to their batch (default true). False = damaged goods etc. */
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}

export class CreateRefundDto {
  /** Always required — refunds touch cash, stock, and the audit trail. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RefundItemInputDto)
  items!: RefundItemInputDto[];
}
