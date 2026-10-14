// Names and paths may be printed. Compare private test data only as booleans.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mkdtemp } from "./tmpdir.mjs";
import { secretMain } from "../../scripts/hfs/secret.mjs";

const machineRootRestorations = new WeakSet();

export function app(t, files = {}, environment = "dev") {
  const machine = mkdtemp(t, "hfs-secret-");
  const root = path.join(machine, "app");
  fs.mkdirSync(root);
  if (!machineRootRestorations.has(t)) {
    const prior = process.env.STARCI_LOCAL_ROOT;
    machineRootRestorations.add(t);
    t.after(() => {
      if (prior === undefined) delete process.env.STARCI_LOCAL_ROOT;
      else process.env.STARCI_LOCAL_ROOT = prior;
    });
  }
  process.env.STARCI_LOCAL_ROOT = path.join(machine, "private-machine");
  fs.writeFileSync(
    path.join(root, "hfs.json"),
    JSON.stringify({ project: "custody-spec" }),
  );
  const dir = path.join(root, ".starcistacks", environment, "secrets");
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files))
    fs.writeFileSync(path.join(dir, name), text);
  const env = {
    ...process.env,
    HOME: path.join(machine, "home"),
    USERPROFILE: path.join(machine, "home"),
    APPDATA: path.join(machine, "config"),
    LOCALAPPDATA: path.join(machine, "local"),
    XDG_CONFIG_HOME: path.join(machine, "config"),
    XDG_DATA_HOME: path.join(machine, "local"),
  };
  for (const key of Object.keys(env))
    if (key.startsWith("SOPS_")) delete env[key];
  const local =
    process.platform === "darwin"
      ? path.join(env.HOME, "Library", "Application Support")
      : env.LOCALAPPDATA;
  return {
    root,
    dir,
    env,
    localDir: path.join(
      local,
      "StarCi",
      "secrets",
      "custody-spec",
      environment,
    ),
  };
}

export function run(argv, options = {}) {
  const out = [];
  const err = [];
  const code = secretMain(argv, {
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
    ...options,
  });
  return { code, out: out.join(""), err: err.join("") };
}

export function privateAbsent(result, values) {
  for (const value of values) {
    const forms = new Set([
      value,
      value.trim(),
      value.replaceAll("\n", "\\n"),
      ...value.split("\n"),
    ]);
    for (const form of forms)
      if (form)
        assert.ok(
          !(result.out + result.err).includes(form),
          "private data must stay out of command output",
        );
  }
}
