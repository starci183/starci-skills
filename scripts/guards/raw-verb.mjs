// raw-verb.mjs - the PATH wrappers' one door to the shared command policy and the real host executable.
import { resolveRealTool } from '../api/process/resolve-real-tool.mjs';
import { runRealTool } from '../api/process/run-real-tool.mjs';
import { shimDecision, shimRefusalLines } from './command-policy.mjs';

const linesText = (lines) => {
  const text = (Array.isArray(lines) ? lines : [lines]).map(String).join('\n');
  return text.endsWith('\n') ? text : `${text}\n`;
};

/** Apply policy, resolve outside the shim directory, then return the real tool's exact exit code. */
export async function guardRaw(ctx, deps = {}) {
  const program = String(ctx.positionals?.[0] ?? '');
  const args = (ctx.positionals ?? []).slice(1).map(String);
  const decide = deps.shimDecision ?? shimDecision;
  const decision = await decide({ program, args, cwd: ctx.cwd, env: ctx.env });
  if (decision?.verdict) {
    const refusal = (deps.shimRefusalLines ?? shimRefusalLines)(decision.verdict);
    return { code: 2, stderr: linesText(refusal) };
  }

  const resolve = deps.resolver ?? resolveRealTool;
  const target = await resolve(program, { env: ctx.env, home: deps.home, platform: deps.platform });
  if (!target) return { code: 127, stderr: `starci: ${program} not found on PATH outside the shim\n` };

  const run = deps.runner ?? runRealTool;
  const code = await run(target, args, { cwd: ctx.cwd, env: ctx.env, platform: deps.platform });
  return { code };
}
