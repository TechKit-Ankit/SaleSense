import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
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
    return {
      success: true,
      data: {
        status: "ok",
        service: "salesense-api",
      },
      requestId: null,
    };
  }
}

