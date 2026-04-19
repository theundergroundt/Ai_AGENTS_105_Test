/*
 * 01-server.impl.ts
 * ---------------------------------------------------------------------------
 * OpenClaw 게이트웨이의 "전체 조립 파일"이다.
 *
 * 이 파일을 제일 먼저 보는 이유:
 * - openclaw gateway가 실행되면 결국 startGatewayServer()가 호출된다.
 * - 여기서 설정 파일, 인증 방식, 플러그인, 채널, HTTP 서버, WebSocket 서버,
 *   cron, 이벤트 구독, 모바일 노드 런타임을 한 번에 묶는다.
 * - 실제 HTTP 요청을 직접 파싱하는 파일은 아니지만, 어떤 하위 모듈이 어떤 순서로
 *   붙는지 보여주는 최상위 지도 역할을 한다.
 *
 * 크게 보면 흐름은 아래 순서다.
 *
 * 1. 시작 옵션과 환경변수 정리
 *    - 포트 기본값은 18789다.
 *    - 테스트용 최소 게이트웨이인지 확인한다.
 *    - OPENCLAW_GATEWAY_PORT 같은 런타임 환경값을 고정한다.
 *
 * 2. 설정/인증/비밀값 준비
 *    - config를 읽고 gateway.auth 설정을 해석한다.
 *    - 토큰이 없으면 런타임 토큰을 만들거나 config에 저장한다.
 *    - TLS, Tailscale, Control UI, OpenAI 호환 HTTP 엔드포인트 설정도 여기서 결정된다.
 *
 * 3. 플러그인/채널 준비
 *    - Telegram, Discord, Webhook 같은 채널 플러그인을 로딩한다.
 *    - 플러그인이 추가한 gateway method도 기본 method 목록에 합친다.
 *
 * 4. createGatewayRuntimeState() 호출
 *    - 02-server-runtime-state.ts로 넘어가는 지점이다.
 *    - 여기서 실제 HTTP 서버, WebSocketServer, 브로드캐스터, client set 등이 만들어진다.
 *
 * 5. RequestContext 생성
 *    - WebSocket RPC method가 실행될 때 필요한 모든 의존성을 한 객체로 묶는다.
 *    - 예: chat.send, nodes.*, sessions.*, config.*, health 등이 이 context를 통해 동작한다.
 *
 * 6. attachGatewayWsHandlers() 호출
 *    - 04-ws-connection.ts로 이어지는 지점이다.
 *    - WebSocket 연결 하나가 들어왔을 때 connect.challenge를 보내고 RPC 프레임을 처리한다.
 *
 * 7. 후속 런타임 시작
 *    - Bonjour discovery, Tailscale, 채널 시작, cron, heartbeat, config reload watcher 등을 켠다.
 *
 * 이 파일에서 기억할 핵심:
 * - "통신을 직접 처리하는 파일"은 아니다.
 * - 하지만 "게이트웨이 서버가 어떤 부품으로 구성되는지"를 가장 먼저 보여준다.
 * - 모바일/iOS/Android가 붙는 WebSocket 게이트웨이도 여기서 시작된다.
 */

