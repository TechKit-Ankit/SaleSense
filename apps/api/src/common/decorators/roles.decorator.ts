import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * Restricts a route to users with the specified store-level roles.
 *
 * @example
 * @Roles('OWNER', 'MANAGER')
 * @Get('reports')
 * getReports() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
