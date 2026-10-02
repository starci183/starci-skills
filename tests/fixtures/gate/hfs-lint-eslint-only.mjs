// The `starci app lint` of the gate specs: the real lint/run.mjs (ESLint through the fixture's own config and install) with the
// repository-check half answering no finding - this checkout installs no prettier, which `starci app check` needs to run.
import { lintRepository, parseLintArgs } from '../../../packages/hfs/lint/run.mjs';

const [verb, ...rest] = process.argv.slice(2);
if (verb !== 'lint') throw new Error(`only lint is stubbed, not ${verb}`);
const { report, exit } = await lintRepository({ repoRoot: process.cwd(), opts: parseLintArgs(rest), hfsCheck: async () => ({ findings: [] }) });
process.stdout.write(`${JSON.stringify(report)}\n`);
process.exitCode = exit;
