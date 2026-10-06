import { spawn } from 'node:child_process';

/** Open one URL with the platform browser; return a synchronous launch receipt. */
export function openBrowser(url, { platform = process.platform, run = spawn } = {}) {
  let [command, args] = ['xdg-open', [url]];
  if (platform === 'darwin') [command, args] = ['open', [url]];
  else if (platform === 'win32') [command, args] = ['rundll32.exe', ['url.dll,FileProtocolHandler', url]];
  try {
    const child = run(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref?.();
    return { ok: true, url };
  } catch (error) { return { ok: false, url, error: String(error?.message ?? error) }; }
}
