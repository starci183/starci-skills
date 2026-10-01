// seat-quota.mjs — GetUserStatus of the Windsurf seat API, the call devin.exe itself makes for its seat's quota
// (scripts/agent/quota/devin.mjs shapes the answer). The quota probe must stay synchronous, so devin.mjs runs THIS file as
// a node child: it reads {endpoint, payload, timeoutMs} as JSON on stdin and prints the answer as JSON on stdout. The
// payload holds the API key; it travels on stdin only and is never echoed.
import { isMain } from '../../lib/is-main.mjs';
import { connectPost } from './lib.mjs';

/** Promise<{status, body} | {status: 0, error}> of one GetUserStatus POST. */
export const seatQuota = ({ endpoint, payload, timeoutMs }) => connectPost(endpoint, payload, timeoutMs);

if (isMain(import.meta.url)) {
  let raw = '';
  process.stdin.on('data', (c) => { raw += c; }).on('end', async () => {
    let answer;
    try { answer = await seatQuota(JSON.parse(raw)); } catch (error) { answer = { status: 0, error: String((error && error.message) || error) }; }
    process.stdout.write(JSON.stringify(answer));
  });
}
