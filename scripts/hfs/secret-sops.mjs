// secret-sops.mjs - runtime SOPS adapter and age identity selection.
import fs from "node:fs";
import path from "node:path";
import { runProgram } from "../api/process/run-program.mjs";
import { resolveRealTool } from "../api/process/resolve-real-tool.mjs";
import { decrypt as sopsDecrypt } from "../api/sops/decrypt.mjs";
import { seal as sopsSeal } from "../api/sops/seal.mjs";
import { invocationDir } from "../lib/roots.mjs";
import { configuredRecipients, secretTools } from "./secret-init.mjs";
import { outsideRepository, secretRoots } from "./secret-files.mjs";
import { SecretError, publicStorage } from "./secret-errors.mjs";

const sopsInvocation = Object.freeze({ runProgram, resolveRealTool });

/** The default sops seam: the runtime's sops api, which finds the binary on this machine. */
export function defaultSops(
  env = process.env,
  repoRoot = invocationDir(),
  platform = process.platform,
  tools,
) {
  const { sops: binary } = publicStorage(() => secretTools(env, tools));
  const selectedEnv = { ...env };
  const checkIdentity = (file) =>
    publicStorage(() => {
      outsideRepository(repoRoot, file);
      if (fs.existsSync(file)) {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
          throw new Error(
            "the age identity must be an ordinary private file without hard links",
          );
      }
    });
  for (const [name, value] of Object.entries(env))
    if (/^SOPS_AGE_KEY_FILE$/i.test(name) && value) {
      if (!path.isAbsolute(value))
        throw new SecretError(
          "SOPS_AGE_KEY_FILE must be an absolute path outside the repository",
        );
      checkIdentity(value);
    }
  if (
    !Object.keys(env).some((name) => /^SOPS_AGE_KEY(?:_FILE)?$/i.test(name))
  ) {
    const identity = secretRoots(env, platform).identity;
    checkIdentity(identity);
    if (fs.existsSync(identity)) selectedEnv.SOPS_AGE_KEY_FILE = identity;
  }
  const refuse = (what, result) => {
    if (result.error?.identityRefusal)
      return Object.assign(new SecretError(result.error.message), {
        identityRefusal: result.error.identityRefusal,
      });
    if (result.error?.code === "SOPS_MISSING")
      return new SecretError(result.error.message);
    return new SecretError(
      `sops could not ${what} (exit ${String(result.status)})`,
    );
  };
  return {
    decrypt(file, format) {
      const result = sopsDecrypt(
        binary,
        ["decrypt", "--input-type", format, "--output-type", "dotenv", file],
        { env: selectedEnv, cwd: repoRoot, invocation: sopsInvocation },
      );
      if (result.status !== 0)
        throw refuse(
          `decrypt ${path.basename(file)}; is the age identity installed?`,
          result,
        );
      const map = Object.create(null);
      for (const line of String(result.stdout).split(/\r?\n/u)) {
        if (!line || line.startsWith("#")) continue;
        const match = /^([A-Za-z_]\w*)=(.*)$/u.exec(line);
        if (!match || Object.hasOwn(map, match[1]))
          throw new SecretError("sops returned an invalid dotenv document");
        map[match[1]] = match[2].replaceAll(String.raw`\n`, "\n");
      }
      return map;
    },
    seal(request) {
      const recipients = request.recipients.length
        ? request.recipients
        : publicStorage(() =>
            configuredRecipients(repoRoot, request.filenameOverride),
          );
      const result = sopsSeal(
        binary,
        { ...request, recipients },
        { env: selectedEnv, cwd: repoRoot, invocation: sopsInvocation },
      );
      if (result.status !== 0) throw refuse("seal the secret", result);
      return result.stdout;
    },
  };
}
