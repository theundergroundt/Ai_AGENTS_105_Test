/*
 * 03-server-http.ts
 * ---------------------------------------------------------------------------
 * OpenClaw 게이트웨이의 "HTTP 입구 + WebSocket upgrade 입구" 파일이다.
 *
 * 01-server.impl.ts가 전체 서버를 시작하고,
 * 02-server-runtime-state.ts가 HTTP/WebSocket 런타임을 만들면,
 * 이 파일은 실제 HTTP 요청을 어떻게 분기할지 결정한다.
 *
 * 이 파일에서 이해해야 할 핵심은 두 갈래다.
 *
 * A. 일반 HTTP 요청 처리
 *    - createGatewayHttpServer()가 Node http/https server를 만든다.
 *    - handleRequest()가 모든 HTTP 요청을 받는다.
 *    - 요청 path를 보고 stage 배열에 처리 후보를 순서대로 넣는다.
 *    - runGatewayHttpRequestStages()가 stage를 앞에서부터 실행한다.
 *    - 어느 stage가 "내가 처리했다"고 true를 반환하면 그 요청은 끝난다.
 *
 *    예시 HTTP path:
 *    - /health, /ready: 헬스체크/준비 상태
 *    - /v1/models, /v1/chat/completions, /v1/responses: OpenAI 호환 HTTP API
 *    - /tools/invoke: HTTP로 도구 호출
 *    - /sessions/{id}/history, /sessions/{id}/kill: 세션 관련 HTTP API
 *    - Control UI 정적 파일/미디어/아바타
 *    - plugin route
 *    - hook route
 *
 * B. WebSocket upgrade 처리
 *    - attachGatewayUpgradeHandler()가 httpServer의 "upgrade" 이벤트를 잡는다.
 *    - 모바일 앱, 브라우저, CLI가 ws:// 또는 wss://로 접속하면 처음에는 HTTP upgrade다.
 *    - canvas WebSocket인지 검사한다.
 *    - 인증 전 연결 수 제한(preauth budget)을 확인한다.
 *    - wss.handleUpgrade()로 실제 WebSocket 연결로 넘긴다.
 *    - 이후 처리는 04-ws-connection.ts가 맡는다.
 *
 * OpenAI 호환 HTTP API와 모바일 WebSocket은 같은 포트를 공유하지만 역할이 다르다.
 * - OpenAI 호환 HTTP: /v1/chat/completions 같은 REST/SSE 스타일 요청.
 * - 모바일 WebSocket: connect.challenge 이후 req/res/event 프레임을 주고받는 RPC 통신.
 */

