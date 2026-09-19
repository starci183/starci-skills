import {
    createE2EHttpClient, E2EHttpClient 
} from "@e2e-kit/integrations/http/e2e-http-client"
import {
    Injectable 
} from "@nestjs/common"
import {
    E2EServiceName, E2EStackService 
} from "../../platform/stack/e2e-stack.service"

/* Compat re-export: the door-client contract moved to the shared @e2e-kit package. Specs still
 * importing E2EHttpClient/E2EResponse from this service keep resolving; the e2e spec lane owns
 * repointing at the kit path. */
export type {
    E2EHttpClient, E2EResponse 
} from "@e2e-kit/integrations/http/e2e-http-client"

/** Per-client options a spec passes to http.client() - today just the session bearer. */
export interface E2EHttpClientOptions {
  /** Bearer session token folded into every request this client sends. */
  bearerToken?: string;
}

@Injectable()
/**
 * One HTTP door client per service/user, bound to the ports this run allocated. Nothing here knows a
 * port literal - base URLs come from the stack service, which got them from the OS. Every status is
 * data for a spec (a 401/409 refusal is asserted, never thrown), so the shared @e2e-kit client keeps
 * validateStatus accepting all.
 */
export class E2EHttpService {
    constructor(private readonly stack: E2EStackService) {}

    client(service: E2EServiceName, options: E2EHttpClientOptions = {
    }): E2EHttpClient {
        const { baseUrl } = this.stack.endpoint(service)
        return createE2EHttpClient({
            baseUrl, bearerToken: options.bearerToken 
        })
    }
}
