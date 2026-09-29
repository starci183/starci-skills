import {
    ArgumentsHost, HttpStatus 
} from "@nestjs/common"
import type {
    Response 
} from "express"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    EmailTakenException,
    InvalidCredentialsException,
    PersonUnknownException,
    RedisConnectionException,
    RequestInvalidException,
    SessionInvalidException,
} from "@modules/platform/errors/index"
import {
    BusinessCodeExceptionFilter 
} from "./business-code.filter"

describe("BusinessCodeExceptionFilter",
    () => {
        const filter = new BusinessCodeExceptionFilter()

        /** Runs the filter against a fake response and returns the status and body it wrote. */
        const answer = (error: Parameters<BusinessCodeExceptionFilter["catch"]>[0]) => {
            const json = jest.fn()
            const status = jest.fn().mockReturnValue({
                json 
            })
            const host = mock<ArgumentsHost>({
                switchToHttp: jest.fn().mockReturnValue({
                    getResponse: () => mock<Response>({
                        status 
                    }) 
                }),
            })

            filter.catch(error,
                host)

            return {
                status: status.mock.calls[0][0], body: json.mock.calls[0][0] 
            }
        }

        it.each([
            [new SessionInvalidException({
                message: "No live session answers this token." 
            }),
            HttpStatus.UNAUTHORIZED,
            "SESSION_INVALID"],
            [new RequestInvalidException({
                message: "sessionToken is required." 
            }),
            HttpStatus.BAD_REQUEST,
            "REQUEST_INVALID"],
            [new InvalidCredentialsException({
            }),
            HttpStatus.UNAUTHORIZED,
            "INVALID_CREDENTIALS"],
            [new EmailTakenException({
            }),
            HttpStatus.CONFLICT,
            "EMAIL_TAKEN"],
            [new PersonUnknownException({
            }),
            HttpStatus.NOT_FOUND,
            "PERSON_UNKNOWN"],
        ])("maps %s to its status and answers the business code without the _EXCEPTION suffix",
            (error, status, code) => {
                const written = answer(error)

                expect(written.status).toBe(status)
                expect(written.body).toEqual({
                    code, message: error.message 
                })
            })

        it("spreads the metadata beside the code and message",
            () => {
                const written = answer(new SessionInvalidException({
                    message: "refused", tokenLength: 3 
                }))

                expect(written.body).toEqual({
                    code: "SESSION_INVALID", message: "refused", tokenLength: 3 
                })
            })

        it("answers 500 for a code the table does not name: an undeclared failure is an incident",
            () => {
                const written = answer(new RedisConnectionException({
                    message: "Redis connection is end." 
                }))

                expect(written.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
                expect(written.body).toEqual({
                    code: "REDIS_CONNECTION", message: "Redis connection is end." 
                })
            })
    })
