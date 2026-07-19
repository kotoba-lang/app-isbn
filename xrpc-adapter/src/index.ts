import {
  createAuthedEtzhayyim,
  extractBearerToken,
  type Etzhayyim,
} from "@etzhayyim/sdk-auth";
import * as isbnRwFree from "@etzhayyim/isbn-kotoba";

interface Env { ACTOR_DID: string; PDS_URL: string; L2_RPC_URL: string; PDS_ACCESS_JWT?: string; PDS_REFRESH_JWT?: string; }
type Handler = (e: Etzhayyim, input: unknown) => Promise<unknown>;
const NSID_BASE = "com.etzhayyim.isbn";
interface RouteConfig { method: "POST" | "GET"; handler: Handler; }

const routes: Record<string, RouteConfig> = {
  [`${NSID_BASE}.registerBook`]: { method: "POST", handler: (e, input) => isbnRwFree.registerBook(e, input as any) },
  [`${NSID_BASE}.lookup`]: { method: "GET", handler: (e, input) => isbnRwFree.lookup(e, input as any) },
  [`${NSID_BASE}.listBooks`]: { method: "GET", handler: (e, input) => isbnRwFree.listBooks(e, input as any) },
  [`${NSID_BASE}.coverage`]: { method: "GET", handler: (e, input) => isbnRwFree.coverage(e, input as any) },
};

function mapStatus(status?: string): number { if (status === "rejected" || status === "notFound") return 400; return 200; }
function jsonResponse(body: unknown, status: number = 200, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...init?.headers }, ...init });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/xrpc/")) return jsonResponse({ error: "NotFound" }, 404);
    const nsid = url.pathname.slice("/xrpc/".length);
    const route = routes[nsid];
    if (!route) return jsonResponse({ error: "MethodNotFound", nsid }, 404);
    if (req.method !== route.method) return jsonResponse({ error: "MethodNotAllowed" }, 405);

    const bearerToken = extractBearerToken(req);
    const e = createAuthedEtzhayyim({ env: { ACTOR_DID: env.ACTOR_DID, PDS_URL: env.PDS_URL, L2_RPC_URL: env.L2_RPC_URL, PDS_ACCESS_JWT: env.PDS_ACCESS_JWT, PDS_REFRESH_JWT: env.PDS_REFRESH_JWT }, bearerToken });
    let input: unknown;
    try {
      input = route.method === "POST" ? await req.json().catch(() => ({})) : Object.fromEntries(url.searchParams.entries());
      const typed = input as Record<string, unknown>;
      ["limit", "offset"].forEach(k => { if (typed[k]) typed[k] = Number(typed[k]); });
    } catch (err) {
      return jsonResponse({ error: "InvalidInput", message: `Failed to parse ${route.method === "POST" ? "JSON" : "query params"}` }, 400);
    }

    try {
      const result = await route.handler(e, input);
      return jsonResponse(result, mapStatus((result as any)?.status));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse({ error: "InternalError", message, nsid }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
