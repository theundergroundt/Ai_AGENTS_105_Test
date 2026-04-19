# gateway 전체 흐름

## 한 줄 요약

게이트웨이는 `01`에서 전체 설정과 의존성을 조립하고, `02`에서 네트워크 런타임을 만들고, `03`에서 HTTP와 upgrade를 받고, `04`에서 WebSocket 연결을 실제 운영한다.

## 전체 실행 흐름

1. `startGatewayServer()` 시작
2. 설정, 인증, TLS, 플러그인, 채널, 런타임 옵션 해석
3. `createGatewayRuntimeState()` 호출
4. 내부에서 `createGatewayHttpServer()`로 HTTP 서버 생성
5. HTTP 서버를 실제 포트에 `listen`
6. `WebSocketServer({ noServer: true })` 생성
7. `attachGatewayUpgradeHandler()`로 HTTP upgrade 처리 연결
8. 상위 레벨에서 RequestContext와 각종 runtime service 준비
9. `attachGatewayWsHandlers()`로 WebSocket 연결 처리 등록
10. 이후 클라이언트는 HTTP 또는 WebSocket 경로로 게이트웨이를 사용

## HTTP 쪽 흐름

- 일반 요청은 `03-server-http.ts`의 `handleRequest()`로 들어간다.
- 여기서 path 기준으로 stage 목록을 만들고 순서대로 실행한다.
- 주요 대상:
  - hooks
  - `/v1/models`
  - `/v1/embeddings`
  - `/v1/chat/completions`
  - `/v1/responses`
  - `/tools/invoke`
  - 세션 관련 HTTP API
  - canvas/a2ui
  - plugin route
  - Control UI
  - `/health`, `/ready`

## WebSocket 쪽 흐름

1. 클라이언트가 `ws://` 또는 `wss://` 접속
2. 실제로는 HTTP `upgrade` 요청으로 먼저 진입
3. `attachGatewayUpgradeHandler()`가 보안 검사와 preauth budget 검사 수행
4. `wss.handleUpgrade()`로 WebSocket 승격
5. `04-ws-connection.ts`의 connection handler 실행
6. 서버가 `connect.challenge` 이벤트를 먼저 전송
7. 클라이언트가 `connect` RPC로 인증과 역할 등록
8. 이후 `req/res/event` 프레임 기반 RPC 통신 진행

## 학습 포인트

- HTTP와 WebSocket은 같은 포트를 공유하지만 처리 단계가 다르다.
- WebSocketServer는 직접 포트를 열지 않고, HTTP 서버의 upgrade 이벤트를 통해 붙는다.
- 모바일 노드 지원은 WebSocket 연결 위에서 동작한다.
