import {
    Injectable 
} from "@nestjs/common"
import Redis from "ioredis"
import {
    AppConfigService 
} from "@modules/platform/config/identity/app-config.service"
import {
    RedisUnexpectedReplyException 
} from "@modules/platform/exceptions/errors/platform/redis-unexpected-reply"
import {
    RedisConnectionException 
} from "@modules/platform/exceptions/errors/platform/redis-connection"

@Injectable()
/**
 * The one Redis handle the identity service owns (component `redis`, integration.checkout.redis).
 * lazyConnect, so a missing server never crashes construction; the failure surfaces at the call
 * site and /health reports it as 503 - the same "boots without the dependency, fails honestly at
 * the boundary" shape todo's AppConfigService keeps for SePay.
 */
export class RedisPrimaryClient {
    private readonly redis: Redis

    constructor(config: AppConfigService) {
        this.redis = new Redis(config.getRedisUrl(),
            {
                lazyConnect: true, maxRetriesPerRequest: 1 
            })
    }

    async ping(): Promise<void> {
        await this.ready()
        const pong = await this.redis.ping()
        if (pong !== "PONG") {
            throw new RedisUnexpectedReplyException({
                message: `unexpected Redis ping reply: ${pong}` 
            })
        }
    }

    async store(key: string, value: string, ttlSeconds: number): Promise<void> {
        await this.ready()
        await this.redis.set(key,
            value,
            "EX",
            ttlSeconds)
    }

    async lookup(key: string): Promise<string | null> {
        await this.ready()
        return this.redis.get(key)
    }

    async forget(key: string): Promise<void> {
        await this.ready()
        await this.redis.del(key)
    }

    async close(): Promise<void> {
        await this.redis.quit()
    }

    private async ready(): Promise<void> {
        if (this.redis.status === "ready") return
        if (this.redis.status === "wait") {
            try {
                await this.redis.connect()
            } catch (error) {
                // connect() rejects when another caller already started it; the status check below decides.
                if (!/already connecting|already connected/i.test(String((error as Error)?.message))) throw error
            }
        }
        await this.whenSettled()
    }

    private async whenSettled(): Promise<void> {
        const timeoutMs = 1500
        const deadline = Date.now() + timeoutMs
        for (;;) {
            if (this.redis.status === "ready") return
            if (this.redis.status === "end" || this.redis.status === "close") {
                throw new RedisConnectionException({
                    message: `Redis connection is ${this.redis.status}.` 
                })
            }
            if (Date.now() >= deadline) {
                throw new RedisConnectionException({
                    message: `Redis did not become ready within ${timeoutMs}ms (status ${this.redis.status}).` 
                })
            }
            await new Promise((resolveSleep) => setTimeout(resolveSleep,
                50))
        }
    }
}
