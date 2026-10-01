// node start.mjs           the harness UI for development: the API server and the Vite dev server.
// node start.mjs --tunnel  the harness's named Cloudflare tunnel (starci-harness, %USERPROFILE%/.cloudflared/harness.yml)
//                          to the served UI on 127.0.0.1:4547; the tunnel credential file authenticates it, never a token.
import os from 'node:os';
import path from 'node:path';
import { spawnNode } from '../scripts/api/node/spawn-node.mjs';
import { tunnelRun } from '../scripts/api/cloudflared/tunnel-run.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const tunnelEnv = () => { const env = { ...process.env }; delete env.CF_TUNNEL_TOKEN; delete env.CF_API_TOKEN; return env; };
const children = process.argv.includes('--tunnel')
  ? [tunnelRun(['tunnel', '--config', path.join(os.homedir(), '.cloudflared', 'harness.yml'), 'run', 'starci-harness'], { env: tunnelEnv(), stdio: 'inherit' })]
  : [
    spawnNode(['server.mjs'], { cwd: root, stdio: 'inherit' }),
    spawnNode(['node_modules/vite/bin/vite.js'], { cwd: root, stdio: 'inherit' }),
  ];

function stop() {
  for (const child of children) if (!child.killed) child.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => { if (code && code !== 0) { process.exitCode = code; stop(); } });
