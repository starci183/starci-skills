import type { Exec, ExecOptions, ExecResult } from "../exec"

/** One recorded command. */
export interface Call {
    readonly command: string
    readonly args: ReadonlyArray<string>
    readonly input: string | undefined
    /** `command args` on one line. */
    readonly line: string
}

/** A scripted {@link Exec}: the handler answers by command line; unanswered commands succeed with empty output. */
export const scriptedExec = (handler: (line: string, call: Call) => Partial<ExecResult> | undefined): { readonly exec: Exec; readonly calls: Array<Call> } => {
    const calls: Array<Call> = []
    const exec: Exec = async (command: string, args: ReadonlyArray<string>, options?: ExecOptions): Promise<ExecResult> => {
        const call: Call = { command, args, input: options?.input, line: `${command} ${args.join(" ")}` }
        calls.push(call)
        const answer = handler(call.line, call)
        return { code: answer?.code ?? 0, stdout: answer?.stdout ?? "", stderr: answer?.stderr ?? "" }
    }
    return { exec, calls }
}
