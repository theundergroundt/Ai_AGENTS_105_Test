/*
 * 04-ws-connection.ts
 * ---------------------------------------------------------------------------
 * OpenClaw 게이트웨이의 "WebSocket 연결 1개를 관리하는 파일"이다.
 *
 * 03-server-http.ts에서 HTTP upgrade가 성공하면 wss.emit("connection", ws, req)가 호출되고,
 * 이 파일의 attachGatewayWsConnectionHandler() 안에 있는 wss.on("connection")이 실행된다.
 *
 * 이 파일에서 실제로 하는 일:
 * - 새 WebSocket 연결마다 connId를 만든다.
 * - 원격 주소, Host, Origin, User-Agent 같은 연결 메타데이터를 모은다.
 * - connect.challenge 이벤트를 먼저 보낸다.
 * - 클라이언트가 정해진 시간 안에 connect RPC로 인증/역할 등록을 하도록 강제한다.
 * - 인증 전 연결 수 제한(preauth budget)을 성공/실패에 맞게 해제한다.
 * - 연결이 닫히면 client set에서 제거하고 presence/node/session 구독을 정리한다.
 * - 실제 req/res/event 프레임 파싱과 method dispatch는 message-handler.ts에 맡긴다.
 *
 * 여기서 "모바일 지원"을 이해할 때 중요한 포인트:
 * - iOS/Android는 HTTP REST로 계속 요청하는 게 아니라 WebSocket을 계속 유지한다.
 * - 서버가 먼저 connect.challenge를 보낸다.
 * - 모바일은 connect 요청으로 자신이 node/operator인지, 어떤 권한을 갖는지 등록한다.
 * - 이후 서버는 node.invoke.request 이벤트를 보내 휴대폰 기능 실행을 요청할 수 있다.
 * - 휴대폰은 node.invoke.result RPC로 결과를 돌려준다.
 */

import { randomUUID } from "node:crypto";
import type { Socket } from "node:net";
import type { WebSocket, WebSocketServer } from "ws";
import { resolveCanvasHostUrl } from "../../infra/canvas-host-url.js";
import { removeRemoteNodeInfo } from "../../infra/skills-remote.js";
import { upsertPresence } from "../../infra/system-presence.js";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import { normalizeLowercaseStringOrEmpty } from "../../shared/string-coerce.js";
import { truncateUtf16Safe } from "../../utils.js";
import { isWebchatClient } from "../../utils/message-channel.js";
import type { AuthRateLimiter } from "../auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "../auth.js";
import { getPreauthHandshakeTimeoutMsFromEnv } from "../handshake-timeouts.js";
import { isLoopbackAddress } from "../net.js";
import { clearNodeWakeState } from "../server-methods/nodes.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "../server-methods/types.js";
import { formatError } from "../server-utils.js";
import { logWs } from "../ws-log.js";
import { getHealthVersion, incrementPresenceVersion } from "./health-state.js";
import type { PreauthConnectionBudget } from "./preauth-connection-budget.js";
import { broadcastPresenceSnapshot } from "./presence-events.js";
import {
  attachGatewayWsMessageHandler,
  type WsOriginCheckMetrics,
} from "./ws-connection/message-handler.js";
import { resolveSharedGatewaySessionGeneration } from "./ws-shared-generation.js";
import type { GatewayWsClient } from "./ws-types.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

const LOG_HEADER_MAX_LEN = 300;
const LOG_HEADER_FORMAT_REGEX = /\p{Cf}/gu;

function replaceControlChars(value: string): string {
  let cleaned = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      cleaned += " ";
      continue;
    }
    cleaned += char;
  }
  return cleaned;
}
const sanitizeLogValue = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const cleaned = replaceControlChars(value)
    .replace(LOG_HEADER_FORMAT_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return undefined;
  }
  if (cleaned.length <= LOG_HEADER_MAX_LEN) {
    return cleaned;
  }
  return truncateUtf16Safe(cleaned, LOG_HEADER_MAX_LEN);
};

