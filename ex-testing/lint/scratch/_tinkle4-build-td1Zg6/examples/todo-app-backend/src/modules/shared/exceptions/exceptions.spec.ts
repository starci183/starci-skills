import fs from "node:fs"
import path from "node:path"
import {
    AbstractException 
} from "./errors/abstract"
import {
    AuditOperatorRoleNotAuthorizedException 
} from "./errors/audit/audit-operator-role-not-authorized"
import {
    ErasureNotConfirmedException 
} from "./errors/audit/erasure-not-confirmed"
import {
    ErasureRequestForbiddenException 
} from "./errors/audit/erasure-request-forbidden"
import {
    ErasureRequestInvalidStateException 
} from "./errors/audit/erasure-request-invalid-state"
import {
    ErasureRequestNotFoundException 
} from "./errors/audit/erasure-request-not-found"
import {
    InvalidCredentialsException 
} from "./errors/session/invalid-credentials"
import {
    KeycloakInvalidCredentialsException 
} from "./errors/keycloak/keycloak-invalid-credentials"
import {
    KeycloakUnavailableException 
} from "./errors/keycloak/keycloak-unavailable"
import {
    NotifyQueueProtocolException 
} from "./errors/notify/notify-queue-protocol"
import {
    NotifySmtpPermanentRejectionException 
} from "./errors/notify/notify-smtp-permanent-rejection"
import {
    NotifySmtpTransientFailureException 
} from "./errors/notify/notify-smtp-transient-failure"
import {
    PlanCapExceededException 
} from "./errors/plan/plan-cap-exceeded"
import {
    PlanForbiddenException 
} from "./errors/plan/plan-forbidden"
import {
    PlanPaymentIntentNotFoundException 
} from "./errors/plan/plan-payment-intent-not-found"
import {
    PlanSubscriptionNotFoundException 
} from "./errors/plan/plan-subscription-not-found"
import {
    PlanWebhookUnauthorizedException 
} from "./errors/plan/plan-webhook-unauthorized"
import {
    PostgresPrimaryUnavailableException 
} from "./errors/postgres/postgres-primary-unavailable"
import {
    RecurOccurrenceForbiddenException 
} from "./errors/recur/occurrence-forbidden"
import {
    RecurOccurrenceNotFoundException 
} from "./errors/recur/occurrence-not-found"
import {
    RecurRuleForbiddenException 
} from "./errors/recur/rule-forbidden"
import {
    RecurRuleInvalidException 
} from "./errors/recur/rule-invalid"
import {
    RecurRuleNotFoundException 
} from "./errors/recur/rule-not-found"
import {
    SessionExpiredException 
} from "./errors/session/session-expired"
import {
    SepayRequestFailedException 
} from "./errors/sepay/sepay-request-failed"
import {
    SessionNotFoundException 
} from "./errors/session/session-not-found"
import {
    ShareEmailMismatchException 
} from "./errors/share/email-mismatch"
import {
    ShareForbiddenException 
} from "./errors/share/forbidden"
import {
    ShareInvitationAlreadyClosedException 
} from "./errors/share/invitation-already-closed"
import {
    ShareInvitationAlreadyExistsException 
} from "./errors/share/invitation-already-exists"
import {
    ShareInvitationExpiredException 
} from "./errors/share/invitation-expired"
import {
    ShareInvitationNotFoundException 
} from "./errors/share/invitation-not-found"
import {
    ShareInvitationRevokedException 
} from "./errors/share/invitation-revoked"
import {
    ShareInvalidEmailException 
} from "./errors/share/invalid-email"
import {
    ShareInvalidRoleException 
} from "./errors/share/invalid-role"
import {
    TaskForbiddenException 
} from "./errors/task/task-forbidden"
import {
    TaskNotFoundException 
} from "./errors/task/task-not-found"
import {
    TaskTitleRequiredException 
} from "./errors/task/task-title-required"

interface ExceptionCase {
  readonly make: () => AbstractException;
  readonly code: string;
  readonly metadata?: Record<string, unknown>;
}

/** Every error the shared vocabulary exports, with the code it must carry and the named metadata its
 * constructor lifts into `metadata`. Codes are the public contract callers match on - a drifted code
 * string is a breaking change, so each one is pinned here. */
