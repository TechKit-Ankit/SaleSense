import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { HealthController } from "./health.controller";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { StoresModule } from "./modules/stores/stores.module";
import { StoreUsersModule } from "./modules/store-users/store-users.module";
import { InvitationsModule } from "./modules/invitations/invitations.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { ResponseEnvelopeInterceptor } from "./common/interceptors/response-envelope.interceptor";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { SalesModule } from './modules/sales/sales.module';
import { ScannerModule } from './modules/scanner/scanner.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SimulatorsModule } from './modules/simulators/simulators.module';
import { AdvisorModule } from './modules/advisor/advisor.module';
import { InvoicesModule } from './modules/invoices/invoices.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Generous global ceiling; strict per-route limits via @Throttle on
    // login (brute-force) and AI chat (Gemini cost) — production checklist Gate 1.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        // Never log credentials (ADR-0003 sensitive-data rules) — pino-http
        // serializes request headers by default, which would include tokens.
        redact: ["req.headers.authorization", "req.headers.cookie"],
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty" }
            : undefined,
      } as any,
    }),
    DatabaseModule,
    AuthModule,
    StoresModule,
    StoreUsersModule,
    InvitationsModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    InventoryModule,
    SuppliersModule,
    PurchasesModule,
    SalesModule,
    ScannerModule,
    AnalyticsModule,
    SimulatorsModule,
    AdvisorModule,
    InvoicesModule,
  ],
  controllers: [HealthController],
  providers: [
    // requestId now comes from requestIdMiddleware in main.ts (runs before
    // guards, so auth errors carry it too) — the old interceptor is gone.
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
