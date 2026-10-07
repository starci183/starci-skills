// Owner launch-trust adoption for a private fixture: the real owner configuration seam (config.yaml launchTrust)
// plus a re-rooted agent trust home. Both belong only to the fixture's own exact roots.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGuardLauncher } from './guard-launcher.mjs';

const EXAMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config.example.yaml');

/** The owner config text with launchTrust adopted for `roots` (and the `kernel:` line replaced when given). */
export function adoptedConfigText({ roots, ref, kernel = null, text = fs.readFileSync(EXAMPLE, 'utf8') }) {
  const trust = { profile: 'automatic', approvedBy: 'owner', approvalRef: ref, roots };
  const adopted = text.replace(/^launchTrust:.*$/m, `launchTrust: ${JSON.stringify(trust)}`);
  return kernel ? adopted.replace(/^kernel:.*$/m, kernel) : adopted;
}

/** Writes <root>/owner/config.yaml with adoption and creates <root>/trust-home with the guard launcher launch trust probes; returns the env that selects both. */
export function adoptLaunchTrust(root, { roots, ref, kernel }) {
  const ownerRoot = path.join(root, 'owner'), trustHome = path.join(root, 'trust-home');
  fs.mkdirSync(ownerRoot, { recursive: true });
  fs.mkdirSync(trustHome, { recursive: true });
  installGuardLauncher(trustHome);
  fs.writeFileSync(path.join(ownerRoot, 'config.yaml'), adoptedConfigText({ roots, ref, kernel }));
  return { STARCI_OWNER_ROOT: ownerRoot, STARCI_AGENT_TRUST_HOME: trustHome };
}