const cases: Array<ExceptionCase> = [
    {
        make: () => new AuditOperatorRoleNotAuthorizedException(), code: "AUDIT_OPERATOR_ROLE_NOT_AUTHORIZED_EXCEPTION" 
    },
    {
        make: () => new NotifyQueueProtocolException({
            typeByte: "$" 
        }),
        code: "NOTIFY_QUEUE_PROTOCOL_EXCEPTION",
        metadata: {
            typeByte: "$" 
        },
    },
    {
        make: () => new SepayRequestFailedException({
        }), code: "SEPAY_REQUEST_FAILED_EXCEPTION" 
    },
    {
        make: () => new InvalidCredentialsException(), code: "INVALID_CREDENTIALS_EXCEPTION" 
    },
    {
        make: () => new SessionNotFoundException(), code: "SESSION_NOT_FOUND_EXCEPTION" 
    },
    {
        make: () => new SessionExpiredException(), code: "SESSION_EXPIRED_EXCEPTION" 
    },
    {
        make: () => new TaskNotFoundException({
            taskId: "t-1" 
        }),
        code: "TASK_NOT_FOUND_EXCEPTION",
        metadata: {
            taskId: "t-1" 
        },
    },
    {
        make: () => new TaskForbiddenException({
            taskId: "t-1", actorId: "p-2" 
        }),
        code: "TASK_FORBIDDEN_EXCEPTION",
        metadata: {
            taskId: "t-1", actorId: "p-2" 
        },
    },
    {
        make: () => new TaskTitleRequiredException(), code: "TASK_TITLE_REQUIRED_EXCEPTION" 
    },
    {
        make: () => new KeycloakInvalidCredentialsException(), code: "KEYCLOAK_INVALID_CREDENTIALS_EXCEPTION" 
    },
    {
        make: () => new KeycloakUnavailableException({
            detail: "connection refused" 
        }),
        code: "KEYCLOAK_UNAVAILABLE_EXCEPTION",
        metadata: {
            detail: "connection refused" 
        },
    },
    {
        make: () => new PostgresPrimaryUnavailableException({
            reason: "no primary" 
        }),
        code: "POSTGRES_PRIMARY_UNAVAILABLE_EXCEPTION",
        metadata: {
            reason: "no primary" 
        },
    },
    {
        make: () => new ShareInvitationNotFoundException({
            invitationId: "i-1" 
        }),
        code: "SHARE_INVITATION_NOT_FOUND_EXCEPTION",
        metadata: {
            invitationId: "i-1" 
        },
    },
    {
        make: () => new ShareInvalidEmailException({
            email: "not-an-email" 
        }),
        code: "SHARE_INVALID_EMAIL_EXCEPTION",
        metadata: {
            email: "not-an-email" 
        },
    },
    {
        make: () => new ShareInvalidRoleException({
            role: "owner" 
        }),
        code: "SHARE_INVALID_ROLE_EXCEPTION",
        metadata: {
            role: "owner" 
        },
    },
    {
        make: () => new ShareInvitationAlreadyExistsException({
            taskId: "t-1", email: "a@b.c" 
        }),
        code: "SHARE_INVITATION_ALREADY_EXISTS_EXCEPTION",
        metadata: {
            taskId: "t-1", email: "a@b.c" 
        },
    },
    {
        make: () => new ShareEmailMismatchException({
            invitationId: "i-1" 
        }),
        code: "SHARE_EMAIL_MISMATCH_EXCEPTION",
        metadata: {
            invitationId: "i-1" 
        },
    },
    {
        make: () => new ShareInvitationExpiredException({
            invitationId: "i-1" 
        }),
        code: "SHARE_INVITATION_EXPIRED_EXCEPTION",
        metadata: {
            invitationId: "i-1" 
        },
    },
    {
        make: () => new ShareInvitationRevokedException({
            invitationId: "i-1" 
        }),
        code: "SHARE_INVITATION_REVOKED_EXCEPTION",
        metadata: {
            invitationId: "i-1" 
        },
    },
    {
        make: () => new ShareInvitationAlreadyClosedException({
            invitationId: "i-1" 
        }),
        code: "SHARE_INVITATION_ALREADY_CLOSED_EXCEPTION",
        metadata: {
            invitationId: "i-1" 
        },
    },
    {
        make: () => new ShareForbiddenException({
            invitationId: "i-1", actorId: "p-2" 
        }),
        code: "SHARE_FORBIDDEN_EXCEPTION",
        metadata: {
            invitationId: "i-1", actorId: "p-2" 
        },
    },
    {
        make: () => new RecurRuleNotFoundException({
            ruleId: "r-1" 
        }),
        code: "RECUR_RULE_NOT_FOUND_EXCEPTION",
        metadata: {
            ruleId: "r-1" 
        },
    },
    {
        make: () => new RecurRuleForbiddenException({
            ruleId: "r-1", actorId: "p-2" 
        }),
        code: "RECUR_RULE_FORBIDDEN_EXCEPTION",
        metadata: {
            ruleId: "r-1", actorId: "p-2" 
        },
    },
    {
        make: () => new RecurRuleInvalidException({
            reason: "bad rrule" 
        }),
        code: "RECUR_RULE_INVALID_EXCEPTION",
        metadata: {
            reason: "bad rrule" 
        },
    },
    {
        make: () => new RecurOccurrenceNotFoundException({
            occurrenceId: "o-1" 
        }),
        code: "RECUR_OCCURRENCE_NOT_FOUND_EXCEPTION",
        metadata: {
            occurrenceId: "o-1" 
        },
    },
    {
        make: () => new RecurOccurrenceForbiddenException({
            occurrenceId: "o-1", actorId: "p-2" 
        }),
        code: "RECUR_OCCURRENCE_FORBIDDEN_EXCEPTION",
        metadata: {
            occurrenceId: "o-1", actorId: "p-2" 
        },
    },
    {
        make: () => new NotifySmtpTransientFailureException({
            reason: "450 mailbox busy" 
        }),
        code: "NOTIFY_SMTP_TRANSIENT_FAILURE_EXCEPTION",
        metadata: {
            reason: "450 mailbox busy" 
        },
    },
    {
        make: () => new NotifySmtpPermanentRejectionException({
            notificationId: "n-1", reason: "550 no such user" 
        }),
        code: "NOTIFY_SMTP_PERMANENT_REJECTION_EXCEPTION",
        metadata: {
            notificationId: "n-1", reason: "550 no such user" 
        },
    },
    {
        make: () => new ErasureRequestNotFoundException({
            requestId: "e-1" 
        }),
        code: "ERASURE_REQUEST_NOT_FOUND_EXCEPTION",
        metadata: {
            requestId: "e-1" 
        },
    },
    {
        make: () => new ErasureRequestForbiddenException(), code: "ERASURE_REQUEST_FORBIDDEN_EXCEPTION" 
    },
    {
        make: () => new ErasureRequestInvalidStateException({
            requestId: "e-1", state: "pending", expected: "verified" 
        }),
        code: "ERASURE_REQUEST_INVALID_STATE_EXCEPTION",
        metadata: {
            requestId: "e-1", state: "pending", expected: "verified" 
        },
    },
    {
        make: () => new ErasureNotConfirmedException({
            requestId: "e-1" 
        }),
        code: "ERASURE_NOT_CONFIRMED_EXCEPTION",
        metadata: {
            requestId: "e-1" 
        },
    },
    {
        make: () => new PlanCapExceededException({
            cap: 20, upgradePath: "/plan/upgrade" 
        }),
        code: "PLAN_CAP_EXCEEDED_EXCEPTION",
        metadata: {
            cap: 20, upgradePath: "/plan/upgrade" 
        },
    },
    {
        make: () => new PlanSubscriptionNotFoundException({
            subscriptionId: "s-1" 
        }),
        code: "PLAN_SUBSCRIPTION_NOT_FOUND_EXCEPTION",
        metadata: {
            subscriptionId: "s-1" 
        },
    },
    {
        make: () => new PlanPaymentIntentNotFoundException({
            intentId: "pi-1" 
        }),
        code: "PLAN_PAYMENT_INTENT_NOT_FOUND_EXCEPTION",
        metadata: {
            intentId: "pi-1" 
        },
    },
    {
        make: () => new PlanForbiddenException({
            subscriptionId: "s-1", actorId: "p-2" 
        }),
        code: "PLAN_FORBIDDEN_EXCEPTION",
        metadata: {
            subscriptionId: "s-1", actorId: "p-2" 
        },
    },
    {
        make: () => new PlanWebhookUnauthorizedException(), code: "PLAN_WEBHOOK_UNAUTHORIZED_EXCEPTION" 
    },
]

