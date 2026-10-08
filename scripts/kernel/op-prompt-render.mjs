// op-prompt-render.mjs — the line of the [Op] prompt that tells a layout-capturing op how it gets a render (a real browser render
// of the running app is a runtime capability, never a server the op starts). Only the ops modules/kernel/command-policy.yaml
// renders.layoutRender names are told; the same table is what the command guard enforces.
import { loadCommandPolicy } from '../guards/command-policy.mjs';

const CAUSES = 'app-not-installed, server-not-ready, redirect-loop, navigation-failed, bad-status, app-error, slot-not-found, browser-unavailable, route-dynamic, record-refused';

/** The machine line for `op` (its kind), or no line when the op is not one the render table names. */
export function renderPromptLines({ skillRoot, op }) {
  const render = loadCommandPolicy({ root: skillRoot })?.renders?.layoutRender;
  if (!Array.isArray(render?.ops) || !render.ops.includes(op)) return [];
  return [
    `  starci-layout-render → starci work layout-render --work .starciwork [--app <name>] --node <layout node id> --breakpoint <bp> --theme <theme> [--route </path>] [--slot <selector, default main>] --write [--json] — the only way you get a browser render of a layout: the runtime serves the app itself (next dev on a free port with no host pin, every URL on localhost because the app's i18n proxy rewrites to localhost), loads the node's route at the tree's breakpoint size, empties the page slot and fills it #FF00FF, captures the viewport, stops the server it started and records the capture exactly as layout-tree capture does. You never start next, npm run dev or any server by hand and never browse 127.0.0.1: the command guard refuses it and names this verb. A refusal prints code SHELL_RENDER_UNAVAILABLE, a typed cause (${CAUSES}), the failing URL and the redirect chain: report it as outcome blocked, kind environment, with that output attached; never retry in a loop, never substitute a generated image or a description`,
  ];
}