import { getActiveEmbeddedRunCount } from "../agents/pi-embedded-runner/runs.js";
import { getTotalPendingReplies } from "../auto-reply/reply/dispatcher-registry.js";
import type { CanvasHostServer } from "../canvas-host/server.js";
import { type ChannelId, listChannelPlugins } from "../channels/plugins/index.js";
import { createDefaultDeps } from "../cli/deps.js";
import { isRestartEnabled } from "../config/commands.flags.js";
import {
  type OpenClawConfig,
  applyConfigOverrides,
  getRuntimeConfig,
  isNixMode,
  loadConfig,
  readConfigFileSnapshot,
  registerConfigWriteListener,
  writeConfigFile,
} from "../config/config.js";
import { applyPluginAutoEnable } from "../config/plugin-auto-enable.js";
import { resolveMainSessionKey } from "../config/sessions.js";
import { clearAgentRunContext } from "../infra/agent-events.js";
import { isDiagnosticsEnabled } from "../infra/diagnostic-events.js";
import { logAcceptedEnvOption } from "../infra/env.js";
import { ensureOpenClawCliOnPath } from "../infra/path-env.js";
import { setGatewaySigusr1RestartPolicy, setPreRestartDeferralCheck } from "../infra/restart.js";
import { enqueueSystemEvent } from "../infra/system-events.js";
import { startDiagnosticHeartbeat, stopDiagnosticHeartbeat } from "../logging/diagnostic.js";
import { createSubsystemLogger, runtimeForLogger } from "../logging/subsystem.js";
import { runGlobalGatewayStopSafely } from "../plugins/hook-runner-global.js";
import { createPluginRuntime } from "../plugins/runtime/index.js";
import { getTotalQueueSize } from "../process/command-queue.js";
import type { RuntimeEnv } from "../runtime.js";
import {
  clearSecretsRuntimeSnapshot,
  getActiveSecretsRuntimeSnapshot,
} from "../secrets/runtime.js";
import {
  getInspectableTaskRegistrySummary,
  stopTaskRegistryMaintenance,
} from "../tasks/task-registry.maintenance.js";
import { runSetupWizard } from "../wizard/setup.js";
import { createAuthRateLimiter, type AuthRateLimiter } from "./auth-rate-limit.js";
import { resolveGatewayAuth } from "./auth.js";
import { closeMcpLoopbackServer } from "./mcp-http.js";
import { createGatewayAuxHandlers } from "./server-aux-handlers.js";
import { createChannelManager } from "./server-channels.js";
import { createGatewayCloseHandler, runGatewayClosePrelude } from "./server-close.js";
import { resolveGatewayControlUiRootState } from "./server-control-ui-root.js";
import { buildGatewayCronService } from "./server-cron.js";
import { applyGatewayLaneConcurrency } from "./server-lanes.js";
import { createGatewayServerLiveState, type GatewayServerLiveState } from "./server-live-state.js";
import { GATEWAY_EVENTS } from "./server-methods-list.js";
import { coreGatewayHandlers } from "./server-methods.js";
import { loadGatewayModelCatalog } from "./server-model-catalog.js";
import { createGatewayNodeSessionRuntime } from "./server-node-session-runtime.js";
import { reloadDeferredGatewayPlugins } from "./server-plugin-bootstrap.js";
import { setFallbackGatewayContextResolver } from "./server-plugins.js";
import { startManagedGatewayConfigReloader } from "./server-reload-handlers.js";
import { createGatewayRequestContext } from "./server-request-context.js";
import { resolveGatewayRuntimeConfig } from "./server-runtime-config.js";
import {
  activateGatewayScheduledServices,
  startGatewayRuntimeServices,
} from "./server-runtime-services.js";
import { createGatewayRuntimeState } from "./server-runtime-state.js";
import { startGatewayEventSubscriptions } from "./server-runtime-subscriptions.js";
import { resolveSessionKeyForRun } from "./server-session-key.js";
import {
  enforceSharedGatewaySessionGenerationForConfigWrite,
  getRequiredSharedGatewaySessionGeneration,
  type SharedGatewaySessionGenerationState,
} from "./server-shared-auth-generation.js";
import {
  createRuntimeSecretsActivator,
  loadGatewayStartupConfigSnapshot,
  prepareGatewayStartupConfig,
} from "./server-startup-config.js";
import { prepareGatewayPluginBootstrap } from "./server-startup-plugins.js";
import { STARTUP_UNAVAILABLE_GATEWAY_METHODS } from "./server-startup-unavailable-methods.js";
import { startGatewayEarlyRuntime, startGatewayPostAttachRuntime } from "./server-startup.js";
import { createWizardSessionTracker } from "./server-wizard-sessions.js";
import { attachGatewayWsHandlers } from "./server-ws-runtime.js";
import {
  getHealthCache,
  getHealthVersion,
  getPresenceVersion,
  incrementPresenceVersion,
  refreshGatewayHealthSnapshot,
} from "./server/health-state.js";
import { resolveHookClientIpConfig } from "./server/hooks.js";
import { createReadinessChecker } from "./server/readiness.js";
import { loadGatewayTlsRuntime } from "./server/tls.js";
import { resolveSharedGatewaySessionGeneration } from "./server/ws-shared-generation.js";
import { maybeSeedControlUiAllowedOriginsAtStartup } from "./startup-control-ui-origins.js";

export { __resetModelCatalogCacheForTest } from "./server-model-catalog.js";

ensureOpenClawCliOnPath();

const MAX_MEDIA_TTL_HOURS = 24 * 7;

function resolveMediaCleanupTtlMs(ttlHoursRaw: number): number {
  const ttlHours = Math.min(Math.max(ttlHoursRaw, 1), MAX_MEDIA_TTL_HOURS);
  const ttlMs = ttlHours * 60 * 60_000;
  if (!Number.isFinite(ttlMs) || !Number.isSafeInteger(ttlMs)) {
    throw new Error(`Invalid media.ttlHours: ${String(ttlHoursRaw)}`);
  }
  return ttlMs;
}

const log = createSubsystemLogger("gateway");
const logCanvas = log.child("canvas");
const logDiscovery = log.child("discovery");
const logTailscale = log.child("tailscale");
const logChannels = log.child("channels");

let cachedChannelRuntime: ReturnType<typeof createPluginRuntime>["channel"] | null = null;

function getChannelRuntime() {
  cachedChannelRuntime ??= createPluginRuntime().channel;
  return cachedChannelRuntime;
}

const logHealth = log.child("health");
const logCron = log.child("cron");
const logReload = log.child("reload");
const logHooks = log.child("hooks");
const logPlugins = log.child("plugins");
const logWsControl = log.child("ws");
const logSecrets = log.child("secrets");
const gatewayRuntime = runtimeForLogger(log);
const canvasRuntime = runtimeForLogger(logCanvas);

type AuthRateLimitConfig = Parameters<typeof createAuthRateLimiter>[0];

function createGatewayAuthRateLimiters(rateLimitConfig: AuthRateLimitConfig | undefined): {
  rateLimiter?: AuthRateLimiter;
  browserRateLimiter: AuthRateLimiter;
} {
  const rateLimiter = rateLimitConfig ? createAuthRateLimiter(rateLimitConfig) : undefined;
  // Browser-origin WS auth attempts always use loopback-non-exempt throttling.
  const browserRateLimiter = createAuthRateLimiter({
    ...rateLimitConfig,
    exemptLoopback: false,
  });
  return { rateLimiter, browserRateLimiter };
}

