import {
    Injectable, OnModuleDestroy 
} from "@nestjs/common"
import {
    Pool, PoolClient 
} from "pg"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    LogEvent 
} from "@modules/platform/logging/log-events"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    PostgresPrimaryUnavailableException 
} from "@modules/shared/exceptions/errors/postgres/postgres-primary-unavailable"


/** How long a probe waits before declaring the database gone - a health check must fail fast, not hang on a dead connection. */
const PING_TIMEOUT_MS = 5_000

/**
 * integration.login.postgres is still todo: no migration has been applied against a real server yet, so
 * this client exists as the declared external-protocol owner without capability services depending on
 * it. Renamed from the former `PostgresClient` (under `modules/integrations/postgres`) to
 * `PostgresPrimaryClient` under `modules/platform/databases/postgresql/primary` to match nivo's
 * centralised-database shape: one owned connection per named database, not a per-provider integration.
 */
@Injectable()
/** Outbound client for the postgres primary integration surface; transport failures surface as house exceptions, never raw HTTP noise. */
export class PostgresPrimaryClient implements OnModuleDestroy {
    private readonly pool: Pool

    constructor(
        private readonly config: AppConfigService,
        private readonly winston: WinstonService,
    ) {
        this.pool = new Pool({
            connectionString: this.config.getDatabaseUrl(),
            connectionTimeoutMillis: PING_TIMEOUT_MS 
        })
        // pg-pool re-emits an idle client's death on the pool itself; left unlistened that surfaces as
        // an 'Unhandled error' event and the whole api exits before any ping can report the outage.
        this.pool.on("error",
            (error) => this.winston.log(LogEvent.POSTGRESQL_PRIMARY_POOL_IDLE_CLIENT_ERROR,
                {
                    reason: String(error) 
                }))
        // The pool also removes that listener while a client is checked out, so a socket dying
        // mid-query would emit 'error' with nobody listening and kill the process the same way. The
        // in-flight query still receives the error through its own callback - this guard only keeps
        // the client-level emit handled for the client's whole life, checked out or idle.
        this.pool.on("connect",
            (client: PoolClient) => {
                client.on("error",
                    () => undefined)
            })
    }

    async ping(): Promise<void> {
        let rowCount: number | null
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
            const result = await Promise.race([
                this.pool.query("SELECT 1"),
                new Promise<never>((_resolve, reject) => {
                    timer = setTimeout(() => reject(new Error("ping timed out")),
                        PING_TIMEOUT_MS)
                }),
            ])
            rowCount = result.rowCount
        } catch (error) {
            throw new PostgresPrimaryUnavailableException({
                reason: String(error) 
            })
        } finally {
            clearTimeout(timer)
        }
        if (rowCount !== 1) {
            throw new PostgresPrimaryUnavailableException({
                reason: "unexpected row count" 
            })
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.pool.end()
    }
}
