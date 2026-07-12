import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "./common/decorators/public.decorator";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  // Load balancers and uptime monitors probe this unauthenticated.
  @Public()
  @Get()
  @ApiOkResponse({
    description: "API health status.",
    schema: {
      example: {
        success: true,
        data: { status: "ok", service: "salesense-api" },
        requestId: null,
      },
    },
  })
  getHealth() {
    // Raw payload only — the global ResponseEnvelopeInterceptor adds the envelope.
    return {
      status: "ok",
      service: "salesense-api",
    };
  }
}

