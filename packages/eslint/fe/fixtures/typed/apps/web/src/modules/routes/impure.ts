import { readStore } from "../storage/store"

/** Fixture: helpers that look like next-path helpers and are not pure. */
export const remoteNext = (candidate: string): string => {
    void fetch(candidate)
    return "/"
}
export const asyncNext = async (candidate: string): Promise<string> => candidate
export const viaRemote = (candidate: string): string => remoteNext(candidate)
export const processNext = (): string => process.env.NEXT_PATH ?? "/"
export const storedNext = (): string => readStore()
export const objectNext = (candidate: string): { readonly path: string } => ({ path: candidate })
