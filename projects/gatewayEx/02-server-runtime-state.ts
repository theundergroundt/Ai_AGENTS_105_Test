/*
 * 02-server-runtime-state.ts
 * ---------------------------------------------------------------------------
 * 01-server.impl.ts가 "전체 조립자"라면, 이 파일은 "네트워크 런타임 생성자"다.
 *
 * 이 파일이 하는 일:
 * - Canvas Host가 켜져 있으면 정적/캔버스 호스트 핸들러를 만든다.
 * - HTTP 요청을 처리할 createGatewayHttpServer()를 호출한다.
 * - 실제 포트에 listen한다.
 * - noServer 모드 WebSocketServer를 만든다.
 * - HTTP upgrade 요청을 WebSocketServer로 넘기는 attachGatewayUpgradeHandler()를 붙인다.
 * - 연결된 client set과 broadcast 함수를 만든다.
 * - chat run 상태, dedupe 상태, tool event recipient 상태 같은 런타임 메모리 상태를 준비한다.
 *
 * 흐름으로 보면:
 *
 * startGatewayServer()
 *   -> createGatewayRuntimeState()
 *      -> createGatewayHttpServer()
 *      -> listenGatewayHttpServer()
 *      -> new WebSocketServer({ noServer: true })
 *      -> attachGatewayUpgradeHandler()
 *      -> clients/broadcast/chatRunState 등을 반환
 *
 * 여기서 중요한 구분:
 * - HTTP 서버는 실제 TCP 포트에 listen한다.
 * - WebSocketServer는 noServer 모드라서 직접 listen하지 않는다.
 * - HTTP 서버가 upgrade 요청을 받으면 WebSocketServer에 넘긴다.
 *
 * 즉 모바일 앱이 ws://... 으로 붙을 때 실제 네트워크 입구는 HTTP 서버이고,
 * upgrade 이후부터 WebSocket 연결로 전환된다.
 */

import type { Server as HttpServer } from "node:http";
import { WebSocketServer } from "ws";
import { CANVAS_HOST_PATH } from "../canvas-host/a2ui.js";
import { type CanvasHostHandler, createCanvasHostHandler } from "../canvas-host/server.js";
import type { CliDeps } from "../cli/deps.types.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import type { PluginRegistry } from "../plugins/registry.js";
import {
  pinActivePluginChannelRegistry,
  pinActivePluginHttpRouteRegistry,
  releasePinnedPluginChannelRegistry,
  releasePinnedPluginHttpRouteRegistry,
  resolveActivePluginHttpRouteRegistry,
} from "../plugins/runtime.js";
import type { RuntimeEnv } from "../runtime.js";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import type { ChatAbortControllerEntry } from "./chat-abort.js";
import type { ControlUiRootState } from "./control-ui.js";
import type { HooksConfigResolved } from "./hooks.js";
import { isLoopbackHost, resolveGatewayListenHosts } from "./net.js";
import type { GatewayBroadcastFn, GatewayBroadcastToConnIdsFn } from "./server-broadcast-types.js";
import { createGatewayBroadcaster } from "./server-broadcast.js";
import {
  type ChatRunEntry,
  createChatRunState,
  createToolEventRecipientRegistry,
} from "./server-chat.js";
import { MAX_PREAUTH_PAYLOAD_BYTES } from "./server-constants.js";
import {
  attachGatewayUpgradeHandler,
  createGatewayHttpServer,
  type HookClientIpConfig,
} from "./server-http.js";
import type { DedupeEntry } from "./server-shared.js";
import { createGatewayHooksRequestHandler } from "./server/hooks.js";
import { listenGatewayHttpServer } from "./server/http-listen.js";
import {
  createGatewayPluginRequestHandler,
  shouldEnforceGatewayAuthForPluginPath,
  type PluginRoutePathContext,
} from "./server/plugins-http.js";
import {
  createPreauthConnectionBudget,
  type PreauthConnectionBudget,
} from "./server/preauth-connection-budget.js";
import type { ReadinessChecker } from "./server/readiness.js";
import type { GatewayTlsRuntime } from "./server/tls.js";
import type { GatewayWsClient } from "./server/ws-types.js";

