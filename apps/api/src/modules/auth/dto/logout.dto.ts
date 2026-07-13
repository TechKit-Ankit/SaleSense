import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  /** Optional: when present, the session family is revoked server-side. */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
