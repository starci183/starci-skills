/** Creates a process-local liveness response identifying the Next app; no dependency is probed. */
export const createLivenessHandler = (service: string): (() => Response) =>
    () => Response.json({ status: "ok", info: { service }, error: {}, details: {} })
