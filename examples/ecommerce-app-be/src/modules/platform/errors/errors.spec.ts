import {
    DomainError 
} from "./domain-error"
import {
    EmailTakenException,
    IdentityContractMismatchException,
    IdentityServiceUnavailableException,
    InvalidCredentialsException,
    MetadataFileMissingException,
    MetadataPortsMissingException,
    MetadataUnreadableException,
    OrderContractMismatchException,
    OrderServiceUnavailableException,
    PersonUnknownException,
    RedisConnectionException,
    RedisUnexpectedReplyException,
    RequestInvalidException,
    SessionInvalidException,
} from "./index"

describe("the capability errors",
    () => {
        it.each([
            ["EmailTakenException",
                "EMAIL_TAKEN_EXCEPTION",
                new EmailTakenException({
                })],
            ["InvalidCredentialsException",
                "INVALID_CREDENTIALS_EXCEPTION",
                new InvalidCredentialsException({
                })],
            ["PersonUnknownException",
                "PERSON_UNKNOWN_EXCEPTION",
                new PersonUnknownException({
                })],
            ["IdentityContractMismatchException",
                "IDENTITY_CONTRACT_MISMATCH_EXCEPTION",
                new IdentityContractMismatchException({
                })],
            ["OrderContractMismatchException",
                "ORDER_CONTRACT_MISMATCH_EXCEPTION",
                new OrderContractMismatchException({
                })],
        ])("%s is a DomainError with its stable code and a fixed sentence",
            (name, code, error) => {
                expect(error).toBeInstanceOf(DomainError)
                expect(error.name).toBe(name)
                expect(error.code).toBe(code)
                expect(error.message).not.toBe("")
                expect(error.metadata).toEqual({
                })
            })

        it.each([
            ["IdentityServiceUnavailableException",
                "IDENTITY_SERVICE_UNAVAILABLE_EXCEPTION",
                new IdentityServiceUnavailableException({
                    message: "unreachable" 
                })],
            ["OrderServiceUnavailableException",
                "ORDER_SERVICE_UNAVAILABLE_EXCEPTION",
                new OrderServiceUnavailableException({
                    message: "unreachable" 
                })],
            ["MetadataFileMissingException",
                "METADATA_FILE_MISSING_EXCEPTION",
                new MetadataFileMissingException({
                    message: "unreachable" 
                })],
            ["MetadataPortsMissingException",
                "METADATA_PORTS_MISSING_EXCEPTION",
                new MetadataPortsMissingException({
                    message: "unreachable" 
                })],
            ["MetadataUnreadableException",
                "METADATA_UNREADABLE_EXCEPTION",
                new MetadataUnreadableException({
                    message: "unreachable" 
                })],
            ["RedisConnectionException",
                "REDIS_CONNECTION_EXCEPTION",
                new RedisConnectionException({
                    message: "unreachable" 
                })],
            ["RedisUnexpectedReplyException",
                "REDIS_UNEXPECTED_REPLY_EXCEPTION",
                new RedisUnexpectedReplyException({
                    message: "unreachable" 
                })],
            ["RequestInvalidException",
                "REQUEST_INVALID_EXCEPTION",
                new RequestInvalidException({
                    message: "unreachable" 
                })],
            ["SessionInvalidException",
                "SESSION_INVALID_EXCEPTION",
                new SessionInvalidException({
                    message: "unreachable" 
                })],
        ])("%s carries the throw site's sentence and its stable code",
            (name, code, error) => {
                expect(error).toBeInstanceOf(DomainError)
                expect(error.name).toBe(name)
                expect(error.code).toBe(code)
                expect(error.message).toBe("unreachable")
                expect(error.metadata).toEqual({
                })
            })

        it("keeps extra fields the throw site attached in metadata, apart from the message",
            () => {
                const error = new SessionInvalidException({
                    message: "refused", tokenLength: 3 
                })

                expect(error.message).toBe("refused")
                expect(error.metadata).toEqual({
                    tokenLength: 3 
                })
            })
    })