import { createHash } from "node:crypto";
import {
  createServer as createHttpServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import type { TlsOptions } from "node:tls";
import type { WebSocketServer } from "ws";
import { A2UI_PATH, CANVAS_WS_PATH, handleA2uiHttpRequest } from "../canvas-host/a2ui.js";
import type { CanvasHostHandler } from "../canvas-host/server.js";
import { loadConfig } from "../config/config.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveHookExternalContentSource as resolveHookExternalContentSourceFromSession } from "../security/external-content.js";
import { safeEqualSecret } from "../security/secret-equal.js";
import { resolveAssistantIdentity } from "./assistant-identity.js";
import {
  AUTH_RATE_LIMIT_SCOPE_HOOK_AUTH,
  createAuthRateLimiter,
  normalizeRateLimitClientIp,
  type AuthRateLimiter,
} from "./auth-rate-limit.js";
import {
  authorizeHttpGatewayConnect,
  isLocalDirectRequest,
  type GatewayAuthResult,
  type ResolvedGatewayAuth,
} from "./auth.js";
import { normalizeCanvasScopedUrl } from "./canvas-capability.js";
import type { ControlUiRootState } from "./control-ui.js";
import { applyHookMappings } from "./hooks-mapping.js";
import {
  extractHookToken,
  getHookAgentPolicyError,
  getHookChannelError,
  getHookSessionKeyPrefixError,
  type HookAgentDispatchPayload,
  type HooksConfigResolved,
  isHookAgentAllowed,
  isSessionKeyAllowedByPrefix,
  normalizeAgentPayload,
  normalizeHookHeaders,
  resolveHookIdempotencyKey,
  normalizeWakePayload,
  readJsonBody,
  normalizeHookDispatchSessionKey,
  resolveHookSessionKey,
  resolveHookTargetAgentId,
  resolveHookChannel,
  resolveHookDeliver,
} from "./hooks.js";
import { sendGatewayAuthFailure, setDefaultSecurityHeaders } from "./http-common.js";
import {
  type AuthorizedGatewayHttpRequest,
  authorizeGatewayHttpRequestOrReply,
  getBearerToken,
  resolveHttpBrowserOriginPolicy,
} from "./http-utils.js";
import { resolveRequestClientIp } from "./net.js";
import { DEDUPE_MAX, DEDUPE_TTL_MS } from "./server-constants.js";
import { authorizeCanvasRequest, isCanvasPath } from "./server/http-auth.js";
import { resolvePluginRouteRuntimeOperatorScopes } from "./server/plugin-route-runtime-scopes.js";
import {
  isProtectedPluginRoutePathFromContext,
  resolvePluginRoutePathContext,
  type PluginHttpRequestHandler,
  type PluginRoutePathContext,
} from "./server/plugins-http.js";
import type { PreauthConnectionBudget } from "./server/preauth-connection-budget.js";
import type { ReadinessChecker } from "./server/readiness.js";
import type { GatewayWsClient } from "./server/ws-types.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

const HOOK_AUTH_FAILURE_LIMIT = 20;
const HOOK_AUTH_FAILURE_WINDOW_MS = 60_000;

let bundledChannelsModulePromise:
  | Promise<typeof import("../channels/plugins/bundled.js")>
  | undefined;
let identityAvatarModulePromise: Promise<typeof import("../agents/identity-avatar.js")> | undefined;
let controlUiModulePromise: Promise<typeof import("./control-ui.js")> | undefined;
let embeddingsHttpModulePromise: Promise<typeof import("./embeddings-http.js")> | undefined;
let modelsHttpModulePromise: Promise<typeof import("./models-http.js")> | undefined;
let openAiHttpModulePromise: Promise<typeof import("./openai-http.js")> | undefined;
let openResponsesHttpModulePromise: Promise<typeof import("./openresponses-http.js")> | undefined;
let sessionHistoryHttpModulePromise:
  | Promise<typeof import("./sessions-history-http.js")>
  | undefined;
let sessionKillHttpModulePromise: Promise<typeof import("./session-kill-http.js")> | undefined;
let toolsInvokeHttpModulePromise: Promise<typeof import("./tools-invoke-http.js")> | undefined;

function getBundledChannelsModule() {
  bundledChannelsModulePromise ??= import("../channels/plugins/bundled.js");
  return bundledChannelsModulePromise;
}

function getIdentityAvatarModule() {
  identityAvatarModulePromise ??= import("../agents/identity-avatar.js");
  return identityAvatarModulePromise;
}

function getControlUiModule() {
  controlUiModulePromise ??= import("./control-ui.js");
  return controlUiModulePromise;
}

function getEmbeddingsHttpModule() {
  embeddingsHttpModulePromise ??= import("./embeddings-http.js");
  return embeddingsHttpModulePromise;
}

function getModelsHttpModule() {
  modelsHttpModulePromise ??= import("./models-http.js");
  return modelsHttpModulePromise;
}

function getOpenAiHttpModule() {
  openAiHttpModulePromise ??= import("./openai-http.js");
  return openAiHttpModulePromise;
}

function getOpenResponsesHttpModule() {
  openResponsesHttpModulePromise ??= import("./openresponses-http.js");
  return openResponsesHttpModulePromise;
}

function getSessionHistoryHttpModule() {
  sessionHistoryHttpModulePromise ??= import("./sessions-history-http.js");
  return sessionHistoryHttpModulePromise;
}

function getSessionKillHttpModule() {
  sessionKillHttpModulePromise ??= import("./session-kill-http.js");
  return sessionKillHttpModulePromise;
}

function getToolsInvokeHttpModule() {
  toolsInvokeHttpModulePromise ??= import("./tools-invoke-http.js");
  return toolsInvokeHttpModulePromise;
}

type HookDispatchers = {
  dispatchWakeHook: (value: { text: string; mode: "now" | "next-heartbeat" }) => void;
  dispatchAgentHook: (value: HookAgentDispatchPayload) => string;
};

function resolveMappedHookExternalContentSource(params: {
  subPath: string;
  payload: Record<string, unknown>;
  sessionKey: string;
}) {
  const payloadSource =
    typeof params.payload.source === "string" ? params.payload.source.trim().toLowerCase() : "";
  if (params.subPath === "gmail" || payloadSource === "gmail") {
    return "gmail" as const;
  }
  return resolveHookExternalContentSourceFromSession(params.sessionKey) ?? "webhook";
}

export type HookClientIpConfig = Readonly<{
  trustedProxies?: string[];
  allowRealIpFallback?: boolean;
}>;

type HookReplayEntry = {
  ts: number;
  runId: string;
};

type HookReplayScope = {
  pathKey: string;
  token: string | undefined;
  idempotencyKey?: string;
  dispatchScope: Record<string, unknown>;
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

const GATEWAY_PROBE_STATUS_BY_PATH = new Map<string, "live" | "ready">([
  ["/health", "live"],
  ["/healthz", "live"],
  ["/ready", "ready"],
  ["/readyz", "ready"],
]);
async function resolvePluginGatewayAuthBypassPaths(
  configSnapshot: OpenClawConfig,
): Promise<Set<string>> {
  const paths = new Set<string>();
  const { listBundledChannelPlugins } = await getBundledChannelsModule();
  for (const plugin of listBundledChannelPlugins()) {
    for (const path of plugin.gateway?.resolveGatewayAuthBypassPaths?.({ cfg: configSnapshot }) ??
      []) {
      if (typeof path === "string" && path.trim()) {
        paths.add(path.trim());
      }
    }
  }
  return paths;
}

function isOpenAiModelsPath(pathname: string): boolean {
  return pathname === "/v1/models" || pathname.startsWith("/v1/models/");
}

function isEmbeddingsPath(pathname: string): boolean {
  return pathname === "/v1/embeddings";
}

function isOpenAiChatCompletionsPath(pathname: string): boolean {
  return pathname === "/v1/chat/completions";
}

function isOpenResponsesPath(pathname: string): boolean {
  return pathname === "/v1/responses";
}

function isToolsInvokePath(pathname: string): boolean {
  return pathname === "/tools/invoke";
}

function isSessionKillPath(pathname: string): boolean {
  return /^\/sessions\/[^/]+\/kill$/.test(pathname);
}

function isSessionHistoryPath(pathname: string): boolean {
  return /^\/sessions\/[^/]+\/history$/.test(pathname);
}

function isA2uiPath(pathname: string): boolean {
  return pathname === A2UI_PATH || pathname.startsWith(`${A2UI_PATH}/`);
}

function shouldEnforceDefaultPluginGatewayAuth(pathContext: PluginRoutePathContext): boolean {
  return (
    pathContext.malformedEncoding ||
    pathContext.decodePassLimitReached ||
    isProtectedPluginRoutePathFromContext(pathContext)
  );
}

async function canRevealReadinessDetails(params: {
  req: IncomingMessage;
  resolvedAuth: ResolvedGatewayAuth;
  trustedProxies: string[];
  allowRealIpFallback: boolean;
}): Promise<boolean> {
  if (isLocalDirectRequest(params.req, params.trustedProxies, params.allowRealIpFallback)) {
    return true;
  }
  if (params.resolvedAuth.mode === "none") {
    return false;
  }

  const bearerToken = getBearerToken(params.req);
  const authResult = await authorizeHttpGatewayConnect({
    auth: params.resolvedAuth,
    connectAuth: bearerToken ? { token: bearerToken, password: bearerToken } : null,
    req: params.req,
    trustedProxies: params.trustedProxies,
    allowRealIpFallback: params.allowRealIpFallback,
    browserOriginPolicy: resolveHttpBrowserOriginPolicy(params.req),
  });
  return authResult.ok;
}

async function handleGatewayProbeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  requestPath: string,
  resolvedAuth: ResolvedGatewayAuth,
  trustedProxies: string[],
  allowRealIpFallback: boolean,
  getReadiness?: ReadinessChecker,
): Promise<boolean> {
  const status = GATEWAY_PROBE_STATUS_BY_PATH.get(requestPath);
  if (!status) {
    return false;
  }

  const method = (req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return true;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  let statusCode: number;
  let body: string;
  if (status === "ready" && getReadiness) {
    const includeDetails = await canRevealReadinessDetails({
      req,
      resolvedAuth,
      trustedProxies,
      allowRealIpFallback,
    });
    try {
      const result = getReadiness();
      statusCode = result.ready ? 200 : 503;
      body = JSON.stringify(includeDetails ? result : { ready: result.ready });
    } catch {
      statusCode = 503;
      body = JSON.stringify(
        includeDetails ? { ready: false, failing: ["internal"], uptimeMs: 0 } : { ready: false },
      );
    }
  } else {
    statusCode = 200;
    body = JSON.stringify({ ok: true, status });
  }
  res.statusCode = statusCode;
  res.end(method === "HEAD" ? undefined : body);
  return true;
}

function writeUpgradeAuthFailure(
  socket: { write: (chunk: string) => void },
  auth: GatewayAuthResult,
) {
  if (auth.rateLimited) {
    const retryAfterSeconds =
      auth.retryAfterMs && auth.retryAfterMs > 0 ? Math.ceil(auth.retryAfterMs / 1000) : undefined;
    socket.write(
      [
        "HTTP/1.1 429 Too Many Requests",
        retryAfterSeconds ? `Retry-After: ${retryAfterSeconds}` : undefined,
        "Content-Type: application/json; charset=utf-8",
        "Connection: close",
        "",
        JSON.stringify({
          error: {
            message: "Too many failed authentication attempts. Please try again later.",
            type: "rate_limited",
          },
        }),
      ]
        .filter(Boolean)
        .join("\r\n"),
    );
    return;
  }
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
}

export type HooksRequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

type GatewayHttpRequestStage = {
  name: string;
  run: () => Promise<boolean> | boolean;
  continueOnError?: boolean;
};

export async function runGatewayHttpRequestStages(
  stages: readonly GatewayHttpRequestStage[],
): Promise<boolean> {
  /*
   * HTTP 요청 처리의 핵심 실행 루프다.
   *
   * handleRequest()는 "이 path면 이 핸들러"를 if/else로 바로 실행하지 않고,
   * stage 목록을 만든 뒤 여기서 순서대로 실행한다.
   *
   * 각 stage.run()의 반환 의미:
   * - true: 이 stage가 응답을 끝냈다. 뒤 stage는 실행하지 않는다.
   * - false: 이 stage는 해당 요청을 처리하지 않았다. 다음 stage로 넘긴다.
   */
  for (const stage of stages) {
    try {
      if (await stage.run()) {
        return true;
      }
    } catch (err) {
      if (!stage.continueOnError) {
        throw err;
      }
      /*
       * continueOnError가 켜진 stage는 실패해도 뒤 stage를 계속 실행한다.
       * 주로 플러그인 route처럼 선택 의존성이 없어서 실패할 수 있는 영역에 사용한다.
       * 그래야 플러그인 하나가 깨져도 Control UI나 health probe가 같이 죽지 않는다.
       */
      console.error(`[gateway-http] stage "${stage.name}" threw — skipping:`, err);
    }
  }
  return false;
}

function buildPluginRequestStages(params: {
  req: IncomingMessage;
  res: ServerResponse;
  requestPath: string;
  getGatewayAuthBypassPaths: () => Promise<ReadonlySet<string>>;
  pluginPathContext: PluginRoutePathContext | null;
  handlePluginRequest?: PluginHttpRequestHandler;
  shouldEnforcePluginGatewayAuth?: (pathContext: PluginRoutePathContext) => boolean;
  resolvedAuth: ResolvedGatewayAuth;
  trustedProxies: string[];
  allowRealIpFallback: boolean;
  rateLimiter?: AuthRateLimiter;
}): GatewayHttpRequestStage[] {
  /*
   * 플러그인 HTTP route를 stage로 만드는 함수.
   *
   * 플러그인 route는 Control UI catch-all보다 먼저 실행되어야 한다.
   * 그렇지 않으면 /plugin/... 같은 요청이 SPA fallback에 먹혀 버릴 수 있다.
   */
  if (!params.handlePluginRequest) {
    return [];
  }
  let pluginGatewayAuthSatisfied = false;
  let pluginGatewayRequestAuth: AuthorizedGatewayHttpRequest | undefined;
  let pluginRequestOperatorScopes: string[] | undefined;
  return [
    {
      name: "plugin-auth",
      run: async () => {
        const pathContext =
          params.pluginPathContext ?? resolvePluginRoutePathContext(params.requestPath);
        if (
          !(params.shouldEnforcePluginGatewayAuth ?? shouldEnforceDefaultPluginGatewayAuth)(
            pathContext,
          )
        ) {
          return false;
        }
        if ((await params.getGatewayAuthBypassPaths()).has(params.requestPath)) {
          return false;
        }
        const requestAuth = await authorizeGatewayHttpRequestOrReply({
          req: params.req,
          res: params.res,
          auth: params.resolvedAuth,
          trustedProxies: params.trustedProxies,
          allowRealIpFallback: params.allowRealIpFallback,
          rateLimiter: params.rateLimiter,
        });
        if (!requestAuth) {
          return true;
        }
        pluginGatewayAuthSatisfied = true;
        pluginGatewayRequestAuth = requestAuth;
        pluginRequestOperatorScopes = resolvePluginRouteRuntimeOperatorScopes(
          params.req,
          requestAuth,
        );
        return false;
      },
    },
    {
      name: "plugin-http",
      continueOnError: true,
      run: () => {
        const pathContext =
          params.pluginPathContext ?? resolvePluginRoutePathContext(params.requestPath);
        return (
          params.handlePluginRequest?.(params.req, params.res, pathContext, {
            gatewayAuthSatisfied: pluginGatewayAuthSatisfied,
            gatewayRequestAuth: pluginGatewayRequestAuth,
            gatewayRequestOperatorScopes: pluginRequestOperatorScopes,
          }) ?? false
        );
      },
    },
  ];
}

export function createHooksRequestHandler(
  opts: {
    getHooksConfig: () => HooksConfigResolved | null;
    bindHost: string;
    port: number;
    logHooks: SubsystemLogger;
    getClientIpConfig?: () => HookClientIpConfig;
  } & HookDispatchers,
): HooksRequestHandler {
  const { getHooksConfig, logHooks, dispatchAgentHook, dispatchWakeHook, getClientIpConfig } = opts;
  const hookReplayCache = new Map<string, HookReplayEntry>();
  const hookAuthLimiter = createAuthRateLimiter({
    maxAttempts: HOOK_AUTH_FAILURE_LIMIT,
    windowMs: HOOK_AUTH_FAILURE_WINDOW_MS,
    lockoutMs: HOOK_AUTH_FAILURE_WINDOW_MS,
    exemptLoopback: false,
    // Handler lifetimes are tied to gateway runtime/tests; skip background timer fanout.
    pruneIntervalMs: 0,
  });

  const resolveHookClientKey = (req: IncomingMessage): string => {
    const clientIpConfig = getClientIpConfig?.();
    const clientIp =
      resolveRequestClientIp(
        req,
        clientIpConfig?.trustedProxies,
        clientIpConfig?.allowRealIpFallback === true,
      ) ?? req.socket?.remoteAddress;
    return normalizeRateLimitClientIp(clientIp);
  };

  const pruneHookReplayCache = (now: number) => {
    const cutoff = now - DEDUPE_TTL_MS;
    for (const [key, entry] of hookReplayCache) {
      if (entry.ts < cutoff) {
        hookReplayCache.delete(key);
      }
    }
    while (hookReplayCache.size > DEDUPE_MAX) {
      const oldestKey = hookReplayCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      hookReplayCache.delete(oldestKey);
    }
  };

  const buildHookReplayCacheKey = (params: HookReplayScope): string | undefined => {
    const idem = params.idempotencyKey?.trim();
    if (!idem) {
      return undefined;
    }
    const tokenFingerprint = createHash("sha256")
      .update(params.token ?? "", "utf8")
      .digest("hex");
    const idempotencyFingerprint = createHash("sha256").update(idem, "utf8").digest("hex");
    const scopeFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          pathKey: params.pathKey,
          dispatchScope: params.dispatchScope,
        }),
        "utf8",
      )
      .digest("hex");
    return `${tokenFingerprint}:${scopeFingerprint}:${idempotencyFingerprint}`;
  };

  const resolveCachedHookRunId = (key: string | undefined, now: number): string | undefined => {
    if (!key) {
      return undefined;
    }
    pruneHookReplayCache(now);
    const cached = hookReplayCache.get(key);
    if (!cached) {
      return undefined;
    }
    hookReplayCache.delete(key);
    hookReplayCache.set(key, cached);
    return cached.runId;
  };

  const rememberHookRunId = (key: string | undefined, runId: string, now: number) => {
    if (!key) {
      return;
    }
    hookReplayCache.delete(key);
    hookReplayCache.set(key, { ts: now, runId });
    pruneHookReplayCache(now);
  };

  return async (req, res) => {
    const hooksConfig = getHooksConfig();
    if (!hooksConfig) {
      return false;
    }
    // Only pathname/search are used here; keep the base host fixed so bind-host
    // representation (e.g. IPv6 wildcards) cannot break request parsing.
    const url = new URL(req.url ?? "/", "http://localhost");
    const basePath = hooksConfig.basePath;
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
      return false;
    }

    if (url.searchParams.has("token")) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(
        "Hook token must be provided via Authorization: Bearer <token> or X-OpenClaw-Token header (query parameters are not allowed).",
      );
      return true;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Method Not Allowed");
      return true;
    }

    const token = extractHookToken(req);
    const clientKey = resolveHookClientKey(req);
    if (!safeEqualSecret(token, hooksConfig.token)) {
      const throttle = hookAuthLimiter.check(clientKey, AUTH_RATE_LIMIT_SCOPE_HOOK_AUTH);
      if (!throttle.allowed) {
        const retryAfter = throttle.retryAfterMs > 0 ? Math.ceil(throttle.retryAfterMs / 1000) : 1;
        res.statusCode = 429;
        res.setHeader("Retry-After", String(retryAfter));
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Too Many Requests");
        logHooks.warn(`hook auth throttled for ${clientKey}; retry-after=${retryAfter}s`);
        return true;
      }
      hookAuthLimiter.recordFailure(clientKey, AUTH_RATE_LIMIT_SCOPE_HOOK_AUTH);
      res.statusCode = 401;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Unauthorized");
      return true;
    }
    hookAuthLimiter.reset(clientKey, AUTH_RATE_LIMIT_SCOPE_HOOK_AUTH);

    const subPath = url.pathname.slice(basePath.length).replace(/^\/+/, "");
    if (!subPath) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return true;
    }

    const body = await readJsonBody(req, hooksConfig.maxBodyBytes);
    if (!body.ok) {
      const status =
        body.error === "payload too large"
          ? 413
          : body.error === "request body timeout"
            ? 408
            : 400;
      sendJson(res, status, { ok: false, error: body.error });
      return true;
    }

    const payload = typeof body.value === "object" && body.value !== null ? body.value : {};
    const headers = normalizeHookHeaders(req);
    const idempotencyKey = resolveHookIdempotencyKey({
      payload: payload as Record<string, unknown>,
      headers,
    });
    const now = Date.now();

    if (subPath === "wake") {
      const normalized = normalizeWakePayload(payload as Record<string, unknown>);
      if (!normalized.ok) {
        sendJson(res, 400, { ok: false, error: normalized.error });
        return true;
      }
      dispatchWakeHook(normalized.value);
      sendJson(res, 200, { ok: true, mode: normalized.value.mode });
      return true;
    }

    if (subPath === "agent") {
      const normalized = normalizeAgentPayload(payload as Record<string, unknown>);
      if (!normalized.ok) {
        sendJson(res, 400, { ok: false, error: normalized.error });
        return true;
      }
      if (!isHookAgentAllowed(hooksConfig, normalized.value.agentId)) {
        sendJson(res, 400, { ok: false, error: getHookAgentPolicyError() });
        return true;
      }
      const sessionKey = resolveHookSessionKey({
        hooksConfig,
        source: "request",
        sessionKey: normalized.value.sessionKey,
      });
      if (!sessionKey.ok) {
        sendJson(res, 400, { ok: false, error: sessionKey.error });
        return true;
      }
      const targetAgentId = resolveHookTargetAgentId(hooksConfig, normalized.value.agentId);
      const replayKey = buildHookReplayCacheKey({
        pathKey: "agent",
        token,
        idempotencyKey,
        dispatchScope: {
          agentId: targetAgentId ?? null,
          sessionKey:
            normalized.value.sessionKey ?? hooksConfig.sessionPolicy.defaultSessionKey ?? null,
          message: normalized.value.message,
          name: normalized.value.name,
          wakeMode: normalized.value.wakeMode,
          deliver: normalized.value.deliver,
          channel: normalized.value.channel,
          to: normalized.value.to ?? null,
          model: normalized.value.model ?? null,
          thinking: normalized.value.thinking ?? null,
          timeoutSeconds: normalized.value.timeoutSeconds ?? null,
        },
      });
      const cachedRunId = resolveCachedHookRunId(replayKey, now);
      if (cachedRunId) {
        sendJson(res, 200, { ok: true, runId: cachedRunId });
        return true;
      }
      const normalizedDispatchSessionKey = normalizeHookDispatchSessionKey({
        sessionKey: sessionKey.value,
        targetAgentId,
      });
      const allowedPrefixes = hooksConfig.sessionPolicy.allowedSessionKeyPrefixes;
      if (
        allowedPrefixes &&
        !isSessionKeyAllowedByPrefix(normalizedDispatchSessionKey, allowedPrefixes)
      ) {
        sendJson(res, 400, { ok: false, error: getHookSessionKeyPrefixError(allowedPrefixes) });
        return true;
      }
      const runId = dispatchAgentHook({
        ...normalized.value,
        idempotencyKey,
        sessionKey: normalizedDispatchSessionKey,
        agentId: targetAgentId,
        externalContentSource: "webhook",
      });
      rememberHookRunId(replayKey, runId, now);
      sendJson(res, 200, { ok: true, runId });
      return true;
    }

    if (hooksConfig.mappings.length > 0) {
      try {
        const mapped = await applyHookMappings(hooksConfig.mappings, {
          payload: payload as Record<string, unknown>,
          headers,
          url,
          path: subPath,
        });
        if (mapped) {
          if (!mapped.ok) {
            sendJson(res, 400, { ok: false, error: mapped.error });
            return true;
          }
          if (mapped.action === null) {
            res.statusCode = 204;
            res.end();
            return true;
          }
          if (mapped.action.kind === "wake") {
            dispatchWakeHook({
              text: mapped.action.text,
              mode: mapped.action.mode,
            });
            sendJson(res, 200, { ok: true, mode: mapped.action.mode });
            return true;
          }
          const channel = resolveHookChannel(mapped.action.channel);
          if (!channel) {
            sendJson(res, 400, { ok: false, error: getHookChannelError() });
            return true;
          }
          if (!isHookAgentAllowed(hooksConfig, mapped.action.agentId)) {
            sendJson(res, 400, { ok: false, error: getHookAgentPolicyError() });
            return true;
          }
          const sessionKey = resolveHookSessionKey({
            hooksConfig,
            source: "mapping",
            sessionKey: mapped.action.sessionKey,
          });
          if (!sessionKey.ok) {
            sendJson(res, 400, { ok: false, error: sessionKey.error });
            return true;
          }
          const targetAgentId = resolveHookTargetAgentId(hooksConfig, mapped.action.agentId);
          const normalizedDispatchSessionKey = normalizeHookDispatchSessionKey({
            sessionKey: sessionKey.value,
            targetAgentId,
          });
          const allowedPrefixes = hooksConfig.sessionPolicy.allowedSessionKeyPrefixes;
          if (
            allowedPrefixes &&
            !isSessionKeyAllowedByPrefix(normalizedDispatchSessionKey, allowedPrefixes)
          ) {
            sendJson(res, 400, { ok: false, error: getHookSessionKeyPrefixError(allowedPrefixes) });
            return true;
          }
          const replayKey = buildHookReplayCacheKey({
            pathKey: subPath || "mapping",
            token,
            idempotencyKey,
            dispatchScope: {
              agentId: targetAgentId ?? null,
              sessionKey:
                mapped.action.sessionKey ?? hooksConfig.sessionPolicy.defaultSessionKey ?? null,
              message: mapped.action.message,
              name: mapped.action.name ?? "Hook",
              wakeMode: mapped.action.wakeMode,
              deliver: resolveHookDeliver(mapped.action.deliver),
              channel,
              to: mapped.action.to ?? null,
              model: mapped.action.model ?? null,
              thinking: mapped.action.thinking ?? null,
              timeoutSeconds: mapped.action.timeoutSeconds ?? null,
            },
          });
          const cachedRunId = resolveCachedHookRunId(replayKey, now);
          if (cachedRunId) {
            sendJson(res, 200, { ok: true, runId: cachedRunId });
            return true;
          }
          const runId = dispatchAgentHook({
            message: mapped.action.message,
            name: mapped.action.name ?? "Hook",
            idempotencyKey,
            agentId: targetAgentId,
            wakeMode: mapped.action.wakeMode,
            sessionKey: normalizedDispatchSessionKey,
            deliver: resolveHookDeliver(mapped.action.deliver),
            channel,
            to: mapped.action.to,
            model: mapped.action.model,
            thinking: mapped.action.thinking,
            timeoutSeconds: mapped.action.timeoutSeconds,
            allowUnsafeExternalContent: mapped.action.allowUnsafeExternalContent,
            externalContentSource: resolveMappedHookExternalContentSource({
              subPath,
              payload: payload as Record<string, unknown>,
              sessionKey: sessionKey.value,
            }),
          });
          rememberHookRunId(replayKey, runId, now);
          sendJson(res, 200, { ok: true, runId });
          return true;
        }
      } catch (err) {
        logHooks.warn(`hook mapping failed: ${String(err)}`);
        sendJson(res, 500, { ok: false, error: "hook mapping failed" });
        return true;
      }
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  };
}

