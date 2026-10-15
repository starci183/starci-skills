// provision.mjs - creates the immutable, versioned Swarm secrets and config objects a release names, on the daemon DOCKER_HOST points at.
// Each secret value is opened in memory and piped to `docker secret create <runtimeName> -` on stdin: it never reaches argv, a file, the
// output or an error message. A name that exists is left alone (same value, same name); a name is never reused for another value, and
// an earlier version is never removed here (prune runs only after the release is accepted).
import fs from 'node:fs';
import { firstLine, lines as splitLines, tool } from './context.mjs';
import { failure, refusal } from './errors.mjs';
import { isReleaseId } from './digest.mjs';
import { configObjects, loadSealed } from './sealed.mjs';

const STALE = 'render the release again';

function readRelease(options) {
  if (options.release) return options.release;
  if (!options.releaseFile) throw refusal('STACK_RELEASE_MISSING', 'provision needs a release record (release or releaseFile)');
  try {
    return JSON.parse(fs.readFileSync(options.releaseFile, 'utf8'));
  } catch {
    throw refusal('STACK_RELEASE_INVALID', `${options.releaseFile} is not a readable release record`);
  }
}

function releaseId(release) {
  const id = String(release.releaseDigest).slice(0, 16);
  if (!isReleaseId(id) || !Array.isArray(release.secrets) || !Array.isArray(release.configs)) throw refusal('STACK_RELEASE_INVALID', 'the release record has no valid releaseDigest, secrets and configs');
  return id;
}

function existing(ctx, kind) {
  const run = tool(ctx, 'docker', [kind, 'ls', '--format', '{{.Name}}']);
  if (run.error || run.status !== 0) throw failure('STACK_PROVISION_FAILED', `docker ${kind} ls failed: ${run.error?.message ?? firstLine(run.stderr)}`);
  return new Set(splitLines(run.stdout));
}

function createFailure(run, what, value) {
  const text = run.error?.message ?? firstLine(run.stderr);
  return failure('STACK_PROVISION_FAILED', `docker ${what} failed: ${value === undefined ? text : text.replaceAll(value, '[value]')}`);
}

function create(ctx, kind, labels, name, input) {
  const label = labels.flatMap((item) => ['--label', item]);
  return tool(ctx, 'docker', [kind, 'create', ...label, name, '-'], { input });
}

function plan(ctx, config, release, sealed) {
  const secrets = release.secrets.map((entry) => {
    const secret = sealed.secrets[entry.key];
    if (secret?.runtimeName !== entry.runtimeName) throw refusal('STACK_RELEASE_STALE', `the sealed custody no longer matches the release record for ${entry.key}; ${STALE}`);
    return { key: entry.key, name: entry.runtimeName, value: secret.value };
  });
  const files = new Map(configObjects(config).map((object) => [object.name, object.file]));
  const configs = release.configs.map((entry) => {
    if (!files.has(entry.name)) throw refusal('STACK_RELEASE_STALE', `the config ${entry.name} does not match the committed files; ${STALE}`);
    return { logical: entry.logical, name: entry.name, file: files.get(entry.name) };
  });
  const haveSecrets = existing(ctx, 'secret');
  const haveConfigs = existing(ctx, 'config');
  return {
    secrets: secrets.filter((item) => !haveSecrets.has(item.name)),
    kept: secrets.filter((item) => haveSecrets.has(item.name)).length,
    configs: configs.filter((item) => !haveConfigs.has(item.name)),
  };
}

function createAll(ctx, config, id, todo) {
  const managed = `${config.stack}.managed=true`;
  const tagged = `${config.stack}.release=${id}`;
  for (const item of todo.secrets) {
    const run = create(ctx, 'secret', [managed, `${config.stack}.key=${item.key}`, tagged], item.name, item.value);
    if (run.error || run.status !== 0) throw createFailure(run, `secret create for ${item.key}`, item.value);
  }
  for (const item of todo.configs) {
    const run = create(ctx, 'config', [managed, tagged], item.name, fs.readFileSync(item.file));
    if (run.error || run.status !== 0) throw createFailure(run, `config create for ${item.logical}`);
  }
}

/** Creates the missing secrets and configs of a release; without `execute` it only reports what it would create. */
export async function provisionRelease(ctx, config, options = {}) {
  const release = readRelease(options);
  const id = releaseId(release);
  const todo = plan(ctx, config, release, loadSealed(ctx, config));
  const data = { created: todo.secrets.length, kept: todo.kept, configsCreated: todo.configs.length };
  if (options.execute !== true) {
    const keys = todo.secrets.map((item) => item.key).join(', ');
    return { ok: true, lines: [`dry run: would create ${data.created} secrets (${keys}), ${data.configsCreated} configs; ${data.kept} kept`], data };
  }
  createAll(ctx, config, id, todo);
  return { ok: true, lines: [`provision: secrets created ${data.created}, kept ${data.kept}; configs created ${data.configsCreated}`], data };
}
