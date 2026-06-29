import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StoreUserRole } from '@salesense/db';

export class CreateInvitationDto {
  @IsEmail()
  @IsOptional()
  invitedEmail?: string;

  @IsString()
  @IsOptional()
  invitedPhone?: string;

  @IsEnum(StoreUserRole)
  @IsNotEmpty()
  role!: StoreUserRole;
}
