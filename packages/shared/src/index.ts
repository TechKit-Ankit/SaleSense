export const APP_NAME = "SaleSense";

export const USER_ROLES = ["OWNER", "MANAGER", "CASHIER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const API_VERSION = "v1";

