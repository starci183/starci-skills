// secret-files.mjs — private files for app secrets, always outside the repository.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** The platform's SOPS age identity and StarCi local data roots. */
export function secretRoots(env = process.env, platform = process.platform) {
  const home = env.USERPROFILE || env.HOME || os.homedir();
  const support = path.join(home, "Library", "Application Support");
  let config;
  if (platform === "win32")
    config = env.APPDATA || path.join(home, "AppData", "Roaming");
  else if (platform === "darwin") config = support;
  else config = env.XDG_CONFIG_HOME || path.join(home, ".config");
  let local;
  if (platform === "win32")
    local = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  else if (platform === "darwin") local = support;
  else local = env.XDG_DATA_HOME || path.join(home, ".local", "share");
  return {
    identity: path.resolve(config, "sops", "age", "keys.txt"),
    local: path.resolve(local, "StarCi", "secrets"),
  };
}

const inside = (root, target) => {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};

/** Reject repository custody, including a path spelled through a symlink or junction. */
export function outsideRepository(repoRoot, target) {
  const root = fs.realpathSync(repoRoot);
  let ancestor = path.resolve(target);
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor)
      throw new Error("cannot resolve the private storage root");
    ancestor = parent;
  }
  const resolved = path.resolve(
    fs.realpathSync(ancestor),
    path.relative(ancestor, path.resolve(target)),
  );
  if (
    inside(root, resolved) ||
    inside(path.resolve(repoRoot), path.resolve(target))
  )
    throw new Error("private storage must be outside the repository");
}

/** Create private directories without following a symlink at any storage component. */
export function privateDirectory(repoRoot, directory) {
  outsideRepository(repoRoot, directory);
  const missing = [];
  for (let at = directory; !fs.existsSync(at); at = path.dirname(at))
    missing.push(at);
  for (const at of missing.toReversed()) fs.mkdirSync(at, { mode: 0o700 });
  for (let at = directory; ; at = path.dirname(at)) {
    const stat = fs.lstatSync(at);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("private storage must use ordinary directories");
    if (path.dirname(at) === at) break;
  }
  outsideRepository(repoRoot, directory);
  if (process.platform !== "win32") fs.chmodSync(directory, 0o700);
}

/** The declared project owns a separate environment directory on the local machine. */
export function materializedDirectory(repoRoot, environment, env, platform) {
  let project;
  const declaration = path.join(repoRoot, "hfs.json");
  if (fs.existsSync(declaration))
    project = JSON.parse(fs.readFileSync(declaration, "utf8")).project;
  if (!project && fs.existsSync(path.join(repoRoot, "package.json")))
    project = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ).name;
  project ||= path.basename(repoRoot);
  if (
    typeof project !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(project) ||
    project === ".."
  )
    throw new Error("the project name must be a safe local directory name");
  const directory = path.join(
    secretRoots(env, platform).local,
    project,
    environment,
  );
  privateDirectory(repoRoot, directory);
  return directory;
}

/** Atomically publish one KEY file; an existing link or hard link is never overwritten. */
export function writeSecretFile(directory, key, value) {
  const file = path.join(directory, key);
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
      throw new Error("a private KEY file must be an ordinary file");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = path.join(directory, `.${key}-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, value, {
      flag: "wx",
      mode: 0o600,
      flush: true,
    });
    fs.renameSync(temporary, file);
    if (process.platform !== "win32") fs.chmodSync(file, 0o600);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return file;
}