export type GatewayServer = {
  close: (opts?: { reason?: string; restartExpectedMs?: number | null }) => Promise<void>;
};

export type GatewayServerOptions = {
  /**
   * Bind address policy for the Gateway WebSocket/HTTP server.
   * - loopback: 127.0.0.1
   * - lan: 0.0.0.0
   * - tailnet: bind only to the Tailscale IPv4 address (100.64.0.0/10)
   * - auto: prefer loopback, else LAN
   */
  bind?: import("../config/config.js").GatewayBindMode;
  /**
   * Advanced override for the bind host, bypassing bind resolution.
   * Prefer `bind` unless you really need a specific address.
   */
  host?: string;
  /**
   * If false, do not serve the browser Control UI.
   * Default: config `gateway.controlUi.enabled` (or true when absent).
   */
  controlUiEnabled?: boolean;
  /**
   * If false, do not serve `POST /v1/chat/completions`.
   * Default: config `gateway.http.endpoints.chatCompletions.enabled` (or false when absent).
   */
  openAiChatCompletionsEnabled?: boolean;
  /**
   * If false, do not serve `POST /v1/responses` (OpenResponses API).
   * Default: config `gateway.http.endpoints.responses.enabled` (or false when absent).
   */
  openResponsesEnabled?: boolean;
  /**
   * Override gateway auth configuration (merges with config).
   */
  auth?: import("../config/config.js").GatewayAuthConfig;
  /**
   * Override gateway Tailscale exposure configuration (merges with config).
   */
  tailscale?: import("../config/config.js").GatewayTailscaleConfig;
  /**
   * Test-only: allow canvas host startup even when NODE_ENV/VITEST would disable it.
   */
  allowCanvasHostInTests?: boolean;
  /**
   * Test-only: override the setup wizard runner.
   */
  wizardRunner?: (
    opts: import("../commands/onboard-types.js").OnboardOptions,
    runtime: import("../runtime.js").RuntimeEnv,
    prompter: import("../wizard/prompts.js").WizardPrompter,
  ) => Promise<void>;
  /**
   * Optional startup timestamp used for concise readiness logging.
   */
  startupStartedAt?: number;
};

