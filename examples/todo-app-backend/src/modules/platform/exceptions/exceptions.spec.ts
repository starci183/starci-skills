import fs from "node:fs"
import path from "node:path"
import {
    AbstractException 
} from "./abstract"
import {
    AuditOperatorRoleNotAuthorizedException,
} from "@modules/domain/audit/index"
import {
    ErasureNotConfirmedException,
} from "@modules/domain/audit/index"
import {
    ErasureRequestForbiddenException,
} from "@modules/domain/audit/index"
import {
    ErasureRequestInvalidStateException,
} from "@modules/domain/audit/index"
import {
    ErasureRequestNotFoundException,
} from "@modules/domain/audit/index"
import {
    InvalidCredentialsException,
} from "@modules/domain/session/index"
import {
    KeycloakInvalidCredentialsException,
} from "@modules/integrations/keycloak/index"
import {
    KeycloakUnavailableException,
} from "@modules/integrations/keycloak/index"
import {
    NotifyQueueProtocolException,
} from "@modules/integrations/notify-queue/index"
import {
    NotifySmtpPermanentRejectionException,
} from "@modules/integrations/notify-smtp/index"
import {
    NotifySmtpTransientFailureException,
} from "@modules/integrations/notify-smtp/index"
import {
    PlanCapExceededException,
} from "@modules/domain/plan/index"
import {
    PlanForbiddenException,
} from "@modules/domain/plan/index"
import {
    PlanPaymentIntentNotFoundException,
} from "@modules/domain/plan/index"
import {
    PlanSubscriptionNotFoundException,
} from "@modules/domain/plan/index"
import {
    PlanWebhookUnauthorizedException,
} from "@modules/integrations/sepay/index"
import {
    PostgresPrimaryUnavailableException,
} from "@modules/platform/databases/postgresql/primary/index"
import {
    RecurOccurrenceForbiddenException,
} from "@modules/domain/recur/index"
import {
    RecurOccurrenceNotFoundException,
} from "@modules/domain/recur/index"
import {
    RecurRuleForbiddenException,
} from "@modules/domain/recur/index"
import {
    RecurRuleInvalidException,
} from "@modules/domain/recur/index"
import {
    RecurRuleNotFoundException,
} from "@modules/domain/recur/index"
import {
    SessionExpiredException,
} from "@modules/domain/session/index"
import {
    SepayRequestFailedException,
} from "@modules/integrations/sepay/index"
import {
    SessionNotFoundException,
} from "@modules/domain/session/index"
import {
    ShareEmailMismatchException,
} from "@modules/domain/share/index"
import {
    ShareForbiddenException,
} from "@modules/domain/share/index"
import {
    ShareInvitationAlreadyClosedException,
} from "@modules/domain/share/index"
import {
    ShareInvitationAlreadyExistsException,
} from "@modules/domain/share/index"
import {
    ShareInvitationExpiredException,
} from "@modules/domain/share/index"
import {
    ShareInvitationNotFoundException,
} from "@modules/domain/share/index"
import {
    ShareInvitationRevokedException,
} from "@modules/domain/share/index"
import {
    ShareInvalidEmailException,
} from "@modules/domain/share/index"
import {
    ShareInvalidRoleException,
} from "@modules/domain/share/index"
import {
    TaskForbiddenException,
} from "@modules/domain/task/index"
import {
    TaskNotFoundException,
} from "@modules/domain/task/index"
import {
    TaskTitleRequiredException,
} from "@modules/domain/task/index"
import {
    UploadForbiddenException,
} from "@modules/integrations/upload/index"
import {
    UploadMimeNotAllowedException,
} from "@modules/integrations/upload/index"
import {
    UploadNotFoundException,
} from "@modules/integrations/upload/index"
import {
    UploadNotReadyException,
} from "@modules/integrations/upload/index"
import {
    UploadScanRejectedException,
} from "@modules/integrations/upload/index"
import {
    UploadStorageUnavailableException,
} from "@modules/integrations/upload/index"
import {
    UploadTokenInvalidException,
} from "@modules/integrations/upload/index"
import {
    UploadTooLargeException,
} from "@modules/integrations/upload/index"

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
    {
        make: () => new UploadNotFoundException({
            uploadId: "u-1" 
        }),
        code: "UPLOAD_NOT_FOUND_EXCEPTION",
        metadata: {
            uploadId: "u-1" 
        },
    },
    {
        make: () => new UploadForbiddenException({
            uploadId: "u-1", actorId: "p-2" 
        }),
        code: "UPLOAD_FORBIDDEN_EXCEPTION",
        metadata: {
            uploadId: "u-1", actorId: "p-2" 
        },
    },
    {
        make: () => new UploadTooLargeException({
            sizeBytes: 11, maxBytes: 10 
        }),
        code: "UPLOAD_TOO_LARGE_EXCEPTION",
        metadata: {
            sizeBytes: 11, maxBytes: 10 
        },
    },
    {
        make: () => new UploadMimeNotAllowedException({
            mime: "application/x-msdownload" 
        }),
        code: "UPLOAD_MIME_NOT_ALLOWED_EXCEPTION",
        metadata: {
            mime: "application/x-msdownload" 
        },
    },
    {
        make: () => new UploadTokenInvalidException({
            uploadId: "u-1", reason: "expired" 
        }),
        code: "UPLOAD_TOKEN_INVALID_EXCEPTION",
        metadata: {
            uploadId: "u-1", reason: "expired" 
        },
    },
    {
        make: () => new UploadNotReadyException({
            uploadId: "u-1" 
        }),
        code: "UPLOAD_NOT_READY_EXCEPTION",
        metadata: {
            uploadId: "u-1" 
        },
    },
    {
        make: () => new UploadScanRejectedException({
            uploadId: "u-1", reason: "signature-match" 
        }),
        code: "UPLOAD_SCAN_REJECTED_EXCEPTION",
        metadata: {
            uploadId: "u-1", reason: "signature-match" 
        },
    },
    {
        make: () => new UploadStorageUnavailableException({
            reason: "key-escape" 
        }),
        code: "UPLOAD_STORAGE_UNAVAILABLE_EXCEPTION",
        metadata: {
            reason: "key-escape" 
        },
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

        it("covers every AbstractException subclass file under the capability errors/ directories",
            () => {
                const modulesRoot = path.join(__dirname,
                    "..",
                    "..")
                const errorFiles = (dir: string): Array<string> =>
                    fs.readdirSync(dir,
                        {
                            withFileTypes: true 
                        }).flatMap(entry =>
                        entry.isDirectory()
                            ? errorFiles(path.join(dir,
                                entry.name))
                            : entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
                                ? [path.join(dir,
                                    entry.name)]
                                : [],
                    )
                const errorDirs = (dir: string): Array<string> =>
                    fs.readdirSync(dir,
                        {
                            withFileTypes: true
                        }).flatMap(entry =>
                        entry.isDirectory()
                            ? [
                                ...(entry.name === "errors" ? [path.join(dir,
                                    entry.name)] : []),
                                ...errorDirs(path.join(dir,
                                    entry.name)),
                            ]
                            : [],
                    )
                const files = [
                    path.join(__dirname,
                        "abstract.ts"),
                    ...errorDirs(modulesRoot).flatMap(errorFiles),
                ]
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
