import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Email address (optional if phone is provided)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number (optional if email is provided)' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Password (min 6 characters)' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ description: 'Name of the first store to create' })
  @IsString()
  @IsNotEmpty()
  storeName!: string;
}
