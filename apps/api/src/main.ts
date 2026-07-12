import "reflect-metadata";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

/**
 * Fail fast on a misconfigured production deploy: without real secrets the
 * API would silently issue forgeable tokens (production checklist, Gate 1).
 */
function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  const required = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start in production: missing required env vars: ${missing.join(", ")}`,
    );
  }
}

async function bootstrap() {
  assertProductionEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Browser clients live on a different origin (web :3000 vs api :4000 in dev).
  // CORS_ORIGIN is a comma-separated allowlist in deployed environments.
  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-store-id", "x-request-id", "idempotency-key"],
    exposedHeaders: ["x-request-id"],
  });

  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("SaleSense API")
    .setDescription("POS, inventory, billing, sync, and analytics API.")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addGlobalParameters({
      in: "header",
      name: "x-request-id",
      required: false,
      schema: { type: "string" },
    })
    .addGlobalParameters({
      in: "header",
      name: "x-store-id",
      required: false,
      schema: { type: "string" },
    })
    .build();

  // API docs are a development/staging tool — never exposed in production.
  if (process.env.NODE_ENV !== "production") {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();

