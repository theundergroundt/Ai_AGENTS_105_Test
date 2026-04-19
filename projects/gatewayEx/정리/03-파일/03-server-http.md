# 03-server-http.ts

## 역할

- HTTP 요청의 실제 입구
- WebSocket upgrade의 실제 입구

## 일반 HTTP 처리

- `createGatewayHttpServer()`가 HTTP 또는 HTTPS 서버를 만든다
- 내부 `handleRequest()`가 모든 일반 요청을 받는다
- 요청 path에 따라 stage 목록을 만든 뒤 `runGatewayHttpRequestStages()`로 순차 실행한다

## 주요 stage

- hooks
- models
- embeddings
- tools-invoke
- sessions-kill
- sessions-history
- openresponses
- openai
- canvas-auth
- a2ui
- canvas-http
- plugin-auth / plugin-http
- control-ui 관련 stage
- gateway-probes

## upgrade 처리

- `attachGatewayUpgradeHandler()`가 `httpServer.on("upgrade")`를 잡는다
- canvas 전용 WebSocket 경로인지 확인한다
- preauth connection budget을 확인한다
- handler 미부착 상태면 503으로 거절한다
- 통과하면 `wss.handleUpgrade()`를 호출한다

## 핵심 해석

- 이 파일은 라우터이면서 입구 제어기다.
- OpenAI 호환 HTTP API와 모바일 WebSocket 연결이 같은 포트를 공유하는 이유를 가장 잘 보여준다.
