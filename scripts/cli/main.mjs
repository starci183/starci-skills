#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importModule } from '../api/node/import-module.mjs';
import { runScript } from '../api/node/run-script.mjs';
import { isMain } from '../lib/is-main.mjs';
import { currentRole, requireRole } from './roles.mjs';
import { logRefusal } from '../guards/refusals.mjs';
import { RUNTIME_CHANGE_CODE } from '../machine/runtime-change.mjs';
import { credentialPreflight } from './lib/credential-preflight.mjs';
import { boundIdentityOf } from '../guards/rights.mjs';
import { callerOf } from '../guards/op-caller.mjs';
import { confirmOwnerPlan } from '../api/process/confirm-owner-plan.mjs';
import { starciLocalRoot } from '../../engine/runtime-root.mjs';
import { guardsRoot } from '../guards/guards-root.mjs';

const defaultRuntimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliModule = (file) => importModule(pathToFileURL(path.join(defaultRuntimeRoot, 'packages', 'cli', 'src', file)).href);
const [{ CATALOG }, { splitCommand, validateArgs, withFlagsBeforeDashes }, { groupHelp, verbHelp }] = await Promise.all([
  cliModule('catalog.generated.mjs'), cliModule('validate-args.mjs'), cliModule('help.mjs'),
]);

const writeTo = (target, text) => {
  if (typeof target === 'function') target(text);
  else target.write(text);
};

const refuse = (stderr, message, code = 2) => {
  writeTo(stderr, `starci: ${message}\n`);
  return code;
};

const verbFailure = (stderr, group, verb, message) => {
  writeTo(stderr, `starci ${group} ${verb}: ${message}\n`);
  return 1;
};

const printModuleResult = ({ result, wantsJson, stdout, stderr, group, verb }) => {
  if (!result || typeof result !== 'object' || !Number.isInteger(result.code) || result.code < 0 || result.code > 255) {
    return verbFailure(stderr, group, verb, `returned invalid code ${JSON.stringify(result?.code)}`);
  }
  if (result.stderr !== undefined) writeTo(stderr, String(result.stderr));
  if (wantsJson) {
    if (result.data === undefined) return verbFailure(stderr, group, verb, 'returned no data for machine output');
    writeTo(stdout, `${JSON.stringify(result.data, null, 2)}\n`);
  } else if (result.text !== undefined) {
    const text = String(result.text);
    writeTo(stdout, text.endsWith('\n') ? text : `${text}\n`);
  }
  return result.code;
};

const runModule = async ({ command, ctx, root, importModuleFn, wantsJson, stdout, stderr, group, verb }) => {
  try {
    const target = pathToFileURL(path.resolve(root, command.impl.module)).href;
    const loaded = await importModuleFn(target);
    const handler = loaded?.[command.impl.export];
    if (typeof handler !== 'function') return verbFailure(stderr, group, verb, `export ${command.impl.export} is not a function`);
    const result = await handler(ctx);
    return printModuleResult({ result, wantsJson, stdout, stderr, group, verb });
  } catch (error) {
    return verbFailure(stderr, group, verb, error?.message ?? error);
  }
};

/** Attach native admission and context callbacks; command arguments cannot supply their identities. */
function attachProvisionContext(ctx, { env, root, operationPolicy, acceptsPlan }) {
  const provisionCaller = ({ db, file } = {}) => ({
    ...boundIdentityOf(env.ORCA_TERMINAL_HANDLE, { root, env }), terminal: env.ORCA_TERMINAL_HANDLE,
    classification: callerOf(db, env, { file, root }),
  });
  if (operationPolicy || acceptsPlan) ctx.provisionCaller = provisionCaller;
  if (operationPolicy) {
    // Native consumers receive the same host context as admission; no target declaration can choose it.
    ctx.provisionNativeContext = () => ({
      schema: 'starci/native-provision-context@1', terminal: env.ORCA_TERMINAL_HANDLE ?? null,
      stateRoot: starciLocalRoot(env, root), guardsRoot: guardsRoot(root, env),
    });
  }
  if (acceptsPlan) {
    // The normal role gate is not a human acceptance receipt; the owner terminal must confirm the frozen plan.
    ctx.confirmProvisionPlan = async (request, binding) => {
      try {
        const ownerNow = () => {
          const identity = provisionCaller(binding);
          return currentRole({ env }) === 'owner' && !identity.guard && !identity.seat
            && identity.classification.role === 'owner' && identity.classification.via === 'unbound';
        };
        if (!ownerNow()) return { accepted: false, code: 'owner-terminal-required' };
        // Redirected input cannot supply the separate native terminal checkpoint.
        const confirmation = await confirmOwnerPlan(request);
        return confirmation.accepted === true && !ownerNow()
          ? { accepted: false, code: 'owner-terminal-required' } : confirmation;
      } catch { return { accepted: false, code: 'owner-terminal-required' }; }
    };
  }
}

