// op-prompt-render.mjs — the [Op] prompt line for a browser render of a layout. A render of the running app is a capability the
// runtime performs for an op, never a server the op starts; the ops told are the ones command-policy.yaml renders.layoutRender names,
// and the same table is what the command guard enforces.
import { loadCommandPolicy } from '../guards/command-policy.mjs';

const CAUSES = 'app-not-installed, server-not-ready, redirect-loop, navigation-failed, bad-status, app-error, slot-not-found, browser-unavailable, route-dynamic, record-refused';
const LINE = `  starci-layout-render → starci work layout-render --work .starciwork [--app <name>] --node <layout node id> --breakpoint <bp> --theme <theme> [--route </path>] [--slot <selector, default main>] --write [--json] — the only way you get a browser render of a layout: the runtime serves the app itself (next dev on a free port with no host pin, every URL on localhost because the app's i18n proxy rewrites to localhost), loads the node's route at the tree's breakpoint size, empties the page slot and fills it #FF00FF, captures the viewport, stops the server it started and records the capture exactly as layout-tree capture does. You never start next, npm run dev or any server by hand and never browse 127.0.0.1: the command guard refuses it and names this verb. A refusal prints code SHELL_RENDER_UNAVAILABLE, a typed cause (${CAUSES}), the failing URL and the redirect chain: report it as outcome blocked, kind environment, with that output attached; never retry in a loop, never substitute a generated image or a description`;

const namedOps = (skillRoot) => loadCommandPolicy({ root: skillRoot })?.renders?.layoutRender?.ops ?? [];

/** The prompt lines of `op`: the render line when the policy table names it, otherwise none. */
export const renderPromptLines = ({ skillRoot, op }) => (namedOps(skillRoot).includes(op) ? [LINE] : []);
