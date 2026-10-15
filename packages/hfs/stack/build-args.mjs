// build-args.mjs - `starci app stack build-args --app <app>`: the public build values of one image (literal values plus the declared keys
// of a sealed member). They are public by design (the browser receives them), so they are printed as KEY=VALUE; `data` carries key names only.
// In GitHub Actions each sealed value is masked first and the lines are appended to $GITHUB_OUTPUT as a multi-line `args` output.
import fs from 'node:fs';
import { refusal } from './errors.mjs';
import { openMember } from './sealed.mjs';

const OUTPUT_DELIMITER = 'STARCI_BUILD_ARGS_END';
const ONE_LINE = /^[^\r\n]+$/u;

function imageOf(config, app) {
  const found = Object.entries(config.images).find(([, entry]) => entry.app === app);
  if (!found) throw refusal('STACK_APP_UNKNOWN', `no image of the deploy block builds the app ${app}`);
  return { service: found[0], buildArgs: found[1].buildArgs };
}

function checkedValue(key, value) {
  if (typeof value !== 'string' || !ONE_LINE.test(value)) throw refusal('STACK_BUILD_ARG_INVALID', `${key} must be present and one line`);
  return value;
}

function sealedValues(ctx, config, sealed) {
  if (sealed === null) return {};
  const map = openMember(ctx, config, sealed.member);
  return Object.fromEntries(sealed.keys.map((key) => [key, checkedValue(key, map[key])]));
}

function publish(ctx, sealed, lines) {
  if (ctx.env.GITHUB_ACTIONS !== 'true') return [];
  if (ctx.env.GITHUB_OUTPUT) fs.appendFileSync(ctx.env.GITHUB_OUTPUT, `args<<${OUTPUT_DELIMITER}\n${lines.join('\n')}\n${OUTPUT_DELIMITER}\n`);
  return Object.values(sealed).map((value) => `::add-mask::${value}`);
}

/** The build values of the image whose `app` is `options.app`. */
export async function buildArgs(ctx, config, options) {
  const { service, buildArgs: declared } = imageOf(config, options.app);
  const literal = Object.fromEntries(Object.entries(declared.values).map(([key, value]) => [key, checkedValue(key, value)]));
  const sealed = sealedValues(ctx, config, declared.sealed);
  const pairs = Object.entries({ ...literal, ...sealed }).map(([key, value]) => `${key}=${value}`);
  const masks = publish(ctx, sealed, pairs);
  return { ok: true, lines: [...masks, ...pairs], data: { app: options.app, service, keys: Object.keys({ ...literal, ...sealed }) } };
}
