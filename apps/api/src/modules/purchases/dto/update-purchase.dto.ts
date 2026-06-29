import { IsString } from 'class-validator';

export class ReceivePurchaseDto {
  @IsString()
  status!: 'RECEIVED';
}