/** Runtime-side catalog dispatcher. */
export function main(argv = process.argv.slice(2), io = {}) {
  const catalog = io.catalog ?? CATALOG;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const env = io.env ?? process.env;
  const root = io.runtimeRoot ?? defaultRuntimeRoot;
  const split = splitCommand(argv, catalog.global ?? []);
  if (!split.group) return refuse(stderr, 'missing runtime command group');
  const group = catalog.groups?.[split.group];
  if (group?.owner !== 'runtime') return refuse(stderr, `unknown runtime group "${split.group}"`);
  if (!split.verb) {
    if (!split.help) return refuse(stderr, `missing verb for group "${split.group}"`);
    writeTo(stdout, groupHelp(catalog, split.group));
    return 0;
  }
  const command = group.verbs?.[split.verb];
  if (!command) return refuse(stderr, `unknown verb "${split.verb}" for group "${split.group}"`);
  if (split.help) {
    writeTo(stdout, verbHelp(catalog, split.group, split.verb));
    return 0;
  }

  const checked = validateArgs(split.args, { ...command, group: split.group, verb: split.verb }, catalog.global ?? []);
  if (!checked.ok) return refuse(stderr, checked.error, checked.code);
  const cwd = path.resolve(io.cwd ?? process.cwd(), checked.global.cwd ?? '.');
  const role = currentRole({ env });
  if (command.roles?.length) {
    const roleRefusal = requireRole({ role, group: split.group, verb: split.verb, roles: command.roles });
    if (roleRefusal) {
      // A Supervisor or Kernel seat asking for a runtime change leaves a refusal row the Debug digest reads (as-runtime-change-refused).
      if (roleRefusal.includes(RUNTIME_CHANGE_CODE)) logRefusal({ tool: 'starci', via: 'cli', role, code: RUNTIME_CHANGE_CODE, command: `starci ${split.group} ${split.verb}`, reason: roleRefusal });
      writeTo(stderr, `${roleRefusal}\n`);
      return 2;
    }
  }

  const invoke = preflight => {
    if (!preflight.ok) {
      if (checked.global.json === true || command.json === 'always')
        writeTo(stdout, JSON.stringify(preflight.data, null, 2) + '\n');
      const names = preflight.data.missing.map(row => row.name).join(', ');
      writeTo(stderr, 'starci ' + split.group + ' ' + split.verb + ': ' + preflight.data.code + ': '
        + (names || 'selected credential sources unavailable') + '. Configure credentials locally; never paste values into chat.\n');
      return 2;
    }
    const env = preflight.env;
    if (command.impl?.module) {
      const ctxIo = {
        stdout: (text) => writeTo(stdout, text),
        stderr: (text) => writeTo(stderr, text),
      };
      const ctx = {
        args: checked.args,
        positionals: checked.positionals,
        global: checked.global,
        env,
        cwd,
        io: ctxIo,
        role,
        command: { group: split.group, verb: split.verb },
        operationPolicy: checked.operationPolicy,
        now: typeof io.now === 'function' ? io.now() : (io.now ?? Date.now()),
      };
      attachProvisionContext(ctx, { env, root, operationPolicy: checked.operationPolicy,
        acceptsPlan: split.group === 'provision' && split.verb === 'operation' && checked.positionals[0] === 'accept' });
      return runModule({
        command,
        ctx,
        root,
        importModuleFn: io.importModule ?? importModule,
        wantsJson: checked.global.json === true || command.json === 'always',
        stdout,
        stderr,
        group: split.group,
        verb: split.verb,
      });
    }
    if (!command.impl?.script) return refuse(stderr, `${split.group} ${split.verb} has no runtime implementation`, 1);

    // --quiet and --edition are dispatcher concerns. Runtime handlers never see
    // spellings they do not declare themselves; --cwd is represented by cwd.
    const jsonFlag = checked.global.json === true && command.json !== 'always' ? ['--json'] : [];
    const args = [...(command.impl.args ?? []), ...withFlagsBeforeDashes(checked.localArgs, jsonFlag)];
    const script = path.resolve(root, command.impl.script);
    const runner = io.runScript ?? runScript;
    return runner(script, args, { cwd, env });
  };
  const preflight = credentialPreflight({
    group: split.group, verb: split.verb, command, args: checked.args, positionals: checked.positionals,
    runtimeRoot: root, cwd, env,
  }, io.credentialDependencies);
  return typeof preflight.then === 'function' ? preflight.then(invoke) : invoke(preflight);
}

if (isMain(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
