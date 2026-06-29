import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ArchiveStatus } from '@salesense/db';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEnum(ArchiveStatus)
  status?: ArchiveStatus;
}
