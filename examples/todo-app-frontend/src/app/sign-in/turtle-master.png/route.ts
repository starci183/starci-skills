import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The brand turtle master's own bytes, served from the bound .starciwork brand record
 * (`ui.login.sign-in` artworkSlots/auth-turtle: "implementation reuses master bytes") rather than a
 * copy checked into this app, so the welcome panel always renders the current master.
 */
const TURTLE_MASTER_PATH = path.join('..', 'todo-app-backend', '.starciwork', 'brand', 'assets', 'turtle-master.png');

/** Serve the brand's turtle master as the sign-in welcome illustration at /sign-in/turtle-master.png. */
export const GET = async () => {
  const bytes = await readFile(path.resolve(process.cwd(), TURTLE_MASTER_PATH));
  return new Response(new Uint8Array(bytes), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=300',
    },
  });
};
