import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ArchiveStatus } from '@salesense/db';

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(ArchiveStatus)
  status?: ArchiveStatus;
}
