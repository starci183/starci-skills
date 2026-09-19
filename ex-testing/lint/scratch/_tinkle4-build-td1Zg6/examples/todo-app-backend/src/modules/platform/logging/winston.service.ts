import {
    Injectable 
} from "@nestjs/common"
import {
    LogEvent 
} from "./log-events"

@Injectable()
/**
 * The house logging surface every capability injects instead of the framework's `Logger`. Lines leave
 * as one structured JSON record on stdout so the event name stays groupable and the variable data stays
 * queryable next to it; the named seam is also where a real transport (and the correlation id it would
 * attach) joins later without touching a single call site.
 */
export class WinstonService {
    /**
     * Emits one info-level structured line for `event`. `data` carries the variable half of the
     * observation - anything that would tempt a caller into interpolating the name.
     */
    log(event: LogEvent, data: Record<string, unknown> = {
    }): void {
        process.stdout.write(`${JSON.stringify({
            level: "info", event, ...data 
        })}\n`)
    }
}
