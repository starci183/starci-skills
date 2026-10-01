// serve.mjs — a local HTTP server around one request handler: the harness UI (ui/server.mjs), the connectors' ask gateway
// and the Kernel's ask form server. The caller binds it (listen on 127.0.0.1) and closes it.
import { plainHttp } from './lib.mjs';

/** The node:http Server of `handler(req, res)`, not yet listening. */
export const serve = (handler) => plainHttp.createServer(handler);
