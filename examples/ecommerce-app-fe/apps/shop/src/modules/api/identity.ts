import { IDENTITY_API_URL } from '../config';
import { getJson } from './http';
import type { Result } from './result';

export type CurrentUser = {
  readonly id: string;
  readonly email: string;
  readonly name: string;
};

/**
 * Read the signed-in shopper, if there is one.
 *
 * contract: the landing → shop session handoff. This is the exact seam a later workstream fills in —
 * `identity` (its port resolved from the product projection) mints the session and hands it to the shop; how it is carried (cookie on
 * a shared parent domain, or a token exchanged at a callback) is the backend lane's decision, not this
 * skeleton's. Until that contract is settled this call reads `/me` with whatever ambient credentials the
 * browser already has and returns `null` for an anonymous visitor, so every gated page degrades to a clear
 * signed-out state instead of guessing at a session. Do not invent a fake signed-in identity here.
 */
export const fetchCurrentUser = async (): Promise<Result<CurrentUser | null>> => {
  const result = await getJson<CurrentUser | null>(`${IDENTITY_API_URL}/me`);
  if (!result.ok) return result;
  return { ok: true, data: result.data ?? null };
};