function formatSocketEndpoint(
  address: string | undefined,
  port: number | undefined,
): string | undefined {
  if (!address) {
    return undefined;
  }
  if (port === undefined) {
    return address;
  }
  return address.includes(":") ? `[${address}]:${port}` : `${address}:${port}`;
}

function resolveSocketAddress(socket: WebSocket): {
  remoteAddr?: string;
  remotePort?: number;
  localAddr?: string;
  localPort?: number;
  endpoint?: string;
} {
  const rawSocket = (socket as WebSocket & { _socket?: Socket })._socket;
  const remoteAddr = rawSocket?.remoteAddress;
  const remotePort = rawSocket?.remotePort;
  const localAddr = rawSocket?.localAddress;
  const localPort = rawSocket?.localPort;
  const remoteEndpoint = formatSocketEndpoint(remoteAddr, remotePort);
  const localEndpoint = formatSocketEndpoint(localAddr, localPort);
  return {
    remoteAddr,
    remotePort,
    localAddr,
    localPort,
    endpoint:
      remoteEndpoint && localEndpoint
        ? `${remoteEndpoint}->${localEndpoint}`
        : (remoteEndpoint ?? localEndpoint),
  };
}

export type GatewayWsSharedHandlerParams = {
  wss: WebSocketServer;
  clients: Set<GatewayWsClient>;
  preauthConnectionBudget: PreauthConnectionBudget;
  port: number;
  gatewayHost?: string;
  canvasHostEnabled: boolean;
  canvasHostServerPort?: number;
  resolvedAuth: ResolvedGatewayAuth;
  getResolvedAuth?: () => ResolvedGatewayAuth;
  getRequiredSharedGatewaySessionGeneration?: () => string | undefined;
  /** Optional rate limiter for auth brute-force protection. */
  rateLimiter?: AuthRateLimiter;
  /** Browser-origin fallback limiter (loopback is never exempt). */
  browserRateLimiter?: AuthRateLimiter;
  gatewayMethods: string[];
  events: string[];
};

export type AttachGatewayWsConnectionHandlerParams = GatewayWsSharedHandlerParams & {
  logGateway: SubsystemLogger;
  logHealth: SubsystemLogger;
  logWsControl: SubsystemLogger;
  extraHandlers: GatewayRequestHandlers;
  broadcast: (
    event: string,
    payload: unknown,
    opts?: {
      dropIfSlow?: boolean;
      stateVersion?: { presence?: number; health?: number };
    },
  ) => void;
  buildRequestContext: () => GatewayRequestContext;
};

