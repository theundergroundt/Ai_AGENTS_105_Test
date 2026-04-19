# 01-server.impl.ts

## 역할

- 게이트웨이 서버의 최상위 조립 파일
- `startGatewayServer()`를 통해 전체 runtime을 시작

## 여기서 하는 일

- 시작 옵션과 환경변수 정리
- 초기 config 로드
- gateway auth bootstrap
- TLS, Tailscale, Control UI, OpenAI 호환 HTTP 옵션 결정
- 플러그인과 채널 로딩
- `createGatewayRuntimeState()` 호출
- `createGatewayRequestContext()` 구성
- `attachGatewayWsHandlers()` 연결
- cron, heartbeat, reload watcher 같은 후속 서비스 시작

## 핵심 해석

- 이 파일은 직접 HTTP 요청을 세부 처리하지 않는다.
- 대신 "어떤 부품이 어떤 순서로 붙는가"를 결정한다.
- 그래서 gateway를 공부할 때 가장 먼저 봐야 하는 파일이다.

## 기억할 포인트

- 가장 중요한 진입 함수는 `startGatewayServer()`
- runtime state를 만든 다음에야 WebSocket handler를 붙인다
- gateway method 목록은 기본값에 플러그인/채널 제공분이 합쳐질 수 있다
