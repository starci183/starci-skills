import {
    createE2EGraphqlTransport, E2EGraphqlTransport 
} from "@e2e-kit/integrations/graphql/e2e-graphql-transport"
import {
    GraphqlCallOptions, GraphqlObserved 
} from "@e2e-kit/integrations/graphql/graphql-envelope"
import {
    Injectable 
} from "@nestjs/common"
import {
    DocumentNode 
} from "graphql"
import {
    E2EStackService 
} from "../../platform/stack/e2e-stack.service"
import {
    GRAPHQL_DOCUMENTS, GraphqlDocumentName 
} from "../http/e2e-http.service"

@Injectable()
/**
 * The app's public surface is GraphQL, so the specs get a real GraphQL client, not only the raw
 * HTTP door: one ApolloClient per identity (bearer baked into its HttpLink, cached per token),
 * pointed at the run-owned api's /graphql endpoint. `query`/`mutate` take a DocumentNode (or a
 * GRAPHQL_DOCUMENTS key / raw document string) and answer with the same GraphqlObserved envelope
 * the HTTP door produces, so refusals stay assertions rather than thrown exceptions. The client
 * mechanics live in the shared @e2e-kit transport; this service only binds it to this run's
 * baseUrl and this app's document registry.
 */
export class E2EGraphqlService {
    private readonly transport: E2EGraphqlTransport = createE2EGraphqlTransport({
        documents: GRAPHQL_DOCUMENTS 
    })

    constructor(private readonly stack: E2EStackService) {}

    /** A client for calls with no session attached. */
    anonymous(): ReturnType<E2EGraphqlTransport["apollo"]> {
        return this.transport.apollo(this.stack.baseUrl)
    }

    /** A client that carries this session's bearer on every operation. */
    forUser(token: string): ReturnType<E2EGraphqlTransport["apollo"]> {
        return this.transport.apollo(this.stack.baseUrl,
            token)
    }

    async query<TData = Record<string, unknown>>(
        document: GraphqlDocumentName | DocumentNode | string,
        options: GraphqlCallOptions = {
        },
    ): Promise<GraphqlObserved<TData>> {
        return this.transport.call<TData>(this.stack.baseUrl,
            "query",
            document,
            options)
    }

    async mutate<TData = Record<string, unknown>>(
        document: GraphqlDocumentName | DocumentNode | string,
        options: GraphqlCallOptions = {
        },
    ): Promise<GraphqlObserved<TData>> {
        return this.transport.call<TData>(this.stack.baseUrl,
            "mutate",
            document,
            options)
    }
}
