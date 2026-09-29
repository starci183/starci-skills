import {
    Controller, Get, HttpException, HttpStatus 
} from "@nestjs/common"
import {
    PostgresPrimaryClient 
} from "ecommerce-app-be/modules/platform/databases/postgresql/identity"
import {
    LogId, Logger 
} from "ecommerce-app-be/modules/platform/logging"
import {
    RedisPrimaryClient 
} from "ecommerce-app-be/modules/platform/caches/redis/primary"

/** The dependency map a healthy answer reports: each named dependency is confirmed "ok". */
interface HealthChecksResult {
  postgres: "ok";
  redis: "ok";
}

/** The healthy answer shape: the service name plus its confirmed dependency checks. */
interface HealthResult {
  status: "ok";
  service: "identity";
  checks: HealthChecksResult;
}

@Controller("health")
/**
 * The plain HTTP /health the infrastructure probe speaks (todo keeps exactly one door too): a
 * probe door answers only when both dependencies answer, and says which one refused when it does
 * not.
 */
export class HealthController {
    constructor(
    private readonly postgres: PostgresPrimaryClient,
    private readonly redis: RedisPrimaryClient,
    private readonly logger: Logger,
    ) {}

  @Get()
    async check(): Promise<HealthResult> {
        const checks: Record<"postgres" | "redis", "ok" | "unreachable"> = {
            postgres: "ok", redis: "ok" 
        }
        try {
            await this.postgres.ping()
        } catch (error) {
            this.logger.warn(LogId.DependencyProbeFailed,
                {
                    dependency: "postgres", message: error instanceof Error ? error.message : String(error) 
                })
            checks.postgres = "unreachable"
        }
        try {
            await this.redis.ping()
        } catch (error) {
            this.logger.warn(LogId.DependencyProbeFailed,
                {
                    dependency: "redis", message: error instanceof Error ? error.message : String(error) 
                })
            checks.redis = "unreachable"
        }
        if (checks.postgres !== "ok" || checks.redis !== "ok") {
            throw new HttpException(
                {
                    code: "DEPENDENCY_UNAVAILABLE", message: `Dependency refused: ${JSON.stringify(checks)}` 
                },
                HttpStatus.SERVICE_UNAVAILABLE,
            )
        }
        return {
            status: "ok", service: "identity", checks: {
                postgres: "ok", redis: "ok" 
            } 
        }
    }
}
