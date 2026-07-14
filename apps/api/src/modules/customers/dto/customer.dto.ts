import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Matches(/^\d{8,15}$/, { message: 'phone must be 8-15 digits' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  gstNumber?: string;
}

export class UpdateCustomerDto extends CreateCustomerDto {}
