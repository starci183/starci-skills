export const LIMIT = 5
export enum Kind { Short = "short", Long = "long" }
export { total } from "./function-subject.mapper"
export function pad(value: string): string
export function pad(value: number): string
export function pad(value: string | number): string {
    return String(value).padStart(LIMIT, "0")
}
export const shout = (value: string): string => value.toUpperCase()
