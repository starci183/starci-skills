import { request, type Outcome } from "@ecommerce/api"

/** The shop's own doors the browser talks to: same-origin route handlers that hold the session cookie and speak to the backend services. */
const DOORS = {
    session: "/api/session",
    cartItems: "/api/cart/items",
    cart: "/api/cart",
    orders: "/api/orders",
    orderReceipt: "/api/orders/receipt",
} as const

/** Which door a call goes through. */
type Door = keyof typeof DOORS

/** A door itself waits on a backend service, so the browser gives it more time than a plain read. */
const DOOR_TIMEOUT_MS = 8000

/**
 * One call to one of the shop's own doors, answered as an Outcome: the door's statuses map back to
 * kinds (401 `refused`, 409/422 `invalid` with the door's stable code, 502 `unavailable`), so a hook
 * chooses its copy from the kind and the code and never from a server sentence.
 */
export const callDoor = (door: Door, method: "POST" | "DELETE", body?: unknown): Promise<Outcome<unknown>> =>
    request({ url: DOORS[door], method, body, timeoutMs: DOOR_TIMEOUT_MS })