export function createGatewayHttpServer(opts: {
  canvasHost: CanvasHostHandler | null;
  clients: Set<GatewayWsClient>;
  controlUiEnabled: boolean;
  controlUiBasePath: string;
  controlUiRoot?: ControlUiRootState;
  openAiChatCompletionsEnabled: boolean;
  openAiChatCompletionsConfig?: import("../config/types.gateway.js").GatewayHttpChatCompletionsConfig;
  openResponsesEnabled: boolean;
  openResponsesConfig?: import("../config/types.gateway.js").GatewayHttpResponsesConfig;
  strictTransportSecurityHeader?: string;
  handleHooksRequest: HooksRequestHandler;
  handlePluginRequest?: PluginHttpRequestHandler;
  shouldEnforcePluginGatewayAuth?: (pathContext: PluginRoutePathContext) => boolean;
  resolvedAuth: ResolvedGatewayAuth;
  getResolvedAuth?: () => ResolvedGatewayAuth;
  /** Optional rate limiter for auth brute-force protection. */
  rateLimiter?: AuthRateLimiter;
  getReadiness?: ReadinessChecker;
  tlsOptions?: TlsOptions;
}): HttpServer {
  /*
   * Node HTTP/HTTPS 서버를 만드는 함수.
   *
   * TLS 옵션이 있으면 HTTPS 서버를 만들고, 없으면 HTTP 서버를 만든다.
   * 둘 다 최종적으로 handleRequest(req, res)를 호출한다.
   */
  const {
    canvasHost,
    clients,
    controlUiEnabled,
    controlUiBasePath,
    controlUiRoot,
    openAiChatCompletionsEnabled,
    openAiChatCompletionsConfig,
    openResponsesEnabled,
    openResponsesConfig,
    strictTransportSecurityHeader,
    handleHooksRequest,
    handlePluginRequest,
    shouldEnforcePluginGatewayAuth,
    resolvedAuth,
    rateLimiter,
    getReadiness,
  } = opts;
  const getResolvedAuth = opts.getResolvedAuth ?? (() => resolvedAuth);
  const openAiCompatEnabled = openAiChatCompletionsEnabled || openResponsesEnabled;
  const httpServer: HttpServer = opts.tlsOptions
    ? createHttpsServer(opts.tlsOptions, (req, res) => {
        void handleRequest(req, res);
      })
    : createHttpServer((req, res) => {
        void handleRequest(req, res);
      });

  async function handleRequest(req: IncomingMessage, res: ServerResponse) {
    /*
     * 모든 일반 HTTP 요청은 여기로 들어온다.
     *
     * 주의: WebSocket upgrade 요청은 여기서 처리하지 않는다.
     * upgrade는 아래 attachGatewayUpgradeHandler()의 httpServer.on("upgrade")가 담당한다.
     */
    setDefaultSecurityHeaders(res, {
      strictTransportSecurity: strictTransportSecurityHeader,
    });

    /*
     * WebSocket upgrade는 HTTP request handler가 아니라 upgrade 이벤트에서 처리한다.
     * 여기서 응답을 보내면 WebSocket 연결이 깨지므로 그냥 반환한다.
     */
    if ((req.headers.upgrade ?? "").toLowerCase() === "websocket") {
      return;
    }

    try {
      const configSnapshot = loadConfig();
      const trustedProxies = configSnapshot.gateway?.trustedProxies ?? [];
      const allowRealIpFallback = configSnapshot.gateway?.allowRealIpFallback === true;
      const scopedCanvas = normalizeCanvasScopedUrl(req.url ?? "/");
      if (scopedCanvas.malformedScopedPath) {
        sendGatewayAuthFailure(res, { ok: false, reason: "unauthorized" });
        return;
      }
      if (scopedCanvas.rewrittenUrl) {
        req.url = scopedCanvas.rewrittenUrl;
      }
      const requestPath = new URL(req.url ?? "/", "http://localhost").pathname;
      const pluginPathContext = handlePluginRequest
        ? resolvePluginRoutePathContext(requestPath)
        : null;
      const resolvedAuth = getResolvedAuth();
      /*
       * 요청 처리 후보 stage 목록.
       *
       * 항상 hooks를 먼저 넣고, 그 다음 path에 따라 필요한 stage를 추가한다.
       * 마지막에는 gateway-probes와 404 fallback으로 끝난다.
       */
      const requestStages: GatewayHttpRequestStage[] = [
        {
          name: "hooks",
          run: () => handleHooksRequest(req, res),
        },
      ];
      if (openAiCompatEnabled && isOpenAiModelsPath(requestPath)) {
        /*
         * OpenAI 호환 모델 목록 엔드포인트.
         * 외부 OpenAI 호환 클라이언트가 "사용 가능한 모델 뭐야?"라고 물을 때 응답한다.
         */
        requestStages.push({
          name: "models",
          run: async () =>
            (await getModelsHttpModule()).handleOpenAiModelsHttpRequest(req, res, {
              auth: resolvedAuth,
              trustedProxies,
              allowRealIpFallback,
              rateLimiter,
            }),
        });
      }
      if (openAiCompatEnabled && isEmbeddingsPath(requestPath)) {
        /*
         * OpenAI 호환 embeddings 엔드포인트.
         * 텍스트를 벡터로 바꾸는 요청이 들어올 때 사용된다.
         */
        requestStages.push({
          name: "embeddings",
          run: async () =>
            (await getEmbeddingsHttpModule()).handleOpenAiEmbeddingsHttpRequest(req, res, {
              auth: resolvedAuth,
              trustedProxies,
              allowRealIpFallback,
              rateLimiter,
            }),
        });
      }
      if (isToolsInvokePath(requestPath)) {
        /*
         * HTTP 기반 도구 호출 엔드포인트.
         * WebSocket RPC를 거치지 않고 HTTP로 특정 tool invoke를 실행하는 길이다.
         */
        requestStages.push({
          name: "tools-invoke",
          run: async () =>
            (await getToolsInvokeHttpModule()).handleToolsInvokeHttpRequest(req, res, {
              auth: resolvedAuth,
              trustedProxies,
              allowRealIpFallback,
              rateLimiter,
            }),
        });
      }
      if (isSessionKillPath(requestPath)) {
        requestStages.push({
          name: "sessions-kill",
          run: async () =>
            (await getSessionKillHttpModule()).handleSessionKillHttpRequest(req, res, {
              auth: resolvedAuth,
              trustedProxies,
              allowRealIpFallback,
              rateLimiter,
            }),
        });
      }
      if (isSessionHistoryPath(requestPath)) {
        requestStages.push({
          name: "sessions-history",
          run: async () =>
            (await getSessionHistoryHttpModule()).handleSessionHistoryHttpRequest(req, res, {
              auth: resolvedAuth,
              trustedProxies,
              allowRealIpFallback,
              rateLimiter,
            }),
        });
      }
      if (openResponsesEnabled && isOpenResponsesPath(requestPath)) {
        /*
         * OpenAI Responses API 호환 엔드포인트.
         * /v1/responses 요청을 OpenClaw 내부 agent 실행으로 연결한다.
         */
        requestStages.push({
          name: "openresponses",
          run: async () =>
            (await getOpenResponsesHttpModule()).handleOpenResponsesHttpRequest(req, res, {
              auth: resolvedAuth,
              config: openResponsesConfig,
              trustedProxies,
              allowRealIpFallback,
              rateLimiter,
            }),
        });
      }
      if (openAiChatCompletionsEnabled && isOpenAiChatCompletionsPath(requestPath)) {
        /*
         * OpenAI Chat Completions 호환 엔드포인트.
         * /v1/chat/completions 요청을 받아 OpenClaw agent/chat 실행으로 연결한다.
         */
        requestStages.push({
          name: "openai",
          run: async () =>
            (await getOpenAiHttpModule()).handleOpenAiHttpRequest(req, res, {
              auth: resolvedAuth,
              config: openAiChatCompletionsConfig,
              trustedProxies,
              allowRealIpFallback,
              rateLimiter,
            }),
        });
      }
      if (canvasHost) {
        /*
         * Canvas/A2UI 관련 HTTP 요청.
         *
         * canvas 경로는 인증과 capability token을 따로 검사한다.
         * agent가 만든 화면/문서/캔버스 자원을 브라우저에서 열 때 이 경로를 탄다.
         */
        requestStages.push({
          name: "canvas-auth",
          run: async () => {
            if (!isCanvasPath(requestPath)) {
              return false;
            }
            const ok = await authorizeCanvasRequest({
              req,
              auth: resolvedAuth,
              trustedProxies,
              allowRealIpFallback,
              clients,
              canvasCapability: scopedCanvas.capability,
              malformedScopedPath: scopedCanvas.malformedScopedPath,
              rateLimiter,
            });
            if (!ok.ok) {
              sendGatewayAuthFailure(res, ok);
              return true;
            }
            return false;
          },
        });
        requestStages.push({
          name: "a2ui",
          run: () => (isA2uiPath(requestPath) ? handleA2uiHttpRequest(req, res) : false),
        });
        requestStages.push({
          name: "canvas-http",
          run: () => canvasHost.handleHttpRequest(req, res),
        });
      }
      /*
       * 플러그인 route는 Control UI SPA catch-all보다 먼저 실행한다.
       * 그래야 플러그인이 명시적으로 등록한 HTTP 엔드포인트가 UI fallback에 가려지지 않는다.
       * 단, 위쪽의 core built-in route가 같은 path를 쓰면 core route가 우선이다.
       */
      requestStages.push(
        ...buildPluginRequestStages({
          req,
          res,
          requestPath,
          getGatewayAuthBypassPaths: () => resolvePluginGatewayAuthBypassPaths(configSnapshot),
          pluginPathContext,
          handlePluginRequest,
          shouldEnforcePluginGatewayAuth,
          resolvedAuth,
          trustedProxies,
          allowRealIpFallback,
          rateLimiter,
        }),
      );

      if (controlUiEnabled) {
        /*
         * 브라우저 Control UI 관련 요청.
         *
         * Control UI는 대시보드/상태 확인/설정 화면 역할을 한다.
         * 이 stage들은 미디어, 아바타, 정적 UI 파일을 처리한다.
         */
        requestStages.push({
          name: "control-ui-assistant-media",
          run: async () =>
            (await getControlUiModule()).handleControlUiAssistantMediaRequest(req, res, {
              basePath: controlUiBasePath,
              config: configSnapshot,
              agentId: resolveAssistantIdentity({ cfg: configSnapshot }).agentId,
              auth: resolvedAuth,
              trustedProxies,
              allowRealIpFallback,
              rateLimiter,
            }),
        });
        requestStages.push({
          name: "control-ui-avatar",
          run: async () => {
            const { handleControlUiAvatarRequest } = await getControlUiModule();
            const { resolveAgentAvatar } = await getIdentityAvatarModule();
            return handleControlUiAvatarRequest(req, res, {
              basePath: controlUiBasePath,
              resolveAvatar: (agentId) =>
                resolveAgentAvatar(configSnapshot, agentId, { includeUiOverride: true }),
            });
          },
        });
        requestStages.push({
          name: "control-ui-http",
          run: async () =>
            (await getControlUiModule()).handleControlUiHttpRequest(req, res, {
              basePath: controlUiBasePath,
              config: configSnapshot,
              agentId: resolveAssistantIdentity({ cfg: configSnapshot }).agentId,
              root: controlUiRoot,
            }),
        });
      }

      requestStages.push({
        /*
         * /health, /ready 같은 probe는 마지막 근처에서 처리한다.
         * 앞 stage가 같은 path를 처리하지 않았을 때 게이트웨이 상태 확인 응답을 만든다.
         */
        name: "gateway-probes",
        run: () =>
          handleGatewayProbeRequest(
            req,
            res,
            requestPath,
            resolvedAuth,
            trustedProxies,
            allowRealIpFallback,
            getReadiness,
          ),
      });

      if (await runGatewayHttpRequestStages(requestStages)) {
        return;
      }

      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
    } catch (err) {
      console.error("[gateway-http] unhandled error in request handler:", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Internal Server Error");
    }
  }

  return httpServer;
}

export function attachGatewayUpgradeHandler(opts: {
  httpServer: HttpServer;
  wss: WebSocketServer;
  canvasHost: CanvasHostHandler | null;
  clients: Set<GatewayWsClient>;
  preauthConnectionBudget: PreauthConnectionBudget;
  resolvedAuth: ResolvedGatewayAuth;
  getResolvedAuth?: () => ResolvedGatewayAuth;
  /** Optional rate limiter for auth brute-force protection. */
  rateLimiter?: AuthRateLimiter;
}) {
  /*
   * WebSocket upgrade 입구.
   *
   * 모바일 앱/브라우저/CLI가 ws://host:port 로 연결하면 Node HTTP 서버는
   * 일반 request가 아니라 "upgrade" 이벤트를 발생시킨다.
   *
   * 이 함수는 그 upgrade 이벤트에서:
   * - canvas WebSocket인지 검사
   * - 인증 전 연결 수 제한 검사
   * - WebSocket handler가 붙어 있는지 확인
   * - wss.handleUpgrade()로 실제 WebSocket 연결 생성
   * 을 수행한다.
   */
  const {
    httpServer,
    wss,
    canvasHost,
    clients,
    preauthConnectionBudget,
    resolvedAuth,
    rateLimiter,
  } = opts;
  const getResolvedAuth = opts.getResolvedAuth ?? (() => resolvedAuth);
  httpServer.on("upgrade", (req, socket, head) => {
    void (async () => {
      /*
       * upgrade 요청도 보안 설정이 필요하다.
       * HTTP body가 없더라도 client IP, proxy 설정, canvas scoped URL, auth 상태를 확인한다.
       */
      const configSnapshot = loadConfig();
      const trustedProxies = configSnapshot.gateway?.trustedProxies ?? [];
      const allowRealIpFallback = configSnapshot.gateway?.allowRealIpFallback === true;
      const scopedCanvas = normalizeCanvasScopedUrl(req.url ?? "/");
      if (scopedCanvas.malformedScopedPath) {
        writeUpgradeAuthFailure(socket, { ok: false, reason: "unauthorized" });
        socket.destroy();
        return;
      }
      if (scopedCanvas.rewrittenUrl) {
        req.url = scopedCanvas.rewrittenUrl;
      }
      const resolvedAuth = getResolvedAuth();
      if (canvasHost) {
        /*
         * Canvas 전용 WebSocket 경로는 일반 gateway RPC와 다르다.
         * canvas capability를 검사한 뒤 canvasHost가 직접 upgrade를 처리할 수 있다.
         */
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === CANVAS_WS_PATH) {
          const ok = await authorizeCanvasRequest({
            req,
            auth: resolvedAuth,
            trustedProxies,
            allowRealIpFallback,
            clients,
            canvasCapability: scopedCanvas.capability,
            malformedScopedPath: scopedCanvas.malformedScopedPath,
            rateLimiter,
          });
          if (!ok.ok) {
            writeUpgradeAuthFailure(socket, ok);
            socket.destroy();
            return;
          }
        }
        if (canvasHost.handleUpgrade(req, socket, head)) {
          return;
        }
      }
      const preauthBudgetKey = resolveRequestClientIp(req, trustedProxies, allowRealIpFallback);
      if (wss.listenerCount("connection") === 0) {
        /*
         * 아직 04-ws-connection.ts 쪽 connection handler가 붙지 않았다면
         * WebSocket을 열어도 처리할 사람이 없으므로 503으로 닫는다.
         */
        const responseBody = "Gateway websocket handlers unavailable";
        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\n" +
            "Connection: close\r\n" +
            "Content-Type: text/plain; charset=utf-8\r\n" +
            `Content-Length: ${Buffer.byteLength(responseBody, "utf8")}\r\n` +
            "\r\n" +
            responseBody,
        );
        socket.destroy();
        return;
      }
      if (!preauthConnectionBudget.acquire(preauthBudgetKey)) {
        /*
         * 인증 전 WebSocket을 너무 많이 열어두는 공격을 막는다.
         * connect 인증이 완료되기 전까지는 preauth budget으로 개수를 제한한다.
         */
        const responseBody = "Too many unauthenticated sockets";
        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\n" +
            "Connection: close\r\n" +
            "Content-Type: text/plain; charset=utf-8\r\n" +
            `Content-Length: ${Buffer.byteLength(responseBody, "utf8")}\r\n` +
            "\r\n" +
            responseBody,
        );
        socket.destroy();
        return;
      }
      let budgetTransferred = false;
      const releaseUpgradeBudget = () => {
        if (budgetTransferred) {
          return;
        }
        budgetTransferred = true;
        preauthConnectionBudget.release(preauthBudgetKey);
      };
      socket.once("close", releaseUpgradeBudget);
      try {
        wss.handleUpgrade(req, socket, head, (ws) => {
          /*
           * 여기서 HTTP 연결이 실제 WebSocket으로 승격된다.
           * 이후 wss.emit("connection", ws, req)를 통해 04-ws-connection.ts의
           * wss.on("connection") 핸들러가 실행된다.
           */
          (
            ws as unknown as import("ws").WebSocket & {
              __openclawPreauthBudgetClaimed?: boolean;
              __openclawPreauthBudgetKey?: string;
            }
          ).__openclawPreauthBudgetKey = preauthBudgetKey;
          wss.emit("connection", ws, req);
          const budgetClaimed = Boolean(
            (
              ws as unknown as import("ws").WebSocket & {
                __openclawPreauthBudgetClaimed?: boolean;
              }
            ).__openclawPreauthBudgetClaimed,
          );
          if (budgetClaimed) {
            budgetTransferred = true;
            socket.off("close", releaseUpgradeBudget);
          }
        });
      } catch {
        socket.off("close", releaseUpgradeBudget);
        releaseUpgradeBudget();
        throw new Error("gateway websocket upgrade failed");
      }
    })().catch(() => {
      socket.destroy();
    });
  });
}