export function attachGatewayWsConnectionHandler(params: AttachGatewayWsConnectionHandlerParams) {
  /*
   * WebSocketServer에 connection handler를 붙이는 함수.
   *
   * 이 함수 자체는 서버를 listen하지 않는다.
   * 이미 02/03 단계에서 만들어진 WebSocketServer(wss)에 "연결이 열리면 이렇게 처리해라"를 등록한다.
   */
  const {
    wss,
    clients,
    preauthConnectionBudget,
    port,
    gatewayHost,
    canvasHostEnabled,
    canvasHostServerPort,
    resolvedAuth,
    getResolvedAuth = () => resolvedAuth,
    getRequiredSharedGatewaySessionGeneration = () =>
      resolveSharedGatewaySessionGeneration(getResolvedAuth()),
    rateLimiter,
    browserRateLimiter,
    gatewayMethods,
    events,
    logGateway,
    logHealth,
    logWsControl,
    extraHandlers,
    broadcast,
    buildRequestContext,
  } = params;
  const originCheckMetrics: WsOriginCheckMetrics = { hostHeaderFallbackAccepted: 0 };

  wss.on("connection", (socket, upgradeReq) => {
    /*
     * 여기부터가 WebSocket 연결 하나의 생명주기 시작이다.
     *
     * socket: 실제 WebSocket 연결.
     * upgradeReq: 처음 WebSocket으로 승격될 때의 HTTP 요청 정보.
     *
     * 연결마다 client, handshake 상태, 마지막 프레임 메타데이터를 별도로 추적한다.
     */
    let client: GatewayWsClient | null = null;
    let closed = false;
    const openedAt = Date.now();
    const connId = randomUUID();
    const { remoteAddr, remotePort, localAddr, localPort, endpoint } = resolveSocketAddress(socket);
    /*
     * 03-server-http.ts의 upgrade 단계에서 잡아둔 preauth budget key를 가져온다.
     * connect 인증이 끝나기 전까지 연결 개수를 제한하기 위한 값이다.
     */
    const preauthBudgetKey = (
      socket as WebSocket & {
        __openclawPreauthBudgetClaimed?: boolean;
        __openclawPreauthBudgetKey?: string;
      }
    ).__openclawPreauthBudgetKey;
    (
      socket as WebSocket & {
        __openclawPreauthBudgetClaimed?: boolean;
      }
    ).__openclawPreauthBudgetClaimed = true;
    /*
     * HTTP upgrade 요청의 헤더를 정리한다.
     * 로그, Origin 검사, 인증 정책, 문제 진단에 쓰인다.
     */
    const headerValue = (value: string | string[] | undefined) =>
      Array.isArray(value) ? value[0] : value;
    const requestHost = headerValue(upgradeReq.headers.host);
    const requestOrigin = headerValue(upgradeReq.headers.origin);
    const requestUserAgent = headerValue(upgradeReq.headers["user-agent"]);
    const forwardedFor = headerValue(upgradeReq.headers["x-forwarded-for"]);
    const realIp = headerValue(upgradeReq.headers["x-real-ip"]);

    const canvasHostPortForWs = canvasHostServerPort ?? (canvasHostEnabled ? port : undefined);
    const canvasHostOverride =
      gatewayHost && gatewayHost !== "0.0.0.0" && gatewayHost !== "::" ? gatewayHost : undefined;
    /*
     * 연결된 클라이언트에게 알려줄 Canvas Host URL을 계산한다.
     * 모바일/브라우저 클라이언트가 canvas 자원을 열 때 이 URL을 참고할 수 있다.
     */
    const canvasHostUrl = resolveCanvasHostUrl({
      canvasPort: canvasHostPortForWs,
      hostOverride: canvasHostServerPort ? canvasHostOverride : undefined,
      requestHost: upgradeReq.headers.host,
      forwardedProto: upgradeReq.headers["x-forwarded-proto"],
      localAddress: upgradeReq.socket?.localAddress,
    });

    logWs("in", "open", { connId, remoteAddr, remotePort, localAddr, localPort, endpoint });
    /*
     * handshakeState는 connect RPC가 성공했는지 추적한다.
     * pending 상태가 오래 지속되면 handshake timeout으로 연결을 닫는다.
     */
    let handshakeState: "pending" | "connected" | "failed" = "pending";
    let holdsPreauthBudget = true;
    let closeCause: string | undefined;
    let closeMeta: Record<string, unknown> = {};
    let lastFrameType: string | undefined;
    let lastFrameMethod: string | undefined;
    let lastFrameId: string | undefined;

    const setCloseCause = (cause: string, meta?: Record<string, unknown>) => {
      if (!closeCause) {
        closeCause = cause;
      }
      if (meta && Object.keys(meta).length > 0) {
        closeMeta = { ...closeMeta, ...meta };
      }
    };

    /*
     * connect 인증이 성공하거나 연결이 닫히면 preauth budget을 반환한다.
     * 이걸 하지 않으면 인증 전 연결 슬롯이 누수되어 새 연결이 막힐 수 있다.
     */
    const releasePreauthBudget = () => {
      if (!holdsPreauthBudget) {
        return;
      }
      holdsPreauthBudget = false;
      preauthConnectionBudget.release(preauthBudgetKey);
    };

    /*
     * 마지막으로 본 WebSocket 프레임 정보를 기록한다.
     * 연결이 비정상 종료됐을 때 "어떤 method 처리 중 끊겼는지"를 로그로 남기기 위한 값이다.
     */
    const setLastFrameMeta = (meta: { type?: string; method?: string; id?: string }) => {
      if (meta.type || meta.method || meta.id) {
        lastFrameType = meta.type ?? lastFrameType;
        lastFrameMethod = meta.method ?? lastFrameMethod;
        lastFrameId = meta.id ?? lastFrameId;
      }
    };

    /*
     * 서버 -> 클라이언트로 JSON 프레임을 보내는 얇은 래퍼.
     * OpenClaw WebSocket 프로토콜은 문자열 JSON 프레임을 주고받는다.
     */
    const send = (obj: unknown) => {
      try {
        socket.send(JSON.stringify(obj));
      } catch {
        /* ignore */
      }
    };

    /*
     * 서버가 먼저 connect.challenge를 보낸다.
     *
     * 이 nonce는 클라이언트가 connect 요청을 보낼 때 인증 payload에 포함해야 한다.
     * 이렇게 하면 연결 직후 재사용/위조된 connect payload를 줄이고,
     * 서버가 "이 소켓에서 방금 받은 challenge에 대한 응답"인지 확인할 수 있다.
     */
    const connectNonce = randomUUID();
    send({
      type: "event",
      event: "connect.challenge",
      payload: { nonce: connectNonce, ts: Date.now() },
    });

    /*
     * 연결 닫기 공통 함수.
     *
     * 그냥 socket.close()만 호출하지 않고:
     * - handshake timer 제거
     * - preauth budget 반환
     * - clients set에서 제거
     * 를 같이 처리한다.
     */
    const close = (code = 1000, reason?: string) => {
      if (closed) {
        return;
      }
      closed = true;
      clearTimeout(handshakeTimer);
      releasePreauthBudget();
      if (client) {
        clients.delete(client);
      }
      try {
        socket.close(code, reason);
      } catch {
        /* ignore */
      }
    };

    /*
     * 소켓 에러는 연결 단위 문제이므로 로깅하고 연결을 닫는다.
     */
    socket.once("error", (err) => {
      logWsControl.warn(`error conn=${connId} remote=${remoteAddr ?? "?"}: ${formatError(err)}`);
      close();
    });

    const isNoisySwiftPmHelperClose = (userAgent: string | undefined, remote: string | undefined) =>
      normalizeLowercaseStringOrEmpty(userAgent).includes("swiftpm-testing-helper") &&
      isLoopbackAddress(remote);

    /*
     * 연결 종료 정리.
     *
     * 여기서 하는 정리:
     * - 연결 시간/마지막 프레임/Origin/User-Agent 등을 로그로 남긴다.
     * - presence snapshot을 갱신한다.
     * - session event 구독을 모두 해제한다.
     * - role=node인 모바일/원격 노드는 nodeRegistry에서 제거한다.
     * - remote node capability/cache도 정리한다.
     */
    socket.once("close", (code, reason) => {
      const durationMs = Date.now() - openedAt;
      const logForwardedFor = sanitizeLogValue(forwardedFor);
      const logOrigin = sanitizeLogValue(requestOrigin);
      const logHost = sanitizeLogValue(requestHost);
      const logUserAgent = sanitizeLogValue(requestUserAgent);
      const logReason = sanitizeLogValue(reason?.toString());
      const closeContext = {
        cause: closeCause,
        handshake: handshakeState,
        durationMs,
        lastFrameType,
        lastFrameMethod,
        lastFrameId,
        host: logHost,
        origin: logOrigin,
        userAgent: logUserAgent,
        forwardedFor: logForwardedFor,
        remoteAddr,
        remotePort,
        localAddr,
        localPort,
        endpoint,
        ...closeMeta,
      };
      if (!client) {
        const logFn = isNoisySwiftPmHelperClose(requestUserAgent, remoteAddr)
          ? logWsControl.debug
          : logWsControl.warn;
        logFn(
          `closed before connect conn=${connId} peer=${endpoint ?? "n/a"} remote=${remoteAddr ?? "?"} fwd=${logForwardedFor || "n/a"} origin=${logOrigin || "n/a"} host=${logHost || "n/a"} ua=${logUserAgent || "n/a"} code=${code ?? "n/a"} reason=${logReason || "n/a"}`,
          closeContext,
        );
      }
      if (client && isWebchatClient(client.connect.client)) {
        logWsControl.info(
          `webchat disconnected code=${code} reason=${logReason || "n/a"} conn=${connId}`,
        );
      }
      if (client?.presenceKey) {
        upsertPresence(client.presenceKey, { reason: "disconnect" });
        broadcastPresenceSnapshot({ broadcast, incrementPresenceVersion, getHealthVersion });
      }
      const context = buildRequestContext();
      context.unsubscribeAllSessionEvents(connId);
      if (client?.connect?.role === "node") {
        const nodeId = context.nodeRegistry.unregister(connId);
        if (nodeId) {
          removeRemoteNodeInfo(nodeId);
          context.nodeUnsubscribeAll(nodeId);
          clearNodeWakeState(nodeId);
        }
      }
      logWs("out", "close", {
        connId,
        code,
        reason: logReason,
        durationMs,
        cause: closeCause,
        handshake: handshakeState,
        lastFrameType,
        lastFrameMethod,
        lastFrameId,
        endpoint,
      });
      close();
    });

    /*
     * connect RPC 제한 시간.
     *
     * WebSocket이 열렸다고 바로 신뢰하지 않는다.
     * 클라이언트가 제한 시간 안에 connect 요청으로 인증과 역할 등록을 끝내야 한다.
     * 실패하면 handshake-timeout으로 연결을 닫는다.
     */
    const handshakeTimeoutMs = getPreauthHandshakeTimeoutMsFromEnv();
    const handshakeTimer = setTimeout(() => {
      if (!client) {
        handshakeState = "failed";
        setCloseCause("handshake-timeout", {
          handshakeMs: Date.now() - openedAt,
          endpoint,
        });
        logWsControl.warn(
          `handshake timeout conn=${connId} peer=${endpoint ?? "n/a"} remote=${remoteAddr ?? "?"}`,
        );
        close();
      }
    }, handshakeTimeoutMs);

    /*
     * 실제 프레임 처리기를 붙인다.
     *
     * 이 파일은 연결 생명주기를 관리하고,
     * message-handler.ts는 수신 메시지를 해석한다.
     *
     * message-handler.ts가 맡는 일:
     * - connect 요청 검증
     * - req/res/event 프레임 검증
     * - method 이름으로 server-method handler 호출
     * - client 객체 생성 후 setClient() 호출
     * - close cause, handshake state, last frame meta 갱신
     */
    attachGatewayWsMessageHandler({
      socket,
      upgradeReq,
      connId,
      remoteAddr,
      remotePort,
      localAddr,
      localPort,
      endpoint,
      forwardedFor,
      realIp,
      requestHost,
      requestOrigin,
      requestUserAgent,
      canvasHostUrl,
      connectNonce,
      getResolvedAuth,
      getRequiredSharedGatewaySessionGeneration,
      rateLimiter,
      browserRateLimiter,
      gatewayMethods,
      events,
      extraHandlers,
      buildRequestContext,
      send,
      close,
      isClosed: () => closed,
      clearHandshakeTimer: () => clearTimeout(handshakeTimer),
      getClient: () => client,
      setClient: (next) => {
        /*
         * connect 인증이 성공한 순간 호출된다.
         * 이때부터 이 소켓은 "인증 전 연결"이 아니라 정식 client다.
         */
        releasePreauthBudget();
        client = next;
        clients.add(next);
      },
      setHandshakeState: (next) => {
        handshakeState = next;
      },
      setCloseCause,
      setLastFrameMeta,
      originCheckMetrics,
      logGateway,
      logHealth,
      logWsControl,
    });
  });
}
