import { SessionService } from '@modules/bussiness/session';

/**
 * The one place a task resolver turns the `x-session-token` header into an authenticated actor id.
 * Unchanged from the former HTTP controllers (`@Headers('x-session-token') sessionToken`): the token
 * still travels as a request header, `SessionService.findActive` still does the same expiry/existence
 * check and still throws the same `SessionNotFoundException`/`SessionExpiredException` on failure. Only
 * the transport moved from REST to GraphQL - this file exists so five task resolvers don't each repeat
 * the header read and the SessionService call.
 */
export interface GraphqlRequestLike {
  readonly headers: Record<string, string | string[] | undefined>;
}

export const actorIdFromRequest = async (req: GraphqlRequestLike, sessionService: SessionService): Promise<string> => {
  const header = req.headers['x-session-token'];
  const token = Array.isArray(header) ? header[0] : header;
  const session = await sessionService.findActive(token ?? '');
  return session.personId;
};
