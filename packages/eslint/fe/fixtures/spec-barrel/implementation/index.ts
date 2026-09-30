/** The safe subset of browser storage used by the app, with write success reported to the caller. */
export type BrowserStorageStore = Readonly<{
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => boolean
    removeItem: (key: string) => boolean
}>

type StorageName = "localStorage" | "sessionStorage"

/** Creates a store whose browser access and storage operations may fail without escaping to the caller. */
const createStore = (name: StorageName): BrowserStorageStore => ({
    getItem: (key) => {
        try {
            return typeof window === "undefined" ? null : window[name].getItem(key)
        } catch {
            return null
        }
    },
    setItem: (key, value) => {
        try {
            if (typeof window === "undefined") return false
            window[name].setItem(key, value)
            return true
        } catch {
            return false
        }
    },
    removeItem: (key) => {
        try {
            if (typeof window === "undefined") return false
            window[name].removeItem(key)
            return true
        } catch {
            return false
        }
    },
})

/** Safe persistent storage for preferences, unavailable during SSR or when browser storage is blocked. */
export const localStore = createStore("localStorage")

/** Safe per-tab storage, unavailable during SSR or when browser storage is blocked. */
export const sessionStore = createStore("sessionStorage")
