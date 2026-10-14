import useSWR from "swr"
import { queryAccount } from "@/modules/api/graphql/queries/query-account"
import { useAppSelector } from "@/redux"

/** The SWR key of the account query; the signed-in person is its identity. */
const QUERY_ACCOUNT_SWR_KEY = "QUERY_ACCOUNT_SWR"

/** The signed-in shopper's account (identity `account`); no request while nobody is signed in. */
export const useQueryAccountSwr = () => {
    const personId = useAppSelector((state) => state.session.session?.personId)
    return useSWR(personId === undefined ? null : [QUERY_ACCOUNT_SWR_KEY, personId], () => queryAccount())
}
