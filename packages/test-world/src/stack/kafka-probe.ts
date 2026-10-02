/**
 * A minimal Kafka wire probe: one ApiVersions request (api key 18, version 0) over a plain TCP socket, so the library proves a
 * slot listener answers through its proxy without a Kafka client dependency.
 */
import { Socket } from "node:net"

const API_VERSIONS = 18
const CLIENT_ID = "starci-test-world"

/** The ApiVersions v0 request frame: size, api key, api version, correlation id, client id (int16 length + bytes). */
export const apiVersionsRequest = (correlationId: number, clientId = CLIENT_ID): Buffer => {
    const client = Buffer.from(clientId, "utf8")
    const body = Buffer.alloc(2 + 2 + 4 + 2 + client.length)
    body.writeInt16BE(API_VERSIONS, 0)
    body.writeInt16BE(0, 2)
    body.writeInt32BE(correlationId, 4)
    body.writeInt16BE(client.length, 8)
    client.copy(body, 10)
    const size = Buffer.alloc(4)
    size.writeInt32BE(body.length, 0)
    return Buffer.concat([size, body])
}

/** Reads a complete ApiVersions v0 response frame (null while it is incomplete): its correlation id and error code. */
export const apiVersionsResponse = (frame: Buffer): { readonly correlationId: number; readonly errorCode: number } | null => {
    if (frame.length < 4) return null
    const size = frame.readInt32BE(0)
    if (frame.length < 4 + size || size < 6) return null
    return { correlationId: frame.readInt32BE(4), errorCode: frame.readInt16BE(8) }
}

/** Whether a broker answers ApiVersions with no error at host:port within the timeout. */
export const kafkaAnswers = (host: string, port: number, timeoutMs = 5000): Promise<boolean> =>
    new Promise((resolve) => {
        const correlationId = Math.floor(Math.random() * 0x7fffffff)
        const socket = new Socket()
        let received = Buffer.alloc(0)
        let settled = false
        const finish = (answer: boolean): void => {
            if (settled) return
            settled = true
            socket.destroy()
            resolve(answer)
        }
        socket.setTimeout(timeoutMs, () => finish(false))
        socket.once("error", () => finish(false))
        // a peer that resets or ends the connection without answering (a cut proxy) is a no, never a promise left pending
        socket.once("close", () => finish(false))
        socket.on("data", (chunk: Buffer) => {
            received = Buffer.concat([received, chunk])
            const response = apiVersionsResponse(received)
            if (response !== null) finish(response.correlationId === correlationId && response.errorCode === 0)
        })
        socket.connect(port, host, () => socket.write(apiVersionsRequest(correlationId)))
    })