describe("shared exception vocabulary",
    () => {
        it.each(cases.map(c => [c.code,
            c] as const))("%s is an AbstractException carrying its code, name and metadata",
            (_code, c) => {
                const error = c.make()
                expect(error).toBeInstanceOf(Error)
                expect(error).toBeInstanceOf(AbstractException)
                expect(error.code).toBe(c.code)
                expect(error.name).toBe(c.code)
                expect(error.message.length).toBeGreaterThan(0)
                if (c.metadata) expect(error.metadata).toMatchObject(c.metadata)
            })

        it("covers every AbstractException subclass file under errors/",
            () => {
                const errorFiles = (dir: string): Array<string> =>
                    fs.readdirSync(dir,
                        {
                            withFileTypes: true 
                        }).flatMap(entry =>
                        entry.isDirectory()
                            ? errorFiles(path.join(dir,
                                entry.name))
                            : entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
                                ? [entry.name]
                                : [],
                    )
                const files = errorFiles(path.join(__dirname,
                    "errors"))
                expect(files.length).toBe(cases.length + 1)
            })
    })

describe("AbstractException",
    () => {
        it("toJSON serializes message, code and metadata for transport",
            () => {
                const error = new TaskNotFoundException({
                    taskId: "t-1" 
                })
                expect(JSON.parse(error.toJSON())).toEqual({
                    message: "The task does not exist.",
                    code: "TASK_NOT_FOUND_EXCEPTION",
                    metadata: {
                        taskId: "t-1" 
                    },
                })
            })

        it("getOriginalError returns the wrapped error when one was attached",
            () => {
                const original = new Error("disk gone")
                const error = new PostgresPrimaryUnavailableException({
                    reason: "io", originalError: original 
                })
                expect(error.getOriginalError()).toBe(original)
            })

        it("getOriginalError returns undefined when no original error was attached",
            () => {
                expect(new SessionExpiredException().getOriginalError()).toBeUndefined()
            })

        it("PlanCapExceededException names the cap and upgrade path in its message, with defaults",
            () => {
                expect(new PlanCapExceededException().message).toContain("20")
                expect(new PlanCapExceededException().message).toContain("/plan/upgrade")
                expect(new PlanCapExceededException({
                    cap: 5, upgradePath: "/billing" 
                }).message).toContain("5")
                expect(new PlanCapExceededException({
                    cap: 5, upgradePath: "/billing" 
                }).message).toContain("/billing")
            })
    })
