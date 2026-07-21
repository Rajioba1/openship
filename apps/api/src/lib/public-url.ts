/**
 * The single source of truth for "how is THIS instance addressed from the
 * public internet" — so webhook callbacks, and anything else that must hand an
 * external service a URL back to us, stop falling back to a hardcoded
 * `runtimeTarget.api` (http://localhost:4000 on a self-hosted box).
 *
 * Topology (self-hosted, `openship up --public-url https://ops.example.com`):
 * the managed edge routes the public host to the DASHBOARD (Next, port 3001);
 * the API binds to loopback and is reachable from outside ONLY through the
 * dashboard's same-origin proxy at `/api/proxy/*`, which strips that prefix and
 * forwards the rest to `http://127.0.0.1:4000/*`
 * (apps/dashboard/src/app/api/proxy/[...path]/route.ts). So the API's public
 * base is `<public-url>/api/proxy`, and a public API path `/api/x` is reached
 * at `<public-url>/api/proxy/api/x`.
 *
 * When OPENSHIP_PUBLIC_URL is unset (cloud, or a dev box) everything falls back
 * to `runtimeTarget.api` / `runtimeTarget.dashboard`, preserving today's behavior.
 */

import { env, runtimeTarget } from "../config/env";

/**
 * Dashboard same-origin proxy mount. Fixed contract with the dashboard route at
 * apps/dashboard/src/app/api/proxy/[...path] (baked into the release build via
 * NEXT_PUBLIC_API_PROXY). The API is only publicly reachable beneath it.
 */
const SAME_ORIGIN_PROXY_PREFIX = "/api/proxy";

/** Normalized OPENSHIP_PUBLIC_URL (no trailing slash), or null when unset. */
function publicUrl(): string | null {
  const raw = env.OPENSHIP_PUBLIC_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** Public origin serving the DASHBOARD (== the CLI `--public-url`), else the runtime target. */
export function resolveDashboardPublicUrl(): string {
  return publicUrl() ?? runtimeTarget.dashboard;
}

/**
 * Public base that maps to the API's own origin — the `runtimeTarget.api`
 * equivalent for a publicly-served box. Callers append `/api/...` paths.
 * Self-hosted + public URL → `<public-url>/api/proxy` (reachable via the
 * dashboard same-origin proxy). Otherwise → `runtimeTarget.api`.
 */
export function resolveApiPublicUrl(): string {
  const pub = publicUrl();
  return pub ? `${pub}${SAME_ORIGIN_PROXY_PREFIX}` : runtimeTarget.api;
}

/**
 * The shared/repo-strategy GitHub webhook callback URL — where GitHub POSTs
 * push/release deliveries. Public URL when configured, so a `--public-url` VPS
 * registers a reachable hook instead of a dead `localhost:4000` one.
 */
export function sharedWebhookUrl(): string {
  return `${resolveApiPublicUrl()}/api/webhooks/github`;
}

/**
 * The domain-strategy webhook callback URL: delivered directly to a project's
 * own verified domain via the `/_openship/hooks/` OpenResty location (proxied to
 * the loopback API). Used when a project sets an explicit `webhookDomain`.
 */
export function domainWebhookUrl(hostname: string, scheme: "http" | "https" = "https"): string {
  return `${scheme}://${hostname}/_openship/hooks/github`;
}

/**
 * Better Auth `baseURL` — the origin every absolute auth/OAuth URL (issuer,
 * authorize, token, discovery metadata, email links) is built from.
 *
 * With a public URL configured, return it as a stable static base so remote
 * MCP/OAuth clients are handed reachable `https://<public-host>/api/auth/...`
 * URLs instead of `http://localhost:4000`. It must be static: Better Auth
 * materialises the OAuth authorization-server metadata at startup, with no
 * request in scope, so a `DynamicBaseURLConfig` resolves to an empty issuer
 * there; a discovery `issuer` also has to be stable across requests.
 *
 * Without a public URL (cloud / dev / desktop) fall back to the static
 * `runtimeTarget.api` — zero behavior change.
 */
export function resolveAuthBaseUrl(): string {
  return publicUrl() ?? runtimeTarget.api;
}

/**
 * The public origin for a given inbound request — from `x-forwarded-host`/`-proto`
 * when the same-origin proxy set them, else the configured public URL, else the
 * request's own origin. Used to advertise reachable discovery URLs (MCP 401
 * `WWW-Authenticate`) instead of the loopback origin the API actually binds to.
 */
export function requestPublicOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto");
  if (host && proto) return `${proto}://${host}`;
  const pub = publicUrl();
  if (pub) return pub;
  try {
    return new URL(req.url).origin;
  } catch {
    return runtimeTarget.api;
  }
}