export async function createGatewayRuntimeState(params: {
  cfg: import("../config/config.js").OpenClawConfig;
  bindHost: string;
  port: number;
  controlUiEnabled: boolean;
  controlUiBasePath: string;
  controlUiRoot?: ControlUiRootState;
  openAiChatCompletionsEnabled: boolean;
  openAiChatCompletionsConfig?: import("../config/types.gateway.js").GatewayHttpChatCompletionsConfig;
  openResponsesEnabled: boolean;
  openResponsesConfig?: import("../config/types.gateway.js").GatewayHttpResponsesConfig;
  strictTransportSecurityHeader?: string;
  resolvedAuth: ResolvedGatewayAuth;
  getResolvedAuth: () => ResolvedGatewayAuth;
  /** Optional rate limiter for auth brute-force protection. */
  rateLimiter?: AuthRateLimiter;
  gatewayTls?: GatewayTlsRuntime;
  hooksConfig: () => HooksConfigResolved | null;
  getHookClientIpConfig: () => HookClientIpConfig;
  pluginRegistry: PluginRegistry;
  pinChannelRegistry?: boolean;
  deps: CliDeps;
  canvasRuntime: RuntimeEnv;
  canvasHostEnabled: boolean;
  allowCanvasHostInTests?: boolean;
  logCanvas: { info: (msg: string) => void; warn: (msg: string) => void };
  log: { info: (msg: string) => void; warn: (msg: string) => void };
  logHooks: ReturnType<typeof createSubsystemLogger>;
  logPlugins: ReturnType<typeof createSubsystemLogger>;
  getReadiness?: ReadinessChecker;
}): Promise<{
  canvasHost: CanvasHostHandler | null;
  releasePluginRouteRegistry: () => void;
  httpServer: HttpServer;
  httpServers: HttpServer[];
  httpBindHosts: string[];
  wss: WebSocketServer;
  preauthConnectionBudget: PreauthConnectionBudget;
  clients: Set<GatewayWsClient>;
  broadcast: GatewayBroadcastFn;
  broadcastToConnIds: GatewayBroadcastToConnIdsFn;
  agentRunSeq: Map<string, number>;
  dedupe: Map<string, DedupeEntry>;
  chatRunState: ReturnType<typeof createChatRunState>;
  chatRunBuffers: Map<string, string>;
  chatDeltaSentAt: Map<string, number>;
  chatDeltaLastBroadcastLen: Map<string, number>;
  addChatRun: (sessionId: string, entry: ChatRunEntry) => void;
  removeChatRun: (
    sessionId: string,
    clientRunId: string,
    sessionKey?: string,
  ) => ChatRunEntry | undefined;
  chatAbortControllers: Map<string, ChatAbortControllerEntry>;
  toolEventRecipients: ReturnType<typeof createToolEventRecipientRegistry>;
}> {
  /*
   * 이 함수는 "서버를 실제로 띄우는 데 필요한 런타임 객체 묶음"을 만든다.
   *
   * 반환값은 단순한 서버 하나가 아니라:
   * - HTTP 서버 목록
   * - WebSocketServer
   * - 연결된 client 집합
   * - broadcast 함수
   * - chat 실행 상태
   * - node/tool 관련 상태
   * 를 모두 포함한다.
   */
  pinActivePluginHttpRouteRegistry(params.pluginRegistry);
  if (params.pinChannelRegistry !== false) {
    pinActivePluginChannelRegistry(params.pluginRegistry);
  } else {
    releasePinnedPluginChannelRegistry();
  }
  try {
    /*
     * Canvas Host 준비.
     *
     * OpenClaw는 채팅만 하는 게 아니라 canvas/a2ui 같은 화면 자원을 게이트웨이에서
     * 같이 서빙할 수 있다. canvasHostEnabled가 켜져 있으면 여기서 handler를 만든다.
     */
    let canvasHost: CanvasHostHandler | null = null;
    if (params.canvasHostEnabled) {
      try {
        const handler = await createCanvasHostHandler({
          runtime: params.canvasRuntime,
          rootDir: params.cfg.canvasHost?.root,
          basePath: CANVAS_HOST_PATH,
          allowInTests: params.allowCanvasHostInTests,
          liveReload: params.cfg.canvasHost?.liveReload,
        });
        if (handler.rootDir) {
          canvasHost = handler;
          params.logCanvas.info(
            `canvas host mounted at http://${params.bindHost}:${params.port}${CANVAS_HOST_PATH}/ (root ${handler.rootDir})`,
          );
        }
      } catch (err) {
        params.logCanvas.warn(`canvas host failed to start: ${String(err)}`);
      }
    }

    /*
     * 연결 client 집합과 broadcast 함수.
     *
     * WebSocket으로 연결된 iOS/Android/브라우저/CLI client가 clients에 들어간다.
     * broadcast는 이 client들에게 서버 이벤트를 뿌리는 핵심 함수다.
     */
    const clients = new Set<GatewayWsClient>();
    const { broadcast, broadcastToConnIds } = createGatewayBroadcaster({ clients });

    /*
     * Hook HTTP 요청 핸들러.
     *
     * 외부 webhook이 들어왔을 때 어느 session/agent/channel로 보낼지 처리하는 핸들러다.
     * 예: 외부 서비스가 특정 URL로 이벤트를 보내면 gateway가 agent wake나 channel dispatch로 바꾼다.
     */
    const handleHooksRequest = createGatewayHooksRequestHandler({
      deps: params.deps,
      getHooksConfig: params.hooksConfig,
      getClientIpConfig: params.getHookClientIpConfig,
      bindHost: params.bindHost,
      port: params.port,
      logHooks: params.logHooks,
    });

    /*
     * 플러그인 HTTP route 핸들러.
     *
     * OpenClaw 플러그인은 자체 HTTP route를 등록할 수 있다.
     * 그 route로 들어온 요청은 기본 서버 코드가 아니라 plugin registry를 통해 처리된다.
     */
    const handlePluginRequest = createGatewayPluginRequestHandler({
      registry: params.pluginRegistry,
      log: params.logPlugins,
    });
    const shouldEnforcePluginGatewayAuth = (pathContext: PluginRoutePathContext): boolean => {
      return shouldEnforceGatewayAuthForPluginPath(
        resolveActivePluginHttpRouteRegistry(params.pluginRegistry),
        pathContext,
      );
    };

    /*
     * bindHost 확정.
     *
     * 설정값이 loopback/lan/tailnet/auto일 수 있으므로 실제 listen할 host 목록으로 푼다.
     * 일부 환경에서는 127.0.0.1 외에 ::1 같은 alias도 함께 열 수 있다.
     */
    const bindHosts = await resolveGatewayListenHosts(params.bindHost);
    if (!isLoopbackHost(params.bindHost)) {
      params.log.warn(
        "⚠️  Gateway is binding to a non-loopback address. " +
          "Ensure authentication is configured before exposing to public networks.",
      );
    }
    if (params.cfg.gateway?.controlUi?.dangerouslyAllowHostHeaderOriginFallback === true) {
      params.log.warn(
        "⚠️  gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=true is enabled. " +
          "Host-header origin fallback weakens origin checks and should only be used as break-glass.",
      );
    }
    /*
     * HTTP 서버 생성 + listen.
     *
     * createGatewayHttpServer()는 요청 라우팅 함수를 가진 서버 객체를 만든다.
     * listenGatewayHttpServer()가 실제 bindHost:port에 listen시킨다.
     */
    const httpServers: HttpServer[] = [];
    const httpBindHosts: string[] = [];
    for (const host of bindHosts) {
      /*
       * 03-server-http.ts로 넘어가는 지점.
       *
       * 여기서 만들어지는 HTTP 서버는 다음을 처리한다.
       * - /health, /ready 같은 probe
       * - Control UI 정적 파일
       * - /v1/chat/completions, /v1/responses 같은 선택적 OpenAI 호환 HTTP API
       * - plugin route
       * - WebSocket upgrade 전 단계의 HTTP 요청
       */
      const httpServer = createGatewayHttpServer({
        canvasHost,
        clients,
        controlUiEnabled: params.controlUiEnabled,
        controlUiBasePath: params.controlUiBasePath,
        controlUiRoot: params.controlUiRoot,
        openAiChatCompletionsEnabled: params.openAiChatCompletionsEnabled,
        openAiChatCompletionsConfig: params.openAiChatCompletionsConfig,
        openResponsesEnabled: params.openResponsesEnabled,
        openResponsesConfig: params.openResponsesConfig,
        strictTransportSecurityHeader: params.strictTransportSecurityHeader,
        handleHooksRequest,
        handlePluginRequest,
        shouldEnforcePluginGatewayAuth,
        resolvedAuth: params.resolvedAuth,
        getResolvedAuth: params.getResolvedAuth,
        rateLimiter: params.rateLimiter,
        getReadiness: params.getReadiness,
        tlsOptions: params.gatewayTls?.enabled ? params.gatewayTls.tlsOptions : undefined,
      });
      try {
        /*
         * 실제 포트에 bind하는 순간이다.
         * 여기서 실패하면 게이트웨이는 "서버 시작 실패"로 빠진다.
         */
        await listenGatewayHttpServer({
          httpServer,
          bindHost: host,
          port: params.port,
        });
        httpServers.push(httpServer);
        httpBindHosts.push(host);
      } catch (err) {
        if (host === bindHosts[0]) {
          throw err;
        }
        params.log.warn(
          `gateway: failed to bind loopback alias ${host}:${params.port} (${String(err)})`,
        );
      }
    }
    const httpServer = httpServers[0];
    if (!httpServer) {
      throw new Error("Gateway HTTP server failed to start");
    }

    /*
     * WebSocketServer 생성.
     *
     * noServer: true 이므로 wss가 자체적으로 포트를 열지는 않는다.
     * HTTP 서버의 upgrade 요청을 받아서 같은 포트 위에서 WebSocket으로 승격시킨다.
     */
    const wss = new WebSocketServer({
      noServer: true,
      maxPayload: MAX_PREAUTH_PAYLOAD_BYTES,
    });
    const preauthConnectionBudget = createPreauthConnectionBudget();
    for (const server of httpServers) {
      /*
       * HTTP upgrade -> WebSocket 연결로 넘기는 다리.
       *
       * 모바일 앱의 ws://host:18789 접속은 먼저 HTTP upgrade 요청으로 들어온다.
       * attachGatewayUpgradeHandler()가 인증 전 payload 제한, canvas path 여부 등을 본 뒤
       * WebSocketServer로 연결을 넘긴다.
       */
      attachGatewayUpgradeHandler({
        httpServer: server,
        wss,
        canvasHost,
        clients,
        preauthConnectionBudget,
        resolvedAuth: params.resolvedAuth,
        getResolvedAuth: params.getResolvedAuth,
        rateLimiter: params.rateLimiter,
      });
    }

    /*
     * 실행 중 상태 저장소들.
     *
     * 이 값들은 DB가 아니라 프로세스 메모리 상태다.
     * WebSocket client가 연결되어 있는 동안 chat 실행 순서, 중복 요청 방지,
     * streaming buffer, abort controller 등을 추적한다.
     */
    const agentRunSeq = new Map<string, number>();
    const dedupe = new Map<string, DedupeEntry>();
    const chatRunState = createChatRunState();
    const chatRunRegistry = chatRunState.registry;
    const chatRunBuffers = chatRunState.buffers;
    const chatDeltaSentAt = chatRunState.deltaSentAt;
    const chatDeltaLastBroadcastLen = chatRunState.deltaLastBroadcastLen;
    const addChatRun = chatRunRegistry.add;
    const removeChatRun = chatRunRegistry.remove;
    const chatAbortControllers = new Map<string, ChatAbortControllerEntry>();
    const toolEventRecipients = createToolEventRecipientRegistry();

    return {
      canvasHost,
      releasePluginRouteRegistry: () => {
        // 시작 시 고정한 HTTP route registry와 channel registry를 해제한다.
        releasePinnedPluginHttpRouteRegistry(params.pluginRegistry);
        /*
         * channel registry는 중간에 deferred reload로 다른 registry에 다시 pin될 수 있다.
         * 그래서 특정 registry 인자로 조건부 해제하지 않고 전역 pin을 무조건 해제한다.
         */
        releasePinnedPluginChannelRegistry();
      },
      httpServer,
      httpServers,
      httpBindHosts,
      wss,
      preauthConnectionBudget,
      clients,
      broadcast,
      broadcastToConnIds,
      agentRunSeq,
      dedupe,
      chatRunState,
      chatRunBuffers,
      chatDeltaSentAt,
      chatDeltaLastBroadcastLen,
      addChatRun,
      removeChatRun,
      chatAbortControllers,
      toolEventRecipients,
    };
  } catch (err) {
    releasePinnedPluginHttpRouteRegistry(params.pluginRegistry);
    releasePinnedPluginChannelRegistry();
    throw err;
  }
}