export async function startGatewayServer(
  port = 18789,
  opts: GatewayServerOptions = {},
): Promise<GatewayServer> {
  /*
   * 여기부터가 게이트웨이 서버의 실제 시작점이다.
   *
   * 함수 인자로 받은 port와 opts는 테스트/CLI/서비스 실행 방식에 따라 바뀔 수 있다.
   * 일반 실행에서는 port 18789가 기본이고, bind/TLS/auth 같은 값은 config에서 다시 해석된다.
   */
  const minimalTestGateway =
    process.env.VITEST === "1" && process.env.OPENCLAW_TEST_MINIMAL_GATEWAY === "1";

  /*
   * 브라우저 Control UI, Canvas Host, WebSocket URL 생성 로직이 모두 같은 포트를 보도록
   * 런타임 환경변수에도 실제 포트를 박아 둔다.
   */
  process.env.OPENCLAW_GATEWAY_PORT = String(port);
  logAcceptedEnvOption({
    key: "OPENCLAW_RAW_STREAM",
    description: "raw stream logging enabled",
  });
  logAcceptedEnvOption({
    key: "OPENCLAW_RAW_STREAM_PATH",
    description: "raw stream log path override",
  });

  /*
   * 1차 설정 로딩.
   *
   * 여기서 읽은 configSnapshot은 "시작 순간의 원본 설정"에 가깝다.
   * 이후 auth bootstrap, control-ui origin seed, plugin auto-enable 등을 거치며 cfgAtStart로 정리된다.
   */
  const configSnapshot = await loadGatewayStartupConfigSnapshot({
    minimalTestGateway,
    log,
  });

  const emitSecretsStateEvent = (
    code: "SECRETS_RELOADER_DEGRADED" | "SECRETS_RELOADER_RECOVERED",
    message: string,
    cfg: OpenClawConfig,
  ) => {
    enqueueSystemEvent(`[${code}] ${message}`, {
      sessionKey: resolveMainSessionKey(cfg),
      contextKey: code,
    });
  };
  const activateRuntimeSecrets = createRuntimeSecretsActivator({
    logSecrets,
    emitStateEvent: emitSecretsStateEvent,
  });

  let cfgAtStart: OpenClawConfig;
  let startupInternalWriteHash: string | null = null;
  const startupRuntimeConfig = applyConfigOverrides(configSnapshot.config);
  /*
   * 인증/비밀값 부트스트랩.
   *
   * 게이트웨이를 외부에 열 수 있으므로 인증 설정이 매우 중요하다.
   * 이 단계에서 gateway.auth.token/password, Tailscale 관련 설정, secret runtime을 준비한다.
   */
  const authBootstrap = await prepareGatewayStartupConfig({
    configSnapshot,
    authOverride: opts.auth,
    tailscaleOverride: opts.tailscale,
    activateRuntimeSecrets,
  });
  cfgAtStart = authBootstrap.cfg;
  if (authBootstrap.generatedToken) {
    if (authBootstrap.persistedGeneratedToken) {
      log.info(
        "Gateway auth token was missing. Generated a new token and saved it to config (gateway.auth.token).",
      );
    } else {
      log.warn(
        "Gateway auth token was missing. Generated a runtime token for this startup without changing config; restart will generate a different token. Persist one with `openclaw config set gateway.auth.mode token` and `openclaw config set gateway.auth.token <token>`.",
      );
    }
  }
  const diagnosticsEnabled = isDiagnosticsEnabled(cfgAtStart);
  if (diagnosticsEnabled) {
    startDiagnosticHeartbeat(undefined, { getConfig: getRuntimeConfig });
  }
  setGatewaySigusr1RestartPolicy({ allowExternal: isRestartEnabled(cfgAtStart) });
  setPreRestartDeferralCheck(
    () =>
      getTotalQueueSize() +
      getTotalPendingReplies() +
      getActiveEmbeddedRunCount() +
      getInspectableTaskRegistrySummary().active,
  );
  /*
   * 기존 설치 마이그레이션.
   *
   * loopback이 아닌 주소로 Control UI를 열 때 allowedOrigins가 없으면 보안상 문제가 될 수 있다.
   * 구버전에서 올라온 사용자 설정에 필요한 origin 값을 보강한다.
   */
  const controlUiSeed = minimalTestGateway
    ? { config: cfgAtStart, persistedAllowedOriginsSeed: false }
    : await maybeSeedControlUiAllowedOriginsAtStartup({
        config: cfgAtStart,
        writeConfig: writeConfigFile,
        log,
      });
  cfgAtStart = controlUiSeed.config;
  if (authBootstrap.persistedGeneratedToken || controlUiSeed.persistedAllowedOriginsSeed) {
    const startupSnapshot = await readConfigFileSnapshot();
    startupInternalWriteHash = startupSnapshot.hash ?? null;
  }
  /*
   * 플러그인 부트스트랩.
   *
   * OpenClaw 게이트웨이는 기본 method만 가진 고정 서버가 아니라,
   * 플러그인과 채널이 method/HTTP route/channel runtime을 추가할 수 있는 구조다.
   * 그래서 실제 gateway method 목록은 여기서 기본값 + 플러그인 제공값으로 만들어진다.
   */
  const pluginBootstrap = await prepareGatewayPluginBootstrap({
    cfgAtStart,
    startupRuntimeConfig,
    minimalTestGateway,
    log,
  });
  const {
    gatewayPluginConfigAtStart,
    defaultWorkspaceDir,
    deferredConfiguredChannelPluginIds,
    startupPluginIds,
    baseMethods,
  } = pluginBootstrap;
  let { pluginRegistry, baseGatewayMethods } = pluginBootstrap;
  const channelLogs = Object.fromEntries(
    listChannelPlugins().map((plugin) => [plugin.id, logChannels.child(plugin.id)]),
  ) as Record<ChannelId, ReturnType<typeof createSubsystemLogger>>;
  const channelRuntimeEnvs = Object.fromEntries(
    Object.entries(channelLogs).map(([id, logger]) => [id, runtimeForLogger(logger)]),
  ) as unknown as Record<ChannelId, RuntimeEnv>;
  const listActiveGatewayMethods = (nextBaseGatewayMethods: string[]) =>
    Array.from(
      new Set([
        ...nextBaseGatewayMethods,
        ...listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []),
      ]),
    );
  /*
   * 런타임 네트워크 설정 확정.
   *
   * bindHost, TLS, Tailscale, Control UI, OpenAI 호환 HTTP 엔드포인트 활성화 여부가 여기서 결정된다.
   * 이후 하위 모듈들은 이 결과를 받아 실제 서버를 만든다.
   */
  const runtimeConfig = await resolveGatewayRuntimeConfig({
    cfg: cfgAtStart,
    port,
    bind: opts.bind,
    host: opts.host,
    controlUiEnabled: opts.controlUiEnabled,
    openAiChatCompletionsEnabled: opts.openAiChatCompletionsEnabled,
    openResponsesEnabled: opts.openResponsesEnabled,
    auth: opts.auth,
    tailscale: opts.tailscale,
  });
  const {
    bindHost,
    controlUiEnabled,
    openAiChatCompletionsEnabled,
    openAiChatCompletionsConfig,
    openResponsesEnabled,
    openResponsesConfig,
    strictTransportSecurityHeader,
    controlUiBasePath,
    controlUiRoot: controlUiRootOverride,
    resolvedAuth,
    tailscaleConfig,
    tailscaleMode,
  } = runtimeConfig;
  const getResolvedAuth = () =>
    resolveGatewayAuth({
      authConfig:
        getActiveSecretsRuntimeSnapshot()?.config.gateway?.auth ?? getRuntimeConfig().gateway?.auth,
      authOverride: opts.auth,
      env: process.env,
      tailscaleMode,
    });
  const resolveSharedGatewaySessionGenerationForConfig = (config: OpenClawConfig) =>
    resolveSharedGatewaySessionGeneration(
      resolveGatewayAuth({
        authConfig: config.gateway?.auth,
        authOverride: opts.auth,
        env: process.env,
        tailscaleMode,
      }),
    );
  const resolveCurrentSharedGatewaySessionGeneration = () =>
    resolveSharedGatewaySessionGeneration(getResolvedAuth());
  const resolveSharedGatewaySessionGenerationForRuntimeSnapshot = () =>
    resolveSharedGatewaySessionGeneration(
      resolveGatewayAuth({
        authConfig: getRuntimeConfig().gateway?.auth,
        authOverride: opts.auth,
        env: process.env,
        tailscaleMode,
      }),
    );
  const sharedGatewaySessionGenerationState: SharedGatewaySessionGenerationState = {
    current: resolveCurrentSharedGatewaySessionGeneration(),
    required: null,
  };
  const initialHooksConfig = runtimeConfig.hooksConfig;
  const initialHookClientIpConfig = resolveHookClientIpConfig(cfgAtStart);
  const canvasHostEnabled = runtimeConfig.canvasHostEnabled;

  /*
   * 인증 rate limiter.
   *
   * WebSocket connect나 HTTP auth를 계속 실패시키는 공격을 막기 위한 제한기다.
   * 브라우저 Origin에서 오는 시도는 loopback이라도 별도 limiter로 더 엄격히 본다.
   */
  const rateLimitConfig = cfgAtStart.gateway?.auth?.rateLimit;
  const { rateLimiter: authRateLimiter, browserRateLimiter: browserAuthRateLimiter } =
    createGatewayAuthRateLimiters(rateLimitConfig);

  const controlUiRootState = await resolveGatewayControlUiRootState({
    controlUiRootOverride,
    controlUiEnabled,
    gatewayRuntime,
    log,
  });

  const wizardRunner = opts.wizardRunner ?? runSetupWizard;
  const { wizardSessions, findRunningWizard, purgeWizardSession } = createWizardSessionTracker();

  const deps = createDefaultDeps();
  let runtimeState: GatewayServerLiveState | null = null;
  let canvasHostServer: CanvasHostServer | null = null;
  const gatewayTls = await loadGatewayTlsRuntime(cfgAtStart.gateway?.tls, log.child("tls"));
  if (cfgAtStart.gateway?.tls?.enabled && !gatewayTls.enabled) {
    throw new Error(gatewayTls.error ?? "gateway tls: failed to enable");
  }
  const serverStartedAt = Date.now();
  const channelManager = createChannelManager({
    loadConfig: () =>
      applyPluginAutoEnable({
        config: loadConfig(),
        env: process.env,
      }).config,
    channelLogs,
    channelRuntimeEnvs,
    resolveChannelRuntime: getChannelRuntime,
  });
  const getReadiness = createReadinessChecker({
    channelManager,
    startedAt: serverStartedAt,
  });
  log.info("starting HTTP server...");
  /*
   * 02-server-runtime-state.ts로 내려가는 가장 중요한 호출.
   *
   * 여기서 반환되는 것들:
   * - httpServer/httpServers: 실제 listen 중인 HTTP 서버들
   * - wss: noServer 모드 WebSocketServer
   * - clients: 현재 연결된 WebSocket client 집합
   * - broadcast: 모든 client에게 이벤트를 뿌리는 함수
   * - chatRunState/dedupe/agentRunSeq: 채팅 실행 상태와 중복 방지 상태
   */
  const {
    canvasHost,
    releasePluginRouteRegistry,
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
  } = await createGatewayRuntimeState({
    cfg: cfgAtStart,
    bindHost,
    port,
    controlUiEnabled,
    controlUiBasePath,
    controlUiRoot: controlUiRootState,
    openAiChatCompletionsEnabled,
    openAiChatCompletionsConfig,
    openResponsesEnabled,
    openResponsesConfig,
    strictTransportSecurityHeader,
    resolvedAuth,
    rateLimiter: authRateLimiter,
    gatewayTls,
    getResolvedAuth,
    hooksConfig: () => runtimeState?.hooksConfig ?? initialHooksConfig,
    getHookClientIpConfig: () => runtimeState?.hookClientIpConfig ?? initialHookClientIpConfig,
    pluginRegistry,
    pinChannelRegistry: !minimalTestGateway,
    deps,
    canvasRuntime,
    canvasHostEnabled,
    allowCanvasHostInTests: opts.allowCanvasHostInTests,
    logCanvas,
    log,
    logHooks,
    logPlugins,
    getReadiness,
  });
  /*
   * 모바일/외부 노드 세션 런타임.
   *
   * iOS/Android 앱은 "node" 역할로 붙어서 휴대폰 기능을 게이트웨이에 제공한다.
   * 예: node.invoke.request 이벤트가 오면 폰에서 카메라/위치/연락처 같은 기능을 실행하고
   * node.invoke.result로 결과를 돌려주는 구조다.
   */
  const {
    nodeRegistry,
    nodePresenceTimers,
    sessionEventSubscribers,
    sessionMessageSubscribers,
    nodeSendToSession,
    nodeSendToAllSubscribed,
    nodeSubscribe,
    nodeUnsubscribe,
    nodeUnsubscribeAll,
    broadcastVoiceWakeChanged,
    hasMobileNodeConnected,
  } = createGatewayNodeSessionRuntime({ broadcast });
  applyGatewayLaneConcurrency(cfgAtStart);

  runtimeState = createGatewayServerLiveState({
    hooksConfig: initialHooksConfig,
    hookClientIpConfig: initialHookClientIpConfig,
    cronState: buildGatewayCronService({
      cfg: cfgAtStart,
      deps,
      broadcast,
    }),
    gatewayMethods: listActiveGatewayMethods(baseGatewayMethods),
  });
  deps.cron = runtimeState.cronState.cron;

  const runClosePrelude = async () =>
    await runGatewayClosePrelude({
      ...(diagnosticsEnabled ? { stopDiagnostics: stopDiagnosticHeartbeat } : {}),
      clearSkillsRefreshTimer: () => {
        if (!runtimeState?.skillsRefreshTimer) {
          return;
        }
        clearTimeout(runtimeState.skillsRefreshTimer);
        runtimeState.skillsRefreshTimer = null;
      },
      skillsChangeUnsub: runtimeState.skillsChangeUnsub,
      ...(authRateLimiter ? { disposeAuthRateLimiter: () => authRateLimiter.dispose() } : {}),
      disposeBrowserAuthRateLimiter: () => browserAuthRateLimiter.dispose(),
      stopModelPricingRefresh: runtimeState.stopModelPricingRefresh,
      stopChannelHealthMonitor: () => runtimeState?.channelHealthMonitor?.stop(),
      clearSecretsRuntimeSnapshot,
      closeMcpServer: async () => await closeMcpLoopbackServer(),
    });
  const closeOnStartupFailure = async () => {
    await runClosePrelude();
    await createGatewayCloseHandler({
      bonjourStop: runtimeState.bonjourStop,
      tailscaleCleanup: runtimeState.tailscaleCleanup,
      canvasHost,
      canvasHostServer,
      releasePluginRouteRegistry,
      stopChannel,
      pluginServices: runtimeState.pluginServices,
      cron: runtimeState.cronState.cron,
      heartbeatRunner: runtimeState.heartbeatRunner,
      updateCheckStop: runtimeState.stopGatewayUpdateCheck,
      stopTaskRegistryMaintenance,
      nodePresenceTimers,
      broadcast,
      tickInterval: runtimeState.tickInterval,
      healthInterval: runtimeState.healthInterval,
      dedupeCleanup: runtimeState.dedupeCleanup,
      mediaCleanup: runtimeState.mediaCleanup,
      agentUnsub: runtimeState.agentUnsub,
      heartbeatUnsub: runtimeState.heartbeatUnsub,
      transcriptUnsub: runtimeState.transcriptUnsub,
      lifecycleUnsub: runtimeState.lifecycleUnsub,
      chatRunState,
      clients,
      configReloader: runtimeState.configReloader,
      wss,
      httpServer,
      httpServers,
    })({ reason: "gateway startup failed" });
  };

  const { getRuntimeSnapshot, startChannels, startChannel, stopChannel, markChannelLoggedOut } =
    channelManager;
  try {
    const earlyRuntime = await startGatewayEarlyRuntime({
      minimalTestGateway,
      cfgAtStart,
      port,
      gatewayTls,
      tailscaleMode,
      log,
      logDiscovery,
      nodeRegistry,
      broadcast,
      nodeSendToAllSubscribed,
      getPresenceVersion,
      getHealthVersion,
      refreshGatewayHealthSnapshot,
      logHealth,
      dedupe,
      chatAbortControllers,
      chatRunState,
      chatRunBuffers,
      chatDeltaSentAt,
      chatDeltaLastBroadcastLen,
      removeChatRun,
      agentRunSeq,
      nodeSendToSession,
      ...(typeof cfgAtStart.media?.ttlHours === "number"
        ? { mediaCleanupTtlMs: resolveMediaCleanupTtlMs(cfgAtStart.media.ttlHours) }
        : {}),
      skillsRefreshDelayMs: runtimeState.skillsRefreshDelayMs,
      getSkillsRefreshTimer: () => runtimeState.skillsRefreshTimer,
      setSkillsRefreshTimer: (timer) => {
        runtimeState.skillsRefreshTimer = timer;
      },
      loadConfig,
    });
    runtimeState.bonjourStop = earlyRuntime.bonjourStop;
    runtimeState.skillsChangeUnsub = earlyRuntime.skillsChangeUnsub;
    if (earlyRuntime.maintenance) {
      runtimeState.tickInterval = earlyRuntime.maintenance.tickInterval;
      runtimeState.healthInterval = earlyRuntime.maintenance.healthInterval;
      runtimeState.dedupeCleanup = earlyRuntime.maintenance.dedupeCleanup;
      runtimeState.mediaCleanup = earlyRuntime.maintenance.mediaCleanup;
    }

    /*
     * 게이트웨이 내부 이벤트 구독 연결.
     *
     * agent 실행 이벤트, session 이벤트, tool 이벤트가 발생하면 WebSocket client에게 broadcast되도록
     * runtimeState에 구독 해제 핸들들을 저장한다.
     */
    Object.assign(
      runtimeState,
      startGatewayEventSubscriptions({
        minimalTestGateway,
        broadcast,
        broadcastToConnIds,
        nodeSendToSession,
        agentRunSeq,
        chatRunState,
        resolveSessionKeyForRun,
        clearAgentRunContext,
        toolEventRecipients,
        sessionEventSubscribers,
        sessionMessageSubscribers,
        chatAbortControllers,
      }),
    );

    /*
     * 백그라운드 런타임 서비스 시작.
     *
     * 채널 상태 감시, 모델/스킬 관련 주기 작업 등 게이트웨이가 살아있는 동안 돌아야 하는
     * 보조 서비스를 runtimeState에 붙인다.
     */
    Object.assign(
      runtimeState,
      startGatewayRuntimeServices({
        minimalTestGateway,
        cfgAtStart,
        channelManager,
        log,
      }),
    );

    const { execApprovalManager, pluginApprovalManager, extraHandlers } = createGatewayAuxHandlers({
      log,
      activateRuntimeSecrets,
      sharedGatewaySessionGenerationState,
      resolveSharedGatewaySessionGenerationForConfig,
      clients,
    });

    const canvasHostServerPort = (canvasHostServer as CanvasHostServer | null)?.port;

    const unavailableGatewayMethods = new Set<string>(
      minimalTestGateway ? [] : STARTUP_UNAVAILABLE_GATEWAY_METHODS,
    );
    /*
     * WebSocket RPC method가 실행될 때 사용할 의존성 묶음.
     *
     * message-handler는 요청 프레임의 method 이름만 보고 핸들러를 호출한다.
     * 핸들러가 실제로 chat 실행, node 등록, session 조회, config 수정 등을 하려면
     * 이 context 안의 함수와 상태가 필요하다.
     */
    const gatewayRequestContext = createGatewayRequestContext({
      deps,
      runtimeState,
      execApprovalManager,
      pluginApprovalManager,
      loadGatewayModelCatalog,
      getHealthCache,
      refreshHealthSnapshot: refreshGatewayHealthSnapshot,
      logHealth,
      logGateway: log,
      incrementPresenceVersion,
      getHealthVersion,
      broadcast,
      broadcastToConnIds,
      nodeSendToSession,
      nodeSendToAllSubscribed,
      nodeSubscribe,
      nodeUnsubscribe,
      nodeUnsubscribeAll,
      hasConnectedMobileNode: hasMobileNodeConnected,
      clients,
      enforceSharedGatewayAuthGenerationForConfigWrite: (nextConfig: OpenClawConfig) => {
        enforceSharedGatewaySessionGenerationForConfigWrite({
          state: sharedGatewaySessionGenerationState,
          nextConfig,
          resolveRuntimeSnapshotGeneration: resolveSharedGatewaySessionGenerationForRuntimeSnapshot,
          clients,
        });
      },
      nodeRegistry,
      agentRunSeq,
      chatAbortControllers,
      chatAbortedRuns: chatRunState.abortedRuns,
      chatRunBuffers: chatRunState.buffers,
      chatDeltaSentAt: chatRunState.deltaSentAt,
      chatDeltaLastBroadcastLen: chatRunState.deltaLastBroadcastLen,
      addChatRun,
      removeChatRun,
      subscribeSessionEvents: sessionEventSubscribers.subscribe,
      unsubscribeSessionEvents: sessionEventSubscribers.unsubscribe,
      subscribeSessionMessageEvents: sessionMessageSubscribers.subscribe,
      unsubscribeSessionMessageEvents: sessionMessageSubscribers.unsubscribe,
      unsubscribeAllSessionEvents: (connId: string) => {
        sessionEventSubscribers.unsubscribe(connId);
        sessionMessageSubscribers.unsubscribeAll(connId);
      },
      getSessionEventSubscriberConnIds: sessionEventSubscribers.getAll,
      registerToolEventRecipient: toolEventRecipients.add,
      dedupe,
      wizardSessions,
      findRunningWizard,
      purgeWizardSession,
      getRuntimeSnapshot,
      startChannel,
      stopChannel,
      markChannelLoggedOut,
      wizardRunner,
      broadcastVoiceWakeChanged,
      unavailableGatewayMethods,
    });

    setFallbackGatewayContextResolver(() => gatewayRequestContext);

    if (!minimalTestGateway) {
      if (deferredConfiguredChannelPluginIds.length > 0) {
        ({ pluginRegistry, gatewayMethods: baseGatewayMethods } = reloadDeferredGatewayPlugins({
          cfg: gatewayPluginConfigAtStart,
          workspaceDir: defaultWorkspaceDir,
          log,
          coreGatewayHandlers,
          baseMethods,
          pluginIds: startupPluginIds,
          logDiagnostics: false,
        }));
        runtimeState.gatewayMethods = listActiveGatewayMethods(baseGatewayMethods);
      }
    }

    /*
     * 04-ws-connection.ts로 넘어가는 연결 지점.
     *
     * 여기서 WebSocketServer에 connection handler를 붙인다.
     * 이후 모바일 앱/브라우저/CLI가 ws://host:18789 로 접속하면:
     * - connect.challenge 이벤트를 먼저 받고
     * - connect RPC로 인증/역할 등록을 하고
     * - chat.send, health, node.invoke.result 같은 RPC 프레임을 주고받는다.
     */
    attachGatewayWsHandlers({
      wss,
      clients,
      preauthConnectionBudget,
      port,
      gatewayHost: bindHost ?? undefined,
      canvasHostEnabled: Boolean(canvasHost),
      canvasHostServerPort,
      resolvedAuth,
      getResolvedAuth,
      getRequiredSharedGatewaySessionGeneration: () =>
        getRequiredSharedGatewaySessionGeneration(sharedGatewaySessionGenerationState),
      rateLimiter: authRateLimiter,
      browserRateLimiter: browserAuthRateLimiter,
      gatewayMethods: runtimeState.gatewayMethods,
      events: GATEWAY_EVENTS,
      logGateway: log,
      logHealth,
      logWsControl,
      extraHandlers: { ...pluginRegistry.gatewayHandlers, ...extraHandlers },
      broadcast,
      context: gatewayRequestContext,
    });
    ({
      stopGatewayUpdateCheck: runtimeState.stopGatewayUpdateCheck,
      tailscaleCleanup: runtimeState.tailscaleCleanup,
      pluginServices: runtimeState.pluginServices,
    } = await startGatewayPostAttachRuntime({
      minimalTestGateway,
      cfgAtStart,
      bindHost,
      bindHosts: httpBindHosts,
      port,
      tlsEnabled: gatewayTls.enabled,
      log,
      isNixMode,
      startupStartedAt: opts.startupStartedAt,
      broadcast,
      tailscaleMode,
      resetOnExit: tailscaleConfig.resetOnExit ?? false,
      controlUiBasePath,
      logTailscale,
      gatewayPluginConfigAtStart,
      pluginRegistry,
      defaultWorkspaceDir,
      deps,
      startChannels,
      logHooks,
      logChannels,
      unavailableGatewayMethods,
    }));

    /*
     * 스케줄러/cron/heartbeat는 WebSocket handler와 후속 런타임이 붙은 뒤에 활성화한다.
     * 그래야 예약 작업이 너무 일찍 실행되어 아직 준비되지 않은 broadcast/channel 상태를 건드리지 않는다.
     */
    const activated = activateGatewayScheduledServices({
      minimalTestGateway,
      cfgAtStart,
      cron: runtimeState.cronState.cron,
      logCron,
      log,
    });
    runtimeState.heartbeatRunner = activated.heartbeatRunner;

    runtimeState.configReloader = startManagedGatewayConfigReloader({
      minimalTestGateway,
      initialConfig: cfgAtStart,
      initialInternalWriteHash: startupInternalWriteHash,
      watchPath: configSnapshot.path,
      readSnapshot: readConfigFileSnapshot,
      subscribeToWrites: registerConfigWriteListener,
      deps,
      broadcast,
      getState: () => ({
        hooksConfig: runtimeState.hooksConfig,
        hookClientIpConfig: runtimeState.hookClientIpConfig,
        heartbeatRunner: runtimeState.heartbeatRunner,
        cronState: runtimeState.cronState,
        channelHealthMonitor: runtimeState.channelHealthMonitor,
      }),
      setState: (nextState) => {
        runtimeState.hooksConfig = nextState.hooksConfig;
        runtimeState.hookClientIpConfig = nextState.hookClientIpConfig;
        runtimeState.heartbeatRunner = nextState.heartbeatRunner;
        runtimeState.cronState = nextState.cronState;
        deps.cron = runtimeState.cronState.cron;
        runtimeState.channelHealthMonitor = nextState.channelHealthMonitor;
      },
      startChannel,
      stopChannel,
      logHooks,
      logChannels,
      logCron,
      logReload,
      channelManager,
      activateRuntimeSecrets,
      resolveSharedGatewaySessionGenerationForConfig,
      sharedGatewaySessionGenerationState,
      clients,
    });
  } catch (err) {
    await closeOnStartupFailure();
    throw err;
  }

  const close = createGatewayCloseHandler({
    bonjourStop: runtimeState.bonjourStop,
    tailscaleCleanup: runtimeState.tailscaleCleanup,
    canvasHost,
    canvasHostServer,
    releasePluginRouteRegistry,
    stopChannel,
    pluginServices: runtimeState.pluginServices,
    cron: runtimeState.cronState.cron,
    heartbeatRunner: runtimeState.heartbeatRunner,
    updateCheckStop: runtimeState.stopGatewayUpdateCheck,
    stopTaskRegistryMaintenance,
    nodePresenceTimers,
    broadcast,
    tickInterval: runtimeState.tickInterval,
    healthInterval: runtimeState.healthInterval,
    dedupeCleanup: runtimeState.dedupeCleanup,
    mediaCleanup: runtimeState.mediaCleanup,
    agentUnsub: runtimeState.agentUnsub,
    heartbeatUnsub: runtimeState.heartbeatUnsub,
    transcriptUnsub: runtimeState.transcriptUnsub,
    lifecycleUnsub: runtimeState.lifecycleUnsub,
    chatRunState,
    clients,
    configReloader: runtimeState.configReloader,
    wss,
    httpServer,
    httpServers,
  });

  return {
    close: async (opts) => {
      // Run gateway_stop plugin hook before shutdown
      await runGlobalGatewayStopSafely({
        event: { reason: opts?.reason ?? "gateway stopping" },
        ctx: { port },
        onError: (err) => log.warn(`gateway_stop hook failed: ${String(err)}`),
      });
      await runClosePrelude();
      await close(opts);
    },
  };
}
