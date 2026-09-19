import {
    createE2EHttpClient, E2EHttpClient 
} from "@e2e-kit/integrations/http/e2e-http-client"
import {
    GraphqlCallOptions, GraphqlObserved 
} from "@e2e-kit/integrations/graphql/graphql-envelope"
import {
    Injectable 
} from "@nestjs/common"
import {
    E2EStackService 
} from "../../platform/stack/e2e-stack.service"

/**
 * The public transport contract, and nothing else. Every call is an HTTP POST to the api's single
 * /graphql door with a {query, variables} body. No spec imports a service class, a repository, a
 * handler or an entity; preconditions are created by the public operations that create them.
 *
 * These are the operations the resolvers under src/features/todo/graphql actually register. Notes
 * carried over from the retired lib/client.js: there is no single-task query (a task is read back out
 * of `tasks`), and there is no public door for completing or skipping a recurrence occurrence.
 */
export const GRAPHQL_DOCUMENTS = {
    signIn: "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }",
    signOut: "mutation SignOut($input: SignOutInput!) { signOut(input: $input) { signedOut } }",
    createTask: "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }",
    listTasks: "query { tasks { taskId title complete } }",
    completeTask: "mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }",
    reopenTask: "mutation ReopenTask($id: ID!) { reopenTask(id: $id) { taskId complete } }",
    deleteTask: "mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }",
    invite: "mutation Invite($input: InviteInput!) { invite(input: $input) { invitationId taskId email role status } }",
    acceptInvitation: "mutation Accept($input: AcceptInvitationInput!) { acceptInvitation(input: $input) { invitationId role status } }",
    revokeCollaborator: "mutation Revoke($input: RevokeCollaboratorInput!) { revokeCollaborator(input: $input) { invitationId status } }",
    collaborators: "query Collaborators($taskId: ID!) { collaborators(taskId: $taskId) { invitationId email role status } }",
    auditLog: "query { auditLog { at action target } }",
    exportMyData: "query { exportMyData { at action target } }",
    requestErasure: "mutation { requestErasure { requestId state } }",
    completeErasure: "mutation CompleteErasure($requestId: ID!) { completeErasure(requestId: $requestId) { requestId state } }",
    makeRecurring: "mutation MakeRecurring($input: MakeRecurringInput!) { makeRecurring(input: $input) { ruleId title frequency timeZone time startDate } }",
    editRecurrence: "mutation EditRecurrence($input: EditRecurrenceInput!) { editRecurrence(input: $input) { ruleId frequency timeZone time } }",
    endRecurrence: "mutation EndRecurrence($input: EndRecurrenceInput!) { endRecurrence(input: $input) { ruleId endedAt orphanedCount } }",
    upcomingOccurrences: "query Upcoming($ruleId: String!) { upcomingOccurrences(ruleId: $ruleId) { ruleId materialised { occurrenceId localDate dueAtUtc status } previewDates } }",
    notificationPreferences: "query Prefs($channel: String) { notificationPreferences(channel: $channel) { channel unsubscribed digestWindowMinutes } }",
    usage: "query { planUsage { plan cap activeCount } }",
} as const

/** The registry key of a frozen GraphQL document - what a spec passes instead of a raw string. */
export type GraphqlDocumentName = keyof typeof GRAPHQL_DOCUMENTS;

/* Compat re-exports: the envelope and door-client types moved to the shared @e2e-kit package.
 * Specs still importing them from this service keep resolving; the e2e spec lane owns repointing
 * at the kit paths. */
export type {
    E2EHttpClient, E2EResponse 
} from "@e2e-kit/integrations/http/e2e-http-client"
export type {
    GraphqlCallOptions, GraphqlObserved 
} from "@e2e-kit/integrations/graphql/graphql-envelope"

/** Aliases kept for lanes that named the envelope before this file landed - same shape. */
export type E2EGraphqlResponse<TData = Record<string, unknown>> = GraphqlObserved<TData>;

/** Earlier spelling of GraphqlObserved kept for the same reason - identical shape, older name. */
export type E2EGraphqlResult<TData = Record<string, unknown>> = GraphqlObserved<TData>;

@Injectable()
/**
 * Per-user HTTP transport for the run-owned api. `forUser(token)` returns an E2EHttpClient scoped to
 * the spec's api baseURL with the bearer preset; `graphql(...)` is the typed convenience wrapper most
 * specs use. The door client itself is the shared @e2e-kit factory - this service only binds it to
 * this run's baseUrl and caches one instance per identity.
 */
export class E2EHttpService {
    private readonly clients = new Map<string, E2EHttpClient>()

    constructor(private readonly stack: E2EStackService) {}

    /** A client for calls with no session attached. */
    anonymous(): E2EHttpClient {
        return this.forToken(undefined)
    }

    /** A client that carries this session's bearer on every request. */
    forUser(token: string): E2EHttpClient {
        return this.forToken(token)
    }

    /**
   * One GraphQL operation over HTTP. `document` is a GRAPHQL_DOCUMENTS key or a raw query string for
   * shapes the registry does not name yet.
   */
    async graphql<TData = Record<string, unknown>>(
        document: GraphqlDocumentName | string,
        options: GraphqlCallOptions = {
        },
    ): Promise<GraphqlObserved<TData>> {
        const query = (GRAPHQL_DOCUMENTS as Record<string, string>)[document] ?? document
        return this.forToken(options.token).graphql<TData>(query,
            options.variables)
    }

    /**
   * A client for one identity. `client()` is anonymous; `client({ bearerToken })` carries that
   * session's bearer on every request.
   */
    client(options: { bearerToken?: string } = {
    }): E2EHttpClient {
        return this.forToken(options.bearerToken)
    }

    private forToken(token: string | undefined): E2EHttpClient {
        const key = token ?? ""
        let client = this.clients.get(key)
        if (!client) {
            client = createE2EHttpClient({
                baseUrl: this.stack.baseUrl,
                bearerToken: token,
                timeoutMs: 15_000,
            })
            this.clients.set(key,
                client)
        }
        return client
    }
}
