import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { StoreUserRole, StoreUserStatus } from '@salesense/db';

export class AddStoreUserDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(StoreUserRole)
  @IsNotEmpty()
  role!: StoreUserRole;
}

export class UpdateStoreUserDto {
  @IsEnum(StoreUserRole)
  role?: StoreUserRole;

  @IsEnum(StoreUserStatus)
  status?: StoreUserStatus;
}
