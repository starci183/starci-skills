import type { AccountPersonView } from "@modules/domain/account"
import type { RegisterRequest } from "../../application/register.contracts"
import type { RegisterInput } from "./dto/register.input"
import type { RegisterType } from "./dto/register.type"

/** Maps the GraphQL input to the command request. */
export const toRegisterRequest = (input: RegisterInput): RegisterRequest => ({
    email: input.email,
    password: input.password,
})

/** Maps the registered person to the GraphQL type. */
export const toRegisterType = (person: AccountPersonView): RegisterType => ({ personId: person.personId })
