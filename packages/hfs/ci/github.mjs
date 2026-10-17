import { spawnSync } from 'node:child_process';

/** Refusals carry only fixed public diagnostics, never child output or secret input. */
export function refuse(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

/** All GitHub access uses argument arrays and captured output; secret bodies travel only on stdin. */
export function github({ cwd, spawn = spawnSync, env = process.env }) {
  function run(args, input) {
    let result;
    try { result = spawn('gh', args, { cwd, env, encoding: 'utf8', shell: false, stdio: ['pipe', 'pipe', 'pipe'], ...(input === undefined ? {} : { input }) }); }
    catch { throw refuse('CI_GITHUB_UNREADABLE', 'GitHub CLI could not run; check installation and authentication'); }
    if (result.error || result.status !== 0) throw refuse('CI_GITHUB_UNREADABLE', 'GitHub CLI failed; check authentication and repository access');
    return result.stdout;
  }
  function json(args) {
    try { return JSON.parse(run(args)); }
    catch (error) {
      if (error.code) throw error;
      throw refuse('CI_GITHUB_UNREADABLE', 'GitHub CLI returned invalid JSON');
    }
  }
  function repository(explicit) {
    const repo = explicit ?? json(['repo', 'view', '--json', 'nameWithOwner'])?.nameWithOwner;
    if (typeof repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw refuse('CI_GITHUB_UNREADABLE', 'a repository owner/name is required');
    return repo;
  }
  return { run, json, repository };
}

/** Repository, environment and Dependabot stores are distinct even when their names coincide. */
export function scopeArgs(options) {
  return options.dependabot ? ['--app', 'dependabot'] : options.env ? ['--env', options.env] : [];
}

export function scopeName(options) {
  return options.dependabot ? 'dependabot' : options.env ? `environment:${options.env}` : 'repository';
}
