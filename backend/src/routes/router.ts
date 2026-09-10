// ============================================================
// Exact-path router - mirrors Support/Router.php. Routes are a
// flat map of "METHOD /path" -> handler (no path params anywhere
// in this API; everything IDs via query string or JSON body,
// same as the PHP version). Preserves the original's 404 vs 405
// distinction: unknown path -> 404, known path/wrong method -> 405.
// ============================================================
import type { Request, RequestHandler, Response } from 'express';
import { sendError } from '../support/http.js';

type Handler = (req: Request, res: Response) => unknown | Promise<unknown>;

function normalize(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path;
}

export class ExactRouter {
  private routes = new Map<string, Handler>();
  private knownPaths = new Set<string>();

  map(method: string, path: string, handler: Handler): void {
    const p = normalize(path);
    this.routes.set(`${method} ${p}`, handler);
    this.knownPaths.add(p);
  }

  middleware(): RequestHandler {
    return (req, res) => {
      const path = normalize(req.path);
      const handler = this.routes.get(`${req.method} ${path}`);

      if (handler) {
        Promise.resolve(handler(req, res)).catch((err: unknown) => {
          if (res.headersSent) return;
          const message = err instanceof Error ? err.message : String(err);
          sendError(res, `Internal error: ${message}`, 500);
        });
        return;
      }

      if (this.knownPaths.has(path)) {
        sendError(res, 'Method not allowed', 405);
        return;
      }

      sendError(res, 'Not found', 404);
    };
  }
}
